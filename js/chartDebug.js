// Debug script to fix chart issues
document.addEventListener('DOMContentLoaded', async () => {
    // Wait until everything else is loaded
    setTimeout(() => {
        console.log('Running chart debug script...');
        
        // Check if charts are loaded
        const allChartCanvases = document.querySelectorAll('canvas');
        console.log(`Found ${allChartCanvases.length} canvas elements`);
        
        // Check if chartService is available
        if (!window.chartService) {
            console.warn('Chart service not found, creating one');
            window.chartService = new ChartService();
        }
        
        // Check if dashboard is initialized
        if (window.dashboard && window.dashboard.rawData) {
            console.log('Re-initializing charts with existing data');
            try {
                // Re-initialize charts with existing data
                window.chartService.initializeCharts(window.dashboard.rawData);
                
                // Force a redraw
                setTimeout(() => {
                    console.log('Forcing chart redraw');
                    window.dispatchEvent(new Event('resize'));
                }, 300);
            } catch (error) {
                console.error('Error in chart debug script:', error);
            }
        } else {
            console.error('Dashboard or rawData not available for chart debugging');
        }
    }, 2000); // Wait 2 seconds after page load
});
