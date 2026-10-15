// A painted sky dome: a soft gradient, the sun (or moon) with a glow, big soft
// cumulus clouds lit on the sun side and shaded on the other in two flat
// tones, and stars at night. In the empty starting world it is just the
// page's own colour.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, ShaderMaterial, Vector3, type Mesh } from 'three';
import { NOISE } from './glsl';
import type { Look } from './look';

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}
`;

const fragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uFog;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uBg;
uniform float uClouds;
uniform float uStars;
uniform float uPainted;
uniform float uNight;
uniform float uTime;
varying vec3 vDir;
${NOISE}
float clouds(vec2 uv) {
  // Domain-warped fbm: big rounded heaps rather than streaks.
  vec2 warp = vec2(fbm(uv * 0.5 + 3.1), fbm(uv * 0.5 - 1.7));
  return fbm(uv + warp * 0.9);
}
void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.75, h), 0.75));

  // Sun by day, a smaller cooler moon by night.
  float s = max(dot(dir, normalize(uSunDir)), 0.0);
  float disc = smoothstep(mix(0.9993, 0.9996, uNight), mix(0.9996, 0.99985, uNight), s);
  col += uSun * (disc * 1.6 + pow(s, mix(10.0, 60.0, uNight)) * mix(0.35, 0.18, uNight));

  // Stars: one per sky cell, twinkling.
  vec2 grid = vec2(atan(dir.z, dir.x) * 140.0, h * 220.0);
  vec2 cell = floor(grid);
  vec2 at = vec2(hash12(cell + 3.0), hash12(cell + 9.0)) * 0.6 + 0.2;
  float star = step(0.985, hash12(cell)) * (1.0 - smoothstep(0.06, 0.16, length(fract(grid) - at))) * smoothstep(0.05, 0.4, h);
  col += star * uStars * (0.55 + 0.45 * sin(uTime * 2.0 + hash12(cell + 7.0) * 40.0)) * 0.9;

  // Overcast: a soft, low-contrast deck of cloud on a flat layer above, darker
  // underneath where it is thick, with brighter gaps towards the horizon.
  if (uClouds > 0.001 && h > -0.05) {
    float hh = max(h, 0.0);
    vec2 uv = dir.xz / (hh + 0.16) * 0.34 + vec2(uTime * 0.004, uTime * 0.0015);
    float n = clouds(uv);
    float cover = mix(0.66, 0.30, uClouds);
    float c = smoothstep(cover - 0.10, cover + 0.22, n) * smoothstep(-0.02, 0.05, h);
    float thick = smoothstep(cover, cover + 0.35, clouds(uv * 0.6 + 4.0));
    vec3 cloud = mix(uCloudLit, uCloudShade, 0.25 + 0.55 * thick);
    // Light leaking through thin parts on the sun side.
    cloud += uSun * pow(s, 3.0) * (1.0 - thick) * 0.25;
    col = mix(col, cloud, c * 0.92);
  }
  // A pale band of light just above the horizon.
  col = mix(col, mix(uHorizon, vec3(1.0), 0.25), exp(-max(h, 0.0) * 18.0) * 0.35 * uPainted * (1.0 - uNight * 0.7));

  // Distant hills and mountains in three hazy layers, fading into the air.
  float az = atan(dir.z, dir.x);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float scale = 2.2 + fi * 2.6;
    float ridge = fbm(vec2(az * scale + fi * 11.3, fi * 3.7)) - 0.35;
    float top = -0.03 + (0.075 - fi * 0.018) * max(ridge, 0.0) * 2.2 + 0.008 * (2.0 - fi);
    float haze = mix(0.28, 0.62, fi / 2.0);
    vec3 mcol = mix(uFog, uFog * vec3(0.66, 0.76, 0.78) + uTop * 0.05, haze);
    float edge = 1.0 - smoothstep(top - 0.0015, top + 0.0015, h);
    col = mix(col, mcol, edge * uPainted);
  }

  // Below the horizon the sky melts into the fog.
  col = mix(col, uFog, smoothstep(-0.02, -0.06, h));
  col = mix(uBg, col, uPainted);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function Sky({ look }: { look: Look }) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new Color() },
          uHorizon: { value: new Color() },
          uFog: { value: new Color() },
          uSun: { value: new Color() },
          uSunDir: { value: new Vector3() },
          uCloudLit: { value: new Color() },
          uCloudShade: { value: new Color() },
          uBg: { value: new Color() },
          uClouds: { value: 0 },
          uStars: { value: 0 },
          uPainted: { value: 0 },
          uNight: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  useFrame(({ camera, clock }) => {
    const u = material.uniforms;
    u.uTop.value.copy(look.top);
    u.uHorizon.value.copy(look.horizon);
    u.uFog.value.copy(look.fog);
    u.uSun.value.copy(look.sun);
    u.uSunDir.value.copy(look.sunDir);
    u.uCloudLit.value.copy(look.cloudLit);
    u.uCloudShade.value.copy(look.cloudShade);
    u.uBg.value.copy(look.bg);
    u.uClouds.value = look.clouds;
    u.uStars.value = look.stars;
    u.uPainted.value = look.painted;
    u.uNight.value = look.night;
    u.uTime.value = clock.elapsedTime;
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[500, 32, 16]} />
    </mesh>
  );
}
