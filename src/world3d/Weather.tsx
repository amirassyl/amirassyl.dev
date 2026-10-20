// What falls or floats through the air: rain, snow, fireflies, petals or
// dandelion fluff. One set of points, all moved on the GPU from a seed and the
// time, and wrapped in a box that travels with the camera. Changing kind fades
// the old one out before the new one fades in.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending, Points, ShaderMaterial, Vector2, Vector3 } from 'three';
import type { WeatherKind } from '../world/schema';
import type { Look } from './look';

const KIND: Record<WeatherKind, number> = { none: 0, rain: 1, snow: 2, fireflies: 3, petals: 4, dandelion: 5 };
const BOX = new Vector3(36, 18, 36);

const vertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uKind;
uniform vec3 uBox;
uniform vec3 uCenter;
uniform vec2 uWind;
uniform float uWindAmp;
uniform float uPixel;
uniform float uSpeed;
varying float vSeed;
varying float vGlow;
varying float vSpin;
void main() {
  float t = uTime * uSpeed;
  vec3 p = aSeed.xyz * uBox;
  float size = 1.0;
  vGlow = 1.0;
  vSpin = 0.0;
  vSeed = aSeed.w;
  vec3 drift = vec3(uWind.x, 0.0, uWind.y) * uWindAmp;
  if (uKind < 1.5) {
    p.y -= t * (13.0 + aSeed.w * 4.0);
    p += drift * t * 1.5;
    size = 1.6;
  } else if (uKind < 2.5) {
    p.y -= t * (0.9 + aSeed.w * 0.6);
    p.x += sin(t * 0.8 + aSeed.w * 20.0) * 0.6;
    p += drift * t * 1.2;
    size = 0.8 + aSeed.w * 0.8;
  } else if (uKind < 3.5) {
    // Fireflies hover near the grass, wander and blink.
    p.y = 0.25 + aSeed.y * 2.6 + sin(t * 0.7 + aSeed.w * 30.0) * 0.35;
    p.x += sin(t * 0.31 + aSeed.w * 12.0) * 1.6;
    p.z += cos(t * 0.27 + aSeed.w * 17.0) * 1.6;
    vGlow = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * (1.2 + aSeed.w) + aSeed.w * 50.0), 3.0);
    size = 2.6;
  } else if (uKind < 4.5) {
    p.y -= t * (0.7 + aSeed.w * 0.4);
    p += drift * t * 3.0 + vec3(sin(t + aSeed.w * 9.0), 0.0, cos(t * 0.7 + aSeed.w * 5.0)) * 0.8;
    vSpin = t * (1.5 + aSeed.w * 2.0) + aSeed.w * 6.28;
    size = 1.0;
  } else {
    // Dandelion fluff rises slowly and rides the wind.
    p.y += t * (0.25 + aSeed.w * 0.25) + sin(t + aSeed.w * 20.0) * 0.3;
    p += drift * t * 4.0;
    size = 0.9;
  }
  // Wrap into the box around the camera, so there is always weather in view.
  vec3 low = uCenter - uBox * 0.5;
  p = low + mod(p - low, uBox);
  if (uKind > 2.5 && uKind < 3.5) p.y = 0.25 + aSeed.y * 2.6 + sin(t * 0.7 + aSeed.w * 30.0) * 0.35;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uPixel / max(-mv.z, 0.5);
}
`;

const fragment = /* glsl */ `
uniform float uKind;
uniform float uAlpha;
uniform vec3 uTint;
varying float vSeed;
varying float vGlow;
varying float vSpin;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a;
  vec3 col = uTint;
  if (uKind < 1.5) {
    a = (1.0 - smoothstep(0.02, 0.06, abs(c.x))) * (1.0 - smoothstep(0.3, 0.5, abs(c.y))) * 0.55;
  } else if (uKind < 2.5) {
    a = 1.0 - smoothstep(0.25, 0.5, length(c));
  } else if (uKind < 3.5) {
    float r = length(c);
    a = (exp(-r * r * 60.0) * 1.6 + 0.6 * exp(-r * r * 12.0)) * vGlow;
    col = mix(vec3(1.0, 0.95, 0.55), vec3(0.75, 1.0, 0.45), vSeed);
  } else if (uKind < 4.5) {
    float s = sin(vSpin), k = cos(vSpin);
    vec2 q = mat2(k, -s, s, k) * c;
    q.y *= 1.0 + 1.2 * abs(sin(vSpin * 0.7)); // tumbling: seen edge-on, then flat
    a = 1.0 - smoothstep(0.18, 0.24, length(q * vec2(1.0, 1.9)));
    col = mix(vec3(1.0, 0.78, 0.86), vec3(1.0, 0.9, 0.94), vSeed);
  } else {
    float r = length(c);
    float rays = 0.5 + 0.5 * cos(atan(c.y, c.x) * 8.0);
    a = (1.0 - smoothstep(0.05, 0.08, r)) + (1.0 - smoothstep(0.15, 0.45, r)) * rays * 0.55;
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a * uAlpha);
  #include <colorspace_fragment>
}
`;

export function Weather({ kind, intensity, look, mobile, reducedMotion }: { kind: WeatherKind; intensity: number; look: Look; mobile: boolean; reducedMotion: boolean }) {
  const max = mobile ? 1600 : 4200;
  const shown = useRef({ kind: 'none' as WeatherKind, amount: 0 });

  const points = useMemo(() => {
    const geometry = new BufferGeometry();
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(max * 3), 3));
    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uKind: { value: 0 },
        uBox: { value: BOX },
        uCenter: { value: new Vector3() },
        uWind: { value: new Vector2(1, 0) },
        uWindAmp: { value: 0.3 },
        uPixel: { value: 60 },
        uSpeed: { value: 1 },
        uAlpha: { value: 0 },
        uTint: { value: new Color() },
      },
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }, [max]);

  useFrame(({ clock, camera, size, gl }, dt) => {
    const s = shown.current;
    const material = points.material as ShaderMaterial;
    const u = material.uniforms;
    // Fade out whatever is showing before switching to a different kind.
    const target = s.kind === kind ? intensity : 0;
    s.amount += (target - s.amount) * (1 - Math.exp(-dt * 2));
    if (s.kind !== kind && s.amount < 0.02) {
      s.kind = kind;
      s.amount = 0;
    }
    const k = KIND[s.kind];
    points.visible = k > 0 && s.amount > 0.01;
    if (!points.visible) return;
    const count = s.kind === 'fireflies' ? Math.floor(max * 0.16) : s.kind === 'rain' ? max : Math.floor(max * 0.6);
    points.geometry.setDrawRange(0, Math.ceil(count * Math.min(1, s.amount * 1.15)));
    material.blending = s.kind === 'fireflies' ? AdditiveBlending : NormalBlending;
    u.uKind.value = k;
    u.uTime.value = clock.elapsedTime;
    u.uSpeed.value = reducedMotion ? 0.4 : 1;
    u.uCenter.value.set(camera.position.x, camera.position.y + 3, camera.position.z);
    u.uWind.value.set(look.windDir.x, look.windDir.z);
    u.uWindAmp.value = look.amp;
    u.uPixel.value = (size.height * gl.getPixelRatio()) / 18;
    u.uAlpha.value = Math.min(1, s.amount * 1.6);
    u.uTint.value.set(s.kind === 'rain' ? (look.night > 0.5 ? '#8fa6cc' : '#c6d3e2') : '#ffffff');
  });

  return <primitive object={points} />;
}
