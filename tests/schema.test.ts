import { describe, expect, it } from 'vitest';
import { LIMITS, defaultWorld, parseToolCall, parseWorld } from '../src/world/schema';

describe('world schema', () => {
  it('accepts the default world', () => {
    expect(parseWorld(defaultWorld())).toEqual(defaultWorld());
  });

  it('survives a JSON round trip (sessionStorage)', () => {
    expect(parseWorld(JSON.parse(JSON.stringify(defaultWorld())))).toEqual(defaultWorld());
  });

  it('clamps numbers into range instead of rejecting them', () => {
    const world = defaultWorld();
    const wild = {
      ...world,
      ground: { preset: 'grass', params: { ...world.ground.params, height: 99, density: -3, wind: { dir: [0, 5], amplitude: 50, wavelength: 0.1, speed: -1, gustiness: 2 } } },
      sky: { timeOfDay: 'night', clouds: 7 },
      weather: { kind: 'rain', intensity: 3 },
      physics: { gravity: 0 },
    };
    const parsed = parseWorld(wild)!;
    expect(parsed.ground.params.height).toBe(LIMITS.height[1]);
    expect(parsed.ground.params.density).toBe(0);
    expect(parsed.ground.params.wind).toEqual({ dir: [0, 1], amplitude: LIMITS.amplitude[1], wavelength: LIMITS.wavelength[0], speed: 0, gustiness: 1 });
    expect(parsed.sky.clouds).toBe(1);
    expect(parsed.weather.intensity).toBe(1);
    expect(parsed.physics.gravity).toBe(LIMITS.gravity[0]);
  });

  it('rejects malformed worlds', () => {
    expect(parseWorld(null)).toBeNull();
    expect(parseWorld({ ...defaultWorld(), version: 2 })).toBeNull();
    expect(parseWorld({ ...defaultWorld(), ground: { preset: 'lava', params: defaultWorld().ground.params } })).toBeNull();
    expect(parseWorld({ ...defaultWorld(), physics: { gravity: Number.NaN } })).toBeNull();
    expect(parseWorld({ ...defaultWorld(), physics: { gravity: '1' } })).toBeNull();
  });

  it('drops colours that are not #rrggbb', () => {
    const world = defaultWorld();
    world.ground.params = { ...world.ground.params, colorBase: 'red; background:url(x)', colorTip: '#ABCDEF' } as typeof world.ground.params;
    const parsed = parseWorld(world)!;
    expect(parsed.ground.params.colorBase).toBeUndefined();
    expect(parsed.ground.params.colorTip).toBe('#abcdef');
  });

  it('caps the objects list', () => {
    const object = { id: 'a', kind: 'tree', transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 } };
    expect(parseWorld({ ...defaultWorld(), objects: [object] })?.objects[0].behaviour).toBe('static');
    expect(parseWorld({ ...defaultWorld(), objects: Array(65).fill(object) })).toBeNull();
  });
});

describe('tool calls', () => {
  it('validates and clamps each tool', () => {
    expect(parseToolCall('setGround', { preset: 'grass', height: 9, wind: { amplitude: -1 } })).toEqual({
      name: 'setGround',
      args: { preset: 'grass', height: LIMITS.height[1], colorBase: undefined, colorTip: undefined, wind: { amplitude: 0 } },
    });
    expect(parseToolCall('setSky', { timeOfDay: 'golden', clouds: 3 })).toEqual({ name: 'setSky', args: { timeOfDay: 'golden', clouds: 1 } });
    expect(parseToolCall('setWeather', { kind: 'snow', intensity: 0.5 })).toEqual({ name: 'setWeather', args: { kind: 'snow', intensity: 0.5 } });
    expect(parseToolCall('setGravity', { scale: 100 })).toEqual({ name: 'setGravity', args: { scale: 2 } });
    expect(parseToolCall('resetWorld', undefined)).toEqual({ name: 'resetWorld', args: {} });
  });

  it('normalises the wind direction', () => {
    const call = parseToolCall('setGround', { preset: 'grass', wind: { dir: [3, 4] } });
    expect(call?.name === 'setGround' && call.args.wind?.dir).toEqual([0.6, 0.8]);
    const still = parseToolCall('setGround', { preset: 'grass', wind: { dir: [0, 0] } });
    expect(still?.name === 'setGround' && still.args.wind?.dir).toEqual([1, 0]);
  });

  it('strips unknown fields', () => {
    expect(parseToolCall('setGravity', { scale: 1, code: 'alert(1)' })).toEqual({ name: 'setGravity', args: { scale: 1 } });
  });

  it('refuses unknown tools and bad arguments', () => {
    expect(parseToolCall('eval', { code: '1' })).toBeNull();
    expect(parseToolCall('toString', {})).toBeNull();
    expect(parseToolCall('setGround', { preset: 'lava' })).toBeNull();
    expect(parseToolCall('setSky', {})).toBeNull();
    expect(parseToolCall('setWeather', { kind: 'hail' })).toBeNull();
    expect(parseToolCall('setGravity', { scale: 'low' })).toBeNull();
    expect(parseToolCall(42, {})).toBeNull();
  });
});
