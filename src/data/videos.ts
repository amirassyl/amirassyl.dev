// Videos shown on /videos/. To add one, add an entry to the list below.
//
//   title    what to call it on the page
//   year     shown next to the title
//   youtube  the YouTube link (any form: watch, youtu.be, shorts) or just the video ID
//   note     optional one-line description shown under the title
//
// The thumbnail comes from YouTube automatically. To add a silent preview that
// plays on hover, run:   npm run clip -- <youtube link> <start second> [length]
// which saves a short clip and a still frame into public/clips/.
//
// The first entry appears first on the page.

export interface Video {
  title: string;
  year: number;
  youtube: string;
  note?: string;
}

export const videos: Video[] = [];
