/**
 * Localization helper for the dashboard
 * Adds French localization for dates and numbers
 */

// Configure Moment.js to use French locale by default
if (window.moment) {
    moment.locale('fr');
}

// Configure Chart.js global options for better localization
if (window.Chart) {
    // Add French number formatting
    Chart.defaults.locale = 'fr-FR';
    
    // Custom tooltip callbacks for better number formatting
    Chart.defaults.plugins.tooltip.callbacks = {
        ...Chart.defaults.plugins.tooltip.callbacks,
        label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed.y !== null) {
                // Format numbers with French formatting (space as thousands separator)
                label += new Intl.NumberFormat('fr-FR').format(context.parsed.y);
            }
            return label;
        }
    };
}
