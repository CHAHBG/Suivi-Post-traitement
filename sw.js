/**
 * Service Worker for PROCASSEF Dashboard
 * Modern PWA implementation with network-first strategy for data freshness
 * 
 * Security Features:
 * - Same-origin validation for all cached requests
 * - Opaque response handling
 * - Cache size limits to prevent storage exhaustion
 * 
 * @version 2.0.0
 */
const CACHE_VERSION = 'v2.1.5';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Maximum cache entries to prevent storage exhaustion
const MAX_DYNAMIC_CACHE_ENTRIES = 50;

const STATIC_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest'
];

// Trusted external domains for fetching resources
const TRUSTED_EXTERNAL_DOMAINS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'cdn.sheetjs.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('SW install failed:', err))
  );
});

/**
 * Activate event - clean up old caches
 */
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

/**
 * Check if URL is from a trusted domain
 * @param {URL} url - URL to check
 * @returns {boolean} True if trusted
 */
function isTrustedDomain(url) {
  return url.origin === self.location.origin || 
         TRUSTED_EXTERNAL_DOMAINS.includes(url.hostname);
}

/**
 * Helper to determine if request is for static asset
 * @param {Request} request - Fetch request
 * @returns {boolean} True if static asset
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return request.destination === 'style' ||
         request.destination === 'script' ||
         request.destination === 'font' ||
         request.destination === 'image' ||
         url.pathname.match(/\.(css|js|woff2?|ttf|png|jpg|jpeg|svg|webp)$/);
}

/**
 * Limit cache size to prevent storage exhaustion
 * @param {string} cacheName - Name of cache to limit
 * @param {number} maxEntries - Maximum entries allowed
 */
async function limitCacheSize(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      // Delete oldest entries (FIFO)
      const deleteCount = keys.length - maxEntries;
      await Promise.all(
        keys.slice(0, deleteCount).map(key => cache.delete(key))
      );
    }
  } catch (e) {
    // Ignore cache limiting errors
  }
}

/**
 * Fetch event - network-first for data, cache-first for assets
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Parse URL for validation
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return; // Invalid URL
  }

  // Important: do not intercept cross-origin requests.
  // This avoids CSP connect-src violations caused by SW-initiated fetches
  // for CDN styles/scripts/fonts, and lets the browser handle them normally.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Security: only handle same-origin requests (cross-origin already returned above)

  // Cache-first strategy for static assets (same-origin only)
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          // Only cache successful responses
          if (response.ok && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // Network-first strategy for dynamic data (same-origin only)
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, clone);
            // Limit dynamic cache size
            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_ENTRIES);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
