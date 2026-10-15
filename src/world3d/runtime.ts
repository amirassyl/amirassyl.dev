// State that changes every frame and is shared between the scene, the
// controls and the chat, kept out of React so it never causes a re-render.
import { Vector3 } from 'three';

export const runtime = {

  /** Where Amir's feet are. */
  player: new Vector3(),
  /** Horizontal speed, for the walk cycle. */
  speed: 0,
  /** Camera angle around Amir (radians) and how far above him it looks down from. */
  yaw: 0,
  pitch: 0.17,
  /** Movement input from the keyboard or the joystick, x = right, y = forward, each -1..1. */
  stick: { x: 0, y: 0 },
  keys: new Set<string>(),
  jump: false,
  /** True while Pixel Amir is thinking about a prompt: he raises his arms and sparkles gather. */
  casting: false,
  /** How tall the rolling hills are right now, 0 (flat page) to 1 (steppe). Eased by the scene. */
  hills: 0,
  /** Which animation Amir is playing, for anything that reacts to him. */
  moving: false,
  /** 0.35..1, lowered when the frame rate drops. */
  quality: 1,
};

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Keyboard input, ignored while the visitor is typing in the chat. */
export function listenToKeys(): () => void {
  const typing = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    return !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  };
  const down = (event: KeyboardEvent) => {
    if (typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code in MOVE_KEYS || event.code === 'Space') {
      // Arrows and space would scroll the page; nothing here scrolls.
      if (event.target === document.body || (event.target as HTMLElement)?.closest?.('.world-canvas')) event.preventDefault();
    }
    if (event.code === 'Space') runtime.jump = true;
    runtime.keys.add(event.code);
  };
  const up = (event: KeyboardEvent) => runtime.keys.delete(event.code);
  const clear = () => runtime.keys.clear();
  addEventListener('keydown', down);
  addEventListener('keyup', up);
  addEventListener('blur', clear);
  return () => {
    removeEventListener('keydown', down);
    removeEventListener('keyup', up);
    removeEventListener('blur', clear);
  };
}

/** The combined movement input, -1..1 on each axis. */
export function moveInput(): { x: number; y: number; run: boolean } {
  let x = runtime.stick.x;
  let y = runtime.stick.y;
  for (const code of runtime.keys) {
    const move = MOVE_KEYS[code];
    if (move) {
      x += move[0];
      y += move[1];
    }
  }
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return { x, y, run: runtime.keys.has('ShiftLeft') || runtime.keys.has('ShiftRight') };
}
