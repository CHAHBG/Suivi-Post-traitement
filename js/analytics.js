// analytics.js — lightweight analytics integration with GA4 support and localStorage fallback
(function(){
  'use strict';

  // Respect do-not-track
  const dnt = (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes' || navigator.msDoNotTrack === '1');
  if(typeof window !== 'undefined' && (window.__NO_TRACKING__ || dnt)){
    window.analytics = { enabled:false, trackPageview:()=>{}, getTotalVisits:()=>0 };
    return;
  }

  // Measurement id can be provided via window.CONFIG.GA_MEASUREMENT_ID or window.GA_MEASUREMENT_ID
  const MEASUREMENT_ID = (window.CONFIG && window.CONFIG.GA_MEASUREMENT_ID) || window.GA_MEASUREMENT_ID || 'G-XXXXXXX';

  let hasGtag = false;
  function loadGtag(id){
    if(!id || id === 'G-XXXXXXX') return;
    try{
      const s = document.createElement('script');
      s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      s.async = true;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      function gtag(){ window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', id, { send_page_view: false });
      hasGtag = true;
    }catch(e){ console.warn('GA load failed', e); }
  }

  // lightweight unique visitor counting (per browser) stored in localStorage
  function ensureVisitor() {
    try{
      const key = 'suivi_visitor_id_v1';
      let id = localStorage.getItem(key);
      if(!id){
        id = (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
        localStorage.setItem(key, id);
        // first time in this browser: increment public counter (local only)
        const totKey = 'suivi_site_visits_total_v1';
        const curr = Number(localStorage.getItem(totKey) || 0);
        localStorage.setItem(totKey, String(curr + 1));
      }
      return id;
    }catch(e){ return null; }
  }

  function getTotalVisitsLocal(){ try{ return Number(localStorage.getItem('suivi_site_visits_total_v1') || 0); }catch(e){ return 0; } }

  function trackPageview(path, title){
    try{
      const p = path || location.pathname + location.search + location.hash;
      const t = title || document.title || '';
      if(hasGtag && typeof window.gtag === 'function'){
        window.gtag('event', 'page_view', { page_path: p, page_title: t });
      } else {
        // fallback: store last view timestamp locally
        try{ localStorage.setItem('suivi_last_page_view', JSON.stringify({path:p,title:t,ts:Date.now()})); }catch(e){}
      }
    }catch(e){/* ignore */}
  }

  // initialize on DOMContentLoaded
  function init(){
    loadGtag(MEASUREMENT_ID);
    ensureVisitor();
    // auto-track first page load
    trackPageview();
    // expose API
    window.analytics = {
      enabled: true,
      trackPageview,
      getTotalVisits: getTotalVisitsLocal,
      measurementId: MEASUREMENT_ID
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
