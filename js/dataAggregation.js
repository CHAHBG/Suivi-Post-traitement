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

    // ===== KPI CALCULATIONS =====
    calculateYieldsKPI(data, timeframe) {
        const target = timeframe === 'daily' ? this.config.dailyGoal : timeframe === 'weekly' ? this.config.weeklyGoal : timeframe === 'monthly' ? this.config.monthlyGoal : this.config.dailyGoal;
        let current = 0;
        if (Array.isArray(data) && data.length) {
            const fieldCandidates = ['Nombre de levées','Nombre de Levées','nombre de levées','nombre de levees','Nombre de levees','Nombre Levées','Nombre Levees','levées','levees','nombre levées','nombre levees','Nombre_de_levées','nombre_de_levées','nombredelevees','NombreDeLevees','parcels collected','parcelcount','parcels','count'];
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
                    } catch (_) {}
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
        
        console.log(`${timeframe} KPI calculated:`, { current, target: roundedTarget, percentage, gap });
        
        return { current, target: roundedTarget, percentage, gap, status: this.getStatusFromPercentage(percentage) };
    }

    calculateQualityKPI(data) {
        let sansErreur = 0, avecErreur = 0;
        if (Array.isArray(data) && data.length) {
            sansErreur = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre de parcelles affichées sans erreurs','parcelles affichées sans erreurs']), 0);
            avecErreur = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre Parcelles avec erreur','parcelles avec erreur']), 0);
        }
        const total = sansErreur + avecErreur;
        const rate = total > 0 ? Math.round((sansErreur / total) * 100) : 0;
        const status = rate >= this.config.qualityThreshold ? 'success' : (rate >= this.config.qualityThreshold * 0.8 ? 'warning' : 'danger');
        return { sansErreur, avecErreur, total, rate, status };
    }

    calculateCTASFKPI(data) {
        let total = 0, retained = 0, toDeliberate = 0, deliberated = 0;
        if (Array.isArray(data) && data.length) {
            total = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles emmenées au CTASF','nombre parcelles emmenées au CTASF','nombre parcelles emmenées']), 0);
            retained = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles retenues CTASF','nombre parcelles retenues','parcelles retenues']), 0);
            toDeliberate = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles à délibérer','nombre parcelles a deliberer','parcelles à délibérer']), 0);
            deliberated = data.reduce((s, i) => s + this._getNumericField(i, ['Nombre parcelles délibérées','nombre parcelles deliberees','parcelles délibérées']), 0);
        }
        const rate = total > 0 ? Math.round((retained / total) * 100) : 0;
        const deliberationRate = toDeliberate > 0 ? Math.round((deliberated / toDeliberate) * 100) : 0;
        const status = rate >= this.config.ctasfConversionThreshold ? 'success' : (rate >= this.config.ctasfConversionThreshold * 0.8 ? 'warning' : 'danger');
        return { total, retained, toDeliberate, deliberated, rate, deliberationRate, status };
    }

    calculateProcessingKPI(data) {
        let received = 0, processed = 0, individualJoined = 0, collectiveJoined = 0, noJoin = 0, returned = 0;
        if (Array.isArray(data) && data.length) {
            received = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles reçues (Brutes)','parcelles recues brutes','parcelles reçues']), 0);
            processed = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles post traitées (Sans Doublons et topoplogie correcte)','parcelles post traitee','parcelles post traitees']), 0);
            individualJoined = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles individuelles Jointes','parcelles individuelles jointes']), 0);
            collectiveJoined = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles collectives Jointes','parcelles collectives jointes']), 0);
            noJoin = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles sans jointure','parcelles sans jointure']), 0);
            returned = data.reduce((s, i) => s + this._getNumericField(i, ['Parcelles retournées aux topos','parcelles retournees aux topos']), 0);
        }
        const rate = received > 0 ? Math.min(Math.round((processed / received) * 100), 100) : 0;
        const joinRate = processed > 0 ? Math.round(((individualJoined + collectiveJoined) / processed) * 100) : 0;
        const status = rate >= 95 ? 'success' : (rate >= 80 ? 'warning' : 'danger');
        return { received, processed, individualJoined, collectiveJoined, noJoin, returned, rate, joinRate, status };
    }

    getStatusFromPercentage(p) { if (p < 30) return 'danger'; if (p < 70) return 'warning'; return 'success'; }

    getDefaultKPIs() {
        return {
            daily:    { current: 0, target: 833,  percentage: 0, gap: 0, status: 'danger' },
            weekly:   { current: 0, target: 5829, percentage: 0, gap: 0, status: 'danger' },
            monthly:  { current: 0, target: 60830,percentage: 0, gap: 0, status: 'danger' },
            quality:  { sansErreur: 0, avecErreur: 0, total: 0, rate: 0, status: 'danger' },
            ctasf:    { total: 0, retained: 0, toDeliberate: 0, deliberated: 0, rate: 0, deliberationRate: 0, status: 'danger' },
            processing:{ received: 0, processed: 0, individualJoined: 0, collectiveJoined: 0, noJoin: 0, returned: 0, rate: 0, joinRate: 0, status: 'danger' }
        };
    }

    // Generic row-level filtering based on region / commune / timeframe
    applyFilters(rows, filters = {}, datasetName = '') {
        if (!Array.isArray(rows) || !rows.length) return rows || [];
        const { region, commune, timeframe } = filters;
        let result = rows;

        // Region filter (only if region column exists)
        if (region) {
            const regionKey = rows[0] && (('Région' in rows[0]) ? 'Région' : ('Region' in rows[0] ? 'Region' : ( 'region' in rows[0] ? 'region' : null)));
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
        if (timeframe && ['daily','weekly','monthly'].includes(timeframe)) {
            const candidateDateKeys = ['Date','date','DATE'];
            const dateKey = candidateDateKeys.find(k => rows[0] && k in rows[0]);
            // Restrict timeframe filtering to known temporal datasets to avoid wiping dimension tables
            const temporalLike = /yield|projection|follow-up|followup|phase|timeline|processing/i.test(datasetName);
            if (dateKey && temporalLike) {
                const today = new Date();
                const start = new Date(today);
                if (timeframe === 'weekly') start.setDate(today.getDate() - 6);
                else if (timeframe === 'monthly') start.setDate(today.getDate() - 29);

                const parseFlexible = (raw) => {
                    try { if (window.UTILS && typeof UTILS.parseDateDMY === 'function') return UTILS.parseDateDMY(raw); } catch(_) {}
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
        console.log('Sorted trend data:', sortedData);
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
        console.log('Cumulative data:', cumulativeData);
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
            const yieldsSheet = rawData['Yields Projections'] || rawData['yieldsProjections'] || rawData['Yields'] || [];
            const qualitySheet = rawData['Public Display Follow-up'] || [];
            const ctasfSheet = rawData['CTASF Follow-up'] || [];
            const processingSheet = rawData['Post Process Follow-up'] || [];

            const today = new Date();
            const dayKey = this.formatDate(today);
            const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            console.log('Data timeframes:', {
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
            console.log('Latest date with data (excluding future):', latestDate ? this.formatDate(latestDate) : 'None');

            let dailyData = yieldsSheet.filter(r => {
                const pd = this.parseDate(r['Date'] || r['date']);
                return pd && this.formatDate(pd) === dayKey;
            });

            if (!dailyData.length && latestDate) {
                console.log('No data found for today, using most recent date:', this.formatDate(latestDate));
                const latestDateStr = this.formatDate(latestDate);
                dailyData = yieldsSheet.filter(r => {
                    const pd = this.parseDate(r['Date'] || r['date']);
                    return pd && this.formatDate(pd) === latestDateStr;
                });
                console.log(`Found ${dailyData.length} rows for the latest date`);
            }

            let weeklyData = yieldsSheet.filter(r => {
                const pd = this.parseDate(r['Date'] || r['date']);
                return pd && pd >= weekStart && pd <= today;
            });
            console.log(`Found ${weeklyData.length} rows for weekly data`);

            if (weeklyData.length < 3 && latestDate) {
                console.log('Limited data found for current week, expanding time range');
                const lastWeekEnd = latestDate;
                const lastWeekStart = new Date(lastWeekEnd);
                lastWeekStart.setDate(lastWeekEnd.getDate() - 30);

                weeklyData = yieldsSheet.filter(r => {
                    const pd = this.parseDate(r['Date'] || r['date']);
                    return pd && pd >= lastWeekStart && pd <= lastWeekEnd && pd <= today;
                });
                console.log(`Now using ${weeklyData.length} rows for weekly data (expanded time range)`);
            }

            let monthlyData = yieldsSheet.filter(r => {
                const pd = this.parseDate(r['Date'] || r['date']);
                return pd && pd >= monthStart && pd <= today;
            });
            console.log(`Found ${monthlyData.length} rows for monthly data`);

            if (monthlyData.length < 5 && latestDate) {
                console.log('Limited data found for current month, expanding time range');
                const lastMonthEnd = latestDate;
                const lastMonthStart = new Date(lastMonthEnd);
                lastMonthStart.setMonth(lastMonthStart.getMonth() - 2);

                monthlyData = yieldsSheet.filter(r => {
                    const pd = this.parseDate(r['Date'] || r['date']);
                    return pd && pd >= lastMonthStart && pd <= lastMonthEnd && pd <= today;
                });
                console.log(`Now using ${monthlyData.length} rows for monthly data (expanded time range)`);
            }

            const daily = this.calculateYieldsKPI(dailyData, 'daily');
            const weekly = this.calculateYieldsKPI(weeklyData, 'weekly');
            const monthly = this.calculateYieldsKPI(monthlyData, 'monthly');
            const quality = this.calculateQualityKPI(qualitySheet);
            const ctasf = this.calculateCTASFKPI(ctasfSheet);
            const processing = this.calculateProcessingKPI(processingSheet);

            // ==== Trend calculations (lightweight) ====
            try {
                // Previous day (yesterday)
                const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
                const yesterdayKey = this.formatDate(yesterday);
                const prevDayData = yieldsSheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && this.formatDate(pd) === yesterdayKey && pd <= today; });
                const prevDay = this.calculateYieldsKPI(prevDayData, 'daily');
                if (prevDay.current > 0) {
                    daily.changePct = ((daily.current - prevDay.current) / prevDay.current) * 100;
                }

                // Previous week (7 days before current week start)
                const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate()-7);
                const prevWeekEnd = new Date(weekStart); prevWeekEnd.setDate(weekStart.getDate()-1);
                const prevWeekData = yieldsSheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && pd >= prevWeekStart && pd <= prevWeekEnd && pd <= today; });
                const prevWeek = this.calculateYieldsKPI(prevWeekData, 'weekly');
                if (prevWeek.current > 0) {
                    weekly.changePct = ((weekly.current - prevWeek.current) / prevWeek.current) * 100;
                }

                // Previous month
                const prevMonthEnd = new Date(monthStart); prevMonthEnd.setDate(prevMonthEnd.getDate()-1);
                const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
                const prevMonthData = yieldsSheet.filter(r => { const pd = this.parseDate(r['Date'] || r['date']); return pd && pd >= prevMonthStart && pd <= prevMonthEnd && pd <= today; });
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

            // ---- Monthly target override: use daily goal * 30 (user expects daily goal baseline)
            try {
                const cfgDaily = (window.CONFIG && window.CONFIG.TARGETS && window.CONFIG.TARGETS.DAILY_PARCELS) ? window.CONFIG.TARGETS.DAILY_PARCELS : this.config.dailyGoal;
                // Use floor to match explicit daily goal intent (e.g., 832 from 832.77)
                const dailyGoalBase = Math.floor(Number(cfgDaily) || this.config.dailyGoal);
                const monthlyTargetFromDaily = dailyGoalBase * 30;
                monthly.target = Math.round(monthlyTargetFromDaily);

                // Compute recent average daily rate using yieldsSheet (last N days with data)
                const dateMap = new Map();
                for (const r of yieldsSheet) {
                    const pd = this.parseDate(r['Date'] || r['date']);
                    if (!pd || pd > latestDate) continue;
                    const key = this.formatDate(pd);
                    const val = this._getNumericField(r, ['Nombre de levées','Nombre de Levées','nombre de levées','nombre de levees','Nombre de levees','levées','levees','NombreDeLevees']) || 0;
                    dateMap.set(key, (dateMap.get(key) || 0) + val);
                }
                const sortedDates = Array.from(dateMap.keys()).sort((a,b)=> new Date(a) - new Date(b));
                // Use up to last 7 days with data to compute avg daily rate, falling back to monthly.current/days so far
                const lastNDays = 7;
                const lastDates = sortedDates.slice(-lastNDays);
                let avgDaily = 0;
                if (lastDates.length) {
                    const sum = lastDates.reduce((s,k)=> s + (dateMap.get(k)||0), 0);
                    avgDaily = sum / lastDates.length;
                }
                if (!avgDaily) {
                    // fallback: use monthly.current / days so far in month
                    const daysSoFar = latestDate ? (latestDate.getDate()) : 1;
                    avgDaily = daysSoFar > 0 ? (monthly.current / daysSoFar) : (daily.current || 0);
                }

                // Total so far (all yields up to latestDate)
                const totalSoFar = Array.from(dateMap.values()).reduce((s,v)=> s+v, 0);

                const projections = {};
                // Helper: days between (exclusive of today) latestDate and endOfMonth inclusive
                const daysUntil = (fromDate, toDate) => {
                    const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
                    const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
                    // compute days difference (b - a) in days
                    const msPerDay = 24 * 60 * 60 * 1000;
                    const diff = Math.ceil((b - a) / msPerDay);
                    return diff >= 0 ? diff : 0;
                };

                // Build projections starting from the latestDate (or today if latestDate missing)
                const baseDate = latestDate || new Date();
                const startMonth = baseDate.getMonth(); // 0-based month index
                const monthNames = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
                const monthsToCheck = [];
                for (let i = 0; i < 4; i++) {
                    const m = (startMonth + i) % 12;
                    const y = baseDate.getFullYear() + Math.floor((startMonth + i) / 12);
                    monthsToCheck.push({ y, m });
                }

                monthsToCheck.forEach(item => {
                    const endOfMonth = new Date(item.y, item.m + 1, 0); // last day of month
                    const days = daysUntil(baseDate, endOfMonth);
                    const projected = Math.round(totalSoFar + (avgDaily * days));
                    const label = monthNames[item.m] || `${item.m+1}/${item.y}`;
                    projections[label] = { projectedTotal: projected, daysRemaining: days };
                });

                // Determine achievability for the current projected month (month of latestDate)
                const currentLabel = monthNames[startMonth];
                const currentProj = projections[currentLabel] ? projections[currentLabel].projectedTotal : null;
                const achievable = currentProj !== null ? (currentProj >= monthly.target) : false;
                monthly.forecast = { avgDaily: Math.round(avgDaily), totalSoFar: Math.round(totalSoFar), projections, achievable };
                monthly.achievable = achievable;
                monthly.alert = achievable ? 'Atteignable au rythme actuel' : 'Non atteignable au rythme actuel';
            } catch (ex) { console.warn('Monthly forecast calculation failed:', ex); }

            return { daily, weekly, monthly, quality, ctasf, processing };
        } catch (e) {
            console.error('calculateKPIs failed:', e);
            return this.getDefaultKPIs();
        }
    }
}

// Create global instance
window.dataAggregationService = new DataAggregationService();