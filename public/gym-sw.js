const CACHE_PREFIX = 'gym-master-offline-';

const CACHE_NAME = `${CACHE_PREFIX}v2`;

const OFFLINE_URL = new URL(
  'offline.html',
  self.registration.scope
).href;

// Cache the offline page.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(OFFLINE_URL, {
        cache: 'reload',
      });

      if (!response.ok) {
        throw new Error('Offline page could not be loaded');
      }

      const cache = await caches.open(CACHE_NAME);
      await cache.put(OFFLINE_URL, response);
    })()
  );
});

// Remove older offline caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) &&
              name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

// Activate an update when the user chooses Update App.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Network-only navigation, with an offline fallback.
// API responses and payments are not cached.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    request.mode !== 'navigate'
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request, {
          cache: 'no-store',
        });
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const offlinePage = await cache.match(OFFLINE_URL);

        return (
          offlinePage ||
          new Response(
            'Yaseen Gym: Connect to the internet and reload.',
            {
              status: 503,
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
              },
            }
          )
        );
      }
    })()
  );
});