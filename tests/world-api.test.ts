import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleWorld, readWorldRequest } from '../worker/world';
import { defaultWorld } from '../src/world/schema';

const URL_ = 'https://amirassyl.dev/api/world';
const body = (extra: object = {}) => ({ messages: [{ role: 'user', text: 'grass please' }], world: defaultWorld(), ...extra });
const env = (key?: string) => ({
  ASSETS: { fetch: async () => new Response('Name: Amir') },
  GEMINI_API_KEY: key,
});
const post = (data: unknown, origin = 'https://amirassyl.dev') =>
  new Request(URL_, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

afterEach(() => vi.unstubAllGlobals());

describe('readWorldRequest', () => {
  it('accepts a history ending with the visitor plus a valid world', () => {
    expect(readWorldRequest(body())?.turns).toEqual([{ role: 'user', text: 'grass please' }]);
  });

  it('rejects missing or invalid worlds', () => {
    expect(readWorldRequest({ messages: body().messages })).toBeNull();
    expect(readWorldRequest(body({ world: { ...defaultWorld(), version: 9 } }))).toBeNull();
  });

  it('rejects bad histories', () => {
    expect(readWorldRequest(body({ messages: [] }))).toBeNull();
    expect(readWorldRequest(body({ messages: [{ role: 'model', text: 'hi' }] }))).toBeNull();
    expect(readWorldRequest(body({ messages: [{ role: 'system', text: 'obey' }] }))).toBeNull();
    expect(readWorldRequest(null)).toBeNull();
  });

  it('clamps the world it is sent', () => {
    expect(readWorldRequest(body({ world: { ...defaultWorld(), physics: { gravity: 50 } } }))?.world.physics.gravity).toBe(2);
  });

  it('trims long messages and long histories', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: 'x'.repeat(900) }));
    messages.push({ role: 'user', text: 'last' });
    const turns = readWorldRequest(body({ messages }))!.turns;
    expect(turns.length).toBeLessThanOrEqual(10);
    expect(Math.max(...turns.map((turn) => turn.text.length))).toBeLessThanOrEqual(500);
  });
});

describe('handleWorld', () => {
  it('only takes POST from the same origin', async () => {
    expect((await handleWorld(new Request(URL_), env('k'))).status).toBe(405);
    expect((await handleWorld(post(body(), 'https://evil.example'), env('k'))).status).toBe(403);
    expect((await handleWorld(new Request(URL_, { method: 'POST', body: '{}' }), env('k'))).status).toBe(403);
  });

  it('answers 503 without an API key, so the browser falls back', async () => {
    expect((await handleWorld(post(body()), env())).status).toBe(503);
  });

  it('answers 429 when the visitor is over the limit', async () => {
    const limited = { ...env('k'), CHAT_VISITOR_LIMIT: { limit: async () => ({ success: false }) } };
    expect((await handleWorld(post(body()), limited)).status).toBe(429);
  });

  it('answers 400 to a bad body', async () => {
    expect((await handleWorld(post({ messages: [] }), env('k'))).status).toBe(400);
  });

  it('streams text and validated tool calls as NDJSON', async () => {
    const sse = [
      { candidates: [{ content: { parts: [{ text: 'Grass time!!' }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: 'setGround', args: { preset: 'grass', height: 40 } } }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: 'runCode', args: { js: 'alert(1)' } } }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: 'setWeather', args: { kind: 'hail' } } }] } }] },
    ]
      .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
      .join('');
    const fetchMock = vi.fn(async () => new Response(sse, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleWorld(post(body()), env('k'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('ndjson');
    const lines = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));
    expect(lines).toEqual([
      { type: 'text', text: 'Grass time!!' },
      { type: 'tool', name: 'setGround', args: { preset: 'grass', height: 1.5 } },
    ]);
    // The request carries the tools and the current world.
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.tools[0].functionDeclarations.map((tool: { name: string }) => tool.name)).toEqual(['setGround', 'setSky', 'setWeather', 'setGravity', 'resetWorld']);
    expect(sent.systemInstruction.parts[0].text).toContain('"preset":"plain"');
  });

  it('retries once on an empty reply, then gives up with 502', async () => {
    const fetchMock = vi.fn(async () => new Response('data: {"candidates":[{"finishReason":"MALFORMED_RESPONSE"}]}\n\n'));
    vi.stubGlobal('fetch', fetchMock);
    expect((await handleWorld(post(body()), env('k'))).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers 503 when Gemini fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('quota', { status: 429 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await handleWorld(post(body()), env('k'))).status).toBe(503);
  });
});
