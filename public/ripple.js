// Ripple text: pointing at the name, or at a rippling link, sends one smooth
// swell outward from the letter under the cursor. Each letter grows and shrinks a moment after its
// neighbour. The letters and the animation itself are defined in the page's
// CSS; this script only decides where the ripple starts and when.
(() => {
  const STAGGER = 30; // ms between one letter starting and the next (an element can set its own with data-ripple-stagger)

  // Nothing for people who ask for less motion, or on devices without a mouse.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

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

    name.addEventListener('pointerenter', (event) => {
      // Start from the letter closest to where the pointer came in.
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
    });

    // Other scripts can ask for a ripple without a pointer (the first-visit hint does).
    name.addEventListener('ripple:play', () => play(0));
  }
})();
