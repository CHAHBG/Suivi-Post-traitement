// Modern service worker with network-first strategy for fresh data
// Follows latest PWA best practices
const CACHE_VERSION = 'v2.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

const STATIC_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('static-') || name.startsWith('dynamic-'))
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to determine if request is for static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return request.destination === 'style' ||
         request.destination === 'script' ||
         request.destination === 'font' ||
         request.destination === 'image' ||
         url.pathname.match(/\.(css|js|woff2?|ttf|png|jpg|jpeg|svg|webp)$/);
}

// Fetch event - network-first for data, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Only handle same-origin requests
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
  } catch (e) {
    return;
  }

  // Cache-first strategy for static assets
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // Network-first strategy for dynamic data
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
