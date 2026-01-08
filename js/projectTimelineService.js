/**
 * Project Timeline Service
 * Fetches and transforms Google Sheet data for the Gantt chart.
 */
class ProjectTimelineService {
    constructor() {
        this.data = [];
    }

    async initialize() {
        console.log('[ProjectTimelineService] Initializing...');
        await this.loadData();
    }

    async loadData() {
        try {
            const googleService = window.enhancedGoogleSheetsService || window.googleSheetsService;
            if (!googleService) {
                console.warn('[ProjectTimelineService] No Google Sheets service found.');
                return;
            }

            // check config
            if (!window.GOOGLE_SHEETS || !window.GOOGLE_SHEETS.projectTimeline) {
                console.warn('[ProjectTimelineService] No projectTimeline config found.');
                return;
            }

            const config = window.GOOGLE_SHEETS.projectTimeline;
            const sheetId = (window.CONFIG && window.CONFIG.SHEETS_BASE_URL) ?
                window.CONFIG.SHEETS_BASE_URL.split('/d/')[1].split('/')[0] :
                '1IbV-vzaby_xwdzeENu7qgsZyqb7eWKQSHmp1hw3nPvg';

            console.log(`[ProjectTimelineService] Fetching sheet from ${sheetId} / GID ${config.gid}`);

            // Fetch CSV
            const csvData = await googleService.fetchCsvByGid(sheetId, config.gid);
            if (!csvData) {
                console.warn('[ProjectTimelineService] No data returned.');
                return;
            }

            const rows = this.parseCSV(csvData);
            console.log(`[ProjectTimelineService] Parsed ${rows.length} rows.`);

            this.processData(rows);

        } catch (e) {
            console.error('[ProjectTimelineService] Error loading data:', e);
        }
    }

    parseCSV(csvText) {
        // Simple CSV parser
        const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return [];

        // Detect delimiter
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

        return lines.slice(1).map(line => {
            const values = line.split(delimiter);
            const row = {};
            headers.forEach((h, i) => {
                row[h] = values[i] ? values[i].trim().replace(/^"|"$/g, '') : '';
            });
            return row;
        });
    }

    processData(rows) {
        // Transform into timeline format
        const tasks = [];

        rows.forEach(row => {
            // Log first row to see structure if needed
            // console.debug('Row:', row);

            // Structure hypothesis based on config: 
            // Order, Tambacounda, Tambacounda Status, Tambacounda Start, Tambacounda End...

            // We want to create a task for each Region if it has dates
            const regions = ['Tambacounda', 'Kedougou', 'Kolda', 'Sedhiou', 'Kaolack', 'Kaffrine', 'Fatick'];
            const taskNameBase = row['Activite'] || row['Activity'] || row['Task'] || row['Order'] || 'Tâche inconnue';

            regions.forEach(region => {
                // Try to find region specific columns
                // Columns might be "Tambacounda", "Tambacounda Start Date", etc.
                // Or "Statut Tambacounda", "Date Debut Tambacounda"

                // Flexible matching
                const findVal = (suffixes) => {
                    for (const s of suffixes) {
                        const key = Object.keys(row).find(k => k.toLowerCase() === (region + ' ' + s).toLowerCase() || k.toLowerCase() === (s + ' ' + region).toLowerCase());
                        if (key && row[key]) return row[key];
                    }
                    return null;
                };

                const start = findVal(['Start Date', 'Date Début', 'Debut', 'Start']);
                const end = findVal(['End Date', 'Date Fin', 'Fin', 'End']);
                const status = findVal(['Status', 'Statut']);
                const comments = findVal(['Comments', 'Commentaires', 'Communes']);

                if (start && end) {
                    tasks.push({
                        section: region, // Group by Region
                        name: taskNameBase + (comments ? ` - ${comments}` : ''),
                        communes: comments || '',
                        start: this.parseDate(start),
                        end: this.parseDate(end),
                        color: this.getColorByStatus(status)
                    });
                }
            });

            // Also support flat format if the sheet is simple "Task, Start, End, Section"
            if (row['Section'] && row['Start Date'] && row['End Date']) {
                tasks.push({
                    section: row['Section'],
                    name: row['Task'] || row['Activity'],
                    start: this.parseDate(row['Start Date']),
                    end: this.parseDate(row['End Date']),
                    color: '#3B82F6'
                });
            }
        });

        console.log(`[ProjectTimelineService] Generated ${tasks.length} timeline tasks.`);

        // Update global data and re-render
        if (tasks.length > 0) {
            window.chronogramData = {
                tasks: tasks.map(t => ({
                    ...t,
                    start: t.start.toISOString().split('T')[0],
                    end: t.end.toISOString().split('T')[0]
                }))
            }; // Serialization compliant

            // Trigger render
            if (window.chronogramService && typeof window.chronogramService.render === 'function') {
                const renderItems = tasks.map(t => ({
                    id: t.name.replace(/[^a-z0-9]/gi, '-'),
                    task: t.name,
                    region: t.section,
                    start: t.start,
                    end: t.end
                }));
                window.chronogramService.render(renderItems);
            }
        }
    }

    parseDate(str) {
        if (!str) return null;
        // DD/MM/YYYY
        const parts = str.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        // YYYY-MM-DD
        const partsISO = str.split('-');
        if (partsISO.length === 3) return new Date(partsISO[0], partsISO[1] - 1, partsISO[2]);
        return new Date(str);
    }

    getColorByStatus(status) {
        if (!status) return '#cbd5e1';
        const s = status.toLowerCase();
        if (s.includes('terminé') || s.includes('done') || s.includes('ok')) return '#10b981';
        if (s.includes('cours') || s.includes('progress')) return '#f59e0b';
        if (s.includes('retard') || s.includes('late')) return '#ef4444';
        return '#3b82f6';
    }
}

window.projectTimelineService = new ProjectTimelineService();
