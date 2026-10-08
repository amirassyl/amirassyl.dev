// Prepares a video for /videos/.
//
// A YouTube video — makes the silent hover preview:
//   npm run clip -- <youtube link or ID> <start> [length]
//   npm run clip -- <youtube link or ID> <start> [length] --file path/to/export.mp4
//
// A video file hosted on this site — makes the full video, the preview and the still:
//   npm run clip -- --name my-video --file path/to/video.mov [start] [length]
//
//   start    where the preview begins, in seconds or as m:ss (e.g. 75 or 1:15)
//   length   how many seconds of preview to keep (default 8; whole video up to 20s with --name)
//   --file   use a video file on this computer instead of downloading from YouTube
//   --name   host the video here under this name (lowercase letters, numbers, dashes)
//
// Writes into public/clips/:
//   <id>.mp4        small silent preview that plays on hover
//   <id>.jpg        the still shown before hovering
//   <id>-full.mp4   the full video with sound (only with --name)
// where <id> is the YouTube video ID or the --name.
// Needs ffmpeg, and yt-dlp when downloading from YouTube.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const PREVIEW_HEIGHT = 480; // shorter side of the preview; tiles are small, so this is plenty
const PREVIEW_QUALITY = 28; // x264 CRF: higher is smaller and blurrier
// The full video: tried in this order until the file fits under the size limit.
// Longer videos end up smaller and a little softer.
const FULL_ATTEMPTS = [
  { height: 1080, quality: 24 },
  { height: 720, quality: 26 },
  { height: 720, quality: 30 },
  { height: 720, quality: 32 },
  { height: 540, quality: 31 },
];
const DEFAULT_LENGTH = 8;
const HOSTED_PREVIEW_LIMIT = 20; // seconds
const MAX_FILE_MB = 24; // Cloudflare refuses single files over 25 MB

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

// Look on the PATH first, then in the conda environment set up for this.
function findTool(name) {
  const candidates = [name, join(homedir(), 'miniforge3/envs/video/bin', name)];
  for (const candidate of candidates) {
    if (spawnSync(candidate, ['-version'], { stdio: 'ignore' }).status === 0) return candidate;
    if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
  }
  return null;
}

function youtubeId(input) {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  const match = value.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  if (!match) fail(`"${input}" is not a YouTube link or video ID.`);
  return match[1];
}

function seconds(input) {
  const parts = String(input).split(':').map(Number);
  if (parts.some(Number.isNaN)) fail(`"${input}" is not a time. Use seconds (75) or m:ss (1:15).`);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

// Pull "--flag value" out of the argument list.
function takeOption(args, flag) {
  const at = args.indexOf(flag);
  return at >= 0 ? args.splice(at, 2)[1] : null;
}

const args = process.argv.slice(2);
const localFile = takeOption(args, '--file');
const name = takeOption(args, '--name');
const hosted = name !== null;

const usage =
  'Usage:\n' +
  '  npm run clip -- <youtube link or ID> <start> [length] [--file path/to/video.mp4]\n' +
  '  npm run clip -- --name my-video --file path/to/video.mov [start] [length]';

let id;
let startArg;
let lengthArg;
if (hosted) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail('--name should be lowercase letters, numbers and dashes, like my-video.');
  if (!localFile) fail(`--name needs --file with the video to host.\n\n${usage}`);
  id = name;
  [startArg = '0', lengthArg] = args;
} else {
  const [link] = args;
  [, startArg, lengthArg] = args;
  if (!link || startArg === undefined) fail(usage);
  id = youtubeId(link);
}

const ffmpeg = findTool('ffmpeg');
if (!ffmpeg) fail('ffmpeg was not found. Install it, for example: mamba create -n video -c conda-forge ffmpeg yt-dlp');
if (localFile && !existsSync(localFile)) fail(`No file at ${localFile}`);

const start = seconds(startArg);
let length = lengthArg === undefined ? DEFAULT_LENGTH : seconds(lengthArg);

// For a hosted video with no length given, preview the whole thing if it is short.
if (hosted && lengthArg === undefined) {
  const probe = spawnSync(ffmpeg, ['-i', localFile], { encoding: 'utf8' }).stderr || '';
  const found = probe.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const total = found ? Number(found[1]) * 3600 + Number(found[2]) * 60 + Number(found[3]) : DEFAULT_LENGTH;
  length = Math.min(Math.max(total - start, 1), HOSTED_PREVIEW_LIMIT);
}
if (length <= 0 || length > 30) fail('Length should be between 1 and 30 seconds.');

const work = mkdtempSync(join(tmpdir(), 'clip-'));
let source = localFile;
let sourceStart = start;

// Scale so the SHORTER side is at most `limit` pixels, which treats wide and tall videos alike.
const fit = (limit) => `scale='if(gt(iw,ih),-2,min(${limit},iw))':'if(gt(iw,ih),min(${limit},ih),-2)'`;
const run = (options) => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...options], { stdio: 'inherit' });
const megabytes = (path) => statSync(path).size / 1024 / 1024;
const size = (path) => (megabytes(path) < 1 ? `${Math.round(megabytes(path) * 1024)} KB` : `${megabytes(path).toFixed(1)} MB`);

try {
  if (!localFile) {
    const ytdlp = findTool('yt-dlp');
    if (!ytdlp) fail('yt-dlp was not found. Install it, or pass --file with a video file from this computer.');
    console.log(`Downloading ${length}s of ${id} from ${start}s…`);
    // Fetch only the part that is needed, at modest quality.
    execFileSync(
      ytdlp,
      [
        '--quiet',
        '--no-warnings',
        '--no-playlist',
        '--ffmpeg-location', ffmpeg,
        '--download-sections', `*${start}-${start + length}`,
        '--force-keyframes-at-cuts',
        '-f', 'bv*[height<=720]/b[height<=720]/bv*/b',
        '-o', join(work, 'source.%(ext)s'),
        `https://www.youtube.com/watch?v=${id}`,
      ],
      { stdio: 'inherit' },
    );
    const downloaded = readdirSync(work).find((file) => file.startsWith('source.'));
    if (!downloaded) fail('The download produced no file.');
    source = join(work, downloaded);
    sourceStart = 0; // the downloaded piece already starts at the right moment
  }

  mkdirSync('public/clips', { recursive: true });
  const clip = `public/clips/${id}.mp4`;
  const still = `public/clips/${id}.jpg`;
  const full = `public/clips/${id}-full.mp4`;
  const saved = [];

  console.log('Encoding the preview…');
  run([
    '-ss', String(sourceStart), '-t', String(length), '-i', source,
    '-map', '0:v:0', // the main picture only: no sound, no embedded cover image
    '-vf', `${fit(PREVIEW_HEIGHT)},fps=30`,
    '-c:v', 'libx264', '-crf', String(PREVIEW_QUALITY), '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    clip,
  ]);
  saved.push(clip);

  // The still is the preview's first frame, so hovering starts from the same picture.
  run(['-i', clip, '-frames:v', '1', '-q:v', '4', '-update', '1', still]);
  saved.push(still);

  if (hosted) {
    for (const attempt of FULL_ATTEMPTS) {
      console.log(`Encoding the full video at up to ${attempt.height}p…`);
      run([
        '-i', source,
        '-map', '0:v:0', '-map', '0:a:0?',
        '-vf', fit(attempt.height),
        '-c:v', 'libx264', '-crf', String(attempt.quality), '-preset', 'slow', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        full,
      ]);
      if (megabytes(full) <= MAX_FILE_MB) break;
      console.log(`  ${size(full)} is over the ${MAX_FILE_MB} MB limit, trying smaller…`);
    }
    if (megabytes(full) > MAX_FILE_MB) {
      rmSync(full, { force: true });
      fail(`The full video is still over the ${MAX_FILE_MB} MB the site can serve. Use a shorter video, or keep it on YouTube.`);
    }
    saved.push(full);
  }

  console.log('\nSaved:');
  for (const path of saved) console.log(`  ${path} (${size(path)})`);
  console.log(
    hosted
      ? `\nNow add an entry with  file: '${id}'  to src/data/videos.ts and commit the files.`
      : '\nCommit the files, and make sure the video is listed in src/data/videos.ts.',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
