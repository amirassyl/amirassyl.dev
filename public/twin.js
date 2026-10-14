// Pixel Amir: a small pixel version of Amir who stands in the bottom-right
// corner of every page. He breathes and blinks; pressing him makes him wave and
// opens a chat thread above him. Replies come from /api/chat (the
// Worker asks Gemini, in Amir's voice) and are typed out as they stream in.
// Colours come from the --twin-* tokens in global.css, so night mode needs nothing here.
(() => {
  // One letter per pixel; '.' is empty. The letters map to colour classes (see PALETTE).
  // Chibi proportions: about two heads tall, big low eyes, no neck, coloured outlines.
  const SPRITE = [
    '..........KKKK..........', // wavy hair
    '........KKHHHHKK........',
    '.....KKKhHHHHHhhKKK.....',
    '...KKHhHHhHHHhHHhHHKK...',
    '...KHHHHHHHhhHHHHHHHK...',
    '..KHHhHHHHhSSHHHHhHHHK..',
    '..KHhHHSSHSSSSHSSHhHHK..',
    '..KHHHSSSSSSSSSSSSHHHK..',
    '..KHHSSSSSSSSSSSSSSHHK..',
    '..KHHSSSSSSSSSSSSSSHHK..',
    '.KHHSSSGGSSSSSSGGSSSHHK.', // round glasses, big eyes
    '.KKSSSGwEGGGGGGwEGSSSKK.',
    '...oSSGEEGSSSSGEEGSSo...',
    '...oSSGEEGSSSSGEEGSSo...',
    '....oSSGGSSSSSSGGSSo....',
    '....bbSSSSmSSmSSSSbb....', // blush and smile
    '......ooSSSmmSSSoo......',
    '........oSSSSSSo........',
    '........nWWWWWWn........', // striped tee
    '......nnWWWWWWWWnn......',
    '......nNNNNNNNNNNn......',
    '......nWWWWWWWWWWn......',
    '......oNNNNNNNNNNo......',
    '......oWWWWWWWWWWo......',
    '.......nNNNNNNNNn.......',
    '.......qJJJJJJJJq.......', // jeans
    '.......qJJJqqJJJq.......',
    '.......qJJq..qJJq.......',
    '.......qqqq..qqqq.......',
    '......BFFFB..BFFFB......', // sneakers
    '......BBFFB..BFFBB......',
    '......BBBBB..BBBBB......',
  ];
  const PALETTE = {
    K: 'hair-line', H: 'hair', h: 'hair-lit',
    o: 'skin-line', S: 'skin', s: 'skin-shade', b: 'blush', m: 'mouth',
    E: 'eye', w: 'eye-shine', G: 'glasses',
    n: 'tee-line', W: 'tee', N: 'stripe',
    q: 'jeans-line', J: 'jeans', j: 'jeans-shade',
    F: 'shoe', B: 'shoe-line',
  };
  // Pixels that change for a frame: [row, column, letter]. Later frames draw on top.
  const hand = (cy, cx) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [cy + dy, cx + dx, dx === dy && dx ? 'o' : 'S']));
  const FRAMES = {
    look: [[11, 8, 'G'], [12, 8, 'S'], [13, 8, 'S'], [11, 16, 'G'], [12, 16, 'S'], [13, 16, 'S'], [11, 7, 'E'], [11, 15, 'E']], // eyes turn to the input
    blink: [11, 12].flatMap((y) => [7, 8, 15, 16].map((x) => [y, x, 'S'])), // eyes close to a line
    talk: [[15, 11, 'm'], [15, 12, 'm']], // smile opens into a little D
    'wave-a': [[19, 18, 'n'], [18, 18, 'n'], [18, 19, 'o'], [17, 19, 'o'], [17, 20, 'S'], [16, 20, 'o'], ...hand(14, 21)], // hand up beside his head
    'wave-b': [[19, 18, 'n'], [18, 18, 'n'], [18, 19, 'o'], [17, 20, 'o'], [16, 21, 'o'], [15, 21, 'o'], ...hand(13, 22)], // hand tipped outward
  };

  const GREETING = "Heyy, I'm pixel Amir! ask me anything🫶🏻";
  // Suggested first questions, shown until the visitor sends something.
  const SUGGESTIONS = ['What are you working on?', 'Your projects?', 'How can I reach you?'];
  // What he says when there's no real reply, keyed by the status /api/chat returns.
  const FALLBACK = {
    429: 'Slow down a bit😭 I can only type so fast',
    502: 'Hmm not sure about that, ask the real me🙏🏻',
    503: "I'm sleeping rn😴 come back tmrw!!",
  };
  const NOT_SURE = 'Hmm not sure about that, ask the real me🙏🏻';

  const SVG = 'http://www.w3.org/2000/svg';
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Draw the sprite: the base pixels, then one layer per frame that CSS shows or hides.
  function drawSprite() {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${SPRITE[0].length} ${SPRITE.length}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    const pixel = (parent, x, y, letter) => {
      const rect = document.createElementNS(SVG, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', 1);
      rect.setAttribute('height', 1);
      rect.setAttribute('class', `px-${PALETTE[letter]}`);
      parent.append(rect);
    };
    SPRITE.forEach((row, y) => [...row].forEach((letter, x) => letter !== '.' && pixel(svg, x, y, letter)));
    for (const [name, frame] of Object.entries(FRAMES)) {
      const layer = document.createElementNS(SVG, 'g');
      layer.setAttribute('class', `twin-${name}`);
      for (const [y, x, letter] of frame) pixel(layer, x, y, letter);
      svg.append(layer);
    }
    return svg;
  }

  const root = document.createElement('div');
  root.className = 'twin';
  root.innerHTML = `
    <section class="twin-bubble" id="twin-bubble" aria-label="Chat with pixel Amir" hidden>
      <div class="twin-log" aria-live="polite"></div>
      <div class="twin-chips"></div>
      <form class="twin-form">
        <input name="message" type="text" autocomplete="off" maxlength="500" placeholder="Message Amir…" aria-label="Message" required />
        <button type="submit" aria-label="Send">↑</button>
      </form>
      <p class="twin-note">I'm an AI version of Amir. Chats are processed by Google Gemini.</p>
    </section>
    <button class="twin-me" type="button" aria-label="Talk to pixel Amir" aria-expanded="false" aria-controls="twin-bubble"></button>
  `;
  const me = root.querySelector('.twin-me');
  const bubble = root.querySelector('.twin-bubble');
  const log = root.querySelector('.twin-log');
  const chips = root.querySelector('.twin-chips');
  const form = root.querySelector('.twin-form');
  const input = form.elements.message;
  me.append(drawSprite());
  for (const text of SUGGESTIONS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'twin-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => send(text));
    chips.append(chip);
  }
  chips.hidden = true;
  document.body.append(root);

  const wait = (ms) => new Promise((done) => setTimeout(done, ms));

  // Blink every few seconds, at slightly uneven intervals so it looks alive.
  if (!lessMotion) {
    const blink = () => {
      root.classList.add('blinking');
      setTimeout(() => root.classList.remove('blinking'), 140);
      setTimeout(blink, 2500 + Math.random() * 3500);
    };
    setTimeout(blink, 1500);
  }

  // Wave hello for about a second.
  function wave() {
    if (lessMotion) return;
    root.classList.add('waving');
    setTimeout(() => root.classList.remove('waving'), 1100);
  }

  // He looks at the input while the visitor types.
  input.addEventListener('focus', () => root.classList.add('looking'));
  input.addEventListener('blur', () => root.classList.remove('looking'));

  const scrollDown = () => {
    log.scrollTop = log.scrollHeight;
  };

  function say(text, from) {
    const line = document.createElement('p');
    line.className = `twin-line from-${from}`;
    line.textContent = text;
    log.append(line);
    scrollDown();
    return line;
  }

  // Three bouncing dots while he waits for a reply to start.
  function typingDots() {
    const dots = say('', 'twin');
    dots.classList.add('twin-typing');
    dots.setAttribute('aria-label', 'Amir is typing');
    dots.innerHTML = '<i></i><i></i><i></i>';
    return dots;
  }

  // Whole characters, so emoji such as 🫶🏻 never appear half-drawn.
  const segmenter = window.Intl?.Segmenter ? new Intl.Segmenter() : null;
  const characters = (text) => (segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : [...text]);

  // Type a reply out letter by letter while the mouth moves. `source` is either
  // a finished string or a stream that is still arriving; typing keeps up with it.
  // Each line of the reply gets its own bubble, the way Amir sends short bursts.
  // `dots` (if given) stays until the first letter appears.
  async function speak(source, dots) {
    let received = '';
    let finished = false;
    const reading = (async () => {
      try {
        if (typeof source === 'string') {
          received = source;
          return;
        }
        const reader = source.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          received += value;
        }
      } finally {
        finished = true;
      }
    })();

    const lines = [];
    const show = (text) => {
      const bursts = text.split(/\n+/).map((burst) => burst.trim()).filter(Boolean);
      if (bursts.length) dots?.remove();
      bursts.forEach((burst, i) => {
        lines[i] ??= say('', 'twin');
        lines[i].textContent = burst;
      });
      scrollDown();
    };

    if (lessMotion) {
      await reading.catch(() => {});
      show(received);
    } else {
      root.classList.add('talking');
      let shown = 0;
      for (;;) {
        const chars = characters(received);
        if (shown < chars.length) {
          shown++;
          show(chars.slice(0, shown).join(''));
          await wait(22);
        } else if (finished) {
          break;
        } else {
          await wait(40); // waiting for the next piece of the reply
        }
      }
      root.classList.remove('talking');
      await reading.catch(() => {});
    }
    dots?.remove();
    return received;
  }

  // The conversation so far, sent with every message so he remembers it.
  const history = [];

  async function ask() {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (response.ok && response.body) return { stream: response.body };
      return { fallback: FALLBACK[response.status] ?? FALLBACK[503] };
    } catch {
      return { fallback: FALLBACK[503] };
    }
  }

  let busy = false;
  async function send(text) {
    if (busy || !text) return;
    busy = true;
    chips.hidden = true;
    say(text, 'visitor');
    history.push({ role: 'user', text });
    input.value = '';
    input.disabled = true;
    const dots = typingDots();
    const { stream, fallback } = await ask();
    const reply = stream ? await speak(stream, dots) : '';
    if (reply.trim()) {
      history.push({ role: 'model', text: reply });
    } else {
      // No real reply: say something in character, and forget the message so it can be sent again.
      history.pop();
      await speak(fallback ?? NOT_SURE, dots);
    }
    input.disabled = false;
    busy = false;
    input.focus();
  }

  function open(isOpen) {
    bubble.hidden = !isOpen;
    me.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) return;
    wave();
    if (!log.childElementCount) {
      // Let him finish saying hi before the visitor can type, so the two never overlap.
      history.push({ role: 'model', text: GREETING });
      input.disabled = true;
      busy = true;
      speak(GREETING).then(() => {
        input.disabled = false;
        busy = false;
        chips.hidden = false;
        input.focus();
      });
      return;
    }
    input.focus();
  }

  me.addEventListener('click', () => open(bubble.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !bubble.hidden) {
      open(false);
      me.focus();
    }
  });
  // Clicking anywhere else on the page closes the chat; the conversation is kept.
  document.addEventListener('pointerdown', (event) => {
    if (!bubble.hidden && !root.contains(event.target)) open(false);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(input.value.trim());
  });
})();
