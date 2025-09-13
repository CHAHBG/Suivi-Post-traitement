// Commune Status Table renderer
(function(){
    const STORAGE_KEY = 'communeTableSettings_v1';

    async function fetchCommuneStatus() {
        const googleService = window.enhancedGoogleSheetsService || window.googleSheetsService;
        try {
            if (googleService && typeof googleService.fetchMultipleSheets === 'function') {
                const cfg = (typeof googleService.getPROCASSEFConfig === 'function') ? googleService.getPROCASSEFConfig() : {};
                const spreadsheetId = cfg.spreadsheetId || '';
                const sheets = cfg.sheets || [];
                // Try to find a sheet named Commune Status or Commune Analysis
                const target = sheets.find(s => /Commune Status|Commune Analysis/i.test(s));
                if (target) {
                    const fetched = await googleService.fetchMultipleSheets(spreadsheetId, [target], { apiKey: cfg.apiKey || null, useCaching: true });
                    return fetched[target.name || target] || fetched[Object.keys(fetched)[0]] || [];
                }
            }
        } catch (e) {
            console.warn('Enhanced google service failed to fetch commune status:', e);
        }
        // Fallback to global rawData if dashboard loaded it
        if (window.dashboard && window.dashboard.rawData) {
            return window.dashboard.rawData['Commune Status'] || window.dashboard.rawData['Commune Analysis'] || [];
        }
        if (window.enhancedDashboard && window.enhancedDashboard.rawData) {
            return window.enhancedDashboard.rawData['Commune Status'] || window.enhancedDashboard.rawData['Commune Analysis'] || [];
        }
        // Final fallback: try global GOOGLE_SHEETS object
        const sheetFallback = window.GOOGLE_SHEETS && (window.GOOGLE_SHEETS['Commune Status'] || window.GOOGLE_SHEETS['Commune Analysis']);
        if (sheetFallback && sheetFallback.length) return sheetFallback;

        // As a last resort, directly fetch the CSV export for the known gid (1421590976)
        try {
            const gid = (window.GOOGLE_SHEETS && window.GOOGLE_SHEETS.communeDetails && window.GOOGLE_SHEETS.communeDetails.gid) || '1421590976';
            const base = (window.CONFIG && window.CONFIG.SHEETS_BASE_URL) ? window.CONFIG.SHEETS_BASE_URL : 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=';
            const url = base + gid;
            const resp = await fetch(url, { cache: 'no-cache' });
            if (resp && resp.ok) {
                const text = await resp.text();
                if (typeof UTILS !== 'undefined' && typeof UTILS.parseCSV === 'function') {
                    const parsed = UTILS.parseCSV(text);
                    if (parsed && parsed.length) return parsed;
                } else {
                    // Minimal CSV parse fallback (comma/semicolon) if UTILS not available
                    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim()!=='');
                    if (lines.length > 1) {
                        const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
                        const headers = lines[0].split(delimiter).map(h=>h.trim().replace(/"/g,''));
                        const rows = [];
                        for (let i=1;i<lines.length;i++){
                            const values = lines[i].split(delimiter);
                            if (values.every(v=>v===undefined||v.trim()==='')) continue;
                            const obj = {};
                            headers.forEach((h,idx)=> obj[h]=values[idx] ? values[idx].trim().replace(/"/g,'') : '');
                            rows.push(obj);
                        }
                        if (rows.length) return rows;
                    }
                }
            }
        } catch (err) {
            console.warn('Direct CSV fetch for Commune Analysis failed:', err);
        }

        return [];
    }

    function getSettings() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e){ return {}; }
    }
    function saveSettings(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

    // Small helpers for formatting and styling cells based on column meaning
    function isNumericString(v){ if (v == null) return false; return !isNaN(String(v).replace(/[,\s]/g, '')); }
    function formatNumberForDisplay(v){
        if (typeof UTILS !== 'undefined' && typeof UTILS.formatNumber === 'function') return UTILS.formatNumber(parseFloat(String(v).replace(/[,\s]/g,'')) || 0);
        try { return Number(String(v).replace(/[,\s]/g,'')).toLocaleString('fr-FR'); } catch(e){ return String(v); }
    }

    // Normalize header/key strings for robust matching (remove accents, punctuation, extra spaces)
    function normalizeHeaderKey(s) {
        if (s == null) return '';
        try {
            return String(s)
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9 ]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        } catch (e) {
            return String(s).trim().toLowerCase();
        }
    }

    function renderCellContent(col, raw) {
        const val = raw == null ? '' : String(raw).trim();
        const lower = col.toLowerCase();
        // Percentage-style columns
        if (/%|taux|% du|% nicad|% ctasf|taux suppression/i.test(col)) {
            // If already contains %, keep as-is, else show as-is but right align
            return val;
        }
        // Numeric-looking columns (Parcelles, Total, Doublons, Parcelles post-traitées, etc.)
        if (/parcelles|total|doublons|nombre|count|parcels|duplicates|suppression|retir/i.test(lower)) {
            if (isNumericString(val)) return formatNumberForDisplay(val);
            return val;
        }
        // Status columns
        if (/statut/i.test(lower)) {
            const state = val.toLowerCase();
            const good = /joint|ok|valide|valid|passed|oui|yes|joined/.test(state);
            const bad = /erreur|error|rej|rejet|fail|non|no|missing/.test(state);
            const span = document.createElement('span');
            span.textContent = val || '';
            span.className = 'inline-block px-2 py-0.5 text-sm rounded-full';
            if (good) span.className += ' bg-emerald-100 text-emerald-800';
            else if (bad) span.className += ' bg-rose-100 text-rose-800';
            else span.className += ' bg-yellow-50 text-yellow-800';
            return span;
        }
        // Error message columns
        if (/message|motif|erreur|motifs/i.test(lower)) {
            const p = document.createElement('pre');
            p.textContent = val;
            p.className = 'whitespace-pre-wrap text-sm text-gray-700';
            return p;
        }
        // Default: return plain text
        return val;
    }

    function buildTable(columns, rows, settings){
        const thead = document.getElementById('communeTableHead');
        thead.innerHTML = '';
        const tr = document.createElement('tr');
        tr.className = 'bg-gray-100';
        columns.forEach((col, idx) => {
            const th = document.createElement('th');
            th.textContent = col;
            th.setAttribute('draggable', 'true');
            th.dataset.col = col;
            th.className = 'px-4 py-2 border-b text-left cursor-move';

            // Visibility
            settings.visible = settings.visible || {};
            if (settings.visible[col] === undefined) settings.visible[col] = true; // default show all
            const visible = settings.visible[col] !== false;
            if (!visible) th.style.display = 'none';

            // Drag events
            th.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', col);
                th.classList.add('opacity-50');
            });
            th.addEventListener('dragend', e => { th.classList.remove('opacity-50'); });
            th.addEventListener('dragover', e => { e.preventDefault(); th.classList.add('bg-yellow-50'); });
            th.addEventListener('dragleave', e => { th.classList.remove('bg-yellow-50'); });
            th.addEventListener('drop', e => {
                e.preventDefault();
                th.classList.remove('bg-yellow-50');
                const sourceCol = e.dataTransfer.getData('text/plain');
                if (!sourceCol || sourceCol === col) return;
                const cols = Array.from(thead.querySelectorAll('th')).map(h => h.dataset.col);
                const from = cols.indexOf(sourceCol);
                const to = cols.indexOf(col);
                cols.splice(from, 1);
                cols.splice(to, 0, sourceCol);
                settings.order = cols;
                saveSettings(settings);
                renderTableWithSettings(rows, settings);
            });

            tr.appendChild(th);
        });
        thead.appendChild(tr);

        const tbody = document.getElementById('communeTableBody');
        tbody.innerHTML = '';
        rows.forEach(row => {
            const trr = document.createElement('tr');
            trr.className = 'hover:bg-gray-50';
            const colsToUse = settings.order && settings.order.length ? settings.order : columns;
            colsToUse.forEach(col => {
                const td = document.createElement('td');
                // default padding
                td.className = 'px-4 py-2 border-b align-top';
                const visible = settings.visible && settings.visible[col] !== false;
                if (!visible) td.style.display = 'none';
                // Case-insensitive lookup
                // Handle rows that may be arrays (CSV parsed without headers)
                let raw = '';
                if (Array.isArray(row)) {
                    const idx = colsToUse.indexOf(col);
                    raw = idx >= 0 && idx < row.length ? row[idx] : '';
                } else {
                    // Robust key lookup: normalize both column header and row keys
                    const normCol = normalizeHeaderKey(col);
                    let foundKey = Object.keys(row).find(k => normalizeHeaderKey(k) === normCol);
                    if (!foundKey) {
                        // Try fuzzy match: header contained in key or vice-versa
                        foundKey = Object.keys(row).find(k => {
                            const nk = normalizeHeaderKey(k);
                            return nk && (nk.indexOf(normCol) === 0 || normCol.indexOf(nk) === 0 || nk.includes(normCol) || normCol.includes(nk));
                        });
                    }
                    raw = foundKey ? row[foundKey] : (row[col] != null ? row[col] : '');
                }
                // Apply formatting/styling
                const lower = String(col).toLowerCase();
                if (/%|taux|% du|% nicad|% ctasf|taux suppression/i.test(col)) {
                    td.className += ' text-right';
                    td.textContent = raw;
                } else if (/parcelles|total|doublons|nombre|count|parcels|duplicates|suppression|retir/i.test(lower)) {
                    td.className += ' text-right';
                    td.textContent = isNumericString(raw) ? formatNumberForDisplay(raw) : raw;
                } else if (/statut/i.test(lower)) {
                    // Status badge
                    const content = renderCellContent(col, raw);
                    if (content instanceof Element) td.appendChild(content); else td.textContent = content;
                } else if (/message|motif|erreur|motifs/i.test(lower)) {
                    const content = renderCellContent(col, raw);
                    if (content instanceof Element) td.appendChild(content); else td.textContent = content;
                } else if (/commune|région|region|geomaticien/i.test(lower)) {
                    td.className += ' text-left';
                    td.textContent = raw;
                } else {
                    // default
                    td.textContent = raw;
                }
                trr.appendChild(td);
            });
            tbody.appendChild(trr);
        });
    }

    function renderTableWithSettings(rows, settings){
        // Derive columns from saved order or from first row if available
        const columns = settings.order && settings.order.length ? settings.order : (rows && rows[0] ? Object.keys(rows[0]) : (settings.order || []));
        // Build headers (even if rows are empty) so column chooser shows columns
        buildTable(columns, rows && rows.length ? rows : [], settings);
        // If no rows, add a single no-data row to the tbody (preserve headers)
        if (!rows || !rows.length) {
            const tbody = document.getElementById('communeTableBody');
            tbody.innerHTML = '';
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = Math.max(columns.length, 1);
            td.className = 'py-6 text-center text-gray-500';
            td.textContent = 'Aucune donnée disponible';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
    }

    function buildColumnChooser(columns, settings, rows){
        let container = document.getElementById('communeTableControls');
        if (!container) {
            // try to create controls container next to the table if missing
            const tbl = document.getElementById('communeTableContainer') || document.getElementById('communeStatusTable');
            if (tbl && tbl.parentElement) {
                container = document.createElement('div');
                container.id = 'communeTableControls';
                tbl.parentElement.insertBefore(container, tbl);
            }
        }
        if (!container) return; // nothing we can do
        container.innerHTML = '';
        const cols = columns;
        cols.forEach(c => {
            const id = 'colchk_' + c.replace(/\W+/g,'_');
            const div = document.createElement('div');
            div.className = 'inline-flex items-center mr-3';
            const inp = document.createElement('input');
            inp.type = 'checkbox';
            inp.id = id;
            const visible = settings.visible && settings.visible[c] !== false;
            inp.checked = visible !== false;
            inp.addEventListener('change', () => {
                settings.visible = settings.visible || {};
                settings.visible[c] = inp.checked;
                saveSettings(settings);
                renderTableWithSettings(rows, settings);
            });
            const lbl = document.createElement('label');
            lbl.htmlFor = id;
            lbl.className = 'ml-2 text-sm';
            lbl.textContent = c;
            div.appendChild(inp);
            div.appendChild(lbl);
            container.appendChild(div);
        });
    }

    async function init() {
        const toggleBtn = document.getElementById('columnChooserBtn');
        const controls = document.getElementById('communeTableControls');
        if (toggleBtn && controls) toggleBtn.addEventListener('click', () => { controls.classList.toggle('hidden'); });
        // Show a lightweight loading state without destroying the table DOM
        const container = document.getElementById('communeTableContainer');
        // Ensure the table exists (do not overwrite it) so thead/tbody references remain stable
        let table = document.getElementById('communeStatusTable');
        if (!table) {
            table = document.createElement('table');
            table.id = 'communeStatusTable';
            table.className = 'min-w-full table-auto border-collapse';
            const the = document.createElement('thead'); the.id = 'communeTableHead';
            const tbo = document.createElement('tbody'); tbo.id = 'communeTableBody';
            table.appendChild(the); table.appendChild(tbo);
            if (container) container.appendChild(table);
        }
        // Create or update a loading element so we don't remove the table
        let loadingEl = document.getElementById('communeTableLoading');
        if (!loadingEl && container) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'communeTableLoading';
            loadingEl.className = 'p-6 text-gray-500';
            container.insertBefore(loadingEl, table);
        }
        if (loadingEl) loadingEl.textContent = 'Chargement des données...';

        // Try fetching rows, with short retries to allow enhancedDashboard to finish loading
        let rows = await fetchCommuneStatus();
        if (!rows || !rows.length) {
            // Retry a few times, waiting for enhancedDashboard/rawData to be available
            for (let attempt = 0; attempt < 5 && (!rows || !rows.length); attempt++) {
                // If enhancedDashboard has rawData, try to pull from it directly
                if (window.enhancedDashboard && window.enhancedDashboard.rawData) {
                    rows = window.enhancedDashboard.rawData['Commune Analysis'] || window.enhancedDashboard.rawData['Commune Status'] || rows || [];
                }
                if (rows && rows.length) break;
                // Otherwise wait a bit then try the fetch fallback again
                await new Promise(r => setTimeout(r, 800));
                try { rows = await fetchCommuneStatus(); } catch(e){ console.warn('communeTable: retry fetch failed', e); }
            }
        }

    // Load persistent settings early to avoid temporal-dead-zone issues
    const settings = getSettings();
    console.debug('communeTable: fetched rows count =', (rows && rows.length) || 0, rows && rows[0] ? Object.keys(rows[0]) : null);
        // If no saved order, derive columns from first row
        const columns = settings.order && settings.order.length ? settings.order : (rows && rows[0] ? Object.keys(rows[0]) : (settings.order || []));
        // Ensure settings.order exists
        settings.order = settings.order && settings.order.length ? settings.order : columns;
        saveSettings(settings);

        // Remove loading indicator
        const loading = document.getElementById('communeTableLoading'); if (loading) loading.remove();
        buildColumnChooser(columns, settings, rows);
        renderTableWithSettings(rows, settings);
    }

    // Expose helpers so other panels can reuse the same data-fetching logic
    try { window.fetchCommuneStatus = fetchCommuneStatus; } catch(_){}
    try { window.communeTableInit = init; } catch(_){}

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
