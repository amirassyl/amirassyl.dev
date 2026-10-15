// A placeholder low-poly Amir built from primitives (a rigged model comes
// later): striped tee, blue jeans, round glasses, white sneakers with black
// stripes and dark wavy hair. He walks with WASD or the arrows (or the touch
// joystick), jumps with space, and raises his arms while he's "casting" a
// change to the world.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, PointsMaterial, Vector3 } from 'three';
import { moveInput, runtime } from './runtime';
import { stripes, toon } from './toon';

const WALK = 3.6; // m/s
const RUN = 6.5;
const JUMP = 5.4; // m/s straight up, so low gravity means much higher jumps

function useMaterials() {
  return useMemo(() => {
    const tee = stripes();
    const sleeve = tee.clone();
    sleeve.repeat.set(1, 2);
    return {
      skin: toon('#f4c9a4'),
      hair: toon('#3a271c'),
      tee: toon('#ffffff', tee),
      sleeve: toon('#ffffff', sleeve),
      jeans: toon('#3a5487'),
      shoe: toon('#fbfbf8'),
      stripe: toon('#1b1b1f'),
      frame: toon('#2a2522'),
      eye: toon('#2a1d18'),
      blush: toon('#f29a8c'),
    };
  }, []);
}

type Materials = ReturnType<typeof useMaterials>;

function Leg({ side, m, legRef }: { side: 1 | -1; m: Materials; legRef: React.RefObject<Group | null> }) {
  return (
    <group ref={legRef} position={[0.095 * side, 0.82, 0]}>
      <mesh material={m.jeans} position={[0, -0.36, 0]}>
        <cylinderGeometry args={[0.085, 0.075, 0.74, 10]} />
      </mesh>
      {/* Sneaker: white, with a black stripe down the outer side. */}
      <mesh material={m.shoe} position={[0, -0.775, 0.04]}>
        <boxGeometry args={[0.13, 0.09, 0.27]} />
      </mesh>
      <mesh material={m.stripe} position={[0.066 * side, -0.77, 0.04]}>
        <boxGeometry args={[0.006, 0.035, 0.17]} />
      </mesh>
      <mesh material={m.stripe} position={[0, -0.812, 0.04]}>
        <boxGeometry args={[0.135, 0.018, 0.275]} />
      </mesh>
    </group>
  );
}

function Arm({ side, m, armRef }: { side: 1 | -1; m: Materials; armRef: React.RefObject<Group | null> }) {
  return (
    <group ref={armRef} position={[0.25 * side, 1.27, 0]}>
      <mesh material={m.sleeve} position={[0.015 * side, -0.08, 0]}>
        <cylinderGeometry args={[0.07, 0.065, 0.18, 10]} />
      </mesh>
      <mesh material={m.skin} position={[0.02 * side, -0.33, 0]}>
        <cylinderGeometry args={[0.048, 0.044, 0.34, 8]} />
      </mesh>
      <mesh material={m.skin} position={[0.02 * side, -0.52, 0.01]}>
        <sphereGeometry args={[0.055, 10, 8]} />
      </mesh>
    </group>
  );
}

function Body({ m, refs }: { m: Materials; refs: { legL: React.RefObject<Group | null>; legR: React.RefObject<Group | null>; armL: React.RefObject<Group | null>; armR: React.RefObject<Group | null>; head: React.RefObject<Group | null> } }) {
  // Little waves of hair on top: a cap plus a ring of bumps.
  const curls: [number, number, number, number][] = [
    [0, 0.17, 0.06, 0.09],
    [0.09, 0.15, 0.04, 0.08],
    [-0.09, 0.15, 0.05, 0.08],
    [0.05, 0.14, 0.13, 0.075],
    [-0.06, 0.13, 0.13, 0.075],
    [0.14, 0.08, 0.0, 0.07],
    [-0.14, 0.08, 0.0, 0.07],
    [0.0, 0.12, -0.11, 0.09],
    [0.11, 0.07, -0.1, 0.08],
    [-0.11, 0.07, -0.1, 0.08],
  ];
  return (
    <>
      <Leg side={1} m={m} legRef={refs.legL} />
      <Leg side={-1} m={m} legRef={refs.legR} />
      <mesh material={m.jeans} position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.185, 0.19, 0.1, 14]} />
      </mesh>
      <mesh material={m.tee} position={[0, 1.07, 0]}>
        <cylinderGeometry args={[0.2, 0.19, 0.48, 14]} />
      </mesh>
      <mesh material={m.tee} position={[0, 1.3, 0]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Arm side={1} m={m} armRef={refs.armL} />
      <Arm side={-1} m={m} armRef={refs.armR} />
      <mesh material={m.skin} position={[0, 1.37, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.1, 8]} />
      </mesh>
      <group ref={refs.head} position={[0, 1.57, 0]}>
        <mesh material={m.skin}>
          <sphereGeometry args={[0.19, 20, 16]} />
        </mesh>
        <mesh material={m.hair} position={[0, 0.035, -0.015]} scale={[1.04, 0.95, 1.06]}>
          <sphereGeometry args={[0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
        </mesh>
        <mesh material={m.hair} position={[0, 0.0, -0.03]} scale={[1.02, 1, 1]}>
          <sphereGeometry args={[0.195, 18, 12, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.62]} />
        </mesh>
        {curls.map(([x, y, z, r], i) => (
          <mesh key={i} material={m.hair} position={[x, y, z]}>
            <sphereGeometry args={[r, 10, 8]} />
          </mesh>
        ))}
        {/* Round glasses, with eyes behind them. */}
        {[1, -1].map((side) => (
          <group key={side} position={[0.072 * side, -0.005, 0.175]}>
            <mesh material={m.frame}>
              <torusGeometry args={[0.052, 0.008, 6, 20]} />
            </mesh>
            <mesh material={m.eye} position={[0, -0.004, -0.008]} scale={[1, 1.25, 0.6]}>
              <sphereGeometry args={[0.017, 8, 6]} />
            </mesh>
            <mesh material={m.blush} position={[0.03 * side, -0.07, -0.02]} scale={[1.4, 0.7, 0.4]}>
              <sphereGeometry args={[0.02, 8, 6]} />
            </mesh>
            <mesh material={m.frame} position={[0.07 * side, 0, -0.07]} rotation-y={(Math.PI / 2) * side * 0.15}>
              <boxGeometry args={[0.006, 0.006, 0.15]} />
            </mesh>
          </group>
        ))}
        <mesh material={m.frame} position={[0, 0.005, 0.185]}>
          <boxGeometry args={[0.04, 0.007, 0.007]} />
        </mesh>
      </group>
    </>
  );
}

/** Sparkles that spiral in above Amir's raised hands while he casts. */
function Sparkles({ visible }: { visible: React.RefObject<number> }) {
  const count = 70;
  const { geometry, material } = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    const material = new PointsMaterial({ color: '#fff3b0', size: 0.07, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
    return { geometry, material };
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const positions = geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < count; i++) {
      const phase = (t * 0.55 + i / count) % 1;
      const r = 1.5 * (1 - phase) ** 1.5;
      const angle = i * 2.39996 + t * 2.2;
      positions.setXYZ(i, Math.cos(angle) * r, 2.15 + (1 - phase) * 0.6 * Math.sin(i), Math.sin(angle) * r);
    }
    positions.needsUpdate = true;
    material.opacity = visible.current ?? 0;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

export function Character({ gravity, reducedMotion }: { gravity: number; reducedMotion: boolean }) {
  const m = useMaterials();
  const body = useRef<RapierRigidBody>(null);
  const model = useRef<Group>(null);
  const refs = {
    legL: useRef<Group>(null),
    legR: useRef<Group>(null),
    armL: useRef<Group>(null),
    armR: useRef<Group>(null),
    head: useRef<Group>(null),
  };
  const anim = useRef({ walk: 0, facing: 0, cast: 0, gravity: 1, grounded: true });
  const sparkle = useRef(0);
  const forward = useMemo(() => new Vector3(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const rb = body.current;
    const a = anim.current;
    if (!rb) return;

    // Gravity eases to its new strength instead of snapping.
    a.gravity += (gravity - a.gravity) * (1 - Math.exp(-dt * 2));
    rb.setGravityScale(a.gravity, true);

    const input = moveInput();
    const speed = input.run ? RUN : WALK;
    // Forward is away from the camera.
    const sin = Math.sin(runtime.yaw);
    const cos = Math.cos(runtime.yaw);
    forward.set(-sin * input.y + cos * input.x, 0, -cos * input.y - sin * input.x);
    const v = rb.linvel();
    const p = rb.translation();
    a.grounded = p.y < 0.06 && Math.abs(v.y) < 0.6;
    const control = a.grounded ? 1 : 0.6;
    const t = 1 - Math.exp(-dt * 10 * control);
    const vx = v.x + (forward.x * speed - v.x) * t;
    const vz = v.z + (forward.z * speed - v.z) * t;
    let vy = v.y;
    if (runtime.jump) {
      if (a.grounded) vy = JUMP;
      runtime.jump = false;
    }
    rb.setLinvel({ x: vx, y: vy, z: vz }, true);
    if (p.y < -30) rb.setTranslation({ x: 0, y: 2, z: 0 }, true);

    runtime.player.set(p.x, Math.max(p.y, 0), p.z);
    const horizontal = Math.hypot(vx, vz);
    runtime.speed = horizontal;

    // Turn smoothly towards where he's going.
    if (horizontal > 0.3) {
      const want = Math.atan2(vx, vz);
      let diff = want - a.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.facing += diff * (1 - Math.exp(-dt * 12));
    }

    // Walk cycle, idle breathing, a jump pose and the casting pose.
    a.walk += dt * horizontal * 2.4;
    const swing = Math.sin(a.walk) * Math.min(horizontal / WALK, 1.4) * 0.6;
    const air = a.grounded ? 0 : 1;
    a.cast += ((runtime.casting ? 1 : 0) - a.cast) * (1 - Math.exp(-Math.min(delta, 0.1) * 5));
    sparkle.current = a.cast;
    const breathe = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2) * 0.012;
    if (model.current) {
      model.current.rotation.y = a.facing;
      model.current.position.y = breathe + (a.grounded ? Math.abs(Math.sin(a.walk)) * 0.04 * Math.min(horizontal / WALK, 1) : 0);
    }
    const legL = refs.legL.current;
    const legR = refs.legR.current;
    const armL = refs.armL.current;
    const armR = refs.armR.current;
    if (legL && legR && armL && armR) {
      legL.rotation.x = swing * (1 - air) - air * 0.5;
      legR.rotation.x = -swing * (1 - air) + air * 0.3;
      const raise = a.cast * 2.7;
      armL.rotation.x = -swing * (1 - a.cast) - raise;
      armR.rotation.x = swing * (1 - a.cast) - raise;
      armL.rotation.z = 0.12 + air * 0.6 - a.cast * 0.25;
      armR.rotation.z = -0.12 - air * 0.6 + a.cast * 0.25;
      if (a.cast > 0.01 && !reducedMotion) {
        armL.rotation.z += Math.sin(clock.elapsedTime * 6) * 0.08 * a.cast;
        armR.rotation.z -= Math.sin(clock.elapsedTime * 6) * 0.08 * a.cast;
      }
    }
    if (refs.head.current) refs.head.current.rotation.x = -a.cast * 0.3;
  });

  return (
    <RigidBody ref={body} colliders={false} enabledRotations={[false, false, false]} position={[0, 0.02, 0]} ccd>
      <CapsuleCollider args={[0.5, 0.3]} position={[0, 0.8, 0]} friction={0} />
      <group ref={model}>
        <Body m={m} refs={refs} />
        <Sparkles visible={sparkle} />
      </group>
    </RigidBody>
  );
}
