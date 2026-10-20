// Flowy clothes without a cloth simulation. Each vertex gets a "flow" weight
// from the bones that move it (trouser legs and the shirt tail flow the most,
// sleeves a little, the head and the body's core not at all). A few lines added
// to the standard material's vertex shader then sway those vertices with the
// world's wind (the same direction, strength and gusts as the grass), plus a
// little drag behind Amir while he walks.
import { BufferAttribute, Matrix4, Vector3, type MeshStandardMaterial, type SkinnedMesh } from 'three';

// How freely the cloth around each bone moves (0..1). Bone names are Quaternius' UAL rig.
const FLOW: [RegExp, number][] = [
  [/shin/, 0.85],
  [/foot/, 0.35],
  [/thigh/, 0.4],
  [/hips/, 0.55],
  [/spine\.001/, 0.45],
  [/spine\.002/, 0.18],
  [/forearm/, 0.35],
  [/upper_arm/, 0.15],
];

export interface ClothUniforms {
  uTime: { value: number };
  uWind: { value: Vector3 };
  uDrag: { value: Vector3 };
  uGust: { value: number };
}

/** Add the flow attribute and the wind sway to one skinned mesh. Returns its uniforms. */
export function makeFlowy(mesh: SkinnedMesh): ClothUniforms {
  const geometry = mesh.geometry;
  const index = geometry.getAttribute('skinIndex');
  const weight = geometry.getAttribute('skinWeight');
  const position = geometry.getAttribute('position');
  const boneFlow = mesh.skeleton.bones.map((bone) => FLOW.find(([pattern]) => pattern.test(bone.name))?.[1] ?? 0);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }
  const flow = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    let f = 0;
    for (let k = 0; k < 4; k++) f += weight.getComponent(i, k) * boneFlow[index.getComponent(i, k)];
    // Hems move more than the cloth near the waist: weight the legs towards the ankles.
    const height = (position.getY(i) - minY) / (maxY - minY || 1);
    if (height < 0.5) f *= 0.55 + 0.9 * (0.5 - height);
    flow[i] = Math.min(1, f);
  }
  geometry.setAttribute('aFlow', new BufferAttribute(flow, 1));

  const uniforms: ClothUniforms = { uTime: { value: 0 }, uWind: { value: new Vector3() }, uDrag: { value: new Vector3() }, uGust: { value: 0.3 } };
  for (const material of [mesh.material].flat() as MeshStandardMaterial[]) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aFlow;
uniform float uTime;
uniform vec3 uWind;
uniform vec3 uDrag;
uniform float uGust;`,
        )
        .replace(
          '#include <skinning_vertex>',
          `#include <skinning_vertex>
{
  // Billowing: a slow push along the wind with a faster ripple running up the cloth.
  float phase = uTime * 2.3 + transformed.y * 4.0 + transformed.x * 3.0;
  float gust = 0.65 + 0.35 * sin(uTime * 0.9 + transformed.y * 1.3) + uGust * 0.4 * sin(uTime * 3.7 + transformed.z * 5.0);
  vec3 sway = uWind * gust * (0.75 + 0.25 * sin(phase)) + uDrag;
  sway += normalize(objectNormal) * 0.006 * length(uWind) * 12.0 * sin(phase * 1.7);
  transformed += sway * aFlow;
}`,
        );
    };
    material.customProgramCacheKey = () => 'amir-cloth-flow';
    material.needsUpdate = true;
  }
  return uniforms;
}

const inverse = new Matrix4();
const local = new Vector3();

/**
 * Point the wind (world xz direction and strength) and the drag (world velocity) into the
 * mesh's own space, where the shader works, and scale them to metres of sway.
 */
export function updateFlow(u: ClothUniforms, mesh: SkinnedMesh, time: number, windDir: Vector3, windAmp: number, gust: number, velocity: Vector3) {
  inverse.copy(mesh.matrixWorld).invert();
  const scale = mesh.matrixWorld.getMaxScaleOnAxis() || 1;
  u.uTime.value = time;
  u.uGust.value = gust;
  local.copy(windDir).setY(0).normalize().transformDirection(inverse);
  u.uWind.value.copy(local).multiplyScalar((0.05 * Math.min(windAmp, 1.6)) / scale);
  local.copy(velocity).setY(0);
  const speed = Math.min(local.length(), 6);
  if (speed > 0.01) local.normalize().transformDirection(inverse).multiplyScalar((-0.012 * speed) / scale);
  else local.set(0, 0, 0);
  u.uDrag.value.copy(local);
}
