// Rolling steppe hills. One height function, written twice: in GLSL for the
// ground and the grass, and in TypeScript for Amir's feet, so all three agree.
// `hills` (0..1) scales it: the empty world is flat like a page, and the
// hills rise as soon as a visitor paints the world.
import { runtime } from './runtime';

// Long, low swells plus a gentle mid-scale roll; kept small near the start
// so Amir begins on flat ground.
export const TERRAIN = /* glsl */ `
uniform float uHills;
float terrainHeight(vec2 p) {
  float swell = sin(p.x * 0.031 + 0.8) * cos(p.y * 0.027 - 0.4) * 3.2
              + sin(p.x * 0.067 + p.y * 0.052 + 1.7) * 1.3
              + sin(p.x * 0.13 - p.y * 0.11 + 0.3) * 0.35;
  float nearStart = smoothstep(4.0, 26.0, length(p));
  return swell * nearStart * uHills;
}
`;

export function terrainHeight(x: number, z: number, hills = runtime.hills): number {
  const swell =
    Math.sin(x * 0.031 + 0.8) * Math.cos(z * 0.027 - 0.4) * 3.2 +
    Math.sin(x * 0.067 + z * 0.052 + 1.7) * 1.3 +
    Math.sin(x * 0.13 - z * 0.11 + 0.3) * 0.35;
  const d = Math.hypot(x, z);
  const t = Math.min(1, Math.max(0, (d - 4) / 22));
  const nearStart = t * t * (3 - 2 * t);
  return swell * nearStart * hills;
}
