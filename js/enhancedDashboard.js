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
            console.log('KPIs calculated:', kpis);
            
            // Initialize tube progress indicators
            this.initializeTubeIndicators(kpis);
            
            // Update quality and other rate displays
            this.updateRateDisplays(kpis);
            
            // Initialize charts
            await this.initializeCharts(this.rawData, kpis);
            
            // Update regional data
            this.updateRegionalData(this.rawData);
            
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
                tubesToInitialize.monthlyTube = {
                    title: 'Mois',
                    currentValue: kpis.monthly.current,
                    targetValue: kpis.monthly.target,
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
                
                // Update charts with filtered data
                if (window.chartService) {
                    await chartService.updateCharts(filteredData, kpis, this.rawData);
                }
                
                // Update regional data with filtered data
                this.updateRegionalData(filteredData);
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
