// The floor. In the empty world it is the page's own colour with a faint dot
// grid that fades out around Amir, like the 2D site. Every other preset is
// painted in by a ring that grows outward from where Amir stands (the same
// idea as the ripple on his name).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ShaderMaterial, Vector2, Vector3, type Mesh } from 'three';
import { NOISE } from './glsl';
import { TERRAIN } from './terrain';
import { runtime } from './runtime';
import { GROUND_KIND, type Look } from './look';
import type { GroundPreset } from '../world/schema';

/** The change of ground that is under way: `to` covers everything within `radius` of `center`. */
export interface Ring {
  from: GroundPreset;
  to: GroundPreset;
  center: Vector2;
  radius: number;
}
export const RING_DONE = 160;

const vertex = /* glsl */ `
varying vec3 vWorld;
${TERRAIN}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += terrainHeight(world.xz);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
uniform float uKindA;
uniform float uKindB;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec2 uCenter;
uniform float uRadius;
uniform vec3 uDot;
uniform vec3 uBg;
uniform vec3 uFog;
uniform vec3 uLight;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform vec2 uPlayer;
uniform float uPainted;
uniform float uTime;
uniform float uFogFar;
varying vec3 vWorld;
${NOISE}
vec3 layer(float kind, vec3 base, vec2 p, float dist) {
  if (kind < 0.5) {
    // Plain: a faint dot grid, strongest around Amir and gone by 18 m.
    vec2 g = fract(p / 0.7 + 0.5) - 0.5;
    float r = length(g) * 0.7;
    float w = fwidth(r);
    float dot = 1.0 - smoothstep(0.022 - w, 0.022 + w, r);
    float fade = 0.75 * (1.0 - smoothstep(2.0, 13.0, length(p - uPlayer)));
    return mix(base, uDot, dot * fade);
  }
  if (kind < 2.5) {
    // Under the grass: the field as seen from far away, with soft lighter and darker drifts.
    float n = fbm(p * 0.06 + vec2(0.0, uTime * 0.01));
    float streak = fbm(vec2(p.x * 0.05, p.y * 0.18));
    return base * (0.8 + 0.3 * n + 0.15 * streak);
  }
  if (kind < 3.5) {
    // Sand with wind ripples.
    float ripple = sin(p.x * 2.6 + fbm(p * 0.3) * 6.0 + p.y * 0.8);
    return base * (0.93 + 0.07 * smoothstep(0.6, 1.0, ripple)) * (0.94 + 0.12 * fbm(p * 0.07));
  }
  if (kind < 4.5) {
    // Snow: soft blue hollows and a few glints.
    float n = fbm(p * 0.25);
    vec3 col = mix(base, base * vec3(0.82, 0.88, 1.0), smoothstep(0.45, 0.75, n));
    float glint = step(0.996, hash12(floor(p * 18.0))) * (0.5 + 0.5 * sin(uTime * 3.0 + p.x * 9.0));
    return col + glint * 0.5;
  }
  // Water: two flat tones of wave and a light band of foam where they meet.
  vec2 flow = vec2(uTime * 0.25, uTime * 0.12);
  float n = fbm(p * 0.35 + flow) + 0.5 * fbm(p * 0.9 - flow * 1.4);
  float band = smoothstep(0.62, 0.66, n);
  vec3 col = mix(base * 0.85, base * 1.18, band);
  col = mix(col, vec3(0.92, 0.97, 1.0), smoothstep(0.735, 0.75, n) * (1.0 - smoothstep(0.75, 0.78, n)));
  // Glitter on the path of the sun.
  vec3 view = normalize(cameraPosition - vWorld);
  vec3 refl = reflect(-view, vec3(0.0, 1.0, 0.0));
  float sun = pow(max(dot(refl, normalize(uSunDir)), 0.0), 60.0);
  col += uSun * step(0.6, sun * (0.5 + n)) * 0.6;
  return col;
}
void main() {
  vec2 p = vWorld.xz;
  float dist = length(p - uCenter);
  vec3 a = layer(uKindA, uColA, p, dist);
  vec3 b = layer(uKindB, uColB, p, dist);
  float inside = 1.0 - smoothstep(uRadius - 0.6, uRadius, dist);
  vec3 col = mix(a, b, inside);
  // A soft bright rim on the growing edge.
  col += 0.18 * (smoothstep(uRadius - 1.2, uRadius - 0.3, dist) - smoothstep(uRadius - 0.3, uRadius, dist)) * step(uRadius, 150.0);
  // Light: the empty world keeps the page's exact colour.
  col *= mix(vec3(1.0), uLight, uPainted);
  // Amir's soft round shadow.
  float shadow = smoothstep(0.55, 0.0, length(p - uPlayer));
  col *= 1.0 - 0.22 * shadow;
  float fog = smoothstep(uFogFar * 0.12, uFogFar, length(cameraPosition.xz - p));
  col = mix(col, mix(uBg, uFog, uPainted), fog);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const SOIL = { plain: '#ffffff', grass: '#3d7426', flowers: '#4a8030', sand: '#ead197', snow: '#f3f6fb', water: '#2f86b5' } satisfies Record<GroundPreset, string>;
const scratch = new Color();

export function groundColour(preset: GroundPreset, look: Look, out: Color): Color {
  if (preset === 'plain') return out.copy(look.bg);
  out.set(SOIL[preset]);
  // Under grass the soil takes on the blades' own colour, so custom colours match.
  if (preset === 'grass' || preset === 'flowers') out.lerp(scratch.copy(look.grassBase).lerp(look.grassTip, 0.62), 0.9).multiplyScalar(0.95);
  return out;
}

export function Ground({ look, ring }: { look: Look; ring: Ring }) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uKindA: { value: 0 },
          uKindB: { value: 0 },
          uColA: { value: new Color() },
          uColB: { value: new Color() },
          uCenter: { value: new Vector2() },
          uRadius: { value: RING_DONE },
          uDot: { value: new Color() },
          uBg: { value: new Color() },
          uFog: { value: new Color() },
          uLight: { value: new Color() },
          uSun: { value: new Color() },
          uSunDir: { value: new Vector3() },
          uPlayer: { value: new Vector2() },
          uPainted: { value: 0 },
          uTime: { value: 0 },
          uFogFar: { value: 120 },
          uHills: { value: 0 },
        },
      }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const u = material.uniforms;
    u.uKindA.value = GROUND_KIND[ring.from];
    u.uKindB.value = GROUND_KIND[ring.to];
    groundColour(ring.from, look, u.uColA.value);
    groundColour(ring.to, look, u.uColB.value);
    u.uCenter.value.copy(ring.center);
    u.uRadius.value = ring.radius;
    u.uDot.value.copy(look.dot);
    u.uBg.value.copy(look.bg);
    u.uFog.value.copy(look.fog);
    lightColour(look, u.uLight.value);
    u.uSun.value.copy(look.sun);
    u.uSunDir.value.copy(look.sunDir);
    u.uPainted.value = look.painted;
    u.uTime.value = clock.elapsedTime;
    u.uFogFar.value = fogFar(look);
    u.uHills.value = runtime.hills;
    // The floor moves with the camera in whole metres, so its pattern stays put in the world.
    if (mesh.current) mesh.current.position.set(Math.round(camera.position.x / 2) * 2, 0, Math.round(camera.position.z / 2) * 2);
  });

  return (
    <mesh ref={mesh} material={material} rotation-x={-Math.PI / 2} frustumCulled={false}>
      <planeGeometry args={[480, 480, 240, 240]} />
    </mesh>
  );
}

/** How bright and what colour light falls on flat ground. */
export function lightColour(look: Look, out: Color): Color {
  out.copy(look.ambient).multiplyScalar(look.ambientIntensity * 0.62);
  scratch.copy(look.sun).multiplyScalar(look.sunIntensity * 0.24 * Math.max(look.sunDir.y, 0.15));
  return out.add(scratch);
}

/** The distance at which everything has melted into the fog. */
export const fogFar = (look: Look) => 60 + 70 * look.painted;
