// @ts-nocheck
// Chart Service for creating and managing all dashboard charts

class ChartService {
    constructor() {
        this.charts = new Map();
        this.gauges = new Map();
        this.initializedBasic = false;
        this.deferredQueue = [];
        this._resizeObserverInitialized = false;
        
        // Ensure CONFIG exists and has COLORS
        if (typeof window.CONFIG === 'undefined') {
            window.CONFIG = {};
        }
        
        // Set default colors if not defined
        if (!window.CONFIG.COLORS) {
            window.CONFIG.COLORS = {
                primary: '#4285F4',   // Google Blue
                secondary: '#34A853', // Google Green
                success: '#0F9D58',   // Dark Green
                warning: '#FBBC05',   // Google Yellow
                danger: '#EA4335',    // Google Red
                info: '#46BFBD',      // Teal
                accent: '#9C27B0',    // Purple
                light: '#F5F5F5',     // Light Gray
                dark: '#212121'       // Dark Gray
            };
        }
        
        // Add helper method for parsing numeric values
        this._parseNumeric = (value) => {
            if (value === undefined || value === null) return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                // Remove any non-numeric characters except decimal point and minus
                const cleanValue = value.replace(/[^\d.-]/g, '');
                const parsed = parseFloat(cleanValue);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        };

        // Use the centralized date parsing from dataAggregationService
        this.parseDateDMY = (dateStr) => {
            // First try with dataAggregationService if available
            if (window.dataAggregationService && typeof window.dataAggregationService.parseDate === 'function') {
                const result = window.dataAggregationService.parseDate(dateStr);
                if (result) return result;
            }
            
            // Fallback to original implementation if dataAggregationService is not available
            if (!dateStr && dateStr !== 0) return null;
            try {
                const parts = String(dateStr).trim().split(/[/.\-]/);
                if (parts.length !== 3) return null;
                let day = parseInt(parts[0], 10);
                let month = parseInt(parts[1], 10);
                let year = parseInt(parts[2], 10);
                if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
                if (year < 100) year += 2000; // normalize 2-digit year
                const d = new Date(year, month - 1, day);
                if (isNaN(d.getTime())) return null;
                if (d.getFullYear() !== year || (d.getMonth() + 1) !== month || d.getDate() !== day) return null;
                return d;
            } catch (e) {
                // Suppressed parsing fallback warning
                return null;
            }
        };
        
        // Format date consistently using dataAggregationService
        this.formatDate = (date) => {
            if (window.dataAggregationService && typeof window.dataAggregationService.formatDate === 'function') {
                return window.dataAggregationService.formatDate(date);
            }
            
            // Fallback if dataAggregationService is not available
            if (!(date instanceof Date) || isNaN(date)) return null;
            return date.toISOString().split('T')[0];
        };
        
        // Initialize modern Chart.js theme once
        this._initGlobalTheme();
        
        // Debounced resize to update charts responsively
        this._debouncedResize = this._debounce(() => {
            this.charts.forEach(chart => {
                try {
                    if (chart.canvas && chart.canvas.parentNode) {
                        const parent = chart.canvas.parentNode;
                        chart.resize(parent.clientWidth, parent.clientHeight);
                    } else {
                        chart.resize();
                    }
                } catch (e) {
                    console.warn('Error resizing chart:', e);
                }
            });
        }, 100);
        
        window.addEventListener('resize', this._debouncedResize);
        // Helper to get a field by index from a row, useful for CSV data
        this._getField = (row, index) => {
            if (!row) return null;
            
            // If row is an array, just use the index
            if (Array.isArray(row)) {
                return row[index];
            }
            
            // If row is an object with _rawData property that's an array (e.g., from CSV)
            if (row._rawData && Array.isArray(row._rawData)) {
                return row._rawData[index];
            }
            
            // If row has a field that stores the array index data
            if (row.data && Array.isArray(row.data)) {
                return row.data[index];
            }
            
            // For objects with direct properties named as indices
            const indexKey = index.toString();
            if (indexKey in row) {
                return row[indexKey];
            }
            
            return null;
        };
        
    // Helper method to adjust a date by a specified number of days (DMY aware)
    this._adjustDateByDays = (dateStr, days) => {
            if (!dateStr) return '';
            try {
                // Prioritize dataAggregationService.parseDate if available
                let date;
                if (window.dataAggregationService && typeof window.dataAggregationService.parseDate === 'function') {
                    date = window.dataAggregationService.parseDate(dateStr);
                }
                
                // Fall back to other methods if dataAggregationService didn't parse successfully
                if (!date) {
                    date = (window.UTILS && UTILS.parseDateDMY) ? UTILS.parseDateDMY(dateStr) : (this.parseDateDMY ? this.parseDateDMY(dateStr) : new Date(dateStr));
                }
                
                date.setDate(date.getDate() + days);
                return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
            } catch (e) {
                console.error('Error adjusting date:', e);
                return dateStr; // Return original if error
            }
        };
        
        // Prefer using dataAggregationService helper if available
        this._getNumericField = (row, candidates) => {
            try {
                if (window.dataAggregationService && typeof window.dataAggregationService._getNumericField === 'function') {
                    return window.dataAggregationService._getNumericField(row, candidates);
                }
            } catch (e) { /* fallback */ }

            // Local fallback: try permissive parsing
            if (!row || typeof row !== 'object') return 0;
            const normKey = (s) => String(s || '').trim().toLowerCase().replace(/\u00A0/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
            const map = {};
            Object.keys(row).forEach(k => { map[normKey(k)] = row[k]; });
            const candidatesArr = Array.isArray(candidates) ? candidates : [candidates];
            for (const c of candidatesArr) {
                const nc = normKey(c);
                if (nc in map) {
                    const val = map[nc];
                    const num = Number(String(val).replace(/\s+/g,'').replace(/,/g,'.'));
                    if (!Number.isNaN(num)) return num;
                }
            }
            return 0;
        };
    }

    

    _initGlobalTheme(){
        if (typeof Chart === 'undefined') return;
        // Avoid re-applying (idempotent)
        if (Chart.__PROC_MODERN_THEME__) return;
        Chart.__PROC_MODERN_THEME__ = true;
        const baseFont = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        Chart.defaults.font.family = baseFont;
        Chart.defaults.font.size = 12;
        // Pull colors from CSS custom properties if available
        const getVar = (name, fallback) => {
            try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch(_) { return fallback; }
        };
        Chart.defaults.color = getVar('--text-500', '#4b5563');
        Chart.defaults.elements.line.borderWidth = 2;
        Chart.defaults.elements.line.tension = 0.35;
        Chart.defaults.elements.point.radius = 3;
        Chart.defaults.elements.point.hoverRadius = 5;
        Chart.defaults.animation.duration = 600;
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.tooltip.backgroundColor = '#111827EE';
        Chart.defaults.plugins.tooltip.borderColor = '#374151';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };
        Chart.defaults.layout = Chart.defaults.layout || {};
        Chart.defaults.layout.padding = { top: 8, right: 12, bottom: 4, left: 8 };
        
        // Improve responsive behavior
        Chart.defaults.maintainAspectRatio = false; // Allow charts to fill container
        Chart.defaults.responsive = true;
        Chart.defaults.resizeDelay = 0; // Immediate resize
        Chart.defaults.onResize = function(chart, size) {
            // Make sure chart adapts immediately to container changes
            if (chart.canvas && chart.canvas.parentNode) {
                const container = chart.canvas.parentNode;
                chart.height = container.clientHeight;
                chart.width = container.clientWidth;
            }
        };
        
        // Adjust scales to be more compact
        Chart.defaults.scales = Chart.defaults.scales || {};
        Chart.defaults.scales.x = Chart.defaults.scales.x || {};
        Chart.defaults.scales.y = Chart.defaults.scales.y || {};
        Chart.defaults.scales.x.grid = { 
            display: true,
            drawBorder: false,
            drawTicks: false,
            color: getVar('--border-200', '#e5e7eb50')
        };
        Chart.defaults.scales.y.grid = {
            display: true,
            drawBorder: false,
            drawTicks: false,
            color: getVar('--border-200', '#e5e7eb50')
        };
        Chart.defaults.scales.x.ticks = { 
            padding: 8,
            maxRotation: 0
        };
        Chart.defaults.scales.y.ticks = {
            padding: 8
        };

        // Simple shadow plugin for bars & lines
        const shadowPlugin = {
            id: 'procShadow',
            afterDatasetsDraw(chart, args, pluginOptions){
                const { ctx } = chart;
                ctx.save();
                chart.data.datasets.forEach((ds, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (!meta || meta.hidden) return;
                    if (ds.type === 'line' || chart.config.type === 'line') {
                        ctx.shadowColor = (ds.borderColor || '#000') + '55';
                        ctx.shadowBlur = 6;
                        ctx.shadowOffsetY = 3;
                        ctx.lineJoin = 'round';
                        ctx.lineCap = 'round';
                    } else if (chart.config.type === 'bar' || ds.type === 'bar') {
                        ctx.shadowColor = (ds.backgroundColor || '#000') + '55';
                        ctx.shadowBlur = 8;
                        ctx.shadowOffsetY = 4;
                    } else {
                        return;
                    }
                    meta.data.forEach(el => {
                        if (!el || !el.draw) return;
                        ctx.save();
                        el.draw(ctx);
                        ctx.restore();
                    });
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;
                });
                ctx.restore();
            }
        };
        Chart.register(shadowPlugin);
    }

    _debounce(fn, wait){
        let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), wait); };
    }

    _makeAreaGradient(color, canvas){
        try {
            // Use a fixed color with transparency instead of gradient for better stability
            const base = color || '#3b82f6';
            return base + '33'; // Light transparency that works in all cases
        } catch(e){ 
            console.warn('Error creating gradient:', e);
            return color; 
        }
    }

    _shortenLabel(lbl){
        if (!lbl) return lbl;
        const map = { 'Parcelles':'Parc.', 'Processing':'Proc.', 'Distribution':'Distr.', 'Performance':'Perf.' };
        let out = String(lbl);
        Object.entries(map).forEach(([k,v])=>{ out = out.replace(k, v); });
        if (out.length > 24) out = out.slice(0,22) + '…';
        return out;
    }

    // Generic sheet finder with case/spacing/diacritic insensitivity
    _normalizeName(name) {
        return String(name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '')
            .trim();
    }

    findSheet(name, data) {
        if (!data || typeof data !== 'object') return null;
        if (data[name]) return data[name];
        const target = this._normalizeName(name);
        for (const k of Object.keys(data)) {
            if (this._normalizeName(k) === target) {
                return data[k];
            }
        }
        return null;
    }

    /**
     * Create a Chart.js instance with consistent configuration
     * @param {string} id - Canvas element ID
     * @param {Object} config - Chart.js configuration
     * @param {Object} options - Additional options
     * @returns {Chart} Chart instance
     */
    _createChart(id, config, options = {}) {
        // Destroy existing chart if it exists
        this.destroyChart(id);
        
        let canvas = document.getElementById(id);
        if (!canvas) {
            console.warn(`Chart canvas with ID "${id}" not found`);
            return null;
        }
        
        // Safety check: Reset canvas to ensure it's clean
        // This helps avoid "Canvas already in use" errors
        try {
            const parent = canvas.parentNode;
            if (parent) {
                const newCanvas = document.createElement('canvas');
                newCanvas.id = id;
                newCanvas.width = canvas.width;
                newCanvas.height = canvas.height;
                newCanvas.className = canvas.className;
                parent.replaceChild(newCanvas, canvas);
                canvas = newCanvas;
            }
        } catch (e) {
            console.warn(`Error resetting canvas for ${id}:`, e);
        }
            
            // Ensure canvas parent has proper styling
            const container = canvas.parentElement;
            if (container) {
                // Make sure container has position relative for proper sizing
                if (getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
            }
        
        // Apply consistent chart configuration
        const chartConfig = {
            ...config,
            options: {
                ...config.options,
                maintainAspectRatio: false,
                responsive: true,
                resizeDelay: 0,
                onResize: (chart, size) => {
                    // Force chart to update with container dimensions
                    if (chart.canvas && chart.canvas.parentNode) {
                        const parent = chart.canvas.parentNode;
                        setTimeout(() => {
                            chart.resize(parent.clientWidth, parent.clientHeight);
                        }, 0);
                    }
                },
                plugins: {
                    ...(config.options?.plugins || {}),
                    legend: {
                        display: options.showLegend !== false,
                        position: options.legendPosition || 'top',
                        align: 'start',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 6,
                            padding: 20
                        },
                        ...(config.options?.plugins?.legend || {})
                    }
                }
            }
        };
        
        // Handle dynamic gradient colors if present
        if (chartConfig.data && chartConfig.data.datasets) {
            chartConfig.data.datasets.forEach(dataset => {
                if (typeof dataset.backgroundColor === 'function') {
                    const originalFunction = dataset.backgroundColor;
                    dataset.backgroundColor = (context) => {
                        return originalFunction(context.chart.ctx);
                    };
                }
            });
        }
        
        // Create chart
        const chart = new Chart(canvas, chartConfig);
        this.charts.set(id, chart);
        
        return chart;
    }

    // Initialize all charts
    async initializeCharts(rawData, precomputedKPIs = null, fullRawData = null) {
        try {
            // Clean up any existing charts before re-creating them
            // This prevents "Canvas already in use" errors
            if (this.charts.size > 0) {
                const chartIds = Array.from(this.charts.keys());
                chartIds.forEach(id => this.destroyChart(id));
            }
            
            // Persist a reference to the full (non filtré) dataset for time series charts
            if (fullRawData && typeof window !== 'undefined') {
                window.__fullRawData = fullRawData;
            } else if (!window.__fullRawData) {
                window.__fullRawData = rawData;
            }
            
            console.log('Initializing charts with enhanced sizing and responsiveness');
            
            // Setup ResizeObserver for all chart containers
            if (typeof ResizeObserver !== 'undefined' && !this._resizeObserverInitialized) {
                this._resizeObserverInitialized = true;
                const resizeObserver = new ResizeObserver(entries => {
                    for (const entry of entries) {
                        const canvasElements = entry.target.querySelectorAll('canvas');
                        canvasElements.forEach(canvas => {
                            const chartId = canvas.id;
                            if (chartId && this.charts.has(chartId)) {
                                const chart = this.charts.get(chartId);
                                setTimeout(() => {
                                    try {
                                        chart.resize();
                                    } catch (e) {
                                        console.warn(`Error resizing chart ${chartId}:`, e);
                                    }
                                }, 0);
                            }
                        });
                    }
                });
                
                // Observe all chart containers
                document.querySelectorAll('.chart-container').forEach(container => {
                    resizeObserver.observe(container);
                });
            }
            
            // Fast path: render only above-the-fold essential charts first
            if (!this.initializedBasic) {
                try {
                    this.createDailyYieldsChart(fullRawData || rawData);
                } catch (e) {
                    console.warn('Error initializing DailyYields chart:', e);
                }
                
                try {
                    this.createQualityTrendChart(rawData);
                } catch (e) {
                    console.warn('Error initializing QualityTrend chart:', e);
                }
                
                try {
                    this.createGaugeCharts(fullRawData || rawData, precomputedKPIs);
                } catch (e) {
                    console.warn('Error initializing Gauge charts:', e);
                }
                
                this.initializedBasic = true;
                // Defer heavier charts to next frame to avoid long blocking
                requestIdleCallback ? requestIdleCallback(()=> this._initDeferred(rawData, precomputedKPIs, fullRawData)) : setTimeout(()=> this._initDeferred(rawData, precomputedKPIs, fullRawData), 50);
                return true;
            }
            
            // Array of chart creation functions with names for error handling
            const chartMethods = [
                { name: 'Daily Yields', method: () => this.createDailyYieldsChart(fullRawData || rawData) },
                { name: 'Quality Trend', method: () => this.createQualityTrendChart(rawData) },
                { name: 'CTASF Pipeline', method: () => this.createCtasfPipelineChart(rawData) },
                { name: 'Post Processing', method: () => this.createPostProcessingChart(rawData) },
                { name: 'Regional Comparison', method: () => this.createRegionalComparisonChart(rawData) },
                { name: 'Parcel Type Distribution', method: () => this.createParcelTypeDistributionChart(rawData) },
                { name: 'Geomatician Performance', method: () => this.createGeomaticianPerformanceChart(rawData) },
            ];
            
            // Initialize each chart with individual error handling
            for (const chart of chartMethods) {
                try {
                    chart.method();
                } catch(e) {
                    console.warn(`Error initializing ${chart.name} chart:`, e);
                }
            }

            // Additional charts with error handling
            const additionalChartMethods = [
                { name: 'Overview Metrics', method: () => this.createOverviewMetricsChart(rawData) },
                { name: 'Team Productivity', method: () => this.createTeamProductivityChart(rawData) },
                { name: 'Commune Status', method: () => this.createCommuneStatusChart(rawData) },
                { name: 'Projections Multi Metric', method: () => this.createProjectionsMultiMetricChart(rawData) },
                { name: 'Retention Summary', method: () => this.createRetentionDonutChart(rawData) },
                { name: 'Project Timeline', method: () => this.createProjectTimelineChart(rawData) },
                { name: 'Gauge Charts', method: () => this.createGaugeCharts(fullRawData || rawData, precomputedKPIs) }
            ];
            
            // Initialize each additional chart with individual error handling
            for (const chart of additionalChartMethods) {
                try {
                    chart.method();
                } catch(e) {
                    console.warn(`Error initializing ${chart.name} chart:`, e);
                }
            }
            
            console.log('All charts initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing charts:', error);
            // Even with an error, try to render mock data so the dashboard is not empty
            try {
                this._createMockOverviewMetricsChart();
                
                this._createMockTeamProductivityChart();
                this._createMockQualityTrendChart();
                console.log('Fallback mock charts created after error');
            } catch (mockError) {
                console.error('Failed to create mock charts:', mockError);
            }
            return false;
        }
    }

    _initDeferred(rawData, precomputedKPIs, fullRawData){
        try {
            this.createCtasfPipelineChart(rawData);
            this.createPostProcessingChart(rawData);
            this.createRegionalComparisonChart(rawData);
            this.createParcelTypeDistributionChart(rawData);
            this.createGeomaticianPerformanceChart(rawData);
            this.createOverviewMetricsChart(rawData);
            this.createTeamProductivityChart(rawData);
            this.createCommuneStatusChart(rawData);
            this.createProjectionsMultiMetricChart(rawData);
        } catch (e) {
            console.warn('Error initializing deferred charts:', e);
        }
    }
    
    /**
     * Create mock quality trend chart when no data is available
     * @private
     */
    _createMockQualityTrendChart() {
        const days = 14;
        const mockData = {
            labels: Array.from({length: days}, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (days - 1) + i);
                return date.toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'});
            }),
            datasets: [{
                label: 'Taux de qualité',
                data: Array.from({length: days}, () => Math.round(85 + Math.random() * 15)),
                borderColor: CONFIG.COLORS.success,
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: CONFIG.COLORS.success
            }]
        };
        
        return this._createChart('qualityTrendChart', {
            type: 'line',
            data: mockData,
            options: {
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: value => `${value}%`
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: context => `Qualité: ${context.parsed.y}%`
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Create a mock Overview Metrics chart when no data is available
     * @private
     */
    _createMockOverviewMetricsChart() {
        const metrics = [
            'Total Parcels Collected', 
            'Parcels Deliberated', 
            'NICAD Completion Rate'
        ];
        
        const values = [8320, 5600, 65]; // Percentage for the last one
        
        return this._createChart('overviewMetricsChart', {
            type: 'bar',
            data: { 
                labels: metrics, 
                datasets: [{ 
                    label: 'Valeur', 
                    data: values, 
                    backgroundColor: CONFIG.COLORS.primary,
                    borderColor: CONFIG.COLORS.primary + 'CC',
                    borderWidth: 1,
                    borderRadius: 4
                }] 
            },
            options: { 
                ...CHART_CONFIGS.defaultOptions, 
                plugins: { 
                    ...CHART_CONFIGS.defaultOptions.plugins, 
                    title: { 
                        display: true, 
                        text: 'Vue Synthèse',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    subtitle: {
                        display: true,
                        text: 'Indicateurs clés de performance',
                        font: {
                            size: 14,
                            style: 'italic'
                        },
                        padding: {
                            bottom: 10
                        }
                    }
                }, 
                scales: { 
                    x: { 
                        ticks: { 
                            callback: v => this._shortenLabel(metrics[v], 15) 
                        } 
                    }, 
                    y: { 
                        beginAtZero: true 
                    } 
                } 
            }
        });
    }
    
    
    
    /**
     * Create a mock Team Productivity chart when no data is available
     * @private
     */
    _createMockTeamProductivityChart() {
        const teams = [
            'Équipe A', 
            'Équipe B',
            'Équipe C', 
            'Équipe D',
            'Équipe E'
        ];
        
        const productivity = [35.2, 28.7, 24.5, 22.1, 18.3];
        
        return this._createChart('teamProductivityChart', {
            type: 'bar',
            data: { 
                labels: teams, 
                datasets: [{ 
                    label: 'Champs / Équipe / Jour', 
                    data: productivity, 
                    backgroundColor: CONFIG.COLORS.secondary,
                    borderColor: CONFIG.COLORS.secondary + 'CC',
                    borderWidth: 1,
                    borderRadius: 4
                }] 
            },
            options: { 
                ...CHART_CONFIGS.defaultOptions, 
                plugins: { 
                    ...CHART_CONFIGS.defaultOptions.plugins, 
                    title: { 
                        display: true, 
                        text: 'Productivité Équipe',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    subtitle: {
                        display: true,
                        text: 'Champs traités par jour et par équipe',
                        font: {
                            size: 14,
                            style: 'italic'
                        },
                        padding: {
                            bottom: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: (context) => {
                                // Mock data for tooltips
                                const totalParcels = [1760, 1435, 1225, 1105, 915];
                                const days = [50, 50, 50, 50, 50];
                                return [
                                    `Total: ${totalParcels[context.dataIndex]} parcelles`,
                                    `Sur ${days[context.dataIndex]} jour(s)`
                                ];
                            }
                        }
                    }
                }, 
                scales: { 
                    x: { 
                        ticks: { 
                            callback: v => this._shortenLabel(teams[v], 15) 
                        } 
                    }, 
                    y: { 
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Parcelles/jour'
                        }
                    } 
                } 
            }
        });
    }

    _initDeferred(rawData, precomputedKPIs, fullRawData){
        console.log('Initializing deferred charts...');
        const chartMethods = [
            { name: 'CTASF Pipeline', method: () => this.createCtasfPipelineChart(rawData) },
            { name: 'Post Processing', method: () => this.createPostProcessingChart(rawData) },
            { name: 'Regional Comparison', method: () => this.createRegionalComparisonChart(rawData) },
            { name: 'Parcel Type Distribution', method: () => this.createParcelTypeDistributionChart(rawData) },
            { name: 'Geomatician Performance', method: () => this.createGeomaticianPerformanceChart(rawData) },
            
            { name: 'Overview Metrics', method: () => this.createOverviewMetricsChart(rawData) },
            { name: 'Team Productivity', method: () => this.createTeamProductivityChart(rawData) },
            { name: 'Commune Status', method: () => this.createCommuneStatusChart(rawData) },
            { name: 'Projections Multi Metric', method: () => this.createProjectionsMultiMetricChart(rawData) },
            { name: 'Retention Summary', method: () => this.createRetentionDonutChart(rawData) },
            { name: 'Project Timeline', method: () => this.createProjectTimelineChart(rawData) }
        ];
        
        // Initialize each chart with individual error handling
        let successCount = 0;
        for (const chart of chartMethods) {
            try {
                chart.method();
                successCount++;
            } catch(e) {
                console.warn(`Error initializing ${chart.name} chart:`, e);
            }
        }
        
        console.log(`Deferred charts initialized: ${successCount}/${chartMethods.length} successful`);
    }

    // Overview Metrics (Sheet: Overview Metrics) - simple bar
    createOverviewMetricsChart(rawData) {
        const ctx = document.getElementById('overviewMetricsChart');
        if (!ctx) return;
        const sheet = this.findSheet('Overview Metrics', rawData) || [];
        if (!sheet.length) {
            console.log('No overview metrics data available, using mock data');
            // Create mock data
            return this._createMockOverviewMetricsChart();
        }
        
        // Based on gid=589154853: 0:Metric, 1:Value
        const labels = sheet.map(r => {
            return this._getField(r, 0) || r.Metric || r.metric || r['Métrique'] || r['Libellé'] || '';
        });
        
        const values = sheet.map(r => {
            return this._parseNumeric(this._getField(r, 1)) || 
                   this._getNumericField(r, ['Value','Valeur','Valeurs','value','valeur','valeurs','Nombre','Total','total']) || 0;
        });

        // If all zeros, log a diagnostic hint
        if (values.every(v => v === 0)) {
            console.warn('[ChartService] Overview Metrics values all zero – verify header names (expected one of Value/Valeur).');
        }

        this.destroyChart('overviewMetricsChart');
        this.charts.set('overviewMetricsChart', new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Valeur', data: values, backgroundColor: CONFIG.COLORS.primary }] },
            options: { ...CHART_CONFIGS.defaultOptions, plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Overview Metrics' } }, scales: { x: { ticks: { callback: v => this._shortenLabel(labels[v]) } }, y: { beginAtZero: true } } }
        }));
    }

    // (Removed) Phases de Traitement chart and replacement

    // Team Productivity - updated to use both Yields and Post Process data
    createTeamProductivityChart(rawData) {
        const ctx = document.getElementById('teamProductivityChart');
        if (!ctx) return;
        
        // Try to use the dedicated Team Productivity sheet
        const teamSheet = this.findSheet('Team Productivity', rawData) || [];
        
        // If we have direct team productivity data, use it
        if (teamSheet.length > 0) {
            // Based on gid=1397416280 (Team): 0:Team, 1:Champs/Equipe/Jour
            const labels = teamSheet.map(r => {
                return this._getField(r, 0) || r.Team || r.team || '';
            });
            
            const values = teamSheet.map(r => {
                return this._parseNumeric(this._getField(r, 1)) || 
                       Number(r['Champs/Equipe/Jour'] || r.champs || r.value || 0);
            });

            // Create chart with direct team data
            this.destroyChart('teamProductivityChart');
            return this._createChart('teamProductivityChart', {
                type: 'bar',
                data: { 
                    labels, 
                    datasets: [{ 
                        label: 'Champs / Équipe / Jour', 
                        data: values, 
                        backgroundColor: CONFIG.COLORS.secondary 
                    }] 
                },
                options: { 
                    ...CHART_CONFIGS.defaultOptions, 
                    plugins: { 
                        ...CHART_CONFIGS.defaultOptions.plugins, 
                        title: { 
                            display: true, 
                            text: 'Productivité Équipe' 
                        } 
                    }, 
                    scales: { 
                        x: { 
                            ticks: { 
                                callback: v => this._shortenLabel(labels[v]) 
                            } 
                        }, 
                        y: { 
                            beginAtZero: true 
                        } 
                    } 
                }
            });
        }
        
        // Fallback: Calculate productivity from yields and post-process sheets
        const yieldsData = this.findSheet('Yields Projections', rawData) || [];
        const postProcessData = this.findSheet('Post Process Follow-up', rawData) || [];
        
        if (!yieldsData.length && !postProcessData.length) {
            console.log('No team productivity data available, using mock data');
            // Create mock data
            return this._createMockTeamProductivityChart();
        }
        
        // Process yields data - group by team (Geomatician) and count parcels per day
        // Based on gid=1397416280 (Yields): 0:Date, 1:Région, 2:Commune, 3:Nombre de levées
        const teamProductivity = {};
        
        // First, process yields data
        yieldsData.forEach(r => {
            // Skip if no valid date or no geomatician
            const date = this._getField(r, 0) || r.Date || r.date || '';
            if (!date) return;
            
            const parcels = this._parseNumeric(this._getField(r, 3)) || 
                           this._getNumericField(r, ['Nombre de levées', 'Nombre de levees', 'levées', 'levees']) || 0;
            
            // In yields data, use the commune as the team identifier if geomatician is not present
            const team = this._getField(r, 2) || r.Commune || r.commune || 'Unknown';
            if (!team) return;
            
            // Initialize team data if not exists
            if (!teamProductivity[team]) {
                teamProductivity[team] = {
                    totalParcels: 0,
                    days: new Set(),
                    activeDays: 0,
                    productivity: 0
                };
            }
            
            // Add parcels to team total
            teamProductivity[team].totalParcels += parcels;
            teamProductivity[team].days.add(date);
        });
        
        // Next, process post-process data (with one day adjustment)
        // Based on gid=202408760: 0:Date, 1:Geomaticien, 2:Région, 3:Commune, 4:Parcelles reçues (Brutes)
        postProcessData.forEach(r => {
            // Skip if no valid date or no geomatician
            const date = this._getField(r, 0) || r.Date || r.date || '';
            if (!date) return;
            
            // Adjust for one-day lag: post-process entries reflect the previous day's work
            const adjustedDate = this._adjustDateByDays(date, -1);
            
            const parcels = this._parseNumeric(this._getField(r, 4)) || 
                           this._getNumericField(r, ['Parcelles reçues (Brutes)', 'Parcelles recues', 'parcelles']) || 0;
            
            // Use geomatician as team identifier
            const team = this._getField(r, 1) || r.Geomaticien || r.geomaticien || 
                        this._getField(r, 3) || r.Commune || r.commune || 'Unknown';
            if (!team) return;
            
            // Initialize team data if not exists
            if (!teamProductivity[team]) {
                teamProductivity[team] = {
                    totalParcels: 0,
                    days: new Set(),
                    activeDays: 0,
                    productivity: 0
                };
            }
            
            // Add parcels to team total
            teamProductivity[team].totalParcels += parcels;
            teamProductivity[team].days.add(adjustedDate);
        });
        
        // Calculate productivity (parcels per day) for each team
        Object.keys(teamProductivity).forEach(team => {
            const teamData = teamProductivity[team];
            teamData.activeDays = teamData.days.size;
            teamData.productivity = teamData.activeDays > 0 ? 
                teamData.totalParcels / teamData.activeDays : 0;
        });
        
        // Sort teams by productivity (descending)
        const sortedTeams = Object.keys(teamProductivity).sort((a, b) => {
            return teamProductivity[b].productivity - teamProductivity[a].productivity;
        });
        
        // Filter out teams with zero productivity
        const teamsWithActivity = sortedTeams.filter(team => teamProductivity[team].productivity > 0);
        
        // Prepare chart data
        const labels = teamsWithActivity;
        const values = teamsWithActivity.map(team => {
            // Round to 1 decimal place for cleaner display
            return Math.round(teamProductivity[team].productivity * 10) / 10;
        });
        
        // Create chart
        this.destroyChart('teamProductivityChart');
        return this._createChart('teamProductivityChart', {
            type: 'bar',
            data: { 
                labels, 
                datasets: [{ 
                    label: 'Champs / Équipe / Jour', 
                    data: values, 
                    backgroundColor: CONFIG.COLORS.secondary 
                }] 
            },
            options: { 
                ...CHART_CONFIGS.defaultOptions, 
                plugins: { 
                    ...CHART_CONFIGS.defaultOptions.plugins, 
                    title: { 
                        display: true, 
                        text: 'Productivité Équipe' 
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: (context) => {
                                const team = teamsWithActivity[context.dataIndex];
                                const teamData = teamProductivity[team];
                                return [
                                    `Total: ${teamData.totalParcels} parcelles`,
                                    `Sur ${teamData.activeDays} jour(s)`
                                ];
                            }
                        }
                    }
                }, 
                scales: { 
                    x: { 
                        ticks: { 
                            callback: v => this._shortenLabel(labels[v]) 
                        } 
                    }, 
                    y: { 
                        beginAtZero: true 
                    } 
                } 
            }
        });
    }

    // Commune Status (Sheet: Commune Analysis)
    createCommuneStatusChart(rawData) {
        const ctx = document.getElementById('communeStatusChart');
        if (!ctx) return;
        const sheet = this.findSheet('Commune Analysis', rawData) || [];
        if (!sheet.length) return;

    const communes = sheet.map(r => r.Commune || r.commune || '');
        const statusMap = (name) => {
            const n = String(name || '').trim().toLowerCase();
            const inList = (arr) => arr.some(c => String(c).trim().toLowerCase() === n);
            if (CONFIG.COMMUNE_STATUS?.finished && inList(CONFIG.COMMUNE_STATUS.finished)) return 'Terminé';
            if (CONFIG.COMMUNE_STATUS?.inProgress && inList(CONFIG.COMMUNE_STATUS.inProgress)) return 'En cours';
            if (CONFIG.COMMUNE_STATUS?.active && inList(CONFIG.COMMUNE_STATUS.active)) return 'Actif';
            return '—';
        };
        const communeStatuses = communes.map(statusMap);
        const metrics = [
            { key: ['NICAD','nicad'], label: 'NICAD', color: CONFIG.COLORS.success },
            { key: ['CTASF','ctasf'], label: 'CTASF', color: CONFIG.COLORS.warning },
            { key: ['Deliberated','Délibérées','deliberated'], label: 'Délibérées', color: CONFIG.COLORS.info }
        ];
        const datasets = metrics.map(m => ({
            label: m.label,
            data: sheet.map(row => {
                // Attempt each candidate
                for (const cand of m.key) {
                    if (row[cand] !== undefined) return Number(row[cand]) || 0;
                }
                return 0;
            }),
            backgroundColor: m.color
        }));

        this.destroyChart('communeStatusChart');
        this.charts.set('communeStatusChart', new Chart(ctx, {
            type: 'bar',
            data: { labels: communes, datasets },
            options: { 
                ...CHART_CONFIGS.defaultOptions, 
                plugins: { 
                    ...CHART_CONFIGS.defaultOptions.plugins, 
                    title: { display: true, text: 'Statut par Commune' },
                    tooltip: {
                        callbacks: {
                            afterTitle: (items) => {
                                if (!items || !items.length) return '';
                                const idx = items[0].dataIndex;
                                const s = communeStatuses[idx];
                                return s && s !== '—' ? `Statut: ${s}` : '';
                            }
                        }
                    }
                }, 
                responsive: true, 
                interaction: { mode: 'index', intersect: false }, 
                scales: { 
                    x: { stacked: false, ticks: { callback: (v, idx, ticks) => {
                        const chart = this.charts.get('communeStatusChart');
                        const labels = chart?.data?.labels || communes;
                        return this._shortenLabel(labels[v] ?? labels[idx] ?? '');
                    } } }, 
                    y: { beginAtZero: true } 
                }
            }
        }));

        // Color bars on first dataset by status (visual cue). Others keep defaults.
        try {
            const chart = this.charts.get('communeStatusChart');
            if (chart && chart.data && chart.data.datasets && chart.data.datasets[0]) {
                const baseColors = {
                    'Actif': CONFIG.COLORS.info,
                    'En cours': CONFIG.COLORS.warning,
                    'Terminé': CONFIG.COLORS.success,
                    '—': CONFIG.COLORS.primary
                };
                // Persist original data for filtering
                chart.__allData = {
                    communes: [...communes],
                    statuses: [...communeStatuses],
                    datasetsRaw: chart.data.datasets.map(ds => Array.isArray(ds.data) ? [...ds.data] : []),
                    baseColors
                };
                chart.data.datasets[0].backgroundColor = communeStatuses.map(s => baseColors[s] || CONFIG.COLORS.primary);
                chart.update('none');
            }
        } catch(_) { /* no-op */ }

        // Attach filter buttons once and apply current selection
        this._attachCommuneStatusFilterControls();
        const activeBtn = document.querySelector('.chart-controls .chart-filter.active');
        const filterKey = activeBtn?.dataset?.filter || 'all';
        this.applyCommuneStatusFilter(filterKey);
    }

    /**
     * Apply filter to the Commune Status chart based on UI selection
     * @param {'all'|'active'|'completed'} filterKey
     */
    applyCommuneStatusFilter(filterKey = 'all') {
        try {
            const chart = this.charts.get('communeStatusChart');
            if (!chart || !chart.__allData) return;
            const { communes, statuses, datasetsRaw, baseColors } = chart.__allData;
            // Build index mask
            const keepIdx = communes.map((_, i) => {
                if (filterKey === 'active') return statuses[i] === 'Actif';
                if (filterKey === 'completed') return statuses[i] === 'Terminé';
                return true; // all
            });
            // Filter labels
            const newLabels = communes.filter((_, i) => keepIdx[i]);
            chart.data.labels = newLabels;
            // Filter each dataset's data
            chart.data.datasets.forEach((ds, di) => {
                const raw = datasetsRaw[di] || [];
                ds.data = raw.filter((_, i) => keepIdx[i]);
            });
            // Recolor first dataset bars based on status of filtered set
            if (chart.data.datasets[0]) {
                const filteredStatuses = statuses.filter((_, i) => keepIdx[i]);
                chart.data.datasets[0].backgroundColor = filteredStatuses.map(s => baseColors[s] || CONFIG.COLORS.primary);
            }
            chart.update('none');
        } catch(_) { /* no-op */ }
    }

    /**
     * Attach click handlers to the Actif/Terminé buttons (once)
     */
    _attachCommuneStatusFilterControls() {
        if (this._communeStatusFilterBound) return;
        const controls = document.querySelectorAll('.chart-controls .chart-filter');
        if (!controls || controls.length === 0) return;
        controls.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Toggle active class within group
                const parent = btn.parentElement;
                if (parent) {
                    parent.querySelectorAll('.chart-filter').forEach(b => b.classList.remove('active'));
                }
                btn.classList.add('active');
                const key = btn.dataset.filter || 'all';
                this.applyCommuneStatusFilter(key);
            });
        });
        this._communeStatusFilterBound = true;
    }

    // Projections Multi-Metric (Sheets: NICAD Projection, Public Display, CTASF Projection)
    createProjectionsMultiMetricChart(rawData) {
        const ctx = document.getElementById('projectionsMultiMetricChart');
        if (!ctx) return;
        // Resolve sheets with flexible names
        const nicad = this.findSheet('NICAD Projection', rawData) 
                    || this.findSheet('NICAD Projections', rawData)
                    || this.findSheet('NICAD', rawData)
                    || this.findSheet('Collection Projections', rawData)
                    || [];
        const publicDisplay = this.findSheet('Public Display Projection', rawData)
                           || this.findSheet('Public Display Projections', rawData)
                           || this.findSheet('Display Projections', rawData)
                           || [];
        const ctasf = this.findSheet('CTASF Projection', rawData)
                     || this.findSheet('CTASF Projections', rawData)
                     || [];
        if (!nicad.length && !publicDisplay.length && !ctasf.length) return;

        // Preferred month columns and fallback detection
        const preferredMonths = ['Sept 2025','Oct 2025','Nov 2025','Dec 2025'];
        const monthRegex = /(jan|feb|mar|apr|may|mai|jun|jul|aug|sep|sept|oct|nov|dec|déc)\s*20\d{2}/i;
        const collectSample = nicad[0] || publicDisplay[0] || ctasf[0] || {};
        let monthCols = preferredMonths.filter(col => Object.prototype.hasOwnProperty.call(collectSample, col));
        if (!monthCols.length) {
            monthCols = Object.keys(collectSample).filter(k => monthRegex.test(k));
        }
        if (!monthCols.length) return; // nothing to chart

        const datasets = [];
        const toNumber = (v) => {
            const n = Number(String(v ?? '').replace(/\s+/g,'').replace(/,/g,'.'));
            return Number.isNaN(n) ? 0 : n;
        };
        const addSheet = (sheet, label, color) => {
            if (!sheet.length) return;
            // Assume each row is one metric; sum metrics per column
            const sums = monthCols.map(col => sheet.reduce((s,r)=> s + toNumber(r[col]), 0));
            datasets.push({ label, data: sums, borderColor: color, backgroundColor: color + '40', tension: 0.3, fill: false });
        };
        addSheet(nicad, 'NICAD', CONFIG.COLORS.primary);
        addSheet(publicDisplay, 'Public Display', CONFIG.COLORS.success);
        addSheet(ctasf, 'CTASF', CONFIG.COLORS.warning);

        this.destroyChart('projectionsMultiMetricChart');
        this.charts.set('projectionsMultiMetricChart', new Chart(ctx, {
            type: 'line',
            data: { labels: monthCols, datasets },
            options: { ...CHART_CONFIGS.defaultOptions, plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Projections Multi-Métriques (NICAD / Public Display / CTASF)' } }, scales: { y: { beginAtZero: true } } }
        }));
    }

    // Project Timeline (Gantt-style) using horizontal bar with start-end durations
    createProjectTimelineChart(rawData) {
        const ctx = document.getElementById('projectTimelineChart');
        if (!ctx) return;
        const sheet = this.findSheet('Project Timeline', rawData) || [];
        if (!sheet.length) return;
        // Expect columns: Order, Start Date, End Date OR similar
        const parse = (v) => {
            if (!v && v !== 0) return null;
            try { if (window.UTILS && typeof UTILS.parseDateDMY === 'function') return UTILS.parseDateDMY(v); } catch(_) {}
            const d = new Date(v); return isNaN(d.getTime()) ? null : d;
        };
        const tasks = sheet.map(r => ({
            label: r.Order || r.order || r.Task || 'Item',
            start: parse(r['Start Date'] || r.Start || r['Start'] || r['Début']),
            end: parse(r['End Date'] || r.End || r['Fin'] || r['End'])
        })).filter(t => t.start && t.end && t.end >= t.start);
        if (!tasks.length) return;
        // Convert to day offsets
        const minStart = tasks.reduce((m,t)=> t.start < m ? t.start : m, tasks[0].start);
        const labels = tasks.map(t => t.label);
        const durations = tasks.map(t => (t.end - t.start)/(1000*60*60*24) + 1);
        const offsets = tasks.map(t => (t.start - minStart)/(1000*60*60*24));
        // Build stacked dataset: invisible offset + duration
        const offsetData = offsets.map(v => v);
        const durationData = durations.map(v => v);

        this.destroyChart('projectTimelineChart');
        this.charts.set('projectTimelineChart', new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Offset', data: offsetData, backgroundColor: 'transparent', stack: 'gantt', borderWidth: 0, hoverBackgroundColor: 'transparent' },
                    { label: 'Durée (jours)', data: durationData, backgroundColor: CONFIG.COLORS.accent, stack: 'gantt' }
                ]
            },
            options: { ...CHART_CONFIGS.defaultOptions, indexAxis: 'y', plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Project Timeline' }, tooltip: { callbacks: { label: (ctx)=> { const task = tasks[ctx.dataIndex]; return `${task.label}: ${task.start.toISOString().split('T')[0]} → ${task.end.toISOString().split('T')[0]}`; } } } }, scales: { x: { stacked: true, title: { display: true, text: 'Jours (depuis début projet)' } }, y: { stacked: true } } }
        }));
    }

    // Create daily yields time series chart
    createDailyYieldsChart(rawData) {
        // Early return if canvas doesn't exist
        if (!document.getElementById('dailyYieldsChart')) return;
        
        // Build from provided dataset; if too court, fallback to full stored dataset
        const build = (dataset) => dataService.getTimeSeriesData(
            dataset,
            'Yields Projections',
            'Date',
            'Nombre de levées'
        );
        
        let timeSeriesData = build(rawData);
        if (timeSeriesData.length < 5 && window.__fullRawData) {
            const expanded = build(window.__fullRawData);
            if (expanded.length > timeSeriesData.length) {
                timeSeriesData = expanded;
            }
        }
        
        if (!timeSeriesData.length) {
            console.log('No data available for daily yields chart, using mock data');
            // Create mock data for better visualization
            timeSeriesData = Array.from({length: 14}, (_, i) => ({
                date: new Date(Date.now() - (13-i) * 86400000).toISOString().split('T')[0],
                value: Math.round(500 + Math.random() * 400)
            }));
        }

        const chartData = {
            // For time scale, supply {x: ISO, y: value} points; no string labels
            datasets: [{
                label: 'Levées quotidiennes',
                data: timeSeriesData.map(d => ({ x: d.date, y: d.value })),
                borderColor: CONFIG.COLORS.primary,
                backgroundColor: CONFIG.COLORS.primary + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }, {
                label: 'Objectif (832,77)',
                data: timeSeriesData.map(d => ({ x: d.date, y: CONFIG.TARGETS.DAILY_PARCELS })),
                borderColor: CONFIG.COLORS.danger,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            ...CHART_CONFIGS.timeSeriesOptions,
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Évolution Quotidienne des Levées vs Objectif'
                }
            }
        };

        this.destroyChart('dailyYieldsChart');
    // Gradient for area
    chartData.datasets[0].backgroundColor = this._makeAreaGradient(CONFIG.COLORS.primary, document.getElementById('dailyYieldsChart'));
    
    // Use our enhanced chart creation helper
    this._createChart('dailyYieldsChart', {
        type: 'line',
        data: chartData,
        options: options
    }, { showLegend: false });
    }

    // Create quality trend chart
    createQualityTrendChart(rawData) {
        const ctx = document.getElementById('qualityTrendChart');
        if (!ctx) return;
        
        const qualityData = this.findSheet('Public Display Follow-up', rawData);
        if (!qualityData || !qualityData.length) {
            console.log('No quality data available, using mock data');
            // Create mock quality data
            return this._createMockQualityTrendChart();
        }
    // Normalize dates to ISO keys using DMY parser then aggregate
    const groupedByDate = new Map();
    const timeSeriesData = [];
    qualityData.forEach(row => {
        // Prioritize dataAggregationService.parseDate for consistent date parsing
        let d;
        if (window.dataAggregationService && typeof window.dataAggregationService.parseDate === 'function') {
            d = window.dataAggregationService.parseDate(row['Date']);
        }
        // Fall back to other methods if needed
        if (!d) {
            d = (window.UTILS && UTILS.parseDateDMY) ? UTILS.parseDateDMY(row['Date']) : new Date(row['Date']);
        }
        if (!d || isNaN(d)) return;
        const key = d.toISOString().split('T')[0];
        if (!groupedByDate.has(key)) groupedByDate.set(key, []);
        groupedByDate.get(key).push(row);
    });

    Array.from(groupedByDate.entries()).forEach(([iso, dayData]) => {
            const sansErreur = dayData.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre de parcelles affichées sans erreurs','parcelles affichées sans erreurs']), 0);
            const avecErreur = dayData.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre Parcelles avec erreur','parcelles avec erreur']), 0);
            const total = sansErreur + avecErreur;
            const qualityRate = total > 0 ? Math.round(sansErreur / total * 100) : 0;
            
            timeSeriesData.push({
        date: iso,
                sansErreur,
                avecErreur,
                total,
                qualityRate
            });
        });

    timeSeriesData.sort((a, b) => a.date.localeCompare(b.date));

        const chartData = {
            // Supply time series as points with ISO x values; formatting handled by Chart.js options
            datasets: [{
                label: 'Taux de qualité (%)',
                data: timeSeriesData.map(d => ({ x: d.date, y: d.qualityRate })),
                borderColor: CONFIG.COLORS.success,
                backgroundColor: CONFIG.COLORS.success + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                yAxisID: 'y'
            }, {
                label: 'Total parcelles',
                data: timeSeriesData.map(d => ({ x: d.date, y: d.total })),
                type: 'bar',
                backgroundColor: CONFIG.COLORS.info + '40',
                borderColor: CONFIG.COLORS.info,
                borderWidth: 1,
                yAxisID: 'y1'
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            scales: {
                x: {
                    title: { display: true, text: 'Date' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Taux de qualité (%)' },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Nombre total' },
                    grid: { drawOnChartArea: false }
                }
            }
        };

        this.destroyChart('qualityTrendChart');
        // Apply gradient to quality line fill
        chartData.datasets[0].backgroundColor = this._makeAreaGradient(CONFIG.COLORS.success, ctx);
        
        // Create the chart properly
        return this._createChart('qualityTrendChart', {
            type: 'line',
            data: chartData,
            options: options
        });
    }

    // Create CTASF pipeline chart
    createCtasfPipelineChart(rawData) {
        const ctx = document.getElementById('ctasfPipelineChart');
        if (!ctx) return;
    const ctasfData = this.findSheet('CTASF Follow-up', rawData);
        if (!ctasfData) return;

        const timeSeriesData = dataService.getTimeSeriesData(
            { 'CTASF Follow-up': ctasfData },
            'CTASF Follow-up',
            'Date',
            ['Nombre parcelles emmenées au CTASF', 'Nombre parcelles retenues CTASF', 'Nombre parcelles délibérées']
        );

        const chartData = {
            labels: timeSeriesData.map(d => d.date),
            datasets: [{
                label: 'Emmenées au CTASF',
                data: timeSeriesData.map(d => d['Nombre parcelles emmenées au CTASF'] || 0),
                borderColor: CONFIG.COLORS.primary,
                backgroundColor: CONFIG.COLORS.primary + '20',
                borderWidth: 2,
                fill: false
            }, {
                label: 'Retenues CTASF',
                data: timeSeriesData.map(d => d['Nombre parcelles retenues CTASF'] || 0),
                borderColor: CONFIG.COLORS.warning,
                backgroundColor: CONFIG.COLORS.warning + '20',
                borderWidth: 2,
                fill: false
            }, {
                label: 'Délibérées',
                data: timeSeriesData.map(d => d['Nombre parcelles délibérées'] || 0),
                borderColor: CONFIG.COLORS.success,
                backgroundColor: CONFIG.COLORS.success + '20',
                borderWidth: 2,
                fill: false
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            ...CHART_CONFIGS.timeSeriesOptions,
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Pipeline CTASF - Évolution Multi-étapes'
                }
            }
        };

        this.destroyChart('ctasfPipelineChart');
        this.charts.set('ctasfPipelineChart', new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: options
        }));
    }

    // Create post-processing chart
    createPostProcessingChart(rawData) {
        const ctx = document.getElementById('postProcessingChart');
        if (!ctx) return;
    const postProcessData = this.findSheet('Post Process Follow-up', rawData);
        if (!postProcessData) return;

        const timeSeriesData = dataService.getTimeSeriesData(
            { 'Post Process Follow-up': postProcessData },
            'Post Process Follow-up',
            'Date',
            ['Parcelles reçues (Brutes)', 'Parcelles post traitées (Sans Doublons et topoplogie correcte)']
        );

        const chartData = {
            labels: timeSeriesData.map(d => d.date),
            datasets: [{
                label: 'Parcelles reçues (Brutes)',
                data: timeSeriesData.map(d => d['Parcelles reçues (Brutes)'] || 0),
                borderColor: CONFIG.COLORS.info,
                backgroundColor: CONFIG.COLORS.info + '20',
                borderWidth: 2,
                fill: true
            }, {
                label: 'Parcelles post traitées',
                data: timeSeriesData.map(d => d['Parcelles post traitées (Sans Doublons et topoplogie correcte)'] || 0),
                borderColor: CONFIG.COLORS.success,
                backgroundColor: CONFIG.COLORS.success + '20',
                borderWidth: 2,
                fill: true
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            ...CHART_CONFIGS.timeSeriesOptions,
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Efficacité Post-Processing'
                }
            }
        };

        // Use our standard chart creation method
        return this._createChart('postProcessingChart', {
            type: 'line',
            data: chartData,
            options: options
        });
    }

    // Create regional comparison chart
    createRegionalComparisonChart(rawData) {
        const ctx = document.getElementById('regionalComparisonChart');
        if (!ctx) return;

        // Get regional data using case-insensitive lookup
        const yieldsData = this.findSheet('Yields Projections', rawData) || [];
        const displayData = this.findSheet('Public Display Follow-up', rawData) || [];
        const ctasfData = this.findSheet('CTASF Follow-up', rawData) || [];

        // Process by region
        const regions = CONFIG.REGIONS;
        const metrics = [];

        regions.forEach(region => {
            // Yields
            const regionYields = yieldsData.filter(d => d['R\u00e9gion'] === region);
            const totalYields = regionYields.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre de lev\u00e9es','nombre de levees']), 0);

            // Quality
            const regionDisplay = displayData.filter(d => d['R\u00e9gion'] === region);
            const sansErreur = regionDisplay.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre de parcelles affich\u00e9es sans erreurs','parcelles affich\u00e9es sans erreurs']), 0);
            const avecErreur = regionDisplay.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre Parcelles avec erreur','parcelles avec erreur']), 0);
            const qualityRate = sansErreur + avecErreur > 0 ? Math.round(sansErreur / (sansErreur + avecErreur) * 100) : 0;

            // CTASF
            const regionCtasf = ctasfData.filter(d => d['R\u00e9gion'] === region);
            const ctasfEmmen = regionCtasf.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre parcelles emmen\u00e9es au CTASF','parcelles emmen\u00e9es']), 0);
            const ctasfReten = regionCtasf.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre parcelles retenues CTASF','parcelles retenues']), 0);
            const ctasfRate = ctasfEmmen > 0 ? Math.round(ctasfReten / ctasfEmmen * 100) : 0;

            metrics.push({
                region,
                yields: totalYields,
                quality: qualityRate,
                ctasf: ctasfRate
            });
        });

        const chartData = {
            labels: metrics.map(m => m.region),
            datasets: [{
                label: 'Parcelles collectées',
                data: metrics.map(m => m.yields),
                backgroundColor: CONFIG.COLORS.primary,
                barPercentage: 0.4,
                categoryPercentage: 0.7
            }, {
                label: 'Taux de qualité (%)',
                data: metrics.map(m => m.quality),
                backgroundColor: CONFIG.COLORS.success,
                barPercentage: 0.4,
                categoryPercentage: 0.7
            }, {
                label: 'Taux CTASF (%)',
                data: metrics.map(m => m.ctasf),
                backgroundColor: CONFIG.COLORS.warning,
                barPercentage: 0.4,
                categoryPercentage: 0.7
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Comparaison Performance Régionale'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Région' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Valeur' }
                }
            }
        };

        this.destroyChart('regionalComparisonChart');
        this.charts.set('regionalComparisonChart', new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: options
        }));
    }

    // Create parcel type distribution chart
    createParcelTypeDistributionChart(rawData) {
        const ctx = document.getElementById('parcelTypeDistributionChart');
        if (!ctx) return;
        // Combine processing1 and processing2 data using case-insensitive lookup
        const processing1 = this.findSheet('Processing Phase 1', rawData) || [];
        const processing2 = this.findSheet('Processing Phase 2', rawData) || [];
        
        // Group by parcel type
        const parcelTypes = new Map();
        
        // Process data from both sheets
        [...processing1, ...processing2].forEach(row => {
            const type = row['Parcel Type'] || row['ParcelType'] || row['parcel type'] || row['Type'] || 'Unknown';
            const total = this._getNumericField(row, ['Total','total']);
            
            if (type && total) {
                const current = parcelTypes.get(type) || 0;
                parcelTypes.set(type, current + total);
            }
        });
        
        // Prepare chart data
        const types = Array.from(parcelTypes.keys());
        const values = Array.from(parcelTypes.values());
        
        // Generate color array
        const colors = [
            CONFIG.COLORS.primary,
            CONFIG.COLORS.secondary,
            CONFIG.COLORS.accent,
            CONFIG.COLORS.success,
            CONFIG.COLORS.warning,
            CONFIG.COLORS.danger,
            CONFIG.COLORS.info
        ];
        
        const chartData = {
            labels: types,
            datasets: [{
                data: values,
                backgroundColor: types.map((_, i) => colors[i % colors.length]),
                borderWidth: 1
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Répartition Types de Parcelles'
                }
            },
            cutout: '40%'
        };

        this.destroyChart('parcelTypeDistributionChart');
        this.charts.set('parcelTypeDistributionChart', new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: options
        }));
    }

    // Helper: compute retention metrics from Commune Status/Analysis
    _computeRetentionMetrics(rawData) {
        const communeStatus = this.findSheet('Commune Status', rawData) || this.findSheet('Commune Analysis', rawData) || [];
        const collectedHeader = 'Parcelles collectées (sans doublon géométrique)';
        const retainedHeader = 'Parcelles retenues après post-traitement';
        const rejectedHeaderCurly = 'Parcelles rejetées par l’URM';
        const rejectedHeaderStraight = "Parcelles rejetées par l'URM";

        const collected = communeStatus.reduce((sum, r) => sum + this._getNumericField(r, [collectedHeader]), 0);
        const retained = communeStatus.reduce((s, r) => s + this._getNumericField(r, [retainedHeader]), 0);
        const rejected = communeStatus.reduce((s, r) => s + this._getNumericField(r, [rejectedHeaderCurly, rejectedHeaderStraight]), 0);

        const coll = Math.max(0, collected);
        const ret = Math.max(0, retained);
        const rej = Math.max(0, rejected);
        const processed = ret + rej;
        const remainder = Math.max(0, coll - processed);

        const tauxRetentionVsCollected = Math.round((ret / (coll || 1)) * 100);
        const tauxRejetVsCollected = Math.round((rej / (coll || 1)) * 100);
        const tauxRetentionVsProcessed = Math.round((ret / (processed || 1)) * 100);
        const tauxRejetVsProcessed = Math.round((rej / (processed || 1)) * 100);

        return { coll, ret, rej, processed, remainder, tauxRetentionVsCollected, tauxRejetVsCollected, tauxRetentionVsProcessed, tauxRejetVsProcessed };
    }

    // Retention summary chart (non-bar) for collected vs retained vs rejected
    createRetentionDonutChart(rawData) {
        const ctx = document.getElementById('retentionDonutChart');
        if (!ctx) return;
        const { coll, ret, rej, processed, remainder, tauxRetentionVsCollected, tauxRejetVsCollected, tauxRetentionVsProcessed, tauxRejetVsProcessed } = this._computeRetentionMetrics(rawData);

        // Outer ring: collected remainder vs processed
        const innerLabels = ['Retenues', 'Rejetées URM'];
        const outerLabels = ['Reste (non traité)', 'Traité'];
        const chartData = {
            labels: [],
            datasets: [
                {
                    // Inner ring: retained vs rejected among processed
                    data: [ret, rej],
                    backgroundColor: [CONFIG.COLORS.success, CONFIG.COLORS.danger],
                    borderWidth: 1
                },
                {
                    // Outer ring: collected split into processed and remainder
                    data: [remainder, processed],
                    backgroundColor: [CONFIG.COLORS.info + '66', CONFIG.COLORS.info],
                    borderWidth: 1
                }
            ]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Rétention vs Rejet (Process)'
                },
                subtitle: {
                    display: true,
                    text: `Retention/Collectées: ${tauxRetentionVsCollected}% • Rejet/Collectées: ${tauxRejetVsCollected}% • Retention/Traitées: ${tauxRetentionVsProcessed}% • Rejet/Traitées: ${tauxRejetVsProcessed}%`
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const dsIndex = ctx.datasetIndex;
                            const di = ctx.dataIndex;
                            const name = dsIndex === 0 ? innerLabels[di] : outerLabels[di];
                            const val = ctx.parsed;
                            return `${name}: ${val.toLocaleString()}`;
                        },
                        afterLabel: (ctx) => {
                            const dsIndex = ctx.datasetIndex;
                            let total = dsIndex === 0 ? (processed || 1) : ((remainder + processed) || 1);
                            const val = ctx.parsed;
                            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                            return `(${pct}%)`;
                        }
                    }
                }
            },
            cutout: '55%'
        };

        this.destroyChart('retentionDonutChart');
        this.charts.set('retentionDonutChart', new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options
        }));

        // Optional: populate a brief analysis text if a target element exists
        try {
            const el = document.getElementById('retentionAnalysisText');
            if (el) {
                el.textContent = `Sur ${coll.toLocaleString()} parcelles collectées, ${processed.toLocaleString()} ont été traitées: ` +
                    `${ret.toLocaleString()} retenues (${tauxRetentionVsProcessed}%) et ${rej.toLocaleString()} rejetées (${tauxRejetVsProcessed}%). ` +
                    `Par rapport au collecté: rétention ${tauxRetentionVsCollected}%, rejet ${tauxRejetVsCollected}%.`;
            }
        } catch(_) {}
    }

    // Update retention donut chart and analysis when data changes (streaming/partial updates)
    updateRetentionDonutChart(rawData) {
        const ctx = document.getElementById('retentionDonutChart');
        if (!ctx) return false;
        const metrics = this._computeRetentionMetrics(rawData);
        const { coll, ret, rej, processed, remainder, tauxRetentionVsCollected, tauxRejetVsCollected, tauxRetentionVsProcessed, tauxRejetVsProcessed } = metrics;
        const chart = this.charts.get('retentionDonutChart');
        if (!chart) {
            // Not created yet; create it now
            this.createRetentionDonutChart(rawData);
            return true;
        }
        try {
            if (Array.isArray(chart.data?.datasets) && chart.data.datasets.length >= 2) {
                chart.data.datasets[0].data = [ret, rej];
                chart.data.datasets[1].data = [remainder, processed];
            }
            if (chart.options?.plugins?.subtitle) {
                chart.options.plugins.subtitle.text = `Retention/Collectées: ${tauxRetentionVsCollected}% • Rejet/Collectées: ${tauxRejetVsCollected}% • Retention/Traitées: ${tauxRetentionVsProcessed}% • Rejet/Traitées: ${tauxRejetVsProcessed}%`;
            }
            chart.update('none');
        } catch (e) {
            console.warn('Retention donut update failed; recreating...', e);
            this.createRetentionDonutChart(rawData);
        }
        try {
            const el = document.getElementById('retentionAnalysisText');
            if (el) {
                el.textContent = `Sur ${coll.toLocaleString()} parcelles collectées, ${processed.toLocaleString()} ont été traitées: ` +
                    `${ret.toLocaleString()} retenues (${tauxRetentionVsProcessed}%) et ${rej.toLocaleString()} rejetées (${tauxRejetVsProcessed}%). ` +
                    `Par rapport au collecté: rétention ${tauxRetentionVsCollected}%, rejet ${tauxRejetVsCollected}%.`;
            }
        } catch(_) {}
        return true;
    }

    // Create geomatician performance chart
    createGeomaticianPerformanceChart(rawData) {
        const ctx = document.getElementById('geomaticianPerformanceChart');
        if (!ctx) return;
    const postProcessData = this.findSheet('Post Process Follow-up', rawData) || [];
        if (!postProcessData.length) return;
        
        // Group by geomatician
        const geomaticians = UTILS.groupBy(postProcessData, 'Geomaticien');
        
        // Calculate performance metrics for each geomatician
        const performanceData = [];
        
        Object.entries(geomaticians).forEach(([geomatician, data]) => {
            if (geomatician && geomatician !== 'undefined') {
                const received = data.reduce((sum, d) => sum + this._getNumericField(d, ['Parcelles reçues (Brutes)','parcelles recues brutes','parcelles reçues']), 0);
                const processed = data.reduce((sum, d) => sum + this._getNumericField(d, ['Parcelles post traitées (Sans Doublons et topoplogie correcte)','parcelles post traitee','parcelles post traitees']), 0);
                
                if (received > 0) {
                    performanceData.push({
                        geomatician,
                        received,
                        processed,
                        efficiency: Math.round((processed / received) * 100)
                    });
                }
            }
        });
        
        // Sort by efficiency
        performanceData.sort((a, b) => b.efficiency - a.efficiency);
        
        // Chart data
        const chartData = {
            labels: performanceData.map(d => d.geomatician),
            datasets: [{
                label: 'Efficacité (%)',
                data: performanceData.map(d => d.efficiency),
                backgroundColor: performanceData.map(d => {
                    if (d.efficiency >= 90) return CONFIG.COLORS.success;
                    if (d.efficiency >= 70) return CONFIG.COLORS.secondary;
                    if (d.efficiency >= 50) return CONFIG.COLORS.warning;
                    return CONFIG.COLORS.danger;
                }),
                borderWidth: 1
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Performance par Géomaticien'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Géomaticien' }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Efficacité (%)' }
                }
            }
        };

        this.destroyChart('geomaticianPerformanceChart');
        this.charts.set('geomaticianPerformanceChart', new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: options
        }));
    }

    

    // Create gauge charts
    createGaugeCharts(rawData, precomputedKPIs = null) {
        let kpis = precomputedKPIs;
        if (!kpis) {
            try {
                kpis = window.dataAggregationService && typeof window.dataAggregationService.calculateKPIs === 'function'
                    ? window.dataAggregationService.calculateKPIs(rawData)
                    : (dataService && typeof dataService.calculateKPIs === 'function' ? dataService.calculateKPIs(rawData) : null);
            } catch (e) {
                console.warn('Gauge KPI calculation fallback error:', e);
            }
        }
        if (!kpis) return;

        // Cache last good KPIs globally for fallback
        if (kpis.daily && kpis.daily.current) {
            window.__lastGoodKPIs = kpis;
        } else if (window.__lastGoodKPIs) {
            kpis = window.__lastGoodKPIs;
        }

        this.createGaugeChart('dailyEfficiencyGauge', (kpis.daily && kpis.daily.percentage) || 0, 'Efficacité Quotidienne');
        this.createGaugeChart('qualityScoreGauge', (kpis.quality && kpis.quality.rate) || 0, 'Score Qualité');
        this.createGaugeChart('ctasfConversionGauge', (kpis.ctasf && kpis.ctasf.rate) || 0, 'Conversion CTASF');
        this.createGaugeChart('processingEfficiencyGauge', (kpis.processing && kpis.processing.rate) || 0, 'Efficacité Processing');
    }

    // Create individual gauge chart
    createGaugeChart(canvasId, value, title) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const percentage = Math.min(100, Math.max(0, value));
        
        // Get color based on percentage
        let color = CONFIG.COLORS.danger;
        if (percentage >= 90) color = CONFIG.COLORS.success;
        else if (percentage >= 75) color = CONFIG.COLORS.secondary;
        else if (percentage >= 50) color = CONFIG.COLORS.warning;
        
        const chartData = {
            datasets: [{
                data: [percentage, 100 - percentage],
                backgroundColor: [color, '#f3f4f6'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        };
        
        const options = {
            ...CHART_CONFIGS.gaugeOptions,
            plugins: {
                tooltip: { enabled: false },
                legend: { display: false }
            },
            rotation: Math.PI,
            circumference: Math.PI,
            cutout: '75%'
        };
        
        this.destroyGauge(canvasId);
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: options,
            plugins: [{
                id: 'gaugeText',
                afterDraw: (chart) => {
                    this.addGaugeText(chart, percentage);
                }
            }]
        });
        
        this.gauges.set(canvasId, chart);
    }

    // Add text overlay to gauge
    addGaugeText(chart, percentage) {
        const ctx = chart.ctx;
        const width = chart.width;
        const height = chart.height;
        const fontSize = Math.min(width, height) / 8;
        
        ctx.restore();
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        // Draw percentage
        ctx.fillStyle = '#1f2937';
        ctx.fillText(`${Math.round(percentage)}%`, width / 2, height * 0.7);
        
        ctx.font = `${fontSize * 0.5}px Arial`;
        ctx.fillStyle = '#6b7280';
        
        ctx.save();
    }

    // Update all charts with new data
    async updateCharts(rawData, precomputedKPIs = null, fullRawData = null) {
        try {
            if (fullRawData && typeof window !== 'undefined') {
                window.__fullRawData = fullRawData;
            }
            
            // Check if we have streaming update config
            const streamingMode = rawData?.streamingUpdate === true;
            
            if (streamingMode && this.charts.size > 0) {
                console.log('Applying streaming update to charts...');
                
                // Update individual chart data without destroying charts
                if (this.charts.has('dailyYieldsChart')) {
                    this.updateDailyYieldsChart(rawData, fullRawData);
                }
                
                if (this.charts.has('qualityTrendChart')) {
                    this.updateQualityTrendChart(rawData);
                }
                
                if (this.charts.has('regionalComparisonChart')) {
                    this.updateRegionalComparisonChart(rawData);
                }
                
                if (this.charts.has('parcelTypeDistributionChart')) {
                    this.updateParcelTypeDistributionChart(rawData);
                }
                
                if (this.charts.has('geomaticianPerformanceChart')) {
                    this.updateGeomaticianPerformanceChart(rawData);
                }
                
                
                
                if (this.charts.has('ctasfPipelineChart')) {
                    this.updateCtasfPipelineChart(rawData);
                }
                
                if (this.charts.has('postProcessingChart')) {
                    this.updatePostProcessingChart(rawData);
                }
                
                // Update retention donut and analysis dynamically
                if (document.getElementById('retentionDonutChart')) {
                    this.updateRetentionDonutChart(rawData);
                }

                // Update gauges with new KPI data
                this.updateGaugeCharts(fullRawData || rawData, precomputedKPIs);
                
                return true;
            } else {
                // Always do a full initialization for safety
                // This ensures we avoid canvas reuse issues
                this.destroyAllCharts();
                
                // Re-create charts with new data
                await this.initializeCharts(rawData, precomputedKPIs, fullRawData || rawData);
                
                return true;
            }
        } catch (error) {
            console.error('Error updating charts:', error);
            
            // On error, try to do a clean initialization after a short delay
            try {
                this.destroyAllCharts();
                // Give browser time to clean up DOM
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.initializeCharts(rawData, precomputedKPIs, fullRawData || rawData);
                return true;
            } catch (e) {
                console.error('Failed to recover from chart error:', e);
                return false;
            }
        }
    }

    // Destroy a specific chart
    destroyChart(chartId) {
        try {
            if (this.charts.has(chartId)) {
                const chart = this.charts.get(chartId);
                chart.destroy();
                this.charts.delete(chartId);
                return true;
            }
        } catch(e) {
            console.warn(`Error destroying chart ${chartId}:`, e);
            // Remove from map even if destroy fails
            this.charts.delete(chartId);
        }
        return false;
    }

    // Destroy a specific gauge
    destroyGauge(gaugeId) {
        if (this.gauges.has(gaugeId)) {
            this.gauges.get(gaugeId).destroy();
            this.gauges.delete(gaugeId);
        }
    }

    // Destroy all charts
    destroyAllCharts() {
        try {
            // Destroy all chart instances
            this.charts.forEach((chart, id) => {
                try {
                    chart.destroy();
                } catch(e) {
                    console.warn(`Error destroying chart ${id}:`, e);
                }
            });
            
            // Destroy all gauge instances
            this.gauges.forEach((gauge, id) => {
                try {
                    gauge.destroy();
                } catch(e) {
                    console.warn(`Error destroying gauge ${id}:`, e);
                }
            });
        } catch (e) {
            console.warn('Error in destroyAllCharts:', e);
        } finally {
            // Clear collections regardless of errors
            this.charts.clear();
            this.gauges.clear();
            
            // Reset chart canvas elements
            try {
                document.querySelectorAll('canvas[id]').forEach(canvas => {
                    const parent = canvas.parentNode;
                    if (parent) {
                        const newCanvas = document.createElement('canvas');
                        newCanvas.id = canvas.id;
                        newCanvas.width = canvas.width;
                        newCanvas.height = canvas.height;
                        newCanvas.className = canvas.className;
                        parent.replaceChild(newCanvas, canvas);
                    }
                });
            } catch(e) {
                console.warn('Error resetting canvas elements:', e);
            }
        }
    }

    // Get chart instance
    getChart(chartId) {
        return this.charts.get(chartId);
    }
    
    // Individual chart update methods for streaming updates
    
    updateDailyYieldsChart(rawData, fullRawData) {
        try {
            const chart = this.charts.get('dailyYieldsChart');
            if (!chart) return false;
            
            const dataToUse = fullRawData || rawData;
            const dailyStats = window.dataAggregationService ? 
                dataAggregationService.getDailyStats(dataToUse) : 
                this.findSheet('DailyStats', dataToUse);
                
            if (!dailyStats || !Array.isArray(dailyStats)) return false;
            
            // Create datasets from daily stats
            const { datasets, labels } = this._prepareDailyYieldsData(dailyStats);
            
            // Update chart data without recreation
            chart.data.labels = labels;
            chart.data.datasets = datasets;
            chart.update('show');
            
            return true;
        } catch (error) {
            console.error('Error updating daily yields chart:', error);
            return false;
        }
    }
    
    _prepareDailyYieldsData(dailyStats) {
        // Sort by date
        const sortedStats = [...dailyStats].sort((a, b) => {
            // Prioritize dataAggregationService for consistent date parsing
            let dateA, dateB;
            
            if (window.dataAggregationService && typeof window.dataAggregationService.parseDate === 'function') {
                dateA = window.dataAggregationService.parseDate(a.Date);
                dateB = window.dataAggregationService.parseDate(b.Date);
            }
            
            // Fall back to other methods if needed
            if (!dateA) {
                dateA = (window.UTILS && UTILS.parseDateDMY) ? UTILS.parseDateDMY(a.Date) : (window.dataService && dataService.parseDate ? dataService.parseDate(a.Date) : new Date(a.Date));
            }
            if (!dateB) {
                dateB = (window.UTILS && UTILS.parseDateDMY) ? UTILS.parseDateDMY(b.Date) : (window.dataService && dataService.parseDate ? dataService.parseDate(b.Date) : new Date(b.Date));
            }
            
            return dateA - dateB;
        });
            
        // Extract labels (dates) and values
        const labels = sortedStats.map(stat => {
            // Parse the date first to ensure consistent format
            const parsedDate = window.dataAggregationService && typeof window.dataAggregationService.parseDate === 'function' 
                ? window.dataAggregationService.parseDate(stat.Date) 
                : null;
                
            // Then format it
            if (parsedDate) {
                return this.formatDate(parsedDate);
            } else if (window.dataService && typeof dataService.formatDate === 'function') {
                return dataService.formatDate(stat.Date);
            } else {
                return stat.Date;
            }
        });
            
        const yieldValues = sortedStats.map(stat => this._getNumericField(stat, ['Levees', 'Parcelles', 'ParcelsProcessed']));
        const targetValues = sortedStats.map(stat => this._getNumericField(stat, ['Target', 'ObjectifQuotidien']));
            
        // Create datasets
        const datasets = [
            {
                label: 'Levées quotidiennes',
                data: yieldValues,
                borderColor: '#4B83F6',
                backgroundColor: '#4B83F6',
                fill: false
            },
            {
                label: 'Objectif',
                data: targetValues,
                borderColor: '#22C55E',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false
            }
        ];
            
        return { datasets, labels };
    }
    
    updateQualityTrendChart(rawData) {
        try {
            const chart = this.charts.get('qualityTrendChart');
            if (!chart) return false;
            
            // Get quality data
            const qualityData = window.dataAggregationService ? 
                dataAggregationService.getQualityTrend(rawData) : 
                this.findSheet('QualityTrend', rawData);
                
            if (!qualityData || !Array.isArray(qualityData)) return false;
            
            // Create datasets from quality data
            const { datasets, labels } = this._prepareQualityTrendData(qualityData);
            
            // Update chart data without recreation
            chart.data.labels = labels;
            chart.data.datasets = datasets;
            chart.update('show');
            
            return true;
        } catch (error) {
            console.error('Error updating quality trend chart:', error);
            return false;
        }
    }
    
    _prepareQualityTrendData(qualityData) {
        // Extract labels and values
        const labels = qualityData.map(item => item.Period || item.Date);
        const errorRateValues = qualityData.map(item => this._getNumericField(item, ['ErrorRate', 'TauxErreur']));
        const qualityScoreValues = qualityData.map(item => this._getNumericField(item, ['QualityScore', 'ScoreQualite']));
        
        // Create datasets
        const datasets = [
            {
                label: 'Score de qualité',
                data: qualityScoreValues,
                borderColor: '#22C55E',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                yAxisID: 'y',
                fill: true
            },
            {
                label: 'Taux d\'erreur',
                data: errorRateValues,
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                yAxisID: 'y1',
                fill: true
            }
        ];
        
        return { datasets, labels };
    }
    
    updateGaugeCharts(rawData, precomputedKPIs = null) {
        try {
            // If precomputed KPIs are provided, use them directly
            const kpis = precomputedKPIs || (window.dataAggregationService ? 
                dataAggregationService.computeMainKPIs(rawData) : 
                {});
            
            // Update each gauge with new value
            if (this.gauges.has('completionGauge') && kpis.completionRate !== undefined) {
                this.gauges.get('completionGauge').set(kpis.completionRate);
            }
            
            if (this.gauges.has('qualityGauge') && kpis.qualityScore !== undefined) {
                this.gauges.get('qualityGauge').set(kpis.qualityScore);
            }
            
            if (this.gauges.has('efficiencyGauge') && kpis.efficiencyScore !== undefined) {
                this.gauges.get('efficiencyGauge').set(kpis.efficiencyScore);
            }
            
            return true;
        } catch (error) {
            console.error('Error updating gauge charts:', error);
            return false;
        }
    }

    // Export chart as image
    exportChart(chartId, format = 'png') {
        const chart = this.getChart(chartId);
        if (!chart) return null;
        
    if (format === 'png') return chart.toBase64Image('image/png');
    if (format === 'jpeg') return chart.toBase64Image('image/jpeg');
    if (format === 'svg' && chart.canvas && chart.canvas.toDataURL) return chart.canvas.toDataURL('image/svg+xml');
    // PDF export can be implemented via jspdf if later approved
    return chart.toBase64Image('image/png');
    }
}

// Create global instance
window.chartService = new ChartService();
