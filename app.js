/**
 * Legacy app.js file
 * 
 * This file exists for backwards compatibility.
 * The dashboard now uses a modular architecture with separate files in the js/ directory.
 */

console.log('Dashboard now uses a modular architecture - see js/ directory for implementation');

// Configure Chart.js defaults for consistent styling
if (window.Chart) {
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#6B7280';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    Chart.defaults.plugins.legend.position = 'bottom';
    
    // Ensure time scale works properly with the adapter
    Chart.defaults.scales.time = {
        adapters: {
            date: {
                locale: 'fr'
            }
        }
    };
}

// Fix for chart containers stretching issue
document.addEventListener('DOMContentLoaded', function() {
    // Enforce proper aspect ratios for charts
    const resizeCharts = function() {
        const chartContainers = document.querySelectorAll('.bg-white.rounded-lg.shadow-md.p-6');
        
        chartContainers.forEach(container => {
            // Get the canvas element
            const canvas = container.querySelector('canvas');
            if (!canvas) return;
            
            // Apply max height constraint
            if (canvas.id.endsWith('Chart')) {
                canvas.style.maxHeight = 'var(--chart-height-regular)';
            } else if (canvas.id.endsWith('Gauge')) {
                canvas.style.height = 'var(--gauge-size)';
                canvas.style.width = 'var(--gauge-size)';
            }
            
            // Ensure the container has proper constraints
            container.style.overflow = 'hidden';
            
            // Force chart to respect container size
            if (canvas._chart) {
                canvas._chart.resize();
            }
        });
    };
    
    // Apply initial sizing
    setTimeout(resizeCharts, 500);
    
    // Re-apply on window resize
    window.addEventListener('resize', resizeCharts);
});
