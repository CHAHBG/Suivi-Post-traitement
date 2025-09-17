// Simple service worker to prefer network (network-first) and avoid serving stale cached content.
// Note: Service workers require HTTPS (or localhost) to register.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Only intercept same-origin requests to avoid CORS issues; allow cross-origin fetches by default
  try{
    const reqUrl = new URL(req.url);
    if(reqUrl.origin !== self.location.origin) return;
  }catch(e){ return; }

  // Network-first strategy: try network with no-cache; fallback to cache if offline
  event.respondWith(
    fetch(req, { cache: 'no-store' }).then(response => {
      return response;
    }).catch(() => caches.match(req))
  );
});
