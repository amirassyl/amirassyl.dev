// Physics (Rapier, compiled to WebAssembly) with the ground and Amir in it.
// Loaded lazily, so the sky and the floor show while it downloads.
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { Character } from './Character';

export default function Physical({ gravity, reducedMotion }: { gravity: number; reducedMotion: boolean }) {
  return (
    <Physics gravity={[0, -9.81, 0]} timeStep="vary">
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2000, 0.5, 2000]} position={[0, -0.5, 0]} />
      </RigidBody>
      <Character gravity={gravity} reducedMotion={reducedMotion} />
    </Physics>
  );
}
