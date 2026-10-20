// A nod to Amir's computer-vision side (and to the yak photo in the art
// direction): a thin yellow "detection" box with a confidence label around
// him, and a smaller one around his head. It fades in when he stands still
// and out while he moves. Drawn as plain DOM over the canvas.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { runtime } from './runtime';

const HEIGHT = 1.78;

function rect(el: HTMLElement | null, x0: number, y0: number, x1: number, y1: number, opacity: number) {
  if (!el) return;
  el.style.transform = `translate(${x0}px, ${y0}px)`;
  el.style.width = `${Math.max(0, x1 - x0)}px`;
  el.style.height = `${Math.max(0, y1 - y0)}px`;
  el.style.opacity = String(opacity);
}

export function Detect({ painted }: { painted: number }) {
  const { camera, size } = useThree();
  const body = useRef<HTMLElement | null>(null);
  const head = useRef<HTMLElement | null>(null);
  const shown = useRef(0);
  const still = useRef(0);
  const p = useMemo(() => new Vector3(), []);

  useEffect(() => {
    body.current = document.getElementById('detect-body');
    head.current = document.getElementById('detect-head');
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    still.current = runtime.moving || runtime.casting ? 0 : still.current + dt;
    const want = painted > 0.5 && still.current > 1.2 ? 1 : 0;
    shown.current += (want - shown.current) * (1 - Math.exp(-dt * (want ? 2.5 : 8)));
    const project = (x: number, y: number, z: number) => {
      p.set(x, y, z).project(camera);
      return [(p.x * 0.5 + 0.5) * size.width, (-p.y * 0.5 + 0.5) * size.height] as const;
    };
    const { x, y, z } = runtime.player;
    const [, footY] = project(x, y, z);
    const [cx, topY] = project(x, y + HEIGHT, z);
    const h = footY - topY;
    const w = h * 0.36;
    rect(body.current, cx - w / 2, topY - h * 0.04, cx + w / 2, footY + h * 0.02, shown.current);
    const hh = h * 0.15;
    rect(head.current, cx - hh * 0.55, topY - h * 0.02, cx + hh * 0.55, topY + hh, shown.current * 0.9);
  });
  return null;
}
