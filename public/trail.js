// Cursor companions: a few flat dots that hover around the pointer on springs.
// Each dot is pulled toward its own spot near the cursor, overshoots a little
// when the cursor moves, and keeps drifting gently once the cursor is still.
// Self-contained: creates its own full-screen canvas and needs no markup or CSS.
//
// The spring-and-resistance approach follows the classic "elastic bullets"
// cursor (see springyEmojiCursor in github.com/tholman/cursor-effects), with a
// separate resting spot per dot instead of a chain.
(() => {
  const COLORS = ['#F2AF29', '#3B82F6', '#FF4D4D', '#FFB703', '#4ADE80']; // marigold, blue, red, amber, green
  const COUNT = [5, 10]; // how many dots: a random whole number in this range, picked on each page load
  const MIN_RADIUS = 3.5;
  const MAX_RADIUS = 6;
  const MIN_DISTANCE = 14; // px from the pointer, so no dot sits under it
  const MAX_DISTANCE = 22;
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
    // Mix with the page like ink, so text stays readable through a dot.
    mixBlendMode: 'multiply',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const random = (min, max) => min + Math.random() * (max - min);
  const pointer = { x: 0, y: 0, inside: false, seen: false, pressed: false, overText: false };
  // Dots show while the pointer is on the page and the mouse button is up,
  // so they get out of the way while text is being selected.
  const visible = () => pointer.inside && !pointer.pressed;

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

  // Where a dot wants to be right now: its spot around the pointer, plus a slow wander.
  function restingSpot(dot) {
    const angle = dot.angle + time * ORBIT_SPEED;
    return {
      x: pointer.x + Math.cos(angle) * dot.distance + Math.sin(time * dot.driftX + dot.phase) * DRIFT,
      y: pointer.y + Math.sin(angle) * dot.distance + Math.cos(time * dot.driftY + dot.phase) * DRIFT,
    };
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

    const target = visible() ? (pointer.overText ? TEXT_OPACITY : 1) : 0;
    opacity += (target - opacity) * Math.min(1, elapsed * FADE_SPEED);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = opacity;
    for (const dot of dots) {
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      ctx.fill();
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
