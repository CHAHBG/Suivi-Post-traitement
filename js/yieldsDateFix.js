/**
 * This script fixes the date format in Yields Projections data
 * to ensure proper KPI calculation
 */
(function() {
    // Wait for dashboard to be initialized
    function waitForDashboard() {
        if (window.dashboard && window.dashboard.rawData && window.dataAggregationService) {
            fixYieldsDates();
        } else {
            setTimeout(waitForDashboard, 200);
        }
    }
    
    // Fix date formats in yields data
    function fixYieldsDates() {
        const rawData = window.rawData;
        if (!rawData) return;
        
        const potentialKeys = [
            'Yields Projections',
            'yieldsProjections',
            'yields_projection',
            'Collection Projections'
        ];
        
        // Find yields data with any of the potential keys
        let yieldsData = null;
        let yieldsKey = null;
        
        for (const key of potentialKeys) {
            if (rawData[key] && Array.isArray(rawData[key])) {
                yieldsData = rawData[key];
                yieldsKey = key;
                // console.log(`Found yields data with key: "${key}", rows: ${yieldsData.length}`);
                break;
            }
        }
        
        if (!yieldsData) {
            // console.warn('Could not find yields data with any of the expected keys');
            return;
        }
        
        // Now check and fix the date formats
        let fixedDateCount = 0;
        
        for (let i = 0; i < yieldsData.length; i++) {
            const row = yieldsData[i];
            
            // Skip rows without a date
            if (!row.Date) continue;
            
            const dateStr = row.Date;
            
            // Check if date is already in a valid format
            const originalDate = new Date(dateStr);
            if (!isNaN(originalDate.getTime())) continue;
            
            // Try to use the centralized date parsing function if available
            if (window.dataAggregationService && typeof window.dataAggregationService.parseDate === 'function') {
                const parsedDate = window.dataAggregationService.parseDate(dateStr);
                if (parsedDate) {
                    // Format as MM/DD/YYYY for JavaScript compatibility
                    const newDateStr = `${parsedDate.getMonth()+1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`;
                    row.Date = newDateStr;
                    fixedDateCount++;
                    continue;
                }
            }
            
            // Fallback: Try to fix the date format manually
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    // Try to parse as DD/MM/YYYY
                    try {
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1;
                        const year = parseInt(parts[2]);
                        
                        // Create a new date in the format MM/DD/YYYY for JavaScript compatibility
                        const newDateStr = `${month+1}/${day}/${year}`;
                        const newDate = new Date(newDateStr);
                        
                        if (!isNaN(newDate.getTime())) {
                            // Replace the original date with the fixed one
                            row.Date = newDateStr;
                            fixedDateCount++;
                        }
                    } catch (e) {
                        // console.warn(`Failed to fix date format for: ${dateStr}`, e);
                    }
                }
            }
        }
        
        if (fixedDateCount > 0) {
            // console.log(`Fixed ${fixedDateCount} dates in yields data`);
            
            // Force recalculation of KPIs
            if (window.dataAggregationService) {
                const kpis = window.dataAggregationService.calculateKPIs(rawData);
                // console.log('Recalculated KPIs after date fix:', kpis.daily);
            }
        }
    }
    
    // Start checking
    waitForDashboard();
})();
