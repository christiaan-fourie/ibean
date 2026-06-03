const CACHE_NAME = 'ibean-shell-v1';
const APP_SHELL = [
  '/',
  '/dashboard',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

const STATIC_EXTENSIONS = ['.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webmanifest', '.ico', '.woff', '.woff2'];

const shouldCacheStaticAsset = (url) =>
  STATIC_EXTENSIONS.some((extension) => url.pathname.endsWith(extension));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse)));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cachedResponse) => cachedResponse || caches.match('/dashboard') || caches.match('/'))
        )
    );
    return;
  }

  if (shouldCacheStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clonedResponse = response.clone();
              event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse)));
            }

            return response;
          })
          .catch(() => cachedResponse);
      })
    );
  }
});
