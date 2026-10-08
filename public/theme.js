// Day and night mode.
// Runs in the <head>, before the page is drawn, so the right colours are there
// from the first frame. The page follows the visitor's system setting until they
// press the button; after that their choice is remembered on this device.
(() => {
  const KEY = 'theme';
  const COLOURS = { light: '#fcfcfa', dark: '#111113' }; // page background, for the browser's own chrome
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function saved() {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null; // storage blocked: just follow the system
    }
  }
  const systemTheme = () => (system.matches ? 'dark' : 'light');
  const currentTheme = () => saved() ?? systemTheme();

  function paint(theme) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = COLOURS[theme];
    const button = document.querySelector('.theme-toggle');
    if (button) {
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    }
  }

  // Switch with a circle that grows out of the button (to night) or shrinks back
  // into it (to day). Browsers without view transitions simply switch.
  function switchTo(theme, button) {
    if (!document.startViewTransition || lessMotion.matches || !button) {
      paint(theme);
      return;
    }
    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const reach = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const small = `circle(0px at ${x}px ${y}px)`;
    const full = `circle(${reach}px at ${x}px ${y}px)`;
    const toNight = theme === 'dark';

    // Going to day, the old (night) picture stays on top and shrinks away.
    // Going to night, the new picture starts as a zero-size circle at the button
    // (set in CSS through these values), so it never shows in full before growing.
    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);
    root.classList.toggle('theme-shrinking', !toNight);
    root.classList.toggle('theme-growing', toNight);
    const transition = document.startViewTransition(() => paint(theme));
    transition.ready.then(() => {
      root.animate(
        { clipPath: toNight ? [small, full] : [full, small] },
        {
          duration: 600,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'both',
          pseudoElement: toNight ? '::view-transition-new(root)' : '::view-transition-old(root)',
        },
      );
    });
    transition.finished.finally(() => root.classList.remove('theme-shrinking', 'theme-growing'));
  }

  paint(currentTheme());

  // Follow the system while the visitor has not chosen for themselves.
  system.addEventListener('change', () => {
    if (!saved()) paint(systemTheme());
  });

  document.addEventListener('DOMContentLoaded', () => {
    paint(currentTheme()); // now that the button exists, label it
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        // Choosing what the system already says goes back to following the system.
        if (next === systemTheme()) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
      } catch {
        // storage blocked: the switch still works for this page
      }
      switchTo(next, button);
    });
  });
})();
