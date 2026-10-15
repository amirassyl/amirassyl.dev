// Turns one validated tool call into the next world state. Pure: it never
// changes the state it is given, so the renderer can compare old and new and
// animate the difference.
import { defaultWorld, PRESET_DEFAULTS, type ToolCall, type WorldState } from './schema';

export function applyTool(state: WorldState, call: ToolCall): WorldState {
  switch (call.name) {
    case 'setGround': {
      const { preset, height, density, colorBase, colorTip, wind } = call.args;
      const switching = preset !== state.ground.preset;
      // A new preset starts from its own height and density; the wind is the world's and carries over.
      const base = switching ? { ...state.ground.params, ...PRESET_DEFAULTS[preset], colorBase: undefined, colorTip: undefined } : state.ground.params;
      const nextWind = { ...state.ground.params.wind };
      for (const [key, value] of Object.entries(wind ?? {})) {
        if (value !== undefined) Object.assign(nextWind, { [key]: value });
      }
      return {
        ...state,
        ground: {
          preset,
          params: {
            ...base,
            height: height ?? base.height,
            density: density ?? base.density,
            colorBase: colorBase ?? base.colorBase,
            colorTip: colorTip ?? base.colorTip,
            wind: nextWind,
          },
        },
      };
    }
    case 'setSky':
      return {
        ...state,
        sky: { timeOfDay: call.args.timeOfDay ?? state.sky.timeOfDay, clouds: call.args.clouds ?? state.sky.clouds },
      };
    case 'setWeather': {
      const { kind } = call.args;
      const intensity = kind === 'none' ? 0 : (call.args.intensity ?? (state.weather.kind === kind ? state.weather.intensity : 0.6));
      return { ...state, weather: { kind, intensity } };
    }
    case 'setGravity':
      return { ...state, physics: { gravity: call.args.scale } };
    case 'resetWorld':
      return defaultWorld();
  }
}

export function applyTools(state: WorldState, calls: ToolCall[]): WorldState {
  return calls.reduce(applyTool, state);
}
