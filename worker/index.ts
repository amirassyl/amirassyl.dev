// Redirects www to the apex, answers Pixel Amir's chat at /api/chat and his 3D
// world at /api/world, and serves everything else from static assets.
import { handleChat, type ChatEnv } from './chat';
import { handleWorld } from './world';

type Env = ChatEnv;

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

    if (url.pathname === '/api/chat') return handleChat(request, env);
    if (url.pathname === '/api/world') return handleWorld(request, env);

    const response = await env.ASSETS.fetch(request);
    // The 3D world's physics engine is WebAssembly, which the site-wide CSP blocks.
    // Only that page gets 'wasm-unsafe-eval'; every other page keeps the strict policy.
    if (url.pathname === '/3d/') return allowWasm(response);
    return response;
  },
};

export function allowWasm(response: Response): Response {
  const csp = response.headers.get('Content-Security-Policy');
  if (!csp) return response;
  const copy = new Response(response.body, response);
  copy.headers.set('Content-Security-Policy', csp.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'"));
  return copy;
}
