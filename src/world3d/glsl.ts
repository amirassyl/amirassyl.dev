// Small GLSL helpers shared by the world's shaders: hashing, value noise and fbm.
export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise2(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    amp *= 0.5;
  }
  return sum;
}
`;

// The wind, as travelling waves over the ground (world x/z). Gusts roll across
// the field in bands because every blade at the same distance along the wind
// bends at the same moment: bend = A * sin(dot(dir, pos) * k - t * w) + noise.
// Returns the bend amount (0..~1.5) and the band brightness in .y.
export const WIND = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
uniform float uAmp;
uniform float uK;
uniform float uW;
uniform float uGust;
vec2 windAt(vec2 wp) {
  float phase = dot(uWindDir, wp) * uK - uTime * uW;
  float band = sin(phase) * 0.5 + 0.5;
  band = band * band;
  // A second, slower and crossing wave so the bands don't look ruled.
  vec2 side = vec2(-uWindDir.y, uWindDir.x);
  float cross = sin(dot(side, wp) * uK * 0.37 + dot(uWindDir, wp) * uK * 0.5 - uTime * uW * 0.61) * 0.5 + 0.5;
  float gust = noise2(wp * 0.11 - uWindDir * uTime * uW / max(uK, 0.01) * 0.11);
  float bend = uAmp * (0.18 + 0.82 * band * (0.65 + 0.35 * cross)) + (gust - 0.5) * uGust * uAmp * 1.4;
  return vec2(max(bend, 0.0), band);
}
`;
