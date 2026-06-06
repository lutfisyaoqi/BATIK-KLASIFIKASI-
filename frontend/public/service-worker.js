/* Service Worker untuk PWA */

const CACHE_NAME = 'batik-sumsel-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    ))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Skip service worker cache for admin and API routes
  if (event.request.method !== 'GET' || 
      event.request.url.includes('/service-worker.js') ||
      event.request.url.includes('/api/') ||
      event.request.url.includes('/admin')) {
    return;
  }

  const fetchOptions = {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  };

  event.respondWith(
    fetch(event.request, fetchOptions)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cachedResponse) => cachedResponse || new Response('Network unavailable', { status: 408 })))
  );
});
