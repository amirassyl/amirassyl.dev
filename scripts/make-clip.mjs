// Makes the silent hover preview for one video on /videos/.
//
//   npm run clip -- <youtube link or ID> <start> [length]
//   npm run clip -- <youtube link or ID> <start> [length] --file path/to/export.mp4
//
//   start    where the preview begins, in seconds or as m:ss (e.g. 75 or 1:15)
//   length   how many seconds to keep (default 8)
//   --file   cut from a video file on this computer instead of downloading from YouTube
//
// Writes public/clips/<video ID>.mp4 (small, no sound, loops) and
// public/clips/<video ID>.jpg (the still shown before hovering).
// Needs ffmpeg, and yt-dlp unless --file is used.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const HEIGHT = 480; // preview height in pixels; tiles are small, so this is plenty
const QUALITY = 28; // x264 CRF: higher is smaller and blurrier
const DEFAULT_LENGTH = 8;

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

const args = process.argv.slice(2);
const fileFlag = args.indexOf('--file');
const localFile = fileFlag >= 0 ? args.splice(fileFlag, 2)[1] : null;
const [link, startArg, lengthArg] = args;

if (!link || startArg === undefined) {
  fail('Usage: npm run clip -- <youtube link or ID> <start> [length] [--file path/to/video.mp4]');
}

const id = youtubeId(link);
const start = seconds(startArg);
const length = lengthArg === undefined ? DEFAULT_LENGTH : seconds(lengthArg);
if (length <= 0 || length > 30) fail('Length should be between 1 and 30 seconds.');

const ffmpeg = findTool('ffmpeg');
if (!ffmpeg) fail('ffmpeg was not found. Install it, for example: mamba create -n video -c conda-forge ffmpeg yt-dlp');

const work = mkdtempSync(join(tmpdir(), 'clip-'));
let source = localFile;
let sourceStart = start;

try {
  if (localFile) {
    if (!existsSync(localFile)) fail(`No file at ${localFile}`);
  } else {
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
    const downloaded = readdirSync(work).find((name) => name.startsWith('source.'));
    if (!downloaded) fail('The download produced no file.');
    source = join(work, downloaded);
    sourceStart = 0; // the downloaded piece already starts at the right moment
  }

  mkdirSync('public/clips', { recursive: true });
  const clip = `public/clips/${id}.mp4`;
  const still = `public/clips/${id}.jpg`;

  console.log('Encoding the preview…');
  execFileSync(
    ffmpeg,
    [
      '-y', '-loglevel', 'error',
      '-ss', String(sourceStart), '-t', String(length), '-i', source,
      '-an', // no sound: muted clips are the only kind browsers will play on hover
      '-vf', `scale=-2:${HEIGHT},fps=30`,
      '-c:v', 'libx264', '-crf', String(QUALITY), '-preset', 'slow',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      clip,
    ],
    { stdio: 'inherit' },
  );

  // The still is the clip's first frame, so hovering starts from the same picture.
  execFileSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-i', clip, '-frames:v', '1', '-q:v', '4', '-update', '1', still],
    { stdio: 'inherit' },
  );

  const kb = (path) => `${Math.round(statSync(path).size / 1024)} KB`;
  console.log(`\nSaved ${clip} (${kb(clip)}) and ${still} (${kb(still)}).`);
  console.log('Commit both files, and make sure the video is listed in src/data/videos.ts.');
} finally {
  rmSync(work, { recursive: true, force: true });
}
