/**
 * Centralized Date Handling Loader
 * This script ensures that dataAggregationService is loaded and properly initialized
 * before other components that depend on its date parsing functionality.
 */
(function() {
    // console log suppressed
    
    // Wait for document to be ready
    function onDocumentReady() {
        // Create dataAggregationService if it doesn't exist
        if (!window.dataAggregationService) {
            // console log suppressed
            window.dataAggregationService = new DataAggregationService();
        }
        
        // Export the parseDate function globally for easy access
        if (!window.UTILS) {
            window.UTILS = {};
        }
        
        // Make sure UTILS.parseDateDMY references the dataAggregationService.parseDate function
        window.UTILS.parseDateDMY = function(dateStr) {
            return window.dataAggregationService.parseDate(dateStr);
        };
        
        // Also standardize the formatDate function
        window.UTILS.formatDate = function(date) {
            return window.dataAggregationService.formatDate(date);
        };
        
    // console log suppressed
    }
    
    // Initialize when document is ready
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(onDocumentReady, 1);
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady);
    }
})();
