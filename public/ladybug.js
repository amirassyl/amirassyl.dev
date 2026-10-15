// The way into the 3D world: a tiny glossy ladybug flies in and lands on my
// name. It's a real button; clicking it (or Enter) dives into /3d/. Plain SVG
// and CSS, so the home page never downloads three.js for it. Only the home
// page loads this file.
//
// Less motion: no flight and no twitching, the ladybug just sits on the name.
// After a visit to /3d/, a small link back appears next to the name.
(() => {
  const name = document.querySelector('h1[data-ripple]');
  if (!name) return;
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = (key, value) => {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, value);
    } catch {
      return null; // storage blocked: fly in every time, no link back
    }
  };

  const css = `
.ladybug{position:absolute;z-index:3;width:30px;height:30px;margin:0;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ladybug:focus-visible{outline:var(--focus-ring);outline-offset:2px}
.ladybug svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 1.5px 1.2px rgb(0 0 0/.28));transform:rotate(var(--lb-turn,76deg));transition:transform .3s}
.ladybug:hover svg{transform:rotate(var(--lb-turn,76deg)) scale(1.12)}
.lb-shell{transition:transform .18s ease-out;transform-box:fill-box}
.lb-l{transform-origin:100% 8%}.lb-r{transform-origin:0 8%}
.ladybug.twitch .lb-l{transform:rotate(-9deg)}.ladybug.twitch .lb-r{transform:rotate(9deg)}
.lb-wing{opacity:0;transform-box:fill-box;transition:opacity .15s}
.ladybug.flying .lb-l{transform:rotate(-34deg)}.ladybug.flying .lb-r{transform:rotate(34deg)}
.ladybug.flying .lb-wing{opacity:.55;animation:lb-flap 70ms linear infinite alternate}
.lb-wl{transform-origin:100% 0}.lb-wr{transform-origin:0 0}
@keyframes lb-flap{to{transform:scaleY(.55)}}
.ladybug-back{position:absolute;z-index:3;font-size:var(--text-xs);color:var(--muted);white-space:nowrap;text-decoration-color:transparent}
.ladybug-back:hover{color:var(--text);text-decoration-color:currentColor}
.ladybug-veil{position:fixed;inset:0;z-index:20;pointer-events:none;background:#cde8f5}
[data-theme=dark] .ladybug-veil{background:#132649}
[data-theme=dark] .ladybug svg{filter:drop-shadow(0 0 1px rgb(255 255 255/.45)) drop-shadow(0 1.5px 1.2px rgb(0 0 0/.5))}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  // Drawn with the head at the top; the button turns it to face along the name.
  const spots = (side) =>
    [
      [4.2, -4, 2.3],
      [7.6, 2.5, 2.1],
      [3.8, 7.5, 2],
    ]
      .map(([x, y, r]) => `<circle cx="${x * side}" cy="${y}" r="${r}" fill="#1a1414"/>`)
      .join('');
  const half = (side) =>
    `<g class="lb-shell lb-${side < 0 ? 'l' : 'r'}"><path d="M0 -7.5C${6 * side} -7.5 ${11 * side} -3 ${11 * side} 2.5C${11 * side} 9 ${6 * side} 13 0 13Z" fill="url(#lb-red)"/>${spots(side)}${
      side < 0
        ? '<ellipse cx="-5" cy="-3" rx="3.6" ry="2" transform="rotate(-35 -5 -3)" fill="url(#lb-gloss)"/><circle cx="-6.2" cy="-3.8" r=".9" fill="#fff"/>'
        : '<ellipse cx="6" cy="6" rx="2.2" ry="1.1" transform="rotate(-50 6 6)" fill="#fff" opacity=".22"/>'
    }</g>`;
  const svg = `<svg viewBox="-16 -18 32 34" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="lb-red" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#ff8a74"/><stop offset=".35" stop-color="#ec2a21"/><stop offset=".8" stop-color="#b3110f"/><stop offset="1" stop-color="#6e0709"/></radialGradient>
<linearGradient id="lb-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="lb-head" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#4a4446"/><stop offset="1" stop-color="#0d0b0c"/></radialGradient>
</defs>
<g stroke="#1a1414" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M-9 -2l-4 -2M-10 4l-4.5 0.5M-8 9l-3.5 3M9 -2l4 -2M10 4l4.5 0.5M8 9l3.5 3"/><path d="M-2 -12q-2 -4 -5 -5M2 -12q2 -4 5 -5"/></g>
<ellipse class="lb-wing lb-wl" cx="-8" cy="6" rx="5" ry="10" fill="#e9eef5"/><ellipse class="lb-wing lb-wr" cx="8" cy="6" rx="5" ry="10" fill="#e9eef5"/>
<ellipse cx="0" cy="-9" rx="6" ry="4.6" fill="url(#lb-head)"/>
<circle cx="-3" cy="-10.6" r="1.1" fill="#fff"/><circle cx="3" cy="-10.6" r="1.1" fill="#fff"/>
${half(-1)}${half(1)}
<path d="M0 -7.5V13" stroke="#3a0a0a" stroke-width=".7"/>
</svg>`;

  const bug = document.createElement('button');
  bug.type = 'button';
  bug.className = 'ladybug';
  bug.setAttribute('aria-label', "Enter Amir's 3D world");
  bug.title = "Enter Amir's 3D world";
  bug.innerHTML = svg;
  name.after(bug);

  let back = null;
  if (store('world-visited') === '1') {
    back = document.createElement('a');
    back.className = 'ladybug-back';
    back.href = '/3d/';
    back.textContent = 'back to the 3D world';
    bug.after(back);
  }

  // Sit on the top edge of the name, near its end.
  function place() {
    const box = name.getBoundingClientRect();
    const parent = bug.offsetParent?.getBoundingClientRect() ?? { left: -scrollX, top: -scrollY };
    const x = box.left - parent.left + box.width * 0.78;
    const y = box.top - parent.top - 18;
    bug.style.left = `${x - 15}px`;
    bug.style.top = `${y}px`;
    if (back) {
      back.style.left = `${box.right - parent.left + 22}px`;
      back.style.top = `${box.top - parent.top + 2}px`;
    }
    return { x, y };
  }
  place();
  addEventListener('resize', place);
  document.fonts?.ready.then(place);

  // Fly in once per visit: a looping path from the top-right corner, wings buzzing.
  function flyIn() {
    const end = bug.getBoundingClientRect();
    const sx = innerWidth + 40 - end.left;
    const sy = -end.top - 60;
    const frames = [];
    const steps = 36;
    let last = [sx, sy];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ease = 1 - (1 - t) ** 2.4;
      // A curve that swings out and loops once before settling.
      const x = sx * (1 - ease) + Math.sin(t * Math.PI * 2.2) * 70 * (1 - t);
      const y = sy * (1 - ease) ** 1.3 - Math.sin(t * Math.PI) * 40 + Math.cos(t * Math.PI * 2.2) * 24 * (1 - t) - 24 * (1 - t);
      const heading = (Math.atan2(y - last[1], x - last[0]) * 180) / Math.PI + 90 - 76;
      frames.push({ transform: `translate(${x}px, ${y}px) rotate(${i === steps ? 0 : heading}deg)` });
      last = [x, y];
    }
    bug.classList.add('flying');
    const flight = bug.animate(frames, { duration: 2300, easing: 'linear', fill: 'backwards' });
    flight.finished.then(() => {
      bug.classList.remove('flying');
      bug.animate([{ transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
      store('ladybug-landed', '1');
      idle();
    });
  }

  // Now and then the wing cases lift for a moment, as if it's about to take off.
  function idle() {
    if (lessMotion) return;
    setTimeout(
      () => {
        if (!bug.classList.contains('flying')) {
          bug.classList.add('twitch');
          setTimeout(() => bug.classList.remove('twitch'), 180 + Math.random() * 140);
        }
        idle();
      },
      2200 + Math.random() * 4200,
    );
  }

  if (lessMotion || store('ladybug-landed') === '1') idle();
  else setTimeout(flyIn, 900);

  // The dive: the wings open, the ladybug grows towards you and the world's sky fills the window.
  bug.addEventListener('click', () => {
    window.sound?.play('gather');
    if (lessMotion) {
      location.href = '/3d/';
      return;
    }
    const box = bug.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const veil = document.createElement('div');
    veil.className = 'ladybug-veil';
    document.body.append(veil);
    const reach = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    bug.classList.add('flying');
    bug.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4) translateY(-6px)', offset: 0.3 }, { transform: 'scale(9)', opacity: 0 }], {
      duration: 650,
      easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
      fill: 'forwards',
    });
    veil
      .animate({ clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${reach}px at ${cx}px ${cy}px)`] }, { duration: 650, delay: 120, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' })
      .finished.then(() => (location.href = '/3d/'));
  });
  // Coming back with the browser's back button: undo the dive.
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelector('.ladybug-veil')?.remove();
    bug.classList.remove('flying');
    bug.getAnimations().forEach((animation) => animation.cancel());
  });
})();
