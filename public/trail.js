// Cursor companions: a few flat dots that hover around the pointer on springs.
// Each dot is pulled toward its own spot near the cursor, overshoots a little
// when the cursor moves, and keeps drifting gently once the cursor is still.
// Self-contained: creates its own full-screen canvas and needs no markup or CSS.
//
// The spring-and-resistance approach follows the classic "elastic bullets"
// cursor (see springyEmojiCursor in github.com/tholman/cursor-effects), with a
// separate resting spot per dot instead of a chain.
(() => {
  // The photo's address is passed in on this script's own tag, so it carries a version.
  const portraitUrl = document.currentScript ? document.currentScript.dataset.portrait : null;
  const COLORS = ['#F2AF29', '#3B82F6', '#FF4D4D', '#FFB703', '#4ADE80']; // marigold, blue, red, amber, green
  const COUNT = [5, 10]; // how many dots: a random whole number in this range, picked on each page load
  const MIN_RADIUS = 3.5;
  const MAX_RADIUS = 6;
  const MIN_DISTANCE = 14; // px from the pointer, so no dot sits under it
  const MAX_DISTANCE = 30;
  const STIFFNESS = [170, 250]; // spring pull; higher follows the cursor more tightly
  const DAMPING = [10, 15]; // resistance; lower is bouncier; higher values reduce post-movement wobble
  const DRIFT = 2; // px each dot wanders around its spot while the cursor is still
  const DRIFT_SPEED = [0.5, 1.1]; // wander cycles, in radians per second
  const ORBIT_SPEED = 0.12; // slow rotation of the whole group, radians per second
  const REPEL_STRENGTH = 30000; // how hard nearby dots push each other apart; 0 turns it off
  const REPEL_REACH = 14; // px beyond touching at which two dots start to feel each other
  const TEXT_OPACITY = 0.45; // dot strength while the pointer is over text (1 = no change)
  const TEXT_MARGIN = 6; // px around a letter that still counts as being over text
  const FADE_SPEED = 10; // how fast the dots appear and disappear, per second

  // Over a place name (an element with data-place) the dots turn into that place's emoji.
  // `colors` is the fallback where the emoji cannot be drawn in colour: Windows shows
  // flag emoji as two letters, so there the dots just take the flag's colours.
  const PLACES = {
    kz: { emoji: '🇰🇿', colors: ['#00AFCA', '#FEC50C'] },
    jp: { emoji: '🇯🇵', colors: ['#BC002D'] },
    sf: { emoji: '🌉', colors: ['#C0362C'] },
  };
  const EMOJI_SIZE = 20; // px
  const PLACE_COUNT = 3; // how many dots stay, as emoji, over a place name; the rest tuck away
  const PLACE_SPREAD = 1.9; // how much further from the cursor they sit there (1 = no change)
  const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const MORPH_SPEED = 9; // how fast a dot turns into an emoji and back, per second

  // Over the name (an element with data-me) the dots gather into one round photo.
  const PORTRAIT_RADIUS = 34; // px
  const PORTRAIT_DISTANCE = 76; // px from the cursor to the photo's centre
  const PORTRAIT_ANGLE = -0.95; // radians; negative is up and to the right, clear of the name and the text below

  // Nothing for people who ask for less motion, or on devices without a mouse.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9999',
  });
  // Mix with the page so text stays readable through a dot: like ink on the
  // light page, like light on the dark one. Follows the day/night switch.
  const root = document.documentElement;
  // A photo is drawn as it is, without mixing, so `plain` switches the mixing off while one shows.
  let plain = false;
  const blend = () => {
    canvas.style.mixBlendMode = plain ? 'normal' : root.dataset.theme === 'dark' ? 'screen' : 'multiply';
  };
  blend();
  new MutationObserver(blend).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const random = (min, max) => min + Math.random() * (max - min);
  const pointer = { x: 0, y: 0, inside: false, seen: false, pressed: false, overText: false, overMedia: false, place: null, me: false };

  // Does this browser draw the emoji as a colour picture? Draw it small and look for coloured pixels.
  function drawsInColour(emoji) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 32;
    const pen = probe.getContext('2d', { willReadFrequently: true });
    if (!pen) return false;
    pen.font = `24px ${EMOJI_FONT}`;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillStyle = '#000';
    pen.fillText(emoji, 16, 16);
    const pixels = pen.getImageData(0, 0, 32, 32).data;
    for (let i = 0; i < pixels.length; i += 4) {
      const spread = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (pixels[i + 3] > 60 && spread > 50) return true;
    }
    return false;
  }
  for (const place of Object.values(PLACES)) place.asEmoji = drawsInColour(place.emoji);
  const portrait = new Image();
  let portraitReady = false;
  if (portraitUrl) {
    portrait.onload = () => {
      portraitReady = true;
    };
    portrait.src = portraitUrl;
  }
  let face = 0; // 0 = plain dots, 1 = the photo fully shown
  let shownPlace = null; // the place whose emoji is on screen, kept while it morphs back
  let morph = 0; // 0 = plain dots, 1 = fully emoji
  // Dots show while the pointer is on the page and the mouse button is up,
  // so they get out of the way while text is being selected. They also stay
  // off video tiles and the video player.
  const visible = () => pointer.inside && !pointer.pressed && !pointer.overMedia;

  // Is there a letter under (or right next to) this point? Asks the browser which
  // character a click here would land on, then checks the point is really on it.
  function isOverText(x, y) {
    let node;
    let offset;
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(x, y);
      if (!position) return false;
      node = position.offsetNode;
      offset = position.offset;
    } else if (document.caretRangeFromPoint) {
      const caret = document.caretRangeFromPoint(x, y);
      if (!caret) return false;
      node = caret.startContainer;
      offset = caret.startOffset;
    }
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;

    const range = document.createRange();
    range.setStart(node, Math.max(0, offset - 1));
    range.setEnd(node, Math.min(node.length, offset + 1));
    for (const box of range.getClientRects()) {
      if (
        x >= box.left - TEXT_MARGIN &&
        x <= box.right + TEXT_MARGIN &&
        y >= box.top - TEXT_MARGIN &&
        y <= box.bottom + TEXT_MARGIN
      ) {
        return true;
      }
    }
    return false;
  }
  let opacity = 0;
  let frame = 0;
  let last = 0;
  let time = 0;

  const count = Math.round(random(COUNT[0], COUNT[1]));
  const dots = Array.from({ length: count }, (_, i) => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: random(MIN_RADIUS, MAX_RADIUS),
    color: COLORS[i % COLORS.length],
    // Spread the dots around the pointer, with some irregularity.
    angle: (i / count) * Math.PI * 2 + random(-0.35, 0.35),
    distance: random(MIN_DISTANCE, MAX_DISTANCE),
    stiffness: random(STIFFNESS[0], STIFFNESS[1]),
    damping: random(DAMPING[0], DAMPING[1]),
    driftX: random(DRIFT_SPEED[0], DRIFT_SPEED[1]),
    driftY: random(DRIFT_SPEED[0], DRIFT_SPEED[1]),
    phase: random(0, Math.PI * 2),
  }));

  // Match the canvas to the window and the screen's pixel density so dots stay sharp.
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  // The dots that stay over a place name: a few, picked evenly around the circle.
  const kept = new Set(
    Array.from({ length: Math.min(PLACE_COUNT, count) }, (_, k) => Math.round((k * count) / Math.min(PLACE_COUNT, count)) % count),
  );

  // Where a dot wants to be right now: its spot around the pointer, plus a slow wander.
  // Over a place name the whole group opens out, away from the word.
  function restingSpot(dot) {
    const angle = dot.angle + time * ORBIT_SPEED;
    const distance = dot.distance * (1 + (PLACE_SPREAD - 1) * morph);
    const spot = {
      x: pointer.x + Math.cos(angle) * distance + Math.sin(time * dot.driftX + dot.phase) * DRIFT,
      y: pointer.y + Math.sin(angle) * distance + Math.cos(time * dot.driftY + dot.phase) * DRIFT,
    };
    // The first dot carries the photo: over the name it moves out to a fixed spot beside the cursor.
    if (dot === dots[0] && face > 0) {
      spot.x += (pointer.x + Math.cos(PORTRAIT_ANGLE) * PORTRAIT_DISTANCE - spot.x) * face;
      spot.y += (pointer.y + Math.sin(PORTRAIT_ANGLE) * PORTRAIT_DISTANCE - spot.y) * face;
    }
    return spot;
  }

  function step(dt) {
    time += dt;
    for (const dot of dots) {
      const spot = restingSpot(dot);
      // Spring toward the spot, resisted in proportion to speed.
      const ax = (spot.x - dot.x) * dot.stiffness - dot.vx * dot.damping;
      const ay = (spot.y - dot.y) * dot.stiffness - dot.vy * dot.damping;
      dot.vx += ax * dt;
      dot.vy += ay * dt;
    }

    // Like magnets with the same pole facing: dots push each other away before
    // they touch, harder the closer they get.
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i];
        const b = dots[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let gap = Math.hypot(dx, dy);
        const range = a.radius + b.radius + REPEL_REACH;
        if (gap >= range) continue;
        if (gap < 0.01) {
          // Exactly on top of each other: pick a direction so they can separate.
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          gap = 1;
        }
        const closeness = 1 - gap / range;
        const push = REPEL_STRENGTH * closeness * closeness * dt;
        a.vx -= (dx / gap) * push;
        a.vy -= (dy / gap) * push;
        b.vx += (dx / gap) * push;
        b.vy += (dy / gap) * push;
      }
    }

    for (const dot of dots) {
      dot.x += dot.vx * dt;
      dot.y += dot.vy * dt;
    }
  }

  function tick(now) {
    const elapsed = Math.min((now - last) / 1000, 0.05); // a background tab should not cause a jump
    last = now;

    // Small fixed steps keep the springs stable at any frame rate.
    for (let remaining = elapsed; remaining > 0; remaining -= 1 / 240) {
      step(Math.min(remaining, 1 / 240));
    }

    // Over a place name the dots stay at full strength so the flag is clear.
    const showFace = pointer.me && portraitReady;
    face += ((showFace ? 1 : 0) - face) * Math.min(1, elapsed * MORPH_SPEED);
    if (face < 0.01) face = 0;
    if (plain !== face > 0) {
      plain = face > 0;
      blend();
    }
    const target = visible() ? (pointer.place || showFace ? 1 : pointer.overText ? TEXT_OPACITY : 1) : 0;
    if (pointer.place) shownPlace = PLACES[pointer.place] || null;
    morph += ((pointer.place && shownPlace ? 1 : 0) - morph) * Math.min(1, elapsed * MORPH_SPEED);
    if (morph < 0.01) morph = 0;
    opacity += (target - opacity) * Math.min(1, elapsed * FADE_SPEED);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = opacity;
    const asEmoji = morph > 0 && shownPlace && shownPlace.asEmoji;
    dots.forEach((dot, i) => {
      // Over a place name only a few dots stay. Their plain shape shrinks away as
      // the emoji grows in its place; the others simply shrink out of sight. Where
      // emoji cannot be drawn, the few that stay keep their shape and take the place's colour.
      const stays = kept.has(i);
      // Over the name every plain dot shrinks away, leaving only the photo.
      const dotScale = (asEmoji || !stays ? 1 - morph : 1) * (1 - face);
      if (dotScale > 0.02) {
        const recolour = stays && morph > 0.5 && shownPlace && !shownPlace.asEmoji;
        ctx.fillStyle = recolour ? shownPlace.colors[i % shownPlace.colors.length] : dot.color;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius * dotScale, 0, Math.PI * 2);
        ctx.fill();
      }
      if (asEmoji && stays) {
        ctx.font = `${(EMOJI_SIZE * morph).toFixed(1)}px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shownPlace.emoji, dot.x, dot.y);
      }
    });
    if (face > 0) {
      // The photo, cut to a circle, growing out of the first dot.
      const dot = dots[0];
      const radius = dot.radius + (PORTRAIT_RADIUS - dot.radius) * face;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(portrait, dot.x - radius, dot.y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Stop drawing once the dots are hidden and have faded out.
    if (!visible() && opacity < 0.01) {
      opacity = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener('resize', resize);

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      pointer.overText = isOverText(event.clientX, event.clientY);
      pointer.overMedia = event.target instanceof Element && event.target.closest('.frame, dialog') !== null;
      const placeName = event.target instanceof Element ? event.target.closest('[data-place]') : null;
      pointer.place = placeName ? placeName.dataset.place : null;
      pointer.me = event.target instanceof Element && event.target.closest('[data-me]') !== null;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      // On the first move, or when coming back after fading out, start the dots at their spots.
      if (!pointer.seen || opacity === 0) {
        for (const dot of dots) {
          const spot = restingSpot(dot);
          dot.x = spot.x;
          dot.y = spot.y;
          dot.vx = 0;
          dot.vy = 0;
        }
        pointer.seen = true;
      }
      pointer.inside = true;
      start();
    },
    { passive: true },
  );

  // Fade out when the pointer leaves the page.
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });

  // Hide while the main mouse button is held (dragging a selection), and come back on release.
  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button === 0) pointer.pressed = true;
  });
  const release = () => {
    pointer.pressed = false;
    if (pointer.inside) start();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
})();
