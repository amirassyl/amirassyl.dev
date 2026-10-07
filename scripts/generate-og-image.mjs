// Renders the default social preview image (public/og-default.png, 1200×630).
// Run with `npm run og` after changing the name, description or domain in
// src/data/site.ts, then commit the regenerated PNG.
//
// Text is taken from src/data/site.ts so the image cannot drift from the site
// copy. Glyphs come from the fonts installed on the machine that runs this
// script, so the exact letterforms can differ slightly between machines.

import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { site } from '../src/data/site.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 96;

const BACKGROUND = '#f7f5f0';
const INK = '#16161a';
const MUTED = '#55555e';

const out = fileURLToPath(new URL('../public/og-default.png', import.meta.url));

// First sentence of the site description, without its full stop.
const descriptor = site.description.split(/\.\s/)[0].replace(/\.$/, '');
const domain = new URL(site.url).host;

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sans = "'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BACKGROUND}" />
  <rect x="${MARGIN}" y="${MARGIN}" width="72" height="6" fill="${INK}" />
  <text x="${MARGIN}" y="300" font-family="${sans}" font-size="88" font-weight="700" letter-spacing="-2" fill="${INK}">${escape(site.name)}</text>
  <text x="${MARGIN}" y="372" font-family="${sans}" font-size="36" fill="${MUTED}">${escape(descriptor)}</text>
  <text x="${MARGIN}" y="${HEIGHT - MARGIN}" font-family="${sans}" font-size="32" font-weight="500" fill="${INK}">${escape(domain)}</text>
</svg>`;

const info = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);

if (info.width !== WIDTH || info.height !== HEIGHT) {
  throw new Error(`Expected ${WIDTH}×${HEIGHT}, got ${info.width}×${info.height}`);
}

console.log(`Wrote ${out} (${info.width}×${info.height}, ${info.size} bytes)`);
