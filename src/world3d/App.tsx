// Amir's 3D world: the canvas, the chat panel along the bottom, and the touch
// controls. The world state lives here (and in sessionStorage, so a reload
// keeps it); every change goes through applyTool.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { defaultWorld, parseWorld, type ToolCall, type WorldState } from '../world/schema';
import { applyTool } from '../world/reducer';
import { Scene } from './Scene';
import { ask, type Turn } from './ask';
import { listenToKeys, runtime } from './runtime';
import type { Theme } from './look';

const STORAGE_KEY = 'world-state';
const SUGGESTIONS = ['Turn the floor into cinematic grass', 'Make it windy', 'Golden hour', 'Make it rain', 'Night with fireflies', 'Low gravity', 'Reset'];

declare global {
  interface Window {
    sound?: { play(name: string): void; talk(letter: string): void };
  }
}

function loadWorld(): WorldState {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return parseWorld(JSON.parse(saved)) ?? defaultWorld();
  } catch {
    // storage blocked or garbled: start fresh
  }
  return defaultWorld();
}

function useTheme(): Theme {
  const read = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setMatches(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [query]);
  return matches;
}

function useHidden(): boolean {
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  return hidden;
}

export function App() {
  const [world, setWorld] = useState<WorldState>(loadWorld);
  const worldRef = useRef(world);
  const theme = useTheme();
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const touch = useMedia('(pointer: coarse)');
  const hidden = useHidden();
  const mobile = touch || Math.min(screen.width, screen.height) < 700;
  const [dpr, setDpr] = useState(() => Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));

  useEffect(() => listenToKeys(), []);
  useEffect(() => {
    worldRef.current = world;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(world));
    } catch {
      // storage blocked: the world just won't survive a reload
    }
  }, [world]);

  const apply = useCallback((call: ToolCall) => {
    setWorld((current) => applyTool(current, call));
  }, []);

  return (
    <>
      <Canvas
        className="world-canvas"
        flat
        dpr={dpr}
        frameloop={hidden ? 'never' : 'always'}
        camera={{ fov: 50, near: 0.1, far: 1200, position: [0, 2.9, 5.2] }}
        gl={{ antialias: !mobile, powerPreference: 'high-performance' }}
        onCreated={() => document.documentElement.classList.add('world-ready')}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr((value) => Math.max(0.75, value - 0.25));
            runtime.quality = Math.max(0.35, runtime.quality - 0.2);
          }}
          onIncline={() => {
            setDpr((value) => Math.min(devicePixelRatio, mobile ? 1.5 : 1.75, value + 0.25));
            runtime.quality = Math.min(1, runtime.quality + 0.1);
          }}
        />
        <Scene world={world} theme={theme} mobile={mobile} reducedMotion={reducedMotion} />
      </Canvas>
      <CameraDrag />
      {touch && <TouchControls />}
      <Chat world={worldRef} apply={apply} />
    </>
  );
}

/** Dragging on the world turns the camera around Amir. */
function CameraDrag() {
  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>('.world-canvas');
    if (!canvas) return;
    let last: { x: number; y: number; id: number } | null = null;
    const down = (event: PointerEvent) => {
      last = { x: event.clientX, y: event.clientY, id: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!last || event.pointerId !== last.id) return;
      runtime.yaw -= (event.clientX - last.x) * 0.006;
      runtime.pitch = Math.min(1.2, Math.max(0.05, runtime.pitch + (event.clientY - last.y) * 0.004));
      last = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const up = () => (last = null);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, []);
  return null;
}

/** A virtual joystick (bottom left) and a jump button (bottom right) for touch screens. */
function TouchControls() {
  const knob = useRef<HTMLSpanElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const RADIUS = 44;
  const set = (x: number, y: number) => {
    runtime.stick.x = x / RADIUS;
    runtime.stick.y = -y / RADIUS;
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  return (
    <>
      <div
        className="world-stick"
        aria-hidden="true"
        onPointerDown={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          start.current = { x: box.left + box.width / 2, y: box.top + box.height / 2, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const s = start.current;
          if (!s || s.id !== event.pointerId) return;
          let x = event.clientX - s.x;
          let y = event.clientY - s.y;
          const length = Math.hypot(x, y);
          if (length > RADIUS) {
            x *= RADIUS / length;
            y *= RADIUS / length;
          }
          set(x, y);
        }}
        onPointerUp={() => {
          start.current = null;
          set(0, 0);
        }}
        onPointerCancel={() => {
          start.current = null;
          set(0, 0);
        }}
      >
        <span ref={knob} />
      </div>
      <button className="world-jump" type="button" aria-label="Jump" onPointerDown={() => (runtime.jump = true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" />
        </svg>
      </button>
    </>
  );
}

type Message = { role: 'user' | 'model'; text: string };

function Chat({ world, apply }: { world: React.RefObject<WorldState>; apply: (call: ToolCall) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setDraft('');
    setBusy(true);
    runtime.casting = true;
    window.sound?.play('send');
    // Empty replies (a reply that never came) would make the history invalid, so they're left out.
    const history: Turn[] = [...messages.filter((message) => message.text.trim()), { role: 'user' as const, text: prompt }].slice(-10);
    setMessages((current) => [...current, { role: 'user', text: prompt }, { role: 'model', text: '' }]);
    let reply = '';
    try {
      for await (const event of ask(history, world.current)) {
        if (event.type === 'tool') {
          apply(event.call);
        } else {
          reply += event.text;
          const shown = reply;
          setMessages((current) => [...current.slice(0, -1), { role: 'model', text: shown }]);
        }
      }
    } finally {
      runtime.casting = false;
      setBusy(false);
      window.sound?.play('reply');
    }
  };

  const visible = messages.slice(-4);
  return (
    <section className="world-chat" aria-label="Talk to Pixel Amir">
      <div className="world-log" ref={log} aria-live="polite">
        {visible.map((message, i) => (
          <p key={messages.length - visible.length + i} className={`world-msg ${message.role === 'user' ? 'from-you' : 'from-amir'}`}>
            {message.text || (busy ? <span className="world-typing" aria-label="Amir is casting">✦ ✦ ✦</span> : '…')}
          </p>
        ))}
      </div>
      {messages.length === 0 && (
        <div className="world-chips">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => send(suggestion)} disabled={busy}>
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <form
        className="world-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          type="text"
          value={draft}
          maxLength={500}
          placeholder="Ask me to change the world… try “grass”"
          aria-label="Message Pixel Amir"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
          </svg>
        </button>
      </form>
    </section>
  );
}
