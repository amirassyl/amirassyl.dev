// Pixel Amir: a small pixel version of Amir who stands in the bottom-right
// corner of every page. He breathes and blinks; pressing him opens a speech
// bubble where visitors can talk to him. Replies come from /api/chat (the
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
  // Pixels that change for a frame: [row, column, letter].
  const BLINK = [11, 12].flatMap((y) => [7, 8, 15, 16].map((x) => [y, x, 'S'])); // eyes close to a line
  const TALK = [[15, 11, 'm'], [15, 12, 'm']]; // smile opens into a little D

  const GREETING = "Heyy, I'm pixel Amir! ask me anything🫶🏻";
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
    for (const [name, frame] of [['blink', BLINK], ['talk', TALK]]) {
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
      <form class="twin-form">
        <input name="message" type="text" autocomplete="off" maxlength="500" placeholder="say something" aria-label="Message" required />
        <button type="submit" aria-label="Send">↑</button>
      </form>
      <p class="twin-note">I'm an AI version of Amir. Chats are processed by Google Gemini.</p>
    </section>
    <button class="twin-me" type="button" aria-label="Talk to pixel Amir" aria-expanded="false" aria-controls="twin-bubble"></button>
  `;
  const me = root.querySelector('.twin-me');
  const bubble = root.querySelector('.twin-bubble');
  const log = root.querySelector('.twin-log');
  const form = root.querySelector('.twin-form');
  const input = form.elements.message;
  me.append(drawSprite());
  document.body.append(root);

  // Blink every few seconds, at slightly uneven intervals so it looks alive.
  if (!lessMotion) {
    const blink = () => {
      root.classList.add('blinking');
      setTimeout(() => root.classList.remove('blinking'), 140);
      setTimeout(blink, 2500 + Math.random() * 3500);
    };
    setTimeout(blink, 1500);
  }

  function say(text, from) {
    const line = document.createElement('p');
    line.className = `twin-line from-${from}`;
    line.textContent = text;
    log.append(line);
    log.scrollTop = log.scrollHeight;
    return line;
  }

  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  // Whole characters, so emoji such as 🫶🏻 never appear half-drawn.
  const segmenter = window.Intl?.Segmenter ? new Intl.Segmenter() : null;
  const characters = (text) => (segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : [...text]);

  // Type a reply out letter by letter while the mouth moves. `source` is either
  // a finished string or a stream that is still arriving; typing keeps up with it.
  async function speak(source) {
    const line = say('', 'twin');
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

    if (lessMotion) {
      await reading.catch(() => {});
      line.textContent = received;
      return received;
    }
    root.classList.add('talking');
    let shown = 0;
    for (;;) {
      const chars = characters(received);
      if (shown < chars.length) {
        shown++;
        line.textContent = chars.slice(0, shown).join('');
        log.scrollTop = log.scrollHeight;
        await wait(22);
      } else if (finished) {
        break;
      } else {
        await wait(40); // waiting for the next piece of the reply
      }
    }
    root.classList.remove('talking');
    await reading.catch(() => {});
    if (!received) line.remove();
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

  function open(isOpen) {
    bubble.hidden = !isOpen;
    me.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) return;
    if (!log.childElementCount) {
      // Let him finish saying hi before the visitor can type, so the two never overlap.
      history.push({ role: 'model', text: GREETING });
      input.disabled = true;
      speak(GREETING).then(() => {
        input.disabled = false;
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    say(text, 'visitor');
    history.push({ role: 'user', text });
    input.value = '';
    input.disabled = true;
    const { stream, fallback } = await ask();
    const reply = stream ? await speak(stream) : '';
    if (reply.trim()) {
      history.push({ role: 'model', text: reply });
    } else {
      // No real reply: say something in character, and forget the message so it can be sent again.
      history.pop();
      await speak(fallback ?? NOT_SURE);
    }
    input.disabled = false;
    input.focus();
  });
})();
