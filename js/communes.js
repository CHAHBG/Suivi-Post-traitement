// communes.js — fetch Commune Status data and render a responsive table with filters and CSV export
(function(){
  const defaultUrl = window.communeStatusUrl || 'data/communeStatus.json';
  const tableBody = () => document.getElementById('communeTableBody');
  const regionFilter = () => document.getElementById('regionFilter');
  const searchInput = () => document.getElementById('searchInput');
  const exportBtn = () => document.getElementById('exportCsv');

  let communes = [];
  // client-side UI state
  let uiState = { page: 1, pageSize: 12, sortBy: 'name', compact: false };

  function safeNumber(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // --- Geomaticien contacts data (provided) ---
  // contact list — update photo paths to assets/<lowername>.jpg (ensure files exist in assets/)
  const GEOMATICIEN_CONTACTS = {
    'bamba':   { phone: '+221778023851', mail: 'cheikhabgn@gmail.com', photo: 'assets/Bamba.jpg' },
    'badara':  { phone: '+221771137547', mail: 'laiounegueye000@gmail.com', photo: 'assets/Badara.jpg' },
    'awa':     { phone: '+221773918399', mail: 'evatoure53@gmail.com', photo: 'assets/Awa.jpg' },
    'mariama': { phone: '+221779433856', mail: 'siremaria99@gmail.com', photo: 'assets/Mariama.jpg' },
    'dianke':  { phone: '+221782494512', mail: 'diankemendy03@gmail.com', photo: 'assets/Dianke.jpg' },
    'demba':   { phone: '+221770680324', mail: 'papaseck.dass@gmail.com', photo: 'assets/Demba.jpg' }
  };

  function normalizeNameForLookup(name){
    if(!name) return '';
    try{
      return String(name).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'_');
    }catch(e){
      return String(name).toLowerCase().replace(/[^a-z0-9]/g,'_');
    }
  }

  // Close modal helper (global) — cleans up trap, aria-hidden and focus
  function closeGeomaticienModal(){
    const modal = document.getElementById('geomaticienModal');
    const content = document.getElementById('geomaticienModalContent');
    const closeBtn = document.getElementById('geomaticienClose');
    if(modal) {
      // remove backdrop animation if present
      try{ const bd = modal.querySelector('.geomaticien-modal-backdrop'); if(bd) bd.classList.remove('geomaticien-backdrop-anim'); }catch(e){}
      modal.setAttribute('hidden','');
      // teardown dynamic content
      if(content){ content.innerHTML = ''; content.setAttribute('aria-hidden','true'); }
      if(closeBtn) closeBtn.style.display = 'none';
      // remove key trap if present
      try{ if(modal._trapKey){ document.removeEventListener('keydown', modal._trapKey); delete modal._trapKey; } }catch(e){}
      // restore aria-hidden on background
      try{ Array.from(document.body.children).forEach(c=>{ if(c.id !== 'geomaticienModal') c.removeAttribute('aria-hidden'); }); }catch(e){}
    }
    // restore previously focused element
    try{ if(window._prevActiveElem && typeof window._prevActiveElem.focus === 'function') window._prevActiveElem.focus(); }catch(e){}
    document.body.classList.remove('geomaticien-modal-open');
  }

  // Attach modal handlers after DOM
  document.addEventListener('DOMContentLoaded', function(){
    // delegate geomaticien link clicks; pass click position so modal can open near the clicked element
    document.body.addEventListener('click', function(e){
      const a = e.target.closest && e.target.closest('.geomaticien-link');
      if(!a) return;
      e.preventDefault();
      const name = a.getAttribute('data-name') || a.textContent || '';
      // compute a sensible anchor point (center of the clicked element)
      try{
        const rect = a.getBoundingClientRect();
        const coord = { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2) };
        openGeomaticienModal(name.trim(), coord);
      }catch(err){ openGeomaticienModal(name.trim()); }
    });

    const modal = document.getElementById('geomaticienModal');
    const backdrop = document.getElementById('geomaticienBackdrop');
    const closeBtn = document.getElementById('geomaticienClose');
    // delegate to global close helper to ensure full cleanup
    const closeModal = closeGeomaticienModal;
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    if(backdrop) backdrop.addEventListener('click', closeModal);
    // global Escape handler
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') closeGeomaticienModal(); });
  });

  function openGeomaticienModal(name, coord){
    if(!name) return;
    // try normalized lookup (handles accents / case / small variations)
  const key = normalizeNameForLookup(name);
  let data = GEOMATICIEN_CONTACTS[key] || null;
  // fallback: try plain lowercased name
  if(!data) data = GEOMATICIEN_CONTACTS[String(name).toLowerCase()] || null;
    // Build dynamic modal content inside #geomaticienModalContent
    const modal = document.getElementById('geomaticienModal');
    const content = document.getElementById('geomaticienModalContent');
    const closeBtn = document.getElementById('geomaticienClose');
  if(content){
      // populate markup
      const phoneHtml = (data && data.phone) ? `<a id="geomaticienPhone" href="tel:${data.phone.replace(/\s+/g,'')}">${escapeHtml(data.phone)}</a>` : `<a id="geomaticienPhone" href="#">N/A</a>`;
      const mailHtml = (data && data.mail) ? `<a id="geomaticienMail" href="mailto:${escapeHtml(data.mail)}">${escapeHtml(data.mail)}</a>` : `<a id="geomaticienMail" href="#">N/A</a>`;
      // compute initials for fallback
      const initials = escapeHtml((name||'').split(' ').map(s=>s[0]||'').slice(0,2).join('').toUpperCase());
      const avatarHtml = (data && data.photo) ?
        `<div class="geomaticien-avatar" id="geomaticienAvatar"><img src="${escapeHtml(data.photo)}" data-initials="${initials}" alt="Photo de ${escapeHtml(name)}" loading="lazy" decoding="async" onerror="this.style.display='none'; const p=this.parentNode; p.classList.add('geomaticien-no-photo'); if(!p.textContent) p.textContent=this.getAttribute('data-initials');"></div>` :
        `<div class="geomaticien-avatar geomaticien-no-photo" id="geomaticienAvatar">${initials}</div>`;
      content.innerHTML = `
        <div class="geomaticien-modal-panel" role="document">
          ${avatarHtml}
          <div class="geomaticien-card">
            <h3 id="geomaticienModalTitle">${escapeHtml(name)}</h3>
            <p class="small" id="geomaticienRegion"></p>
            <div class="geomaticien-contacts">
              <div class="contact-item"><span class="contact-icon" aria-hidden>📞</span> ${phoneHtml}</div>
              <div class="contact-item"><span class="contact-icon" aria-hidden>✉️</span> ${mailHtml}</div>
            </div>
          </div>
        </div>
      `;
    content.setAttribute('aria-hidden','false');
    // add animation classes
    const panel = content.querySelector('.geomaticien-modal-panel'); if(panel) panel.classList.add('geomaticien-fade-in');
    const avatarEl = content.querySelector('.geomaticien-avatar'); if(avatarEl) avatarEl.classList.add('anim');
      // show close button (outside content) for better hit area on mobile
      if(closeBtn) closeBtn.style.display = '';
    // no inner close button; outer close and backdrop will close the modal
    }
  if(modal){
      // save previous focus
      try{ window._prevActiveElem = document.activeElement; }catch(e){}
      modal.removeAttribute('hidden');
  // animate backdrop if present
  try{ const bd = modal.querySelector('.geomaticien-modal-backdrop'); if(bd) bd.classList.add('geomaticien-backdrop-anim'); }catch(e){}
      document.body.classList.add('geomaticien-modal-open');
      // hide background from assistive tech
      try{ Array.from(document.body.children).forEach(c=>{ if(c.id !== 'geomaticienModal') c.setAttribute('aria-hidden','true'); }); }catch(e){}
      // optionally position modal near click coordinate (if provided)
      try{
        const panelEl = content.querySelector('.geomaticien-modal-panel');
        if(coord && panelEl){
          // compute panel size and clamp to viewport
          const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
          const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
          // default offsets
          const pad = 12;
          // measure after render
          const rect = panelEl.getBoundingClientRect();
          let left = coord.x - rect.width/2;
          let top = coord.y - rect.height - 10; // prefer above the clicked point
          // if not enough space above, open below
          if(top < pad) top = coord.y + 10;
          // clamp horizontally
          left = Math.max(pad, Math.min(left, vw - rect.width - pad));
          top = Math.max(pad, Math.min(top, vh - rect.height - pad));
          panelEl.style.position = 'fixed';
          panelEl.style.left = left + 'px';
          panelEl.style.top = top + 'px';
          panelEl.style.transform = 'none';
          panelEl.classList.add('geomaticien-floating');
        }
      }catch(e){}

      // focus first focusable inside modal
      try{
        const focusable = content.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if(focusable && focusable.length) { focusable[0].focus(); }
      }catch(e){}
      // trap Tab key inside modal
      const trapKey = function(ev){
        if(ev.key !== 'Tab') return;
        const focusables = Array.from(content.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(n=> n.offsetParent !== null);
        if(!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length-1];
        if(ev.shiftKey){ if(document.activeElement === first){ ev.preventDefault(); last.focus(); } }
        else { if(document.activeElement === last){ ev.preventDefault(); first.focus(); } }
      };
      modal._trapKey = trapKey;
      document.addEventListener('keydown', trapKey);
    }
  }

  function tryParseRow(row){
    // normalize common keys (allow multiple header names)
    return {
      Commune: row['Commune'] || row['commune'] || row['COMMUNE'] || row['Commune Name'] || '',
      Région: row['Région'] || row['Region'] || row['region'] || row['Région Name'] || '',
      Total: safeNumber(row['Total Parcelles'] || row['Total'] || row['total_parcelles'] || row['total'] || row['Parcelles Totales']),
      NICAD: safeNumber(row['NICAD'] || row['Nicad'] || row['nicad'] || row['NICAD Parcelles']),
      CTASF: safeNumber(row['CTASF'] || row['Ctasf'] || row['ctasf']),
      Délibérées: safeNumber(row['Délibérées'] || row['Deliberees'] || row['deliberees']),
      Parcelles_brutes: safeNumber(row['Parcelles brutes'] || row['Parcelles brutes'] || row['parcelles_brutes']),
      Parcelles_collectees: safeNumber(row['Parcelles collectées (sans doublon géométrique)'] || row['Parcelles collectées'] || row['collectees']),
      Parcelles_retenues: safeNumber(row['Parcelles retenues après post-traitement'] || row['Parcelles retenues'] || row['retenues']),
      Parcelles_validees: safeNumber(row['Parcelles validées par l’URM'] || row['Parcelles validées'] || row['validees']),
      Geomaticien: row['Geomaticien'] || row['Geomaticien'] || row['geomaticien'] || row['Operator'] || '',
      Individuelles: safeNumber(row['Parcelles individuelles jointes'] || row['Individuelles'] || row['individuelles']),
      Collectives: safeNumber(row['Parcelles collectives jointes'] || row['Collectives'] || row['collectives']),
      Non_jointes: safeNumber(row['Parcelles non jointes'] || row['Non jointes'] || row['non_jointes'])
    };
  }

  function formatNumber(n){ return n.toLocaleString(); }

  // Normalize key similar to dashboard's normalizeKey (remove diacritics, non-alnum, lowercase)
  function normalizeKey(k){ if(k===undefined || k===null) return ''; try{ return String(k).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'').trim(); }catch(e){ return String(k).toLowerCase().replace(/[^a-z0-9]/g,'').trim(); } }

  // Normalize rows: accept array-of-objects or array-of-arrays with headers
  function normalizeRows(rows){
    if(!rows || !rows.length) return [];
    // If rows are arrays (first row headers)
    if (Array.isArray(rows[0]) ){
      const hdr = rows[0].map(h=> normalizeKey(h||''));
      return rows.slice(1).map(r=>{ const obj={}; hdr.forEach((h,i)=> obj[h] = r[i] != null ? r[i] : ''); return obj; });
    }
    // else assume array of objects: normalize keys
    return rows.map(raw=>{ const obj={}; Object.keys(raw||{}).forEach(k=> obj[normalizeKey(k)] = raw[k]); return obj; });
  }

  // Fetch CSV by GID (mimic the logic used in index.html getRows)
  async function fetchCsvByGid(gid){
    try{
      const base = (window.CONFIG && window.CONFIG.SHEETS_BASE_URL) ? window.CONFIG.SHEETS_BASE_URL : 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=';
      const url = base + gid;
      const resp = await fetch(url, {cache: 'no-cache'});
      if (!resp || !resp.ok) return [];
      const text = await resp.text();
      const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(Boolean);
      if(!lines.length) return [];
      const sample = lines.slice(0,4).join('\n');
      const delimiter = (sample.includes(';') && !sample.includes(',')) ? ';' : ',';
      const parseLine = (line)=>{
        const out=[]; let cur=''; let inQuotes=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'){ if(inQuotes && line[i+1]==='"'){ cur+='"'; i++; } else { inQuotes=!inQuotes; } } else if(ch===delimiter && !inQuotes){ out.push(cur); cur=''; } else { cur+=ch; } } out.push(cur); return out.map(s=>s.trim().replace(/^"|"$/g,''));
      };
      const rows = lines.map(l=> parseLine(l));
      return rows;
    }catch(err){ console.warn('CSV fetch failed', err); return []; }
  }

  // Convert normalized row object into the commune model used for cards
  function parseNormalizedRow(n){
    // Helper to try multiple possible normalized keys
    function getNum(obj, candidates){
      for(const k of candidates){ if(obj.hasOwnProperty(k) && obj[k] !== ''){ const s = String(obj[k]).replace(/[^0-9.-]/g,''); const v = Number(s); if(Number.isFinite(v)) return v; } }
      return 0;
    }

    // Parse a value that may be an absolute number or a percentage string (comma decimal, with %)
    function parsePotentialPercent(rawValue, total){
      if(rawValue === undefined || rawValue === null) return { isPercent: false, percent: null, count: 0 };
      // keep original
      let s = String(rawValue).trim();
      // remove spaces and non-essential chars but keep comma/dot and percent
      if(s === '') return { isPercent:false, percent:null, count:0 };
      // replace comma decimal with dot for parsing
      const cleaned = s.replace(/\s/g,'').replace(',', '.').replace('%','');
      const p = Number(cleaned);
      if(Number.isFinite(p)){
        // Heuristic: if value looks like a percentage (<= 100) treat as percent
        if(p <= 100 && total && total > 0){
          const count = Math.round((total * p) / 100);
          return { isPercent: true, percent: p, count };
        }
        // otherwise treat as absolute count
        return { isPercent: false, percent: null, count: Math.round(p) };
      }
      return { isPercent:false, percent:null, count:0 };
    }

    const out = {
      Commune: n['commune'] || n['commune_name'] || n['name'] || n['nom'] || '',
      Région: n['region'] || n['regionname'] || n['region_nom'] || n['r'] || '',
      Total: getNum(n, ['totalparcelles','total','parcelles','parcelles_totales','parcellesbrutes']),
      // NICAD and CTASF may be provided as percentages (e.g. '89,6') — compute absolute counts when appropriate
      NICAD: 0,
      NICAD_pct: null,
      NICAD_count: 0,
      CTASF: 0,
      CTASF_pct: null,
      CTASF_count: 0,
      Délibérées: getNum(n, ['deliberees','deliberee','deliberes','deliberesparcelles']),
      Parcelles_brutes: getNum(n, ['parcellesbrutes','parcelles_brutes','parcelles_brutes_totale','parcelles_brutes_raw']),
      Parcelles_collectees: getNum(n, ['parcellescollectees','parcelles_collectees','collectees','parcelles_collectees_sans_doublon_geometrique','collecte']),
      Parcelles_retenues: getNum(n, ['parcellesretenues','parcelles_retenues','retenues','post_traitement_retenues']),
      Parcelles_validees: getNum(n, ['parcellesvalidees','parcelles_validees','validees','parcelles_valides']),
      Geomaticien: n['geomaticien'] || n['geomaticien'] || n['operator'] || n['operateur'] || '',
      Individuelles: getNum(n, ['parcellesindividuellesjointes','individuelles','parcelles_individuelles','individuelle']),
      Collectives: getNum(n, ['parcellescollectivesjointes','collectives','parcelles_collectives']),
      Non_jointes: getNum(n, ['parcellesnonjointes','nonjointes','non_jointes','sans_jointure'])
    };
    // post-process NICAD / CTASF to detect percentage-like inputs
    try{
      const total = out.Total || 0;
  const rawNicad = (n['nicad'] !== undefined) ? n['nicad'] : (n['nicad_parcelles'] !== undefined ? n['nicad_parcelles'] : (n['parcelles_nicad'] !== undefined ? n['parcelles_nicad'] : ''));
      const nic = parsePotentialPercent(rawNicad, total);
      out.NICAD_pct = nic.isPercent ? nic.percent : null;
      out.NICAD_count = nic.count;
      out.NICAD = out.NICAD_count;
  out.NICAD_raw = rawNicad;

  const rawCt = (n['ctasf'] !== undefined) ? n['ctasf'] : (n['ctasf_parcelles'] !== undefined ? n['ctasf_parcelles'] : '');
      const ct = parsePotentialPercent(rawCt, total);
      out.CTASF_pct = ct.isPercent ? ct.percent : null;
      out.CTASF_count = ct.count;
      out.CTASF = out.CTASF_count;
  out.CTASF_raw = rawCt;
    }catch(e){ /* ignore */ }
    return out;
  }

  // Centralized function to acquire commune rows using the same order as the dashboard
  async function getCommuneRows(){
    // 1) helper from global
    if(typeof window.fetchCommuneStatus === 'function'){
      try{ const r = await window.fetchCommuneStatus(); if(r && r.length) return normalizeRows(r); }catch(e){ console.warn('fetchCommuneStatus failed', e); }
    }

    // 2) check enhancedDashboard.rawData
    if(window.enhancedDashboard && window.enhancedDashboard.rawData){
      const candidates = ['Commune Analysis','Commune Status','Commune'];
      for(const key of candidates){ const val = window.enhancedDashboard.rawData[key]; if(val && val.length) return normalizeRows(val); }
    }

    // 3) Try CSV fetch by gid (same gid used by dashboard)
    try{
      const gid = '1421590976';
      const csvRows = await fetchCsvByGid(gid);
      if(csvRows && csvRows.length) return normalizeRows(csvRows);
    }catch(e){ /* ignore */ }

    // 4) Try JSON endpoints
    if(window.communeStatusUrl){ try{ const resp = await fetch(window.communeStatusUrl, {cache:'no-store'}); if(resp && resp.ok){ const p = await resp.json(); return normalizeRows(Array.isArray(p)?p:(p.data||p.rows||[])); } }catch(e){ console.warn('communeStatusUrl fetch failed', e); } }
    try{ const local = await fetch(defaultUrl, {cache:'no-store'}); if(local && local.ok){ const p = await local.json(); return normalizeRows(Array.isArray(p)?p:(p.data||p.rows||[])); } }catch(e){ /* ignore */ }

    // 5) fallback to DOM table
    const live = rowsFromLiveTable(); if(live && live.length) return normalizeRows(live);

    return [];
  }

  // Render as card grid matching the provided KPI visuals
  function renderTable(data){
    const grid = document.getElementById('communesGrid');
    const noData = document.getElementById('communesNoData');
    if(!grid) return;
    if(!data || !data.length){ grid.innerHTML = ''; if(noData) { noData.classList.remove('hidden'); } return; }
    if(noData) noData.classList.add('hidden');
    // apply pagination & sorting
    const sorted = applySort(data.slice());
    const pageSize = uiState.pageSize || 12;
    const page = Math.max(1, Math.min(uiState.page, Math.ceil(sorted.length / pageSize) || 1));
    uiState.page = page;
    const start = (page-1)*pageSize; const end = start + pageSize;
    const pageRows = sorted.slice(start, end);
    grid.innerHTML = pageRows.map((r, idx)=> renderCommuneCard(r, start+idx)).join('');
    renderPagination(sorted.length, page, pageSize);
    // apply region classes and staggered reveal
    const cards = Array.from(grid.querySelectorAll('.commune-card'));
    cards.forEach((c,i)=>{
      const region = (c.dataset.region||'').toLowerCase().replace(/[^a-z0-9]/g,'');
      if(region) c.classList.add('region-'+region);
      c.style.setProperty('--i', i);
      c.classList.remove('is-visible');
    });
    // respect reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!prefersReduced){
      cards.forEach((c,i)=> setTimeout(()=> c.classList.add('is-visible'), i * 60));
    } else { cards.forEach(c=> c.classList.add('is-visible')); }
    populateLegend();
  }

  // Helper to render a single commune card (keeps template generation in one place)
  function renderCommuneCard(r, idx){
    // Compact mode: only show Commune name, Total, NICAD, CTASF and Geomaticien
    if (uiState && uiState.compact) {
      return `
        <article class="commune-card compact" data-region="${escapeHtml(r.Région)}" style="animation-delay:${(idx%10)*40}ms">
          <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-weight:700;font-size:1.05rem">${escapeHtml(r.Commune)}</div>
            <div style="font-size:0.78rem;padding:6px 10px;border-radius:12px;background:linear-gradient(90deg,#ffd9b8,#ffd59a);color:#6b3f0b;font-weight:700">${escapeHtml(r.Région)}</div>
          </header>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
            <div style="flex:1;text-align:center">
              <div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.Total)}</div>
              <div class="kpi-label">Total</div>
            </div>
            <div style="flex:1;text-align:center">
              <div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.NICAD)}</div>
              <div class="kpi-label">NICAD</div>
            </div>
            <div style="flex:1;text-align:center">
              <div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.CTASF)}</div>
              <div class="kpi-label">CTASF</div>
            </div>
          </div>
          <div style="text-align:center;padding:8px;border-radius:10px;background:linear-gradient(90deg,#6d28d9,#7c3aed);color:white;font-weight:700">${escapeHtml(r.Geomaticien)}</div>
        </article>
      `;
    }

    // Full card (default)
    return `
      <article class="commune-card" data-region="${escapeHtml(r.Région)}" style="animation-delay:${(idx%10)*40}ms">
        <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:1.05rem">${escapeHtml(r.Commune)}</div>
          <div style="font-size:0.78rem;padding:6px 10px;border-radius:16px;background:linear-gradient(90deg,#ffd9b8,#ffd59a);color:#6b3f0b;font-weight:700">${escapeHtml(r.Région)}</div>
        </header>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
          <div class="kpi-small"><div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.Total)}</div><div class="kpi-label">Total</div></div>
          <div class="kpi-small">
            <div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.NICAD)}</div>
            <div class="kpi-label">NICAD</div>
            ${r.NICAD_pct != null ? `<div class="kpi-pct ${pctClass(r.NICAD_pct)}">${String(r.NICAD_pct).replace('.', ',')}%</div>` : ''}
          </div>
          <div class="kpi-small">
            <div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.CTASF)}</div>
            <div class="kpi-label">CTASF</div>
            ${r.CTASF_pct != null ? `<div class="kpi-pct ${pctClass(r.CTASF_pct)}">${String(r.CTASF_pct).replace('.', ',')}%</div>` : ''}
          </div>
          <div class="kpi-small"><div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.Délibérées)}</div><div class="kpi-label">Délibérées</div></div>
          <div class="kpi-small"><div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.Parcelles_collectees)}</div><div class="kpi-label">Collectées</div></div>
          <div class="kpi-small"><div class="kpi-value">${new Intl.NumberFormat('fr-FR').format(r.Parcelles_validees)}</div><div class="kpi-label">Validées</div></div>
        </div>

        <div style="background:linear-gradient(180deg,#eef2ff,#f8f9ff);padding:10px;border-radius:10px;margin-bottom:14px;border-left:4px solid rgba(99,102,241,0.3)">
          <div style="font-size:0.9rem;font-weight:700;margin-bottom:6px">Parcelles jointes</div>
          <div style="display:flex;gap:14px;justify-content:space-between">
            <div style="text-align:center"><div style="font-weight:700;color:#4f46e5">${new Intl.NumberFormat('fr-FR').format(r.Individuelles)}</div><div class="small">Individuelles</div></div>
            <div style="text-align:center"><div style="font-weight:700;color:#4f46e5">${new Intl.NumberFormat('fr-FR').format(r.Collectives)}</div><div class="small">Collectives</div></div>
            <div style="text-align:center"><div style="font-weight:700;color:#4f46e5">${new Intl.NumberFormat('fr-FR').format(r.Non_jointes)}</div><div class="small">Non jointes</div></div>
          </div>
        </div>

        <a href="#" class="geomaticien-link" data-name="${escapeHtml(r.Geomaticien)}" style="display:block;text-align:center;padding:10px;border-radius:12px;background:linear-gradient(90deg,#6d28d9,#7c3aed);color:white;font-weight:700;text-decoration:none">👨‍💻 Geomaticien: ${escapeHtml(r.Geomaticien)}</a>
      </article>
    `;
  }

  function applySort(arr){
    const key = uiState.sortBy || 'name';
    switch(key){
      case 'total-desc': return arr.sort((a,b)=> b.Total - a.Total);
      case 'total-asc': return arr.sort((a,b)=> a.Total - b.Total);
      case 'nicad-desc': return arr.sort((a,b)=> b.NICAD - a.NICAD);
      case 'name': default: return arr.sort((a,b)=> (a.Commune||'').localeCompare(b.Commune||''));
    }
  }

  function renderPagination(total, page, pageSize){
    let pager = document.getElementById('communePager');
    if(!pager){ pager = document.createElement('div'); pager.id = 'communePager'; pager.style.marginTop='12px'; const container = document.querySelector('.table-wrap'); container.appendChild(pager); }
    const totalPages = Math.max(1, Math.ceil(total/pageSize));
    pager.innerHTML = `<div style="display:flex;gap:8px;align-items:center;justify-content:center"><button id="prevPage" class="btn btn-ghost">Prev</button><span class="small">Page ${page} / ${totalPages}</span><button id="nextPage" class="btn btn-ghost">Next</button></div>`;
    document.getElementById('prevPage').disabled = page<=1; document.getElementById('nextPage').disabled = page>=totalPages;
    document.getElementById('prevPage').addEventListener('click', ()=>{ uiState.page = Math.max(1, uiState.page-1); applyFilters(); });
    document.getElementById('nextPage').addEventListener('click', ()=>{ uiState.page = Math.min(totalPages, uiState.page+1); applyFilters(); });
  }

  function regionIconFor(name){ if(!name) return '🏙️'; const s = (name||'').toLowerCase(); if(s.includes('kedoug')) return '⛰️'; if(s.includes('tambac')) return '🌾'; if(s.includes('kedougou')) return '⛰️'; if(s.includes('tambacounda')) return '🌾'; return '🏘️'; }

  // Helper to determine class for percent coloring
  function pctClass(p){
    const val = Number(String(p).replace(',','.'));
    if(!Number.isFinite(val)) return '';
    if(val < 50) return 'pct-low';
    if(val < 80) return 'pct-warn';
    return 'pct-ok';
  }

  function updateSummaryCards(list){
    const totalCommunes = (list||[]).length;
    const totalParcelles = (list||[]).reduce((s,c)=> s + (Number(c.Total)||0), 0);
    const totalNicad = (list||[]).reduce((s,c)=> s + (Number(c.NICAD)||0), 0);
    const elComm = document.getElementById('total-communes'); if(elComm) elComm.textContent = totalCommunes;
    const elPar = document.getElementById('total-parcelles'); if(elPar) elPar.textContent = new Intl.NumberFormat('fr-FR').format(totalParcelles);
    const elNic = document.getElementById('total-nicad'); if(elNic) elNic.textContent = new Intl.NumberFormat('fr-FR').format(Math.round(totalNicad*10)/10);
  }

  // Expose a function to compute and return the currently visible rows after filters/sort/pagination
  function getVisibleRows(){
    let rows = communes.slice();
    const regionEl = document.getElementById('regionFilter');
    const region = regionEl ? regionEl.value : null;
    const searchEl = document.getElementById('searchInput');
    const search = searchEl ? (searchEl.value||'').trim().toLowerCase() : '';
    if(region && region !== 'all') rows = rows.filter(r=> (r.Région||'').toLowerCase() === region.toLowerCase());
    if(search) rows = rows.filter(r=> ((r.Commune||'') + ' ' + (r.Geomaticien||'')).toLowerCase().includes(search));
    const sorted = applySort(rows);
    const pageSize = uiState.pageSize || 12;
    const page = Math.max(1, Math.min(uiState.page, Math.ceil(sorted.length / pageSize) || 1));
    const start = (page-1)*pageSize; const end = start + pageSize;
    return sorted.slice(start, end);
  }

  function downloadFiltered(){
    const visible = getVisibleRows();
    if(!visible || !visible.length){ alert('Aucune ligne visible à exporter'); return; }
    const headers = ['Commune','Région','Total Parcelles','NICAD_raw','NICAD_pct','NICAD_count','CTASF_raw','CTASF_pct','CTASF_count','Délibérées','Parcelles brutes','Parcelles collectées','Parcelles retenues','Parcelles validées URM','Geomaticien','Individuelles jointes','Collectives jointes','Non jointes'];
    const csv = toCsvWithHeaders(visible, headers);
    downloadText(csv, 'communes-filtered.csv');
  }

  function toCsv(rows){
    // deprecated: use toCsvWithHeaders for deterministic ordering
    if(!rows || !rows.length) return '';
    const keys = Object.keys(rows[0]);
    return toCsvWithHeaders(rows, keys);
  }

  function toCsvWithHeaders(rows, headers){
    if(!rows || !rows.length) return '';
    const esc = v=> '"'+String(v||'').replace(/"/g,'""')+'"';
    const header = headers.map(esc).join(',');
    const lines = rows.map(r=> headers.map(k=> esc(r[k] !== undefined ? r[k] : '')).join(','));
    return [header].concat(lines).join('\n');
  }

  function downloadText(text, filename){
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // wire controls after DOM loaded
  function wireControls(){
    const sortBy = document.getElementById('sortBy');
    const pageSize = document.getElementById('pageSize');
    const exportFilteredBtn = document.getElementById('exportFiltered');
    const exportAllBtn = document.getElementById('exportAll');
    const compactToggle = document.getElementById('compactToggle');
    const ctasfOnly = document.getElementById('ctasfOnly');
    if(sortBy){ sortBy.addEventListener('change', (e)=>{ uiState.sortBy = e.target.value; uiState.page = 1; applyFilters(); }); }
    if(pageSize){ pageSize.addEventListener('change', (e)=>{ uiState.pageSize = parseInt(e.target.value||12,10); uiState.page = 1; applyFilters(); }); }
    if(exportFilteredBtn){ exportFilteredBtn.addEventListener('click', downloadFiltered); }
    if(exportAllBtn){ exportAllBtn.addEventListener('click', ()=>{ const csv = toCsv(communes); downloadText(csv, 'communes-all.csv'); }); }
    if(compactToggle){
      // make the Compact control toggle the compact UI state
      compactToggle.setAttribute('aria-pressed', String(!!uiState.compact));
      compactToggle.addEventListener('click', (e)=>{
        uiState.compact = !uiState.compact;
        compactToggle.setAttribute('aria-pressed', String(!!uiState.compact));
        compactToggle.textContent = uiState.compact ? 'Compact: ON' : 'Compact';
        // re-render with new compact state
        applyFilters();
      });
    }
    if(ctasfOnly){ ctasfOnly.addEventListener('change', ()=>{ uiState.page = 1; applyFilters(); }); }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  function populateRegionFilter(list){
    const regions = Array.from(new Set(list.map(r=>r.Région).filter(Boolean))).sort();
    const sel = regionFilter();
    sel.innerHTML = '<option value="all">Toutes régions</option>' + regions.map(r=> `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    // also update legend
    const unique = regions.map(r=> r.trim()).filter(Boolean);
    const legendEl = document.getElementById('regionLegend');
    if(legendEl){ legendEl.innerHTML = unique.map(r=> {
      const slug = r.toLowerCase().replace(/[^a-z0-9]/g,'');
      const cls = 'region-pill--' + (slug || 'other');
      return `<div class="legend-item"><span class="legend-swatch ${cls}" style="background:var(--legend-${slug})"></span><span>${escapeHtml(r)}</span></div>`;
    }).join(''); }
  }

  // Populate legend using a default palette if CSS vars are missing
  function populateLegend(){
    const legendEl = document.getElementById('regionLegend'); if(!legendEl) return;
    // If legend already has children, keep it (populateRegionFilter handles most cases)
    if(legendEl.children && legendEl.children.length) return;
    // fallback simple legend
    const palette = [{k:'kedougou',c:'#FFE8E8'},{k:'tambacounda',c:'#FFF4E6'},{k:'dakar',c:'#ECFCCB'},{k:'kedoug',c:'#EFF6FF'}];
    legendEl.innerHTML = palette.map(p=> `<div class="legend-item"><span class="legend-swatch" style="background:${p.c}"></span><span>${p.k}</span></div>`).join('');
  }

  function applyFilters(){
    const region = regionFilter().value;
    const q = (searchInput().value||'').toLowerCase().trim();
    const geomQ = (document.getElementById('searchGeom')||{}).value || '';
    const ctasfOnly = (document.getElementById('ctasfOnly')||{}).checked;
    let out = communes.slice();
    if(region && region !== 'all') out = out.filter(r=> (r.Région||'').toLowerCase() === region.toLowerCase());
    if(q) out = out.filter(r=> ((r.Commune||'') + ' ' + (r.Geomaticien||'')).toLowerCase().includes(q));
    if(geomQ) out = out.filter(r=> (r.Geomaticien||'').toLowerCase().includes(geomQ.toLowerCase()));
    if(ctasfOnly) out = out.filter(r=> Number(r.CTASF) > 0);
    renderTable(out);
  }

  function downloadCsv(){
    if(!communes.length) return;
    // Deterministic headers: include raw inputs and computed counts
    const headers = ['Commune','Région','Total Parcelles','NICAD_raw','NICAD_pct','NICAD_count','CTASF_raw','CTASF_pct','CTASF_count','Délibérées','Parcelles brutes','Parcelles collectées','Parcelles retenues','Parcelles validées URM','Geomaticien','Individuelles jointes','Collectives jointes','Non jointes'];
    const rows = communes.map(r => [
      r.Commune,
      r.Région,
      r.Total,
      // raw fields: we attempt to keep original pct strings if available
      (r.NICAD_pct != null ? (r.NICAD_pct + '%') : (r.NICAD_raw || '')),
      (r.NICAD_pct != null ? r.NICAD_pct : ''),
      r.NICAD,
      (r.CTASF_pct != null ? (r.CTASF_pct + '%') : (r.CTASF_raw || '')),
      (r.CTASF_pct != null ? r.CTASF_pct : ''),
      r.CTASF,
      r.Délibérées,
      r.Parcelles_brutes,
      r.Parcelles_collectees,
      r.Parcelles_retenues,
      r.Parcelles_validees,
      r.Geomaticien,
      r.Individuelles,
      r.Collectives,
      r.Non_jointes
    ]);
    const csv = [headers].concat(rows).map(row=> row.map(cell=> `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `communes_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  async function fetchData(){
    try{
      const rawRows = await getCommuneRows();
      if(rawRows && rawRows.length){
        const normalized = normalizeRows(rawRows);
  communes = normalized.map(n=> parseNormalizedRow(n)).sort((a,b)=> b.Total - a.Total);
  populateRegionFilter(communes);
  applyFilters();
  updateSummaryCards(communes);
        return;
      }

      console.warn('No commune data source returned results.');
      const grid = document.getElementById('communesGrid'); if(grid) grid.innerHTML = '';
      const noData = document.getElementById('communesNoData'); if(noData) noData.classList.remove('hidden');

      if(!window.dashboardInitialized){
        let attempts = 0; const maxAttempts = 10;
        const interval = setInterval(()=>{
          attempts++;
          if(window.dashboardInitialized){ clearInterval(interval); console.info('Dashboard initialized — retrying commune data fetch'); fetchData(); }
          else if(attempts>=maxAttempts){ clearInterval(interval); console.info('Stopped waiting for dashboard initialization (no data).'); }
        }, 1000);
      }
    }catch(err){
      console.error('Failed to load communes data', err);
      const noData = document.getElementById('communesNoData'); if(noData) noData.classList.remove('hidden');
    }
  }

  // Read any existing table that was rendered elsewhere (e.g. liveCommuneTable)
  function rowsFromLiveTable(){
    try{
      const table = document.getElementById('liveCommuneTable');
      if(!table) return [];
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');
      if(!thead || !tbody) return [];
      const headers = Array.from(thead.querySelectorAll('th')).map(th => (th.dataset.key || th.textContent||'').trim());
      const rows = Array.from(tbody.querySelectorAll('tr')).map(tr=>{
        const cells = Array.from(tr.children).map(td => td.textContent.trim());
        const obj = {};
        headers.forEach((h,i)=> obj[h||`col${i}`] = cells[i] || '');
        return obj;
      });
      return rows;
    }catch(e){ return []; }
  }

  // wire events
  document.addEventListener('DOMContentLoaded', ()=>{
    const rf = regionFilter(); const si = searchInput(); const ex = exportBtn();
    if(rf) rf.addEventListener('change', applyFilters);
    if(si) si.addEventListener('input', applyFilters);
    if(ex) ex.addEventListener('click', downloadCsv);

  // wire the added controls (sort/page/export/compact)
  try{ wireControls(); }catch(e){ console.warn('wireControls failed', e); }

    // support data:update events from dataRefresher
    window.addEventListener('data:update', e=>{
      try{
        const payload = e.detail;
        if(payload && payload.url && payload.data){
          // if the event contains tasks/rows for Commune Status, refresh
          const possible = payload.data;
          if(Array.isArray(possible) || possible.data || possible.rows){
            // replace communes and rerender
            let rows = Array.isArray(possible) ? possible : (possible.data || possible.rows || []);
            communes = rows.map(tryParseRow).sort((a,b)=> b.Total - a.Total);
            populateRegionFilter(communes);
            applyFilters();
          }
        }
      }catch(_){ }
    });

    fetchData();
  });

  // Expose fetchData for external callers (FAB, other scripts)
  try{ window.fetchData = fetchData; }catch(e){ /* ignore in strict environments */ }

})();
