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
  id: string;
  watchUrl: string;
  /** Still image: the saved frame if a clip was made, otherwise YouTube's thumbnail. */
  poster: string;
  /** Silent hover preview, if one has been made with `npm run clip`. */
  clip?: string;
}

export function getVideos(): VideoTile[] {
  return videos.map((video) => {
    const id = youtubeId(video.youtube);
    const hasClip = existsSync(`public/clips/${id}.mp4`);
    const hasFrame = existsSync(`public/clips/${id}.jpg`);
    return {
      ...video,
      id,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      poster: hasFrame ? `/clips/${id}.jpg` : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      clip: hasClip ? `/clips/${id}.mp4` : undefined,
    };
  });
}
