// communePanel.js - moved from index.html inline
import chartService from './chartService';

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
        const els = ['communeChartLoader','statusChartLoader','communeTableLoader'];
        els.forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display = visible ? 'flex' : 'none'; });
    }
    function setNoData(hasNo){
        const pairs = [['communeChartNoData','communeChartLoader'],['statusChartNoData','statusChartLoader'],['communeTableNoData','communeTableLoader']];
        pairs.forEach(([nod,ldr])=>{ const a=document.getElementById(nod); const b=document.getElementById(ldr); if(a) a.style.display = hasNo ? 'flex' : 'none'; if(b && hasNo) b.style.display='none'; });
    }

    function normalizeKey(key) {
        return String(key || '').toLowerCase()
            .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '')
            .trim();
    }

    function normalizeRows(rows) {
        return rows.map(row => {
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
                const normalizedKey = normalizeKey(key);
                normalizedRow[normalizedKey] = row[key];
            });
            return normalizedRow;
        });
    }

    function buildTable(rows){
        const head = document.getElementById('liveCommuneHead');
        const body = document.getElementById('liveCommuneBody');
        if (!head || !body) return;
        head.innerHTML = ''; body.innerHTML = '';
        if (!rows || !rows.length) {
            head.innerHTML = '<tr><th class="px-6 py-3">Aucune donnée</th></tr>';
            return;
        }

        const cols = Object.keys(rows[0]);
        const thr = document.createElement('tr'); thr.className = 'bg-gray-50';
        cols.forEach(c => {
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            th.textContent = c;
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

    function buildCharts(rows) {
        try {
            chartService.buildCommuneChart(rows);
            chartService.buildStatusChart(rows);
        } catch (e) {
            console.warn('buildCharts failed', e);
        }
    }

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
            buildCharts(normalized);
            const kpis = calculateKPIs(normalized);
            updateKPIs(kpis);
        } else {
            console.warn('No data available to render charts or KPIs.');
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
                const parsed = window.Papa.parse(String(text || ''), { header: true, skipEmptyLines: true, dynamicTyping: false });
                return parsed.data.map(row => {
                    const normalizedRow = {};
                    Object.keys(row).forEach(key => {
                        const normalizedKey = normalizeKey(key);
                        normalizedRow[normalizedKey] = row[key];
                    });
                    return normalizedRow;
                });
            }
        } catch (_) {
            console.warn('PapaParse failed, falling back to manual parsing.');
        }

        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => normalizeKey(h.trim()));
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

        // Build table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
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

        const totalParcels = rows.reduce((sum, r) => sum + (Number(String(r['totalparcels'] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
        const nicadParcels = rows.reduce((sum, r) => sum + (Number(String(r['nicad'] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
        const ctasfParcels = rows.reduce((sum, r) => sum + (Number(String(r['ctasf'] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
        const rejectedParcels = rows.reduce((sum, r) => sum + (Number(String(r['rejected'] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
        const validatedParcels = rows.reduce((sum, r) => sum + (Number(String(r['validated'] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
        const deliberatedParcels = rows.reduce((sum, r) => sum + (Number(String(r['deliberated'] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);

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

        // Wait for DOM elements to be fully loaded
        document.addEventListener('DOMContentLoaded', () => {
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
        });
    }

    // Initialize table rendering on page load
    document.addEventListener('DOMContentLoaded', () => {
        const search = document.getElementById('communeSearch');
        if (search) search.addEventListener('input', (e)=>{ const q=e.target.value.trim().toLowerCase(); const tbody=document.getElementById('liveCommuneBody'); if(!tbody) return; Array.from(tbody.querySelectorAll('tr')).forEach(tr=>{ tr.style.display = q ? (tr.textContent.toLowerCase().includes(q) ? '' : 'none') : ''; }); });
        // kick off
        try{ AOS && AOS.refresh(); }catch(e){}
        refresh();
        renderCommuneTable();
    });
})();
