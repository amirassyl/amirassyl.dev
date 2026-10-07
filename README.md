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
3. Push to `main` (or re-run the latest workflow). The site goes live at `amirassyl-com.<subdomain>.workers.dev`.

Custom domain (amirassyl.dev is registered at Name.com):

1. Add the domain to Cloudflare as a zone and point the registrar's nameservers at Cloudflare.
2. Uncomment the `routes` entry in `wrangler.jsonc` (`{ "pattern": "amirassyl.dev", "custom_domain": true }`). Add `www.amirassyl.dev` as a second entry if I want it.
3. Add "Zone, Workers Routes, Edit" to the API token if the deploy complains about permissions, then push to `main`.

