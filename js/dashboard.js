// LEGACY Dashboard Controller - NO LONGER USED
// This file is kept for reference only but is not loaded in the application
// The enhanced dashboard (EnhancedDashboard class) is now used instead

class Dashboard {
    constructor() {
        this.isInitialized = false;
        this.currentFilters = {
            region: '',
            timeframe: 'daily',
            commune: ''
        };
        this.refreshInterval = null;
        this.rawData = null;
        
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

    // Initialize the dashboard
    async initialize() {
        try {
            this.showLoading(true);
            
            console.log('Initializing Cadastre Senegal Dashboard...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Legacy dashboard: always fetch live data when initialized
            
            // Load initial data
            await this.loadData();
            
            // Set up auto-refresh
            this.setupAutoRefresh();
            
            this.isInitialized = true;
            console.log('Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Erreur lors du chargement du dashboard');
        } finally {
            this.showLoading(false);
        }
    }

    // Load all data and update dashboard
    async loadData() {
        try {
            // Fetch data from Google Sheets
            const { data, errors } = await dataService.getAllData();
            
            if (errors.length > 0) {
                console.warn('Some data sheets could not be loaded:', errors);
                this.showWarning(`Certaines données n'ont pas pu être chargées (${errors.length} erreurs)`);
            }

            this.rawData = data;

            // Calculate KPIs
            const kpis = dataService.calculateKPIs(data);
            
            // Update liquid progress indicators
            liquidProgressService.initializeLiquidProgress(kpis);
            
            // Update quality rate display
            if (kpis.quality && typeof kpis.quality.rate !== 'undefined') {
                this.updateQualityRate(kpis.quality.rate);
            } else {
                console.warn('Quality rate data is missing');
                this.updateQualityRate(0); // Default to 0
            }
            
            // Initialize all charts
            await chartService.initializeCharts(data);
            
            // Generate heatmap
            this.generateCommuneHeatmap(data);
            
            // Generate Gantt chart
            this.generateProjectTimeline(data);
            
            // Populate data tables
            this.populateDataTables(data);
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Erreur lors du chargement des données');
            throw error;
        }
    }

    // Set up event listeners
    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Region filter
        const regionFilter = document.getElementById('regionFilter');
        if (regionFilter) {
            regionFilter.addEventListener('change', (e) => {
                this.currentFilters.region = e.target.value;
                this.applyFilters();
            });
        }

        // Time filter
        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter) {
            timeFilter.addEventListener('change', (e) => {
                this.currentFilters.timeframe = e.target.value;
                this.applyFilters();
            });
        }

        // Tab navigation
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Window resize handler for responsive charts
        window.addEventListener('resize', UTILS.debounce(() => {
            this.handleResize();
        }, 250));
    }

    // Apply current filters to data and charts
    async applyFilters() {
        if (!this.rawData) return;

        try {
            this.showLoading(true);
            
            // Filter data based on current filters
            const filteredData = this.filterData(this.rawData);
            
            // Recalculate KPIs
            const kpis = dataService.calculateKPIs(filteredData);
            
            // Update liquid progress indicators
            liquidProgressService.updateAllProgress(kpis);
            
            // Update quality rate display
            if (kpis.quality && typeof kpis.quality.rate !== 'undefined') {
                this.updateQualityRate(kpis.quality.rate);
            } else {
                console.warn('Quality rate data is missing');
                this.updateQualityRate(0); // Default to 0
            }
            
            // Update charts
            await chartService.updateCharts(filteredData);
            
            // Update heatmap
            this.generateCommuneHeatmap(filteredData);
            
            // Update Gantt chart
            this.generateProjectTimeline(filteredData);
            
            // Update data tables
            this.populateDataTables(filteredData);
            
            this.showSuccess('Filtres appliqués');
        } catch (error) {
            console.error('Error applying filters:', error);
            this.showError('Erreur lors de l\'application des filtres');
        } finally {
            this.showLoading(false);
        }
    }

    // Filter data based on current filters
    filterData(data) {
        const filtered = {};
        
        Object.keys(data).forEach(sheetName => {
            const sheetData = data[sheetName];
            let filteredSheet = [...sheetData];
            
            // Filter by region if specified
            if (this.currentFilters.region && sheetData.length > 0 && 'Région' in sheetData[0]) {
                filteredSheet = filteredSheet.filter(row => row['Région'] === this.currentFilters.region);
            }
            
            // Filter by time period if needed
            if (this.currentFilters.timeframe !== 'all' && sheetData.length > 0 && 'Date' in sheetData[0]) {
                const now = new Date();
                let startDate;
                
                switch (this.currentFilters.timeframe) {
                    case 'daily':
                        startDate = new Date();
                        startDate.setHours(0, 0, 0, 0);
                        break;
                    case 'weekly':
                        startDate = new Date();
                        startDate.setDate(now.getDate() - 7);
                        break;
                    case 'monthly':
                        startDate = new Date();
                        startDate.setMonth(now.getMonth() - 1);
                        break;
                }
                
                if (startDate) {
                    filteredSheet = filteredSheet.filter(row => {
                        const rowDate = new Date(row['Date']);
                        return rowDate >= startDate && rowDate <= now;
                    });
                }
            }
            
            filtered[sheetName] = filteredSheet;
        });
        
        return filtered;
    }

    // Update quality rate display
    updateQualityRate(rate) {
        const qualityElement = document.getElementById('qualityRate');
        if (qualityElement) {
            qualityElement.textContent = rate + '%';
            
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

    // Generate commune heatmap
    generateCommuneHeatmap(data) {
        const heatmapContainer = document.getElementById('communeHeatmap');
        if (!heatmapContainer) return;

        const communeData = dataService.getCommuneHeatmapData(data);
        
        heatmapContainer.innerHTML = '';
        
        communeData.forEach(commune => {
            const cell = document.createElement('div');
            cell.className = `heatmap-cell ${commune.status}`;
            cell.innerHTML = `
                <div class="font-semibold text-gray-900">${commune.commune}</div>
                <div class="text-sm text-gray-500">${commune.region}</div>
                <div class="mt-2">
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-500">NICAD</span>
                        <span class="text-xs font-semibold">${commune.nicadPercentage.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-1.5 my-1">
                        <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${commune.nicadPercentage}%"></div>
                    </div>
                    
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-500">CTASF</span>
                        <span class="text-xs font-semibold">${commune.ctasfPercentage.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-1.5 my-1">
                        <div class="bg-green-600 h-1.5 rounded-full" style="width: ${commune.ctasfPercentage}%"></div>
                    </div>
                    
                    <div class="flex justify-between">
                        <span class="text-xs text-gray-500">Délibéré</span>
                        <span class="text-xs font-semibold">${commune.deliberatedPercentage.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-1.5 my-1">
                        <div class="bg-purple-600 h-1.5 rounded-full" style="width: ${commune.deliberatedPercentage}%"></div>
                    </div>
                </div>
                <div class="mt-2 text-xs text-gray-500">
                    Total: ${commune.totalParcels} parcelles
                </div>
            `;
            
            cell.addEventListener('click', () => this.showCommuneDetails(commune));
            heatmapContainer.appendChild(cell);
        });
    }

    // Generate project timeline (Gantt chart)
    generateProjectTimeline(data) {
        const timelineContainer = document.getElementById('projectTimelineGantt');
        if (!timelineContainer) return;

        const timelineData = dataService.getTimelineData(data);
        
        timelineContainer.innerHTML = '';
        
        timelineData.forEach(item => {
            const ganttRow = document.createElement('div');
            ganttRow.className = 'gantt-row';
            
            const label = document.createElement('div');
            label.className = 'gantt-label';
            label.textContent = item.task;
            
            const timeline = document.createElement('div');
            timeline.className = 'gantt-timeline';
            
            const bar = document.createElement('div');
            bar.className = `gantt-bar ${item.region.toLowerCase()} ${item.status}`;
            bar.style.width = `${item.progress}%`;
            bar.setAttribute('title', `${item.task} (${item.progress}%)`);
            
            timeline.appendChild(bar);
            ganttRow.appendChild(label);
            ganttRow.appendChild(timeline);
            timelineContainer.appendChild(ganttRow);
        });
    }

    // Populate data tables
    populateDataTables(data) {
        // Yields table
        this.populateTable('yieldsTableBody', data['Yields Projections'] || [], [
            'Date', 'Région', 'Commune', 'Nombre de levées'
        ]);

        // Other tables would be populated similarly
        // This is a simplified implementation
    }

    // Generic table population
    populateTable(tableBodyId, data, columns) {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody || !data) return;

        tbody.innerHTML = '';
        
        data.slice(0, 50).forEach(row => {
            const tr = document.createElement('tr');
            
            columns.forEach(col => {
                const td = document.createElement('td');
                td.textContent = row[col] || '';
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    // Switch between tabs
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Table`).classList.add('active');
        
        // Resize charts after tab switch to ensure proper rendering
        // Use a small timeout to allow the DOM to update first
        setTimeout(() => {
            this.handleResize();
        }, 50);
    }

    // Show commune details modal/popup
    showCommuneDetails(commune) {
        // This would show a detailed view of the commune
        // For now, just log to console
        console.log('Commune details:', commune);
        
        // You could implement a modal here
        alert(`Détails pour ${commune.commune}:\n` +
              `Région: ${commune.region}\n` +
              `Total Parcelles: ${commune.totalParcels}\n` +
              `NICAD: ${commune.nicadPercentage.toFixed(1)}%\n` +
              `CTASF: ${commune.ctasfPercentage.toFixed(1)}%\n` +
              `Délibéré: ${commune.deliberatedPercentage.toFixed(1)}%\n` +
              `Géomaticien: ${commune.geomatician}`);
    }

    // Handle window resize
    handleResize() {
        // Trigger chart resize
        chartService.charts.forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
        
        chartService.gauges.forEach(gauge => {
            if (gauge && typeof gauge.resize === 'function') {
                gauge.resize();
            }
        });
    }

    // Set up auto-refresh
    setupAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.refreshData(true);
        }, CONFIG.REFRESH_INTERVAL);
        
        console.log(`Auto-refresh set to ${CONFIG.REFRESH_INTERVAL / 1000 / 60} minutes`);
    }

    // Refresh data
    async refreshData(silent = false) {
        try {
            if (!silent) {
                this.showLoading(true);
            }
            
            // Clear cache to force fresh data
            dataService.clearCache();
            
            // Reload data
            await this.loadData();
            
            if (!silent) {
                this.showSuccess('Données actualisées avec succès');
            }
            
            return true;
        } catch (error) {
            console.error('Error refreshing data:', error);
            if (!silent) {
                this.showError('Erreur lors de l\'actualisation des données');
            }
            return false;
        } finally {
            if (!silent) {
                this.showLoading(false);
            }
        }
    }

    // Show loading overlay
    showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            if (show) {
                overlay.style.display = 'flex';
            } else {
                overlay.style.display = 'none';
            }
        }
    }

    // Show success message
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // Show error message  
    showError(message) {
        this.showNotification(message, 'error');
    }

    // Show warning message
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    // Show notification (simple implementation)
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        // Set background color based on type
        const colors = {
            success: '#22C55E',
            error: '#EF4444', 
            warning: '#F59E0B',
            info: '#3B82F6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Destroy dashboard
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        chartService.destroyAllCharts();
        liquidProgressService.destroy();
        
        console.log('Dashboard destroyed');
    }
}

// Add notification animations
const notificationCSS = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;

// Inject notification CSS
const notificationStyle = document.createElement('style');
notificationStyle.textContent = notificationCSS;
document.head.appendChild(notificationStyle);

// Initialize dashboard when DOM is loaded, but only if not already initialized by enhancedDashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a moment to check if enhanced dashboard has been initialized
    setTimeout(async () => {
        // Only initialize if no other dashboard has been initialized
        if (!window.dashboardInitialized && !window.enhancedDashboard) {
            console.log('Initializing Legacy Cadastre Senegal Dashboard...');
            
            window.dashboard = new Dashboard();
            
            try {
                await window.dashboard.initialize();
                console.log('Legacy Dashboard ready!');
                window.dashboardInitialized = true;
            } catch (error) {
                console.error('Failed to initialize legacy dashboard:', error);
            }
        } else {
            console.log('Skipping legacy dashboard initialization as enhanced dashboard is already active');
        }
    }, 200); // Wait a bit longer than the enhanced dashboard initialization
});
