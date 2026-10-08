// First-visit hint, like a game showing its controls: a moment after the page
// loads, the name ripples once on its own and a small pill at the bottom says
// to try pointing at things. It goes away once the visitor points at something
// that reacts, and is then not shown again on later visits.
(() => {
  const KEY = 'hinted';
  const TEXT = 'Try pointing at things';
  const DELAY = 1200; // ms after the page is ready before the hint appears
  const STAY = 8000; // ms it stays if nothing is hovered
  const REACTS = '[data-ripple], [data-place], [data-me]';

  // Only where there is a mouse to point with.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  try {
    if (localStorage.getItem(KEY)) return;
  } catch {
    // storage blocked: show the hint each visit
  }

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.setAttribute('aria-hidden', 'true'); // it describes a mouse gesture, so it is not announced
  hint.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/></svg>';
  hint.append(TEXT);
  document.body.appendChild(hint);

  let hideTimer = 0;
  const hide = () => {
    clearTimeout(hideTimer);
    hint.classList.remove('shown');
    setTimeout(() => hint.remove(), 600);
  };

  setTimeout(() => {
    hint.classList.add('shown');
    // The name demonstrates at the same moment.
    const name = document.querySelector('[data-me][data-ripple]');
    if (name) name.dispatchEvent(new CustomEvent('ripple:play'));
    hideTimer = setTimeout(hide, STAY);
  }, DELAY);

  // The first time they point at something that reacts, the lesson is learned.
  const learned = (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(REACTS)) return;
    document.removeEventListener('pointerover', learned);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // storage blocked: nothing to remember
    }
    hide();
  };
  document.addEventListener('pointerover', learned, { passive: true });
})();
