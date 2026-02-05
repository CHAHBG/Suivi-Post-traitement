// @ts-nocheck
// Chart Service for creating and managing all dashboard charts
// Final Refinement for maximum resilience and visibility.

class ChartService {
    constructor() {
        this.charts = new Map();
        this.gauges = new Map();
        this._resizeObserverInitialized = false;

        // Current timeframe for chart aggregation (daily, weekly, monthly)
        this.currentTimeframe = 'daily';

        // French month names for date formatting
        this.frenchMonths = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        this.frenchMonthsShort = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

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
            const isDark = document.body.dataset.theme === 'dark';

            // Slate colors from Tailwind/our variables
            const slate50 = '#f8fafc';
            const slate200 = '#e2e8f0';
            const slate300 = '#cbd5e1';
            const slate400 = '#94a3b8';
            const slate600 = '#475569';
            const slate700 = '#334155';
            const slate800 = '#1e293b';

            // Typography & Colors based on theme
            Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
            Chart.defaults.color = isDark ? slate300 : slate600;
            Chart.defaults.font.size = 11;

            // Tooltip
            if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
                const tt = Chart.defaults.plugins.tooltip;
                tt.backgroundColor = isDark ? slate800 : 'rgba(255, 255, 255, 0.95)';
                tt.titleColor = isDark ? slate50 : 'rgba(30, 41, 59, 1)';
                tt.bodyColor = isDark ? slate300 : slate600;
                tt.borderColor = isDark ? slate700 : slate200;
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

            // Scales
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

            if (Chart.defaults.scales && Chart.defaults.scales.linear) {
                if (!Chart.defaults.scales.linear.grid) Chart.defaults.scales.linear.grid = {};
                Chart.defaults.scales.linear.grid.color = gridColor;
            }
            if (Chart.defaults.scales && Chart.defaults.scales.category) {
                if (!Chart.defaults.scales.category.grid) Chart.defaults.scales.category.grid = {};
                Chart.defaults.scales.category.grid.display = false;
            }
        } catch (e) {
            console.warn('Chart Defaults initialization failed:', e);
        }
    }

    /**
     * Update charts for theme change
     */
    updateTheme() {
        this._initGlobalTheme();

        // Redraw all charts
        this.charts.forEach((chart, id) => {
            try {
                const isDark = document.body.dataset.theme === 'dark';
                const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                const textColor = isDark ? '#cbd5e1' : '#475569';

                // Update scales colors
                if (chart.options.scales) {
                    Object.values(chart.options.scales).forEach(scale => {
                        if (scale.grid) scale.grid.color = gridColor;
                        if (scale.ticks) scale.ticks.color = textColor;
                        if (scale.title) scale.title.color = textColor;
                    });
                }

                // Update plugins colors (tooltips)
                if (chart.options.plugins && chart.options.plugins.tooltip) {
                    const tt = chart.options.plugins.tooltip;
                    tt.backgroundColor = isDark ? '#1e293b' : 'rgba(255, 255, 255, 0.95)';
                    tt.titleColor = isDark ? '#f8fafc' : 'rgba(30, 41, 59, 1)';
                    tt.bodyColor = isDark ? '#cbd5e1' : '#475569';
                    tt.borderColor = isDark ? '#334155' : '#e2e8f0';
                }

                chart.update('none'); // Update without animation for theme switch
            } catch (e) {
                console.error(`Error updating theme for chart ${id}:`, e);
            }
        });
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

    /**
     * Format date to French format: "02/01/2026" or "02 janvier 2026"
     */
    _formatDateFr(date, format = 'short') {
        if (!date || isNaN(date)) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.getMonth();
        const year = d.getFullYear();

        if (format === 'long') {
            return `${day} ${this.frenchMonths[month]} ${year}`;
        } else if (format === 'medium') {
            return `${day} ${this.frenchMonthsShort[month]}`;
        }
        // short format: DD/MM/YYYY
        return `${day}/${String(month + 1).padStart(2, '0')}`;
    }

    /**
     * Get common time scale options for Chart.js with French formatting
     * Now respects the current timeframe filter
     */
    _getTimeScaleOptions(maxTicks = 15) {
        const self = this;
        const timeUnit = this._getTimeUnit();
        return {
            type: 'time',
            time: {
                unit: timeUnit,
                displayFormats: {
                    day: 'DD/MM',
                    week: 'DD/MM',
                    month: 'MMM YYYY'
                },
                tooltipFormat: 'DD/MM/YYYY'
            },
            ticks: {
                maxRotation: 45,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: maxTicks,
                callback: function (value, index, ticks) {
                    const date = new Date(value);
                    if (isNaN(date)) return value;
                    return self._formatDateLabel(date);
                }
            }
        };
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
            // console.info(`[findSheet] Direct match for "${name}" with ${data[name].length} rows`);
            return data[name];
        }

        // Normalized match
        const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = norm(name);
        for (const k of Object.keys(data)) {
            if (norm(k) === target) {
                // console.info(`[findSheet] Normalized match: "${name}" -> "${k}" with ${data[k].length} rows`);
                return data[k];
            }
        }

        // Partial match (for cases like "CTASF Follow-up" matching "ctasfFollowup")
        for (const k of Object.keys(data)) {
            if (norm(k).includes(target) || target.includes(norm(k))) {
                // console.info(`[findSheet] Partial match: "${name}" -> "${k}" with ${data[k].length} rows`);
                return data[k];
            }
        }

        // console.warn(`[findSheet] No match found for "${name}". Available keys:`, Object.keys(data));
        return null;
    }

    _createChart(id, config) {
        this.destroyChart(id);
        const canvas = document.getElementById(id);
        if (!canvas) {
            // console.debug(`Chart canvas ${id} not found in DOM.`);
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
        // console.log('[ChartService] Starting initialization...');

        if (fullRawData) window.__fullRawData = fullRawData;
        else if (!window.__fullRawData) window.__fullRawData = rawData;

        const dataToUse = window.__fullRawData || rawData;

        // Performance: Check for visible charts only (lazy initialization)
        const isVisible = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            // Check if element or parent is hidden
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        // Priority charts (visible on load) - initialize immediately
        const priorityCharts = [
            { id: 'overviewDailyYieldsChart', fn: () => this.createDailyYieldsChartForCanvas('overviewDailyYieldsChart', rawData) },
            { id: 'dailyYieldsChart', fn: () => this.createDailyYieldsChartForCanvas('dailyYieldsChart', rawData) }
        ];

        // Secondary charts - defer initialization
        const secondaryCharts = [
            { id: 'qualityTrendChart', fn: () => this.createQualityTrendChart(rawData) },
            { id: 'regionalTrendChart', fn: () => this.createRegionalAnalysisCharts(rawData) },
            { id: 'postProcessingChart', fn: () => this.createPostProcessingChart(rawData) },
            { id: 'parcelTypeDistributionChart', fn: () => this.createParcelTypeDistributionChart(rawData) },
            { id: 'teamProductivityChart', fn: () => this.createTeamProductivityChart(rawData) },
            { id: 'yieldsVsValidationChart', fn: () => this.createYieldsVsValidationChart(rawData) },
            { id: 'validationRateChart', fn: () => this.createValidationRateChart(rawData) },
            { id: 'burnUpChart', fn: () => this.createBurnUpChart(rawData) },
            { id: 'velocityDeviationChart', fn: () => this.createVelocityDeviationChart(rawData) },
            { id: 'statusAgingChart', fn: () => this.createStatusAgingChart(rawData) },
            { id: 'bulletCharts', fn: () => this.createBulletCharts(rawData) },
            { id: 'efficiencyKPIs', fn: () => this.calculateEfficiencyKPIs(rawData) },
            { id: 'gauge-charts', fn: () => this.createGaugeCharts() }
        ];

        // Initialize priority charts synchronously for fast initial render
        for (const task of priorityCharts) {
            try {
                if (isVisible(task.id)) {
                    task.fn();
                }
            } catch (err) {
                console.error(`[ChartService] Priority task ${task.id} failed:`, err);
            }
        }

        // Use requestIdleCallback for secondary charts (non-blocking)
        const initSecondary = () => {
            for (const task of secondaryCharts) {
                try {
                    task.fn();
                } catch (err) {
                    console.error(`[ChartService] Task ${task.id} failed:`, err);
                }
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(initSecondary, { timeout: 1000 });
        } else {
            // Fallback: use setTimeout to yield to browser
            setTimeout(initSecondary, 50);
        }

        // console.log(`[ChartService] Initialized ${this.charts.size} charts.`);
        return true;
    }

    async updateCharts(rawData, precomputedKPIs = null, fullRawData = null, options = {}) {
        // Store timeframe for chart methods to use
        this.currentTimeframe = options.timeframe || 'daily';
        
        // Performance: Use 'none' animation mode for filter updates
        if (options.skipAnimation) {
            Chart.defaults.animation = false;
        }
        
        const result = await this.initializeCharts(rawData, precomputedKPIs, fullRawData);
        
        // Restore animation
        Chart.defaults.animation = true;
        
        return result;
    }

    /**
     * Aggregate data by timeframe (daily, weekly, monthly)
     * @param {Map} dailyMap - Map with date keys and values
     * @param {string} timeframe - 'daily', 'weekly', or 'monthly'
     * @returns {Array} Aggregated data sorted by date
     */
    _aggregateByTimeframe(dailyMap, timeframe = 'daily') {
        const tf = timeframe || this.currentTimeframe || 'daily';

        if (tf === 'daily') {
            // Return data as-is for daily
            return Array.from(dailyMap.values()).sort((a, b) => a.x - b.x);
        }

        const aggregated = new Map();

        dailyMap.forEach(entry => {
            const date = new Date(entry.x);
            let bucketKey;
            let bucketDate;

            if (tf === 'weekly') {
                // Get ISO week start (Monday)
                const dayOfWeek = date.getDay();
                const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                bucketDate = new Date(date.setDate(diff));
                bucketDate.setHours(0, 0, 0, 0);
                bucketKey = bucketDate.toISOString().split('T')[0];
            } else if (tf === 'monthly') {
                // Get month start
                bucketDate = new Date(date.getFullYear(), date.getMonth(), 1);
                bucketKey = bucketDate.toISOString().split('T')[0];
            }

            if (aggregated.has(bucketKey)) {
                const existing = aggregated.get(bucketKey);
                existing.y += entry.y;
                if (entry.count) existing.count = (existing.count || 1) + entry.count;
            } else {
                aggregated.set(bucketKey, {
                    x: bucketDate,
                    y: entry.y,
                    count: entry.count || 1
                });
            }
        });

        return Array.from(aggregated.values()).sort((a, b) => a.x - b.x);
    }

    /**
     * Get time unit for Chart.js based on timeframe
     */
    _getTimeUnit() {
        const tf = this.currentTimeframe || 'daily';
        switch (tf) {
            case 'monthly': return 'month';
            case 'weekly': return 'week';
            default: return 'day';
        }
    }

    /**
     * Format date label based on timeframe
     */
    _formatDateLabel(date) {
        if (!date || isNaN(date)) return '';
        const d = new Date(date);
        const tf = this.currentTimeframe || 'daily';

        const day = String(d.getDate()).padStart(2, '0');
        const month = d.getMonth();
        const year = d.getFullYear();

        if (tf === 'monthly') {
            return `${this.frenchMonthsShort[month]} ${year}`;
        } else if (tf === 'weekly') {
            // Show week start date
            return `Sem. ${day}/${String(month + 1).padStart(2, '0')}`;
        }
        // Daily
        return `${day}/${String(month + 1).padStart(2, '0')}`;
    }

    // --- Specific Chart Methods ---

    createDailyYieldsChartForCanvas(canvasId, rawData) {
        const id = canvasId;
        if (!document.getElementById(id)) return;

        const sheet = this.findSheet('dailyLeveeSource', rawData) || this.findSheet('Daily Levee Source', rawData) || this.findSheet('Yields Projections', rawData) || [];
        // console.info(`createDailyYieldsChartForCanvas(${canvasId}): Found sheet with ${sheet.length} rows`);

        if (sheet.length === 0) {
            // console.warn(`No data for ${canvasId}, chart will be empty.`);
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

        // Apply timeframe aggregation
        const aggregatedData = this._aggregateByTimeframe(dailyTotals);
        const timeUnit = this._getTimeUnit();
        const self = this;

        // Target line - adjust for timeframe
        let targetValue = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) ?
            window.CONFIG.TARGETS.DAILY_PARCELS : 387;

        // Multiply target for weekly/monthly
        const tf = this.currentTimeframe || 'daily';
        if (tf === 'weekly') targetValue *= 5; // 5 working days
        if (tf === 'monthly') targetValue *= 22; // ~22 working days

        // Dynamic label based on timeframe
        const labelMap = {
            daily: 'Levées quotidiennes',
            weekly: 'Levées hebdomadaires',
            monthly: 'Levées mensuelles'
        };

        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: labelMap[tf] || 'Levées quotidiennes',
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
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            title: function (context) {
                                const date = new Date(context[0].parsed.x);
                                return self._formatDateLabel(date);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: timeUnit },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15,
                            callback: function (value) {
                                const date = new Date(value);
                                return self._formatDateLabel(date);
                            }
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

        // console.info(`createQualityTrendChart: Found sheet with ${sheet ? sheet.length : 0} rows`);

        // DEBUG: Log available keys and sample row
        if (sheet && sheet.length > 0) {
            // console.info(`[DEBUG qualityTrendChart] Available columns:`, Object.keys(sheet[0]));
            // console.info(`[DEBUG qualityTrendChart] Sample row:`, sheet[0]);
        }

        if (!sheet || sheet.length === 0) {
            // console.warn(`No data for ${id}, chart will be empty.`);
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
        // console.info(`[DEBUG qualityTrendChart] Aggregated ${aggregatedData.length} data points`);
        if (aggregatedData.length > 0) {
            // console.info(`[DEBUG qualityTrendChart] First point:`, aggregatedData[0]);
            // console.info(`[DEBUG qualityTrendChart] Last point:`, aggregatedData[aggregatedData.length - 1]);
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
        const self = this;

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
                            title: function (context) {
                                const date = new Date(context[0].parsed.x);
                                return self._formatDateLabel(date);
                            },
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.y}%`
                        }
                    }
                },
                scales: {
                    x: this._getTimeScaleOptions(15),
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
        // console.info(`createRegionalAnalysisCharts: Found sheet with ${sheet.length} rows`);

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
                    const self = this;
                    this._createChart(trendId, {
                        type: 'line',
                        data: { datasets },
                        options: {
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        title: function (context) {
                                            const date = new Date(context[0].parsed.x);
                                            return self._formatDateLabel(date);
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    type: 'time',
                                    time: { unit: self._getTimeUnit() },
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 0,
                                        autoSkip: true,
                                        maxTicksLimit: 15,
                                        callback: function (value) {
                                            const date = new Date(value);
                                            return self._formatDateLabel(date);
                                        }
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
                // console.warn(`No data for ${comparisonId}, chart will be empty.`);
            }

            if (labels.length === 0) {
                // console.warn(`No data for ${comparisonId}, chart will be empty.`);
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

        // console.info(`createPostProcessingChart: Found sheet with ${sheet ? sheet.length : 0} rows`);

        // DEBUG: Log available keys and sample row
        if (sheet && sheet.length > 0) {
            // console.info(`[DEBUG postProcessingChart] Available columns:`, Object.keys(sheet[0]));
            // console.info(`[DEBUG postProcessingChart] Sample row:`, sheet[0]);
        }

        if (!sheet || sheet.length === 0) {
            // console.warn(`No data for ${id}, chart will be empty.`);
            return;
        }

        const dailyTotals = new Map();

        sheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];

                // New simplified template columns
                const recues = this._getNumericField(row, [
                    'Parcelles Brutes par topo',
                    'Parcelles Brutes  par topo', // Note: extra space in case of typo
                    'Nombre de parcelles reçues par topographe',
                    'Nombre total de parcelles reçues équipe',
                    'Parcelles reçues (Brutes)',
                    'Recues',
                    'Brutes',
                    'Reçues',
                    'parcelles_recues',
                    'Parcelles reçues'
                ]) || 0;

                // New simplified template: validated parcels
                const traitees = this._getNumericField(row, [
                    'Parcelles validees par Topo',
                    'Parcelles Total Validee Equipe A',
                    'Parcelles Total Validee Equipe B',
                    'Nombre de parcelles validées par topographe',
                    'Nombre de parcelles validées équipe',
                    'Parcelles post traitées (Sans Doublons et topoplogie correcte)',
                    'Traitees',
                    'Post Traitees',
                    'Traitées',
                    'Post traitées',
                    'parcelles_traitees'
                ]) || 0;

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
        // console.info(`[DEBUG postProcessingChart] Aggregated ${aggregatedData.length} data points`);
        if (aggregatedData.length > 0) {
            // console.info(`[DEBUG postProcessingChart] First point:`, aggregatedData[0]);
            // console.info(`[DEBUG postProcessingChart] Last point:`, aggregatedData[aggregatedData.length - 1]);
        }

        const self = this;
        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Parcelles Reçues',
                    data: aggregatedData.map(d => ({ x: d.x, y: d.recues })),
                    borderColor: '#64748b', // Slate 500
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }, {
                    label: 'Parcelles Validées',
                    data: aggregatedData.map(d => ({ x: d.x, y: d.traitees })),
                    borderColor: '#10b981', // Emerald
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const date = new Date(context[0].parsed.x);
                                return self._formatDateLabel(date);
                            }
                        }
                    }
                },
                scales: {
                    x: this._getTimeScaleOptions(15),
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
            // console.warn(`No data for ${id}, chart will be empty.`);
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
            // console.info('createTeamProductivityChart: using Yields Projections sheet');
            // console.info(`[DEBUG] Sample row:`, yieldsSheet[0]);

            const teamMap = {};

            yieldsSheet.forEach(r => {
                const team = r['Equipe'] || r['Équipe'] || r['Team'] || 'Inconnu';
                if (!team || team === 'Inconnu' || team === '') return;

                const levees = this._getNumericField(r, ['Nombre de levées', 'Nombre de levee', 'levees', 'levée']) || 0;
                // console.info(`[DEBUG] Team ${team}: levees = ${levees}`);
                teamMap[team] = (teamMap[team] || 0) + levees;
            });

            const sorted = Object.entries(teamMap).sort((a, b) => b[1] - a[1]);
            labels = sorted.map(e => e[0]);
            data = sorted.map(e => e[1]);

            // console.info(`[DEBUG] Final team data:`, { labels, data });
            // console.info(`createTeamProductivityChart: Found ${labels.length} teams with data`);
        } else {
            // console.warn('createTeamProductivityChart: No Yields Projections sheet found');
        }

        if (labels.length === 0) {
            // console.warn(`No data for ${id}, chart will be empty.`);
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
                            label: function (context) {
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

    /**
     * NEW: Create Yields vs Validation Comparison Chart
     * Compares daily yields from field with validated parcels from post-processing
     */
    createYieldsVsValidationChart(rawData) {
        const id = 'yieldsVsValidationChart';
        if (!document.getElementById(id)) return;

        const yieldsSheet = this.findSheet('Yields Projections', rawData) || this.findSheet('Daily Levee Source', rawData) || [];
        const postProcessSheet = this.findSheet('Post Process Follow-up', rawData) || [];

        // console.info(`createYieldsVsValidationChart: Yields=${yieldsSheet.length} rows, PostProcess=${postProcessSheet.length} rows`);

        if (yieldsSheet.length === 0 && postProcessSheet.length === 0) {
            // console.warn(`No data for ${id}`);
            return;
        }

        // Aggregate yields by date
        const yieldsByDate = new Map();
        yieldsSheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];
                const levees = this._getNumericField(row, ['Nombre de levées', 'Nombre de levee']) || 0;
                yieldsByDate.set(dateKey, (yieldsByDate.get(dateKey) || 0) + levees);
            }
        });

        // Aggregate validated parcels by date
        const validatedByDate = new Map();
        postProcessSheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];
                const validated = this._getNumericField(row, ['Parcelles validees par Topo', 'Parcelles Total Validee Equipe A', 'Parcelles Total Validee Equipe B']) || 0;
                validatedByDate.set(dateKey, (validatedByDate.get(dateKey) || 0) + validated);
            }
        });

        // Merge dates and create datasets
        const allDates = new Set([...yieldsByDate.keys(), ...validatedByDate.keys()]);
        const sortedDates = Array.from(allDates).sort();

        const yieldsData = sortedDates.map(dateKey => ({
            x: new Date(dateKey),
            y: yieldsByDate.get(dateKey) || 0
        }));

        const validatedData = sortedDates.map(dateKey => ({
            x: new Date(dateKey),
            y: validatedByDate.get(dateKey) || 0
        }));

        const self = this;
        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Levées Terrain',
                    data: yieldsData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Parcelles Validées',
                    data: validatedData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            title: function (context) {
                                const date = new Date(context[0].parsed.x);
                                return self._formatDateLabel(date);
                            }
                        }
                    }
                },
                scales: {
                    x: this._getTimeScaleOptions(15),
                    y: { beginAtZero: true }
                }
            }
        });
    }

    /**
     * NEW: Create Validation Rate Chart
     * Shows percentage of validated parcels over time
     */
    createValidationRateChart(rawData) {
        const id = 'validationRateChart';
        if (!document.getElementById(id)) return;

        const postProcessSheet = this.findSheet('Post Process Follow-up', rawData) || [];

        // console.info(`createValidationRateChart: Found ${postProcessSheet.length} rows`);

        if (postProcessSheet.length === 0) {
            // console.warn(`No data for ${id}`);
            return;
        }

        // Calculate validation rate by date
        const rateByDate = new Map();

        postProcessSheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];
                const brutes = this._getNumericField(row, ['Parcelles Brutes  par topo', 'Parcelles Brutes par topo']) || 0;
                const validees = this._getNumericField(row, ['Parcelles validees par Topo', 'Parcelles Total Validee Equipe A', 'Parcelles Total Validee Equipe B']) || 0;

                if (!rateByDate.has(dateKey)) {
                    rateByDate.set(dateKey, { brutes: 0, validees: 0 });
                }
                const entry = rateByDate.get(dateKey);
                entry.brutes += brutes;
                entry.validees += validees;
            }
        });

        // Calculate percentages
        const chartData = Array.from(rateByDate.entries())
            .map(([dateKey, values]) => ({
                x: new Date(dateKey),
                y: values.brutes > 0 ? (values.validees / values.brutes * 100) : 0
            }))
            .sort((a, b) => a.x - b.x);

        const self = this;
        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Taux de Validation (%)',
                    data: chartData,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const date = new Date(context[0].parsed.x);
                                return self._formatDateLabel(date);
                            },
                            label: (context) => `${context.parsed.y.toFixed(1)}% validé`
                        }
                    }
                },
                scales: {
                    x: this._getTimeScaleOptions(15),
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        },
                        title: {
                            display: true,
                            text: 'Taux de validation (%)'
                        }
                    }
                }
            }
        });
    }

    /**
     * Burn-Up Chart: Shows cumulative target vs actual completed
     */
    createBurnUpChart(rawData) {
        const id = 'burnUpChart';
        if (!document.getElementById(id)) return;

        const yieldsSheet = this.findSheet('Yields Projections', rawData) || this.findSheet('Daily Levee Source', rawData) || [];

        if (yieldsSheet.length === 0) {
            // console.warn(`No data for ${id}`);
            return;
        }

        // Aggregate by date
        const dailyTotals = new Map();
        yieldsSheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];
                const levees = this._getNumericField(row, ['Nombre de levées', 'Nombre de levee']) || 0;
                dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + levees);
            }
        });

        // Sort and calculate cumulative
        const sortedDates = Array.from(dailyTotals.keys()).sort();
        let cumulative = 0;
        const cumulativeData = [];
        const dailyTarget = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) || 387;
        const monthlyTarget = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.MONTHLY_PARCELS) || 12000;

        sortedDates.forEach((dateKey, idx) => {
            cumulative += dailyTotals.get(dateKey);
            cumulativeData.push({ x: new Date(dateKey), y: cumulative });
        });

        // Target line (linear progress to monthly goal)
        const targetData = sortedDates.map((dateKey, idx) => ({
            x: new Date(dateKey),
            y: dailyTarget * (idx + 1)
        }));

        // Projection (forecast based on current velocity)
        const avgVelocity = cumulative / sortedDates.length;
        const lastDate = new Date(sortedDates[sortedDates.length - 1]);
        const projectionData = [...cumulativeData];

        // Project 14 days ahead
        for (let i = 1; i <= 14; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setDate(futureDate.getDate() + i);
            projectionData.push({
                x: futureDate,
                y: cumulative + (avgVelocity * i)
            });
        }

        const self = this;
        this._createChart(id, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Cumul Réalisé',
                    data: cumulativeData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0,
                    borderWidth: 3
                }, {
                    label: 'Objectif Cumulé',
                    data: targetData,
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }, {
                    label: 'Projection',
                    data: projectionData.slice(cumulativeData.length - 1),
                    borderColor: '#2563eb',
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true, position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const date = new Date(context[0].parsed.x);
                                return self._formatDateLabel(date);
                            },
                            label: (context) => `${context.dataset.label}: ${Math.round(context.parsed.y).toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: this._getTimeScaleOptions(12),
                    y: { beginAtZero: true }
                }
            }
        });
    }

    /**
     * Velocity Deviation Chart: Shows daily performance vs target (green up, red down)
     */
    createVelocityDeviationChart(rawData) {
        const id = 'velocityDeviationChart';
        if (!document.getElementById(id)) return;

        const yieldsSheet = this.findSheet('Yields Projections', rawData) || this.findSheet('Daily Levee Source', rawData) || [];

        if (yieldsSheet.length === 0) {
            // console.warn(`No data for ${id}`);
            return;
        }

        let dailyTarget = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) || 387;
        const tf = this.currentTimeframe || 'daily';

        // Adjust target for timeframe
        if (tf === 'weekly') dailyTarget *= 5;
        if (tf === 'monthly') dailyTarget *= 22;

        // Aggregate by date first
        const dailyTotals = new Map();
        yieldsSheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (dateObj && !isNaN(dateObj)) {
                const dateKey = dateObj.toISOString().split('T')[0];
                const levees = this._getNumericField(row, ['Nombre de levées', 'Nombre de levee']) || 0;
                if (dailyTotals.has(dateKey)) {
                    dailyTotals.get(dateKey).y += levees;
                } else {
                    dailyTotals.set(dateKey, { x: new Date(dateKey), y: levees });
                }
            }
        });

        // Apply timeframe aggregation
        const aggregatedData = this._aggregateByTimeframe(dailyTotals);
        const self = this;
        const labels = aggregatedData.map(d => self._formatDateLabel(d.x));
        const deviations = aggregatedData.map(d => d.y - dailyTarget);
        const colors = deviations.map(d => d >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)');

        this._createChart(id, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Déviation vs Objectif',
                    data: deviations,
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const val = context.parsed.y;
                                return val >= 0 ? `+${val} au-dessus` : `${val} en-dessous`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 15 }
                    },
                    y: {
                        grid: {
                            color: (context) => context.tick.value === 0 ? '#64748b' : 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            callback: (value) => (value > 0 ? '+' : '') + value
                        }
                    }
                }
            }
        });
    }

    /**
     * Status Aging Histogram: Shows backlog by status with age buckets
     */
    createStatusAgingChart(rawData) {
        const id = 'statusAgingChart';
        if (!document.getElementById(id)) return;

        const postProcessSheet = this.findSheet('Post Process Follow-up', rawData) || [];

        if (postProcessSheet.length === 0) {
            // console.warn(`No data for ${id}`);
            return;
        }

        const now = new Date();
        const ageBuckets = {
            'Brutes': { lt1: 0, d2_5: 0, gt5: 0 },
            'Validées': { lt1: 0, d2_5: 0, gt5: 0 },
            'En attente': { lt1: 0, d2_5: 0, gt5: 0 }
        };

        postProcessSheet.forEach(row => {
            const dateObj = window.dataAggregationService ?
                window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                new Date(row['Date'] || row['date']);

            if (!dateObj || isNaN(dateObj)) return;

            const daysDiff = Math.floor((now - dateObj) / (1000 * 60 * 60 * 24));
            const brutes = this._getNumericField(row, ['Parcelles Brutes  par topo', 'Parcelles Brutes par topo']) || 0;
            const validees = this._getNumericField(row, ['Parcelles validees par Topo']) || 0;
            const pending = Math.max(0, brutes - validees);

            const bucket = daysDiff <= 1 ? 'lt1' : daysDiff <= 5 ? 'd2_5' : 'gt5';

            ageBuckets['Brutes'][bucket] += brutes;
            ageBuckets['Validées'][bucket] += validees;
            ageBuckets['En attente'][bucket] += pending;
        });

        const labels = Object.keys(ageBuckets);

        this._createChart(id, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '< 1 jour',
                    data: labels.map(l => ageBuckets[l].lt1),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 2
                }, {
                    label: '2-5 jours',
                    data: labels.map(l => ageBuckets[l].d2_5),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderRadius: 2
                }, {
                    label: '> 5 jours',
                    data: labels.map(l => ageBuckets[l].gt5),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true, position: 'bottom' }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    }

    /**
     * Create Bullet Charts for Regional Performance
     */
    createBulletCharts(rawData) {
        const container = document.getElementById('bulletChartsContainer');
        if (!container) return;

        const yieldsSheet = this.findSheet('Yields Projections', rawData) || this.findSheet('Daily Levee Source', rawData) || [];

        if (yieldsSheet.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 text-sm">Aucune donnée disponible</div>';
            return;
        }

        // Aggregate by region
        const regionTotals = new Map();
        yieldsSheet.forEach(row => {
            const region = row['Région'] || row['Region'] || 'Inconnu';
            if (region === 'Inconnu') return;

            const levees = this._getNumericField(row, ['Nombre de levées', 'Nombre de levee']) || 0;
            regionTotals.set(region, (regionTotals.get(region) || 0) + levees);
        });

        if (regionTotals.size === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 text-sm">Aucune région trouvée</div>';
            return;
        }

        // Calculate targets (e.g., equal split of monthly target)
        const monthlyTarget = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.MONTHLY_PARCELS) || 12000;
        const regionTarget = Math.round(monthlyTarget / regionTotals.size);
        const maxValue = Math.max(...regionTotals.values(), regionTarget) * 1.1;

        let html = '';
        regionTotals.forEach((actual, region) => {
            const percentage = (actual / maxValue) * 100;
            const targetPercentage = (regionTarget / maxValue) * 100;
            const isAhead = actual >= regionTarget;

            // Determine performance zone
            const poorThreshold = regionTarget * 0.6;
            const avgThreshold = regionTarget * 0.9;
            const poorWidth = (poorThreshold / maxValue) * 100;
            const avgWidth = (avgThreshold / maxValue) * 100;

            html += `
                <div class="bullet-chart">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[11px] font-bold text-secondary">${region}</span>
                        <span class="text-[10px] ${isAhead ? 'text-success' : 'text-danger'} font-bold">${actual.toLocaleString()}</span>
                    </div>
                    <div class="relative h-4 bg-slate-100 rounded overflow-hidden">
                        <!-- Performance zones -->
                        <div class="absolute inset-y-0 left-0 bg-red-100" style="width: ${poorWidth}%"></div>
                        <div class="absolute inset-y-0 left-0 bg-amber-100" style="width: ${avgWidth}%"></div>
                        <div class="absolute inset-y-0 left-0 bg-green-100" style="width: 100%"></div>
                        <!-- Actual bar -->
                        <div class="absolute inset-y-0.5 left-0 bg-slate-700 rounded" style="width: ${percentage}%"></div>
                        <!-- Target marker -->
                        <div class="absolute inset-y-0 w-0.5 bg-red-600" style="left: ${targetPercentage}%"></div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Calculate and update efficiency KPIs
     */
    calculateEfficiencyKPIs(rawData) {
        // console.info('[calculateEfficiencyKPIs] Starting calculation...');

        try {
            const postProcessSheet = this.findSheet('Post Process Follow-up', rawData) || [];
            // Prefer actual daily yields for "Prochain Lot" (current week sum).
            // Projections sheets often don't have the right date/levees columns.
            const yieldsSheet = this.findSheet('Daily Levee Source', rawData) || this.findSheet('Yields Projections', rawData) || [];

            // console.info(`[calculateEfficiencyKPIs] Found ${postProcessSheet.length} post-process rows, ${yieldsSheet.length} yields rows`);

            // --- Post Process KPIs ---
            let totalBrutes = 0, totalValidees = 0, wipOver48h = 0;
            const now = new Date();

            postProcessSheet.forEach(row => {
                const brutes = this._getNumericField(row, ['Parcelles Brutes  par topo', 'Parcelles Brutes par topo']) || 0;
                const validees = this._getNumericField(row, ['Parcelles validees par Topo']) || 0;
                totalBrutes += brutes;
                totalValidees += validees;

                const dateObj = window.dataAggregationService ?
                    window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                    new Date(row['Date'] || row['date']);

                if (dateObj && !isNaN(dateObj)) {
                    const hoursDiff = (now - dateObj) / (1000 * 60 * 60);
                    if (hoursDiff > 48 && brutes > validees) {
                        wipOver48h += (brutes - validees);
                    }
                }
            });

            // FTR: First Time Right (% validated without rework)
            const ftr = totalBrutes > 0 ? Math.round((totalValidees / totalBrutes) * 100) : 0;

            // Calcul du nombre de parcelles à transmettre pour le prochain lot
            // Somme des levées du lundi au samedi de la semaine en cours
            let weeklyYields = 0;
            const getDateRaw = (row) => {
                if (!row || typeof row !== 'object') return null;
                // Try common exact headers first
                const direct = row['Date'] ?? row['date'] ?? row['Jour'] ?? row['jour'] ?? row['DATE'];
                if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;

                // Fallback: find any key that looks like a date/day column
                for (const k of Object.keys(row)) {
                    const nk = String(k).toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüç]/gi, '');
                    if (nk.includes('date') || nk.includes('jour')) {
                        const v = row[k];
                        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
                    }
                }
                return null;
            };

            // Anchor the "current week" to the latest available data date.
            // This avoids showing 0 when the sheet data is delayed.
            let today = null;
            try {
                for (const row of yieldsSheet) {
                    const dateRaw = getDateRaw(row);
                    const pd = window.dataAggregationService ?
                        window.dataAggregationService.parseDate(dateRaw) :
                        new Date(dateRaw);
                    if (pd && !isNaN(pd)) {
                        if (!today || pd > today) today = pd;
                    }
                }
            } catch (_) {
                // ignore and fall back
            }

            if (!today || isNaN(today)) {
                today = new Date();
            }
            today = new Date(today);
            today.setHours(0, 0, 0, 0);

            // Trouver le lundi de la semaine de référence
            const dayOfWeek = today.getDay(); // 0 = dimanche, 1 = lundi, etc.
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Si dimanche, remonter de 6 jours
            const monday = new Date(today);
            monday.setDate(today.getDate() - daysFromMonday);
            monday.setHours(0, 0, 0, 0);

            // Samedi de la semaine de référence
            const saturday = new Date(monday);
            saturday.setDate(monday.getDate() + 5); // Lundi + 5 jours = Samedi
            saturday.setHours(23, 59, 59, 999);

            yieldsSheet.forEach(row => {
                const dateRaw = getDateRaw(row);
                const dateObj = window.dataAggregationService ?
                    window.dataAggregationService.parseDate(dateRaw) :
                    new Date(dateRaw);

                if (dateObj && !isNaN(dateObj)) {
                    dateObj.setHours(0, 0, 0, 0);
                    // Si la date est entre lundi et samedi inclus
                    if (dateObj >= monday && dateObj <= saturday) {
                        const levees = this._getNumericField(row, [
                            'Nombre de levées',
                            'nombre de levees',
                            'nombre de levées',
                            'Nombre de levees',
                            'Levees',
                            'Levées',
                            'levées',
                            'levees',
                            'levee',
                            'levée'
                        ]) || 0;
                        weeklyYields += levees;
                    }
                }
            });

            // console.info(`[calculateEfficiencyKPIs] FTR: ${ftr}%, Weekly Yields (Lundi-Samedi): ${weeklyYields}, WIP: ${wipOver48h}`);

            // Update DOM
            const ftrEl = document.getElementById('ftrValue');
            const cycleEl = document.getElementById('avgCycleTime');
            const wipEl = document.getElementById('wipAge');

            if (ftrEl) ftrEl.textContent = ftr + '%';
            if (cycleEl) cycleEl.textContent = weeklyYields.toLocaleString();
            if (wipEl) wipEl.textContent = wipOver48h.toLocaleString();

            // console.info('[calculateEfficiencyKPIs] Post-process KPIs updated');

            // --- Yields Strategy KPIs ---
            const dailyTarget = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) || 387;
            const monthlyTarget = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.MONTHLY_PARCELS) || 12000;

            let totalLevees = 0;
            const dailyTotals = new Map();
            yieldsSheet.forEach(row => {
                const levees = this._getNumericField(row, ['Nombre de levées', 'Nombre de levee']) || 0;
                totalLevees += levees;

                const dateObj = window.dataAggregationService ?
                    window.dataAggregationService.parseDate(row['Date'] || row['date']) :
                    new Date(row['Date'] || row['date']);
                if (dateObj && !isNaN(dateObj)) {
                    const dateKey = dateObj.toISOString().split('T')[0];
                    dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + levees);
                }
            });

            const daysWorked = dailyTotals.size || 1;
            const avgVelocity = totalLevees / daysWorked;

            // Days remaining in month
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const daysRemaining = Math.max(1, Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24)));

            // Required Run Rate to hit monthly target
            const remaining = monthlyTarget - totalLevees;

            // Completion Confidence - Monthly (Levee)
            let projectedMonthlyDateStr = '--';
            // Completion Confidence - 75k (Post-process)
            let projected75kDateStr = '--';

            // Get the estimated completion dates from KPIs (no fallback to avoid inconsistency)
            // Formula: Time to Goal = Remaining Work ÷ Current Pace
            if (window.kpis && window.kpis.monthly && window.kpis.monthly.forecast) {
                if (window.kpis.monthly.forecast.estimatedCompletionDateShort) {
                    projectedMonthlyDateStr = window.kpis.monthly.forecast.estimatedCompletionDateShort;
                }
                if (window.kpis.monthly.forecast.projection70kDateShort) {
                    projected75kDateStr = window.kpis.monthly.forecast.projection70kDateShort;
                }
            }

            // console.info(`[calculateEfficiencyKPIs] Monthly Projected: ${projectedMonthlyDateStr}, 75k Projected: ${projected75kDateStr}`);

            // Update DOM
            const rrrEl = document.getElementById('rrrValue');
            const svEl = document.getElementById('scheduleVariance');
            const ccEl = document.getElementById('completionConfidence');

            // Schedule Variance (cumulative actual vs expected)
            const expectedCumulative = dailyTarget * daysWorked;
            const scheduleVariance = totalLevees - expectedCumulative;

            if (rrrEl) rrrEl.textContent = projectedMonthlyDateStr;
            if (svEl) {
                svEl.textContent = (scheduleVariance >= 0 ? '+' : '') + scheduleVariance.toLocaleString();
                svEl.className = svEl.className.replace(/text-(purple|red|green)-\d+/, scheduleVariance >= 0 ? 'text-purple-600' : 'text-red-600');
            }
            if (ccEl) ccEl.textContent = projected75kDateStr;

            // console.info('[calculateEfficiencyKPIs] All KPIs updated successfully');
        } catch (error) {
            console.error('[calculateEfficiencyKPIs] Error calculating KPIs:', error);
        }
    }

    // Helper for dummy access
    createGaugeCharts() { }
}

// Create global instance
window.chartService = new ChartService();
