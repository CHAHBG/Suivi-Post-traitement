// communePanel.js - Commune table and KPIs (charts removed per requested simplification)

(function(){
    function average(arr){ if(!arr||!arr.length) return 0; return Math.round((arr.reduce((a,b)=>a+(Number(b)||0),0)/arr.length)*10)/10; }

    async function fetchCsvByGid(gid){
        try{
            const base = (window.CONFIG && window.CONFIG.SHEETS_BASE_URL) ? window.CONFIG.SHEETS_BASE_URL : 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=';
            const url = base + gid;
            const resp = await fetch(url, {cache: 'no-cache'});
            if (!resp || !resp.ok) return [];
            const text = await resp.text();
            // Improved CSV parse supporting quoted fields and commas/newlines inside quotes (simple RFC4180-ish)
            const rows = [];
            let cur = '';
            let inQuotes = false;
            const lines = [];
            for (let i=0;i<text.length;i++){
                const ch = text[i];
                cur += ch;
                if (ch === '"') {
                    // toggle quote state unless it's an escaped quote
                    if (i+1 < text.length && text[i+1] === '"') { cur += '"'; i++; continue; }
                    inQuotes = !inQuotes;
                }
                if (!inQuotes && ch === '\n') {
                    lines.push(cur.replace(/\r?\n$/,''));
                    cur = '';
                }
            }
            if (cur.length) lines.push(cur);

            if (!lines.length) return [];

            // Detect delimiter by checking header line
            const headerLine = lines[0];
            const delimiter = headerLine.indexOf(';') !== -1 && headerLine.indexOf(',') === -1 ? ';' : ',';

            const parseLine = (ln) => {
                const out = [];
                let field = '';
                let inside = false;
                for (let j=0;j<ln.length;j++){
                    const c = ln[j];
                    if (c === '"') {
                        if (inside && j+1 < ln.length && ln[j+1] === '"') { field += '"'; j++; continue; }
                        inside = !inside; continue;
                    }
                    if (!inside && c === delimiter) { out.push(field); field = ''; continue; }
                    field += c;
                }
                out.push(field);
                return out.map(f=>f.trim().replace(/^"|"$/g,''));
            };

            const headers = parseLine(lines[0]);
            for (let i=1;i<lines.length;i++){
                const vals = parseLine(lines[i]);
                if (vals.length === 1 && !vals[0]) continue;
                const obj = {};
                headers.forEach((h, idx) => obj[h] = vals[idx] !== undefined ? vals[idx] : '');
                rows.push(obj);
            }
            return rows;
        }catch(err){ console.warn('CSV fetch failed', err); return []; }
    }

    async function getRows(){
        try{
            if (window.fetchCommuneStatus) {
                const r = await window.fetchCommuneStatus();
                if (r && r.length) return r;
            }
            if (window.enhancedDashboard && window.enhancedDashboard.rawData) {
                const r = window.enhancedDashboard.rawData['Commune Analysis'] || window.enhancedDashboard.rawData['Commune Status'] || [];
                if (r && r.length) return r;
            }
            const gid = '1421590976';
            const csvRows = await fetchCsvByGid(gid);
            if (csvRows && csvRows.length) return csvRows;
            return [];
        } catch(e){ console.warn('getRows error', e); return []; }
    }

    function setLoading(visible){
        const el = document.getElementById('communeTableLoader'); if(el) el.style.display = visible ? 'flex' : 'none';
    }
    function setNoData(hasNo){
        const nod = document.getElementById('communeTableNoData'); if(nod) nod.style.display = hasNo ? 'flex' : 'none';
        const ldr = document.getElementById('communeTableLoader'); if(ldr && hasNo) ldr.style.display='none';
    }

    function normalizeKey(key) {
        return String(key || '').toLowerCase()
            .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '')
            .trim();
    }

    function normalizeRows(rows) {
        // If rows are empty or not an array, return as-is
        if (!rows || !rows.length) return rows;

        // Build mapping from original header -> unique normalized key
        const first = rows[0];
        const mapping = {};
        const used = {};
        Object.keys(first).forEach(orig => {
            const base = normalizeKey(orig);
            let finalKey = base;
            if (used[finalKey]) {
                const low = String(orig || '').toLowerCase();
                if (low.includes('%') || low.includes('pourcentage') || low.includes('pct') || /\bpercent/i.test(low)) {
                    finalKey = base + '_pct';
                } else {
                    let i = 2;
                    while (used[finalKey]) { finalKey = base + '_' + i; i++; }
                }
            }
            used[finalKey] = true;
            mapping[orig] = finalKey;
        });

        // Apply mapping to every row
        return rows.map(row => {
            const normalizedRow = {};
            Object.keys(row).forEach(orig => {
                const finalKey = mapping.hasOwnProperty(orig) ? mapping[orig] : normalizeKey(orig);
                normalizedRow[finalKey] = row[orig];
            });
            return normalizedRow;
        });
    }

    function buildTable(rows){
        // store current rows for re-render after reorder
        buildTable._currentRows = rows;
        const head = document.getElementById('liveCommuneHead');
        const body = document.getElementById('liveCommuneBody');
        if (!head || !body) return;
        head.innerHTML = ''; body.innerHTML = '';
        if (!rows || !rows.length) {
            head.innerHTML = '<tr><th class="px-6 py-3">Aucune donnée</th></tr>';
            return;
        }

        // Respect persisted column order if available
        const savedOrderKey = 'communes_table_order';
        const detected = Object.keys(rows[0]);
        let cols = detected.slice();
        try{
            const saved = localStorage.getItem(savedOrderKey);
            if (saved) {
                const arr = JSON.parse(saved);
                // keep only columns that exist in detected, append any new detected cols
                cols = arr.filter(a => detected.includes(a)).concat(detected.filter(d => !arr.includes(d)));
            }
        }catch(e){ /* ignore */ }

        // user-friendly header labels dictionary (use normalized keys)
        const headerLabelMap = {
            'commne': 'Commune',
            'commune': 'Commune',
            'region': 'Région',
            'totalparcelles': 'Parcelles délimitées par les topo',
            'dtotal': 'Pourcentages parcelles délimitées par les topo',
            'nicad': 'Pourcentage parcelles avec Nicad',
            'nicad_pct': 'Pourcentage parcelles avec Nicad',
            'ctas': 'Pourcentage parcelles emmenées au CTASF',
            'ctasf': 'Pourcentage parcelles emmenées au CTASF',
            'ctasf_pct': 'Pourcentage parcelles emmenées au CTASF',
            'deliberees': 'Parcelles délibérées',
            'deliberee': "Pourcentage parcelle délibérées",
            'parcellesbrtes': "Parcelles reçues par le geomaticien (Brutes)",
            'parcellesbrutes': "Parcelles reçues par le geomaticien (Brutes)",
            'parcellescollecteessansdoblongeometriqe': 'parcelles avec géométrie valide (Sans Doublon Geometrique)',
            'parcellesenqetees': 'Parcelles enquêtées',
            'motisderejetposttraitement': 'Motifs de rejet Post traitement',
            'parcellesretenesapresposttraitement': 'Parcelles retenues apres contrôle qualité',
            'parcellesvalideesparlrm': "Parcelles validées par l'URM",
            'parcellesrejeteesparlrm': "Parcelles retournées par l'URM",
            'motisderejetrm': 'Motifs de rejet URM',
            'parcellescorrigees': "Parcelles corrigées (Retour URM)",
            'geomaticien': 'Géomaticien',
            'parcellesindividellesjointes': 'Parcelles Individuelles Jointes',
            'parcellescollectivesjointes': 'Parcelles Collectives Jointes',
            'parcellesnonjointes': 'Parcelles dont la jointure a échoué',
            'doblonsspprimes': 'Nombre de doublons supprimées',
            'taxsppressiondoblons': 'Taux de suppressionn des doublons',
            'parcellesenconlit': 'Parcelles à la fois collective et individuelle',
            'signiicantdplicates': 'Fréquence doublon',
            'parcellesposttraiteeslot': 'Totales parcelles envoyées à l\'URM',
            'stattjointre': 'Statut Jointure',
            'messagederrerjointre': 'Message d\'erreur'
        };

        function humanizeKey(k){
            if(!k) return '';
            if (String(k).endsWith('_pct')) {
                const base = k.slice(0, -4);
                const s = String(base).replace(/[^a-z0-9]+/gi,' ').trim();
                return '% ' + s.split(/\s+/).map(w=> w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
            const s = String(k).replace(/[^a-z0-9]+/gi,' ').trim();
            return s.split(/\s+/).map(w=> w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        const thr = document.createElement('tr'); thr.className = 'bg-gray-50';
        // insertion indicator (visual) - single element reused
        let insertionIndicator = document.getElementById('column-insert-indicator');
        if (!insertionIndicator) {
            insertionIndicator = document.createElement('div');
            insertionIndicator.id = 'column-insert-indicator';
            insertionIndicator.style.position = 'absolute';
            insertionIndicator.style.width = '4px';
            insertionIndicator.style.background = '#2563eb';
            insertionIndicator.style.top = '0';
            insertionIndicator.style.bottom = '0';
            insertionIndicator.style.zIndex = '60';
            insertionIndicator.style.display = 'none';
            const container = document.querySelector('#liveCommuneTable').closest('.overflow-x-auto') || document.body;
            container.appendChild(insertionIndicator);
        }
        cols.forEach((c, idx) => {
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            // keep dataset.key as the canonical internal key, but show a friendly label
            th.dataset.key = c;
            th.draggable = true;
            th.setAttribute('tabindex','0'); // make focusable for keyboard
            th.dataset.colIndex = idx;
            const label = headerLabelMap[c] || humanizeKey(c);
            th.textContent = label;

            // Drag handlers
            // Desktop drag-n-drop
            th.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.setData('text/plain', c);
                ev.dataTransfer.effectAllowed = 'move';
                th.classList.add('opacity-50');
            });
            th.addEventListener('dragend', (ev) => { th.classList.remove('opacity-50'); insertionIndicator.style.display='none'; });
            th.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; th.classList.add('bg-gray-100');
                // show insertion indicator at left or right depending on pointer
                const rect = th.getBoundingClientRect();
                const mid = rect.left + rect.width/2;
                const containerRect = (document.querySelector('#liveCommuneTable').closest('.overflow-x-auto') || document.body).getBoundingClientRect();
                insertionIndicator.style.display = 'block';
                if (ev.clientX < mid) {
                    insertionIndicator.style.left = (rect.left - containerRect.left) + 'px';
                } else {
                    insertionIndicator.style.left = (rect.right - containerRect.left) + 'px';
                }
            });
            th.addEventListener('dragleave', (ev) => { th.classList.remove('bg-gray-100'); insertionIndicator.style.display='none'; });
            th.addEventListener('drop', (ev) => {
                ev.preventDefault(); th.classList.remove('bg-gray-100'); insertionIndicator.style.display='none';
                try{
                    const fromKey = ev.dataTransfer.getData('text/plain');
                    const toKey = c;
                    if (!fromKey || fromKey === toKey) return;
                    const fromIdx = cols.indexOf(fromKey);
                    let toIdx = cols.indexOf(toKey);
                    if (fromIdx === -1 || toIdx === -1) return;
                    // If dropping on right half, insert after
                    const rect = th.getBoundingClientRect();
                    const mid = rect.left + rect.width/2;
                    if (ev.clientX > mid) toIdx = toIdx + 1;
                    cols.splice(fromIdx, 1);
                    cols.splice(toIdx > fromIdx ? toIdx-1 : toIdx, 0, fromKey);
                    localStorage.setItem(savedOrderKey, JSON.stringify(cols));
                    const current = buildTable._currentRows || rows;
                    buildTable(current);
                }catch(e){ console.warn('column drop handling failed', e); }
            });

            // Touch / pointer support (pointer events fallback)
            let pointerState = null;
            th.addEventListener('pointerdown', (ev) => {
                if (ev.pointerType === 'touch') {
                    pointerState = { startX: ev.clientX, key: c };
                    th.setPointerCapture(ev.pointerId);
                }
            });
            th.addEventListener('pointermove', (ev) => {
                if (!pointerState) return;
                ev.preventDefault();
                // show indicator following finger roughly
                const rect = th.getBoundingClientRect();
                const containerRect = (document.querySelector('#liveCommuneTable').closest('.overflow-x-auto') || document.body).getBoundingClientRect();
                insertionIndicator.style.display='block';
                insertionIndicator.style.left = (ev.clientX - containerRect.left) + 'px';
            });
            th.addEventListener('pointerup', (ev) => {
                if (!pointerState) return;
                try {
                    // find target column under pointer
                    const elems = document.elementsFromPoint(ev.clientX, ev.clientY);
                    const targetTh = elems.find(el => el.tagName === 'TH' && el.dataset && el.dataset.key);
                    const fromKey = pointerState.key;
                    if (targetTh && fromKey && targetTh.dataset.key !== fromKey) {
                        const toKey = targetTh.dataset.key;
                        const fromIdx = cols.indexOf(fromKey);
                        let toIdx = cols.indexOf(toKey);
                        if (fromIdx !== -1 && toIdx !== -1) {
                            cols.splice(fromIdx, 1);
                            cols.splice(toIdx, 0, fromKey);
                            localStorage.setItem(savedOrderKey, JSON.stringify(cols));
                            const current = buildTable._currentRows || rows;
                            buildTable(current);
                        }
                    }
                } catch(e) { console.warn('pointer reorder failed', e); }
                insertionIndicator.style.display='none';
                pointerState = null;
            });

            // Keyboard accessibility: left/right arrows move focused column
            th.addEventListener('keydown', (ev) => {
                if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
                    ev.preventDefault();
                    const fromKey = c;
                    const fromIdx = cols.indexOf(fromKey);
                    if (fromIdx === -1) return;
                    const toIdx = ev.key === 'ArrowLeft' ? Math.max(0, fromIdx-1) : Math.min(cols.length-1, fromIdx+1);
                    if (toIdx === fromIdx) return;
                    cols.splice(fromIdx, 1);
                    cols.splice(toIdx, 0, fromKey);
                    localStorage.setItem(savedOrderKey, JSON.stringify(cols));
                    const current = buildTable._currentRows || rows;
                    buildTable(current);
                    // focus moved column header
                    const newTh = document.querySelector(`#liveCommuneHead th[data-key="${cols[toIdx]}"]`);
                    if (newTh) newTh.focus();
                }
            });

            thr.appendChild(th);
        });
        head.appendChild(thr);

        rows.forEach(r => {
            const tr = document.createElement('tr'); tr.className = 'hover:bg-gray-50';
            cols.forEach(c => {
                const td = document.createElement('td');
                td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                td.textContent = r[c] != null ? r[c] : '';
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
    }

    // charts removed: this panel focuses on table and KPIs only

    async function refresh(){
        setLoading(true);
        setNoData(false);
        const rows = await getRows();
        const normalized = normalizeRows(rows);
        setLoading(false);
        const has = normalized && normalized.length;
        setNoData(!has);
        if (has) {
            buildTable(normalized);
            const kpis = calculateKPIs(normalized);
            updateKPIs(kpis);
        } else {
            console.warn('No data available to render table or KPIs.');
        }
    }

    // Fetch and parse Commune Status sheet
    async function fetchCommuneStatus() {
        const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSu_1nF47cOxavQnnbiyo2XbTnV-6XLypzrsHnHmIjHVhhtYMKYVQHBgurb7Mh8fg/pub';
        const SPREADSHEET_ID = '1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW';
        const GID = '1421590976';

        try {
            const res = await fetch(`${PUBLISHED_BASE}?gid=${GID}&single=true&output=csv`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const csvText = await res.text();
            return parseCSV(csvText);
        } catch (err) {
            console.error('Failed to fetch Commune Status sheet:', err);
            return [];
        }
    }

    function parseCSV(text) {
        try {
            if (window.Papa) {
                // Use PapaParse to get rows with original header names preserved.
                const parsed = window.Papa.parse(String(text || ''), { header: true, skipEmptyLines: true, dynamicTyping: false });
                // Return rows as-is (original headers) so later normalizeRows can
                // disambiguate duplicate headers like 'NICAD' and '% NICAD'.
                return parsed.data.map(row => {
                    const cloned = {};
                    Object.keys(row).forEach(orig => { cloned[orig] = row[orig]; });
                    return cloned;
                });
            }
        } catch (_) {
            console.warn('PapaParse failed, falling back to manual parsing.');
        }

        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        // Keep original header strings (do not normalize here)
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        });
    }

    // Render Commune Status table
    async function renderCommuneTable() {
        const table = document.getElementById('communesTable');
        if (!table) return;

        const rows = await fetchCommuneStatus();
        if (!rows.length) {
            table.innerHTML = '<tr><td colspan="100%">No data available</td></tr>';
            return;
        }

        const headers = Object.keys(rows[0]);

        // Build table header with friendly labels if possible
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            // Reuse headerLabelMap for consistency
            const label = headerLabelMap[header] || humanizeKey(header);
            th.textContent = label;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Build table body
        const tbody = document.createElement('tbody');
        rows.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                td.textContent = row[header];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        // Replace table content
        table.innerHTML = '';
        table.appendChild(thead);
        table.appendChild(tbody);
    }

    // Add debugging logs to verify data and DOM updates
    function calculateKPIs(rows) {
        if (!rows || !rows.length) {
            console.warn('No rows available for KPI calculation.');
            return null;
        }

        console.log('Rows for KPI calculation:', rows);

        // helper: try a list of candidate keys (already-normalized) and sum the first matching column
        function sumByCandidates(candidates){
            if(!candidates || !candidates.length) return 0;
            for(const cand of candidates){
                const nk = normalizeKey(cand);
                if(rows[0].hasOwnProperty(nk)){
                    return rows.reduce((s,r)=>{
                        const v = r[nk];
                        if (v == null || v === '') return s;
                        const num = Number(String(v).replace(/[^0-9.-]/g,''));
                        return s + (Number.isFinite(num) ? num : 0);
                    }, 0);
                }
            }
            // fallback: try to find any numeric column
            const keys = Object.keys(rows[0]);
            for(const k of keys){ const sample = String(rows[0][k]||''); if(sample.match(/\d/)) return rows.reduce((s,r)=>{ const n = Number(String(r[k]||'').replace(/[^0-9.-]/g,'')); return s + (Number.isFinite(n)? n : 0); },0); }
            return 0;
        }

        const totalParcels = sumByCandidates(['totalparcelles','totalparcels','parcelles','parcellesbrtes','parcellesbrutes']);
        const nicadParcels = sumByCandidates(['nicad','nicadparcels','nicad_parcels']);
        const ctasfParcels = sumByCandidates(['ctasf','ctas','ctas_parcels']);
        const rejectedParcels = sumByCandidates(['parcellesrejeteesparlurm','rejected','rejectedparcels','rejected_parcels']);  // Fixed to 'parlurm'
        const validatedParcels = sumByCandidates(['parcellesvalideesparlurm','validated','validatedparcels','validated_parcels']);  // Fixed to 'parlurm'
        const deliberatedParcels = sumByCandidates(['deliberees','deliberee','deliberated','deliberatedparcels']);

        console.log('Calculated KPI values:', {
            totalParcels,
            nicadParcels,
            ctasfParcels,
            rejectedParcels,
            validatedParcels,
            deliberatedParcels
        });

        return {
            totalParcels,
            nicadParcels,
            nicadPercentage: totalParcels > 0 ? Math.round((nicadParcels / totalParcels) * 100) : 0,
            ctasfParcels,
            ctasfPercentage: totalParcels > 0 ? Math.round((ctasfParcels / totalParcels) * 100) : 0,
            rejectedParcels,
            rejectedPercentage: totalParcels > 0 ? Math.round((rejectedParcels / totalParcels) * 100) : 0,
            validatedParcels,
            validatedPercentage: totalParcels > 0 ? Math.round((validatedParcels / totalParcels) * 100) : 0,
            deliberatedParcels,
            deliberatedPercentage: totalParcels > 0 ? Math.round((deliberatedParcels / totalParcels) * 100) : 0
        };
    }

    // Add defensive checks to ensure DOM elements are loaded before updating KPIs
    function updateKPIs(kpis) {
        if (!kpis) {
            console.warn('No KPIs available to update.');
            return;
        }

        console.log('Updating KPIs with values:', kpis);

        // Directly update since called after DOM load; removed unnecessary addEventListener
        const updateKPI = (id, value, percentage) => {
            const el = document.getElementById(id);
            if (el) {
                if (id.includes('-rate')) {
                    el.textContent = percentage !== undefined ? `${percentage}%` : '--';
                } else {
                    el.textContent = value.toLocaleString();
                }
            } else {
                console.warn(`KPI element with ID '${id}' not found in the DOM.`);
            }
        };

        updateKPI('commune-total-parcels', kpis.totalParcels);
        updateKPI('commune-nicad', kpis.nicadParcels);
        updateKPI('commune-nicad-rate', kpis.nicadPercentage);
        updateKPI('commune-ctasf', kpis.ctasfParcels);
        updateKPI('commune-ctasf-rate', kpis.ctasfPercentage);
        updateKPI('commune-rejected', kpis.rejectedParcels);
        updateKPI('commune-rejected-rate', kpis.rejectedPercentage);
        updateKPI('commune-validated', kpis.validatedParcels);
        updateKPI('commune-validated-rate', kpis.validatedPercentage);
        updateKPI('commune-deliberated', kpis.deliberatedParcels);
        updateKPI('commune-deliberated-rate', kpis.deliberatedPercentage);
    }

    // Initialize table rendering on page load
    document.addEventListener('DOMContentLoaded', () => {
        const search = document.getElementById('communeSearch');
        if (search) search.addEventListener('input', (e)=>{ const q=e.target.value.trim().toLowerCase(); const tbody=document.getElementById('liveCommuneBody'); if(!tbody) return; Array.from(tbody.querySelectorAll('tr')).forEach(tr=>{ tr.style.display = q ? (tr.textContent.toLowerCase().includes(q) ? '' : 'none') : ''; }); });
        // kick off
        try{ AOS && AOS.refresh(); }catch(e){}
        refresh();
        renderCommuneTable();

        // Reset columns button
        const resetBtn = document.getElementById('communeResetColumnsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                localStorage.removeItem('communes_table_order');
                localStorage.removeItem('communes_table_visibility');
                // re-fetch and re-render
                refresh();
            });
        }
    });
})();