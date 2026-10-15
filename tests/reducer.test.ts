import { describe, expect, it } from 'vitest';
import { applyTool, applyTools } from '../src/world/reducer';
import { defaultWorld, parseToolCall, PRESET_DEFAULTS, type ToolCall } from '../src/world/schema';

const call = (name: string, args: unknown): ToolCall => {
  const parsed = parseToolCall(name, args);
  if (!parsed) throw new Error(`invalid ${name}`);
  return parsed;
};

describe('applyTool', () => {
  it('does not change the state it is given', () => {
    const world = defaultWorld();
    const before = JSON.stringify(world);
    applyTool(world, call('setGround', { preset: 'grass', wind: { amplitude: 1 } }));
    expect(JSON.stringify(world)).toBe(before);
  });

  it('switching preset starts from that preset and keeps the wind', () => {
    let world = applyTool(defaultWorld(), call('setGround', { preset: 'grass', wind: { amplitude: 0.9 } }));
    expect(world.ground.preset).toBe('grass');
    expect(world.ground.params.height).toBe(PRESET_DEFAULTS.grass.height);
    expect(world.ground.params.density).toBe(PRESET_DEFAULTS.grass.density);
    expect(world.ground.params.wind.amplitude).toBe(0.9);
    world = applyTool(world, call('setGround', { preset: 'flowers' }));
    expect(world.ground.params.height).toBe(PRESET_DEFAULTS.flowers.height);
    expect(world.ground.params.wind.amplitude).toBe(0.9);
  });

  it('merges a partial wind change on the same preset', () => {
    const grass = applyTool(defaultWorld(), call('setGround', { preset: 'grass', height: 1.2, colorTip: '#ffcc00' }));
    const windy = applyTool(grass, call('setGround', { preset: 'grass', wind: { speed: 4 } }));
    expect(windy.ground.params.height).toBe(1.2);
    expect(windy.ground.params.colorTip).toBe('#ffcc00');
    expect(windy.ground.params.wind).toEqual({ ...grass.ground.params.wind, speed: 4 });
  });

  it('custom colours reset when the preset changes', () => {
    const grass = applyTool(defaultWorld(), call('setGround', { preset: 'grass', colorTip: '#ffcc00' }));
    expect(applyTool(grass, call('setGround', { preset: 'sand' })).ground.params.colorTip).toBeUndefined();
  });

  it('sets the sky partially', () => {
    const golden = applyTool(defaultWorld(), call('setSky', { timeOfDay: 'golden' }));
    expect(golden.sky).toEqual({ timeOfDay: 'golden', clouds: 0 });
    expect(applyTool(golden, call('setSky', { clouds: 0.7 })).sky).toEqual({ timeOfDay: 'golden', clouds: 0.7 });
  });

  it('weather defaults to a medium amount, and none is zero', () => {
    const rain = applyTool(defaultWorld(), call('setWeather', { kind: 'rain' }));
    expect(rain.weather).toEqual({ kind: 'rain', intensity: 0.6 });
    expect(applyTool(rain, call('setWeather', { kind: 'rain', intensity: 0.2 })).weather.intensity).toBe(0.2);
    expect(applyTool(rain, call('setWeather', { kind: 'none', intensity: 1 })).weather).toEqual({ kind: 'none', intensity: 0 });
  });

  it('sets gravity and resets everything', () => {
    const world = applyTools(defaultWorld(), [
      call('setGround', { preset: 'snow' }),
      call('setGravity', { scale: 0.3 }),
      call('setWeather', { kind: 'snow' }),
    ]);
    expect(world.physics.gravity).toBe(0.3);
    expect(applyTool(world, call('resetWorld', {}))).toEqual(defaultWorld());
  });
});
