// POST /api/chat: Pixel Amir's replies, streamed as plain text.
//
// The browser sends the last few messages; this sends them to Gemini with Pixel
// Amir's system prompt and passes the reply back piece by piece, so the bubble
// can type it out as it arrives. The API key stays here, never in the browser.
import { systemPrompt } from './twin-prompt';

export interface ChatEnv {
  ASSETS: { fetch(request: Request | string): Promise<Response> };
  GEMINI_API_KEY?: string;
  CHAT_VISITOR_LIMIT?: RateLimiter;
  CHAT_SITE_LIMIT?: RateLimiter;
}

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

type Turn = { role: 'user' | 'model'; text: string };

const MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;
const MAX_TURNS = 10; // only the end of a long chat is sent, which keeps each request small
const MAX_CHARS = 500; // per message, same as the input's maxlength

// Replies the bubble shows when Gemini can't answer. The browser picks one by status code.
const SLOW_DOWN = 429; // this visitor is sending too fast
const NO_REPLY = 502; // Gemini answered with nothing, twice
const SLEEPING = 503; // the site-wide limit or Gemini's free daily quota ran out
const ATTEMPTS = 2; // Gemini sometimes ends with no text (finishReason MALFORMED_RESPONSE); one retry fixes it

export async function handleChat(request: Request, env: ChatEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });

  // Only the site's own pages may call this.
  const origin = request.headers.get('Origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) return new Response(null, { status: 403 });

  if (!env.GEMINI_API_KEY) return new Response(null, { status: SLEEPING });

  const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (env.CHAT_VISITOR_LIMIT && !(await env.CHAT_VISITOR_LIMIT.limit({ key: visitor })).success) {
    return new Response(null, { status: SLOW_DOWN });
  }
  if (env.CHAT_SITE_LIMIT && !(await env.CHAT_SITE_LIMIT.limit({ key: 'all' })).success) {
    return new Response(null, { status: SLEEPING });
  }

  const turns = readTurns(await request.json().catch(() => null));
  if (!turns) return new Response(null, { status: 400 });

  const facts = await env.ASSETS.fetch(new URL('/twin/facts.txt', request.url).toString()).then((r) => r.text());

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt(facts) }] },
    contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'minimal' } },
  });

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const upstream = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body,
    });
    if (!upstream.ok || !upstream.body) {
      // Out of quota or Gemini is down: retrying won't help.
      console.error('gemini error', upstream.status, await upstream.text().catch(() => ''));
      return new Response(null, { status: SLEEPING });
    }
    const reply = await startedReply(upstream.body.pipeThrough(new TextDecoderStream()).pipeThrough(sseToText()));
    if (reply) {
      return new Response(reply.pipeThrough(new TextEncoderStream()), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  }
  return new Response(null, { status: NO_REPLY });
}

// Wait for the first piece of text before answering the browser, so an empty
// reply can still be retried. Returns null if the reply ended without any text.
async function startedReply(text: ReadableStream<string>): Promise<ReadableStream<string> | null> {
  const reader = text.getReader();
  const first = await reader.read();
  if (first.done) return null;
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(first.value);
    },
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

// Accept only a short, well-formed history that ends with the visitor's message.
function readTurns(body: unknown): Turn[] | null {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const turns: Turn[] = [];
  for (const message of messages.slice(-MAX_TURNS)) {
    const { role, text } = (message ?? {}) as Partial<Turn>;
    if ((role !== 'user' && role !== 'model') || typeof text !== 'string' || !text.trim()) return null;
    turns.push({ role, text: text.slice(0, MAX_CHARS) });
  }
  // Gemini wants the conversation to start with the visitor, and the last word must be theirs.
  while (turns[0]?.role === 'model') turns.shift();
  return turns.at(-1)?.role === 'user' ? turns : null;
}

// Gemini streams server-sent events ("data: {json}" lines). Keep only the reply text.
function sseToText(): TransformStream<string, string> {
  let buffer = '';
  let sent = 0;
  let finishReason = '';
  let blockReason = '';
  const emit = (line: string, controller: TransformStreamDefaultController<string>) => {
    if (!line.startsWith('data:')) return;
    try {
      const chunk = JSON.parse(line.slice(5));
      const candidate = chunk.candidates?.[0];
      finishReason = candidate?.finishReason ?? finishReason;
      blockReason = chunk.promptFeedback?.blockReason ?? blockReason;
      for (const part of candidate?.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.text && !part.thought) {
          controller.enqueue(part.text);
          sent += part.text.length;
        }
      }
    } catch {
      // A malformed event is skipped rather than ending the reply.
    }
  };
  return new TransformStream({
    transform(text, controller) {
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) emit(line.trim(), controller);
    },
    flush(controller) {
      emit(buffer.trim(), controller);
      // An empty reply means Gemini stopped early; the log says why (safety, token limit, ...).
      if (!sent) console.warn('empty reply', { finishReason, blockReason });
    },
  });
}
