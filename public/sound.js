// Sound: small synthesized sounds for Pixel Amir and the page's interactive touches.
// Everything is made in the browser with Web Audio, so there are no audio files to download.
// It starts muted. The speaker in the top-right corner turns it on, and the choice is
// remembered on this device. Other scripts call window.sound.play(name) or
// window.sound.talk(letter); both do nothing while muted.
//
// Voices: Pixel Amir is bubble pops (talk, open, reply, error); the chat's own UI and
// the day/night switch are foley (dots, send, close, dark, light); the dots
// gathering into the portrait are a smooth "glass" whoosh. The name ripple is silent on purpose.
(() => {
  const KEY = 'sound';
  const VOLUME = 0.7;
  const root = document.documentElement;

  let on = false;
  try {
    on = localStorage.getItem(KEY) === 'on';
  } catch {
    // storage blocked: start muted every visit
  }

  let ctx;
  let master;
  let fx;
  let noiseBuffer;

  // Browsers only let audio start after a tap or key press, so the context is made
  // on demand and resumed by the first one.
  function ensure() {
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      ctx = new Context();
      const compressor = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      // A soft echo for the glass sounds: a feedback delay that darkens as it repeats.
      fx = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.19;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      const darken = ctx.createBiquadFilter();
      darken.type = 'lowpass';
      darken.frequency.value = 3200;
      fx.connect(delay);
      delay.connect(darken);
      darken.connect(feedback);
      feedback.connect(delay);
      darken.connect(master);
      ctx.addEventListener('statechange', () => {
        if (ctx.state === 'running') for (const type of UNLOCK) removeEventListener(type, unlock, true);
      });
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  const UNLOCK = ['pointerdown', 'keydown', 'touchend'];
  function unlock() {
    if (on) ensure();
  }
  for (const type of UNLOCK) addEventListener(type, unlock, { capture: true, passive: true });

  const ready = () => on && ensure() !== null && ctx.state === 'running';
  const semi = (n) => Math.pow(2, n / 12);

  function env(gain, t, attack, decay, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function echo(gain, amount) {
    if (!amount) return;
    const send = ctx.createGain();
    send.gain.value = amount;
    gain.connect(send);
    send.connect(fx);
  }

  function tone({ t = 0, f, f2, dur = 0.1, peak = 0.25, attack = 0.004, lp, detune = 0, wet = 0 }) {
    const t0 = ctx.currentTime + t + 0.01;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f, t0);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + attack + dur);
    osc.detune.value = detune;
    const gain = ctx.createGain();
    env(gain, t0, attack, dur, peak);
    let last = osc;
    if (lp) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lp;
      osc.connect(filter);
      last = filter;
    }
    last.connect(gain);
    gain.connect(master);
    echo(gain, wet);
    osc.start(t0);
    osc.stop(t0 + attack + dur + 0.05);
  }

  function noise({ t = 0, dur = 0.05, peak = 0.25, type = 'bandpass', f = 2000, f2, q = 1, attack = 0.002, bumps = 0, wet = 0 }) {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + t + 0.01;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f, t0);
    if (f2) filter.frequency.exponentialRampToValueAtTime(f2, t0 + attack + dur);
    filter.Q.value = q;
    const gain = ctx.createGain();
    if (bumps) {
      // A rustle: several uneven bumps of volume.
      gain.gain.setValueAtTime(0.0001, t0);
      for (let i = 0; i < bumps; i++) {
        const at = t0 + (dur * i) / bumps;
        gain.gain.linearRampToValueAtTime(peak * (0.35 + Math.random() * 0.65), at + 0.006);
        gain.gain.linearRampToValueAtTime(peak * 0.08, at + (dur / bumps) * 0.8);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else {
      env(gain, t0, attack, dur, peak);
    }
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    echo(gain, wet);
    source.start(t0, Math.random() * 0.5);
    source.stop(t0 + attack + dur + 0.05);
  }

  // A rounded pop whose pitch rises as it fades.
  const pop = (f, t = 0, peak = 0.26, dur = 0.08) => tone({ t, f: f * 0.55, f2: f * 1.25, dur, peak, attack: 0.002 });
  const bell = (f, t = 0, peak = 0.14) => {
    tone({ t, f, dur: 0.45, peak });
    tone({ t, f: f * 2.01, dur: 0.25, peak: peak * 0.3 });
  };
  const tick = (t = 0, peak = 0.12) => {
    noise({ t, dur: 0.014, peak, type: 'highpass', f: 4200 });
    tone({ t, f: 2300, dur: 0.012, peak: peak * 0.5 });
  };
  const wood = (f, t = 0, peak = 0.25, dur = 0.09) => {
    tone({ t, f, f2: f * 0.6, dur, peak, attack: 0.001 });
    noise({ t, dur: 0.02, peak: peak * 0.6, f: f * 6, q: 2 });
  };

  // The typing-dots ticks wait on timers, so they can be dropped when Pixel Amir starts to talk.
  let dotTimers = [];
  function cancelDots() {
    dotTimers.forEach(clearTimeout);
    dotTimers = [];
  }

  const SOUNDS = {
    // Pixel Amir: bubble pops.
    open() {
      pop(500);
      pop(750, 0.09);
    },
    reply() {
      bell(988);
      bell(1319, 0.11);
    },
    error() {
      pop(260, 0, 0.3, 0.12);
      pop(220, 0.14, 0.3, 0.14);
    },
    // The chat's own UI and the day/night switch: foley.
    // Three ticks, started a beat after the send sound. Pixel Amir's first letter or his reply cancels the rest.
    dots() {
      cancelDots();
      for (const ms of [320, 460, 600]) {
        dotTimers.push(setTimeout(() => {
          if (ready()) tick(0, 0.09);
        }, ms));
      }
    },
    send() {
      wood(220, 0, 0.26, 0.1);
      noise({ t: 0.02, dur: 0.1, peak: 0.08, f: 3500, q: 0.8, bumps: 2 });
    },
    close() {
      wood(160, 0, 0.26, 0.1);
      noise({ t: 0.03, dur: 0.12, peak: 0.07, f: 1800, q: 0.8, bumps: 3 });
    },
    dark() {
      tick(0, 0.16);
      wood(120, 0.02, 0.25, 0.14);
    },
    light() {
      tick(0, 0.16);
      wood(240, 0.02, 0.2, 0.1);
    },
    // Glass: air rushes inward as the portrait forms. Just the whoosh, with no chime at the end.
    gather() {
      noise({ f: 6000, f2: 900, q: 4, dur: 0.7, attack: 0.25, peak: 0.07, wet: 0.3 });
      tone({ f: 180, f2: 540, dur: 0.6, attack: 0.2, peak: 0.08, lp: 1400 });
    },
    // Confirms the speaker was switched on: one short, soft rising blip.
    on() {
      tone({ f: 740, f2: 880, dur: 0.12, peak: 0.04, attack: 0.012, lp: 2000 });
    },
  };

  // Shortest time between two plays of the same sound, so hovering back and forth never machine-guns.
  const MIN_GAP = { gather: 900 };
  // Sounds that mean the chat is no longer waiting, so the typing ticks stop.
  const ENDS_WAIT = new Set(['open', 'reply', 'error', 'close']);
  const lastPlayed = {};
  const since = (name) => performance.now() - (lastPlayed[name] ?? -1e9);

  function play(name) {
    const sound = SOUNDS[name];
    if (!sound || !ready()) return;
    if (since(name) < (MIN_GAP[name] ?? 0)) return;
    lastPlayed[name] = performance.now();
    if (ENDS_WAIT.has(name)) cancelDots();
    sound();
  }

  // While Pixel Amir types, one soft pop for every handful of letters. The note comes from the letter.
  const PENTATONIC = [0, 2, 4, 7, 9];
  function talk(letter) {
    if (!letter || !/\p{L}/u.test(letter) || !ready() || since('talk') < 90) return;
    lastPlayed.talk = performance.now();
    cancelDots();
    const code = letter.toLowerCase().codePointAt(0);
    pop(520 * semi(PENTATONIC[code % 5] + 12 * ((code >> 2) % 2)), 0, 0.12, 0.06);
  }

  window.sound = { play, talk };

  // The speaker button in the corner.
  function paint() {
    root.dataset.sound = on ? 'on' : 'off';
    const button = document.querySelector('.sound-toggle');
    if (!button) return;
    button.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    button.setAttribute('aria-pressed', String(on));
  }
  paint();

  document.querySelector('.sound-toggle')?.addEventListener('click', () => {
    on = !on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      // storage blocked: it still works for this page
    }
    paint();
    // Made inside the tap, so the browser allows it; the chime tells them it worked.
    if (on && ensure()) ctx.resume().then(() => play('on')).catch(() => {});
  });
})();
