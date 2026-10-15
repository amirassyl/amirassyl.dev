// The signature: one InstancedMesh of tens of thousands of thick grass blades,
// plus a sprinkle of flowers, swaying in travelling waves of wind.
//
// How it stays cheap: every blade is the same few triangles, and everything
// that moves happens in the vertex shader on the GPU, so the CPU only updates
// a dozen numbers a frame. How it feels endless: each blade's spot is wrapped
// around Amir (mod the patch size), so as he walks, the blades that fall off
// behind him reappear in front, always at the same place in the world.
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { NOISE, WIND } from './glsl';
import type { Look } from './look';
import type { Ring } from './Ground';
import { RING_DONE, fogFar } from './Ground';
import { runtime } from './runtime';

const SEGMENTS = 4;

/** A blade: a strip that narrows to a point, `position.y` running 0 (root) to 1 (tip). */
function bladeGeometry(): BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const half = 0.5 * (1 - t) ** 0.85;
    positions.push(-half, t, 0, half, t, 0);
  }
  positions.push(0, 1, 0);
  const index: number[] = [];
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (SEGMENTS - 1) * 2;
  index.push(last, last + 1, last + 2);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(index);
  return geometry;
}

/** A flower: a thin stem (part 0) with a flat five-petal head (part 1) and a centre (part 2). */
function flowerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const parts: number[] = [];
  const index: number[] = [];
  const quad = (x: number, part: number) => {
    const base = positions.length / 3;
    positions.push(-x, 0, 0, x, 0, 0, -x, 1, 0, x, 1, 0);
    parts.push(part, part, part, part);
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };
  quad(0.012, 0);
  const petals = 20;
  const centre = positions.length / 3;
  positions.push(0, 1, 0);
  parts.push(2);
  for (let i = 0; i <= petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    const r = 0.06 * (0.55 + 0.45 * Math.abs(Math.cos(angle * 2.5)));
    positions.push(Math.cos(angle) * r, 1, Math.sin(angle) * r);
    parts.push(1);
    if (i > 0) index.push(centre, centre + i, centre + i + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aPart', new BufferAttribute(new Float32Array(parts), 1));
  geometry.setIndex(index);
  return geometry;
}

const SHARED = /* glsl */ `
attribute vec2 aOffset;
attribute vec4 aRand;
uniform float uPatch;
uniform vec2 uCenter;
uniform vec2 uReveal;
uniform float uInner;
uniform float uOuter;
uniform float uHeight;
uniform vec2 uPlayer;
varying vec3 vWorld;
varying float vT;
varying float vBand;
varying vec4 vRand;
${NOISE}
${WIND}
// Where this instance stands in the world, and how much of it is grown (0..1).
vec3 place() {
  vec2 rel = mod(aOffset - uCenter + 0.5 * uPatch, uPatch) - 0.5 * uPatch;
  vec2 wp = uCenter + rel;
  float edge = 1.0 - smoothstep(uPatch * 0.36, uPatch * 0.5, length(rel));
  float d = length(wp - uReveal);
  float grow = smoothstep(uInner, uInner + 1.6, d) * (1.0 - smoothstep(uOuter - 1.6, uOuter, d));
  return vec3(wp, edge * grow);
}
// Bend a point at height t (0..1, of a plant h tall) standing at wp.
vec3 bendPoint(vec3 local, vec2 wp, float t, float h) {
  vec2 wind = windAt(wp);
  vBand = wind.y;
  // Blades lean a little on their own, and get pushed aside around Amir's feet.
  vec2 lean = (aRand.zw - 0.5) * 0.5;
  vec2 away = wp - uPlayer;
  float push = (1.0 - smoothstep(0.15, 0.9, length(away))) * 1.1;
  vec2 dir = uWindDir * wind.x + lean * 0.35 + normalize(away + 1e-4) * push;
  float amount = clamp(length(dir), 0.0, 1.4);
  dir = amount > 1e-4 ? dir / amount : vec2(0.0);
  float flutter = sin(uTime * 7.0 + aRand.x * 40.0) * 0.03 * uAmp;
  float curve = t * t;
  vec3 p = local;
  p.xz += (dir * amount + flutter) * curve * h;
  p.y *= 1.0 - 0.38 * amount * amount * curve; // keep the blade about the same length as it bends
  return p;
}
`;

const bladeVertex = /* glsl */ `
${SHARED}
uniform float uWidth;
void main() {
  vec3 at = place();
  float h = uHeight * (0.55 + 0.75 * aRand.y) * at.z;
  float t = position.y;
  vT = t;
  vRand = aRand;
  float angle = aRand.x * 6.2832;
  vec2 across = vec2(cos(angle), sin(angle));
  vec3 local = vec3(across.x * position.x * uWidth, t * h, across.y * position.x * uWidth);
  vec3 p = bendPoint(local, at.xy, t, h);
  vec4 world = vec4(at.x + p.x, p.y, at.y + p.z, 1.0);
  vWorld = world.xyz;
  gl_Position = h < 0.01 ? vec4(0.0, 0.0, -2.0, 1.0) : projectionMatrix * viewMatrix * world;
}
`;

const flowerVertex = /* glsl */ `
${SHARED}
attribute float aPart;
varying float vPart;
void main() {
  vec3 at = place();
  float h = uHeight * (0.7 + 0.5 * aRand.y) * at.z;
  float t = position.y;
  vT = t;
  vRand = aRand;
  vPart = aPart;
  float s = at.z * (0.8 + 0.6 * aRand.z);
  vec3 local = vec3(position.x * s, t * h, position.z * s);
  vec3 p = bendPoint(local, at.xy, t, h);
  vec4 world = vec4(at.x + p.x, p.y + aPart * 0.004, at.y + p.z, 1.0);
  vWorld = world.xyz;
  gl_Position = h < 0.01 ? vec4(0.0, 0.0, -2.0, 1.0) : projectionMatrix * viewMatrix * world;
}
`;

const LIGHT = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform vec3 uFog;
uniform float uFogFar;
uniform float uAmp;
varying vec3 vWorld;
varying float vT;
varying float vBand;
varying vec4 vRand;
vec3 finish(vec3 col, float tip) {
  vec3 view = normalize(cameraPosition - vWorld);
  // Two flat tones of light, with a lit band rolling over the field with each gust.
  col *= uLight;
  col += uLight * vBand * tip * 0.22 * clamp(uAmp * 2.0, 0.0, 1.0);
  // Backlit tips glow when looking towards the sun: the soft rim light.
  float back = pow(max(dot(-view, normalize(uSunDir)), 0.0), 3.0);
  col += uSun * back * tip * 0.35;
  float fog = smoothstep(uFogFar * 0.12, uFogFar, length(cameraPosition.xz - vWorld.xz));
  return mix(col, uFog, fog);
}
`;

const bladeFragment = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
${LIGHT}
void main() {
  float shade = 0.82 + 0.36 * vRand.w;
  vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, vT)) * shade;
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.35, vT)); // darker at the roots
  gl_FragColor = vec4(finish(col, vT), 1.0);
  #include <colorspace_fragment>
}
`;

const flowerFragment = /* glsl */ `
uniform vec3 uBase;
varying float vPart;
${LIGHT}
vec3 petal(float r) {
  if (r < 0.25) return vec3(1.0, 0.97, 0.92);
  if (r < 0.5) return vec3(1.0, 0.86, 0.3);
  if (r < 0.75) return vec3(1.0, 0.62, 0.74);
  return vec3(0.62, 0.72, 1.0);
}
void main() {
  vec3 col = vPart < 0.5 ? uBase * 0.9 : vPart < 1.5 ? petal(vRand.w) : vec3(1.0, 0.78, 0.25);
  gl_FragColor = vec4(finish(col, vPart > 0.5 ? 0.6 : vT * 0.5), 1.0);
  #include <colorspace_fragment>
}
`;

function instances(count: number, patch: number, seed: number) {
  let s = seed;
  const random = () => {
    // A small fixed-seed generator, so the field is the same on every visit.
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const offsets = new Float32Array(count * 2);
  const rands = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    offsets[i * 2] = random() * patch;
    offsets[i * 2 + 1] = random() * patch;
    for (let j = 0; j < 4; j++) rands[i * 4 + j] = random();
  }
  return { offsets: new InstancedBufferAttribute(offsets, 2), rands: new InstancedBufferAttribute(rands, 4) };
}

function uniforms(patch: number) {
  return {
    uTime: { value: 0 },
    uWindDir: { value: new Vector2(1, 0) },
    uAmp: { value: 0.3 },
    uK: { value: 0.7 },
    uW: { value: 1 },
    uGust: { value: 0.3 },
    uPatch: { value: patch },
    uCenter: { value: new Vector2() },
    uReveal: { value: new Vector2() },
    uInner: { value: 0 },
    uOuter: { value: 1e5 },
    uHeight: { value: 0.6 },
    uWidth: { value: 0.13 },
    uPlayer: { value: new Vector2() },
    uBase: { value: new Color() },
    uTip: { value: new Color() },
    uLight: { value: new Color() },
    uSun: { value: new Color() },
    uSunDir: { value: new Vector3() },
    uFog: { value: new Color() },
    uFogFar: { value: 150 },
  };
}

export function Grass({ look, ring, light, mobile }: { look: Look; ring: Ring; light: Color; mobile: boolean }) {
  const patch = mobile ? 34 : 50;
  const maxBlades = mobile ? 22000 : 72000;
  const maxFlowers = mobile ? 900 : 2600;

  const { blades, flowers } = useMemo(() => {
    const bladeGeo = bladeGeometry();
    const b = instances(maxBlades, patch, 7);
    bladeGeo.setAttribute('aOffset', b.offsets);
    bladeGeo.setAttribute('aRand', b.rands);
    const bladeMat = new ShaderMaterial({ vertexShader: bladeVertex, fragmentShader: bladeFragment, uniforms: uniforms(patch), side: DoubleSide });
    const blades = new InstancedMesh(bladeGeo, bladeMat, maxBlades);
    blades.frustumCulled = false;

    const flowerGeo = flowerGeometry();
    const f = instances(maxFlowers, patch, 99);
    flowerGeo.setAttribute('aOffset', f.offsets);
    flowerGeo.setAttribute('aRand', f.rands);
    const flowerMat = new ShaderMaterial({ vertexShader: flowerVertex, fragmentShader: flowerFragment, uniforms: uniforms(patch), side: DoubleSide });
    const flowers = new InstancedMesh(flowerGeo, flowerMat, maxFlowers);
    flowers.frustumCulled = false;
    return { blades, flowers };
  }, [maxBlades, maxFlowers, patch]);

  useFrame(({ clock, camera }) => {
    const hasBlades = (preset: string) => preset === 'grass' || preset === 'flowers';
    const before = hasBlades(ring.from);
    const after = hasBlades(ring.to);
    // Growing in: only inside the ring. Clearing away: only outside it.
    const inner = !after && before ? ring.radius : 0;
    const outer = after && !before ? ring.radius : 1e5;
    const shown = (after || (before && ring.radius < RING_DONE)) && look.density > 0.002;
    blades.visible = shown;
    flowers.visible = shown && look.flowerShare > 0.01;
    if (!shown) return;

    blades.count = Math.floor(maxBlades * look.density * runtime.quality);
    flowers.count = Math.floor(maxFlowers * look.density * look.flowerShare * Math.max(runtime.quality, 0.5));
    const k = (Math.PI * 2) / look.wavelength;
    for (const mesh of [blades, flowers]) {
      const u = (mesh.material as ShaderMaterial).uniforms;
      u.uTime.value = clock.elapsedTime;
      u.uWindDir.value.set(look.windDir.x, look.windDir.z);
      u.uAmp.value = look.amp;
      u.uK.value = k;
      u.uW.value = look.speed * k;
      u.uGust.value = look.gust;
      u.uCenter.value.set(camera.position.x * 0.5 + runtime.player.x * 0.5, camera.position.z * 0.5 + runtime.player.z * 0.5);
      u.uReveal.value.copy(ring.center);
      u.uInner.value = inner;
      u.uOuter.value = outer;
      u.uHeight.value = look.height;
      u.uPlayer.value.set(runtime.player.x, runtime.player.z);
      u.uBase.value.copy(look.grassBase);
      u.uTip.value.copy(look.grassTip);
      u.uLight.value.copy(light);
      u.uSun.value.copy(look.sun).multiplyScalar(look.sunIntensity * 0.4);
      u.uSunDir.value.copy(look.sunDir);
      u.uFog.value.copy(look.fog);
      u.uFogFar.value = fogFar(look);
    }
  });

  return (
    <>
      <primitive object={blades} />
      <primitive object={flowers} />
    </>
  );
}
