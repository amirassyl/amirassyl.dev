// Videos shown on /videos/. To add one, add an entry to the list below.
//
//   title    what to call it on the page
//   year     shown next to the title
//   note     optional one-line description shown under the title
//   vertical true for a tall (9:16) video; these are shown in their own row
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
  vertical?: boolean;
  youtube?: string;
  file?: string;
}

export const videos: Video[] = [
  { title: 'Miami', year: 2026, file: 'miami' },
  { title: 'Paper cutouts', year: 2026, file: 'paper-cutout-effect', note: 'Family photos, cut out and set in motion.' },
  { title: 'Circles', year: 2026, file: 'circle-effect', note: "Friends' selfies, multiplying in circles." },
  { title: 'Almaty to San Francisco', year: 2025, youtube: 'https://youtu.be/cc36LDgcT_Q', note: 'A travel film, shot ultrawide.' },
  { title: 'Continuum', year: 2026, youtube: 'https://youtu.be/RtNOG1S8TjQ', note: 'Minerva classmates look back on a year in San Francisco.' },
  { title: "Seniors' song", year: 2025, file: 'sofa-and-ilyas', vertical: true, note: 'Sofa and Ilyas, NIS PhM Astana class of 2025.' },
  { title: 'Paradise on Earth', year: 2024, file: 'rai-na-zemle', vertical: true, note: 'A trip to Malaysia. In Russian.' },
];
