// Clothes that move on their own: the shirt hem and the wide trouser legs hang
// from short chains of "cloth" bones (added in Blender, see
// scripts/character). Each chain is a spring-bone simulation from
// @pixiv/three-vrm-springbone (the same system VRoid/VRM avatars use for
// skirts and coats): the bones lag behind Amir's movement, fall back under
// gravity, are pushed by the world's wind and gusts, and are kept out of his
// legs and hips by capsule colliders.
import { Object3D, Vector3 } from 'three';
import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneJoint,
  VRMSpringBoneManager,
  type VRMSpringBoneColliderGroup,
} from '@pixiv/three-vrm-springbone';

export interface SpringCloth {
  manager: VRMSpringBoneManager;
  joints: { joint: VRMSpringBoneJoint; kind: 'shirt' | 'leg'; phase: number }[];
}

// three's GLTFLoader drops dots from node names ("DEF-thigh.L" becomes "DEF-thighL").
const find = (byName: Map<string, Object3D>, name: string) => byName.get(name) ?? byName.get(name.replace(/\./g, ''));

const SETTINGS = {
  shirt: { stiffness: 0.55, gravityPower: 0.35, dragForce: 0.32, hitRadius: 0.035 },
  leg: { stiffness: 0.9, gravityPower: 0.3, dragForce: 0.42, hitRadius: 0.05 },
};

export function makeSpringCloth(root: Object3D): SpringCloth | null {
  if (root.userData.springCloth) return root.userData.springCloth as SpringCloth;
  const byName = new Map<string, Object3D>();
  root.traverse((object) => byName.set(object.name, object));
  if (!find(byName, 'cloth_shirt_0_0')) return null; // an older model without cloth bones

  root.updateMatrixWorld(true);
  const capsule = (boneName: string, radius: number, length: number): VRMSpringBoneCollider | null => {
    const bone = find(byName, boneName);
    if (!bone) return null;
    const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({ radius, offset: new Vector3(), tail: new Vector3(0, length, 0) }));
    bone.add(collider);
    return collider;
  };
  const group = (name: string, colliders: (VRMSpringBoneCollider | null)[]): VRMSpringBoneColliderGroup => ({ name, colliders: colliders.filter((c): c is VRMSpringBoneCollider => !!c) });
  const legs = group('legs', [
    capsule('DEF-thigh.L', 0.075, 0.42),
    capsule('DEF-shin.L', 0.06, 0.41),
    capsule('DEF-thigh.R', 0.075, 0.42),
    capsule('DEF-shin.R', 0.06, 0.41),
  ]);
  const torso = group('torso', [capsule('DEF-hips', 0.13, 0.1), capsule('DEF-spine.001', 0.135, 0.12)]);

  const manager = new VRMSpringBoneManager();
  const joints: SpringCloth['joints'] = [];
  const chain = (names: string[], kind: 'shirt' | 'leg', colliderGroups: VRMSpringBoneColliderGroup[]) => {
    const bones = names.map((n) => find(byName, n)).filter((b): b is Object3D => !!b);
    if (bones.length !== names.length) return;
    // The last bone has no child in glTF; give it a tail as long as the bone before it.
    const last = bones[bones.length - 1];
    const tail = new Object3D();
    tail.name = `${last.name}_tail`;
    tail.position.set(0, bones.length > 1 ? last.position.length() : 0.15, 0);
    last.add(tail);
    bones.forEach((bone, i) => {
      const joint = new VRMSpringBoneJoint(bone, bones[i + 1] ?? tail, { ...SETTINGS[kind], gravityDir: new Vector3(0, -1, 0) }, colliderGroups);
      manager.addJoint(joint);
      joints.push({ joint, kind, phase: joints.length * 1.7 });
    });
  };
  for (let i = 0; i < 6; i++) chain([`cloth_shirt_${i}_0`, `cloth_shirt_${i}_1`], 'shirt', [legs, torso]);
  for (const side of ['L', 'R']) for (const fb of ['front', 'back']) chain([`cloth_leg_${side}_${fb}_0`, `cloth_leg_${side}_${fb}_1`], 'leg', [legs]);
  manager.setInitState();
  const cloth = { manager, joints };
  root.userData.springCloth = cloth;
  return cloth;
}

const push = new Vector3();

/** Step the cloth: gravity tilted by the wind, which gusts a little differently on each chain. */
export function updateSpringCloth(cloth: SpringCloth, root: Object3D, dt: number, time: number, windDir: Vector3, windAmp: number, gust: number) {
  const strength = Math.min(windAmp, 1.6);
  for (const { joint, kind, phase } of cloth.joints) {
    const flutter = 0.65 + 0.35 * Math.sin(time * 1.9 + phase) + gust * 0.35 * Math.sin(time * 4.3 + phase * 2.1);
    push.set(windDir.x, 0, windDir.z).normalize().multiplyScalar(strength * flutter * (kind === 'shirt' ? 1.6 : 0.9));
    joint.settings.gravityDir.set(push.x, -1, push.z).normalize();
    joint.settings.gravityPower = SETTINGS[kind].gravityPower * (1 + strength * (kind === 'shirt' ? 1.4 : 0.8));
  }
  root.updateMatrixWorld(true);
  cloth.manager.update(Math.min(dt, 1 / 20));
}
