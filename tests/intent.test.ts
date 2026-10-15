import { describe, expect, it } from 'vitest';
import { parseIntent, replyForCalls } from '../src/world/intent';
import { applyTools } from '../src/world/reducer';
import { defaultWorld } from '../src/world/schema';

const world = defaultWorld();
const names = (prompt: string, state = world) => parseIntent(prompt, state).calls.map((call) => call.name);
const after = (prompt: string, state = world) => applyTools(state, parseIntent(prompt, state).calls);

describe('parseIntent (fallback)', () => {
  it('turns the floor into grass', () => {
    const next = after('Turn the floor into cinematic grass');
    expect(next.ground.preset).toBe('grass');
    expect(next.ground.params.height).toBeGreaterThan(0.7);
    expect(next.sky.clouds).toBeGreaterThan(0);
  });

  it('knows the ground presets', () => {
    expect(after('flowers please').ground.preset).toBe('flowers');
    expect(after('make it a beach').ground.preset).toBe('sand');
    expect(after('turn it into water').ground.preset).toBe('water');
    expect(after('winter wonderland').ground.preset).toBe('snow');
  });

  it('makes it windier, calmer and stormy', () => {
    const grass = after('grass');
    const windy = after('make it windy', grass);
    expect(windy.ground.params.wind.amplitude).toBeGreaterThan(grass.ground.params.wind.amplitude);
    expect(windy.ground.preset).toBe('grass');
    const calmer = after('calmer', windy);
    expect(calmer.ground.params.wind.amplitude).toBeLessThan(windy.ground.params.wind.amplitude);
    const stormy = after('stormy', grass);
    expect(stormy.ground.params.wind.amplitude).toBeGreaterThan(0.9);
    expect(stormy.weather.kind).toBe('rain');
    expect(stormy.sky.clouds).toBeGreaterThan(0.9);
  });

  it('knows the times of day', () => {
    expect(after('golden hour').sky.timeOfDay).toBe('golden');
    expect(after('night').sky.timeOfDay).toBe('night');
    expect(after('sunrise').sky.timeOfDay).toBe('dawn');
    expect(after('sunset').sky.timeOfDay).toBe('dusk');
    expect(after('make it day').sky.timeOfDay).toBe('day');
  });

  it('knows the weather', () => {
    expect(after('rain').weather.kind).toBe('rain');
    expect(after('make it snow').weather.kind).toBe('snow');
    expect(after('make it snow').ground.preset).toBe('plain'); // snow falls; the ground stays
    expect(after('sakura petals').weather.kind).toBe('petals');
    expect(after('dandelions').weather.kind).toBe('dandelion');
    expect(after('stop the rain', after('rain')).weather.kind).toBe('none');
  });

  it('handles night with fireflies in one go', () => {
    const next = after('night with fireflies');
    expect(next.sky.timeOfDay).toBe('night');
    expect(next.weather.kind).toBe('fireflies');
  });

  it('changes gravity', () => {
    expect(after('low gravity').physics.gravity).toBe(0.3);
    expect(after('heavy gravity').physics.gravity).toBe(1.8);
    expect(after('zero gravity').physics.gravity).toBe(0.1);
    // "moon" here is about gravity, not the night sky
    expect(names('moon gravity')).toEqual(['setGravity']);
  });

  it('resets', () => {
    expect(names('reset')).toEqual(['resetWorld']);
    expect(after('start over', after('grass and rain'))).toEqual(defaultWorld());
  });

  it('understands a little Russian', () => {
    expect(after('трава').ground.preset).toBe('grass');
    expect(after('дождь').weather.kind).toBe('rain');
  });

  it('answers in character, and owns up when it does not understand', () => {
    const known = parseIntent('grass', world);
    expect(known.reply.length).toBeGreaterThan(0);
    expect(known.reply.split('\n').length).toBeLessThanOrEqual(2);
    const unknown = parseIntent('what is the meaning of life', world);
    expect(unknown.calls).toEqual([]);
    expect(unknown.reply).toMatch(/try/);
  });

  it('is deterministic', () => {
    expect(parseIntent('make it rain', world)).toEqual(parseIntent('make it rain', world));
  });

  it('gives a line for tool calls that came without text', () => {
    expect(replyForCalls(parseIntent('rain', world).calls)).toMatch(/rain/i);
  });
});

describe('asking for what is already there', () => {
  it('says so instead of "I can\'t do that"', () => {
    const grassy = after('grass');
    const again = parseIntent('grass', grassy);
    expect(again.calls).toHaveLength(0);
    expect(again.reply).not.toMatch(/can't do that/);
  });
});
