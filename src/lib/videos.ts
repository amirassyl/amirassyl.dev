import { existsSync } from 'node:fs';
import { videos, type Video } from '../data/videos';

/** Pulls the 11-character video ID out of any YouTube link, or accepts a bare ID. */
export function youtubeId(input: string): string {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  const match = value.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  if (!match) throw new Error(`src/data/videos.ts: "${input}" is not a YouTube link or video ID`);
  return match[1];
}

export interface VideoTile extends Video {
  /** The YouTube video ID, or the file name for a video hosted here. */
  id: string;
  /** Where the tile links to without JavaScript: YouTube, or the full video file. */
  watchUrl: string;
  /** The full video file, for videos hosted on this site. */
  full?: string;
  /** Still image: the saved frame if there is one, otherwise YouTube's thumbnail. */
  poster: string;
  /** Silent hover preview, if one has been made with `npm run clip`. */
  clip?: string;
}

export function getVideos(): VideoTile[] {
  return videos.map((video) => {
    const where = `src/data/videos.ts: "${video.title}"`;
    if (video.youtube && video.file) throw new Error(`${where} has both youtube and file; keep one`);

    if (video.file) {
      const id = video.file;
      for (const name of [`${id}-full.mp4`, `${id}.mp4`, `${id}.jpg`]) {
        if (!existsSync(`public/clips/${name}`)) {
          throw new Error(`${where}: public/clips/${name} is missing. Run: npm run clip -- --name ${id} --file <video file>`);
        }
      }
      const full = `/clips/${id}-full.mp4`;
      return { ...video, id, watchUrl: full, full, poster: `/clips/${id}.jpg`, clip: `/clips/${id}.mp4` };
    }

    if (!video.youtube) throw new Error(`${where} needs either youtube or file`);
    const id = youtubeId(video.youtube);
    return {
      ...video,
      id,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      poster: existsSync(`public/clips/${id}.jpg`) ? `/clips/${id}.jpg` : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      clip: existsSync(`public/clips/${id}.mp4`) ? `/clips/${id}.mp4` : undefined,
    };
  });
}
