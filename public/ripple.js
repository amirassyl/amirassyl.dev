// Ripple text: pointing at the name, or at a rippling link, sends one smooth
// swell outward from the letter under the cursor. On a touch screen the same
// swell starts from the letter under your finger when you tap. Each letter grows and shrinks a moment after its
// neighbour. The letters and the animation itself are defined in the page's
// CSS; this script only decides where the ripple starts and when.
(() => {
  const STAGGER = 30; // ms between one letter starting and the next (an element can set its own with data-ripple-stagger)

  // Nothing for people who ask for less motion.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // With a mouse the swell starts on hover; on a touch screen there is no hover, so it starts on tap.
  const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  for (const name of document.querySelectorAll('[data-ripple]')) {
    const letters = [...name.querySelectorAll('.ripple-letter')];
    if (!letters.length) continue;
    const stagger = Number(name.dataset.rippleStagger) || STAGGER;

    // Send one swell outward from the letter at `origin`.
    const play = (origin) => {
      // Letters further from that one start later, so the swell spreads both ways.
      letters.forEach((letter, i) => {
        letter.style.animationDelay = `${Math.abs(i - origin) * stagger}ms`;
      });

      // Restart the animation even if a previous ripple is still running.
      name.classList.remove('rippling');
      void name.offsetWidth;
      name.classList.add('rippling');
    };

    // Start from the letter closest to where the pointer came in.
    const start = (event) => {
      let origin = 0;
      let nearest = Infinity;
      letters.forEach((letter, i) => {
        const box = letter.getBoundingClientRect();
        const distance = Math.abs(event.clientX - (box.left + box.width / 2));
        if (distance < nearest) {
          nearest = distance;
          origin = i;
        }
      });
      play(origin);
    };

    if (hasMouse) {
      name.addEventListener('pointerenter', start);
    } else {
      // 'click' rather than 'pointerdown', so starting a scroll over a link doesn't set it off.
      name.addEventListener('click', (event) => {
        start(event);
        // A faint tick under the finger, where the browser allows it (Android; iOS ignores this).
        if (navigator.vibrate) navigator.vibrate(8);
      });
    }

    // Other scripts can ask for a ripple without a pointer (the first-visit hint does).
    name.addEventListener('ripple:play', () => play(0));
  }
})();
