// Mouse trail: small flat dots that drift and fade behind the cursor.
// Self-contained: creates its own full-screen canvas and needs no markup or CSS.
(() => {
  const COLORS = ['#F2AF29', '#2B5490', '#9E382B', '#6E7A68']; // marigold, cobalt, terracotta, sage
  const MIN_RADIUS = 3.5;
  const MAX_RADIUS = 6;
  const MIN_LIFE = 1000; // ms
  const MAX_LIFE = 1500;
  const FRICTION = 0.94; // velocity kept per frame at 60fps
  const SPAWN_OFFSET = 8; // px around the pointer
  const SPAWN_SPEED = 1.4; // px per frame at 60fps

  // No trail for people who ask for less motion, or on devices without a mouse.
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
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let particles = [];
  let frame = 0;
  let last = 0;

  // Match the canvas to the window and the screen's pixel density so dots stay sharp.
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const random = (min, max) => min + Math.random() * (max - min);

  function spawn(x, y) {
    const count = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(0.3, SPAWN_SPEED);
      particles.push({
        x: x + random(-SPAWN_OFFSET, SPAWN_OFFSET),
        y: y + random(-SPAWN_OFFSET, SPAWN_OFFSET),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: random(MIN_RADIUS, MAX_RADIUS),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        age: 0,
        life: random(MIN_LIFE, MAX_LIFE),
      });
    }
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    const elapsed = Math.min(now - last, 50); // a background tab should not cause a jump
    last = now;
    const step = elapsed / (1000 / 60);
    const damping = Math.pow(FRICTION, step);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.age += elapsed;
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * step;
      p.y += p.vy * step;

      const remaining = 1 - p.age / p.life;
      if (remaining <= 0) continue;
      ctx.globalAlpha = remaining;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * remaining, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Drop finished dots so the list never grows without bound.
    particles = particles.filter((p) => p.age < p.life);

    // Stop the loop when nothing is on screen; the next mouse move restarts it.
    frame = particles.length ? requestAnimationFrame(tick) : 0;
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'mouse') spawn(event.clientX, event.clientY);
    },
    { passive: true },
  );
})();
