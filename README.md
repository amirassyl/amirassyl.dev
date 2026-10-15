# amirassyl.dev

Source for my personal site: projects, résumé, and writing.

Built with [Astro](https://astro.build), deployed on Cloudflare Workers.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build
npm run check
npm test         # vitest: world schema, reducer, fallback parser, /api/world
```

Content lives in `src/data/site.ts` and `src/content/`.

## The 3D world (/3d/)

An optional 3D world. The 2D site stays the default; the ladybug on my name (`public/ladybug.js`, home page only) is the way in.

- `src/world/` is the world as data: the zod schema (`schema.ts`), the tools Pixel Amir can call (`tools.ts`), the reducer that turns a tool call into the next state (`reducer.ts`) and the keyword fallback (`intent.ts`). Shared by the browser and the Worker.
- `src/world3d/` is the renderer: React Three Fiber, custom GLSL for the grass, ground, sky and weather, Rapier for walking and jumping. Only `/3d/` loads it.
- `worker/world.ts` answers `POST /api/world` with Gemini function calling, streamed as NDJSON. Without `GEMINI_API_KEY` it answers 503 and the page uses the fallback parser, so `npm run dev` works with no key. To try the real model locally: put `GEMINI_API_KEY=...` in `.dev.vars`, then `npm run build && npx wrangler dev`.
- The Worker adds `'wasm-unsafe-eval'` to the CSP of `/3d/` only, because Rapier is WebAssembly.

## Deploying

CI (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`: `npm ci`, `npm run check`, `npm run build`. On pushes to `main`, once those pass, a second job runs `npx wrangler deploy`. If the Cloudflare secrets below aren't set, that job logs a notice and skips its steps, so the run stays green. Node comes from `.nvmrc`.

To turn deploys on:

1. Create an API token in the Cloudflare dashboard (My Profile or Manage Account, then API Tokens, Create Token) using the "Edit Cloudflare Workers" template. The permission that matters is Account, Workers Scripts, Edit. Scope it to my account only.
2. Under the repo's Settings, Secrets and variables, Actions, add two repository secrets: `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (shown on the Workers & Pages overview page).
3. Push to `main` (or re-run the latest workflow). The site goes live at `amirassyl-dev.<subdomain>.workers.dev`.

Redirect and headers: `worker/index.ts` is a tiny Worker that 301s `www.amirassyl.dev` to the apex (same path and query) and hands every other request to the static assets, which is why `run_worker_first` is on in `wrangler.jsonc`. `public/_headers` sets the security headers, the CSP and the cache rules. The CSP allows the résumé print button's inline `onclick` by hash and inline styles, so if I change that markup or the handler, the hash in `_headers` has to change too.

Custom domain: amirassyl.dev is registered at Name.com and uses Cloudflare nameservers. The `routes` entries in `wrangler.jsonc` attach the apex and `www` to the Worker on each deploy. If a deploy complains about permissions, add "Zone, Workers Routes, Edit" to the API token.
