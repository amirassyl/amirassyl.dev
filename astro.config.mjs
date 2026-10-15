import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://amirassyl.dev',
  // React is used only by the 3D world (/3d); no other page ships it.
  integrations: [react(), sitemap()],
  markdown: { shikiConfig: { theme: 'github-dark-dimmed' } },
});
