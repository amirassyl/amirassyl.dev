// Entry point for /3d. Checks for WebGL2 first, then loads the (large) world.
// three.js, React and the physics engine are only ever downloaded on this page.
const root = document.getElementById('world');

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

try {
  sessionStorage.setItem('world-visited', '1'); // the home page then offers a way back in
} catch {
  // storage blocked: no link back, nothing else changes
}

if (root) {
  if (!hasWebGL2()) {
    root.querySelector('.world-loading')?.remove();
    root.querySelector('.world-unsupported')?.removeAttribute('hidden');
    document.documentElement.classList.add('world-ready');
  } else {
    Promise.all([import('react'), import('react-dom/client'), import('./App')])
      .then(([React, { createRoot }, { App }]) => {
        root.querySelector('.world-loading')?.remove();
        createRoot(root).render(React.createElement(React.StrictMode, null, React.createElement(App)));
      })
      .catch((error) => {
        console.error(error);
        root.querySelector('.world-loading')?.remove();
        root.querySelector('.world-unsupported')?.removeAttribute('hidden');
        document.documentElement.classList.add('world-ready');
      });
  }
}
