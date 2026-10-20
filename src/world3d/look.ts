// Colours and light for each time of day, and the per-frame "look" the scene
// eases towards. Nothing jumps: every frame each value moves a little closer
// to its target (see approach()).
import { Color, Vector3 } from 'three';
import type { GroundPreset, TimeOfDay, WorldState } from '../world/schema';

export type Theme = 'light' | 'dark';

interface Palette {
  top: string;
  horizon: string;
  fog: string;
  sun: string;
  sunDir: [number, number, number];
  sunIntensity: number;
  ambient: string;
  ambientIntensity: number;
  cloudLit: string;
  cloudShade: string;
  stars: number;
}

// A filmic steppe (see the art direction note): soft overcast light by day, a warm
// haze at golden hour, a deep blue-green night. Low contrast, slightly muted.
const PALETTES: Record<TimeOfDay, Palette> = {
  dawn: { top: '#a9b4c4', horizon: '#ecd6c6', fog: '#dcd2c8', sun: '#ffd9bd', sunDir: [0.75, 0.14, -0.5], sunIntensity: 1.3, ambient: '#c9c6cf', ambientIntensity: 1.15, cloudLit: '#f4e9e1', cloudShade: '#8f8e9c', stars: 0.05 },
  day: { top: '#9eaaa9', horizon: '#e2e1d6', fog: '#d3d6cc', sun: '#fff6e6', sunDir: [0.4, 0.55, -0.7], sunIntensity: 1.25, ambient: '#d8ddd6', ambientIntensity: 1.3, cloudLit: '#f1f0ea', cloudShade: '#8d9592', stars: 0 },
  golden: { top: '#93a6b0', horizon: '#f1d6a6', fog: '#e4d3b1', sun: '#ffc77e', sunDir: [0.68, 0.16, -0.7], sunIntensity: 1.9, ambient: '#d9c8ae', ambientIntensity: 1.0, cloudLit: '#fbe9c8', cloudShade: '#a58b7c', stars: 0 },
  dusk: { top: '#4c5671', horizon: '#d39c86', fog: '#9d8a8f', sun: '#ff9d72', sunDir: [0.8, 0.06, -0.6], sunIntensity: 1.2, ambient: '#86809a', ambientIntensity: 0.85, cloudLit: '#e7b39b', cloudShade: '#4d4a63', stars: 0.3 },
  night: { top: '#070d16', horizon: '#1c2d3d', fog: '#16232f', sun: '#b9cde0', sunDir: [-0.42, 0.55, -0.72], sunIntensity: 0.7, ambient: '#3d5568', ambientIntensity: 0.75, cloudLit: '#344658', cloudShade: '#121b26', stars: 1 },
};

// Colours the ground takes under each preset (grass blades have their own, below).
const GROUND: Record<GroundPreset, string> = {
  plain: '#ffffff', // replaced by the page colour
  grass: '#4f5f2c',
  flowers: '#55662f',
  sand: '#ead197',
  snow: '#f3f6fb',
  water: '#2f86b5',
};
export const GROUND_KIND: Record<GroundPreset, number> = { plain: 0, grass: 1, flowers: 2, sand: 3, snow: 4, water: 5 };

export const GRASS_COLOURS: Record<'grass' | 'flowers', { base: string; tip: string }> = {
  grass: { base: '#2c4219', tip: '#b9b45e' },
  flowers: { base: '#33491c', tip: '#c1bb66' },
};

// The page's own colours (global.css), for the empty starting world.
export const PAGE = {
  light: { bg: '#fcfcfa', dot: '#c2c2b9' },
  dark: { bg: '#111113', dot: '#34343b' },
} as const;

/** The time of day that is actually shown: 'auto' follows the site's day/night switch. */
export function effectiveTime(world: WorldState, theme: Theme): TimeOfDay {
  if (world.sky.timeOfDay !== 'auto') return world.sky.timeOfDay;
  return theme === 'dark' ? 'night' : 'day';
}

/** The empty world is drawn in the page's colours; anything a visitor adds brings in the painted sky. */
export function isPainted(world: WorldState): boolean {
  return world.sky.timeOfDay !== 'auto' || world.sky.clouds > 0 || world.ground.preset !== 'plain' || world.weather.kind !== 'none';
}

export class Look {
  top = new Color();
  horizon = new Color();
  fog = new Color();
  sun = new Color();
  sunDir = new Vector3();
  sunIntensity = 1;
  ambient = new Color();
  ambientIntensity = 1;
  cloudLit = new Color();
  cloudShade = new Color();
  stars = 0;
  clouds = 0;
  painted = 0;
  bg = new Color();
  dot = new Color();
  ground = new Color();
  grassBase = new Color();
  grassTip = new Color();
  height = 0.6;
  density = 0;
  flowerShare = 0;
  windDir = new Vector3(1, 0, 0); // x and z used
  amp = 0;
  wavelength = 9;
  speed = 1.6;
  gust = 0.3;
  gravity = 1;
  night = 0;
  hills = 0;

  /** Fill in the target for a world and theme. */
  setTarget(world: WorldState, theme: Theme, reducedMotion: boolean): this {
    const time = effectiveTime(world, theme);
    const p = PALETTES[time];
    const painted = isPainted(world);
    const page = PAGE[theme];
    // Rain greys the sky and dims the sun.
    const overcast = world.weather.kind === 'rain' ? world.weather.intensity : 0;
    const grey = new Color(time === 'night' ? '#0d1730' : '#8d9aab');
    this.bg.set(page.bg);
    this.dot.set(page.dot);
    this.top.set(p.top).lerp(grey, overcast * 0.55);
    this.horizon.set(p.horizon).lerp(grey, overcast * 0.45);
    this.fog.set(p.fog).lerp(grey, overcast * 0.45);
    this.sun.set(p.sun);
    this.sunDir.set(...p.sunDir).normalize();
    this.sunIntensity = p.sunIntensity * (1 - overcast * 0.5);
    this.ambient.set(p.ambient);
    this.ambientIntensity = p.ambientIntensity;
    this.cloudLit.set(p.cloudLit).lerp(grey, overcast * 0.4);
    this.cloudShade.set(p.cloudShade).lerp(grey, overcast * 0.3);
    this.stars = p.stars * (1 - overcast);
    // A painted world always has some overcast; the visitor's setting adds to it.
    this.clouds = Math.max(painted ? 0.45 + 0.55 * world.sky.clouds : world.sky.clouds, overcast * 0.9);
    this.hills = painted ? 1 : 0;
    this.painted = painted ? 1 : 0;
    this.night = time === 'night' ? 1 : 0;

    const { preset, params } = world.ground;
    this.ground.set(preset === 'plain' ? page.bg : GROUND[preset]);
    const blades = preset === 'grass' || preset === 'flowers' ? GRASS_COLOURS[preset] : GRASS_COLOURS.grass;
    this.grassBase.set(params.colorBase ?? blades.base);
    this.grassTip.set(params.colorTip ?? blades.tip);
    // On ground without blades the grass keeps its last settings: the reveal ring
    // (see Ring) is what clears it away, outward from Amir.
    if (preset === 'grass' || preset === 'flowers') {
      this.height = params.height;
      this.density = params.density;
      this.flowerShare = preset === 'flowers' ? 1 : 0.12;
    }
    this.windDir.set(params.wind.dir[0], 0, params.wind.dir[1]);
    // Gentler for visitors who ask for less motion.
    this.amp = reducedMotion ? Math.min(params.wind.amplitude, 0.25) : params.wind.amplitude;
    this.wavelength = params.wind.wavelength;
    this.speed = reducedMotion ? Math.min(params.wind.speed, 0.8) : params.wind.speed;
    this.gust = params.wind.gustiness;
    this.gravity = world.physics.gravity;
    return this;
  }

  /** Copy everything from another look (the first frame). */
  copy(other: Look): this {
    for (const key of Object.keys(this) as (keyof Look)[]) {
      const value = this[key];
      if (value instanceof Color || value instanceof Vector3) (value as Color & Vector3).copy(other[key] as Color & Vector3);
      else if (typeof value === 'number') (this as Record<string, unknown>)[key] = other[key];
    }
    return this;
  }

  /** Move a step towards the target. `rate` is how much of the gap closes per second. */
  approach(target: Look, dt: number, rate = 1.6): this {
    const t = 1 - Math.exp(-dt * rate);
    for (const key of Object.keys(this) as (keyof Look)[]) {
      const value = this[key];
      if (value instanceof Color) value.lerp(target[key] as Color, t);
      else if (value instanceof Vector3) value.lerp(target[key] as Vector3, t);
      else if (typeof value === 'number') (this as Record<string, unknown>)[key] = value + ((target[key] as number) - value) * t;
    }
    // Keep the wind a direction while it turns.
    this.windDir.y = 0;
    if (this.windDir.lengthSq() < 1e-6) this.windDir.set(1, 0, 0);
    this.windDir.normalize();
    return this;
  }
}
