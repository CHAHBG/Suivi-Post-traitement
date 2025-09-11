// Chart Service for creating and managing all dashboard charts

class ChartService {
    constructor() {
        this.charts = new Map();
        this.gauges = new Map();
    this.initializedBasic = false;
    this.deferredQueue = [];
        // Prefer using dataAggregationService helper if available
        this._getNumericField = (row, candidates) => {
            try {
                if (window.dataAggregationService && typeof window.dataAggregationService._getNumericField === 'function') {
                    return window.dataAggregationService._getNumericField(row, candidates);
                }
            } catch (e) { /* fallback */ }

            // Local fallback: try permissive parsing
            if (!row || typeof row !== 'object') return 0;
            const normKey = (s) => String(s || '').trim().toLowerCase().replace(/\u00A0/g,' ').normalize('NFD').replace(/[\u0000-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
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

    // Initialize all charts
    async initializeCharts(rawData, precomputedKPIs = null, fullRawData = null) {
        try {
            // Fast path: render only above-the-fold essential charts first
            if (!this.initializedBasic) {
                this.createDailyYieldsChart(rawData);
                this.createQualityTrendChart(rawData);
                this.createGaugeCharts(fullRawData || rawData, precomputedKPIs);
                this.initializedBasic = true;
                // Defer heavier charts to next frame to avoid long blocking
                requestIdleCallback ? requestIdleCallback(()=> this._initDeferred(rawData, precomputedKPIs, fullRawData)) : setTimeout(()=> this._initDeferred(rawData, precomputedKPIs, fullRawData), 50);
                return true;
            }
            // Create time series charts
            this.createDailyYieldsChart(rawData);
            this.createQualityTrendChart(rawData);
            this.createCtasfPipelineChart(rawData);
            this.createPostProcessingChart(rawData);
            
            // Create comparison and distribution charts
            this.createRegionalComparisonChart(rawData);
            this.createParcelTypeDistributionChart(rawData);
            
            // Create advanced analytics charts
            this.createGeomaticianPerformanceChart(rawData);
            this.createProcessingFunnelChart(rawData);

            // New intra-sheet charts (render only if canvas elements exist)
            this.createOverviewMetricsChart(rawData);
            this.createProcessingPhaseStackedChart(rawData);
            this.createTeamProductivityChart(rawData);
            this.createCommuneStatusChart(rawData);
            this.createProjectionsMultiMetricChart(rawData);
            this.createProjectTimelineChart(rawData); // Gantt-style approximation
            
            // Create gauge charts (prefer fullRawData + precomputed KPIs to avoid empty-filter default noise)
            this.createGaugeCharts(fullRawData || rawData, precomputedKPIs);
            
            console.log('All charts initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing charts:', error);
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
            this.createProcessingFunnelChart(rawData);
            this.createOverviewMetricsChart(rawData);
            this.createProcessingPhaseStackedChart(rawData);
            this.createTeamProductivityChart(rawData);
            this.createCommuneStatusChart(rawData);
            this.createProjectionsMultiMetricChart(rawData);
            this.createProjectTimelineChart(rawData);
            console.log('Deferred charts initialized');
        } catch(e){ console.warn('Deferred chart init error', e); }
    }

    // Overview Metrics (Sheet: Overview Metrics) - simple bar
    createOverviewMetricsChart(rawData) {
        const ctx = document.getElementById('overviewMetricsChart');
        if (!ctx) return;
        const sheet = this.findSheet('Overview Metrics', rawData) || [];
        if (!sheet.length) return;

        const labels = sheet.map(r => r.Metric || r.metric || '');
        const values = sheet.map(r => Number(r.Value || r.value || 0));

        this.destroyChart('overviewMetricsChart');
        this.charts.set('overviewMetricsChart', new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Valeur', data: values, backgroundColor: CONFIG.COLORS.primary }] },
            options: { ...CHART_CONFIGS.defaultOptions, plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Overview Metrics' } }, scales: { y: { beginAtZero: true } } }
        }));
    }

    // Processing Phase stacked comparison (Sheets: Processing Phase 1 & 2)
    createProcessingPhaseStackedChart(rawData) {
        const ctx = document.getElementById('processingPhaseStackedChart');
        if (!ctx) return;
        const phase1 = this.findSheet('Processing Phase 1', rawData) || [];
        const phase2 = this.findSheet('Processing Phase 2', rawData) || [];
        if (!phase1.length && !phase2.length) return;

        // Combine and group: key = Phase|Tool
        const groupMap = new Map();
        const addRows = (rows, label) => {
            rows.forEach(r => {
                const phase = r.Phase || r.phase || 'Phase';
                const tool = r.Tool || r.tool || 'Tool';
                const parcelType = r['Parcel Type'] || r.ParcelType || r['parcel type'] || 'Type';
                const total = Number(r.Total || r.total || 0);
                const key = `${phase}|${tool}`;
                if (!groupMap.has(key)) groupMap.set(key, { phase, tool });
                const entry = groupMap.get(key);
                entry[parcelType] = (entry[parcelType] || 0) + total;
            });
        };
        addRows(phase1, 'P1');
        addRows(phase2, 'P2');

        const entries = Array.from(groupMap.values());
        const labels = entries.map(e => `${e.phase}\n${e.tool}`);
        // Collect all parcel type keys
        const parcelTypes = Array.from(new Set(entries.flatMap(e => Object.keys(e).filter(k => !['phase','tool'].includes(k)))));
        const colorPool = [CONFIG.COLORS.primary, CONFIG.COLORS.secondary, CONFIG.COLORS.success, CONFIG.COLORS.warning, CONFIG.COLORS.info, CONFIG.COLORS.accent, CONFIG.COLORS.danger];
        const datasets = parcelTypes.map((pt, i) => ({
            label: pt,
            data: entries.map(e => e[pt] || 0),
            backgroundColor: colorPool[i % colorPool.length],
            stack: 'stack1'
        }));

        this.destroyChart('processingPhaseStackedChart');
        this.charts.set('processingPhaseStackedChart', new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: { ...CHART_CONFIGS.defaultOptions, plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Processing Phase Composition' } }, responsive: true, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
        }));
    }

    // Team Productivity (Sheet: Team Productivity)
    createTeamProductivityChart(rawData) {
        const ctx = document.getElementById('teamProductivityChart');
        if (!ctx) return;
        const sheet = this.findSheet('Team Productivity', rawData) || [];
        if (!sheet.length) return;
        const labels = sheet.map(r => r.Team || r.team || '');
        const values = sheet.map(r => Number(r['Champs/Equipe/Jour'] || r.champs || r.value || 0));
        this.destroyChart('teamProductivityChart');
        this.charts.set('teamProductivityChart', new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Champs / Équipe / Jour', data: values, backgroundColor: CONFIG.COLORS.secondary }] },
            options: { ...CHART_CONFIGS.defaultOptions, plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Team Productivity' } }, scales: { y: { beginAtZero: true } } }
        }));
    }

    // Commune Status (Sheet: Commune Analysis)
    createCommuneStatusChart(rawData) {
        const ctx = document.getElementById('communeStatusChart');
        if (!ctx) return;
        const sheet = this.findSheet('Commune Analysis', rawData) || [];
        if (!sheet.length) return;

        const communes = sheet.map(r => r.Commune || r.commune || '');
        const metrics = [
            { key: ['Total Parcels','Total','total parcels'], label: 'Total', color: CONFIG.COLORS.primary },
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
            options: { ...CHART_CONFIGS.defaultOptions, plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Statut par Commune' } }, responsive: true, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: false }, y: { beginAtZero: true } } }
        }));
    }

    // Projections Multi-Metric (Sheets: Collection Projections, Display Projections, CTASF Projections)
    createProjectionsMultiMetricChart(rawData) {
        const ctx = document.getElementById('projectionsMultiMetricChart');
        if (!ctx) return;
        const collection = this.findSheet('Collection Projections', rawData) || [];
        const display = this.findSheet('Display Projections', rawData) || [];
        const ctasf = this.findSheet('CTASF Projections', rawData) || [];
        if (!collection.length && !display.length && !ctasf.length) return;

        // Detect month-like columns (Sept 2025 etc.) by regex for month names or YYYY-MM
        const monthRegex = /(jan|feb|mar|apr|may|mai|jun|jul|aug|sep|sept|oct|nov|dec|déc)\s*20\d{2}/i;
        const collectSample = collection[0] || display[0] || ctasf[0] || {};
        const monthCols = Object.keys(collectSample).filter(k => monthRegex.test(k));
        if (!monthCols.length) return; // nothing to chart

        const datasets = [];
        const addSheet = (sheet, label, color) => {
            if (!sheet.length) return;
            // Assume each row is one metric; sum metrics per column
            const sums = monthCols.map(col => sheet.reduce((s,r)=> s + (Number(r[col])||0),0));
            datasets.push({ label, data: sums, borderColor: color, backgroundColor: color + '40', tension: 0.3, fill: false });
        };
        addSheet(collection, 'Collection', CONFIG.COLORS.primary);
        addSheet(display, 'Display', CONFIG.COLORS.success);
        addSheet(ctasf, 'CTASF', CONFIG.COLORS.warning);

        this.destroyChart('projectionsMultiMetricChart');
        this.charts.set('projectionsMultiMetricChart', new Chart(ctx, {
            type: 'line',
            data: { labels: monthCols, datasets },
            options: { ...CHART_CONFIGS.defaultOptions, plugins: { ...CHART_CONFIGS.defaultOptions.plugins, title: { display: true, text: 'Projections Multi-Métriques (Sept-Dec)' } }, scales: { y: { beginAtZero: true } } }
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
            if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d;
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
        const ctx = document.getElementById('dailyYieldsChart');
        if (!ctx) return;

        const timeSeriesData = dataService.getTimeSeriesData(
            rawData, 
            'Yields Projections', 
            'Date', 
            'Nombre de levées'
        );

        const chartData = {
            labels: timeSeriesData.map(d => d.date),
            datasets: [{
                label: 'Levées quotidiennes',
                data: timeSeriesData.map(d => d.value),
                borderColor: CONFIG.COLORS.primary,
                backgroundColor: CONFIG.COLORS.primary + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }, {
                label: 'Objectif (832,77)',
                data: Array(timeSeriesData.length).fill(CONFIG.TARGETS.DAILY_PARCELS),
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
        this.charts.set('dailyYieldsChart', new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: options
        }));
    }

    // Create quality trend chart
    createQualityTrendChart(rawData) {
        const ctx = document.getElementById('qualityTrendChart');
        if (!ctx) return;
    const qualityData = this.findSheet('Public Display Follow-up', rawData);
    if (!qualityData) return;
        const groupedByDate = UTILS.groupBy(qualityData, 'Date');
        const timeSeriesData = [];

        Object.keys(groupedByDate).forEach(date => {
            const dayData = groupedByDate[date];
            const sansErreur = dayData.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre de parcelles affichées sans erreurs','parcelles affichées sans erreurs']), 0);
            const avecErreur = dayData.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre Parcelles avec erreur','parcelles avec erreur']), 0);
            const total = sansErreur + avecErreur;
            const qualityRate = total > 0 ? Math.round(sansErreur / total * 100) : 0;
            
            timeSeriesData.push({
                date,
                sansErreur,
                avecErreur,
                total,
                qualityRate
            });
        });

        timeSeriesData.sort((a, b) => new Date(a.date) - new Date(b.date));

        const chartData = {
            labels: timeSeriesData.map(d => d.date),
            datasets: [{
                label: 'Taux de qualité (%)',
                data: timeSeriesData.map(d => d.qualityRate),
                borderColor: CONFIG.COLORS.success,
                backgroundColor: CONFIG.COLORS.success + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                yAxisID: 'y'
            }, {
                label: 'Total parcelles',
                data: timeSeriesData.map(d => d.total),
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
        this.charts.set('qualityTrendChart', new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: options
        }));
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

        this.destroyChart('postProcessingChart');
        this.charts.set('postProcessingChart', new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: options
        }));
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
            const regionYields = yieldsData.filter(d => d['Région'] === region);
            const totalYields = regionYields.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre de levées','nombre de levees']), 0);
            
            // Quality
            const regionDisplay = displayData.filter(d => d['Région'] === region);
            const sansErreur = regionDisplay.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre de parcelles affichées sans erreurs','parcelles affichées sans erreurs']), 0);
            const avecErreur = regionDisplay.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre Parcelles avec erreur','parcelles avec erreur']), 0);
            const qualityRate = sansErreur + avecErreur > 0 ? Math.round(sansErreur / (sansErreur + avecErreur) * 100) : 0;
            
            // CTASF
            const regionCtasf = ctasfData.filter(d => d['Région'] === region);
            const ctasfEmmen = regionCtasf.reduce((sum, d) => sum + this._getNumericField(d, ['Nombre parcelles emmenées au CTASF','parcelles emmenées']), 0);
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

    // Create processing funnel chart
    createProcessingFunnelChart(rawData) {
        const ctx = document.getElementById('processingFunnelChart');
        if (!ctx) return;
    const postProcessData = this.findSheet('Post Process Follow-up', rawData) || [];
        if (!postProcessData.length) return;
        
        // Calculate funnel stages
        const received = postProcessData.reduce((sum, d) => sum + Number(d['Parcelles reçues (Brutes)'] || 0), 0);
        const processed = postProcessData.reduce((sum, d) => sum + Number(d['Parcelles post traitées (Sans Doublons et topoplogie correcte)'] || 0), 0);
        const individual = postProcessData.reduce((sum, d) => sum + Number(d['Parcelles individuelles Jointes'] || 0), 0);
        const collective = postProcessData.reduce((sum, d) => sum + Number(d['Parcelles collectives Jointes'] || 0), 0);
        const noJoin = postProcessData.reduce((sum, d) => sum + Number(d['Parcelles sans jointure'] || 0), 0);
        const returned = postProcessData.reduce((sum, d) => sum + Number(d['Parcelles retournées aux topos'] || 0), 0);
        
        // Chart data
        const labels = [
            'Reçues (Brutes)',
            'Post-traitées',
            'Individuelles jointes',
            'Collectives jointes',
            'Sans jointure',
            'Retournées'
        ];
        
        const values = [received, processed, individual, collective, noJoin, returned];
        
        // Create gradient colors
        const gradientColors = [
            CONFIG.COLORS.primary,
            CONFIG.COLORS.secondary,
            CONFIG.COLORS.success,
            CONFIG.COLORS.accent,
            CONFIG.COLORS.warning,
            CONFIG.COLORS.danger
        ];

        const chartData = {
            labels,
            datasets: [{
                data: values,
                backgroundColor: gradientColors,
                borderWidth: 1
            }]
        };

        const options = {
            ...CHART_CONFIGS.defaultOptions,
            indexAxis: 'y',
            plugins: {
                ...CHART_CONFIGS.defaultOptions.plugins,
                title: {
                    display: true,
                    text: 'Entonnoir de Traitement'
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Nombre de parcelles' }
                }
            }
        };

        this.destroyChart('processingFunnelChart');
        this.charts.set('processingFunnelChart', new Chart(ctx, {
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
            // Destroy all existing charts
            this.destroyAllCharts();
            
            // Re-create charts with new data
            await this.initializeCharts(rawData, precomputedKPIs, fullRawData || rawData);
            
            return true;
        } catch (error) {
            console.error('Error updating charts:', error);
            return false;
        }
    }

    // Destroy a specific chart
    destroyChart(chartId) {
        if (this.charts.has(chartId)) {
            this.charts.get(chartId).destroy();
            this.charts.delete(chartId);
        }
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
        this.charts.forEach(chart => chart.destroy());
        this.gauges.forEach(gauge => gauge.destroy());
        
        this.charts.clear();
        this.gauges.clear();
    }

    // Get chart instance
    getChart(chartId) {
        return this.charts.get(chartId);
    }

    // Export chart as image
    exportChart(chartId, format = 'png') {
        const chart = this.getChart(chartId);
        if (!chart) return null;
        
        return chart.toBase64Image(format);
    }
}

// Create global instance
window.chartService = new ChartService();
