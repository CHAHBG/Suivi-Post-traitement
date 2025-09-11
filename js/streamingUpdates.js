/**
 * Real-time Streaming Updates Module for PROCASSEF Dashboard
 * This module provides an interface for real-time data streaming updates to the dashboard
 * without requiring a full page refresh or complete chart recreation.
 */

(function() {
    'use strict';

    // Singleton service for handling real-time updates
    window.streamingUpdateService = {
        /**
         * Initialize the streaming update service
         */
        initialize: function() {
            console.log('Initializing Streaming Update Service...');
            this._setupEventListeners();
            return this;
        },

        /**
         * Update the dashboard with new data
         * @param {Object} newData - New data to update the dashboard with
         * @param {boolean} isPartialUpdate - Whether this is a partial update (true) or full data refresh (false)
         */
        updateDashboard: function(newData, isPartialUpdate = true) {
            console.log('Processing streaming update...');
            
            if (!window.enhancedDashboard) {
                console.error('Dashboard not initialized yet. Cannot apply streaming update.');
                return false;
            }

            // Prepare data for streaming update
            const streamingData = this._prepareData(newData);
            
            // Apply updates to tubes and charts
            return this._applyUpdates(streamingData, isPartialUpdate);
        },
        
        /**
         * Set up websocket or polling for real-time updates
         * @param {string} endpoint - API endpoint for streaming data
         * @param {Object} options - Configuration options
         */
        connectToStream: function(endpoint, options = {}) {
            // Clean up any existing connection
            this.disconnectFromStream();
            
            const defaultOptions = {
                pollingInterval: 30000, // 30 seconds
                useWebSockets: false,
                autoReconnect: true,
                reconnectInterval: 5000 // 5 seconds
            };
            
            this.streamOptions = { ...defaultOptions, ...options };
            
            if (this.streamOptions.useWebSockets && 'WebSocket' in window) {
                this._connectWebSocket(endpoint);
            } else {
                this._setupPolling(endpoint);
            }
            
            return this;
        },
        
        /**
         * Disconnect from the data stream
         */
        disconnectFromStream: function() {
            if (this.socket) {
                this.socket.close();
                this.socket = null;
            }
            
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
            
            return this;
        },
        
        /**
         * Connect to a WebSocket for real-time updates
         * @private
         * @param {string} endpoint - WebSocket endpoint
         */
        _connectWebSocket: function(endpoint) {
            try {
                this.socket = new WebSocket(endpoint);
                
                this.socket.onopen = () => {
                    console.log('WebSocket connection established');
                    this._triggerEvent('streamConnected');
                };
                
                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.updateDashboard(data, true);
                        this._triggerEvent('dataReceived', data);
                    } catch (error) {
                        console.error('Error processing WebSocket message:', error);
                    }
                };
                
                this.socket.onclose = (event) => {
                    console.log('WebSocket connection closed:', event.code, event.reason);
                    this._triggerEvent('streamDisconnected');
                    
                    // Auto-reconnect if enabled
                    if (this.streamOptions.autoReconnect) {
                        setTimeout(() => {
                            console.log('Attempting to reconnect WebSocket...');
                            this._connectWebSocket(endpoint);
                        }, this.streamOptions.reconnectInterval);
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this._triggerEvent('streamError', error);
                };
            } catch (error) {
                console.error('Error initializing WebSocket:', error);
                
                // Fallback to polling if WebSocket fails
                this._setupPolling(endpoint.replace('ws://', 'http://').replace('wss://', 'https://'));
            }
        },
        
        /**
         * Set up polling for real-time updates
         * @private
         * @param {string} endpoint - API endpoint to poll
         */
        _setupPolling: function(endpoint) {
            console.log(`Setting up polling at ${this.streamOptions.pollingInterval}ms intervals`);
            
            const pollData = () => {
                fetch(endpoint)
                    .then(response => {
                        if (!response.ok) throw new Error('Network response was not ok');
                        return response.json();
                    })
                    .then(data => {
                        this.updateDashboard(data, true);
                        this._triggerEvent('dataReceived', data);
                    })
                    .catch(error => {
                        console.error('Error polling for updates:', error);
                        this._triggerEvent('pollingError', error);
                    });
            };
            
            // Clear any existing interval
            if (this.pollingInterval) clearInterval(this.pollingInterval);
            
            // Set up new polling interval
            this.pollingInterval = setInterval(pollData, this.streamOptions.pollingInterval);
            
            // Initial poll
            pollData();
        },
        
        /**
         * Prepare data for streaming update
         * @private
         * @param {Object} newData - New data to update
         * @returns {Object} - Prepared data for streaming update
         */
        _prepareData: function(newData) {
            if (!newData) return {};
            
            // Tag data as streaming update
            return {
                ...newData,
                streamingUpdate: true,
                timestamp: new Date().toISOString()
            };
        },
        
        /**
         * Apply updates to dashboard components
         * @private
         * @param {Object} data - Data to update with
         * @param {boolean} isPartialUpdate - Whether this is a partial update
         * @returns {boolean} - Success status
         */
        _applyUpdates: function(data, isPartialUpdate) {
            try {
                // First update tubes which are more visible
                if (window.tubeProgressService && data.kpis) {
                    window.tubeProgressService.updateTubes({
                        'dailyTube': {
                            currentValue: data.kpis.dailyCompletion || 0,
                            targetValue: data.kpis.dailyTarget || 100,
                            percentage: data.kpis.dailyCompletionRate || 0
                        },
                        'weeklyTube': {
                            currentValue: data.kpis.weeklyCompletion || 0,
                            targetValue: data.kpis.weeklyTarget || 500,
                            percentage: data.kpis.weeklyCompletionRate || 0
                        },
                        'monthlyTube': {
                            currentValue: data.kpis.monthlyCompletion || 0,
                            targetValue: data.kpis.monthlyTarget || 2000,
                            percentage: data.kpis.monthlyCompletionRate || 0
                        }
                    });
                }
                
                // Then update charts which may take longer to render
                if (window.chartService) {
                    window.chartService.updateCharts(data, data.kpis, data);
                }
                
                // Update KPI displays
                if (data.kpis) {
                    if (typeof window.enhancedDashboard.updateQualityRate === 'function' && data.kpis.qualityScore !== undefined) {
                        window.enhancedDashboard.updateQualityRate(data.kpis.qualityScore);
                    }
                    
                    if (typeof window.enhancedDashboard.updateCTASFRate === 'function' && data.kpis.ctasfRate !== undefined) {
                        window.enhancedDashboard.updateCTASFRate(data.kpis.ctasfRate);
                    }
                    
                    if (typeof window.enhancedDashboard.updateProcessingRate === 'function' && data.kpis.processingRate !== undefined) {
                        window.enhancedDashboard.updateProcessingRate(data.kpis.processingRate);
                    }
                }
                
                // Update last refresh time
                if (typeof window.enhancedDashboard.updateLastRefreshTime === 'function') {
                    window.enhancedDashboard.updateLastRefreshTime();
                }
                
                this._triggerEvent('updateComplete', data);
                return true;
            } catch (error) {
                console.error('Error applying streaming updates:', error);
                this._triggerEvent('updateError', error);
                return false;
            }
        },
        
        /**
         * Set up event listeners for the streaming service
         * @private
         */
        _setupEventListeners: function() {
            // Create custom event handlers
            this.eventHandlers = {
                'streamConnected': [],
                'streamDisconnected': [],
                'streamError': [],
                'dataReceived': [],
                'updateComplete': [],
                'updateError': [],
                'pollingError': []
            };
            
            return this;
        },
        
        /**
         * Trigger a custom event
         * @private
         * @param {string} eventName - Name of event to trigger
         * @param {*} data - Data to pass with event
         */
        _triggerEvent: function(eventName, data) {
            if (!this.eventHandlers || !this.eventHandlers[eventName]) return;
            
            this.eventHandlers[eventName].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${eventName} event handler:`, error);
                }
            });
        },
        
        /**
         * Add an event listener
         * @param {string} eventName - Name of event to listen for
         * @param {Function} handler - Handler function for event
         */
        on: function(eventName, handler) {
            if (!this.eventHandlers) this._setupEventListeners();
            if (!this.eventHandlers[eventName]) this.eventHandlers[eventName] = [];
            
            this.eventHandlers[eventName].push(handler);
            return this;
        },
        
        /**
         * Remove an event listener
         * @param {string} eventName - Name of event to remove listener from
         * @param {Function} handler - Handler function to remove
         */
        off: function(eventName, handler) {
            if (!this.eventHandlers || !this.eventHandlers[eventName]) return this;
            
            if (handler) {
                this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(h => h !== handler);
            } else {
                this.eventHandlers[eventName] = [];
            }
            
            return this;
        },
        
        /**
         * Manually trigger a demo update with sample data
         * Useful for testing or demonstration purposes
         */
        triggerDemoUpdate: function() {
            console.log('Triggering demo update...');
            
            // Generate some demo data with slight variations from current values
            const demoData = this._generateDemoData();
            
            // Apply the update
            return this.updateDashboard(demoData, true);
        },
        
        /**
         * Generate demo data for testing
         * @private
         * @returns {Object} - Generated demo data
         */
        _generateDemoData: function() {
            // Get a random value within a range around a base value
            const randomizeValue = (base, range = 0.1) => {
                const min = base * (1 - range);
                const max = base * (1 + range);
                return Math.round((Math.random() * (max - min)) + min);
            };
            
            // Create demo KPIs with slight variations
            const kpis = {
                completionRate: randomizeValue(75, 0.05),
                qualityScore: randomizeValue(85, 0.03),
                efficiencyScore: randomizeValue(80, 0.04),
                ctasfRate: randomizeValue(70, 0.06),
                processingRate: randomizeValue(65, 0.07),
                
                // Tubes data
                dailyCompletion: randomizeValue(85, 0.1),
                dailyTarget: 100,
                dailyCompletionRate: 0, // Will be calculated
                
                weeklyCompletion: randomizeValue(420, 0.05),
                weeklyTarget: 500,
                weeklyCompletionRate: 0, // Will be calculated
                
                monthlyCompletion: randomizeValue(1800, 0.03),
                monthlyTarget: 2000,
                monthlyCompletionRate: 0 // Will be calculated
            };
            
            // Calculate completion rates
            kpis.dailyCompletionRate = Math.min(100, Math.round((kpis.dailyCompletion / kpis.dailyTarget) * 100));
            kpis.weeklyCompletionRate = Math.min(100, Math.round((kpis.weeklyCompletion / kpis.weeklyTarget) * 100));
            kpis.monthlyCompletionRate = Math.min(100, Math.round((kpis.monthlyCompletion / kpis.monthlyTarget) * 100));
            
            return {
                kpis: kpis,
                streamingUpdate: true,
                timestamp: new Date().toISOString()
            };
        }
    };
    
    // Auto-initialize if document is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        window.streamingUpdateService.initialize();
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            window.streamingUpdateService.initialize();
        });
    }
})();
