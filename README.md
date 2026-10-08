# amirassyl.dev

Source for my personal site: projects, résumé, and writing.

Built with [Astro](https://astro.build), deployed on Cloudflare Workers.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build
npm run check
```

Content lives in `src/data/site.ts` and `src/content/`.

## Deploying

CI (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`: `npm ci`, `npm run check`, `npm run build`. On pushes to `main`, once those pass, a second job runs `npx wrangler deploy`. If the Cloudflare secrets below aren't set, that job logs a notice and skips its steps, so the run stays green. Node comes from `.nvmrc`.

To turn deploys on:

1. Create an API token in the Cloudflare dashboard (My Profile or Manage Account, then API Tokens, Create Token) using the "Edit Cloudflare Workers" template. The permission that matters is Account, Workers Scripts, Edit. Scope it to my account only.
2. Under the repo's Settings, Secrets and variables, Actions, add two repository secrets: `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (shown on the Workers & Pages overview page).
3. Push to `main` (or re-run the latest workflow). The site goes live at `amirassyl-dev.<subdomain>.workers.dev`.

Redirect and headers: `worker/index.ts` is a tiny Worker that 301s `www.amirassyl.dev` to the apex (same path and query) and hands every other request to the static assets, which is why `run_worker_first` is on in `wrangler.jsonc`. `public/_headers` sets the security headers, the CSP and the cache rules. The CSP allows the résumé print button's inline `onclick` by hash and inline styles, so if I change that markup or the handler, the hash in `_headers` has to change too.

Custom domain: amirassyl.dev is registered at Name.com and uses Cloudflare nameservers. The `routes` entries in `wrangler.jsonc` attach the apex and `www` to the Worker on each deploy. If a deploy complains about permissions, add "Zone, Workers Routes, Edit" to the API token.
