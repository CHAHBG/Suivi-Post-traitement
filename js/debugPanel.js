/**
 * Debug Panel for PROCASSEF Dashboard
 * Displays live data state for debugging
 */
class DebugPanel {
    constructor() {
        this.isVisible = false;
        this.panelElement = null;
        this.createPanel();
    }

    /**
     * Create debug panel element
     */
    createPanel() {
        // Create panel element if it doesn't exist
        if (!this.panelElement) {
            this.panelElement = document.createElement('div');
            this.panelElement.id = 'debugPanel';
            this.panelElement.className = 'debug-panel';
            this.panelElement.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 320px;
                max-height: 500px;
                overflow-y: auto;
                background-color: rgba(0, 0, 0, 0.85);
                border: 1px solid #666;
                color: #eee;
                font-family: monospace;
                font-size: 12px;
                padding: 10px;
                z-index: 9999;
                display: none;
                border-radius: 4px;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
            `;

            const header = document.createElement('div');
            header.className = 'debug-header';
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                border-bottom: 1px solid #666;
                padding-bottom: 5px;
            `;

            const title = document.createElement('h3');
            title.textContent = 'Debug Panel';
            title.style.cssText = `
                margin: 0;
                color: #3498db;
            `;

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: #999;
                font-size: 20px;
                cursor: pointer;
            `;
            closeBtn.onclick = () => this.hide();

            header.appendChild(title);
            header.appendChild(closeBtn);
            this.panelElement.appendChild(header);

            // Content container
            const content = document.createElement('div');
            content.className = 'debug-content';
            content.id = 'debugContent';
            this.panelElement.appendChild(content);

            // Control buttons
            const controls = document.createElement('div');
            controls.style.cssText = `
                margin-top: 10px;
                display: flex;
                justify-content: space-between;
                border-top: 1px solid #666;
                padding-top: 5px;
            `;

            const refreshBtn = document.createElement('button');
            refreshBtn.textContent = 'Refresh';
            refreshBtn.className = 'debug-btn';
            refreshBtn.style.cssText = `
                background: #2980b9;
                color: white;
                border: none;
                padding: 3px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            `;
            refreshBtn.onclick = () => this.update();

            const clearCacheBtn = document.createElement('button');
            clearCacheBtn.textContent = 'Clear Cache';
            clearCacheBtn.className = 'debug-btn';
            clearCacheBtn.style.cssText = `
                background: #e74c3c;
                color: white;
                border: none;
                padding: 3px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            `;
            clearCacheBtn.onclick = () => {
                if (window.enhancedGoogleSheetsService) {
                    const config = enhancedGoogleSheetsService.getPROCASSEFConfig();
                    enhancedGoogleSheetsService.clearCache(config.spreadsheetId);
                    this.update();
                    this.log('Cache cleared');
                }
            };

            controls.appendChild(refreshBtn);
            controls.appendChild(clearCacheBtn);
            this.panelElement.appendChild(controls);

            // Add toggle button to body
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'debugToggle';
            toggleBtn.textContent = '🔍';
            toggleBtn.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: #3498db;
                color: white;
                border: none;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                font-size: 16px;
                cursor: pointer;
                z-index: 9998;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            toggleBtn.onclick = () => this.toggle();

            // Add elements to document
            document.body.appendChild(this.panelElement);
            document.body.appendChild(toggleBtn);
        }
    }

    /**
     * Toggle debug panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Show debug panel
     */
    show() {
        if (this.panelElement) {
            this.panelElement.style.display = 'block';
            document.getElementById('debugToggle').style.display = 'none';
            this.isVisible = true;
            this.update();
        }
    }

    /**
     * Hide debug panel
     */
    hide() {
        if (this.panelElement) {
            this.panelElement.style.display = 'none';
            document.getElementById('debugToggle').style.display = 'flex';
            this.isVisible = false;
        }
    }

    /**
     * Log a message to the debug panel
     * @param {string} message - Message to log
     * @param {string} type - Message type (info, warning, error)
     */
    log(message, type = 'info') {
        if (!this.panelElement) return;

        const logItem = document.createElement('div');
        logItem.className = `debug-log debug-${type}`;
        logItem.style.cssText = `
            margin-bottom: 4px;
            padding: 3px;
            border-left: 3px solid ${type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#2ecc71'};
            padding-left: 5px;
            word-break: break-word;
        `;

        const timestamp = new Date().toLocaleTimeString();
        logItem.innerHTML = `<span style="color: #999;">[${timestamp}]</span> ${message}`;

        const content = document.getElementById('debugContent');
        if (content) {
            content.appendChild(logItem);
            content.scrollTop = content.scrollHeight;
        }
    }

    /**
     * Update debug panel with current state
     */
    update() {
        if (!this.isVisible) return;

        const content = document.getElementById('debugContent');
        if (content) {
            content.innerHTML = '';
        }

        // Dashboard info
        this.log('<strong>Dashboard State:</strong>');
        
        if (window.dashboard) {
            this.log(`Dashboard initialized: ${window.dashboard.isInitialized}`);
            this.log(`Current filters: ${JSON.stringify(window.dashboard.currentFilters)}`);
        } else {
            this.log('Dashboard not initialized', 'warning');
        }

        // Raw Data info
        this.log('<strong>Raw Data Keys:</strong>');
        if (window.rawData) {
            const keys = Object.keys(window.rawData);
            this.log(`Found ${keys.length} sheets: ${keys.join(', ')}`);
            
            // Show row counts for important sheets
            for (const key of keys) {
                const data = window.rawData[key];
                if (Array.isArray(data)) {
                    this.log(`Sheet "${key}": ${data.length} rows`);
                    
                    // Show sample data for important sheets
                    if (key === 'Yields Projections' || key === 'yieldsProjections' || key.toLowerCase().includes('yield')) {
                        if (data.length > 0) {
                            this.log(`Sample row: ${JSON.stringify(data[0]).substring(0, 100)}...`);
                        } else {
                            this.log('Empty sheet!', 'warning');
                        }
                    }
                }
            }
            
            // Check for critical sheets
            const criticalSheets = [
                'Yields Projections', 
                'yieldsProjections', 
                'yields_projection',
                'Public Display Follow-up',
                'publicDisplayFollowup', 
                'public_display_followup',
                'CTASF Follow-up', 
                'ctasfFollowup', 
                'ctasf_followup',
                'Post Process Follow-up', 
                'postProcessFollowup', 
                'post_process_followup'
            ];
            
            const missingSheets = criticalSheets.filter(sheet => {
                // Check if any variant of this sheet exists in rawData
                return !keys.some(k => 
                    k.toLowerCase().replace(/[-_ ]/g, '') === sheet.toLowerCase().replace(/[-_ ]/g, '')
                );
            });
            
            if (missingSheets.length > 0) {
                this.log(`Missing critical sheets: ${missingSheets.join(', ')}`, 'error');
            }
        } else {
            this.log('No raw data available', 'warning');
        }

        // KPI info
        this.log('<strong>Last Calculated KPIs:</strong>');
        try {
            if (window.kpis) {
                const kpis = window.kpis;
                const mainKpis = {
                    daily: {
                        current: kpis.daily.current,
                        target: kpis.daily.target,
                        percentage: kpis.daily.percentage
                    },
                    quality: {
                        rate: kpis.quality.rate
                    },
                    ctasf: {
                        rate: kpis.ctasf.rate
                    },
                    processing: {
                        rate: kpis.processing.rate
                    }
                };
                
                this.log(`KPIs: ${JSON.stringify(mainKpis)}`);
                
                // Check for default KPIs
                if (kpis.daily.current === 350 && kpis.daily.target === 832.77) {
                    this.log('WARNING: Using default KPI values!', 'error');
                }
            } else {
                this.log('Cannot calculate KPIs - services unavailable', 'warning');
            }
        } catch (error) {
            this.log(`Error calculating KPIs: ${error.message}`, 'error');
        }

        // Sheet service info
        this.log('<strong>Sheet Service Status:</strong>');
        if (window.enhancedGoogleSheetsService) {
            const config = enhancedGoogleSheetsService.getPROCASSEFConfig();
            this.log(`Spreadsheet ID: ${config.spreadsheetId}`);
            this.log(`Configured sheets: ${config.sheets.length}`);
            
            // Check cache status
            if (enhancedGoogleSheetsService.cache) {
                this.log(`Cache entries: ${enhancedGoogleSheetsService.cache.size}`);
            }
        } else {
            this.log('Enhanced Google Sheets Service not available', 'warning');
        }
    }
}

// Create global instance when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.debugPanel = new DebugPanel();
});
