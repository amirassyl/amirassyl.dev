// Redirects www to the apex; everything else is served from static assets.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const APEX = 'amirassyl.dev';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      url.protocol = 'https:';
      url.hostname = APEX;
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};
