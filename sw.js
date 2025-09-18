// Simple service worker to prefer network (network-first) and avoid serving stale cached content.
// Note: Service workers require HTTPS (or localhost) to register.
const STATIC_CACHE = 'static-cache-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';
const STATIC_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/accessibilityHelpers.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

function isStaticRequest(req){
  return req.destination === 'style' || req.destination === 'script' || req.destination === 'font' || req.destination === 'image' || req.url.endsWith('.css') || req.url.endsWith('.js') || req.url.endsWith('.woff2') || req.url.endsWith('.woff') || req.url.endsWith('.ttf');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  try{
    const reqUrl = new URL(req.url);
    // Only handle same-origin requests here
    if(reqUrl.origin !== self.location.origin) return;
  }catch(e){ return; }

  // For static assets: cache-first (faster)
  if(isStaticRequest(req)){
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => { caches.open(STATIC_CACHE).then(c=> c.put(req, resp.clone())); return resp; }).catch(()=> caches.match('/index.html')))
    );
    return;
  }

  // For dynamic data (APIs, sheets): network-first with short timeout fallback to cache
  event.respondWith(
    fetch(req, { cache: 'no-store' }).then(resp => {
      // store a copy for offline fallback
      const clone = resp.clone();
      caches.open(DYNAMIC_CACHE).then(c=> c.put(req, clone));
      return resp;
    }).catch(()=> caches.match(req)).catch(()=> new Response(null, { status: 504 }))
  );
});
