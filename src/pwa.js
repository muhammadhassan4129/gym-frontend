let initialized = false;
let registration = null;
let updateRequested = false;

let state = {
  installPrompt: null,
  updateAvailable: false,
  installed: false,
};

const listeners = new Set();

function publish(changes) {
  state = { ...state, ...changes };

  listeners.forEach((listener) => listener(state));
}

export function getPwaState() {
  return state;
}

export function subscribePwa(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function initializePwa() {
  if (initialized) return;
  initialized = true;

  const displayMode = window.matchMedia('(display-mode: standalone)');

  const isInstalled = () =>
    displayMode.matches || window.navigator.standalone === true;

  publish({ installed: isInstalled() });

  displayMode.addEventListener('change', () => {
    publish({ installed: isInstalled() });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();

    publish({
      installPrompt: event,
    });
  });

  window.addEventListener('appinstalled', () => {
    publish({
      installed: true,
      installPrompt: null,
    });
  });

  if (
    process.env.NODE_ENV !== 'production' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) {
      window.location.reload();
    }
  });

  async function registerWorker() {
    try {
      registration = await navigator.serviceWorker.register(
        '/gym-sw.js',
        {
          scope: '/',
          updateViaCache: 'none',
        }
      );

      if (registration.waiting) {
        publish({ updateAvailable: true });
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;

        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (
            worker.state === 'installed' &&
            navigator.serviceWorker.controller &&
            registration.waiting
          ) {
            publish({ updateAvailable: true });
          }
        });
      });

      await registration.update();
    } catch (error) {
      console.error('PWA registration failed:', error);
    }
  }

  if (document.readyState === 'complete') {
    registerWorker();
  } else {
    window.addEventListener('load', registerWorker, {
      once: true,
    });
  }
}

export async function promptInstall() {
  const prompt = state.installPrompt;

  if (!prompt) {
    return null;
  }

  // Prevent reusing a consumed browser prompt.
  publish({ installPrompt: null });

  await prompt.prompt();

  const choice = await prompt.userChoice;

  return choice.outcome;
}

export function activatePwaUpdate() {
  if (!registration?.waiting) {
    throw new Error('No waiting update is available.');
  }

  updateRequested = true;

  registration.waiting.postMessage({
    type: 'SKIP_WAITING',
  });
}