// The tools Pixel Amir can call in the 3D world, described for Gemini's function
// calling. Gemini only ever gets to *ask* for one of these; the Worker and the
// browser both validate and clamp what it asks for (schema.ts) before anything
// changes, and no model output ever runs as code on the page.
import { GROUND_PRESETS, LIMITS, TIMES_OF_DAY, WEATHER_KINDS, type WorldState } from './schema';

const range = ([min, max]: readonly [number, number], what: string) => ({
  type: 'number',
  minimum: min,
  maximum: max,
  description: `${what} (${min} to ${max}).`,
});

export const functionDeclarations = [
  {
    name: 'setGround',
    description:
      'Change the ground under everyone\'s feet. "grass" is a tall wind-swept meadow, "flowers" a shorter meadow full of flowers, "plain" the empty starting floor. Wind only shows on grass and flowers.',
    parameters: {
      type: 'object',
      properties: {
        preset: { type: 'string', enum: [...GROUND_PRESETS] },
        height: range(LIMITS.height, 'Grass height in metres'),
        density: range(LIMITS.density, 'How thick the grass is'),
        colorBase: { type: 'string', description: 'Colour at the root of each blade, as #rrggbb. Leave out for the natural green.' },
        colorTip: { type: 'string', description: 'Colour at the tip of each blade, as #rrggbb. Leave out for the natural green.' },
        wind: {
          type: 'object',
          description: 'Wind, as gusts that roll across the field in bands. Only the fields given change.',
          properties: {
            dir: { type: 'array', items: { type: 'number' }, description: 'Direction [x, z] the wind blows towards.' },
            amplitude: range(LIMITS.amplitude, 'How far the blades bend: 0.05 still, 0.35 a breeze, 1 a storm'),
            wavelength: range(LIMITS.wavelength, 'Metres between gusts'),
            speed: range(LIMITS.speed, 'How fast the gusts travel'),
            gustiness: range(LIMITS.gustiness, 'How broken up and random the gusts are'),
          },
        },
      },
      required: ['preset'],
    },
  },
  {
    name: 'setSky',
    description: 'Change the time of day and how cloudy the sky is.',
    parameters: {
      type: 'object',
      properties: {
        timeOfDay: { type: 'string', enum: [...TIMES_OF_DAY] },
        clouds: range(LIMITS.clouds, 'Cloud cover'),
      },
    },
  },
  {
    name: 'setWeather',
    description: 'Change what floats or falls through the air. "none" clears it.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...WEATHER_KINDS] },
        intensity: range(LIMITS.intensity, 'How much of it'),
      },
      required: ['kind'],
    },
  },
  {
    name: 'setGravity',
    description: 'Change gravity, as a multiple of Earth\'s. Low gravity means floaty moon jumps.',
    parameters: { type: 'object', properties: { scale: range(LIMITS.gravity, 'Gravity') }, required: ['scale'] },
  },
  {
    name: 'resetWorld',
    description: 'Put the world back to the empty starting floor.',
    parameters: { type: 'object', properties: {} },
  },
];

/** What Pixel Amir is told about the world, added after his usual system prompt. */
export function worldPrompt(world: WorldState): string {
  return `
THE 3D WORLD
Right now you are not in the corner of the page: the visitor walked into your little 3D world on amirassyl.dev, and you're standing in it with them. You have god powers here: you change the world only by calling the tools (setGround, setSky, setWeather, setGravity, resetWorld).
- When the visitor asks for a change, call the tools that make it, then say one short line about it in your usual voice. Several tools in one go is fine ("stormy night" = setGround wind + setSky + setWeather).
- "Make it windier" or "calmer" means changing the wind on the current ground preset.
- When they're just chatting, answer without tools.
- You can't build objects, houses or creatures yet; say that's coming soon.
- Never write code. Never describe tool calls in text.
The world right now (JSON): ${JSON.stringify(world)}
`;
}
