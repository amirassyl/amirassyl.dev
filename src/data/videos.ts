// Videos shown on /videos/. To add one, add an entry to the list below.
//
//   title    what to call it on the page
//   year     shown next to the title
//   note     optional one-line description shown under the title
//   and ONE of:
//   youtube  the YouTube link (any form: watch, youtu.be, shorts) or just the video ID
//   file     the name of a video hosted on this site (see below)
//
// A YouTube video: the thumbnail comes from YouTube automatically. To add a
// silent preview that plays on hover, run
//     npm run clip -- <youtube link> <start second> [length]
//
// A video file from this computer (best for short pieces, under about a minute):
//     npm run clip -- --name my-video --file ~/Downloads/my-video.mov
// then use  file: 'my-video'  in the entry. This saves the full video, a silent
// preview and a still frame into public/clips/.
//
// The first entry appears first on the page.

export interface Video {
  title: string;
  year: number;
  note?: string;
  youtube?: string;
  file?: string;
}

export const videos: Video[] = [
  { title: 'Paper cutout effect', year: 2026, file: 'paper-cutout-effect' },
  { title: 'Circle effect', year: 2026, file: 'circle-effect' },
];
