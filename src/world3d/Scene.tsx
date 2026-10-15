// Everything inside the canvas: it turns the world state (data) into what is
// drawn. Each frame the visible "look" eases towards the look the state asks
// for, so every change animates; a change of ground grows out from Amir.
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Vector2, Vector3, type DirectionalLight, type HemisphereLight } from 'three';
import type { WorldState } from '../world/schema';
import { Look, effectiveTime, type Theme } from './look';
import { Sky } from './Sky';
import { Ground, RING_DONE, lightColour, type Ring } from './Ground';
import { Grass } from './Grass';
import { Weather } from './Weather';
import { runtime } from './runtime';
import { Character } from './Character';
import { terrainHeight } from './terrain';
import { Detect } from './Detect';
import { isPainted } from './look';

// Far enough back that Amir is small in a big landscape, like the reference photos.
const CAMERA_DISTANCE = 10;

function FollowCamera({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree();
  const target = useMemo(() => new Vector3(), []);
  const want = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    target.set(runtime.player.x, runtime.player.y + 1.15, runtime.player.z);
    const horizontal = Math.cos(runtime.pitch) * CAMERA_DISTANCE;
    want.set(target.x + Math.sin(runtime.yaw) * horizontal, target.y + Math.sin(runtime.pitch) * CAMERA_DISTANCE, target.z + Math.cos(runtime.yaw) * horizontal);
    // Never inside a hill.
    want.y = Math.max(want.y, terrainHeight(want.x, want.z) + 0.7);
    camera.position.lerp(want, reducedMotion ? 1 : 1 - Math.exp(-dt * 6));
    camera.lookAt(target);
  });
  return null;
}

export function Scene({ world, theme, mobile, reducedMotion }: { world: WorldState; theme: Theme; mobile: boolean; reducedMotion: boolean }) {
  const target = useMemo(() => new Look(), []);
  const look = useMemo(() => new Look(), []);
  const first = useRef(true);
  const ring = useMemo<Ring>(() => ({ from: world.ground.preset, to: world.ground.preset, center: new Vector2(), radius: RING_DONE }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const light = useMemo(() => new Color(), []);
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);

  useEffect(() => {
    target.setTarget(world, theme, reducedMotion);
    if (first.current) {
      look.copy(target);
      first.current = false;
    }
    // A new ground grows outward from where Amir stands now.
    if (world.ground.preset !== ring.to) {
      const hadBlades = ring.to === 'grass' || ring.to === 'flowers';
      ring.from = ring.to; // a change that was still growing finishes at once
      ring.to = world.ground.preset;
      ring.center.set(runtime.player.x, runtime.player.z);
      ring.radius = 0;
      // Freshly sprouting grass starts at its full settings; the ring does the growing.
      if (!hadBlades) {
        look.height = target.height;
        look.density = target.density;
        look.flowerShare = target.flowerShare;
      }
    }
  }, [world, theme, reducedMotion, target, look, ring]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1); // a slow frame still moves the change along, a stalled tab doesn't jump
    look.approach(target, dt, reducedMotion ? 4 : 1.6);
    if (ring.radius < RING_DONE) {
      // Quick at first, then speeding up, so the nearby change is easy to watch.
      ring.radius = Math.min(RING_DONE, ring.radius + dt * (reducedMotion ? 120 : 9 + ring.radius * 0.9));
      if (ring.radius >= RING_DONE) ring.from = ring.to;
    }
    lightColour(look, light);
    runtime.hills = look.hills;
    if (sun.current) {
      sun.current.color.copy(look.sun);
      sun.current.intensity = look.sunIntensity * (0.55 + 0.45 * look.painted);
      sun.current.position.copy(look.sunDir).multiplyScalar(20).add(runtime.player);
      sun.current.target.position.copy(runtime.player);
      sun.current.target.updateMatrixWorld();
    }
    if (sky.current) {
      sky.current.color.copy(look.ambient);
      sky.current.groundColor.copy(look.painted > 0.5 ? look.fog : look.bg);
      sky.current.intensity = look.ambientIntensity * (1.4 - 0.4 * look.painted);
    }
  });

  return (
    <>
      <FollowCamera reducedMotion={reducedMotion} />
      <Detect painted={isPainted(world) ? 1 : 0} />
      <directionalLight ref={sun} />
      <hemisphereLight ref={sky} />
      {/* Only Amir uses three.js lights (the world has its own shaders), so this lifts him out of silhouette. */}
      <ambientLight intensity={1.1} color="#f2efe6" />
      <Sky look={look} />
      <Ground look={look} ring={ring} />
      <Grass look={look} ring={ring} light={light} mobile={mobile} />
      <Weather {...weatherFor(world, theme)} look={look} mobile={mobile} reducedMotion={reducedMotion} />
      <Suspense fallback={null}>
        <Character gravity={world.physics.gravity} reducedMotion={reducedMotion} />
      </Suspense>
    </>
  );
}

/** Moonlit nights get a few fireflies of their own when no other weather is set. */
function weatherFor(world: WorldState, theme: Theme) {
  if (world.weather.kind === 'none' && effectiveTime(world, theme) === 'night') return { kind: 'fireflies' as const, intensity: 0.3 };
  return world.weather;
}
