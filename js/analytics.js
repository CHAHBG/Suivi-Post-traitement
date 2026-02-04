/**
 * Analytics Module - Lightweight analytics with GA4 support and localStorage fallback
 * Respects user privacy preferences (Do Not Track)
 * 
 * @module analytics
 * @version 1.1.0
 */
(function(){
  'use strict';

  // Respect do-not-track browser setting
  const dnt = (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes' || navigator.msDoNotTrack === '1');
  if(typeof window !== 'undefined' && (window.__NO_TRACKING__ || dnt)){
    window.analytics = { enabled:false, trackPageview:()=>{}, getTotalVisits:()=>0 };
    return;
  }

  // Measurement ID from config (never hardcode actual IDs in source)
  // Placeholder 'G-XXXXXXX' indicates no measurement ID configured
  const MEASUREMENT_ID = (window.CONFIG && window.CONFIG.GA_MEASUREMENT_ID) || window.GA_MEASUREMENT_ID || 'G-XXXXXXX';

  let hasGtag = false;
  
  /**
   * Load Google Analytics gtag.js script
   * @param {string} id - GA4 Measurement ID
   */
  function loadGtag(id){
    // Don't load if placeholder ID or empty
    if(!id || id === 'G-XXXXXXX' || id.trim() === '') return;
    
    // Validate measurement ID format (G-XXXXXXXXXX)
    if(!/^G-[A-Z0-9]+$/i.test(id)) {
      console.warn('Analytics: Invalid measurement ID format');
      return;
    }
    
    try{
      const s = document.createElement('script');
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
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

  /**
   * Generate unique visitor ID stored in localStorage
   * Creates a new ID for first-time visitors
   */
  function ensureVisitor() {
    try{
      const key = 'suivi_visitor_id_v1';
      let id = localStorage.getItem(key);
      if(!id){
        // Generate cryptographically random ID when available, fallback to Math.random
        if (window.crypto && window.crypto.getRandomValues) {
          const array = new Uint32Array(2);
          window.crypto.getRandomValues(array);
          id = array[0].toString(36) + array[1].toString(36);
        } else {
          id = (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
        }
        localStorage.setItem(key, id);
        // First time in this browser: increment local counter
        const totKey = 'suivi_site_visits_total_v1';
        const curr = Number(localStorage.getItem(totKey) || 0);
        // Prevent unrealistic values
        if (curr >= 0 && curr < 1000000) {
          localStorage.setItem(totKey, String(curr + 1));
        }
      }
      return id;
    }catch(e){ return null; }
  }

  /**
   * Get total visits count from localStorage
   * @returns {number} Total visits count
   */
  function getTotalVisitsLocal(){ 
    try{ 
      const val = Number(localStorage.getItem('suivi_site_visits_total_v1') || 0);
      // Return 0 if value is unrealistic
      return (val >= 0 && val < 1000000) ? val : 0;
    }catch(e){ return 0; } 
  }

  /**
   * Track page view event
   * @param {string} path - Page path (defaults to current location)
   * @param {string} title - Page title (defaults to document.title)
   */
  function trackPageview(path, title){
    try{
      // Sanitize inputs
      const p = String(path || location.pathname + location.search + location.hash).substring(0, 500);
      const t = String(title || document.title || '').substring(0, 200);
      
      if(hasGtag && typeof window.gtag === 'function'){
        window.gtag('event', 'page_view', { page_path: p, page_title: t });
      } else {
        // Fallback: store last view timestamp locally
        try{ 
          localStorage.setItem('suivi_last_page_view', JSON.stringify({
            path: p,
            title: t,
            ts: Date.now()
          })); 
        }catch(e){}
      }
    }catch(e){/* ignore */}
  }

  /**
   * Initialize analytics on DOMContentLoaded
   */
  function init(){
    loadGtag(MEASUREMENT_ID);
    ensureVisitor();
    // Auto-track first page load
    trackPageview();
    // Expose API
    window.analytics = Object.freeze({
      enabled: true,
      trackPageview,
      getTotalVisits: getTotalVisitsLocal,
      measurementId: MEASUREMENT_ID
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
