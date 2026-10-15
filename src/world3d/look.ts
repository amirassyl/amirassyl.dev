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

// Warm afternoon by day, moonlit blue at night; Ghibli-ish skies in between.
const PALETTES: Record<TimeOfDay, Palette> = {
  dawn: { top: '#6c8fd2', horizon: '#f8c7a4', fog: '#ecd3c2', sun: '#ffc9a3', sunDir: [0.75, 0.16, -0.5], sunIntensity: 1.9, ambient: '#b9b3d6', ambientIntensity: 0.95, cloudLit: '#fff0e4', cloudShade: '#a493bf', stars: 0.08 },
  day: { top: '#3d8ce0', horizon: '#cde8f5', fog: '#d4eaf3', sun: '#fff1d6', sunDir: [0.45, 0.62, -0.62], sunIntensity: 2.4, ambient: '#c4dcf0', ambientIntensity: 1.05, cloudLit: '#ffffff', cloudShade: '#a8bad6', stars: 0 },
  golden: { top: '#5a8bd0', horizon: '#ffd08c', fog: '#f3d6a6', sun: '#ffb45e', sunDir: [0.68, 0.2, -0.7], sunIntensity: 2.5, ambient: '#d9c0a8', ambientIntensity: 0.9, cloudLit: '#fff1c9', cloudShade: '#c78f7d', stars: 0 },
  dusk: { top: '#2b3470', horizon: '#ef8a6c', fog: '#a6788e', sun: '#ff8d5e', sunDir: [0.8, 0.06, -0.6], sunIntensity: 1.5, ambient: '#7f6f9e', ambientIntensity: 0.8, cloudLit: '#ffb391', cloudShade: '#5b4a7c', stars: 0.35 },
  night: { top: '#06102a', horizon: '#1d3a6c', fog: '#132649', sun: '#a9c4ff', sunDir: [-0.42, 0.55, -0.72], sunIntensity: 0.95, ambient: '#3c5a98', ambientIntensity: 0.7, cloudLit: '#4b679b', cloudShade: '#17264b', stars: 1 },
};

// Colours the ground takes under each preset (grass blades have their own, below).
const GROUND: Record<GroundPreset, string> = {
  plain: '#ffffff', // replaced by the page colour
  grass: '#3d7426',
  flowers: '#4a8030',
  sand: '#ead197',
  snow: '#f3f6fb',
  water: '#2f86b5',
};
export const GROUND_KIND: Record<GroundPreset, number> = { plain: 0, grass: 1, flowers: 2, sand: 3, snow: 4, water: 5 };

export const GRASS_COLOURS: Record<'grass' | 'flowers', { base: string; tip: string }> = {
  grass: { base: '#2b6a1e', tip: '#a9d84c' },
  flowers: { base: '#3a7a25', tip: '#b8de5c' },
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
    this.clouds = Math.max(world.sky.clouds, overcast * 0.9);
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
