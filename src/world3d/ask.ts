// Sends a prompt to Pixel Amir (/api/world) and yields what comes back: pieces
// of his reply and tool calls, each validated again here before it touches the
// world. When the Worker can't answer (no key, rate limited, offline, or plain
// `astro dev` with no Worker at all), the keyword parser answers instead.
import { parseIntent, replyForCalls } from '../world/intent';
import { parseToolCall, type ToolCall, type WorldState } from '../world/schema';

export type Turn = { role: 'user' | 'model'; text: string };
export type AskEvent = { type: 'text'; text: string } | { type: 'tool'; call: ToolCall };

const TIMEOUT = 20000;
const SLOW_DOWN = "Slow down a bit😭 I'll do this one the simple way";

export async function* ask(turns: Turn[], world: WorldState): AsyncGenerator<AskEvent> {
  const prompt = turns.at(-1)?.text ?? '';
  let response: Response | null = null;
  try {
    response = await fetch('/api/world', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: turns, world }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    response = null;
  }

  let any = false;
  const calls: ToolCall[] = [];
  let said = false;
  if (response?.ok && response.body && response.headers.get('Content-Type')?.includes('ndjson')) {
    try {
      for await (const event of lines(response.body)) {
        if (event.type === 'text' && typeof event.text === 'string') {
          any = said = true;
          yield { type: 'text', text: event.text };
        } else if (event.type === 'tool') {
          const call = parseToolCall(event.name, event.args);
          if (call) {
            any = true;
            calls.push(call);
            yield { type: 'tool', call };
          }
        }
      }
    } catch {
      // The stream broke off part-way: keep what arrived.
    }
  }
  if (any) {
    if (!said) yield { type: 'text', text: replyForCalls(calls) };
    return;
  }

  // The fallback: same tools, canned reply. A short pause first, so the casting pose shows.
  const intent = parseIntent(prompt, world);
  await wait(500);
  for (const call of intent.calls) {
    yield { type: 'tool', call };
    await wait(160);
  }
  yield { type: 'text', text: response?.status === 429 && intent.calls.length ? SLOW_DOWN : intent.reply };
}

async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.pipeThrough(new TextDecoderStream() as TransformStream<Uint8Array, string>).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const parts = buffer.split('\n');
    buffer = done ? '' : (parts.pop() ?? '');
    for (const part of parts) {
      if (!part.trim()) continue;
      try {
        yield JSON.parse(part);
      } catch {
        // skip a malformed line
      }
    }
    if (done) return;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
