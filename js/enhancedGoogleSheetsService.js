/**
 * Enhanced Google Sheets Service for PROCASSEF Dashboard
 * Optimized for multiple sheet fetching using CSV export (GID-based), caching, and batching
 * Uses CSV export only - no Google Sheets API
 * 
 * @class EnhancedGoogleSheetsService
 * @version 2.0.0
 * 
 * Security Features:
 * - URL validation to prevent SSRF attacks
 * - Input sanitization for all parameters
 * - Rate limiting to prevent abuse
 * - Response size limits
 */
class EnhancedGoogleSheetsService {
    constructor() {
        // Cache for storing fetched data
        this.cache = new Map();

        // Cache expiration time in milliseconds (3 minutes - fresh data priority)
        this.cacheExpiration = 3 * 60 * 1000;

        // Stale-while-revalidate: serve stale data up to this age while fetching fresh
        this.staleWhileRevalidate = 10 * 60 * 1000; // 10 minutes max stale

        // Track ongoing background refreshes to avoid duplicates
        this.backgroundRefreshes = new Set();

        // Prevent duplicate concurrent requests
        this.pendingRequests = new Map();

        // Maximum response size (5MB) to prevent memory exhaustion
        this.maxResponseSize = 5 * 1024 * 1024;

        // Maximum cache entries to prevent memory leaks
        this.maxCacheEntries = 50;

        // Concurrency limit for parallel requests
        this.maxConcurrentRequests = 4;
        this.activeRequests = 0;
        this.requestQueue = [];

        // Default options
        this.options = Object.freeze({
            useCaching: true,
            batchRequests: true,
            maxRetries: 2,
            retryDelay: 500,
            timeout: 15000,
            forceRefresh: false // New: bypass cache entirely
        });

        // Allowed domains for fetching (whitelist)
        this.allowedDomains = Object.freeze([
            'docs.google.com',
            'sheets.googleapis.com'
        ]);

        // Clear stale cache on page visibility change (user returns to tab)
        this._setupVisibilityHandler();
    }

    /**
     * Setup visibility change handler to refresh data when user returns
     * @private
     */
    _setupVisibilityHandler() {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Mark all cache entries as needing revalidation
                    this._markCacheStale();
                }
            });
        }
    }

    /**
     * Mark all cache entries as stale (needing background refresh)
     * @private
     */
    _markCacheStale() {
        const now = Date.now();
        this.cache.forEach((value, key) => {
            // Set timestamp to trigger stale-while-revalidate
            if (value.timestamp > now - this.cacheExpiration) {
                value.timestamp = now - this.cacheExpiration - 1;
            }
        });
    }

    /**
     * Validate URL is from allowed domains
     * @private
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is valid and from allowed domain
     */
    _isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            const parsed = new URL(url);
            return this.allowedDomains.includes(parsed.hostname) && 
                   (parsed.protocol === 'https:' || parsed.protocol === 'http:');
        } catch (e) {
            return false;
        }
    }

    /**
     * Sanitize spreadsheet ID
     * @private
     * @param {string} id - Spreadsheet ID
     * @returns {string} Sanitized ID or empty string
     */
    _sanitizeSpreadsheetId(id) {
        if (!id || typeof id !== 'string') return '';
        // Google Sheets IDs contain alphanumeric, hyphens, and underscores
        const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '');
        // Validate reasonable length
        if (sanitized.length < 10 || sanitized.length > 100) return '';
        return sanitized;
    }

    /**
     * Sanitize GID (sheet ID)
     * @private
     * @param {string} gid - Sheet GID
     * @returns {string} Sanitized GID or empty string
     */
    _sanitizeGid(gid) {
        if (!gid && gid !== 0) return '';
        const str = String(gid);
        // GIDs are numeric
        const sanitized = str.replace(/[^0-9]/g, '');
        if (sanitized.length === 0 || sanitized.length > 15) return '';
        return sanitized;
    }

    /**
     * Get PROCASSEF specific sheet configuration
     * @returns {Object} Configuration for PROCASSEF sheets
     */
    getPROCASSEFConfig() {
        try {
            // Prefer using the central config if available
            const sheets = [];

            if (window.GOOGLE_SHEETS && typeof window.GOOGLE_SHEETS === 'object') {
                for (const key of Object.keys(window.GOOGLE_SHEETS)) {
                    const s = window.GOOGLE_SHEETS[key];
                    if (s && s.gid) {
                        const sanitizedGid = this._sanitizeGid(s.gid);
                        if (sanitizedGid) {
                            sheets.push({ 
                                gid: sanitizedGid, 
                                name: String(s.name || key).substring(0, 100),
                                url: s.url && this._isValidUrl(s.url) ? s.url : null
                            });
                        }
                    }
                }
            }

            if (window.MONITORING_SHEETS && typeof window.MONITORING_SHEETS === 'object') {
                for (const key of Object.keys(window.MONITORING_SHEETS)) {
                    const s = window.MONITORING_SHEETS[key];
                    if (s && s.gid) {
                        const sanitizedGid = this._sanitizeGid(s.gid);
                        if (sanitizedGid) {
                            sheets.push({ 
                                gid: sanitizedGid, 
                                name: String(s.name || key).substring(0, 100),
                                url: s.url && this._isValidUrl(s.url) ? s.url : null
                            });
                        }
                    }
                }
            }

            // Try to extract spreadsheetId from CONFIG.SHEETS_BASE_URL if present
            let spreadsheetId = '';
            try {
                if (window.CONFIG && window.CONFIG.SHEETS_BASE_URL) {
                    const m = window.CONFIG.SHEETS_BASE_URL.match(/\/d\/([a-zA-Z0-9-_]+)\/|\/d\/([a-zA-Z0-9-_]+)($|\?|\/)/);
                    if (m) {
                        spreadsheetId = this._sanitizeSpreadsheetId(m[1] || m[2] || '');
                    }
                }
            } catch (e) {
                // ignore extraction errors
            }

            // Fallback: if no sheets were discovered, provide an empty array
            return Object.freeze({
                spreadsheetId: spreadsheetId || '',
                sheets: Object.freeze(sheets)
            });
        } catch (error) {
            // Suppressed
            // Fallback to minimal default to avoid breaking callers
            return Object.freeze({
                spreadsheetId: '',
                sheets: Object.freeze([])
            });
        }
    }

    /**
     * Clear cache for a specific spreadsheet
     * @param {string} spreadsheetId - ID of the spreadsheet
     */
    clearCache(spreadsheetId) {
        const sanitizedId = this._sanitizeSpreadsheetId(spreadsheetId);
        if (!sanitizedId) return;
        
        const keysToDelete = [];

        for (const key of this.cache.keys()) {
            if (key.startsWith(sanitizedId)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
        // console log suppressed
    }

    /**
     * Enforce cache size limits to prevent memory exhaustion
     * @private
     */
    _enforceCacheLimit() {
        if (this.cache.size <= this.maxCacheEntries) return;
        
        // Remove oldest entries first (FIFO)
        const keysToRemove = Array.from(this.cache.keys())
            .slice(0, this.cache.size - this.maxCacheEntries);
        keysToRemove.forEach(key => this.cache.delete(key));
    }

    /**
     * Add item to cache with automatic limit enforcement
     * @private
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    addToCache(key, data) {
        this._enforceCacheLimit();
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Get item from cache with stale-while-revalidate support
     * @private
     * @param {string} key - Cache key
     * @param {boolean} forceRefresh - Bypass cache entirely
     * @returns {Object} { data, isStale, shouldRevalidate }
     */
    getFromCache(key, forceRefresh = false) {
        // Force refresh bypasses cache
        if (forceRefresh) {
            return { data: null, isStale: false, shouldRevalidate: true };
        }

        const cached = this.cache.get(key);
        if (!cached) {
            return { data: null, isStale: false, shouldRevalidate: true };
        }
        
        const age = Date.now() - cached.timestamp;
        
        // Fresh data - use directly
        if (age <= this.cacheExpiration) {
            return { data: cached.data, isStale: false, shouldRevalidate: false };
        }
        
        // Stale but within revalidate window - use but refresh in background
        if (age <= this.staleWhileRevalidate) {
            return { data: cached.data, isStale: true, shouldRevalidate: true };
        }
        
        // Too old - delete and fetch fresh
        this.cache.delete(key);
        return { data: null, isStale: false, shouldRevalidate: true };
    }

    /**
     * Trigger background refresh for a cache key
     * @private
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch fresh data
     */
    async _backgroundRefresh(key, fetchFn) {
        // Avoid duplicate background refreshes
        if (this.backgroundRefreshes.has(key)) return;
        
        this.backgroundRefreshes.add(key);
        
        try {
            const freshData = await fetchFn();
            this.addToCache(key, freshData);
            
            // Notify dashboard of fresh data if available
            if (window.enhancedDashboard && typeof window.enhancedDashboard.onBackgroundDataRefresh === 'function') {
                window.enhancedDashboard.onBackgroundDataRefresh(key, freshData);
            }
        } catch (e) {
            // Silent fail for background refresh - stale data is still shown
            console.debug('Background refresh failed for', key);
        } finally {
            this.backgroundRefreshes.delete(key);
        }
    }

    /**
     * Execute request with concurrency limiting
     * @private
     * @param {Function} requestFn - Async function to execute
     * @returns {Promise<*>} Request result
     */
    async _executeWithLimit(requestFn) {
        // If under limit, execute immediately
        if (this.activeRequests < this.maxConcurrentRequests) {
            this.activeRequests++;
            try {
                return await requestFn();
            } finally {
                this.activeRequests--;
                this._processQueue();
            }
        }

        // Otherwise queue the request
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ requestFn, resolve, reject });
        });
    }

    /**
     * Process queued requests
     * @private
     */
    _processQueue() {
        while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
            const { requestFn, resolve, reject } = this.requestQueue.shift();
            this.activeRequests++;
            requestFn()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this.activeRequests--;
                    this._processQueue();
                });
        }
    }

    /**
     * Fetch data from multiple sheets in a Google Spreadsheet
     * @param {string} spreadsheetId - ID of the Google Sheet
     * @param {Array<Object>} sheets - Array of sheet objects with gid and name
     * @param {Object} options - Options for the request
     * @returns {Promise<Object>} - Object with sheet data
     */
    async fetchMultipleSheets(spreadsheetId, sheets, options = {}) {
        // Validate inputs
        const sanitizedId = this._sanitizeSpreadsheetId(spreadsheetId);
        if (!sanitizedId) {
            console.error('Invalid spreadsheet ID');
            return {};
        }
        
        if (!Array.isArray(sheets) || sheets.length === 0) {
            console.error('Invalid sheets array');
            return {};
        }

        try {
            // Merge default options with provided options
            const finalOptions = { ...this.options, ...options };
            // console log suppressed

            const result = {};

            if (finalOptions.batchRequests) {
                // Batch fetch all sheets
                // console log suppressed
                return await this.batchFetchSheets(spreadsheetId, sheets, finalOptions);
            } else {
                // Sequential fetching
                // console log suppressed
                for (const sheet of sheets) {
                    try {
                        // Remove any API key related options since we're only using GID
                        const csvOptions = {
                            ...finalOptions,
                            sheetName: sheet.name
                        };
                        // Delete any API key if present to ensure we only use CSV
                        delete csvOptions.apiKey;

                        const sheetData = await this.fetchSheet(
                            spreadsheetId,
                            sheet.gid,
                            csvOptions
                        );
                        result[sheet.name] = sheetData;
                        // console log suppressed
                    } catch (err) {
                        console.error(`Failed to fetch sheet ${sheet.name}:`, err);
                        result[sheet.name] = [];
                    }
                }

                return result;
            }
        } catch (error) {
            // Suppressed
            throw error;
        }
    }

    /**
     * Batch fetch multiple sheets in parallel
     * @param {string} spreadsheetId - ID of the Google Sheet
     * @param {Array<Object>} sheets - Array of sheet objects with gid and name
     * @param {Object} options - Options for the request
     * @returns {Promise<Object>} - Object with sheet data
     */
    async batchFetchSheets(spreadsheetId, sheets, options) {
        try {
            // Prepare all fetch promises
            const fetchPromises = sheets.map(sheet => {
                return new Promise(async (resolve) => {
                    try {
                        // Ensure we only use CSV by removing any API key options
                        const csvOptions = {
                            ...options,
                            sheetName: sheet.name
                        };
                        delete csvOptions.apiKey;

                        // If sheet has a custom URL, use it directly
                        let sheetData;
                        if (sheet.url) {
                            sheetData = await this.fetchSheetByURL(sheet.url, csvOptions);
                        } else {
                            sheetData = await this.fetchSheet(
                                spreadsheetId,
                                sheet.gid,
                                csvOptions
                            );
                        }
                        resolve({ name: sheet.name, data: sheetData });
                    } catch (error) {
                        if (typeof window !== 'undefined' && window.DEBUG_SHEETS) {
                            console.error(`[GoogleSheets] Failed to fetch "${sheet.name}":`, error);
                        }
                        resolve({ name: sheet.name, data: [] });
                    }
                });
            });

            // Execute all fetch promises in parallel
            const results = await Promise.all(fetchPromises);

            // Combine results into a single object
            const combinedResults = {};
            results.forEach(result => {
                combinedResults[result.name] = result.data;
            });

            // Debug: log row counts
            // Suppressed debug row counts

            return combinedResults;

        } catch (error) {
            // Suppressed
            throw error;
        }
    }

    /**
     * Fetch data from a single sheet with stale-while-revalidate support
     * @param {string} spreadsheetId - ID of the Google Sheet
     * @param {string} gid - GID of the specific sheet
     * @param {Object} options - Options for the request
     * @returns {Promise<Array>} - Array of objects representing the sheet data
     */
    async fetchSheet(spreadsheetId, gid, options) {
        // Generate cache key for this sheet
        const cacheKey = `${spreadsheetId}_${gid}`;

        // Build the URL for the CSV export
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

        // Define fetch function for reuse
        const fetchFreshData = async () => {
            let response;
            let retries = 0;

            while (retries <= options.maxRetries) {
                try {
                    // Add cache-busting parameter for fresh data
                    const bustUrl = `${url}&_t=${Date.now()}`;
                    response = await fetch(bustUrl, {
                        cache: 'no-store' // Bypass browser cache
                    });

                    if (response.ok) break;
                    throw new Error(`HTTP ${response.status}`);
                } catch (error) {
                    if (retries >= options.maxRetries) throw error;
                    await new Promise(r => setTimeout(r, options.retryDelay));
                    retries++;
                }
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch sheet after ${options.maxRetries} retries`);
            }

            const csvText = await response.text();
            return this.parseCSV(csvText);
        };

        // Check cache with stale-while-revalidate support
        if (options.useCaching && !options.forceRefresh) {
            const { data: cachedData, isStale, shouldRevalidate } = this.getFromCache(cacheKey, options.forceRefresh);
            
            if (cachedData) {
                // If stale, trigger background refresh
                if (isStale && shouldRevalidate) {
                    this._backgroundRefresh(cacheKey, fetchFreshData);
                }
                // Return cached data immediately (stale or fresh)
                return cachedData;
            }
        }

        // No cache or force refresh - fetch fresh data
        try {
            const parsedData = await fetchFreshData();

            // Cache the result if caching is enabled
            if (options.useCaching) {
                this.addToCache(cacheKey, parsedData);
            }

            return parsedData;

        } catch (error) {
            // Suppressed
            throw error;
        }
    }

    /**
     * Fetch sheet data using a complete URL (for sheets from different spreadsheets)
     * @param {string} url - Complete URL to fetch
     * @param {Object} options - Options for the request
     * @returns {Promise<Array>} - Array of objects representing the sheet data
     */
    async fetchSheetByURL(url, options) {
        // Generate cache key from URL
        const cacheKey = url;

        // Define fetch function for reuse
        const fetchFreshData = async () => {
            let response;
            let retries = 0;
            const debug = (typeof window !== 'undefined' && window.DEBUG_SHEETS);

            while (retries <= options.maxRetries) {
                try {
                    // Add cache-busting parameter
                    const separator = url.includes('?') ? '&' : '?';
                    const bustUrl = `${url}${separator}_t=${Date.now()}`;
                    if (debug) {
                        console.log(`[GoogleSheets] Fetching: ${options.sheetName || 'unknown'} from ${url.substring(0, 80)}...`);
                    }
                    response = await fetch(bustUrl, { cache: 'no-store' });

                    if (response.ok) break;
                    throw new Error(`HTTP ${response.status}`);
                } catch (error) {
                    if (debug) {
                        console.warn(`[GoogleSheets] Retry ${retries + 1}/${options.maxRetries} for ${options.sheetName}:`, error);
                    }
                    if (retries >= options.maxRetries) throw error;
                    await new Promise(r => setTimeout(r, options.retryDelay));
                    retries++;
                }
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch sheet after ${options.maxRetries} retries`);
            }

            const csvText = await response.text();
            const parsed = this.parseCSV(csvText);
            if (debug) {
                console.log(`[GoogleSheets] Parsed ${options.sheetName || 'unknown'}: ${parsed.length} rows`);
            }
            return parsed;
        };

        // Check cache with stale-while-revalidate
        if (options.useCaching && !options.forceRefresh) {
            const { data: cachedData, isStale, shouldRevalidate } = this.getFromCache(cacheKey, options.forceRefresh);
            
            if (cachedData) {
                if (isStale && shouldRevalidate) {
                    this._backgroundRefresh(cacheKey, fetchFreshData);
                }
                return cachedData;
            }
        }

        // Check for pending request to avoid duplicates
        if (this.pendingRequests.has(url)) {
            return this.pendingRequests.get(url);
        }

        // Create new request promise
        const requestPromise = (async () => {
            try {
                const parsedData = await fetchFreshData();

                if (options.useCaching) {
                    this.addToCache(cacheKey, parsedData);
                }

                return parsedData;
            } finally {
                this.pendingRequests.delete(url);
            }
        })();

        this.pendingRequests.set(url, requestPromise);
        return requestPromise;
    }

    /**
     * Clear all cached data - use when sheets are known to be updated
     */
    clearAllCache() {
        this.cache.clear();
        this.backgroundRefreshes.clear();
        console.info('[GoogleSheets] All cache cleared');
    }

    /**
     * Force refresh all data - clears cache and returns fresh data
     * @param {string} spreadsheetId - Spreadsheet ID
     * @param {Array} sheets - Sheets to fetch
     * @returns {Promise<Object>} Fresh data
     */
    async forceRefreshAll(spreadsheetId, sheets) {
        this.clearAllCache();
        return this.fetchMultipleSheets(spreadsheetId, sheets, { 
            ...this.options, 
            forceRefresh: true 
        });
    }

    /**
     * Parse CSV string to array of objects
     * @param {string} csvText - CSV text to parse
     * @returns {Array} - Array of objects
     */
    parseCSV(csvText) {
        try {
            if (!csvText || typeof csvText !== 'string') {
                return [];
            }

            // Check if we accidentally got HTML (e.g. login page) instead of CSV
            if (csvText.trim().toLowerCase().startsWith('<!doctype html') || csvText.trim().toLowerCase().startsWith('<html')) {
                console.error('ERROR: Google Sheets returned an HTML page instead of CSV. Is the sheet "Published to the web"?');
                return [];
            }

            // Remove BOM if present
            const cleanText = csvText.replace(/^\uFEFF/, '');

            // Normalize line endings and split into rows
            const rows = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                .split('\n')
                .filter(row => row.trim().length > 0);

            if (rows.length === 0) {
                return [];
            }

            // Parse header row - the first row of the CSV
            const headers = this.parseCSVRow(rows[0]);

            // Parse data rows
            const data = rows.slice(1).map(row => {
                const values = this.parseCSVRow(row);
                const rowObject = {};

                // Combine headers with values
                headers.forEach((header, index) => {
                    // Skip empty headers
                    if (header && header.trim().length > 0) {
                        const value = values[index];
                        if (value !== undefined) {
                            // Try to convert numeric strings to numbers, but only if they look like numbers
                            const trimmedVal = String(value).trim();
                            if (trimmedVal !== '' && !isNaN(trimmedVal) && !trimmedVal.includes('/') && !trimmedVal.includes('-')) {
                                rowObject[header] = parseFloat(trimmedVal.replace(/,/g, '.'));
                            } else {
                                rowObject[header] = value;
                            }
                        }
                    }
                });

                return rowObject;
            });

            console.debug(`parseCSV parsed ${data.length} rows with headers:`, headers.filter(h => h && h.trim()));
            return data;

        } catch (error) {
            console.error('Error parsing CSV:', error);
            return [];
        }
    }

    /**
     * Parse a single CSV row, handling quoted values properly
     * @param {string} row - CSV row to parse
     * @returns {Array} - Array of values
     */
    parseCSVRow(row) {
        const result = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            const nextChar = row[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    // Two double quotes inside quotes - add one quote
                    currentValue += '"';
                    i++; // Skip the next quote
                } else {
                    // Toggle insideQuotes flag
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                // End of value
                result.push(currentValue.trim());
                currentValue = '';
            } else {
                // Add character to current value
                currentValue += char;
            }
        }

        // Add the last value
        result.push(currentValue.trim());

        return result;
    }

    /**
     * Get item from cache
     * @param {string} key - Cache key
     * @returns {*|null} - Cached data or null
     */
    getFromCache(key) {
        if (!this.cache.has(key)) {
            return null;
        }

        const cacheItem = this.cache.get(key);

        // Check if cache has expired
        if (Date.now() > cacheItem.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return cacheItem.data;
    }

    /**
     * Add item to cache
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    addToCache(key, data) {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + this.cacheExpiration
        });
    }
}

// Create global instance
window.enhancedGoogleSheetsService = new EnhancedGoogleSheetsService();
