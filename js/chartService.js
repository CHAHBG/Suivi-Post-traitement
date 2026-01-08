// @ts-nocheck
// Chart Service for creating and managing all dashboard charts
// Final Refinement for maximum resilience and visibility.

class ChartService {
    constructor() {
        this.charts = new Map();
        this.gauges = new Map();
        this._resizeObserverInitialized = false;

        // Ensure CONFIG exists
        if (typeof window.CONFIG === 'undefined') window.CONFIG = {};
        if (!window.CONFIG.COLORS) {
            window.CONFIG.COLORS = {
                primary: '#1e40af',   // Navy 700
                secondary: '#334155', // Slate 700
                success: '#059669',   // Emerald 600
                warning: '#d97706',   // Amber 600
                danger: '#dc2626',    // Red 600
                info: '#2563eb',      // Royal Blue 600
                accent: '#475569',    // Slate 600
                light: '#f8fafc',     // Slate 50
                dark: '#0f172a'       // Slate 900
            };
        }

        // Initialize modern Chart.js theme
        this._initGlobalTheme();

        // Standard debounced resize
        this._debouncedResize = this._debounce(() => {
            this.charts.forEach(chart => {
                try { chart.resize(); } catch (e) { }
            });
        }, 150);

        window.addEventListener('resize', this._debouncedResize);

        // Setup ResizeObserver for better reactivity in hidden tabs
        this._initResizeObserver();
    }

    _initResizeObserver() {
        if (typeof ResizeObserver !== 'undefined' && !this._resizeObserverInitialized) {
            this._resizeObserverInitialized = true;
            this._observer = new ResizeObserver(this._debounce((entries) => {
                for (let entry of entries) {
                    const canvas = entry.target.querySelector('canvas');
                    if (canvas && this.charts.has(canvas.id)) {
                        try { this.charts.get(canvas.id).resize(); } catch (e) { }
                    }
                }
            }, 100));

            // Observe all chart containers
            document.querySelectorAll('.chart-container').forEach(c => this._observer.observe(c));
        }
    }

    _initGlobalTheme() {
        if (typeof Chart === 'undefined') return;

        try {
            // Typography & Colors
            Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
            Chart.defaults.color = 'rgba(71, 85, 105, 1)'; // Slate 600
            Chart.defaults.font.size = 11;

            // Tooltip
            if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
                const tt = Chart.defaults.plugins.tooltip;
                tt.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                tt.titleColor = 'rgba(30, 41, 59, 1)';
                tt.bodyColor = 'rgba(71, 85, 105, 1)';
                tt.borderColor = 'rgba(226, 232, 240, 1)';
                tt.borderWidth = 1;
                tt.padding = 10;
                tt.cornerRadius = 6;
            }

            // Interaction
            Chart.defaults.interaction.mode = 'index';
            Chart.defaults.interaction.intersect = false;

            // Elements
            Chart.defaults.elements.line.borderWidth = 2;
            Chart.defaults.elements.line.tension = 0.4;
            Chart.defaults.elements.line.cubicInterpolationMode = 'monotone';
            Chart.defaults.elements.point.radius = 0;
            Chart.defaults.elements.point.hoverRadius = 4;

            // Scales - Recursive check to be ultra safe
            if (Chart.defaults.scales && Chart.defaults.scales.linear && Chart.defaults.scales.linear.grid) {
                Chart.defaults.scales.linear.grid.color = 'rgba(0, 0, 0, 0.05)';
            }
            if (Chart.defaults.scales && Chart.defaults.scales.category && Chart.defaults.scales.category.grid) {
                Chart.defaults.scales.category.grid.display = false;
            }
        } catch (e) {
            console.warn('Chart Defaults initialization partially failed:', e);
        }
    }

    _debounce(fn, wait) {
        let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
    }

    _hexToRgba(hex, alpha) {
        if (!hex || typeof hex !== 'string') return `rgba(59, 130, 246, ${alpha})`;
        if (hex.startsWith('rgba')) return hex;
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length == 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }
        return hex;
    }

    _makeAreaGradient(color, canvas) {
        try {
            if (!canvas) return 'rgba(59, 130, 246, 0.1)';
            const ctx = canvas.getContext('2d');
            const h = canvas.clientHeight || 300;
            const gradient = ctx.createLinearGradient(0, 0, 0, h);

            // Safer color parsing
            let r = 59, g = 130, b = 246;
            const base = this._hexToRgba(color, 1);
            const matches = base.match(/\d+/g);
            if (matches && matches.length >= 3) {
                [r, g, b] = matches.slice(0, 3);
            }

            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.01)`);
            return gradient;
        } catch (e) {
            return 'rgba(59, 130, 246, 0.1)';
        }
    }

    // Alias for legacy support
    createDailyYieldsChart(rawData) {
        return this.createDailyYieldsChartForCanvas('dailyYieldsChart', rawData);
    }

    _getNumericField(row, candidates) {
        if (!row) return 0;
        const keys = Array.isArray(candidates) ? candidates : [candidates];
        
        // First try exact matches
        for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
                const val = parseFloat(String(row[k]).replace(/\s/g, '').replace(',', '.'));
                if (!isNaN(val)) return val;
            }
        }
        
        // Then try case-insensitive partial matches
        const rowKeys = Object.keys(row);
        for (const candidate of keys) {
            const normCandidate = String(candidate).toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüç]/gi, '');
            for (const rowKey of rowKeys) {
                const normRowKey = String(rowKey).toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüç]/gi, '');
                if (normRowKey.includes(normCandidate) || normCandidate.includes(normRowKey)) {
                    if (row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
                        const val = parseFloat(String(row[rowKey]).replace(/\s/g, '').replace(',', '.'));
                        if (!isNaN(val)) return val;
                    }
                }
            }
        }
        return 0;
    }

    findSheet(name, data) {
        if (!data || typeof data !== 'object') return null;
        
        // Direct match
        if (data[name]) {
            console.info(`[findSheet] Direct match for "${name}" with ${data[name].length} rows`);
            return data[name];
        }
        
        // Normalized match
        const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = norm(name);
        for (const k of Object.keys(data)) {
            if (norm(k) === target) {
                console.info(`[findSheet] Normalized match: "${name}" -> "${k}" with ${data[k].length} rows`);
                return data[k];
            }
        }
        
        // Partial match (for cases like "CTASF Follow-up" matching "ctasfFollowup")
        for (const k of Object.keys(data)) {
            if (norm(k).includes(target) || target.includes(norm(k))) {
                console.info(`[findSheet] Partial match: "${name}" -> "${k}" with ${data[k].length} rows`);
                return data[k];
            }
        }
        
        console.warn(`[findSheet] No match found for "${name}". Available keys:`, Object.keys(data));
        return null;
    }

    _createChart(id, config) {
        this.destroyChart(id);
        const canvas = document.getElementById(id);
        if (!canvas) {
            console.debug(`Chart canvas ${id} not found in DOM.`);
            return null;
        }

        // Ensure parent observer is watching
        if (this._observer && canvas.parentElement && canvas.parentElement.classList.contains('chart-container')) {
            this._observer.observe(canvas.parentElement);
        }

        try {
            const chart = new Chart(canvas, {
                ...config,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    ...config.options
                }
            });
            this.charts.set(id, chart);
            return chart;
        } catch (e) {
            console.error(`Error creating Chart.js instance for ${id}:`, e);
            return null;
        }
    }

    destroyChart(id) {
        if (this.charts.has(id)) {
            try { this.charts.get(id).destroy(); } catch (e) { }
            this.charts.delete(id);
        }
    }

    destroyAllCharts() {
        this.charts.forEach((_, id) => this.destroyChart(id));
        this.gauges.forEach((gauge) => { try { gauge.destroy(); } catch (e) { } });
        this.gauges.clear();
    }

    // --- Main Initializer ---
    async initializeCharts(rawData, precomputedKPIs = null, fullRawData = null) {
        console.log('[ChartService] Starting initialization...');

        if (fullRawData) window.__fullRawData = fullRawData;
        else if (!window.__fullRawData) window.__fullRawData = rawData;

        const dataToUse = window.__fullRawData || rawData;

        // Sequence chart creations with individual error isolation
        const chartPrompts = [
            {
                id: 'overviewDailyYieldsChart', fn: () => {
                    console.info('Initializing overviewDailyYieldsChart...');
                    this.createDailyYieldsChartForCanvas('overviewDailyYieldsChart', rawData);
                }
            },
            {
                id: 'dailyYieldsChart', fn: () => {
                    console.info('Initializing dailyYieldsChart...');
                    this.createDailyYieldsChartForCanvas('dailyYieldsChart', rawData);
                }
            },
            {
                id: 'qualityTrendChart', fn: () => {
                    console.info('Initializing qualityTrendChart...');
                    this.createQualityTrendChart(rawData);
                }
            },
            {
                id: 'regionalTrendChart', fn: () => {
                    console.info('Initializing regionalTrendChart...');
                    this.createRegionalAnalysisCharts(rawData);
                }
            },
            // CTASF Pipeline chart removed
            {
                id: 'postProcessingChart', fn: () => {
                    console.info('Initializing postProcessingChart...');
                    this.createPostProcessingChart(rawData);
                }
            },
            {
                id: 'parcelTypeDistributionChart', fn: () => {
                    console.info('Initializing parcelTypeDistributionChart...');
                    this.createParcelTypeDistributionChart(rawData);
                }
            },
            {
                id: 'teamProductivityChart', fn: () => {
                    console.info('Initializing teamProductivityChart...');
                    this.createTeamProductivityChart(rawData);
                }
            },
            {
                id: 'gauge-charts', fn: () => {
                    console.info('Initializing gauge charts...');
                    this.createGaugeCharts();
                }
            }
        ];

        for (const task of chartPrompts) {
            try {
                task.fn();
            } catch (err) {
                console.error(`[ChartService] Task ${task.id} failed:`, err);
            }
        }

        console.log(`[ChartService] Initialized ${this.charts.size} charts.`);
        return true;
    }

    async updateCharts(rawData, precomputedKPIs = null, fullRawData = null) {
        return this.initializeCharts(rawData, precomputedKPIs, fullRawData);
    }

    // --- Specific Chart Methods ---

    createDailyYieldsChartForCanvas(canvasId, rawData) {
        const id = canvasId;
        if (!document.getElementById(id)) return;

        const sheet = this.findSheet('dailyLeveeSource', rawData) || this.findSheet('Daily Levee Source', rawData) || this.findSheet('Yields Projections', rawData) || [];
        console.info(`createDailyYieldsChartForCanvas(${canvasId}): Found sheet with ${sheet.length} rows`);

        if (sheet.length === 0) {
            console.warn(`No data for ${canvasId}, chart will be empty.`);
            return;
        }

        const canvas = document.getElementById(id);
        const color = 'rgba(30, 64, 175, 1)'; // Default blue
        const gradient = this._makeAreaGradient(color, canvas);

        // --- Aggregation logic ---
        const dailyTotals = new Map();
        const leveeCandidates = ['Nombre de levées', 'Nombre de levee', 'levee', 'levées', 'Nombre de Levées'];

        sheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                // Use YYYY-MM-DD as key
                const dateKey = dateObj.toISOString().split('T')[0];
                const val = this._getNumericField(row, leveeCandidates);

                if (dailyTotals.has(dateKey)) {
                    dailyTotals.get(dateKey).y += val;
                } else {
                    dailyTotals.set(dateKey, { x: dateObj, y: val });
                }
            }
        });

        // Sort by date chronologically
        const aggregatedData = Array.from(dailyTotals.values()).sort((a, b) => a.x - b.x);

        // Target line handle
        const targetValue = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) ?
            window.CONFIG.TARGETS.DAILY_PARCELS : 387;

        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Levées quotidiennes',
                    data: aggregatedData,
                    borderColor: '#2563eb',
                    backgroundColor: this._makeAreaGradient('#2563eb', canvas),
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Objectif',
                    data: aggregatedData.map(d => ({
                        x: d.x,
                        y: targetValue
                    })),
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                plugins: {
                    legend: { display: canvasId !== 'overviewDailyYieldsChart' },
                    tooltip: { enabled: true }
                },
                scales: {
                    x: { 
                        type: 'time', 
                        time: { 
                            unit: 'day',
                            displayFormats: {
                                day: 'DD/MM'
                            }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    },
                    y: { beginAtZero: true }
                }
            }
        });
    }

    createQualityTrendChart(rawData) {
        const id = 'qualityTrendChart';
        if (!document.getElementById(id)) return;

        const sheet = this.findSheet('Public Display Follow-up', rawData) || this.findSheet('publicDisplayFollowup', rawData);
        // Fetch projection sheet
        const projSheet = this.findSheet('Display Projections', rawData) || this.findSheet('projectionDisplay', rawData) || [];

        console.info(`createQualityTrendChart: Found sheet with ${sheet ? sheet.length : 0} rows`);
        
        // DEBUG: Log available keys and sample row
        if (sheet && sheet.length > 0) {
            console.info(`[DEBUG qualityTrendChart] Available columns:`, Object.keys(sheet[0]));
            console.info(`[DEBUG qualityTrendChart] Sample row:`, sheet[0]);
        }

        if (!sheet || sheet.length === 0) {
            console.warn(`No data for ${id}, chart will be empty.`);
            return;
        }

        // --- Aggregation logic ---
        const qualityTotals = new Map();

        sheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];
                const s = this._getNumericField(row, ['Nombre de parcelles affichées sans erreurs', 'Nombre de parcelles affichées', 'Sans erreurs', 'Affichées', 'parcelles_sans_erreurs']) || 0;
                const e = this._getNumericField(row, ['Nombre Parcelles with error', 'Nombre Parcelles avec erreur', 'Avec erreur', 'Erreurs', 'parcelles_avec_erreur']) || 0;

                if (qualityTotals.has(dateKey)) {
                    const entry = qualityTotals.get(dateKey);
                    entry.s += s;
                    entry.e += e;
                } else {
                    qualityTotals.set(dateKey, { x: dateObj, s, e });
                }
            }
        });

        // Convert to percentage and sort
        let aggregatedData = Array.from(qualityTotals.values())
            .map(d => {
                const total = d.s + d.e;
                return {
                    x: d.x,
                    y: total > 0 ? Math.round((d.s / total) * 100) : 0,
                    total: total // Keep total for volume context if needed
                };
            })
            .sort((a, b) => a.x - b.x);

        // DEBUG: Log aggregated data
        console.info(`[DEBUG qualityTrendChart] Aggregated ${aggregatedData.length} data points`);
        if (aggregatedData.length > 0) {
            console.info(`[DEBUG qualityTrendChart] First point:`, aggregatedData[0]);
            console.info(`[DEBUG qualityTrendChart] Last point:`, aggregatedData[aggregatedData.length - 1]);
        }

        // --- Target Logic (Projection) ---
        // Try to find a target value explicitly mentioned or average
        let targetValue = 95; // Default 95% quality target
        if (projSheet.length > 0) {
            const tRow = projSheet.find(r => (r['Metric'] || '').toLowerCase().includes('quality') || (r['Metric'] || '').toLowerCase().includes('qualité'));
            if (tRow) {
                const tVal = parseFloat(tRow['Value'] || tRow['value']);
                if (!isNaN(tVal)) targetValue = tVal;
            }
        }

        // Ensure we always have data to show lines, even if 0
        if (aggregatedData.length === 0) aggregatedData = [];

        const color = 'rgba(16, 185, 129, 1)'; // Emerald

        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Taux Qualité (%)',
                    data: aggregatedData,
                    borderColor: color,
                    backgroundColor: this._makeAreaGradient(color, document.getElementById(id)),
                    fill: true,
                    yAxisID: 'y'
                }, {
                    label: 'Objectif',
                    data: aggregatedData.map(d => ({ x: d.x, y: targetValue })),
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'y'
                }]
            },
            options: {
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.y}%`
                        }
                    }
                },
                scales: {
                    x: { 
                        type: 'time', 
                        time: { 
                            unit: 'day',
                            displayFormats: {
                                day: 'DD/MM'
                            }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Taux de qualité (%)' }
                    }
                }
            }
        });
    }

    createRegionalAnalysisCharts(rawData) {
        const trendId = 'regionalTrendChart';
        const comparisonId = 'communeComparisonChart';

        const sheet = this.findSheet('dailyLeveeSource', rawData) || this.findSheet('Daily Levee Source', rawData) || this.findSheet('Yields Projections', rawData) || [];
        console.info(`createRegionalAnalysisCharts: Found sheet with ${sheet.length} rows`);

        // 1. Regional Trend
        if (document.getElementById(trendId)) {
            let datasets = [];
            if (sheet.length > 0) {
                const regionDateMap = {};
                const regions = new Set();
                sheet.forEach(row => {
                    const parsedDate = window.dataAggregationService ? window.dataAggregationService.parseDate(row['Date'] || row['date']) : new Date(row['Date'] || row['date']);
                    if (!parsedDate || isNaN(parsedDate)) return;

                    const date = parsedDate.toISOString().split('T')[0];
                    const region = row['Région'] || row['Region'] || 'Inconnu';
                    const val = this._getNumericField(row, ['Nombre de levées', 'Nombre de levee', 'levee']);

                    if (region !== 'Inconnu') {
                        regions.add(region);
                        if (!regionDateMap[date]) regionDateMap[date] = {};
                        regionDateMap[date][region] = (regionDateMap[date][region] || 0) + val;
                    }
                });

                // Sort dates for continuity
                const sortedDates = Object.keys(regionDateMap).sort();

                datasets = Array.from(regions).map((region, idx) => {
                    const colors = ['#1e40af', '#059669', '#d97706', '#dc2626', '#2563eb', '#7c3aed'];

                    // Accumulate values for a "Dynamic" trend (Running Total)
                    let runningTotal = 0;
                    const chartData = sortedDates.map(d => {
                        runningTotal += (regionDateMap[d][region] || 0);
                        // KPI calculation is handled by DataAggregationService
                        return { x: d, y: runningTotal };
                    });

                    return {
                        label: region,
                        data: chartData,
                        borderColor: colors[idx % colors.length],
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 1
                    };
                });
                if (datasets.length > 0) {
                    this._createChart(trendId, {
                        type: 'line',
                        data: { datasets },
                        options: {
                            scales: {
                                x: {
                                    type: 'time',
                                    time: { 
                                        unit: 'day', 
                                        displayFormats: { day: 'DD/MM' } 
                                    },
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 0,
                                        autoSkip: true,
                                        maxTicksLimit: 15
                                    }
                                },
                                y: {
                                    beginAtZero: true,
                                    title: { display: true, text: 'Cumul des levées', font: { size: 10 } }
                                }
                            }
                        }
                    });
                }
            }
        }

        // 2. Commune Comparison
        if (document.getElementById(comparisonId)) {
            let labels = [], data = [];
            if (sheet.length > 0) {
                const communeMap = {};
                sheet.forEach(r => {
                    const c = r.Commune || r.commune || 'Inconnu';
                    if (c === 'Inconnu') return;
                    communeMap[c] = (communeMap[c] || 0) + this._getNumericField(r, ['Nombre de levées', 'Nombre de levee', 'levee']);
                });
                const sorted = Object.entries(communeMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
                labels = sorted.map(e => e[0]);
                data = sorted.map(e => e[1]);
            } else {
                console.warn(`No data for ${comparisonId}, chart will be empty.`);
            }

            if (labels.length === 0) {
                console.warn(`No data for ${comparisonId}, chart will be empty.`);
                return;
            }

            if (labels.length > 0) {
                this._createChart(comparisonId, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Total Levées',
                            data: data,
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            borderRadius: 4
                        }]
                    },
                    options: {
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true },
                            x: { ticks: { font: { size: 9 } } }
                        }
                    }
                });
            }
        }
    }

    // createCtasfPipelineChart removed - chart deleted per user request

    createPostProcessingChart(rawData) {
        const id = 'postProcessingChart';
        if (!document.getElementById(id)) return;

        // Manual aggregation to avoid dataService dependency issues if any
        const sheet = this.findSheet('Post Process Follow-up', rawData) || this.findSheet('Post-traitement', rawData) || this.findSheet('postProcessFollowup', rawData);

        console.info(`createPostProcessingChart: Found sheet with ${sheet ? sheet.length : 0} rows`);
        
        // DEBUG: Log available keys and sample row
        if (sheet && sheet.length > 0) {
            console.info(`[DEBUG postProcessingChart] Available columns:`, Object.keys(sheet[0]));
            console.info(`[DEBUG postProcessingChart] Sample row:`, sheet[0]);
        }

        if (!sheet || sheet.length === 0) {
            console.warn(`No data for ${id}, chart will be empty.`);
            return;
        }

        const dailyTotals = new Map();

        sheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];
                const recues = this._getNumericField(row, ['Parcelles reçues (Brutes)', 'Recues', 'Brutes', 'Reçues', 'parcelles_recues', 'Parcelles reçues']) || 0;
                const traitees = this._getNumericField(row, ['Parcelles post traitées (Sans Doublons et topoplogie correcte)', 'Traitees', 'Post Traitees', 'Traitées', 'Post traitées', 'parcelles_traitees']) || 0;
                const jointes = this._getNumericField(row, ['Parcelles individuelles Jointes', 'Jointes', 'Individuelles jointes']) || 0; // Optional extra context

                if (dailyTotals.has(dateKey)) {
                    const entry = dailyTotals.get(dateKey);
                    entry.recues += recues;
                    entry.traitees += traitees;
                } else {
                    dailyTotals.set(dateKey, { x: dateObj, recues, traitees });
                }
            }
        });

        const aggregatedData = Array.from(dailyTotals.values()).sort((a, b) => a.x - b.x);

        // DEBUG: Log aggregated data
        console.info(`[DEBUG postProcessingChart] Aggregated ${aggregatedData.length} data points`);
        if (aggregatedData.length > 0) {
            console.info(`[DEBUG postProcessingChart] First point:`, aggregatedData[0]);
            console.info(`[DEBUG postProcessingChart] Last point:`, aggregatedData[aggregatedData.length - 1]);
        }

        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Reçues',
                    data: aggregatedData.map(d => ({ x: d.x, y: d.recues })),
                    borderColor: '#64748b', // Slate 500
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }, {
                    label: 'Traitées',
                    data: aggregatedData.map(d => ({ x: d.x, y: d.traitees })),
                    borderColor: '#10b981', // Emerald
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { 
                        type: 'time', 
                        time: { 
                            unit: 'day',
                            displayFormats: {
                                day: 'DD/MM'
                            }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    },
                    y: { beginAtZero: true }
                }
            }
        });
    }

    createParcelTypeDistributionChart(rawData) {
        const id = 'parcelTypeDistributionChart';
        if (!document.getElementById(id)) return;

        const sheet = this.findSheet('Commune Status', rawData) || this.findSheet('Commune Analysis', rawData) || [];

        let dataValues = [];
        if (sheet.length > 0) {
            const indiv = sheet.reduce((s, r) => s + this._getNumericField(r, ['Parcelles individuelles jointes', 'Parcelles individuelles']), 0);
            const coll = sheet.reduce((s, r) => s + this._getNumericField(r, ['Parcelles collectives jointes', 'Parcelles collectives']), 0);
            const non = sheet.reduce((s, r) => s + this._getNumericField(r, ['Parcelles non jointes']), 0);
            dataValues = [indiv, coll, non];
        }

        if (dataValues.length === 0) {
            console.warn(`No data for ${id}, chart will be empty.`);
            return;
        }

        this._createChart(id, {
            type: 'doughnut',
            data: {
                labels: ['Individuelles', 'Collectives', 'Non jointes'],
                datasets: [{
                    data: dataValues,
                    backgroundColor: ['#1e40af', '#059669', '#d97706'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    createTeamProductivityChart(rawData) {
        const id = 'teamProductivityChart';
        if (!document.getElementById(id)) return;

        // Use Yields Projections sheet to get total by Equipe
        const yieldsSheet = this.findSheet('Yields Projections', rawData) || this.findSheet('yieldsProjection', rawData) || [];
        
        let labels = [], data = [];

        if (yieldsSheet && yieldsSheet.length > 0) {
            console.info('createTeamProductivityChart: using Yields Projections sheet');
            console.info(`[DEBUG] Sample row:`, yieldsSheet[0]);
            
            const teamMap = {};
            
            yieldsSheet.forEach(r => {
                const team = r['Equipe'] || r['Équipe'] || r['Team'] || 'Inconnu';
                if (!team || team === 'Inconnu' || team === '') return;
                
                const levees = this._getNumericField(r, ['Nombre de levées', 'Nombre de levee', 'levees', 'levée']) || 0;
                console.info(`[DEBUG] Team ${team}: levees = ${levees}`);
                teamMap[team] = (teamMap[team] || 0) + levees;
            });

            const sorted = Object.entries(teamMap).sort((a, b) => b[1] - a[1]);
            labels = sorted.map(e => e[0]);
            data = sorted.map(e => e[1]);
            
            console.info(`[DEBUG] Final team data:`, { labels, data });
            console.info(`createTeamProductivityChart: Found ${labels.length} teams with data`);
        } else {
            console.warn('createTeamProductivityChart: No Yields Projections sheet found');
        }

        if (labels.length === 0) {
            console.warn(`No data for ${id}, chart will be empty.`);
            return;
        }

        this._createChart(id, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Nombre total de levées',
                    data: data,
                    backgroundColor: 'rgba(71, 85, 105, 0.8)',
                    borderRadius: 4
                }]
            },
            options: {
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Total: ' + context.parsed.x.toLocaleString() + ' levées';
                            }
                        }
                    }
                },
                indexAxis: 'y',
                scales: { 
                    x: { 
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Nombre de levées'
                        }
                    }
                }
            }
        });
    }

    // Helper for dummy access
    createGaugeCharts() { }
}

// Create global instance
window.chartService = new ChartService();
