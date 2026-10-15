// POST /api/world: Pixel Amir in the 3D world. He replies and changes the world.
//
// The browser sends the last few messages and the current world state. Gemini
// gets Pixel Amir's usual system prompt, a note about the world, and the world
// tools (src/world/tools.ts) as function declarations. The answer streams back
// as NDJSON, one event per line:
//   {"type":"text","text":"Grass time!!"}
//   {"type":"tool","name":"setGround","args":{"preset":"grass"}}
// Every tool call is validated and clamped here before it is sent on, and the
// browser validates it again before applying it. Same limits, status codes and
// model as /api/chat; when this can't answer, the browser falls back to its own
// keyword parser, so the world keeps working.
import { systemPrompt } from './twin-prompt';
import { ATTEMPTS, MODEL, NO_REPLY, readTurns, SLEEPING, SLOW_DOWN, type ChatEnv, type Turn } from './chat';
import { parseToolCall, parseWorld, type ToolCall, type WorldState } from '../src/world/schema';
import { functionDeclarations, worldPrompt } from '../src/world/tools';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;
const MAX_TOOL_CALLS = 8; // per reply; more than this is the model looping

export type WorldEvent = { type: 'text'; text: string } | ({ type: 'tool' } & ToolCall);

/** Accept a short history that ends with the visitor's message, plus a valid world state. */
export function readWorldRequest(body: unknown): { turns: Turn[]; world: WorldState } | null {
  const turns = readTurns(body);
  const world = parseWorld((body as { world?: unknown } | null)?.world);
  return turns && world ? { turns, world } : null;
}

export async function handleWorld(request: Request, env: ChatEnv): Promise<Response> {
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

  const input = readWorldRequest(await request.json().catch(() => null));
  if (!input) return new Response(null, { status: 400 });

  const facts = await env.ASSETS.fetch(new URL('/twin/facts.txt', request.url).toString()).then((r) => r.text());

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt(facts) + worldPrompt(input.world) }] },
    contents: input.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    tools: [{ functionDeclarations }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'minimal' } },
  });

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const upstream = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body,
    });
    if (!upstream.ok || !upstream.body) {
      console.error('gemini error', upstream.status, await upstream.text().catch(() => ''));
      return new Response(null, { status: SLEEPING });
    }
    const events = await started(upstream.body.pipeThrough(new TextDecoderStream()).pipeThrough(sseToEvents()));
    if (events) {
      return new Response(events.pipeThrough(new TextEncoderStream()), {
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  }
  return new Response(null, { status: NO_REPLY });
}

// Wait for the first event before answering the browser, so an empty reply can
// still be retried. Returns null if the reply ended without any event.
async function started(lines: ReadableStream<string>): Promise<ReadableStream<string> | null> {
  const reader = lines.getReader();
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

// Gemini streams server-sent events ("data: {json}" lines). Turn each text part
// and each valid function call into one NDJSON line.
export function sseToEvents(): TransformStream<string, string> {
  let buffer = '';
  let tools = 0;
  const send = (event: WorldEvent, controller: TransformStreamDefaultController<string>) => controller.enqueue(`${JSON.stringify(event)}\n`);
  const emit = (line: string, controller: TransformStreamDefaultController<string>) => {
    if (!line.startsWith('data:')) return;
    try {
      const chunk = JSON.parse(line.slice(5));
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.text && !part.thought) send({ type: 'text', text: part.text }, controller);
        if (part.functionCall && tools < MAX_TOOL_CALLS) {
          const call = parseToolCall(part.functionCall.name, part.functionCall.args);
          if (call) {
            tools++;
            send({ type: 'tool', ...call }, controller);
          } else {
            console.warn('dropped tool call', part.functionCall.name);
          }
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
    },
  });
}
