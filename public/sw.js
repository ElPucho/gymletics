const CACHE = 'gymletics-shell-v2';
const SCOPE_ROOT = new URL('./', self.registration.scope).pathname;
const scopedPath = (path) => new URL(path, self.registration.scope).pathname;
const SHELL = [SCOPE_ROOT, scopedPath('manifest.webmanifest'), scopedPath('icon.svg')];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SCOPE_ROOT, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE_ROOT)),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});
