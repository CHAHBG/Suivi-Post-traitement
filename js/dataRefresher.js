// dataRefresher.js
// Periodically fetch configured endpoints and emit a CustomEvent 'data:update' with the payload.
(function(){
    const DEFAULT_INTERVAL = 1000 * 60 * 5; // 5 minutes
    const endpoints = window.dataRefreshEndpoints || [];

    async function fetchEndpoint(ep){
        try{
            const u = new URL(ep, location.href);
            u.searchParams.set('_ts', Date.now());
            const res = await fetch(u.toString(), { cache: 'no-store', credentials: 'same-origin' });
            if(!res.ok) throw new Error('fetch failed');
            const json = await res.json();
            document.dispatchEvent(new CustomEvent('data:update', { detail: { url: ep, data: json } }));
        }catch(e){ console.warn('dataRefresher fetch failed', ep, e); }
    }

    async function refreshAll(){
        for(const ep of endpoints){ await fetchEndpoint(ep); }
    }

    // initial run
    setTimeout(()=>{ refreshAll(); }, 800);
    // periodic
    setInterval(()=>{ refreshAll(); }, window.dataRefreshInterval || DEFAULT_INTERVAL);

    // visibility change
    document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') refreshAll(); });

    // register a service worker if possible to prefer network
    if('serviceWorker' in navigator){
        navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('sw register failed', e));
    }
})();
