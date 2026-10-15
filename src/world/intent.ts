// The fallback for when the real Pixel Amir can't answer (no API key, rate
// limited, offline): a small keyword parser that turns a prompt into the same
// tool calls the model would make, plus a short canned reply in Amir's voice.
// The whole world can be shown off with this alone.
import { clamp, LIMITS, parseToolCall, PRESET_DEFAULTS, type GroundPreset, type TimeOfDay, type ToolCall, type WeatherKind, type WorldState } from './schema';

export interface Intent {
  calls: ToolCall[];
  reply: string;
}

type Wind = WorldState['ground']['params']['wind'];

const has = (text: string, pattern: RegExp) => pattern.test(text);

// Replies are picked from these by the prompt itself, so the same prompt always gets the same line.
const REPLIES = {
  grass: ['Grass time!!🌱', 'Okii watch this🌿', 'Meadow incoming!!'],
  flowers: ['Flowers everywhere!!🌼', 'Sooo pretty🥹'],
  sand: ['Beach vibes!!🏖️', 'Sand everywhere ahahah'],
  snow: ['Winter mode!!❄️', 'Brrr it got cold🥶'],
  water: ['Water!! dont fall in ahahah🌊', 'Okii now we walk on water'],
  plain: ['Back to the flat floor', 'Clean slate!!'],
  windy: ['Hold on to something!!🌬️', 'Windyyy'],
  storm: ['STORM MODE😭', 'Okii this is a lot of wind ahahah'],
  calm: ['Okii calming it down', 'Nice and gentle now🫶🏻'],
  tall: ['Taller grass!!', 'It keeps growinggg🌾'],
  short: ['Mowed it a bit ahahah', 'Shorter now'],
  dawn: ['Good morning!!🌅'],
  day: ['Sunny afternoon!!☀️'],
  golden: ['Golden hour, my favourite🥹'],
  dusk: ['Sunset time🌇'],
  night: ['Night mode🌙', 'Look at the stars!!'],
  cloudy: ['More clouds!!☁️'],
  clear: ['Clear skies!!'],
  rain: ['Rain!! I hope u brought an umbrella☔', 'Okii making it rain'],
  fireflies: ['Fireflies!!✨', 'Sooo pretty at night🥹'],
  petals: ['Petals!!🌸', 'Spring in Japan vibes🌸'],
  dandelion: ['Make a wish!!', 'Dandelion fluff everywhere ahahah'],
  noWeather: ['Okii stopping it'],
  lowGravity: ['Try jumping now!!🚀', 'Moon jumps ahahah'],
  highGravity: ['Heavy mode😭'],
  normalGravity: ['Back to normal gravity'],
  reset: ['Back to the start!!', 'Okii fresh world'],
  already: ['Already done!! look around🌿', 'Its already like that ahahah'],
  unknown: [
    "Hmm I can't do that one yet🙏🏻 try 'grass', 'make it rain' or 'night with fireflies'",
    "I only know a few spells rn ahahah try 'golden hour' or 'low gravity'",
  ],
} as const;

function pick(key: keyof typeof REPLIES, seed: number): string {
  const options = REPLIES[key];
  return options[seed % options.length];
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function parseIntent(prompt: string, state: WorldState): Intent {
  const text = prompt.toLowerCase();
  const seed = hash(text);
  const calls: ToolCall[] = [];
  const replies: (keyof typeof REPLIES)[] = [];
  const push = (name: string, args: unknown) => {
    const call = parseToolCall(name, args);
    if (call) calls.push(call);
  };

  if (has(text, /\b(reset|start over|restart|from scratch|clear (it|everything|the world))\b|сброс|заново/)) {
    push('resetWorld', {});
    return { calls, reply: pick('reset', seed) };
  }

  // Ground. Water and the others win over grass when both are named ("grass by the water" stays grass).
  let preset: GroundPreset | null = null;
  if (has(text, /\b(flowers?|blossoms?|bloom|wildflowers?)\b|цвет/) && !has(text, /cherry|sakura/)) preset = 'flowers';
  else if (has(text, /\b(grass|grassy|meadow|field|lawn)\b|трав|луг/)) preset = 'grass';
  else if (has(text, /\b(sand|sandy|beach|desert|dunes?)\b|песок|пляж/)) preset = 'sand';
  else if (has(text, /\b(winter|snowy|snow (ground|floor|field)|cover(ed)? in snow)\b/)) preset = 'snow';
  else if (has(text, /\b(water|ocean|sea|lake|pond)\b|вод|море/)) preset = 'water';
  else if (has(text, /\b(plain|flat|empty|bare)\b/)) preset = 'plain';

  const current = state.ground.params;
  const groundArgs: { preset: GroundPreset; height?: number; density?: number; wind?: Partial<Wind> } = {
    preset: preset ?? state.ground.preset,
  };
  let groundChanged = preset !== null && preset !== state.ground.preset;
  if (preset) replies.push(preset);
  if (preset === 'grass' && has(text, /cinematic|epic|beautiful|lush/)) {
    groundArgs.height = 0.85;
    groundArgs.wind = { amplitude: 0.45, wavelength: 11, gustiness: 0.4 };
    groundChanged = true;
  }

  // Wind: storm > windy > calm.
  if (has(text, /\b(storm|stormy|gale|hurricane|typhoon)\b|шторм|буря/)) {
    groundArgs.wind = { amplitude: 1.05, speed: 3.6, gustiness: 0.9, wavelength: 7 };
    replies.push('storm');
  } else if (has(text, /\b(wind|windy|windier|breeze|breezy|gusts?|gusty)\b|ветер|ветр/) && !has(text, /\b(no|stop|less)\b/)) {
    groundArgs.wind = {
      amplitude: clamp(Math.max(0.65, current.wind.amplitude * 1.6), LIMITS.amplitude),
      speed: clamp(Math.max(2.4, current.wind.speed), LIMITS.speed),
      gustiness: 0.6,
    };
    replies.push('windy');
  } else if (has(text, /\b(calm|calmer|still|gentle|gentler|quiet|less wind|no wind|stop the wind)\b|тише|спокойн/)) {
    const still = has(text, /\b(still|no wind|stop the wind)\b/);
    groundArgs.wind = {
      amplitude: still ? 0.04 : clamp(current.wind.amplitude * 0.45, LIMITS.amplitude),
      speed: clamp(current.wind.speed * 0.7, LIMITS.speed),
      gustiness: clamp(current.wind.gustiness * 0.5, LIMITS.gustiness),
    };
    replies.push('calm');
  }
  if (groundArgs.wind) groundChanged = true;

  // Grass height and thickness.
  if (has(text, /\b(taller|tall|longer|higher grass|grow)\b/)) {
    const from = preset && preset !== state.ground.preset ? PRESET_DEFAULTS[preset].height : current.height;
    groundArgs.height = clamp(from * 1.5, LIMITS.height);
    groundChanged = true;
    replies.push('tall');
  } else if (has(text, /\b(shorter|short|mow|trim|cut)\b/)) {
    const from = preset && preset !== state.ground.preset ? PRESET_DEFAULTS[preset].height : current.height;
    groundArgs.height = clamp(from * 0.6, LIMITS.height);
    groundChanged = true;
    replies.push('short');
  }
  if (has(text, /\b(denser|thicker|more grass|lusher)\b/)) {
    groundArgs.density = 1;
    groundChanged = true;
  } else if (has(text, /\b(sparser|thinner|less grass)\b/)) {
    groundArgs.density = clamp(current.density * 0.5, LIMITS.density);
    groundChanged = true;
  }
  if (groundChanged) push('setGround', groundArgs);

  // Sky.
  let timeOfDay: TimeOfDay | null = null;
  if (has(text, /golden( hour)?|magic hour/)) timeOfDay = 'golden';
  else if (has(text, /\b(dawn|sunrise|morning)\b|утро|рассвет/)) timeOfDay = 'dawn';
  else if (has(text, /\b(dusk|sunset|evening|twilight)\b|закат|вечер/)) timeOfDay = 'dusk';
  else if (has(text, /\b(night|nighttime|midnight|moon|moonlit|stars|starry|dark)\b|ночь/) && !has(text, /moon gravity/)) timeOfDay = 'night';
  else if (has(text, /\b(day|daytime|noon|midday|afternoon|sunny)\b|день/)) timeOfDay = 'day';
  let clouds: number | undefined;
  if (has(text, /\b(cloudy|clouds|overcast|more clouds)\b|облак/) && !has(text, /\bno clouds\b/)) clouds = 0.85;
  else if (has(text, /\b(clear sky|clear skies|no clouds|cloudless)\b/)) clouds = 0.1;
  if (has(text, /\b(storm|stormy)\b/)) clouds = 0.95;
  if (has(text, /cinematic/) && clouds === undefined && state.sky.clouds < 0.4) clouds = 0.55;
  if (timeOfDay || clouds !== undefined) {
    push('setSky', { timeOfDay: timeOfDay ?? undefined, clouds });
    if (timeOfDay) replies.push(timeOfDay);
    else replies.push(clouds! > 0.5 ? 'cloudy' : 'clear');
  }

  // Weather.
  let weather: WeatherKind | null = null;
  let intensity: number | undefined;
  if (has(text, /\b(no rain|stop (the )?(rain|snow|weather)|clear weather|no weather)\b/)) weather = 'none';
  else if (has(text, /\b(rain|rainy|raining|drizzle|downpour|storm|stormy)\b|дожд/)) {
    weather = 'rain';
    intensity = has(text, /drizzle|light/) ? 0.3 : has(text, /storm|downpour|heavy/) ? 0.95 : 0.6;
  } else if (has(text, /\b(snow|snowing|snowfall|snowflakes|winter|snowy)\b|снег/)) {
    weather = 'snow';
    intensity = has(text, /blizzard|heavy/) ? 1 : 0.6;
  } else if (has(text, /fireflies|firefly|светлячк/)) weather = 'fireflies';
  else if (has(text, /\b(petals?|sakura|cherry)\b|сакур/)) weather = 'petals';
  else if (has(text, /dandelions?|seeds|fluff|одуванч/)) weather = 'dandelion';
  if (weather) {
    push('setWeather', { kind: weather, intensity });
    replies.push(weather === 'none' ? 'noWeather' : weather);
  }

  // Gravity.
  if (has(text, /\b(zero gravity|no gravity)\b/)) push('setGravity', { scale: 0.1 });
  else if (has(text, /\b(low|lower|less|moon|light|floaty) gravity\b|\bfloat(y)?\b|гравитац/)) push('setGravity', { scale: 0.3 });
  else if (has(text, /\b(high|higher|heavy|more|strong) gravity\b/)) push('setGravity', { scale: 1.8 });
  else if (has(text, /\bnormal gravity\b/)) push('setGravity', { scale: 1 });
  const gravity = calls.find((call) => call.name === 'setGravity');
  if (gravity?.name === 'setGravity') replies.push(gravity.args.scale < 1 ? 'lowGravity' : gravity.args.scale > 1 ? 'highGravity' : 'normalGravity');

  // Asked for what's already there: say so, instead of claiming not to know it.
  if (!calls.length) return { calls, reply: replies.length ? pick('already', seed) : pick('unknown', seed) };
  // Two short lines at most, like his texts.
  const unique = [...new Set(replies)].slice(0, 2);
  return { calls, reply: unique.map((key) => pick(key, seed)).join('\n') };
}

/** A short line for when the model changed the world but said nothing. */
export function replyForCalls(calls: ToolCall[]): string {
  const first = calls[0];
  if (!first) return pick('unknown', 0);
  switch (first.name) {
    case 'setGround':
      return pick(first.args.preset, 0);
    case 'setSky':
      return first.args.timeOfDay ? pick(first.args.timeOfDay, 0) : pick('cloudy', 0);
    case 'setWeather':
      return pick(first.args.kind === 'none' ? 'noWeather' : first.args.kind, 0);
    case 'setGravity':
      return pick(first.args.scale < 1 ? 'lowGravity' : first.args.scale > 1 ? 'highGravity' : 'normalGravity', 0);
    case 'resetWorld':
      return pick('reset', 0);
  }
}
