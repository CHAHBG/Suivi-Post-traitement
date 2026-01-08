/**
 * Enhanced Google Sheets Service for PROCASSEF Dashboard
 * Optimized for multiple sheet fetching using CSV export (GID-based), caching, and batching
 * Uses CSV export only - no Google Sheets API
 */
class EnhancedGoogleSheetsService {
    constructor() {
        // Cache for storing fetched data
        this.cache = new Map();

        // Cache expiration time in milliseconds (10 minutes - increased for performance)
        this.cacheExpiration = 10 * 60 * 1000;

        // Prevent duplicate concurrent requests
        this.pendingRequests = new Map();

        // Default options
        this.options = {
            useCaching: true,
            batchRequests: true,
            maxRetries: 3,
            retryDelay: 1000
        };
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
                        sheets.push({ 
                            gid: String(s.gid), 
                            name: s.name || key,
                            url: s.url // Include URL if available
                        });
                    }
                }
            }

            if (window.MONITORING_SHEETS && typeof window.MONITORING_SHEETS === 'object') {
                for (const key of Object.keys(window.MONITORING_SHEETS)) {
                    const s = window.MONITORING_SHEETS[key];
                    if (s && s.gid) {
                        sheets.push({ 
                            gid: String(s.gid), 
                            name: s.name || key,
                            url: s.url // Include URL if available
                        });
                    }
                }
            }

            // Try to extract spreadsheetId from CONFIG.SHEETS_BASE_URL if present
            let spreadsheetId = '';
            try {
                if (window.CONFIG && window.CONFIG.SHEETS_BASE_URL) {
                    const m = window.CONFIG.SHEETS_BASE_URL.match(/\/d\/([a-zA-Z0-9-_]+)\/|\/d\/([a-zA-Z0-9-_]+)($|\?|\/)/);
                    if (m) spreadsheetId = m[1] || m[2] || '';
                }
            } catch (e) {
                // ignore extraction errors
            }

            // Fallback: if no sheets were discovered, provide an empty array
            return {
                spreadsheetId: spreadsheetId || '',
                sheets
            };
        } catch (error) {
            // Suppressed
            // Fallback to minimal default to avoid breaking callers
            return {
                spreadsheetId: '',
                sheets: []
            };
        }
    }

    /**
     * Clear cache for a specific spreadsheet
     * @param {string} spreadsheetId - ID of the spreadsheet
     */
    clearCache(spreadsheetId) {
        const keysToDelete = [];

        for (const key of this.cache.keys()) {
            if (key.startsWith(spreadsheetId)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
        // console log suppressed
    }

    /**
     * Fetch data from multiple sheets in a Google Spreadsheet
     * @param {string} spreadsheetId - ID of the Google Sheet
     * @param {Array<Object>} sheets - Array of sheet objects with gid and name
     * @param {Object} options - Options for the request
     * @returns {Promise<Object>} - Object with sheet data
     */
    async fetchMultipleSheets(spreadsheetId, sheets, options = {}) {
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
                        // Suppressed
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
     * Fetch data from a single sheet
     * @param {string} spreadsheetId - ID of the Google Sheet
     * @param {string} gid - GID of the specific sheet
     * @param {Object} options - Options for the request
     * @returns {Promise<Array>} - Array of objects representing the sheet data
     */
    async fetchSheet(spreadsheetId, gid, options) {
        // Generate cache key for this sheet
        const cacheKey = `${spreadsheetId}_${gid}`;

        // Check cache if enabled
        if (options.useCaching) {
            const cachedData = this.getFromCache(cacheKey);
            if (cachedData) {
                // console log suppressed
                return cachedData;
            }
        }

        // Store sheetName for logging purposes
        const sheetName = options.sheetName;

        // Skip API-based fetching and always use CSV export by gid
        // console log suppressed

        // Build the URL for the CSV export (fallback)
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        // console log suppressed

        try {
            let response;
            let retries = 0;

            // Implement retry logic
            while (retries <= options.maxRetries) {
                try {
                    response = await fetch(url);

                    if (response.ok) {
                        break;
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (error) {
                    if (retries === 0) { // Only log first attempt error
                        // Suppressed
                    }

                    if (retries >= options.maxRetries) {
                        throw error;
                    }

                    // Wait before retry
                    await new Promise(r => setTimeout(r, options.retryDelay));
                    retries++;
                }
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch sheet after ${options.maxRetries} retries`);
            }

            // Get CSV text
            const csvText = await response.text();

            // Parse CSV to array of objects
            const parsedData = this.parseCSV(csvText);

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

        // Check cache if enabled
        if (options.useCaching) {
            const cachedData = this.getFromCache(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }

        // Check for pending request
        if (this.pendingRequests.has(url)) {
            return this.pendingRequests.get(url);
        }

        // Create new request promise
        const requestPromise = (async () => {
            try {
                let response;
                let retries = 0;

                // Implement retry logic
                while (retries <= options.maxRetries) {
                    try {
                        response = await fetch(url);

                        if (response.ok) {
                            break;
                        } else {
                            throw new Error(`HTTP ${response.status}`);
                        }
                    } catch (error) {
                        if (retries >= options.maxRetries) {
                            throw error;
                        }

                        // Wait before retry
                        await new Promise(r => setTimeout(r, options.retryDelay));
                        retries++;
                    }
                }

                if (!response.ok) {
                    throw new Error(`Failed to fetch sheet after ${options.maxRetries} retries`);
                }

                // Get CSV text
                const csvText = await response.text();

                // Parse CSV to array of objects
                const parsedData = this.parseCSV(csvText);

                // Cache the result if caching is enabled
                if (options.useCaching) {
                    this.addToCache(cacheKey, parsedData);
                }

                return parsedData;
            } catch (error) {
                throw error;
            } finally {
                this.pendingRequests.delete(url);
            }
        })();

        this.pendingRequests.set(url, requestPromise);
        return requestPromise;
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
