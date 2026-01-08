/**
 * PROCASSEF Data Aggregation Service
 * High-resilience aggregation, KPI calculation & trend utilities.
 * - Aggressive key normalization to tolerate header drift
 * - Defensive numeric extraction (multi-candidate + heuristic fallback)
 * - Safe date parsing & timeframe filtering
 * - Daily KPI fallback to last non-empty date
 */
class DataAggregationService {
    constructor() {
        this.config = {
            dailyGoal: 833, // Rounded from 832.777777777778
            weeklyGoal: 5829, // Rounded from 5829.39
            monthlyGoal: 60830, // Rounded target
            qualityThreshold: 95,
            ctasfConversionThreshold: 90
        };
    }

    // Normalize header keys (accent/space/separator insensitive)
    _normalizeKey(str) {
        if (!str && str !== 0) return '';
        try {
            return String(str)
                .trim()
                .toLowerCase()
                .replace(/\u00A0/g, ' ')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9 ]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        } catch (e) {
            return String(str).trim().toLowerCase();
        }
    }

    // Build normalized map & fetch numeric field
    _getNumericField(row, headerCandidates) {
        if (!row || typeof row !== 'object') return 0;
        if (!Array.isArray(headerCandidates) || headerCandidates.length === 0) return 0;
        if (!row.__normalizedMap) {
            const map = {};
            for (const key of Object.keys(row)) {
                map[this._normalizeKey(key)] = key;
            }
            Object.defineProperty(row, '__normalizedMap', { value: map, enumerable: false });
        }
        for (const candidate of headerCandidates) {
            const norm = this._normalizeKey(candidate);
            const original = row.__normalizedMap[norm];
            if (original && row[original] !== undefined && row[original] !== null && row[original] !== '') {
                const raw = String(row[original]).replace(/\s+/g, '').replace(/,/g, '.');
                const num = Number(raw);
                if (!isNaN(num)) return num;
            }
        }
        return 0;
    }

    /**
     * Finds a sheet in the raw data object using fuzzy matching and multiple candidates
     */
    _findSheet(rawData, candidates) {
        if (!rawData || typeof rawData !== 'object') return [];

        // 1. Precise match
        for (const cand of candidates) {
            if (rawData[cand] && Array.isArray(rawData[cand])) return rawData[cand];
        }

        // 2. Normalized match
        const normCandidates = candidates.map(c => this._normalizeKey(c));
        const rawKeys = Object.keys(rawData);

        for (const key of rawKeys) {
            const normKey = this._normalizeKey(key);
            if (normCandidates.includes(normKey)) {
                return rawData[key];
            }
        }

        // 3. Partial match (if still not found)
        for (const key of rawKeys) {
            const normKey = this._normalizeKey(key);
            for (const nCand of normCandidates) {
                if (normKey.includes(nCand) || nCand.includes(normKey)) {
                    if (Array.isArray(rawData[key])) return rawData[key];
                }
            }
        }

        return [];
    }

    // ===== KPI CALCULATIONS =====
    calculateYieldsKPI(data, timeframe) {
        const target = timeframe === 'daily' ? this.config.dailyGoal : timeframe === 'weekly' ? this.config.weeklyGoal : timeframe === 'monthly' ? this.config.monthlyGoal : this.config.dailyGoal;
        let current = 0;
        if (Array.isArray(data) && data.length) {
            const fieldCandidates = ['Nombre de levées', 'Nombre de Levées', 'nombre de levées', 'nombre de levees', 'Nombre de levees', 'Nombre Levées', 'Nombre Levees', 'levées', 'levees', 'nombre levées', 'nombre levees', 'Nombre_de_levées', 'nombre_de_levées', 'nombredelevees', 'NombreDeLevees', 'parcels collected', 'parcelcount', 'parcels', 'count'];
            current = data.reduce((sum, row) => {
                let val = this._getNumericField(row, fieldCandidates);
                if (val === 0) {
                    try {
                        for (const k of Object.keys(row)) {
                            const nk = this._normalizeKey(k);
                            if (/lev/.test(nk)) {
                                const num = Number(String(row[k]).replace(/\s+/g, '').replace(/,/g, '.'));
                                if (!isNaN(num) && num > 0) { val = num; break; }
                            }
                        }
                    } catch (_) { }
                }
                return sum + val;
            }, 0);
        }

        // Round values for better display
        current = Math.round(current);
        const roundedTarget = Math.round(target);

        // Calculate percentage with rounded values
        const percentage = roundedTarget > 0 ? Math.min(Math.max(Math.round((current / roundedTarget) * 100), 0), 100) : 0;
        const gap = current - roundedTarget;

        // console.log(`${timeframe} KPI calculated:`, { current, target: roundedTarget, percentage, gap });

        return { current, target: roundedTarget, percentage, gap, status: this.getStatusFromPercentage(percentage) };
    }

    calculateQualityKPI(data) {
        let sansErreur = 0, avecErreur = 0;
        if (Array.isArray(data) && data.length) {
            sansErreur = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre de parcelles affichées sans erreurs', 'parcelles affichées sans erreurs']), 0);
            avecErreur = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre Parcelles avec erreur', 'parcelles avec erreur']), 0);
        }
        const total = sansErreur + avecErreur;
        const rate = total > 0 ? Math.round((sansErreur / total) * 100) : 0;
        const status = rate >= this.config.qualityThreshold ? 'success' : (rate >= this.config.qualityThreshold * 0.8 ? 'warning' : 'danger');
        return { sansErreur, avecErreur, total, rate, status };
    }

    calculateCTASFKPI(data) {
        let total = 0, retained = 0, toDeliberate = 0, deliberated = 0;
        if (Array.isArray(data) && data.length) {
            total = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles emmenées au CTASF', 'nombre parcelles emmenées au CTASF', 'nombre parcelles emmenées']), 0);
            retained = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles retenues CTASF', 'nombre parcelles retenues', 'parcelles retenues']), 0);
            toDeliberate = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles à délibérer', 'nombre parcelles a deliberer', 'parcelles à délibérer']), 0);
            deliberated = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles délibérées', 'nombre parcelles deliberees', 'parcelles délibérées']), 0);
        }
        const rate = total > 0 ? Math.round((retained / total) * 100) : 0;
        const deliberationRate = toDeliberate > 0 ? Math.round((deliberated / toDeliberate) * 100) : 0;
        const status = rate >= this.config.ctasfConversionThreshold ? 'success' : (rate >= this.config.ctasfConversionThreshold * 0.8 ? 'warning' : 'danger');
        return { total, retained, toDeliberate, deliberated, rate, deliberationRate, status };
    }

    calculateProcessingKPI(data) {
        let received = 0, processed = 0, individualJoined = 0, collectiveJoined = 0, noJoin = 0, returned = 0;
        if (Array.isArray(data) && data.length) {
            received = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles reçues (Brutes)', 'parcelles recues brutes', 'parcelles reçues']), 0);
            processed = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles post traitées (Sans Doublons et topoplogie correcte)', 'parcelles post traitee', 'parcelles post traitees']), 0);
            individualJoined = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles individuelles Jointes', 'parcelles individuelles jointes']), 0);
            collectiveJoined = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles collectives Jointes', 'parcelles collectives jointes']), 0);
            noJoin = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles sans jointure', 'parcelles sans jointure']), 0);
            returned = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles retournées aux topos', 'parcelles retournees aux topos']), 0);
        }
        const rate = received > 0 ? Math.min(Math.round((processed / received) * 100), 100) : 0;
        const joinRate = processed > 0 ? Math.round(((individualJoined + collectiveJoined) / processed) * 100) : 0;
        const status = rate >= 95 ? 'success' : (rate >= 80 ? 'warning' : 'danger');
        return { received, processed, individualJoined, collectiveJoined, noJoin, returned, rate, joinRate, status };
    }

    getStatusFromPercentage(p) { if (p < 30) return 'danger'; if (p < 70) return 'warning'; return 'success'; }

    getDefaultKPIs() {
        return {
            daily: { current: 0, target: 833, percentage: 0, gap: 0, status: 'danger' },
            weekly: { current: 0, target: 5829, percentage: 0, gap: 0, status: 'danger' },
            monthly: { current: 0, target: 60830, percentage: 0, gap: 0, status: 'danger' },
            quality: { sansErreur: 0, avecErreur: 0, total: 0, rate: 0, status: 'danger' },
            ctasf: { total: 0, retained: 0, toDeliberate: 0, deliberated: 0, rate: 0, deliberationRate: 0, status: 'danger' },
            processing: { received: 0, processed: 0, individualJoined: 0, collectiveJoined: 0, noJoin: 0, returned: 0, rate: 0, joinRate: 0, status: 'danger' }
        };
    }

    // Generic row-level filtering based on region / commune / timeframe
    applyFilters(rows, filters = {}, datasetName = '') {
        if (!Array.isArray(rows) || !rows.length) return rows || [];
        const { region, commune, timeframe } = filters;
        let result = rows;

        // Region filter (only if region column exists)
        if (region) {
            const regionKey = rows[0] && (('Région' in rows[0]) ? 'Région' : ('Region' in rows[0] ? 'Region' : ('region' in rows[0] ? 'region' : null)));
            if (regionKey) {
                result = result.filter(r => {
                    const val = r[regionKey];
                    return val ? String(val).toLowerCase() === String(region).toLowerCase() : false;
                });
            }
        }

        // Commune filter (only if commune column exists)
        if (commune) {
            const communeKey = rows[0] && (('Commune' in rows[0]) ? 'Commune' : ('commune' in rows[0] ? 'commune' : null));
            if (communeKey) {
                result = result.filter(r => {
                    const val = r[communeKey];
                    return val ? String(val).toLowerCase() === String(commune).toLowerCase() : false;
                });
            }
        }

        // Timeframe filter only if dataset has a usable date field and is one of the time-series sheets
        if (timeframe && ['daily', 'weekly', 'monthly'].includes(timeframe)) {
            const candidateDateKeys = ['Date', 'date', 'DATE'];
            const dateKey = candidateDateKeys.find(k => rows[0] && k in rows[0]);
            // Restrict timeframe filtering to known temporal datasets to avoid wiping dimension tables
            const temporalLike = /yield|projection|follow-up|followup|phase|timeline|processing/i.test(datasetName);
            if (dateKey && temporalLike) {
                const today = new Date();
                const start = new Date(today);
                if (timeframe === 'weekly') start.setDate(today.getDate() - 6);
                else if (timeframe === 'monthly') start.setDate(today.getDate() - 29);

                const parseFlexible = (raw) => {
                    try { if (window.UTILS && typeof UTILS.parseDateDMY === 'function') return UTILS.parseDateDMY(raw); } catch (_) { }
                    return this.parseDate(raw);
                };

                const filtered = result.filter(r => {
                    const d = parseFlexible(r[dateKey]);
                    if (!d) return false;
                    if (timeframe === 'daily') return d.toDateString() === today.toDateString();
                    return d >= start && d <= today;
                });

                // If daily filter returns empty, fallback to most recent date available to avoid blank charts
                if (filtered.length === 0 && timeframe === 'daily') {
                    let latest = null;
                    for (const r of result) {
                        const d = parseFlexible(r[dateKey]);
                        if (d && (!latest || d > latest)) latest = d;
                    }
                    if (latest) {
                        const latestStr = latest.toDateString();
                        result = result.filter(r => {
                            const d = parseFlexible(r[dateKey]);
                            return d && d.toDateString() === latestStr;
                        });
                    } else {
                        result = filtered; // remains empty
                    }
                } else if (filtered.length) {
                    result = filtered;
                }
            }
        }
        return result;
    }

    // Trend helpers
    generateTrendData(data, dateField, valueFields, days = 30) {
        if (!Array.isArray(data) || !data.length) return [];

        const dateMap = new Map();

        data.forEach(item => {
            const d = this.parseDate(item[dateField]);
            if (!d) return;
            const itemDate = this.formatDate(d);

            if (dateMap.has(itemDate)) {
                const entry = dateMap.get(itemDate);
                valueFields.forEach(f => {
                    if (item[f] !== undefined) entry[f] += Number(item[f]) || 0;
                });
            } else {
                const newEntry = {
                    date: itemDate,
                    ...valueFields.reduce((o, f) => (o[f] = Number(item[f]) || 0, o), {})
                };
                dateMap.set(itemDate, newEntry);
            }
        });

        const sortedData = Array.from(dateMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
        // console.log('Sorted trend data:', sortedData);
        return sortedData;
    }

    calculateCumulativeData(data, dateField, valueField) {
        if (!Array.isArray(data) || !data.length) return [];
        const sorted = [...data].sort((a, b) => {
            const da = this.parseDate(a[dateField]);
            const db = this.parseDate(b[dateField]);
            return da - db;
        });

        let cum = 0;
        const cumulativeData = sorted.map(item => {
            cum += Number(item[valueField]) || 0;
            return {
                date: this.formatDate(this.parseDate(item[dateField])),
                value: cum
            };
        });
        // console.log('Cumulative data:', cumulativeData);
        return cumulativeData;
    }

    // FIXED: Improved date parsing with proper DD/MM/YYYY format handling
    parseDate(d) {
        if (!d && d !== 0) return null;

        // Parsing trace suppressed

        // If d is already a Date object, don't try to parse it
        if (d instanceof Date && !isNaN(d)) {
            // Suppressed
            return d;
        }

        try {
            if (window.UTILS && typeof UTILS.parseDateDMY === 'function' && window.UTILS !== this) {
                const dt = UTILS.parseDateDMY(d);
                if (dt) { return dt; }
            }
        } catch (e) {
            // Suppressed
        }

        // Only trust native Date parsing for true ISO strings (YYYY-MM-DD...)
        const str = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const iso = new Date(str);
            if (!isNaN(iso)) { return iso; }
        }

        // Do NOT rely on new Date() for slash-formatted strings to avoid MM/DD vs DD/MM confusion
        // Always fall through to explicit DMY/MDY regex parsing for values containing '/'

        // Handle DD/MM/YYYY format (European format)
        const europeanMatch = /^([0-3]?\d)[/.-]([01]?\d)[/.-](\d{2,4})$/.exec(String(d).trim());
        if (europeanMatch) {
            const day = parseInt(europeanMatch[1], 10);
            const month = parseInt(europeanMatch[2], 10);
            let year = parseInt(europeanMatch[3], 10);

            // Handle 2-digit years - crucially important for year 2025
            if (year < 100) { year = 2000 + year; }

            // Validate ranges
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                const parsed = new Date(year, month - 1, day);
                return parsed;
            }
        }

        // Handle MM/DD/YYYY format (American format)
        const americanMatch = /^([01]?\d)[/.-]([0-3]?\d)[/.-](\d{2,4})$/.exec(String(d).trim());
        if (americanMatch) {
            const month = parseInt(americanMatch[1], 10);
            const day = parseInt(americanMatch[2], 10);
            let year = parseInt(americanMatch[3], 10);

            if (year < 100) { year = 2000 + year; }

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                const parsed = new Date(year, month - 1, day);
                return parsed;
            }
        }

        // Handle Unix timestamp (seconds)
        if (!isNaN(d) && Number(d) > 1000000000 && Number(d) < 9999999999) {
            const parsed = new Date(Number(d) * 1000);
            return parsed;
        }

        // Handle Unix timestamp (milliseconds)
        if (!isNaN(d) && Number(d) > 1000000000000) {
            const parsed = new Date(Number(d));
            return parsed;
        }

        // Suppressed
        return null;
    }

    getLatestAvailableDate(sheet) {
        if (!Array.isArray(sheet) || sheet.length === 0) return new Date();
        let latest = null;
        sheet.forEach(row => {
            const pd = this.parseDate(row['Date'] || row['date']);
            if (pd && !isNaN(pd)) {
                if (!latest || pd > latest) latest = pd;
            }
        });
        return latest || new Date();
    }

    formatDate(date) {
        if (!(date instanceof Date) || isNaN(date)) { return null; }
        const formattedDate = date.toISOString().split('T')[0];

        // Suppress 2001 warning to avoid console noise

        return formattedDate;
    }

    // Master aggregator
    calculateKPIs(rawData) {
        try {
            if (!rawData || typeof rawData !== 'object') return this.getDefaultKPIs();

            const yieldsSheet = this._findSheet(rawData, ['dailyLeveeSource', 'Daily Levee Source', 'Yields Projections', 'Yields', 'Suivi_Parcelles_journaliers']);
            const qualitySheet = this._findSheet(rawData, ['Public Display Follow-up', 'Public Display', 'Affichage']);
            const ctasfSheet = this._findSheet(rawData, ['CTASF Follow-up', 'CTASF']);
            const processingSheet = this._findSheet(rawData, ['Post Process Follow-up', 'Post Process', 'Traitement']);
            const tmSheet = this._findSheet(rawData, ['Total-Moyenne', 'Total Moyenne', 'Moyenne']);

            // console.info(`calculateKPIs: Found yields: ${yieldsSheet.length}, quality: ${qualitySheet.length}, ctasf: ${ctasfSheet.length}, processing: ${processingSheet.length}`);

            const today = this.getLatestAvailableDate(yieldsSheet);
            // console.log('Reference Date (derived from data):', this.formatDate(today));

            const dayKey = this.formatDate(today);
            const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            // console.log('Data timeframes:', {
                today: dayKey,
                weekStart: this.formatDate(weekStart),
                monthStart: this.formatDate(monthStart)
            });

            let latestDate = null;
            for (const row of yieldsSheet) {
                const pd = this.parseDate(row['Date'] || row['date']);
                if (pd && pd <= today) {
                    if (!latestDate || pd > latestDate) {
                        latestDate = pd;
                    }
                }
            }
            // console.log('Latest date with data (excluding future):', latestDate ? this.formatDate(latestDate) : 'None');

            let dailyData = yieldsSheet.filter(r => {
                const pd = this.parseDate(r['Date'] || r['date']);
                return pd && this.formatDate(pd) === dayKey;
            });

            if (!dailyData.length && latestDate) {
                // console.log('No data found for today, using most recent date:', this.formatDate(latestDate));
                const latestDateStr = this.formatDate(latestDate);
                dailyData = yieldsSheet.filter(r => {
                    const pd = this.parseDate(r['Date'] || r['date']);
                    return pd && this.formatDate(pd) === latestDateStr;
                });
                // console.log(`Found ${dailyData.length} rows for the latest date`);
            }

            let weeklyData = yieldsSheet.filter(r => {
                const pd = this.parseDate(r['Date'] || r['date']);
                return pd && pd >= weekStart && pd <= today;
            });
            // console.log(`Found ${weeklyData.length} rows for weekly data`);

            if (weeklyData.length < 3 && latestDate) {
                // console.log('Limited data found for current week, expanding time range');
                const lastWeekEnd = latestDate;
                const lastWeekStart = new Date(lastWeekEnd);
                lastWeekStart.setDate(lastWeekEnd.getDate() - 30);

                weeklyData = yieldsSheet.filter(r => {
                    const pd = this.parseDate(r['Date'] || r['date']);
                    return pd && pd >= lastWeekStart && pd <= lastWeekEnd && pd <= today;
                });
                // console.log(`Now using ${weeklyData.length} rows for weekly data (expanded time range)`);
            }

            let monthlyData = yieldsSheet.filter(r => {
                const pd = this.parseDate(r['Date'] || r['date']);
                return pd && pd >= monthStart && pd <= today;
            });
            // console.log(`Found ${monthlyData.length} rows for monthly data`);

            if (monthlyData.length < 5 && latestDate) {
                // console.log('Limited data found for current month, expanding time range');
                const lastMonthEnd = latestDate;
                const lastMonthStart = new Date(lastMonthEnd);
                lastMonthStart.setMonth(lastMonthStart.getMonth() - 2);

                monthlyData = yieldsSheet.filter(r => {
                    const pd = this.parseDate(r['Date'] || r['date']);
                    return pd && pd >= lastMonthStart && pd <= lastMonthEnd && pd <= today;
                });
                // console.log(`Now using ${monthlyData.length} rows for monthly data (expanded time range)`);
            }

            const daily = this.calculateYieldsKPI(dailyData, 'daily');
            const weekly = this.calculateYieldsKPI(weeklyData, 'weekly');
            const monthly = this.calculateYieldsKPI(monthlyData, 'monthly');

            // Expose reference dates for UI labels
            daily.refDate = this.formatDate(today);
            weekly.refDate = `${this.formatDate(weekStart)} - ${this.formatDate(today)}`;
            monthly.refDate = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

            const quality = this.calculateQualityKPI(qualitySheet);
            const ctasf = this.calculateCTASFKPI(ctasfSheet);
            const processing = this.calculateProcessingKPI(processingSheet);

            // ==== Trend calculations (improved) ====
            try {
                // Find previous day with data
                let previousDayWithData = null;
                const dailyKey = this.formatDate(today);

                // Get unique dates sorted descending
                const allDates = [...new Set(yieldsSheet.map(r => this.formatDate(this.parseDate(r['Date'] || r['date']))))]
                    .filter(d => d && d < dailyKey)
                    .sort((a, b) => b.localeCompare(a));

                if (allDates.length > 0) {
                    const prevDateStr = allDates[0];
                    const prevDayData = yieldsSheet.filter(r => this.formatDate(this.parseDate(r['Date'] || r['date'])) === prevDateStr);
                    const prevDay = this.calculateYieldsKPI(prevDayData, 'daily');
                    if (prevDay.current > 0) {
                        daily.changePct = ((daily.current - prevDay.current) / prevDay.current) * 100;
                    }
                }

                // Previous week (shifted based on data availability)
                const prevWeekEnd = new Date(weekStart); prevWeekEnd.setDate(weekStart.getDate() - 1);
                const prevWeekStart = new Date(prevWeekEnd); prevWeekStart.setDate(prevWeekEnd.getDate() - 6);
                const prevWeekData = yieldsSheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && pd >= prevWeekStart && pd <= prevWeekEnd; });
                const prevWeek = this.calculateYieldsKPI(prevWeekData, 'weekly');
                if (prevWeek.current > 0) {
                    weekly.changePct = ((weekly.current - prevWeek.current) / prevWeek.current) * 100;
                }

                // Previous month
                const prevMonthEnd = new Date(monthStart); prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
                const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
                const prevMonthData = yieldsSheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && pd >= prevMonthStart && pd <= prevMonthEnd; });
                const prevMonth = this.calculateYieldsKPI(prevMonthData, 'monthly');
                if (prevMonth.current > 0) {
                    monthly.changePct = ((monthly.current - prevMonth.current) / prevMonth.current) * 100;
                }

                // Quality previous day
                const prevQualityDayData = qualitySheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && this.formatDate(pd) === yesterdayKey && pd <= today; });
                if (prevQualityDayData.length) {
                    const prevQ = this.calculateQualityKPI(prevQualityDayData);
                    if (prevQ.rate > 0) quality.changePct = ((quality.rate - prevQ.rate) / prevQ.rate) * 100;
                }

                // Processing previous day
                const prevProcDayData = processingSheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && this.formatDate(pd) === yesterdayKey && pd <= today; });
                if (prevProcDayData.length) {
                    const prevProc = this.calculateProcessingKPI(prevProcDayData);
                    if (prevProc.rate > 0) processing.changePct = ((processing.rate - prevProc.rate) / prevProc.rate) * 100;
                }

                // CTASF previous day
                const prevCtasfDayData = ctasfSheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && this.formatDate(pd) === yesterdayKey && pd <= today; });
                if (prevCtasfDayData.length) {
                    const prevCtasf = this.calculateCTASFKPI(prevCtasfDayData);
                    if (prevCtasf.rate > 0) ctasf.changePct = ((ctasf.rate - prevCtasf.rate) / prevCtasf.rate) * 100;
                }
            } catch (trendErr) { /* silent trend failure */ }

            // ==== January 2026 Specific Logic (Goals: 12k Jan, 75k Total) ====
            try {
                // 1. Establish Timeframe
                const today = new Date(); // Should be Jan 2026 per system time
                const janStart = new Date(today.getFullYear(), 0, 1); // Jan 1st
                const janEnd = new Date(today.getFullYear(), 0, 31); // Jan 31st

                // 2. Determine January Current Total (SSOT: 'Total-Moyenne' sheet, fallback to calculation)
                let janCurrent = 0;
                let dataStart = null;

                // Try using the robustly found tmSheet
                if (tmSheet && tmSheet.length > 0) {
                    // Assume the last row with valid data is the current status
                    // Sort by date if possible, else take last
                    const lastRow = tmSheet[tmSheet.length - 1];
                    const val = this._getNumericField(lastRow, ['Total', 'total', 'Valeur', 'Value']);
                    if (val > 0) {
                        janCurrent = val;
                        // Try to get date from sheet to check freshness, but default to 'now'
                        // console.log('Using Total-Moyenne sheet for Jan Total:', janCurrent);
                    }
                }

                // Fallback: calculate from yields if Total-Moyenne failed
                if (janCurrent === 0) {
                    const janData = yieldsSheet.filter(r => {
                        const pd = this.parseDate(r['Date'] || r['date']);
                        return pd && pd >= janStart && pd <= today; // Data up to today
                    });

                    janCurrent = janData.reduce((sum, row) => {
                        const val = this._getNumericField(row, ['Nombre de levées', 'Nombre de Levées', 'nombre de levées', 'nombre de levees', 'levées', 'levees']);
                        return sum + val;
                    }, 0);
                    // console.log('Calculated Jan Total from Yields:', janCurrent);
                }

                // ---- Monthly target override ----
                try {
                    // Use configured targets if available, else default
                    const cfgDaily = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) ? window.CONFIG.TARGETS.DAILY_PARCELS : 387.1;
                    const cfgWeekly = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.WEEKLY_PARCELS) ? window.CONFIG.TARGETS.WEEKLY_PARCELS : 2710;

                    // Override calculated targets with fixed goals unless dynamic logic is needed
                    // But for tube visualization, we want the specific January goals
                    daily.target = Math.round(cfgDaily);
                    weekly.target = Math.round(cfgWeekly);

                    const dailyGoalBase = Math.floor(Number(cfgDaily) || this.config.dailyGoal);
                    // Monthly target is handled by specific January logic below, but we set a default here
                    monthly.target = 12000;

                } catch (ex) { console.warn('Goal target override failed:', ex); }

                // 4. Goals from Config
                const janGoal = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.JANUARY_2026_GOAL) ? window.CONFIG.TARGETS.JANUARY_2026_GOAL : 12000;

                // 5. Calculate Required Rate
                const daysInJan = 31;
                const dayOfMonth = today.getDate();
                const daysRemaining = Math.max(0, daysInJan - dayOfMonth);

                const remainingToGoal = Math.max(0, janGoal - janCurrent);
                const requiredDailyRate = daysRemaining > 0 ? (remainingToGoal / daysRemaining) : (remainingToGoal > 0 ? remainingToGoal : 0);

                // 6. Calculate Current Daily Average (Jan only)
                // Usable days: dayOfMonth (since Jan 1st). 
                const currentDailyAvg = dayOfMonth > 0 ? (janCurrent / dayOfMonth) : 0;

                // 7. Store in 'monthly' KPI
                monthly.current = janCurrent;
                monthly.target = janGoal;
                monthly.percentage = janGoal > 0 ? Math.min(Math.round((janCurrent / janGoal) * 100), 100) : 0;
                monthly.gap = janCurrent - janGoal;
                monthly.status = this.getStatusFromPercentage(monthly.percentage);

                // Attach forecast data for UI
                monthly.forecast = {
                    janCurrent: Math.round(janCurrent),
                    janGoal: janGoal,
                    daysRemaining: daysRemaining,
                    remainingToGoal: Math.round(remainingToGoal),
                    requiredDailyRate: Math.round(requiredDailyRate),
                    currentDailyAvg: Math.round(currentDailyAvg),
                    achievable: currentDailyAvg >= requiredDailyRate,
                    alert: currentDailyAvg >= requiredDailyRate ? 'Objectif Atteignable' : 'Attention: Rythme Insuffisant'
                };

                // console.log('January 2026 Logic Applied:', monthly.forecast);

            } catch (janErr) {
                // console.warn('January logic failed:', janErr);
            }

            return { daily, weekly, monthly, quality, ctasf, processing };
        } catch (e) {
            console.error('calculateKPIs failed:', e);
            return this.getDefaultKPIs();
        }
    }
}

// Create global instance
window.dataAggregationService = new DataAggregationService();