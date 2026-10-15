// The 3D world as data. One world-state object is the single source of truth:
// the renderer only ever draws it, and the only way to change it is a tool call
// (see tools.ts and reducer.ts). Everything here is shared by the browser and
// the Worker, so both validate and clamp in exactly the same way.
//
// Every number is clamped instead of rejected: a model asking for wind of 50
// gets the strongest wind there is, not an error.
import { z } from 'zod';

export const GROUND_PRESETS = ['plain', 'grass', 'flowers', 'sand', 'snow', 'water'] as const;
export const TIMES_OF_DAY = ['dawn', 'day', 'golden', 'dusk', 'night'] as const;
export const WEATHER_KINDS = ['none', 'rain', 'snow', 'fireflies', 'petals', 'dandelion'] as const;

export type GroundPreset = (typeof GROUND_PRESETS)[number];
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/** The allowed range of every number in the world. */
export const LIMITS = {
  height: [0.1, 1.5], // grass blade height, metres
  density: [0, 1], // share of the blades (or flowers) drawn
  amplitude: [0, 1.2], // how far the wind bends a blade
  wavelength: [2, 40], // metres between two gusts
  speed: [0, 6], // how fast gusts travel
  gustiness: [0, 1], // how much noise breaks up the bands
  clouds: [0, 1],
  intensity: [0, 1],
  gravity: [0.1, 2], // times Earth's
} as const satisfies Record<string, readonly [number, number]>;

export const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value));

/** A number that is clamped into its range; anything that is not a finite number is refused. */
const clamped = (range: readonly [number, number]) => z.number().transform((value) => clamp(value, range));

const HEX = /^#[0-9a-f]{6}$/i;
/** A #rrggbb colour. Anything else is dropped, so the preset's own colour is used. */
const colour = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => (value && HEX.test(value) ? value.toLowerCase() : undefined));

/** A horizontal direction [x, z], always of length 1 (a zero vector becomes +x). */
const direction = z
  .tuple([z.number(), z.number()])
  .transform(([x, z]): [number, number] => {
    const length = Math.hypot(x, z);
    return length > 1e-6 ? [round(x / length), round(z / length)] : [1, 0];
  });

const round = (value: number) => Math.round(value * 1000) / 1000;

export const windSchema = z.object({
  dir: direction,
  amplitude: clamped(LIMITS.amplitude),
  wavelength: clamped(LIMITS.wavelength),
  speed: clamped(LIMITS.speed),
  gustiness: clamped(LIMITS.gustiness),
});
export type Wind = z.output<typeof windSchema>;

export const DEFAULT_WIND: Wind = { dir: [0.958, 0.287], amplitude: 0.35, wavelength: 9, speed: 1.6, gustiness: 0.35 };

/** Height and density each preset starts with when the visitor switches to it. */
export const PRESET_DEFAULTS: Record<GroundPreset, { height: number; density: number }> = {
  plain: { height: 0.6, density: 0 },
  grass: { height: 0.7, density: 1 },
  flowers: { height: 0.45, density: 0.85 },
  sand: { height: 0.3, density: 0 },
  snow: { height: 0.3, density: 0 },
  water: { height: 0.3, density: 0 },
};

const groundParamsSchema = z.object({
  height: clamped(LIMITS.height),
  density: clamped(LIMITS.density),
  colorBase: colour,
  colorTip: colour,
  wind: windSchema,
});

const objectSchema = z.object({
  id: z.string().min(1).max(64),
  // TODO(tier 2): narrow to the asset library's kinds once it exists.
  kind: z.string().min(1).max(32),
  transform: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    rotation: z.tuple([z.number(), z.number(), z.number()]),
    scale: clamped([0.05, 20]),
  }),
  // TODO(tier 2/3): behaviours beyond these simple loops.
  behaviour: z.enum(['static', 'bob', 'spin']).default('static'),
});
export type WorldObject = z.output<typeof objectSchema>;

export const worldStateSchema = z.object({
  version: z.literal(1),
  ground: z.object({ preset: z.enum(GROUND_PRESETS), params: groundParamsSchema }),
  // 'auto' follows the site's day/night switch: a warm afternoon by day, moonlight by night.
  sky: z.object({ timeOfDay: z.enum([...TIMES_OF_DAY, 'auto']), clouds: clamped(LIMITS.clouds) }),
  weather: z.object({ kind: z.enum(WEATHER_KINDS), intensity: clamped(LIMITS.intensity) }),
  physics: z.object({ gravity: clamped(LIMITS.gravity) }),
  objects: z.array(objectSchema).max(64),
});
export type WorldState = z.output<typeof worldStateSchema>;

export function defaultWorld(): WorldState {
  return {
    version: 1,
    ground: { preset: 'plain', params: { ...PRESET_DEFAULTS.plain, colorBase: undefined, colorTip: undefined, wind: { ...DEFAULT_WIND } } },
    sky: { timeOfDay: 'auto', clouds: 0 },
    weather: { kind: 'none', intensity: 0 },
    physics: { gravity: 1 },
    objects: [],
  };
}

/** Read a world saved earlier (or sent by a browser). Anything malformed gives null. */
export function parseWorld(value: unknown): WorldState | null {
  const result = worldStateSchema.safeParse(value);
  return result.success ? result.data : null;
}

// ---- Tools: the only way the world changes ----

const windPatch = z
  .object({
    dir: direction.optional(),
    amplitude: clamped(LIMITS.amplitude).optional(),
    wavelength: clamped(LIMITS.wavelength).optional(),
    speed: clamped(LIMITS.speed).optional(),
    gustiness: clamped(LIMITS.gustiness).optional(),
  })
  .strip();

export const toolArgSchemas = {
  setGround: z
    .object({
      preset: z.enum(GROUND_PRESETS),
      height: clamped(LIMITS.height).optional(),
      density: clamped(LIMITS.density).optional(),
      colorBase: colour,
      colorTip: colour,
      wind: windPatch.optional(),
    })
    .strip(),
  setSky: z
    .object({
      timeOfDay: z.enum(TIMES_OF_DAY).optional(),
      clouds: clamped(LIMITS.clouds).optional(),
    })
    .strip()
    .refine((args) => args.timeOfDay !== undefined || args.clouds !== undefined, 'nothing to change'),
  setWeather: z
    .object({
      kind: z.enum(WEATHER_KINDS),
      intensity: clamped(LIMITS.intensity).optional(),
    })
    .strip(),
  setGravity: z.object({ scale: clamped(LIMITS.gravity) }).strip(),
  resetWorld: z.object({}).strip(),
} as const;

export type ToolName = keyof typeof toolArgSchemas;
export const TOOL_NAMES = Object.keys(toolArgSchemas) as ToolName[];

export type ToolCall = {
  [K in ToolName]: { name: K; args: z.output<(typeof toolArgSchemas)[K]> };
}[ToolName];

/** Validate one tool call from the model (or the fallback parser). Unknown or malformed calls give null. */
export function parseToolCall(name: unknown, args: unknown): ToolCall | null {
  if (typeof name !== 'string' || !Object.hasOwn(toolArgSchemas, name)) return null;
  const schema = toolArgSchemas[name as ToolName];
  const result = schema.safeParse(args ?? {});
  return result.success ? ({ name, args: result.data } as ToolCall) : null;
}
