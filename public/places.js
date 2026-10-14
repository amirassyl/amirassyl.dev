// Place names on a touch screen: there is no hover, so tapping Kazakhstan, Japan
// or San Francisco gives it its colour and sends its flag floating up from the
// word. Tapping anywhere else (or another place) puts the colour back. With a
// mouse the colour comes from :hover and the cursor dots turn into the flag
// (trail.js), so this script does nothing there.
(() => {
  const FLAGS = { kz: '🇰🇿', jp: '🇯🇵', sf: '🌉' };
  const POP_TIME = 1300; // ms before the floating flag is removed (matches the CSS animation)

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lit = null;
  const clear = () => {
    if (lit) lit.classList.remove('lit');
    lit = null;
  };

  document.addEventListener('click', (event) => {
    const place = event.target instanceof Element ? event.target.closest('.place') : null;
    if (place === lit) return;
    clear();
    if (!place) return;

    place.classList.add('lit');
    lit = place;
    if (navigator.vibrate) navigator.vibrate(8);

    const flag = FLAGS[place.dataset.place];
    if (flag && !lessMotion) {
      const pop = document.createElement('span');
      pop.className = 'place-pop';
      pop.setAttribute('aria-hidden', 'true');
      pop.textContent = flag;
      place.appendChild(pop);
      setTimeout(() => pop.remove(), POP_TIME);
    }
  });
})();
