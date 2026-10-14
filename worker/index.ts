// Redirects www to the apex, answers Pixel Amir's chat at /api/chat, and serves
// everything else from static assets.
import { handleChat, type ChatEnv } from './chat';

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

    return env.ASSETS.fetch(request);
  },
};
