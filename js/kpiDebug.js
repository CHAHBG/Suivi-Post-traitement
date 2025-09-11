/**
 * Log the KPI calculation process with detailed information
 * This will help diagnose the issue with the KPI calculation
 */
function debugKpiCalculation() {
    // Get raw data from dashboard
    const rawData = window.dashboard?.rawData;
    if (!rawData) {
        console.error('No raw data found in dashboard');
        return;
    }
    
    // Find yields data
    let yieldsData = null;
    const possibleKeys = ['Yields Projections', 'yieldsProjections', 'yields_projection'];
    
    for (const key of possibleKeys) {
        if (rawData[key] && Array.isArray(rawData[key])) {
            yieldsData = rawData[key];
            console.log(`Found yields data with key: "${key}", rows: ${yieldsData.length}`);
            break;
        }
    }
    
    if (!yieldsData) {
        console.error('Could not find yields data with any of the expected keys');
        
        // Let's check what keys we actually have
        console.log('Available sheet keys:', Object.keys(rawData));
        return;
    }
    
    // Log the first row to see the structure
    if (yieldsData.length > 0) {
        console.log('First yields row structure:', yieldsData[0]);
        console.log('Field names in first row:', Object.keys(yieldsData[0]));
    }
    
    // Test the numeric field extraction
    if (yieldsData.length > 0 && window.dataAggregationService) {
        const row = yieldsData[0];
        const fieldCandidates = ['Nombre de levées', 'nombre de levees', 'nombre de levees', 'nombre de levées'];
        
        console.log('Testing field extraction:');
        for (const candidate of fieldCandidates) {
            const value = window.dataAggregationService._getNumericField(row, [candidate]);
            console.log(`  Field "${candidate}": ${value}`);
        }
        
        // Comprehensive test of all variants
        const combinedValue = window.dataAggregationService._getNumericField(row, fieldCandidates);
        console.log(`Combined field extraction result: ${combinedValue}`);
        
        // Check if dates match the current timeframe
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let inTimeframeCount = 0;
        for (const row of yieldsData) {
            try {
                const dateStr = row.Date;
                if (!dateStr) continue;
                
                const dateParts = dateStr.split('/');
                if (dateParts.length !== 3) continue;
                
                // Parse date (assuming format: DD/MM/YYYY)
                const rowDate = new Date(
                    parseInt(dateParts[2]), 
                    parseInt(dateParts[1]) - 1, 
                    parseInt(dateParts[0])
                );
                
                if (isNaN(rowDate.getTime())) {
                    // Try alternate format (MM/DD/YYYY)
                    const rowDateAlt = new Date(
                        parseInt(dateParts[2]), 
                        parseInt(dateParts[0]) - 1, 
                        parseInt(dateParts[1])
                    );
                    
                    if (!isNaN(rowDateAlt.getTime())) {
                        if (rowDateAlt.toDateString() === today.toDateString()) {
                            inTimeframeCount++;
                            const value = window.dataAggregationService._getNumericField(row, fieldCandidates);
                            console.log(`Found matching date: ${dateStr}, value: ${value}`);
                        }
                    }
                } else {
                    if (rowDate.toDateString() === today.toDateString()) {
                        inTimeframeCount++;
                        const value = window.dataAggregationService._getNumericField(row, fieldCandidates);
                        console.log(`Found matching date: ${dateStr}, value: ${value}`);
                    }
                }
            } catch (e) {
                console.error('Error processing date:', e);
            }
        }
        
        console.log(`Rows matching today's date: ${inTimeframeCount}`);
    }
}

// Execute the debug function
debugKpiCalculation();
