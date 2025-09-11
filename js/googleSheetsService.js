// Enhanced Google Sheets API Service

class GoogleSheetsService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        this.pendingRequests = new Map();
        this.baseUrl = 'https://docs.google.com/spreadsheets/d/';
        this.exportFormat = '/export?format=csv&gid=';
    }

    /**
     * Fetch multiple sheets in parallel with batching and caching
     * @param {string} spreadsheetId - The ID of the Google Sheet
     * @param {Array<Object>} sheetConfigs - Array of objects with gid and name
     * @returns {Promise<Object>} - Object containing data for each sheet
     */
    async fetchMultipleSheets(spreadsheetId, sheetConfigs) {
        const results = {};
        const fetchPromises = [];
        const sheetNames = [];

        // Group requests that need fetching
        for (const config of sheetConfigs) {
            const cacheKey = `${spreadsheetId}_${config.gid}`;
            
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheExpiry) {
                    results[config.name] = cached.data;
                    continue;
                }
            }
            
            // Check if there's a pending request for this sheet
            if (this.pendingRequests.has(cacheKey)) {
                fetchPromises.push(this.pendingRequests.get(cacheKey));
            } else {
                // Create new request promise
                const promise = this.fetchSheet(spreadsheetId, config.gid);
                this.pendingRequests.set(cacheKey, promise);
                fetchPromises.push(promise);
            }
            
            sheetNames.push({ name: config.name, gid: config.gid });
        }

        // Wait for all pending requests to complete
        if (fetchPromises.length > 0) {
            const fetchedData = await Promise.allSettled(fetchPromises);
            
            // Process results
            fetchedData.forEach((result, index) => {
                const { name, gid } = sheetNames[index];
                const cacheKey = `${spreadsheetId}_${gid}`;
                
                if (result.status === 'fulfilled') {
                    results[name] = result.value;
                    
                    // Update cache
                    this.cache.set(cacheKey, {
                        data: result.value,
                        timestamp: Date.now()
                    });
                } else {
                    console.error(`Failed to fetch sheet ${name}:`, result.reason);
                    results[name] = { error: result.reason.message || 'Unknown error' };
                }
                
                // Remove pending request
                this.pendingRequests.delete(cacheKey);
            });
        }

        return results;
    }

    /**
     * Fetch a single sheet
     * @param {string} spreadsheetId - The ID of the Google Sheet
     * @param {string} gid - The GID of the specific sheet
     * @returns {Promise<Array>} - Parsed CSV data as array of objects
     */
    async fetchSheet(spreadsheetId, gid) {
        const url = `${this.baseUrl}${spreadsheetId}${this.exportFormat}${gid}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            
            const csvText = await response.text();
            return this.parseCSV(csvText);
        } catch (error) {
            console.error(`Error fetching sheet (gid: ${gid}):`, error);
            throw error;
        }
    }

    /**
     * Parse CSV data into array of objects
     * @param {string} csvText - Raw CSV text
     * @returns {Array<Object>} - Array of objects representing rows
     */
    parseCSV(csvText) {
        // Split by line breaks
        const lines = csvText.split(/\\r?\\n/).filter(line => line.trim());
        if (lines.length === 0) return [];
        
        // Parse header row
        const headers = this.parseCSVLine(lines[0]);
        
        // Parse data rows
        return lines.slice(1).map(line => {
            const values = this.parseCSVLine(line);
            const row = {};
            
            headers.forEach((header, index) => {
                // Clean header names
                const cleanHeader = header.trim();
                row[cleanHeader] = values[index] !== undefined ? values[index].trim() : '';
            });
            
            return row;
        });
    }

    /**
     * Parse a single CSV line respecting quoted values
     * @param {string} line - Single line of CSV
     * @returns {Array<string>} - Array of values
     */
    parseCSVLine(line) {
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"' && !inQuotes) {
                // Start of quoted field
                inQuotes = true;
            } else if (char === '"' && nextChar === '"') {
                // Escaped quote
                currentValue += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                // End of quoted field
                inQuotes = false;
            } else if (char === ',' && !inQuotes) {
                // End of field
                values.push(currentValue);
                currentValue = '';
            } else {
                // Normal character
                currentValue += char;
            }
        }
        
        // Push the last value
        values.push(currentValue);
        
        return values;
    }

    /**
     * Clear cache for specific sheet or all sheets
     * @param {string} [spreadsheetId] - Optional ID to clear specific sheet cache
     * @param {string} [gid] - Optional GID to clear specific sheet cache
     */
    clearCache(spreadsheetId, gid) {
        if (!spreadsheetId) {
            this.cache.clear();
            return;
        }
        
        if (!gid) {
            // Clear all sheets from this spreadsheet
            for (const key of this.cache.keys()) {
                if (key.startsWith(`${spreadsheetId}_`)) {
                    this.cache.delete(key);
                }
            }
            return;
        }
        
        // Clear specific sheet
        const cacheKey = `${spreadsheetId}_${gid}`;
        this.cache.delete(cacheKey);
    }
    
    /**
     * Get sheets configuration for PROCASSEF Dashboard
     * @returns {Object} - Configuration for sheet fetching
     */
    getPROCASSEFConfig() {
        const spreadsheetId = '1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW';
        
        return {
            spreadsheetId,
            sheets: [
                { gid: '589154853', name: 'generalMetrics' },
                { gid: '778550489', name: 'phaseProgress1' },
                { gid: '1687610293', name: 'phaseProgress2' },
                { gid: '1397416280', name: 'teamYields' },
                { gid: '660642704', name: 'regionStatus' },
                { gid: '1151168155', name: 'monthlyMetrics' },
                { gid: '2035205606', name: 'displayFollowup' },
                { gid: '1574818070', name: 'ctasfMetrics' },
                { gid: '1421590976', name: 'communeData' },
                { gid: '1203072335', name: 'descriptions' },
                { gid: '614496809', name: 'publicDisplayFollowup' },
                { gid: '1629996903', name: 'ctasfFollowup' },
                { gid: '202408760', name: 'postProcessFollowup' }
            ]
        };
    }
}

// Create a global instance
window.googleSheetsService = new GoogleSheetsService();

// Usage example:
// async function loadDashboardData() {
//     const config = googleSheetsService.getPROCASSEFConfig();
//     const data = await googleSheetsService.fetchMultipleSheets(config.spreadsheetId, config.sheets);
//     return data;
// }
