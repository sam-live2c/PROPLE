const CACHE_NAME = 'devflow-offline-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Firebase, Firestore, Google Auth, and external API services.
  // Firestore handles its own offline access via IndexedDB.
  if (
    url.hostname.includes('firebase') || 
    url.hostname.includes('googleapis') || 
    url.hostname.includes('securetoken') ||
    url.pathname.startsWith('/api/') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // Handle SPA Navigation requests - serve stored index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/', responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match('/');
        })
    );
    return;
  }

  // Handle static assets: Network-First falling back to Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache valid local resources
        if (response && response.status === 200 && (response.type === 'basic' || url.origin === self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('Offline and asset not cached.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});
