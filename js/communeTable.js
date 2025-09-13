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
        const container = document.getElementById('communeTableControls');
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

    async function init(){
        const toggleBtn = document.getElementById('columnChooserBtn');
        const tbody = document.getElementById('communeTableBody');
        tbody.innerHTML = '';

        // Build a stable mapping from column (label) -> row key or index to avoid fuzzy per-cell searches
        const colsToUse = settings.order && settings.order.length ? settings.order : columns;
        const keyMap = {}; // col -> (string key) or (numeric index) or null
        const sampleRow = rows && rows.length ? rows[0] : null;
        const rowIsArray = Array.isArray(sampleRow);
        if (rowIsArray) {
            // If rows are arrays (CSV parsed without header objects), map by index position
            colsToUse.forEach((col, idx) => { keyMap[col] = idx; });
        } else if (sampleRow && typeof sampleRow === 'object') {
            // Precompute normalized keys map for faster lookups
            const rowKeys = Object.keys(sampleRow || {});
            const normKeyMap = {};
            rowKeys.forEach(k => { normKeyMap[normalizeHeaderKey(k)] = k; });
            colsToUse.forEach(col => {
                const normCol = normalizeHeaderKey(col);
                let found = normKeyMap[normCol];
                if (!found) {
                    // try fuzzy strategies: startsWith, contains
                    const keys = Object.keys(normKeyMap);
                    for (const nk of keys) {
                        if (!nk) continue;
                        if (nk.indexOf(normCol) === 0 || normCol.indexOf(nk) === 0 || nk.includes(normCol) || normCol.includes(nk)) { found = normKeyMap[nk]; break; }
                    }
                }
                keyMap[col] = found || null;
            });
        } else {
            // No sample row - map by order as graceful fallback
            colsToUse.forEach((col, idx) => { keyMap[col] = idx; });
        }

        rows.forEach(row => {
            const trr = document.createElement('tr');
            trr.className = 'hover:bg-gray-50';
            colsToUse.forEach(col => {
                const td = document.createElement('td');
                // default padding
                td.className = 'px-4 py-2 border-b align-top';
                const visible = settings.visible && settings.visible[col] !== false;
                if (!visible) td.style.display = 'none';

                // Use precomputed map to retrieve raw value
                let raw = '';
                const mapVal = keyMap[col];
                if (typeof mapVal === 'number') {
                    raw = Array.isArray(row) && row.length > mapVal ? row[mapVal] : '';
                } else if (typeof mapVal === 'string') {
                    raw = row[mapVal] != null ? row[mapVal] : '';
                } else {
                    // last-resort: try any direct property match (case-insensitive)
                    const foundKey = row && typeof row === 'object' ? Object.keys(row).find(k => normalizeHeaderKey(k) === normalizeHeaderKey(col)) : null;
                    raw = foundKey ? row[foundKey] : '';
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
    console.debug('communeTable: fetched rows count =', (rows && rows.length) || 0, rows && rows[0] ? Object.keys(rows[0]) : null);
        const settings = getSettings();
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
