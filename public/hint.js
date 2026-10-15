// First-visit hint, like a game showing its controls: a moment after the page
// loads, the name ripples once on its own and a small glass pill at the top says
// to try pointing at things (or tapping, on a touch screen), and, while sound is still off, where to turn it on.
// It goes away once the visitor points at something that reacts, and is then not shown again on later visits.
(() => {
  const KEY = 'hinted';
  const TEXT = 'Try pointing at things';
  const TEXT_TOUCH = 'Try tapping things';
  const TEXT_SOUND = 'Sound is off, top right';
  const DELAY = 1200; // ms after the page is ready before the hint appears
  const STAY = 12000; // ms it stays if nothing is hovered
  const MIN_SHOWN = 2500; // ms it stays at least, even if they point at something straight away
  const REACTS = '[data-ripple], [data-place], [data-me]';

  // With a mouse the lesson is "point"; on a touch screen it is "tap".
  const touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  try {
    if (localStorage.getItem(KEY)) return;
  } catch {
    // storage blocked: show the hint each visit
  }

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.setAttribute('aria-hidden', 'true'); // it describes a pointer gesture, so it is not announced
  hint.innerHTML = touch
    ? '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="7"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/></svg>';
  const lines = document.createElement('span');
  lines.className = 'hint-lines';
  lines.append(touch ? TEXT_TOUCH : TEXT);
  // Sound starts muted, so the hint also says where the speaker is (not if they already turned it on).
  let soundOn = false;
  try {
    soundOn = localStorage.getItem('sound') === 'on';
  } catch {
    // storage blocked: sound is off
  }
  if (!soundOn) {
    const sound = document.createElement('span');
    sound.className = 'hint-sound';
    sound.textContent = TEXT_SOUND;
    lines.append(sound);
  }
  hint.append(lines);
  document.body.appendChild(hint);

  let hideTimer = 0;
  let shownAt = 0;
  const hide = () => {
    clearTimeout(hideTimer);
    if (!hint.classList.contains('shown') && !shownAt) return hint.remove(); // never appeared
    hint.classList.remove('shown');
    setTimeout(() => hint.remove(), 600);
  };

  setTimeout(() => {
    hint.classList.add('shown');
    shownAt = performance.now();
    // The name demonstrates at the same moment.
    const name = document.querySelector('[data-me][data-ripple]');
    if (name) name.dispatchEvent(new CustomEvent('ripple:play'));
    hideTimer = setTimeout(hide, STAY);
  }, DELAY);

  // The first time they point at (or tap) something that reacts, the lesson is learned.
  const LEARN_EVENT = touch ? 'pointerdown' : 'pointerover';
  const learned = (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(REACTS)) return;
    document.removeEventListener(LEARN_EVENT, learned);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // storage blocked: nothing to remember
    }
    // Leave now, or once it has been up long enough to read (also covers pointing before it appeared).
    clearTimeout(hideTimer);
    const wait = shownAt ? Math.max(0, MIN_SHOWN - (performance.now() - shownAt)) : DELAY + MIN_SHOWN;
    hideTimer = setTimeout(hide, wait);
  };
  document.addEventListener(LEARN_EVENT, learned, { passive: true });
})();
