// Amir: a rigged model (public/models/amir.glb, built in Blender from a CC0
// base, see scripts/character) with idle, walk, jog, jump and spell-cast
// animations. He walks with WASD or the arrows (or the touch joystick), jogs
// with Shift, jumps with space, and casts while a prompt is being answered.
// No physics engine: the ground is a height function (terrain.ts), so a few
// lines of gravity are enough, and the page needs no WebAssembly.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LoopOnce, PointsMaterial, Vector3, type AnimationAction, type Mesh } from 'three';
import { moveInput, runtime } from './runtime';
import { terrainHeight } from './terrain';

export const MODEL_URL = '/models/amir.glb';
const WALK = 1.9; // m/s, the pace of the walk animation
const JOG = 4.6;
const JUMP = 4.4; // m/s straight up, so low gravity means much higher jumps
const G = 9.81;
const FADE = 0.28; // seconds to cross-fade between animations

type Clip = 'Idle_Loop' | 'Walk_Loop' | 'Jog_Fwd_Loop' | 'Jump_Start' | 'Jump_Loop' | 'Jump_Land' | 'Spell_Simple_Enter' | 'Spell_Simple_Idle_Loop' | 'Spell_Simple_Shoot';

/** Sparkles that spiral in above Amir's raised hands while he casts. */
function Sparkles({ visible }: { visible: React.RefObject<number> }) {
  const count = 70;
  const { geometry, material } = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    const material = new PointsMaterial({ color: '#fff3c4', size: 0.05, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
    return { geometry, material };
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const positions = geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < count; i++) {
      const phase = (t * 0.55 + i / count) % 1;
      const r = 1.2 * (1 - phase) ** 1.5;
      const angle = i * 2.39996 + t * 2.2;
      positions.setXYZ(i, Math.cos(angle) * r, 1.6 + (1 - phase) * 0.6 * Math.sin(i), Math.sin(angle) * r);
    }
    positions.needsUpdate = true;
    material.opacity = (visible.current ?? 0) * 0.9;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

export function Character({ gravity, reducedMotion }: { gravity: number; reducedMotion: boolean }) {
  const root = useRef<Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL, false, false);
  const { actions } = useAnimations(animations, root);
  const state = useRef({
    pos: new Vector3(0, 0, 0),
    vel: new Vector3(),
    gravity: 1,
    grounded: true,
    facing: Math.PI, // face the camera at the start
    clip: '' as Clip | '',
    castWas: false,
    shootUntil: 0,
    landUntil: 0,
  });
  const sparkle = useRef(0);
  const wish = useMemo(() => new Vector3(), []);

  useEffect(() => {
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) mesh.frustumCulled = false; // skinned bounds don't follow the animation
    });
  }, [scene]);

  const play = (clip: Clip, once = false, timeScale = 1) => {
    const s = state.current;
    const next = actions[clip] as AnimationAction | null | undefined;
    if (!next) return;
    next.timeScale = timeScale;
    if (s.clip === clip) return;
    const prev = s.clip ? (actions[s.clip] as AnimationAction | null) : null;
    next.reset();
    if (once) {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    next.fadeIn(FADE).play();
    prev?.fadeOut(FADE);
    s.clip = clip;
  };

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const s = state.current;
    const now = clock.elapsedTime;

    // Gravity eases to its new strength instead of snapping.
    s.gravity += (gravity - s.gravity) * (1 - Math.exp(-dt * 2));

    const input = moveInput();
    const speed = input.run ? JOG : WALK;
    // Forward is away from the camera.
    const sin = Math.sin(runtime.yaw);
    const cos = Math.cos(runtime.yaw);
    wish.set(-sin * input.y + cos * input.x, 0, -cos * input.y - sin * input.x).multiplyScalar(speed);
    const control = s.grounded ? 10 : 3;
    const t = 1 - Math.exp(-dt * control);
    s.vel.x += (wish.x - s.vel.x) * t;
    s.vel.z += (wish.z - s.vel.z) * t;

    if (runtime.jump) {
      if (s.grounded) {
        s.vel.y = JUMP;
        s.grounded = false;
      }
      runtime.jump = false;
    }
    s.vel.y -= G * s.gravity * dt;
    s.pos.addScaledVector(s.vel, dt);
    const ground = terrainHeight(s.pos.x, s.pos.z);
    if (s.pos.y <= ground) {
      if (!s.grounded && s.vel.y < -2) s.landUntil = now + 0.25;
      s.pos.y = ground;
      s.vel.y = 0;
      s.grounded = true;
    } else if (s.pos.y - ground > 0.05) {
      s.grounded = false;
    }

    const horizontal = Math.hypot(s.vel.x, s.vel.z);
    runtime.player.copy(s.pos);
    runtime.speed = horizontal;
    runtime.moving = horizontal > 0.25;

    // Turn to face where he's going.
    if (horizontal > 0.2) {
      const want = Math.atan2(s.vel.x, s.vel.z);
      let diff = want - s.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.facing += diff * (1 - Math.exp(-dt * 10));
    }
    if (root.current) {
      root.current.position.copy(s.pos);
      root.current.rotation.y = s.facing;
    }

    // Which animation: casting wins while standing, then air, then pace.
    if (s.castWas && !runtime.casting) s.shootUntil = now + 0.9;
    s.castWas = runtime.casting;
    if (!s.grounded) play('Jump_Loop');
    else if (now < s.landUntil) play('Jump_Land', true);
    else if (horizontal > 0.3) play(horizontal > (WALK + JOG) / 2 ? 'Jog_Fwd_Loop' : 'Walk_Loop', false, Math.max(0.6, horizontal / (horizontal > (WALK + JOG) / 2 ? JOG : WALK)));
    else if (runtime.casting) play('Spell_Simple_Idle_Loop');
    else if (now < s.shootUntil) play('Spell_Simple_Shoot', true);
    else play('Idle_Loop');

    sparkle.current += ((runtime.casting ? 1 : 0) - sparkle.current) * (1 - Math.exp(-dt * (reducedMotion ? 10 : 4)));
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
      <Sparkles visible={sparkle} />
    </group>
  );
}

useGLTF.preload(MODEL_URL, false, false);
