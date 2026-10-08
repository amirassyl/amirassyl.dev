// Video page: hovering a tile plays its silent preview clip; clicking opens the
// full video in a player on the page (from YouTube, or from this site for hosted files).
// Without this script each tile is still a plain link to the video.
(() => {
  const dialog = document.querySelector('dialog.player');
  const stage = dialog && dialog.querySelector('.stage');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  for (const frame of document.querySelectorAll('.frame[data-video], .frame[data-file]')) {
    const preview = frame.querySelector('video');

    // Hover preview: muted, so browsers allow it without a click.
    if (preview && canHover && !lessMotion) {
      frame.addEventListener('pointerenter', () => {
        preview.play().then(
          () => frame.classList.add('playing'),
          () => {}, // playback refused or interrupted: keep showing the still image
        );
      });
      frame.addEventListener('pointerleave', () => {
        frame.classList.remove('playing');
        preview.pause();
        preview.currentTime = 0;
      });
    }

    // Click: play the full video with sound in the on-page player.
    if (dialog && stage && typeof dialog.showModal === 'function') {
      frame.addEventListener('click', (event) => {
        // Let modified clicks (new tab, new window) go to YouTube as normal links.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();

        let player;
        if (frame.dataset.file) {
          // A video hosted on this site.
          player = document.createElement('video');
          player.src = frame.dataset.file;
          player.controls = true;
          player.autoplay = true;
          player.playsInline = true;
        } else {
          player = document.createElement('iframe');
          player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(frame.dataset.video)}?autoplay=1&rel=0`;
          player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
          player.allowFullscreen = true;
        }
        player.title = frame.dataset.title || 'Video';
        stage.replaceChildren(player);
        dialog.showModal();
      });
    }
  }

  if (dialog && stage) {
    // Removing the player stops the video when the dialog closes (button, Esc, or a click outside).
    dialog.addEventListener('close', () => stage.replaceChildren());
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
})();
