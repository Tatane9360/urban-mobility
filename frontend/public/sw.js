const CACHE_NAME = 'urbanflow-v2';
// /history and /profile are part of the shell too: offline, the history page
// renders the saved journeys kept in localStorage (see
// journey-history/offline-cache.ts). The per-user data itself is still never
// cached here — see the fetch handler below.
const APP_SHELL = ['/', '/login', '/register', '/history', '/profile', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network-first, same-origin only: the backend API lives on a different
// origin and returns per-user / real-time data (journeys, profile) that must
// never be cached — caching it would leak data across accounts after
// logout and violate the PRD's RGPD/data-minimisation requirement. Only the
// Next.js app shell (pages, static assets) gets an offline fallback.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
  );
});
