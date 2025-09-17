/**
 * Dashboard Controller for PROCASSEF Monitoring
 */
class EnhancedDashboard {
    constructor() {
        this.isInitialized = false;
        this.currentFilters = {
            region: '',
            timeframe: 'daily',
            commune: ''
        };
    this.tubesInitialized = false;
        this.refreshInterval = null;
        this.rawData = null;
        this.autoRefreshEnabled = true;
        this.autoRefreshInterval = 5 * 60 * 1000; // 5 minutes
        
        // Ensure loading overlay is visible at start
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        // Set a timeout to hide loading overlay after 8 seconds (failsafe)
        setTimeout(() => {
            this.showLoading(false);
        }, 8000);
    }
    
    /**
     * Initialize the dashboard
     */
    async initialize() {
        try {
            this.showLoading(true);
            
            console.log('Initializing PROCASSEF Dashboard...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial data from Google Sheets
            await this.loadData();
            
            // Set up auto-refresh
            this.setupAutoRefresh();
            
            this.isInitialized = true;
            console.log('Dashboard initialized successfully');
            
            // Update last refresh time
            this.updateLastRefreshTime();
            
            // Update debug panel if available
            if (window.debugPanel && typeof window.debugPanel.update === 'function') {
                window.debugPanel.update();
            }
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Erreur lors du chargement du dashboard');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Load data and update dashboard components
     */
    async loadData() {
        try {
            // For development/testing, use mock data
            // In production, fetch from Google Sheets
            let data;
            
            // Allow forcing live Sheets fetch by setting window.FORCE_LIVE_DATA = true or CONFIG.FORCE_LIVE_DATA = true
            // Also prefer live Sheets automatically when an API key is available, unless explicitly forcing mock via FORCE_USE_MOCK
            const explicitForceLive = (window.FORCE_LIVE_DATA === true) || (window.CONFIG && window.CONFIG.FORCE_LIVE_DATA === true);
            const explicitForceMock = (window.FORCE_USE_MOCK === true) || (window.CONFIG && window.CONFIG.FORCE_USE_MOCK === true);

            // Detect API key from common globals or from the enhancedGoogleSheetsService config
            let detectedApiKey = null;
            if (window.GOOGLE_SHEETS_API_KEY) detectedApiKey = window.GOOGLE_SHEETS_API_KEY;
            if (!detectedApiKey && window.API_KEY) detectedApiKey = window.API_KEY;
            if (!detectedApiKey && window.CONFIG && window.CONFIG.SHEETS_API_KEY) detectedApiKey = window.CONFIG.SHEETS_API_KEY;
            try {
                if (!detectedApiKey && window.enhancedGoogleSheetsService && typeof window.enhancedGoogleSheetsService.getPROCASSEFConfig === 'function') {
                    const cfg = window.enhancedGoogleSheetsService.getPROCASSEFConfig();
                    if (cfg && cfg.apiKey) detectedApiKey = cfg.apiKey;
                }
            } catch (e) {
                // ignore
            }

            let forceLive = explicitForceLive;
            if (!explicitForceLive && !explicitForceMock && detectedApiKey) {
                forceLive = true;
                console.log('API key detected; preferring live Google Sheets data over mock data');
            }

            // Prefer the enhanced Google Sheets service (uses gid/name and optional Sheets API)
            try {
                const googleService = window.enhancedGoogleSheetsService || window.googleSheetsService;

                if (googleService && typeof googleService.fetchMultipleSheets === 'function') {
                    try {
                        const cfg = (typeof googleService.getPROCASSEFConfig === 'function') ? googleService.getPROCASSEFConfig() : {};
                        const sheetsToFetch = Array.isArray(cfg.sheets) ? cfg.sheets : [];
                        const spreadsheetId = cfg.spreadsheetId || '';

                        // Pass apiKey when available to let the service prefer the Values API over CSV export
                        const options = { apiKey: cfg.apiKey || null, useCaching: true };

                        if (!spreadsheetId || sheetsToFetch.length === 0) {
                            console.warn('enhancedGoogleSheetsService config incomplete, falling back to dataService');
                            throw new Error('Missing spreadsheetId or sheets list');
                        }

                        const fetched = await googleService.fetchMultipleSheets(spreadsheetId, sheetsToFetch, options);
                        data = fetched || {};
                        console.info('Data loaded via enhancedGoogleSheetsService', Object.keys(data));
                    } catch (svcErr) {
                        console.warn('enhancedGoogleSheetsService failed, falling back to dataService:', svcErr);
                        if (window.dataService && typeof window.dataService.getAllData === 'function') {
                            const result = await window.dataService.getAllData();
                            data = result.data || {};
                            if (result.errors && result.errors.length) console.warn('Some sheets failed to load:', result.errors);
                            console.info('Data loaded via dataService (CSV fallback)');
                        } else {
                            data = {};
                        }
                    }
                } else if (window.dataService && typeof window.dataService.getAllData === 'function') {
                    // No enhanced service available, use CSV-based dataService
                    const result = await window.dataService.getAllData();
                    data = result.data || {};
                    if (result.errors && result.errors.length) console.warn('Some sheets failed to load:', result.errors);
                    console.info('Data loaded via dataService');
                } else {
                    console.warn('No data fetcher available (enhancedGoogleSheetsService or dataService)');
                    data = {};
                }
            } catch (err) {
                console.error('Error loading data via google service/dataService:', err);
                data = {};
            }

            this.rawData = data;
            // Normalize keys: ensure canonical names from config are present
            try {
                const canonical = {};
                // Combine both sets
                const combined = Object.assign({}, window.GOOGLE_SHEETS || {}, window.MONITORING_SHEETS || {});
                Object.values(combined).forEach(s => {
                    if (!s) return;
                    const name = s.name || '';
                    if (name && this.rawData[name]) {
                        canonical[name] = this.rawData[name];
                    }
                });

                // Also include any existing keys from raw data
                Object.keys(this.rawData).forEach(k => { if (!canonical[k]) canonical[k] = this.rawData[k]; });

                this.rawData = canonical;
            } catch (e) {
                console.warn('Error normalizing sheet keys:', e);
            }
            
            // Calculate KPIs using aggregation service (use normalized this.rawData)
            const kpis = dataAggregationService.calculateKPIs(this.rawData, this.currentFilters);
            // Expose KPIs and dashboard reference globally so other UI helpers (forecastCard) can access immediately
            try {
                window.__lastGoodKPIs = kpis;
                window.kpis = kpis;
                window.enhancedDashboard = window.enhancedDashboard || this;
                // also attach to this instance for internal consumers
                this.kpis = kpis;
            } catch (e) { /* ignore */ }
            console.log('KPIs calculated:', kpis);
            
            // Initialize tube progress indicators
            this.initializeTubeIndicators(kpis);
            
            // Update quality and other rate displays
            this.updateRateDisplays(kpis);

            // Update header trends dynamically
            this.updateHeaderTrends(this.rawData, kpis);
            
            // Update progress indicators
            this.updateProgressIndicators(kpis);
            
            // Initialize charts
            await this.initializeCharts(this.rawData, kpis);
            
            // Update regional data
            this.updateRegionalData(this.rawData);

            // Populate detailed tables using current filters
            this.populateDataTables(this.filterData(this.rawData));
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            throw error;
        }
    }
    
    /**
     * Initialize tube progress indicators
     * @param {Object} kpis - KPI data
     * @returns {boolean} success status
     */
    initializeTubeIndicators(kpis) {
        console.log('Initializing tube indicators with:', kpis);

        // Accept both legacy class and new hero-section naming (robust to future changes)
        const possibleSections = [
            document.querySelector('.overview-section'),
            document.querySelector('.hero-section'),
            document.getElementById('dailyTube')?.parentElement // fallback heuristic
        ].filter(Boolean);

        if (!possibleSections.length) {
            console.warn('[TubeInit] No overview/hero section found – retry will occur on next refresh if containers appear later.');
        }
        
        // Initialize or update tube progress indicators
        if (window.tubeProgressService) {
            // First check if tube container elements exist, if not try to use legacy liquid containers
            const dailyContainer = document.getElementById('dailyTube') || document.getElementById('dailyProgress');
            const weeklyContainer = document.getElementById('weeklyTube') || document.getElementById('weeklyProgress');
            const monthlyContainer = document.getElementById('monthlyTube') || document.getElementById('monthlyProgress');
            
            // Ensure the containers have the correct IDs and transform legacy containers
            if (dailyContainer) {
                if (dailyContainer.id !== 'dailyTube') {
                    dailyContainer.id = 'dailyTube';
                    // Clear any legacy content to avoid interference
                    dailyContainer.innerHTML = '';
                    dailyContainer.className = 'tube-container';
                }
            }
            
            if (weeklyContainer) {
                if (weeklyContainer.id !== 'weeklyTube') {
                    weeklyContainer.id = 'weeklyTube';
                    weeklyContainer.innerHTML = '';
                    weeklyContainer.className = 'tube-container';
                }
            }
            
            if (monthlyContainer) {
                if (monthlyContainer.id !== 'monthlyTube') {
                    monthlyContainer.id = 'monthlyTube';
                    monthlyContainer.innerHTML = '';
                    monthlyContainer.className = 'tube-container';
                }
            }
            
            // Only initialize tubes if the containers exist
            const tubesToInitialize = {};
            
            if (dailyContainer) {
                tubesToInitialize.dailyTube = {
                    title: 'Jour',
                    currentValue: kpis.daily.current,
                    targetValue: kpis.daily.target,
                    percentage: kpis.daily.percentage,
                    gap: kpis.daily.gap,
                    status: kpis.daily.status,
                    color: 'primary'
                };
            }
            
            if (weeklyContainer) {
                tubesToInitialize.weeklyTube = {
                    title: 'Semaine',
                    currentValue: kpis.weekly.current,
                    targetValue: kpis.weekly.target,
                    percentage: kpis.weekly.percentage,
                    gap: kpis.weekly.gap,
                    status: kpis.weekly.status,
                    color: 'warning'
                };
            }
            
            if (monthlyContainer) {
                // Compute monthly target as dailyGoal * 30 (preference to CONFIG.TARGETS.DAILY_PARCELS)
                const cfgDaily = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) ? window.CONFIG.TARGETS.DAILY_PARCELS : (dataAggregationService && dataAggregationService.config && dataAggregationService.config.dailyGoal) ? dataAggregationService.config.dailyGoal : 833;
                const monthlyTargetFromDaily = Math.round(Number(cfgDaily) * 30);
                const effectiveMonthlyTarget = (kpis.monthly && kpis.monthly.target) ? kpis.monthly.target : monthlyTargetFromDaily;

                tubesToInitialize.monthlyTube = {
                    title: 'Mois',
                    currentValue: kpis.monthly.current,
                    targetValue: effectiveMonthlyTarget,
                    percentage: kpis.monthly.percentage,
                    gap: kpis.monthly.gap,
                    status: kpis.monthly.status,
                    color: 'danger'
                };
            }
            
            if (Object.keys(tubesToInitialize).length > 0) {
                try {
                    tubeProgressService.initializeTubes(tubesToInitialize);
                    this.tubesInitialized = true;
                    // Add small forecast icon to monthly tube (if available)
                    try {
                        // Do NOT add an icon into the monthly tube per design change.
                        // Only recompute and display the gap based on effective monthly target
                        const monthlyEl = document.getElementById('monthlyTube');
                        if (monthlyEl) {
                            try {
                                const monthlyKPI = kpis && kpis.monthly ? kpis.monthly : null;
                                if (monthlyKPI) {
                                    const effectiveTarget = monthlyKPI.target;
                                    const gap = (Number(monthlyKPI.current) || 0) - (Number(effectiveTarget) || 0);
                                    const gapEl = monthlyEl.querySelector('.tube-gap');
                                    if (gapEl) {
                                        const absFmt = new Intl.NumberFormat('fr-FR').format(Math.abs(Math.round(gap)));
                                        gapEl.textContent = (gap >= 0 ? `+${absFmt}` : `-${absFmt}`);
                                        gapEl.classList.toggle('positive', gap > 0);
                                        gapEl.classList.toggle('negative', gap < 0);
                                    }
                                    if (window.tubeProgressService && typeof window.tubeProgressService.updateTube === 'function') {
                                        window.tubeProgressService.updateTube('monthlyTube', { targetValue: effectiveTarget, gap: (Number(monthlyKPI.current)||0) - (Number(effectiveTarget)||0) });
                                    }
                                }
                            } catch(e) { /* ignore */ }
                        }
                    } catch (err) { console.warn('Could not update monthly gap:', err); }
                    return true;
                } catch (error) {
                    console.error('Error initializing tube indicators:', error);
                    return false;
                }
            } else {
                console.warn('[TubeInit] Containers (dailyTube / weeklyTube / monthlyTube) not found yet.');
                return false;
            }
        } else if (window.liquidProgressService) {
            // Fallback to legacy liquid progress
            try {
                liquidProgressService.initializeLiquidProgress(kpis);
                this.tubesInitialized = true;
                return true;
            } catch (error) {
                console.error('Error initializing liquid indicators:', error);
                return false;
            }
        }
        return false;
    }
    
    /**
     * Update rate displays for quality, CTASF, etc.
     * @param {Object} kpis - KPI data
     */
    updateRateDisplays(kpis) {
        // Update quality rate display
        if (kpis.quality && typeof kpis.quality.rate !== 'undefined') {
            this.updateQualityRate(kpis.quality.rate);
            this.updateTrendBadge('qualityRate', kpis.quality.changePct);
        } else {
            console.warn('Quality rate data is missing');
            this.updateQualityRate(0);
        }
        
        // Update CTASF rate
        if (kpis.ctasf && typeof kpis.ctasf.rate !== 'undefined') {
            this.updateCTASFRate(kpis.ctasf.rate);
            this.updateTrendBadge('ctasfRate', kpis.ctasf.changePct, true);
        }
        
        // Update processing rate
        if (kpis.processing && typeof kpis.processing.rate !== 'undefined') {
            this.updateProcessingRate(kpis.processing.rate);
            this.updateTrendBadge('processingRate', kpis.processing.changePct, true);
        }
    }
    
    /**
     * Update progress indicators in the overview section
     * @param {Object} kpis - KPI data
     */
    updateProgressIndicators(kpis) {
    console.log('🔄 Updating overview metrics from Commune Analysis');
    // Aggregate Commune Analysis sheet for overview
    const commData = this.rawData['Commune Analysis'] || [];
    // Helper: parse number
    const parseNumOverview = v => Number(String(v).replace(/\s+/g, '').replace(/,/g, '.')) || 0;
    // Robust per-row lookup: try exact column names (French first), then case-insensitive key match
    const getValueForRow = (row, candidates = []) => {
        for (const cand of candidates) {
            if (!cand) continue;
            // direct property (exact)
            if (row[cand] != null && row[cand] !== '') return parseNumOverview(row[cand]);
            // case-insensitive match of existing keys
            const foundKey = Object.keys(row).find(k => k && k.toLowerCase() === cand.toLowerCase());
            if (foundKey && row[foundKey] != null && row[foundKey] !== '') return parseNumOverview(row[foundKey]);
        }
        return 0;
    };

    // Sum candidates across all communes. Accepts multiple fallbacks: French first, English second.
    const sumCol = (...candidates) => commData.reduce((sum, r) => sum + getValueForRow(r, candidates), 0);

    // NOTE: Historically some dashboard numbers were derived from other sheets (yields/processing) or placeholders.
    // Now we explicitly sum columns from the 'Commune Analysis' sheet using the exact French column names you provided
    // (with English fallbacks only if French keys are missing).
    const totalParcelsOverview = sumCol('Total Parcelles', 'Total Parcels');
    const nicadOverview = sumCol('NICAD');
    const ctasfOverview = sumCol('CTASF');
    const deliberatedOverview = sumCol('Délibérées', 'Deliberated');
    // Update Total Parcels
    // Total Parcels (display absolute sum)
    this.updateProgressBar('totalParcelsOverviewProgress', 100);
    this.updateProgressValue('totalParcelsOverviewValue', `${totalParcelsOverview.toLocaleString()}`);
    // Update NICAD
    const nicadPct = totalParcelsOverview > 0 ? (nicadOverview / totalParcelsOverview) * 100 : 0;
    this.updateProgressBar('nicadOverviewProgress', nicadPct);
    this.updateProgressValue('nicadOverviewValue', `${nicadOverview.toLocaleString()}`);
    // Update CTASF
    const ctasfPct = totalParcelsOverview > 0 ? (ctasfOverview / totalParcelsOverview) * 100 : 0;
    this.updateProgressBar('ctasfOverviewProgress', ctasfPct);
    this.updateProgressValue('ctasfOverviewValue', `${ctasfOverview.toLocaleString()}`);
    // Update Délibérées
    const delibPct = totalParcelsOverview > 0 ? (deliberatedOverview / totalParcelsOverview) * 100 : 0;
    this.updateProgressBar('deliberatedOverviewProgress', delibPct);
    this.updateProgressValue('deliberatedOverviewValue', `${deliberatedOverview.toLocaleString()}`);
        
        // Update Processing Phases Progress using sheet data
        const proc1 = this.rawData['Processing Phase 1'] || [];
        const proc2 = this.rawData['Processing Phase 2'] || [];
        const parseNum = val => Number(String(val).replace(/\s+/g, '').replace(/,/g, '.')) || 0;
        const getNum = (arr, phase) => {
            const row = arr.find(r => (r['Phase'] === phase || r['phase'] === phase));
            return row ? parseNum(row['Total'] || row['total']) : 0;
        };
        const sumArr = arr => arr.reduce((sum, r) => sum + parseNum(r['Total'] || r['total']), 0);
        const total1 = sumArr(proc1);
        const total2 = sumArr(proc2);
    // Phase Pilote
    const pp = getNum(proc1, 'Phase Pilote');
    if(document.getElementById('phasePiloteProgress') || document.getElementById('phasePiloteValue')){
        this.updateProgressBar('phasePiloteProgress', total1 > 0 ? (pp / total1) * 100 : 0);
        this.updateProgressValue('phasePiloteValue', `${Math.round(pp).toLocaleString()} / ${Math.round(total1).toLocaleString()}`);
    }
    // QField
    const qf = getNum(proc1, 'QField');
    if(document.getElementById('qfieldProgress') || document.getElementById('qfieldValue')){
        this.updateProgressBar('qfieldProgress', total1 > 0 ? (qf / total1) * 100 : 0);
        this.updateProgressValue('qfieldValue', `${Math.round(qf).toLocaleString()} / ${Math.round(total1).toLocaleString()}`);
    }
        // Total Parcels (combined phases)
        const combinedTotal = total1 + total2;
        const combinedCurrent = total1;
    if(document.getElementById('totalParcelsProgress') || document.getElementById('totalParcelsValue')){
        this.updateProgressBar('totalParcelsProgress', combinedTotal > 0 ? (combinedCurrent / combinedTotal) * 100 : 0);
        this.updateProgressValue('totalParcelsValue', `${Math.round(combinedCurrent).toLocaleString()} / ${Math.round(combinedTotal).toLocaleString()}`);
    }
        // Phase KoboCollect
    const kc = getNum(proc2, 'Phase KoboCollect');
    if(document.getElementById('koboCollectProgress') || document.getElementById('koboCollectValue')){
        this.updateProgressBar('koboCollectProgress', total2 > 0 ? (kc / total2) * 100 : 0);
        this.updateProgressValue('koboCollectValue', `${Math.round(kc).toLocaleString()} / ${Math.round(total2).toLocaleString()}`);
    }
        
        // Update Progress Cards
        if (kpis.ctasf && typeof kpis.ctasf.rate !== 'undefined') {
            console.log('📊 CTASF Rate:', kpis.ctasf.rate + '%');
            this.updateProgressBar('ctasfRateBar', kpis.ctasf.rate);
            this.updateProgressValue('ctasfRate', `${Math.round(kpis.ctasf.rate)}%`);
        } else {
            console.warn('⚠️ CTASF KPI data is missing');
        }
        
        if (kpis.processing && typeof kpis.processing.rate !== 'undefined') {
            console.log('📊 Processing Rate:', kpis.processing.rate + '%');
            this.updateProgressBar('processingRateBar', kpis.processing.rate);
            this.updateProgressValue('processingRate', `${Math.round(kpis.processing.rate)}%`);
        } else {
            console.warn('⚠️ Processing KPI data is missing');
        }
        
        // Compute additional gauges using existing communeData
        // Sum across all communes, supporting exact French column names (with sensible fallbacks)
        const sumField = (...fields) => fields.reduce((sum, field) => {
            if (!field) return sum;
            // accept both straight and curly apostrophe variants to match sheet headers
            const altField = field.replace(/[’']/g, "'");
            const altFieldCurly = field.replace(/'/g, '’');
            return sum + commData.reduce((s, r) => {
                // try exact key, lowercased key, and alternate apostrophe forms
                const candidates = [field, field.toLowerCase(), altField, altFieldCurly];
                let v = null;
                for (const c of candidates) {
                    if (r && Object.prototype.hasOwnProperty.call(r, c) && r[c] !== '') { v = r[c]; break; }
                }
                // Also try case-insensitive lookup of keys
                if (v == null && r) {
                    const key = Object.keys(r).find(k => k && k.toLowerCase() === String(field).toLowerCase());
                    if (key) v = r[key];
                }
                const num = v != null && v !== '' ? parseNum(v) : 0;
                return s + num;
            }, 0);
        }, 0);

        // Use the exact Commune Status (Commune Analysis) columns provided by the user
        const rawParcels = sumField('Parcelles brutes', 'Raw Parcels');
        const collectedNoDup = sumField('Parcelles collectées (sans doublon géométrique)', 'Parcelles collectees (sans doublon geometrique)', 'Collected Parcels (No Duplicates)');
        const retainedAfterPost = sumField('Parcelles retenues après post-traitement', 'Parcelles retenues apres post traitement', 'Parcelles retenues après post traitement');
        // Note: the sheet may use either curly ’ or straight ' in the header; include both variants when searching
        const validatedByURM = sumField('Parcelles validées par l’URM', "Parcelles validées par l'URM", 'Validated by URM');

        // Update deduplication rate gauge (Taux de dédoublonnage)
        const dedupRate = rawParcels > 0 ? (collectedNoDup / rawParcels) * 100 : 0;
        this.updateProgressBar('dedupRateBar', dedupRate);
        this.updateProgressValue('dedupRate', `${dedupRate.toFixed(1)}%`);

        // Update post-traitement retention gauge (reuse existing surveyRateBar for retained after post-traitement)
        const retentionRate = rawParcels > 0 ? (retainedAfterPost / rawParcels) * 100 : 0;
        this.updateProgressBar('surveyRateBar', retentionRate);
        this.updateProgressValue('surveyRate', `${retentionRate.toFixed(1)}%`);

        // Update URM validation gauge
        const urmPct = rawParcels > 0 ? (validatedByURM / rawParcels) * 100 : 0;
        this.updateProgressBar('urmValidationRateBar', urmPct);
        this.updateProgressValue('urmValidationValue', `${urmPct.toFixed(1)}%`);
    console.log('✅ Progress indicators update completed');
    }
    
    /**
     * Update a progress bar element
     * @param {string} elementId - ID of the progress bar element
     * @param {number} percentage - Percentage value (0-100)
     */
    updateProgressBar(elementId, percentage) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        }
    }
    
    /**
     * Update a progress value text element
     * @param {string} elementId - ID of the value element
     * @param {string} value - Value to display
     */
    updateProgressValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
    
    /**
     * Initialize all charts
     * @param {Object} data - Raw data
     */
    async initializeCharts(data) {
        if (window.chartService) {
            await chartService.initializeCharts(data);
        }
    }
    
    /**
     * Update regional data display
     * @param {Object} data - Raw data
     */
    updateRegionalData(data) {
        const communeData = data.communeData || [];
        this.generateCommuneHeatmap(communeData);

        // Update header stat pills for Actif / En cours based on CONFIG
        try {
            const activeCount = Array.isArray(CONFIG?.COMMUNE_STATUS?.active) ? CONFIG.COMMUNE_STATUS.active.length : 0;
            const inProgressCount = Array.isArray(CONFIG?.COMMUNE_STATUS?.inProgress) ? CONFIG.COMMUNE_STATUS.inProgress.length : 0;
            document.querySelectorAll('.stat-pill').forEach(pill => {
                const label = pill.querySelector('.stat-label')?.textContent?.trim();
                const valueEl = pill.querySelector('.stat-value');
                if (!valueEl) return;
                if (label === 'Actif') valueEl.textContent = String(activeCount);
                if (label === 'En cours') valueEl.textContent = String(inProgressCount);
            });
        } catch(_) { /* no-op */ }
    }
    
    /**
     * Set up event listeners for UI controls
     */
    setupEventListeners() {
        // Region filter change
        const regionFilter = document.getElementById('regionFilter');
        if (regionFilter) {
            regionFilter.addEventListener('change', () => {
                this.currentFilters.region = regionFilter.value;
                this.refreshDashboard();
            });
        }
        
        // Time filter change
        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter) {
            timeFilter.addEventListener('change', () => {
                this.currentFilters.timeframe = timeFilter.value;
                this.refreshDashboard();
                // Refresh tables immediately on filter change
                this.populateDataTables(this.filterData(this.rawData));
            });
        }
        
        // Refresh button click
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.manualRefresh();
            });
        }
    }
    
    /**
     * Set up auto-refresh timer
     */
    setupAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        if (this.autoRefreshEnabled) {
            this.refreshInterval = setInterval(() => {
                this.refreshDashboard(true);
            }, this.autoRefreshInterval);
            
            console.log(`Auto-refresh set for every ${this.autoRefreshInterval / 60000} minutes`);
        }
    }
    
    /**
     * Manually refresh the dashboard
     */
    async manualRefresh() {
        try {
            this.showLoading(true);
            console.log('Manual refresh triggered');
            
            // Clear Google Sheets cache to get fresh data
            const googleService = window.enhancedGoogleSheetsService || window.googleSheetsService;
            if (googleService) {
                const config = googleService.getPROCASSEFConfig();
                googleService.clearCache(config.spreadsheetId);
            }
            
            await this.refreshDashboard(false);
            this.showSuccess('Données actualisées');
            
        } catch (error) {
            console.error('Error during manual refresh:', error);
            this.showError('Erreur lors de l\'actualisation');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Refresh dashboard with current filters
     * @param {boolean} isAuto - Whether this is an automatic refresh
     */
    async refreshDashboard(isAuto = false) {
        if (!this.isInitialized) return;
        
        try {
            if (!isAuto) this.showLoading(true);
            
            // Load fresh data or filter existing data
            if (isAuto) {
                // For auto-refresh, reload data from source
                await this.loadData();
            } else {
                // For filter changes, filter existing data
                const filteredData = this.filterData(this.rawData);
                
                // Always calculate KPIs with full data (not filtered) to avoid 'No live sheet data' when filters remove all relevant rows
                // Only pass current filters as parameter but use full rawData
                console.log('Calculating KPIs with full dataset and filters:', this.currentFilters);
                const kpis = dataAggregationService.calculateKPIs(this.rawData, this.currentFilters);
                
                // Log KPI calculation results to help with debugging
                console.log('KPI calculation results:', {
                    daily: kpis.daily,
                    weekly: kpis.weekly,
                    monthly: kpis.monthly,
                    quality: kpis.quality ? { rate: kpis.quality.rate } : null,
                    ctasf: kpis.ctasf ? { rate: kpis.ctasf.rate } : null,
                    processing: kpis.processing ? { rate: kpis.processing.rate } : null
                });
                
                // Update tube indicators
                if (window.tubeProgressService) {
                    // If tubes never initialized (e.g., DOM structure changed), attempt init now
                    if (!this.tubesInitialized || (window.tubeProgressService.tubes && window.tubeProgressService.tubes.size === 0)) {
                        this.initializeTubeIndicators(kpis);
                    }
                    tubeProgressService.updateTubes({
                        'dailyTube': {
                            title: 'Jour',
                            currentValue: kpis.daily.current,
                            targetValue: kpis.daily.target,
                            percentage: kpis.daily.percentage,
                            gap: kpis.daily.gap,
                            status: kpis.daily.status
                        },
                        'weeklyTube': {
                            title: 'Semaine',
                            currentValue: kpis.weekly.current,
                            targetValue: kpis.weekly.target,
                            percentage: kpis.weekly.percentage,
                            gap: kpis.weekly.gap,
                            status: kpis.weekly.status
                        },
                        'monthlyTube': {
                            title: 'Mois',
                            currentValue: kpis.monthly.current,
                            targetValue: kpis.monthly.target,
                            percentage: kpis.monthly.percentage,
                            gap: kpis.monthly.gap,
                            status: kpis.monthly.status
                        }
                    });
                } else if (window.liquidProgressService) {
                    // Fallback to legacy liquid progress
                    liquidProgressService.updateAllProgress(kpis);
                }
                
                // Update rate displays
                this.updateRateDisplays(kpis);

                // Update header trends dynamically
                this.updateHeaderTrends(this.rawData, kpis);
                
                // Update progress indicators
                this.updateProgressIndicators(kpis);
                
                // Update charts with filtered data
                if (window.chartService) {
                    await chartService.updateCharts(filteredData, kpis, this.rawData);
                }
                
                // Update regional data with filtered data
                this.updateRegionalData(filteredData);

                // Update data tables
                this.populateDataTables(filteredData);
            }
            
            // Update last refresh time
            this.updateLastRefreshTime();
            
            // Update debug panel if available
            if (window.debugPanel && typeof window.debugPanel.update === 'function') {
                window.debugPanel.update();
            }
            
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            if (!isAuto) this.showError('Erreur lors du rafraîchissement');
        } finally {
            if (!isAuto) this.showLoading(false);
        }
    }

    /**
     * Update header trend badges (Daily Yields and Quality) using KPIs and time series
     */
    updateHeaderTrends(rawData, kpis) {
        try {
            const timeframe = this.currentFilters?.timeframe || 'daily';
            const getBucketInfo = (d) => {
                if (!(d instanceof Date) || isNaN(d)) return null;
                const y = d.getFullYear();
                const m = d.getMonth();
                const day = d.getDate();
                if (timeframe === 'monthly') {
                    const start = new Date(y, m, 1);
                    return { key: `M:${y}-${String(m+1).padStart(2,'0')}`, sort: start.getTime() };
                }
                if (timeframe === 'weekly') {
                    // ISO week: Thursday-based week number
                    const tmp = new Date(d);
                    tmp.setHours(0,0,0,0);
                    // Thursday in current week decides the year
                    tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
                    const isoYear = tmp.getFullYear();
                    const yearStart = new Date(isoYear, 0, 1);
                    const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
                    // Start of ISO week (Monday)
                    const mon = new Date(d);
                    const dayIdx = (mon.getDay() + 6) % 7; // 0=Mon
                    mon.setDate(mon.getDate() - dayIdx);
                    mon.setHours(0,0,0,0);
                    return { key: `W:${isoYear}-W${String(week).padStart(2,'0')}`, sort: mon.getTime() };
                }
                // daily default
                const start = new Date(y, m, day);
                start.setHours(0,0,0,0);
                return { key: `D:${start.toISOString().slice(0,10)}`, sort: start.getTime() };
            };
            const fromMapToSortedBuckets = (map) => {
                return Array.from(map.entries())
                    .map(([key, val]) => val)
                    .filter(v => (v.sum ?? v.value ?? 0) > 0)
                    .sort((a,b)=> a.sort - b.sort);
            };
            // Daily yields: compute % change vs previous period (yesterday or previous day with data)
            let yieldsSeries = [];
            try {
                yieldsSeries = dataService.getTimeSeriesData(
                    rawData,
                    'Yields Projections',
                    'Date',
                    'Nombre de levées'
                ) || [];
            } catch(_) {}
            if (Array.isArray(yieldsSeries) && yieldsSeries.length) {
                const buckets = new Map(); // key -> {sum, sort}
                yieldsSeries.forEach(p => {
                    const d = dataAggregationService.parseDate(p.date);
                    const info = getBucketInfo(d);
                    if (!info) return;
                    const cur = buckets.get(info.key) || { sum: 0, sort: info.sort };
                    cur.sum += Number(p.value || 0);
                    cur.sort = info.sort; buckets.set(info.key, cur);
                });
                const arr = fromMapToSortedBuckets(buckets);
                if (arr.length >= 2) {
                    const prev = arr[arr.length-2].sum;
                    const last = arr[arr.length-1].sum;
                    const change = prev === 0 ? (last>0 ? 100 : 0) : ((last - prev)/prev)*100;
                    this._setTrend('dailyYieldsTrend', 'dailyYieldsTrendIcon', 'dailyYieldsTrendValue', change);
                }
            }

            // Quality trend: use kpis.quality.changePct when available; otherwise compute from display time series
            let qChange = (kpis?.quality?.changePct);
            if (typeof qChange !== 'number' || isNaN(qChange)) {
                try {
                    const display = rawData['Public Display Follow-up'] || [];
                    const byDate = new Map();
                    display.forEach(r => {
                        const d = dataAggregationService.parseDate(r['Date']);
                        if (!d) return;
                        const key = d.toISOString().slice(0,10);
                        const ok = dataAggregationService._getNumericField ? dataAggregationService._getNumericField(r, ['Nombre de parcelles affichées sans erreurs']) : Number(r['Nombre de parcelles affichées sans erreurs']||0);
                        const ko = dataAggregationService._getNumericField ? dataAggregationService._getNumericField(r, ['Nombre Parcelles avec erreur']) : Number(r['Nombre Parcelles avec erreur']||0);
                        const cur = byDate.get(key) || {ok:0,ko:0};
                        cur.ok += ok; cur.ko += ko; byDate.set(key, cur);
                    });
                    // Bucket by timeframe
                    const buckets = new Map(); // key -> {ok, ko, sort}
                    Array.from(byDate.entries()).forEach(([iso, val]) => {
                        const d = new Date(iso);
                        const info = getBucketInfo(d);
                        if (!info) return;
                        const cur = buckets.get(info.key) || { ok:0, ko:0, sort: info.sort };
                        cur.ok += val.ok; cur.ko += val.ko; cur.sort = info.sort; buckets.set(info.key, cur);
                    });
                    const arr = Array.from(buckets.values())
                        .map(v => ({ pct: (v.ok+v.ko)>0 ? (v.ok/(v.ok+v.ko))*100 : 0, sort: v.sort }))
                        .filter(v => v.pct>0 || timeframe!=='daily') // allow 0 in weekly/monthly if needed
                        .sort((a,b)=> a.sort - b.sort);
                    if (arr.length >= 2) {
                        const qa = arr[arr.length-2].pct;
                        const qb = arr[arr.length-1].pct;
                        qChange = qa === 0 ? (qb>0 ? 100 : 0) : ((qb - qa) / qa) * 100;
                    }
                } catch(_) {}
            }
            if (typeof qChange === 'number' && !isNaN(qChange)) {
                this._setTrend('qualityTrendHeader', 'qualityTrendIcon', 'qualityTrendValue', qChange);
            }

            // CTASF trend: use 'Nombre parcelles retenues CTASF' last vs previous
            try {
                const ctasf = rawData['CTASF Follow-up'] || [];
                const byDate = new Map();
                const getNum = (r, keys) => {
                    if (dataAggregationService && dataAggregationService._getNumericField) return dataAggregationService._getNumericField(r, keys);
                    for (const k of keys) { const v = r[k]; const n = Number(String(v).replace(/\s+/g,'').replace(/,/g,'.')); if (!isNaN(n)) return n; }
                    return 0;
                };
                ctasf.forEach(r => {
                    const d = dataAggregationService.parseDate(r['Date']);
                    if (!d) return;
                    const key = d.toISOString().slice(0,10);
                    const retenues = getNum(r, ['Nombre parcelles retenues CTASF']);
                    const cur = byDate.get(key) || 0; byDate.set(key, cur + retenues);
                });
                // Bucket by timeframe
                const buckets = new Map(); // key -> {sum, sort}
                Array.from(byDate.entries()).forEach(([iso, val]) => {
                    const d = new Date(iso);
                    const info = getBucketInfo(d);
                    if (!info) return;
                    const cur = buckets.get(info.key) || { sum:0, sort: info.sort };
                    cur.sum += val; cur.sort = info.sort; buckets.set(info.key, cur);
                });
                const arr = fromMapToSortedBuckets(buckets);
                if (arr.length >= 2) {
                    const prev = arr[arr.length-2].sum;
                    const last = arr[arr.length-1].sum;
                    const change = prev === 0 ? (last>0 ? 100 : 0) : ((last - prev)/prev)*100;
                    this._setTrend('ctasfTrendHeader', 'ctasfTrendIcon', 'ctasfTrendValue', change);
                }
            } catch(_) {}

            // Post-Processing trend: use 'Parcelles post traitées (Sans Doublons et topoplogie correcte)' last vs previous
            try {
                const post = rawData['Post Process Follow-up'] || [];
                const byDate = new Map();
                const getNum = (r, keys) => {
                    if (dataAggregationService && dataAggregationService._getNumericField) return dataAggregationService._getNumericField(r, keys);
                    for (const k of keys) { const v = r[k]; const n = Number(String(v).replace(/\s+/g,'').replace(/,/g,'.')); if (!isNaN(n)) return n; }
                    return 0;
                };
                post.forEach(r => {
                    const d = dataAggregationService.parseDate(r['Date']);
                    if (!d) return;
                    const key = d.toISOString().slice(0,10);
                    const processed = getNum(r, ['Parcelles post traitées (Sans Doublons et topoplogie correcte)']);
                    const cur = byDate.get(key) || 0; byDate.set(key, cur + processed);
                });
                // Bucket by timeframe
                const buckets = new Map(); // key -> {sum, sort}
                Array.from(byDate.entries()).forEach(([iso, val]) => {
                    const d = new Date(iso);
                    const info = getBucketInfo(d);
                    if (!info) return;
                    const cur = buckets.get(info.key) || { sum:0, sort: info.sort };
                    cur.sum += val; cur.sort = info.sort; buckets.set(info.key, cur);
                });
                const arr = fromMapToSortedBuckets(buckets);
                if (arr.length >= 2) {
                    const prev = arr[arr.length-2].sum;
                    const last = arr[arr.length-1].sum;
                    const change = prev === 0 ? (last>0 ? 100 : 0) : ((last - prev)/prev)*100;
                    this._setTrend('postProcTrendHeader', 'postProcTrendIcon', 'postProcTrendValue', change);
                }
            } catch(_) {}
        } catch (e) {
            console.warn('Failed to update header trends:', e);
        }
    }

    _setTrend(containerId, iconId, valueId, changePct) {
        const container = document.getElementById(containerId);
        const icon = document.getElementById(iconId);
        const valueEl = document.getElementById(valueId);
        if (!container || !icon || !valueEl) return;
        const val = (changePct || 0);
        const isUp = val > 0; const isDown = val < 0;
        container.classList.remove('positive','negative');
        if (isUp) container.classList.add('positive');
        if (isDown) container.classList.add('negative');
        icon.className = `fas ${isUp ? 'fa-arrow-up' : (isDown ? 'fa-arrow-down' : 'fa-minus')}`;
        valueEl.textContent = `${(Math.abs(val)).toFixed(1)}%`;
    }
    
    /**
     * Filter data based on current filters
     * @param {Object} data - Raw data
     * @returns {Object} - Filtered data
     */
    filterData(data) {
        if (!data) return {};
        
        // Create a copy of the data
        const filteredData = {...data};
        
        // Apply filters to each relevant dataset
        Object.keys(filteredData).forEach(key => {
            const arr = filteredData[key];
            if (Array.isArray(arr)) {
                const beforeLen = arr.length;
                const after = dataAggregationService.applyFilters(arr, this.currentFilters, key);
                // Avoid completely wiping dataset for charts: if after filtering it's empty but before had data, keep original
                filteredData[key] = (beforeLen > 0 && after.length === 0) ? arr : after;
            }
        });
        
        return filteredData;
    }

    /**
     * Populate detailed data tables for all sections
     */
    populateDataTables(data) {
        if (!data) return;

        // Helper to safely get a field by multiple header candidates (French first)
        const get = (row, candidates = []) => {
            for (const c of candidates) {
                if (c in row && row[c] !== '') return row[c];
                const k = Object.keys(row).find(k => k && k.toLowerCase() === String(c).toLowerCase());
                if (k && row[k] !== '') return row[k];
            }
            return '';
        };

        const fmtDMY = (val) => {
            try {
                if (window.dataAggregationService) {
                    const d = dataAggregationService.parseDate(val);
                    return d ? d.toLocaleDateString('fr-FR') : String(val || '');
                }
            } catch(_) {}
            return UTILS.formatDate(val);
        };

        // Yields table
        try {
            const tbody = document.getElementById('yieldsTableBody');
            if (tbody) {
                const rows = (data['Yields Projections'] || []).slice(0, 200);
                tbody.innerHTML = '';
                rows.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${fmtDMY(get(r, ['Date','date']))}</td>
                        <td>${get(r, ['Région','Region','region'])}</td>
                        <td>${get(r, ['Commune','commune'])}</td>
                        <td>${get(r, ['Nombre de levées','Nombre de Levees','Nombre de levees','levées','levees'])}</td>
                        <td></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch(e) { console.warn('Yields table render error', e); }

        // Public Display Follow-up table
        try {
            const tbody = document.getElementById('displayTableBody');
            if (tbody) {
                const rows = (data['Public Display Follow-up'] || []).slice(0, 200);
                tbody.innerHTML = '';
                rows.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${fmtDMY(get(r, ['Date','date']))}</td>
                        <td>${get(r, ['Région','Region','region'])}</td>
                        <td>${get(r, ['Commune','commune'])}</td>
                        <td>${get(r, ['Nombre de parcelles affichées sans erreurs'])}</td>
                        <td>${get(r, ['Nombre Parcelles avec erreur'])}</td>
                        <td>${get(r, ['Motif retour','Motif'])}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch(e) { console.warn('Display table render error', e); }

        // CTASF Follow-up table
        try {
            const tbody = document.getElementById('ctasfTableBody');
            if (tbody) {
                const rows = (data['CTASF Follow-up'] || []).slice(0, 200);
                tbody.innerHTML = '';
                rows.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${fmtDMY(get(r, ['Date','date']))}</td>
                        <td>${get(r, ['Région','Region','region'])}</td>
                        <td>${get(r, ['Commune','commune'])}</td>
                        <td>${get(r, ['Nombre parcelles emmenées au CTASF'])}</td>
                        <td>${get(r, ['Nombre parcelles retenues CTASF'])}</td>
                        <td>${get(r, ['Nombre parcelles à délibérer','Nombre parcelles a deliberer'])}</td>
                        <td>${get(r, ['Nombre parcelles délibérées','Nombre parcelles deliberees'])}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch(e) { console.warn('CTASF table render error', e); }

        // Post Process Follow-up table
        try {
            const tbody = document.getElementById('processingTableBody');
            if (tbody) {
                const rows = (data['Post Process Follow-up'] || []).slice(0, 200);
                tbody.innerHTML = '';
                rows.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${fmtDMY(get(r, ['Date','date']))}</td>
                        <td>${get(r, ['Région','Region','region'])}</td>
                        <td>${get(r, ['Commune','commune'])}</td>
                        <td>${get(r, ['Parcelles reçues (Brutes)','Parcelles recues (Brutes)','Parcelles reçues'])}</td>
                        <td>${get(r, ['Parcelles post traitées (Sans Doublons et topoplogie correcte)','Parcelles post traitees'])}</td>
                        <td>${get(r, ['Parcelles individuelles Jointes'])}</td>
                        <td>${get(r, ['Parcelles collectives Jointes'])}</td>
                        <td>${get(r, ['Parcelles sans jointure'])}</td>
                        <td>${get(r, ['Parcelles retournées aux topos','Parcelles retournees aux topos'])}</td>
                        <td>${get(r, ['Geomaticien','Géomaticien'])}</td>
                        <td>${get(r, ['Motif'])}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch(e) { console.warn('Processing table render error', e); }
    }
    
    /**
     * Update quality rate display
     * @param {number} rate - Quality rate percentage
     */
    updateQualityRate(rate) {
        const qualityElement = document.getElementById('qualityRate');
        if (qualityElement) {
            qualityElement.textContent = `${rate}%`;
            
            // Update color based on rate
            if (rate >= 90) {
                qualityElement.className = 'text-2xl font-bold text-green-600';
            } else if (rate >= 75) {
                qualityElement.className = 'text-2xl font-bold text-blue-600';
            } else if (rate >= 60) {
                qualityElement.className = 'text-2xl font-bold text-yellow-500';
            } else {
                qualityElement.className = 'text-2xl font-bold text-red-600';
            }
        }
    }
    
    /**
     * Update CTASF rate display
     * @param {number} rate - CTASF rate percentage
     */
    updateCTASFRate(rate) {
        const ctasfRateElement = document.getElementById('ctasfRate');
        if (ctasfRateElement) {
            ctasfRateElement.textContent = `${rate}%`;
            
            // Update color based on rate
            if (rate >= 90) {
                ctasfRateElement.className = 'text-2xl font-bold text-green-600';
            } else if (rate >= 75) {
                ctasfRateElement.className = 'text-2xl font-bold text-blue-600';
            } else if (rate >= 60) {
                ctasfRateElement.className = 'text-2xl font-bold text-yellow-500';
            } else {
                ctasfRateElement.className = 'text-2xl font-bold text-red-600';
            }
        }
    }
    
    /**
     * Handle real-time data update 
     * This method can be called with new data to update the dashboard without a full reload
     * @param {Object} newData - New data to update the dashboard with
     * @param {boolean} isPartialUpdate - Whether this is a partial update (true) or full data refresh (false)
     */
    handleRealTimeUpdate(newData, isPartialUpdate = true) {
        try {
            if (!newData) {
                console.warn('No data provided for real-time update');
                return false;
            }
            
            console.log('Processing real-time data update...');
            
            // For partial updates, merge with existing data
            let updatedData = newData;
            if (isPartialUpdate && this.rawData) {
                updatedData = this._mergeData(this.rawData, newData);
            } else {
                // For full data replacement
                this.rawData = newData;
            }
            
            // Mark data as streaming update for optimized chart rendering
            updatedData.streamingUpdate = true;
            
            // Apply current filters
            const filteredData = this.applyFilters(updatedData);
            
            // Compute KPIs with updated data
            let kpis = {};
            if (window.dataAggregationService) {
                kpis = dataAggregationService.computeMainKPIs(filteredData);
                
                // Update KPI displays
                if (kpis.qualityScore !== undefined) {
                    this.updateQualityRate(kpis.qualityScore);
                }
                if (kpis.ctasfRate !== undefined) {
                    this.updateCTASFRate(kpis.ctasfRate);
                }
            }
            
            // Update tube progress indicators
            if (window.tubeProgressService) {
                tubeProgressService.updateTubes({
                    'dailyTube': {
                        currentValue: kpis.dailyCompletion || 0,
                        targetValue: kpis.dailyTarget || 100,
                        percentage: kpis.dailyCompletionRate || 0
                    },
                    'weeklyTube': {
                        currentValue: kpis.weeklyCompletion || 0,
                        targetValue: kpis.weeklyTarget || 500,
                        percentage: kpis.weeklyCompletionRate || 0
                    },
                    'monthlyTube': {
                        currentValue: kpis.monthlyCompletion || 0,
                        targetValue: kpis.monthlyTarget || 2000,
                        percentage: kpis.monthlyCompletionRate || 0
                    }
                });
            }
            
            // Update charts with streaming data
            if (window.chartService) {
                chartService.updateCharts(filteredData, kpis, updatedData);
            }
            
            // Update last refresh time
            this.updateLastRefreshTime();
            
            console.log('Real-time update completed successfully');
            return true;
        } catch (error) {
            console.error('Error processing real-time update:', error);
            return false;
        }
    }
    
    /**
     * Helper method to merge new data with existing data
     * @private
     * @param {Object} existingData - Existing dashboard data
     * @param {Object} newData - New data to merge
     * @returns {Object} - Merged data object
     */
    _mergeData(existingData, newData) {
        if (!existingData) return newData;
        if (!newData) return existingData;
        
        const result = { ...existingData };
        
        // Merge arrays from each sheet
        Object.keys(newData).forEach(key => {
            const newSheet = newData[key];
            
            // If we have a new array for a sheet
            if (Array.isArray(newSheet)) {
                const existingSheet = result[key];
                
                // If we don't have this sheet yet, just use the new data
                if (!existingSheet || !Array.isArray(existingSheet)) {
                    result[key] = newSheet;
                    return;
                }
                
                // For existing sheets, we need to merge items
                // First build a map of existing items by ID or other unique field
                const idField = this._getSheetIdField(key);
                const existingMap = new Map();
                
                existingSheet.forEach((item, index) => {
                    // Use the ID field if available, otherwise position index
                    const itemId = idField && item[idField] ? item[idField] : `index_${index}`;
                    existingMap.set(itemId, item);
                });
                
                // Update existing items and add new ones
                newSheet.forEach(newItem => {
                    if (!newItem) return;
                    
                    const itemId = idField && newItem[idField] ? newItem[idField] : null;
                    
                    if (itemId && existingMap.has(itemId)) {
                        // Update existing item
                        const existingItem = existingMap.get(itemId);
                        Object.assign(existingItem, newItem);
                    } else {
                        // Add new item
                        existingSheet.push(newItem);
                    }
                });
            } else if (typeof newSheet === 'object' && newSheet !== null) {
                // For non-array objects, do a shallow merge
                result[key] = { ...(result[key] || {}), ...newSheet };
            } else {
                // For primitive values, just replace
                result[key] = newSheet;
            }
        });
        
        return result;
    }
    
    /**
     * Helper to determine the ID field for a given sheet
     * @private
     * @param {string} sheetName - Name of the sheet
     * @returns {string|null} - Name of the ID field, or null if not identified
     */
    _getSheetIdField(sheetName) {
        const normalizedName = String(sheetName).toLowerCase();
        
        // Map common sheet names to their ID fields
        if (normalizedName.includes('daily') || normalizedName.includes('quotidien')) return 'Date';
        if (normalizedName.includes('parcels') || normalizedName.includes('parcelle')) return 'ParcelID';
        if (normalizedName.includes('geomatician') || normalizedName.includes('geometre')) return 'GeomaticianID';
        if (normalizedName.includes('commune')) return 'CommuneID';
        if (normalizedName.includes('region')) return 'RegionName';
        
        // Default ID fields to try
        const commonIdFields = ['ID', 'Id', 'id', '_id', 'UUID', 'Uuid', 'uuid'];
        
        return null; // If no specific mapping, let the caller use index
    }
    
    /**
     * Update CTASF rate display
     * @param {number} rate - The CTASF rate percentage
     */
    updateCtasfRateDisplay(rate) {
        const ctasfRateElement = document.getElementById('ctasfRate');
        const ctasfRateBarElement = document.getElementById('ctasfRateBar');
        
        if (ctasfRateElement) {
            ctasfRateElement.textContent = `${rate}%`;
        }
        
        if (ctasfRateBarElement) {
            ctasfRateBarElement.style.width = `${rate}%`;
            
            // Update color based on rate
            if (rate >= 90) {
                ctasfRateBarElement.className = 'bg-green-500 h-2 rounded-full';
            } else if (rate >= 75) {
                ctasfRateBarElement.className = 'bg-blue-500 h-2 rounded-full';
            } else if (rate >= 60) {
                ctasfRateBarElement.className = 'bg-yellow-500 h-2 rounded-full';
            } else {
                ctasfRateBarElement.className = 'bg-red-500 h-2 rounded-full';
            }
        }
    }
    
    /**
     * Update processing rate display
     * @param {number} rate - Processing rate percentage
     */
    updateProcessingRate(rate) {
        const processingRateElement = document.getElementById('processingRate');
        const processingRateBarElement = document.getElementById('processingRateBar');
        
        if (processingRateElement) {
            processingRateElement.textContent = `${rate}%`;
        }
        
        if (processingRateBarElement) {
            processingRateBarElement.style.width = `${rate}%`;
            
            // Update color based on rate
            if (rate >= 90) {
                processingRateBarElement.className = 'bg-green-500 h-2 rounded-full';
            } else if (rate >= 75) {
                processingRateBarElement.className = 'bg-blue-500 h-2 rounded-full';
            } else if (rate >= 60) {
                processingRateBarElement.className = 'bg-yellow-500 h-2 rounded-full';
            } else {
                processingRateBarElement.className = 'bg-red-500 h-2 rounded-full';
            }
        }
    }

    /**
     * Update / inject a small trend badge near a metric element
     * @param {string} baseId - base element id (e.g., 'qualityRate')
     * @param {number} changePct - percentage change (can be positive/negative)
     * @param {boolean} isInline - whether to render inline (for progress headers)
     */
    updateTrendBadge(baseId, changePct, isInline = false) {
        if (typeof changePct !== 'number' || isNaN(changePct)) return;
        const target = document.getElementById(baseId);
        if (!target) return;

        // Find or create container
        let container = target.parentElement.querySelector('.trend-badge-container');
        if (!container) {
            container = document.createElement('div');
            container.className = isInline ? 'trend-badge-container inline-flex items-center ml-2' : 'trend-badge-container mt-2';
            if (isInline) {
                target.parentElement.classList.add('flex','items-center','gap-2');
                target.insertAdjacentElement('afterend', container);
            } else {
                target.parentElement.appendChild(container);
            }
        }
        container.innerHTML = '';

        const badge = document.createElement('span');
        const direction = changePct > 0 ? 'up' : (changePct < 0 ? 'down' : 'flat');
        const absVal = Math.abs(changePct).toFixed(1);
        let colorClass = 'bg-gray-200 text-gray-700';
        if (direction === 'up') colorClass = 'bg-green-100 text-green-700';
        else if (direction === 'down') colorClass = 'bg-red-100 text-red-700';
        badge.className = `trend-badge ${colorClass} px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 animate-scale-in`;
        badge.innerHTML = direction === 'flat'
            ? '<i class="fas fa-minus text-[10px]"></i><span>0%</span>'
            : `<i class="fas fa-arrow-${direction === 'up' ? 'up' : 'down'} text-[10px]"></i><span>${direction === 'down' ? '-' : '+'}${absVal}%</span>`;
        container.appendChild(badge);
    }
    
    /**
     * Generate commune heatmap
     * @param {Array} data - Commune data
     */
    generateCommuneHeatmap(data) {
        const communeListElement = document.getElementById('communePerformanceList');
        if (!communeListElement || !Array.isArray(data)) return;
        
        // Clear existing content
        communeListElement.innerHTML = '';
        
        // Group by commune
        const communeGroups = {};
        data.forEach(item => {
            const commune = item.Commune || 'Unknown';
            const region = item.Region || 'Unknown';
            
            if (!communeGroups[commune]) {
                communeGroups[commune] = {
                    region,
                    total: Number(item['Total Parcels'] || 0),
                    nicad: Number(item['NICAD'] || 0),
                    nicadPercent: Number(item['NICAD %'] || 0),
                    ctasf: Number(item['CTASF'] || 0),
                    ctasfPercent: Number(item['CTASF %'] || 0),
                    deliberated: Number(item['Deliberated'] || 0),
                    deliberatedPercent: Number(item['Deliberated %'] || 0)
                };
            }
        });
        
        // Create commune items
        Object.entries(communeGroups).forEach(([commune, data]) => {
            const communeItem = document.createElement('div');
            communeItem.className = 'commune-performance-item';
            communeItem.innerHTML = `
                <div class="flex justify-between mb-1">
                    <h4 class="font-medium text-gray-800">${commune}</h4>
                    <span class="text-sm text-gray-500">${data.region}</span>
                </div>
                <div class="space-y-2">
                    <div>
                        <div class="flex justify-between text-xs mb-1">
                            <span>NICAD</span>
                            <span>${data.nicadPercent.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-500 h-2 rounded-full" style="width: ${data.nicadPercent}%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs mb-1">
                            <span>CTASF</span>
                            <span>${data.ctasfPercent.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-orange-500 h-2 rounded-full" style="width: ${data.ctasfPercent}%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs mb-1">
                            <span>Délibéré</span>
                            <span>${data.deliberatedPercent.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full" style="width: ${data.deliberatedPercent}%"></div>
                        </div>
                    </div>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    Total: ${data.total.toLocaleString()} parcelles
                </div>
            `;
            
            communeListElement.appendChild(communeItem);
        });
    }
    
    /**
     * Update last refresh time display
     */
    updateLastRefreshTime() {
        const lastUpdateElement = document.getElementById('lastUpdateTime');
        if (lastUpdateElement) {
            const now = new Date();
            const formattedDate = now.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            const formattedTime = now.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            lastUpdateElement.textContent = `${formattedDate}, ${formattedTime}`;
            
            // Add debug button next to last update time if not already there
            if (!document.getElementById('debugButton')) {
                const debugButton = document.createElement('button');
                debugButton.id = 'debugButton';
                debugButton.innerHTML = '🔍';
                debugButton.title = 'Afficher le panneau de diagnostic';
                debugButton.className = 'ml-2 text-xs bg-gray-200 hover:bg-gray-300 rounded px-1';
                debugButton.addEventListener('click', () => {
                    if (window.debugPanel) window.debugPanel.show();
                });
                lastUpdateElement.parentNode.appendChild(debugButton);
            }
        }
    }
    
    /**
     * Show loading indicator
     * @param {boolean} show - Whether to show or hide
     */
    showLoading(show) {
        const loadingElement = document.getElementById('loadingOverlay');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        } else {
            console.error('Loading overlay element not found');
        }
    }
    
    /**
     * Show success message
     * @param {string} message - Message to display
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    /**
     * Show error message
     * @param {string} message - Message to display
     */
    showError(message) {
        this.showToast(message, 'error');
    }
    
    /**
     * Show warning message
     * @param {string} message - Message to display
     */
    showWarning(message) {
        this.showToast(message, 'warning');
    }
    
    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', or 'warning'
     * @param {number} duration - Duration in milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        // Check if toast container exists, create if not
        let toastContainer = document.getElementById('toastContainer');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'fixed bottom-4 right-4 z-50 space-y-2';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'px-4 py-2 rounded shadow-lg transition-all duration-300 transform translate-y-2 opacity-0';
        
        // Set color based on type
        switch (type) {
            case 'success':
                toast.classList.add('bg-green-500', 'text-white');
                break;
            case 'error':
                toast.classList.add('bg-red-500', 'text-white');
                break;
            case 'warning':
                toast.classList.add('bg-yellow-500', 'text-white');
                break;
            default:
                toast.classList.add('bg-blue-500', 'text-white');
        }
        
        // Set message
        toast.textContent = message;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Show toast (with animation)
        setTimeout(() => {
            toast.classList.replace('opacity-0', 'opacity-100');
            toast.classList.replace('translate-y-2', 'translate-y-0');
        }, 10);
        
        // Auto-hide toast
        setTimeout(() => {
            toast.classList.replace('opacity-100', 'opacity-0');
            toast.classList.replace('translate-y-0', 'translate-y-2');
            
            // Remove after animation
            setTimeout(() => {
                if (toast.parentNode === toastContainer) {
                    toastContainer.removeChild(toast);
                }
                
                // Remove container if empty
                if (toastContainer.children.length === 0) {
                    document.body.removeChild(toastContainer);
                }
            }, 300);
        }, duration);
    }
}

// Dashboard initialization is now handled in index.html
// No automatic initialization here to avoid duplication

// Make EnhancedDashboard available globally
window.EnhancedDashboard = EnhancedDashboard;
