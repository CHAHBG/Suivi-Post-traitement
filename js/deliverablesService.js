/**
 * Deliverables Service
 * Handles fetching, parsing, and analyzing project deliverables data
 */

class DeliverablesService {
    constructor() {
        this.deliverables = [];
        this.statistics = null;
        this.totalsFromSheet = null;
    }

    /**
     * Fetch deliverables data from Google Sheets
     */
    async fetchDeliverables() {
        try {
            const config = window.GOOGLE_SHEETS.deliverables;
            const response = await fetch(config.url, { cache: 'no-cache' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const csvText = await response.text();
            const rawData = window.UTILS.parseCSV(csvText);

            console.log('Deliverables raw data rows:', rawData.length);

            // Parse and structure the data
            this.deliverables = this.parseDeliverables(rawData);

            console.log('Parsed deliverables:', this.deliverables.length);

            // Calculate statistics
            this.statistics = this.calculateStatistics();

            console.log('Statistics:', this.statistics);

            return {
                deliverables: this.deliverables,
                statistics: this.statistics
            };
        } catch (error) {
            console.error('Error fetching deliverables:', error);
            return {
                deliverables: [],
                statistics: this.getDefaultStatistics()
            };
        }
    }

    /**
     * Normalize expert names to handle typos
     */
    normalizeExpertName(expert) {
        if (!expert) return 'Non assigné';

        const normalized = expert.trim();

        // Normalize common variations
        const mappings = {
            'Chef de Mission': ['Chef de Mission', 'chef de mission'],
            'Expert COM': ['Expert COM', 'expert com'],
            'Experts Géomètres': ['Experts Géomètres', 'experts géomètres', 'Expert Géomètre'],
            'Expert Foncier': ['Expert Foncier', 'expert foncier'],
            'Experts SIG/SIF': ['Experts SIG/SIF', 'experts sig/sif', 'Expert SIG/SIF', 'Experts  SIG/SIF', 'Expert SIG /SIF et Géomètres', 'Experts SIG/SIF  et Géomètres'],
            'Expert POAS': ['Expert POAS', 'expert poas'],
            'Experts Genre-Environnement et Social': ['Experts Genre -Environnement et Social', 'Experts Genre-Environnement et Social', 'experts genre']
        };

        for (const [canonical, variants] of Object.entries(mappings)) {
            if (variants.some(v => normalized.toLowerCase().includes(v.toLowerCase()))) {
                return canonical;
            }
        }

        return normalized;
    }

    /**
     * Parse raw CSV data into structured deliverables
     */
    parseDeliverables(rawData) {
        if (!rawData || !Array.isArray(rawData)) return [];

        const deliverables = [];
        let lastExpert = 'Non assigné';
        let lastNature = '';
        let lastPercentage = 0;
        let lastDuration = '';
        let currentMainDeliverable = '';
        let currentNature = '';
        let skippedCount = 0;
        let totalsRow = null;

        // Reset trackers when we encounter a new main deliverable that clearly resets context
        // But usually in this sheet, the context flows down until changed.

        rawData.forEach((row, idx) => {
            // Get the values
            const indexCol = row['Index  Livrable'] || row['Index'] || '';
            // Clamp values to 0 or 1 to prevent double counting
            // Clamp values to 0 or 1 to prevent double counting (and only if Nbre Base > 0 for consistency)
            const nbreBase = parseInt(row['Nbre Base']) || 0;

            // Detect and save the totals row FIRST (before clamping values)
            // Totals row has high Nbre Base value like 68
            if (nbreBase > 10) {
                // For totals row, use RAW values, not clamped
                const rawValide = parseInt(row['Validé']) || 0;
                const rawEnExamen = parseInt(row['En Examen']) || 0;
                const rawEnRetard = parseInt(row['En retard']) || 0;
                const rawAVenir = parseInt(row['A venir']) || 0;

                console.log(`Found totals row at index ${idx}: Nbre Base=${nbreBase}, Validé=${rawValide}, En Examen=${rawEnExamen}, En Retard=${rawEnRetard}, À Venir=${rawAVenir}`);
                totalsRow = {
                    total: nbreBase,
                    valides: rawValide,
                    enExamen: rawEnExamen,
                    enRetard: rawEnRetard,
                    aVenir: rawAVenir
                };
                return;
            }

            // Only count status if this is a "Base" deliverable to avoid double counting sub-rows
            // UNLESS nbreBase is 0 but it's a valid row we want to track? 
            // The user complaint 76/38 (200%) suggests we are counting items with NbreBase=0.
            // So we force status to 0 if nbreBase is 0.
            const valide = (nbreBase > 0 && (parseInt(row['Validé']) || 0) > 0) ? 1 : 0;
            const enExamen = (nbreBase > 0 && (parseInt(row['En Examen']) || 0) > 0) ? 1 : 0;
            const enRetard = (nbreBase > 0 && (parseInt(row['En retard']) || 0) > 0) ? 1 : 0;
            const aVenir = (nbreBase > 0 && (parseInt(row['A venir']) || 0) > 0) ? 1 : 0;

            // Skip rows that have no status at all (Nbre Base = 0 AND all status = 0)
            if (nbreBase === 0 && valide === 0 && enExamen === 0 && enRetard === 0 && aVenir === 0) {
                skippedCount++;
                return;
            }

            // --- Fill Down Logic Updates ---

            // Experts
            const rowExpert = row['Experts Princip'];

            // DEBUG: Trace First 20 rows to see what is happening
            if (idx < 20) {
                console.log(`[DEBUG] Row ${idx}: Index='${indexCol}', Expert='${rowExpert}', row['Experts Princip']='${row['Experts Princip']}', lastExpert='${lastExpert}'`);
                if (idx === 0) console.log('[DEBUG] Row Keys:', Object.keys(row));
            }

            if (rowExpert && rowExpert.trim() !== '') {
                lastExpert = rowExpert;
            }

            // Nature
            const rowNature = row['NATURE LIVRABLES'];
            if (rowNature && rowNature.trim() !== '') {
                lastNature = rowNature;
            }

            // Percentage
            const rowPercentage = row['%  SUR LE MONTANT HT'];
            if (rowPercentage && rowPercentage.trim() !== '') {
                lastPercentage = parseFloat(rowPercentage) || 0;
            }

            // Duration
            const rowDuration = row['DUREE'];
            if (rowDuration && rowDuration.trim() !== '') {
                lastDuration = rowDuration;
            }

            // --------------------------------

            // Check if this is a main deliverable (has Liv. X.X)
            if (indexCol && indexCol.includes('Liv.')) {
                currentMainDeliverable = indexCol.trim();
                // If the row explicitly has nature, we updated lastNature above.
                // If not, we might rely on lastNature, but usually main deliverables have it.
                currentNature = lastNature;
            }

            // Get the date - prioritize Date ajustée, fallback to DATE
            // Ensure we don't end up with "null" string
            // Handle variations in column names (extra spaces are common in this sheet)
            let dateAjustee = row['Date ajustée'] || row['Date  ajustée'] || row['Date ajustee'];
            if (String(dateAjustee).toLowerCase() === 'null' || !dateAjustee) dateAjustee = '';

            let dateCol = row['DATE'] || row['Date'] || row['date'];
            if (String(dateCol).toLowerCase() === 'null' || !dateCol) dateCol = '';

            const finalDate = dateAjustee || dateCol;

            // Create a unique identifier for sub-deliverables
            let displayIndex = currentMainDeliverable || `Row ${idx + 1}`;

            // For displayName, use the Nature. 
            // If it's a sub-row (no index) but has a date, it inherits the nature of the main deliverable.
            let displayName = lastNature || 'Sans titre';

            // If this is a sub-deliverable (no Liv. but has a date), append the date to the index
            // to make it distinct in the list
            if (!indexCol.includes('Liv.') && finalDate && currentMainDeliverable) {
                displayIndex = `${currentMainDeliverable} - ${finalDate}`;
            } else if (indexCol) {
                displayIndex = indexCol; // Use the actual index if present
            }

            const deliverable = {
                numero: row['N°'] || '',
                index: displayIndex,
                livrable: displayName,
                nature: lastNature,
                percentage: lastPercentage,
                duree: lastDuration,
                date: finalDate,
                dateAjustee: dateAjustee,
                expert: this.normalizeExpertName(lastExpert), // Use the filled-down expert
                statutRaw: row['STATUT AU JUILLET  A OCTOBRE 2025'] || '', // Keep original for date extraction
                statut: this.deriveStatus(valide, enExamen, enRetard, aVenir), // Derived status
                nbreBase: nbreBase,
                valide: valide,
                enExamen: enExamen,
                enRetard: enRetard,
                aVenir: aVenir
            };

            // Calculate alert status
            deliverable.alertStatus = this.calculateAlertStatus(deliverable);

            deliverables.push(deliverable);
        });

        console.log('Total deliverables parsed:', deliverables.length);
        console.log('Skipped empty rows (Nbre Base = 0):', skippedCount);

        // Store the totals row for use in statistics
        this.totalsFromSheet = totalsRow;

        if (totalsRow) {
            console.log('Using totals from sheet:', totalsRow);
        } else {
            console.warn('No totals row found! Will calculate from individual rows.');
        }

        return deliverables;
    }

    /**
     * Derive status string from counts
     */
    deriveStatus(valide, enExamen, enRetard, aVenir) {
        if (valide > 0) return 'Validé';
        if (enExamen > 0) return 'En examen';
        if (enRetard > 0) return 'En retard';
        if (aVenir > 0) return 'À venir';
        return 'Non assigné';
    }

    /**
     * Extract validation date from STATUT column
     * Handles formats like: "validé le 19/07/2024", "Validé le 18/11/2024", "validé le 25/11/25"
     */
    /**
     * Extract validation date from STATUT column
     * Handles formats like: "validé le 19/07/2024", "Validé le 18/11/2024", "validé le 25/11/25"
     */
    extractValidationDate(statut) {
        if (!statut) return null;

        // Normalize spaces and lowercase
        const normalized = statut.toLowerCase().replace(/\s+/g, ' ').trim();

        // Match patterns like "le DD/MM/YYYY" or "le DD/MM/YY"
        // We look for "le" followed by a date, which covers "validé le", "validée le", etc.
        const match = normalized.match(/le\s+(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);

        if (!match) {
            // Debug failure only if it looks like it SHOULD match (contains "valid")
            if (normalized.includes('valid') && normalized.includes('/')) {
                console.log(`Failed to extract date from: "${statut}" (normalized: "${normalized}")`);
            }
            return null;
        }

        let day = parseInt(match[1], 10);
        let month = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);

        // Handle 2-digit years
        if (year < 100) {
            year = 2000 + year;
        }

        const date = new Date(year, month - 1, day);

        // Verify valid date
        if (isNaN(date.getTime())) return null;

        // Debug successful extraction
        console.log(`Extracted date from "${statut}": ${date.toLocaleDateString()}`);

        return date;
    }

    /**
     * Calculate alert status for a deliverable
     */
    calculateAlertStatus(deliverable) {
        // Don't show alert for validated deliverables
        if (deliverable.valide > 0 || deliverable.statut === 'Validé') {
            return null;
        }

        const today = new Date();
        const dateToUse = deliverable.date; // Already prioritized dateAjustee in parsing
        const dueDate = window.UTILS.parseDateDMY(dateToUse);

        if (!dueDate) {
            return { level: 'unknown', color: 'gray', icon: '❓', label: 'Date inconnue' };
        }

        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        return { level: 'normal', color: 'blue', icon: '📌', label: 'À venir', daysUntilDue };
    }

    /**
     * Calculate comprehensive statistics
     */
    calculateStatistics() {
        if (!this.deliverables || this.deliverables.length === 0) {
            return this.getDefaultStatistics();
        }

        const stats = {
            total: 0,
            valides: 0,
            enExamen: 0,
            enRetard: 0,
            aVenir: 0,
            validesATemps: 0,
            validesEnRetard: 0,
            retardMoyen: 0,
            plusGrandRetard: 0,
            plusGrandRetardLivrable: '',
            byExpert: {},
            byStatus: {
                success: 0,
                danger: 0,
                warning: 0,
                info: 0,
                normal: 0
            }
        };

        // Use totals from the sheet if available
        if (this.totalsFromSheet) {
            stats.total = this.totalsFromSheet.total;
            stats.valides = this.totalsFromSheet.valides;
            stats.enExamen = this.totalsFromSheet.enExamen;
            stats.enRetard = this.totalsFromSheet.enRetard;
            stats.aVenir = this.totalsFromSheet.aVenir;
            console.log('Using totals from sheet totals row');
        } else {
            // Fallback: calculate from deliverables
            stats.total = this.deliverables.length;
            this.deliverables.forEach(d => {
                stats.valides += d.valide;
                stats.enExamen += d.enExamen;
                stats.enRetard += d.enRetard;
                stats.aVenir += d.aVenir;
            });
            console.log('Calculated totals from individual rows');
        }

        let totalRetard = 0;
        let countRetards = 0;

        this.deliverables.forEach(d => {
            // Count by alert level
            if (d.alertStatus) {
                stats.byStatus[d.alertStatus.level] = (stats.byStatus[d.alertStatus.level] || 0) + 1;
            }

            // Calculate delays for validated deliverables
            // Compare validation date (from STATUT) with due date (Date ajustée or DATE)
            if (d.valide > 0) {
                // d.date might be a Date object (from Excel) or a string
                let dueDate = d.date;
                if (typeof dueDate === 'string') {
                    dueDate = window.UTILS.parseDateDMY(dueDate);
                }

                // Use statutRaw for date extraction as distinct columns don't have dates
                const validationDate = this.extractValidationDate(d.statutRaw);

                if (dueDate instanceof Date && !isNaN(dueDate) && validationDate) {
                    // Calculate delay in days (positive = late, negative = early)
                    const delayDays = Math.ceil((validationDate - dueDate) / (1000 * 60 * 60 * 24));

                    // Debug calculation
                    // console.log(`Stats: ${d.nom} | Due: ${dueDate.toLocaleDateString()} | Valid: ${validationDate.toLocaleDateString()} | Delay: ${delayDays}`);

                    if (delayDays > 0) {
                        // Validated late
                        stats.validesEnRetard++;
                        totalRetard += delayDays;
                        countRetards++;

                        if (delayDays > stats.plusGrandRetard) {
                            stats.plusGrandRetard = delayDays;
                            stats.plusGrandRetardLivrable = d.index;
                        }
                    } else {
                        // Validated on time or early
                        stats.validesATemps++;
                    }
                } else {
                    if (!dueDate) console.log(`Missing/Invalid Due Date for ${d.index}:`, d.date, typeof d.date);
                    if (!validationDate) console.warn(`No validation date found for ${d.index}, STATUT: "${d.statut}"`);
                }
            }


            // Group by expert (normalized)
            const expert = d.expert;
            if (!stats.byExpert[expert]) {
                stats.byExpert[expert] = { total: 0, valides: 0 };
            }

            // Count ALL deliverables (including sub-reports), not just unique ones
            // User wants to see total count including multiple reports per deliverable
            if (d.nbreBase > 0) {
                stats.byExpert[expert].total += 1;
                stats.byExpert[expert].valides += d.valide;
            }
        });

        // Calculate average delay (only for late deliverables)
        stats.retardMoyen = countRetards > 0 ? Math.round(totalRetard / countRetards) : 0;

        // Calculate on-time percentage
        const totalValides = stats.valides;
        const totalValidesWithDates = stats.validesATemps + stats.validesEnRetard;
        stats.tauxPonctualite = totalValidesWithDates > 0
            ? Math.round((stats.validesATemps / totalValidesWithDates) * 100)
            : 0;

        console.log(`Punctuality Stats: ${stats.validesATemps} on - time, ${stats.validesEnRetard} late, ${stats.tauxPonctualite}% on - time rate, ${stats.retardMoyen} days avg delay`);

        return stats;
    }

    /**
     * Get default statistics structure
     */
    getDefaultStatistics() {
        return {
            total: 0,
            valides: 0,
            enExamen: 0,
            enRetard: 0,
            aVenir: 0,
            validesATemps: 0,
            validesEnRetard: 0,
            retardMoyen: 0,
            plusGrandRetard: 0,
            plusGrandRetardLivrable: '',
            tauxPonctualite: 0,
            byExpert: {},
            byStatus: {
                success: 0,
                danger: 0,
                warning: 0,
                info: 0,
                normal: 0
            }
        };
    }

    /**
     * Filter deliverables by status
     */
    filterByStatus(status) {
        if (!status || status === 'all') return this.deliverables;

        return this.deliverables.filter(d => {
            switch (status) {
                case 'validé':
                    return d.valide > 0;
                case 'en-examen':
                    return d.enExamen > 0;
                case 'retard':
                    return d.enRetard > 0;
                case 'a-venir':
                    return d.aVenir > 0;
                default:
                    return true;
            }
        });
    }

    /**
     * Search deliverables
     */
    search(query) {
        if (!query) return this.deliverables;

        const lowerQuery = query.toLowerCase();
        return this.deliverables.filter(d => {
            return d.index.toLowerCase().includes(lowerQuery) ||
                d.livrable.toLowerCase().includes(lowerQuery) ||
                d.expert.toLowerCase().includes(lowerQuery) ||
                d.statut.toLowerCase().includes(lowerQuery);
        });
    }
}

// Create global instance
window.deliverablesService = new DeliverablesService();
