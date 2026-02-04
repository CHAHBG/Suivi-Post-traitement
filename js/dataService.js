// Data Service for fetching and processing data from Google Sheets
// Optimized for performance with stale-while-revalidate caching

class DataService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 3 * 60 * 1000; // 3 minutes - shorter for fresher data
        this.staleMaxAge = 10 * 60 * 1000; // 10 minutes max stale age
        this.pendingRequests = new Map(); // Prevent duplicate concurrent requests
        this.backgroundRefreshes = new Set();
    }

    // Fetch data from Google Sheets with stale-while-revalidate
    async fetchCSV(url, forceRefresh = false) {
        try {
            // Check cache first (unless force refresh)
            if (!forceRefresh && this.cache.has(url)) {
                const cached = this.cache.get(url);
                const age = Date.now() - cached.timestamp;
                
                // Fresh cache - return immediately
                if (age < this.cacheExpiry) {
                    return cached.data;
                }
                
                // Stale but usable - return and refresh in background
                if (age < this.staleMaxAge) {
                    this._backgroundRefresh(url);
                    return cached.data;
                }
            }

            // Check for pending request to same URL (deduplication)
            if (this.pendingRequests.has(url)) {
                return this.pendingRequests.get(url);
            }

            // Create request promise
            const requestPromise = (async () => {
                // Add timeout to fetch (8 seconds - reduced for faster failure)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                
                try {
                    const response = await fetch(url, { 
                        signal: controller.signal,
                        cache: 'no-store' // Bypass browser cache for fresh data
                    });
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.status}`);
                    }

                    const csvText = await response.text();
                    const data = UTILS.parseCSV(csvText);

                    // Update cache
                    this.cache.set(url, {
                        data,
                        timestamp: Date.now()
                    });

                    return data;
                } finally {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(url);
                }
            })();

            // Store pending request
            this.pendingRequests.set(url, requestPromise);
            
            return requestPromise;
        } catch (error) {
            this.pendingRequests.delete(url);
            throw error;
        }
    }

    // Background refresh for stale-while-revalidate
    async _backgroundRefresh(url) {
        if (this.backgroundRefreshes.has(url)) return;
        
        this.backgroundRefreshes.add(url);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(url, { 
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const csvText = await response.text();
                const data = UTILS.parseCSV(csvText);
                this.cache.set(url, { data, timestamp: Date.now() });
            }
        } catch (e) {
            // Silent fail - stale data is still being used
        } finally {
            this.backgroundRefreshes.delete(url);
        }
    }

    // Clear all cached data
    clearCache() {
        this.cache.clear();
        this.backgroundRefreshes.clear();
    }

    // Fetch all needed data in parallel
    async getAllData(forceRefresh = false) {
        // Clear cache if force refresh
        if (forceRefresh) {
            this.clearCache();
        }

        const errors = [];
        const data = {};
        const fetchPromises = [];
        // Preserve the canonical sheet names in the same order as fetchPromises
        const sheetNames = [];

        // Add main sheets to fetch
        for (const [key, sheet] of Object.entries(GOOGLE_SHEETS)) {
            // Use the explicit configured name when available, otherwise fallback to the config key
            sheetNames.push(sheet.name || key);
            fetchPromises.push(this.fetchCSV(sheet.url, forceRefresh));
        }

        // Add monitoring sheets to fetch
        for (const [key, sheet] of Object.entries(MONITORING_SHEETS)) {
            sheetNames.push(sheet.name || key);
            fetchPromises.push(this.fetchCSV(sheet.url, forceRefresh));
        }

        // Wait for all fetches to complete with Promise.allSettled for resilience
        const results = await Promise.allSettled(fetchPromises);

        // Map results to data object with proper names
        results.forEach((result, index) => {
            const sheetName = sheetNames[index] || `sheet_${index}`;
            if (result.status === 'fulfilled') {
                data[sheetName] = result.value;
            } else {
                errors.push({ sheet: sheetName, error: result.reason });
                data[sheetName] = [];
            }
            // Debug: show how many rows were returned for each sheet
            try {
                // console.info(`Sheet loaded: ${sheetName} -> ${Array.isArray(data[sheetName]) ? data[sheetName].length : 0} rows`);
            } catch (e) {
                // ignore
            }
        });

        return { data, errors };
    }

    // Calculate KPIs for dashboard
    // KPI calculation is now handled by DataAggregationService

    // Get week dates (last 7 days)
    getWeekDates() {
        const dates = [];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(date.toISOString().slice(0, 10));
        }

        return dates;
    }

    // Get time series data (aggregated by day)
    getTimeSeriesData(rawData, sheetName, dateColumn, valueColumns) {
        try {
            const data = rawData[sheetName] || [];
            if (!data.length) return [];

            // If valueColumns is a string, convert to array
            const columns = Array.isArray(valueColumns) ? valueColumns : [valueColumns];

            // Centralized date parsing
            const parseDate = (dateStr) => {
                if (dateStr === undefined || dateStr === null || dateStr === '') return null;
                if (dateStr instanceof Date && !isNaN(dateStr)) return dateStr;
                // Excel serial (approx range)
                if (!isNaN(dateStr) && Number(dateStr) > 40000 && Number(dateStr) < 60000) {
                    return new Date((Number(dateStr) - 25569) * 86400 * 1000);
                }
                // Prefer DataAggregationService for consistent parsing
                try {
                    if (window.dataAggregationService && typeof window.dataAggregationService.parseDate === 'function') {
                        const d = window.dataAggregationService.parseDate(dateStr);
                        if (d) return d;
                    }
                } catch (_) { }
                // Fallback: basic DMY parser
                const cleaned = String(dateStr).trim();
                // Only trust native Date for true ISO
                if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
                    const iso = new Date(cleaned);
                    if (!isNaN(iso)) return iso;
                }
                const m = /^([0-3]?\d)[/.-]([01]?\d)[/.-](\d{2,4})$/.exec(cleaned);
                if (m) {
                    let d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
                    if (y < 100) y = 2000 + y; // 2-digit year -> 20xx
                    const dt = new Date(y, mo - 1, d);
                    return isNaN(dt) ? null : dt;
                }
                return null;
            };

            const toNumber = (val) => {
                if (val === undefined || val === null || val === '') return 0;
                if (typeof val === 'number') return isNaN(val) ? 0 : val;
                const s = String(val).trim().replace(/\u00A0/g, ' ').replace(/\s+/g, '');
                // Replace French decimal comma
                const normalized = s.replace(/,/g, '.').replace(/[^0-9.+-]/g, '');
                const n = parseFloat(normalized);
                return isNaN(n) ? 0 : n;
            };

            // Group by date if single value column (aggregate multiple rows same date)
            if (columns.length === 1) {
                const byDate = new Map();
                const rawDateSet = new Set();
                data.forEach(row => {
                    const rawVal = row[dateColumn];
                    rawDateSet.add(rawVal);
                    const dateObj = parseDate(rawVal);
                    if (!dateObj) return;
                    const key = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
                    const val = parseFloat(row[columns[0]]) || 0;
                    if (!byDate.has(key)) byDate.set(key, 0);
                    byDate.set(key, byDate.get(key) + val);
                });
                if (sheetName.toLowerCase().includes('yield')) {
                    try {
                        // console.debug('[TimeSeriesDebug] Distinct raw dates in', sheetName, Array.from(rawDateSet));
                        // console.debug('[TimeSeriesDebug] Parsed date keys', Array.from(byDate.keys()));
                    } catch (e) { }
                }
                const result = Array.from(byDate.entries()).map(([k, v]) => ({
                    date: k, // keep as ISO string for stable label / sorting
                    value: v
                })).sort((a, b) => a.date.localeCompare(b.date));
                return result;
            } else {
                // Multiple value columns: aggregate by date (sum per day per column)
                const byDate = new Map();
                data.forEach(row => {
                    const dateObj = parseDate(row[dateColumn]);
                    if (!dateObj) return;
                    const key = dateObj.toISOString().split('T')[0];
                    if (!byDate.has(key)) {
                        const init = { date: key };
                        columns.forEach(col => { init[col] = 0; });
                        byDate.set(key, init);
                    }
                    const acc = byDate.get(key);
                    columns.forEach(col => { acc[col] += toNumber(row[col]); });
                });
                return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
            }
        } catch (error) {
            console.error(`Error getting time series data for ${sheetName}:`, error);
            return [];
        }
    }

    // Get commune heatmap data
    getCommuneHeatmapData(rawData) {
        try {
            const data = rawData['Commune Analysis'] || [];
            if (!data.length) return [];

            return data.map(row => ({
                commune: row['Commune'],
                region: row['Region'],
                totalParcels: parseInt(row['Total Parcels']) || 0,
                nicadPercentage: parseFloat(row['NICAD %']) || 0,
                ctasfPercentage: parseFloat(row['CTASF %']) || 0,
                deliberatedPercentage: parseFloat(row['Deliberated %']) || 0,
                geomatician: row['Geomatician'] || 'Non assigné',
                status: this.getCommuneStatus(
                    parseFloat(row['Total %']) || 0,
                    parseFloat(row['CTASF %']) || 0,
                    parseFloat(row['Deliberated %']) || 0
                )
            }));
        } catch (error) {
            console.error('Error getting commune heatmap data:', error);
            return [];
        }
    }

    // Get commune status
    getCommuneStatus(totalPercentage, ctasfPercentage, deliberatedPercentage) {
        const avgPercentage = (totalPercentage * 0.4 + ctasfPercentage * 0.3 + deliberatedPercentage * 0.3); // Weighted for improvement
        if (avgPercentage >= 80) return 'high';
        if (avgPercentage >= 50) return 'medium';
        if (avgPercentage >= 30) return 'low';
        return 'critical';
    }

    // Get timeline data for Gantt chart
    getTimelineData(rawData) {
        try {
            const data = rawData['Project Timeline'] || [];
            if (!data.length) return [];

            // Process timeline data
            const timelineItems = [];

            data.forEach(row => {
                // Tambacounda
                if (row['Tambacounda']) {
                    timelineItems.push({
                        order: parseInt(row['Order']) || 0,
                        region: 'Tambacounda',
                        task: row['Tambacounda'],
                        status: row['Tambacounda Status'] || 'pending',
                        startDate: row['Tambacounda Start Date'],
                        endDate: row['Tambacounda End Date'],
                        progress: this.calculateTaskProgress(row['Tambacounda Start Date'], row['Tambacounda End Date'], row['Tambacounda Status'])
                    });
                }

                // Kedougou
                if (row['Kedougou']) {
                    timelineItems.push({
                        order: parseInt(row['Order']) || 0,
                        region: 'Kedougou',
                        task: row['Kedougou'],
                        status: row['Kedougou Status'] || 'pending',
                        startDate: row['Kedougou Start Date'],
                        endDate: row['Kedougou End Date'],
                        progress: this.calculateTaskProgress(row['Kedougou Start Date'], row['Kedougou End Date'], row['Kedougou Status'])
                    });
                }
            });

            return timelineItems.sort((a, b) => (a.order - b.order) || (a.region.localeCompare(b.region)));
        } catch (error) {
            console.error('Error getting timeline data:', error);
            return [];
        }
    }

    // Calculate task progress based on dates
    calculateTaskProgress(startDateStr, endDateStr, status) {
        if (status === 'completed') return 100;
        if (!startDateStr || !endDateStr) return 0;

        try {
            const startDate = (window.UTILS && UTILS.parseDateDMY) ? UTILS.parseDateDMY(startDateStr) : this.parseDateDMY(startDateStr);
            const endDate = (window.UTILS && UTILS.parseDateDMY) ? UTILS.parseDateDMY(endDateStr) : this.parseDateDMY(endDateStr);
            const today = new Date();

            if (!startDate || !endDate) return 0;
            if (today < startDate) return 0;
            if (today > endDate) return 100;

            const totalDuration = endDate - startDate;
            const elapsedDuration = today - startDate;

            return Math.round((elapsedDuration / totalDuration) * 100);
        } catch (error) {
            return 0;
        }
    }

    // Dedicated date parser for DD/MM/YYYY format (added for consistency)
    parseDateDMY(dateStr) {
        if (!dateStr) return null;
        try {
            const parts = String(dateStr).trim().split(/[/.-]/);
            if (parts.length !== 3) return null;
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
            if (year < 100) year += 2000;
            const date = new Date(year, month - 1, day);
            if (isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() + 1 !== month) return null;
            return date;
        } catch (e) {
            // Suppressed invalid date format warning (parsing-related)
            return null;
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        // console.log('Data cache cleared');
        return true;
    }
}

// Create global instance
window.dataService = new DataService();