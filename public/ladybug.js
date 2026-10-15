// The way into the 3D world: a tiny glossy ladybug flies in and lands on my
// name. It's a real button; clicking it (or Enter) dives into /3d/. Two small
// rendered images and CSS, so the home page never downloads three.js for it. Only the home
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
.ladybug{position:absolute;z-index:3;width:26px;height:26px;margin:0;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ladybug:focus-visible{outline:var(--focus-ring);outline-offset:3px}
.ladybug img{position:absolute;pointer-events:none;user-select:none;transform:rotate(var(--lb-turn,76deg));transition:transform .3s,opacity .12s}
.lb-closed{inset:0;width:100%;height:100%;filter:drop-shadow(0 1.5px 1.2px rgb(0 0 0/.3))}
.lb-open{left:-26.5%;top:-26.5%;width:153%;height:153%;opacity:0;filter:drop-shadow(0 4px 3px rgb(0 0 0/.18))}
.ladybug:hover .lb-closed{transform:rotate(var(--lb-turn,76deg)) scale(1.12)}
.ladybug.twitch .lb-closed{transform:rotate(var(--lb-turn,76deg)) scale(1.05,.95)}
.ladybug.flying .lb-closed{opacity:0}
.ladybug.flying .lb-open{opacity:1;animation:lb-buzz 50ms linear infinite alternate}
@keyframes lb-buzz{to{transform:rotate(var(--lb-turn,76deg)) scale(1.03,.97)}}
.ladybug-back{position:absolute;z-index:3;font-size:var(--text-xs);color:var(--muted);white-space:nowrap;text-decoration-color:transparent}
.ladybug-back:hover{color:var(--text);text-decoration-color:currentColor}
.ladybug-veil{position:fixed;inset:0;z-index:20;pointer-events:none;background:#e2e1d6}
[data-theme=dark] .ladybug-veil{background:#16232f}
[data-theme=dark] .lb-closed{filter:drop-shadow(0 0 1px rgb(255 255 255/.35)) drop-shadow(0 1.5px 1.2px rgb(0 0 0/.5))}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  // Two renders of a glossy seven-spot ladybug (made in Blender, head up): sitting, and taking off.
  const sprite = (kind) => `<img class="lb-${kind}" src="/ladybug/${kind}.webp" alt="" width="26" height="26" decoding="async" draggable="false">`;
  const bug = document.createElement('button');
  bug.type = 'button';
  bug.className = 'ladybug';
  bug.setAttribute('aria-label', "Enter Amir's 3D world");
  bug.title = "Enter Amir's 3D world";
  bug.innerHTML = sprite('closed') + sprite('open');
  name.after(bug);

  let back = null;
  if (store('world-visited') === '1') {
    back = document.createElement('a');
    back.className = 'ladybug-back';
    back.href = '/3d/';
    back.textContent = 'back to the 3D world';
    bug.after(back);
  }

  // Perch just after the name, so it never covers a letter.
  function place() {
    const box = name.getBoundingClientRect();
    const parent = bug.offsetParent?.getBoundingClientRect() ?? { left: -scrollX, top: -scrollY };
    const x = box.right - parent.left + 6;
    const y = box.top - parent.top + (box.height - 26) / 2 - 3;
    bug.style.left = `${x}px`;
    bug.style.top = `${y}px`;
    if (back) {
      back.style.left = `${box.right - parent.left + 40}px`;
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
