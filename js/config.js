// Configuration file for Cadastre Senegal Dashboard
// All Google Sheets configurations and constants

const CONFIG = {
    // Base Google Sheets URL
    SHEETS_BASE_URL: 'https://docs.google.com/spreadsheets/d/1IbV-vzaby_xwdzeENu7qgsZyqb7eWKQSHmp1hw3nPvg/export?format=csv&gid=',

    // Refresh interval (5 minutes)
    REFRESH_INTERVAL: 5 * 60 * 1000,

    // Performance targets
    TARGETS: {
        // January 2026 Goal: 12,000
        // Daily: 12000 / 31 = 387.096
        // Weekly: 387.096 * 7 = 2709.67
        JANUARY_2026_GOAL: 12000,
        DAILY_PARCELS: 387.1,
        WEEKLY_PARCELS: 2710,
        TOTAL_GOAL: 75000,

        // Legacy / Fallback
        SEPTEMBER_2025_GOAL: 60830.22,
        TEAMS_COUNT: 20,
        TOTAL_PER_DAY_PER_TEAM: 387.1 / 20
    },

    // Regional data
    REGIONS: ['Tambacounda', 'Kedougou'],

    // Chart colors
    COLORS: {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#8B5CF6',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#06B6D4',
        gradients: {
            primary: ['#3B82F6', '#06B6D4'],
            success: ['#10B981', '#22C55E'],
            warning: ['#F59E0B', '#F97316'],
            danger: ['#EF4444', '#F87171']
        }
    },

    // Work status per commune (used for coloring in Commune Status chart)
    COMMUNE_STATUS: {
        active: [
            'Koar', 'Sinthiou Maleme', 'Ndoga Babacar', 'Missirah', 'Netteboulou', 'Bala'
        ],
        inProgress: [
            'Tomboronkoto', 'Dindefello', 'Moudery', 'Gabou', 'Bembou'
        ],
        finished: [
            'Fongolembi', 'Bandafassi', 'Dimboli'
        ]
    }
};

// Google Sheets Configuration
const GOOGLE_SHEETS = {
    // Main Data Sheets
    dailyLeveeSource: {
        gid: '870166470',
        name: 'Daily Levee Source',
        columns: ['Date', 'Région', 'Commune', 'Nombre de levées', 'Equipe'],
        url: 'https://docs.google.com/spreadsheets/d/1IbV-vzaby_xwdzeENu7qgsZyqb7eWKQSHmp1hw3nPvg/export?format=csv&gid=870166470'
    },
    overview: {
        gid: '589154853',
        name: 'Overview Metrics',
        columns: ['Metric', 'Value'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=589154853'
    },

    totalMoyenne: {
        gid: '1703269267',
        name: 'Total-Moyenne',
        columns: ['Date', 'Total', 'Moyenne'], // Assuming standard cols, can be adjusted
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1703269267'
    },

    processing1: {
        gid: '778550489',
        name: 'Processing Phase 1',
        columns: ['Phase', 'Tool', 'Parcel Type', 'Total'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=778550489'
    },

    processing2: {
        gid: '1687610293',
        name: 'Processing Phase 2',
        columns: ['Phase', 'Tool', 'Parcel Type', 'Total'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1687610293'
    },

    teamProductivity: {
        gid: '1397416280',
        name: 'Team Productivity',
        columns: ['Team', 'Champs/Equipe/Jour'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1397416280'
    },

    projectTimeline: {
        gid: '660642704',
        name: 'Project Timeline',
        columns: ['Order', 'Tambacounda', 'Tambacounda Status', 'Tambacounda Start Date', 'Tambacounda End Date', 'Kedougou', 'Kedougou Status', 'Kedougou Start Date', 'Kedougou End Date'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=660642704'
    },

    projectionCollection: {
        gid: '1151168155',
        name: 'Collection Projections',
        columns: ['Metric', 'Value', 'Sept 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1151168155'
    },

    projectionDisplay: {
        gid: '2035205606',
        name: 'Display Projections',
        columns: ['Metric', 'Value', 'Parcels Displayed', 'Expected Display', 'Sept 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=2035205606'
    },

    projectionCtasf: {
        gid: '1574818070',
        name: 'CTASF Projections',
        columns: ['Metric', 'Value', 'Parcels NICAD', 'Parcels CTASF', 'Sept 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1574818070'
    },

    communeDetails: {
        gid: '1421590976',
        name: 'Commune Analysis',
        columns: [
            'Commune',
            'Région',
            'Total Parcelles',
            '% du total',
            'NICAD',
            '% NICAD',
            'CTASF',
            '% CTASF',
            'Délibérées',
            '% Délibérée',
            'Parcelles brutes',
            'Parcelles collectées (sans doublon géométrique)',
            'Parcelles enquêtées',
            'Motifs de rejet post-traitement',
            'Parcelles retenues après post-traitement',
            'Parcelles validées par l’URM',
            'Parcelles rejetées par l’URM',
            'Motifs de rejet URM',
            'Parcelles corrigées',
            'Geomaticien',
            'Parcelles individuelles jointes',
            'Parcelles collectives jointes',
            'Parcelles non jointes',
            'Doublons supprimés',
            'Taux suppression doublons (%)',
            'Parcelles en conflit',
            'Significant Duplicates',
            'Parcelles post-traitées lot 1-46',
            'Statut jointure',
            'Message d’erreur jointure'
        ],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1421590976'
    },

    documentation: {
        gid: '1203072335',
        name: 'Documentation',
        columns: ['Section', 'Description'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1203072335'
    },

    deliverables: {
        gid: '998947441',
        name: 'Livrables',
        columns: [
            'N°',
            'Index',
            'Livrable',
            'NATURE LIVRABLES',
            '% SUR LE MONTANT HT',
            'DUREE',
            'DATE',
            'Date ajustée',
            'Experts Princip',
            'STATUT AU JUILLET A OCTOBRE 2025',
            'Nbre Base',
            'Validé',
            'En Examen',
            'En retard',
            'A venir'
        ],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=998947441'
    }
};

// Follow-up/Monitoring Sheets (Daily Data Entry)
const MONITORING_SHEETS = {
    publicDisplayFollowup: {
        gid: '614496809',
        name: 'Public Display Follow-up',
        columns: ['Date', 'Région', 'Commune', 'Motif retour', 'Nombre de parcelles affichées sans erreurs', 'Nombre Parcelles avec erreur'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=614496809'
    },

    ctasfFollowup: {
        gid: '1629996903',
        name: 'CTASF Follow-up',
        columns: ['Date', 'Région', 'Commune', 'Nombre parcelles emmenées au CTASF', 'Nombre parcelles retenues CTASF', 'Nombre parcelles à délibérer', 'Nombre parcelles délibérées'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1629996903'
    },

    postProcessFollowup: {
        gid: '202408760',
        name: 'Post Process Follow-up',
        columns: [
            'Date',
            'PrenonTopo',
            'NomTopp',
            'Commune',
            'Zone',
            'Village',
            'Parcelles Brutes  par topo',
            'Parcelles validees par Topo',
            'Parcelles Total Validee Equipe A',
            'Parcelles Total Validee Equipe B',
            'Geomaticien'
        ],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=202408760'
    },

    yieldsProjection: {
        gid: '1397416280',
        name: 'Yields Projections',
        columns: ['Date', 'Région', 'Commune', 'Nombre de levées'],
        url: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=1397416280'
    },

    dailyLeveeSource: {
        gid: '870166470',
        name: 'Daily Levee Source',
        columns: ['Date', 'Equipe', 'Région', 'Commune', 'Nombre de levées'], // Assumed columns based on context
        // Note: Different Spreadsheet ID than base
        url: 'https://docs.google.com/spreadsheets/d/1IbV-vzaby_xwdzeENu7qgsZyqb7eWKQSHmp1hw3nPvg/export?format=csv&gid=870166470'
    }
};

// Chart Configuration Templates
const CHART_CONFIGS = {
    defaultOptions: {
        responsive: true,
        maintainAspectRatio: false, // Fix compression
        aspectRatio: 2,  // Width:Height ratio
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    boxWidth: 10, // More compact legends
                    font: {
                        size: 11 // Smaller font for legends
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: CONFIG.COLORS.primary,
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: true
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        },
        layout: {
            padding: {
                top: 10,
                right: 10,
                bottom: 10,
                left: 10
            }
        }
    },

    gaugeOptions: {
        circumference: Math.PI,
        rotation: Math.PI,
        cutout: '75%',
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1, // Square aspect ratio for gauges
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        },
        layout: {
            padding: {
                top: 10,
                right: 0,
                bottom: 0,
                left: 0
            }
        }
    },

    timeSeriesOptions: {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: {
                        day: 'DD/MM'
                    },
                    tooltipFormat: 'DD MMMM YYYY'
                },
                adapters: {
                    date: {
                        locale: 'fr'
                    }
                },
                title: {
                    display: true,
                    text: 'Date'
                }
            },
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Nombre'
                }
            }
        }
    }
};

// Utility functions
const UTILS = {
    // Format numbers with French locale
    formatNumber: (num) => {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    },

    // Format percentage
    formatPercentage: (num) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(num / 100);
    },

    // Robust day-first date parser returning a real Date or null
    parseDateDMY: (val) => {
        if (!val && val !== 0) return null;
        // If it's already a Date
        if (val instanceof Date && !isNaN(val)) return val;
        const str = String(val).trim();

        // French month names mapping (full and abbreviated)
        const frenchMonths = {
            'janvier': 1, 'janv': 1, 'jan': 1,
            'février': 2, 'fevrier': 2, 'févr': 2, 'fev': 2, 'fév': 2,
            'mars': 3, 'mar': 3,
            'avril': 4, 'avr': 4,
            'mai': 5,
            'juin': 6,
            'juillet': 7, 'juil': 7,
            'août': 8, 'aout': 8, 'aoû': 8,
            'septembre': 9, 'sept': 9, 'sep': 9,
            'octobre': 10, 'oct': 10,
            'novembre': 11, 'nov': 11,
            'décembre': 12, 'decembre': 12, 'déc': 12, 'dec': 12
        };

        // Try to parse French date formats
        // Format 1: "02 Novembre 2024" or "02 novembre 2024"
        const frenchFullMatch = str.match(/^(\d{1,2})\s+([a-zéèêàâûôîç]+)\s+(\d{4})$/i);
        if (frenchFullMatch) {
            const day = parseInt(frenchFullMatch[1], 10);
            const monthName = frenchFullMatch[2].toLowerCase().replace(/[.\s-]/g, '');
            const year = parseInt(frenchFullMatch[3], 10);
            const month = frenchMonths[monthName];

            if (month) {
                const dt = new Date(year, month - 1, day);
                if (!isNaN(dt)) return dt;
            }
        }

        // Format 2: "sept.-25" or "nov.-25" or "févr.-26"
        const frenchAbbrevMatch = str.match(/^([a-zéèêàâûôîç]+)[.\s-]+(\d{2})$/i);
        if (frenchAbbrevMatch) {
            const monthName = frenchAbbrevMatch[1].toLowerCase().replace(/[.\s-]/g, '');
            let year = parseInt(frenchAbbrevMatch[2], 10);
            const month = frenchMonths[monthName];

            if (month) {
                // Assume 2-digit year is 20xx
                year = 2000 + year;
                // Default to day 1 if not specified
                const dt = new Date(year, month - 1, 1);
                if (!isNaN(dt)) return dt;
            }
        }

        // Handle ISO quickly
        const iso = new Date(str);
        if (!isNaN(iso)) {
            // Beware of MM/DD confusion: if original contains '/'
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) return iso;
        }
        // Accept DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY
        const m = /^([0-3]?\d)[/.-]([01]?\d)[/.-](\d{2}|\d{4})$/.exec(str);
        if (m) {
            let d = parseInt(m[1], 10); let mo = parseInt(m[2], 10); let y = parseInt(m[3], 10);
            if (y < 100) y = 2000 + y; // 2-digit year -> 20xx
            const dt = new Date(y, mo - 1, d);
            return isNaN(dt) ? null : dt;
        }
        // Fallback: try Date again
        return isNaN(iso) ? null : iso;
    },

    // Format date for display (force fr-FR day-first)
    formatDate: (dateString) => {
        const date = UTILS.parseDateDMY(dateString);
        if (!date) return String(dateString || '');
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    // Parse CSV data correctly handling quotes
    parseCSV: (csvText) => {
        try {
            if (!csvText || typeof csvText !== 'string') return [];

            // Remove BOM if present
            csvText = csvText.replace(/^\uFEFF/, '');

            // Normalize line endings and split into lines
            const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
            if (lines.length === 0) return [];

            // Detect delimiter (comma or semicolon)
            const firstLine = lines[0];
            const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

            // Helper to parse a single line respecting quotes
            const parseLine = (text) => {
                const result = [];
                let curVal = '';
                let inQuote = false;

                for (let i = 0; i < text.length; i++) {
                    const char = text[i];

                    if (inQuote) {
                        if (char === '"') {
                            // Check for double quote (escaped quote)
                            if (i + 1 < text.length && text[i + 1] === '"') {
                                curVal += '"';
                                i++; // Skip next quote
                            } else {
                                inQuote = false;
                            }
                        } else {
                            curVal += char;
                        }
                    } else {
                        if (char === '"') {
                            inQuote = true;
                        } else if (char === delimiter) {
                            result.push(curVal);
                            curVal = '';
                        } else {
                            curVal += char;
                        }
                    }
                }
                result.push(curVal);
                return result;
            };

            const headers = parseLine(lines[0]).map(h => h.trim().replace(/^\uFEFF/, '').replace(/\u00A0/g, ' '));
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = parseLine(lines[i]);

                // Allow rows shorter than headers but skip empty lines
                if (values.every(v => v === undefined || v.trim() === '')) continue;

                const row = {};
                headers.forEach((header, index) => {
                    const raw = values[index] !== undefined ? values[index].trim() : '';
                    row[header] = raw;
                });
                data.push(row);
            }

            return data;
        } catch (err) {
            console.error('Error parsing CSV:', err);
            return [];
        }
    },

    // Calculate date ranges
    getDateRange: (type) => {
        const now = new Date();
        let startDate, endDate = new Date(now);

        switch (type) {
            case 'day':
                startDate = new Date(now);
                break;
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 1);
                break;
            default:
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 3);
        }

        return { startDate, endDate };
    },

    // Filter data by date range
    filterByDateRange: (data, startDate, endDate, dateColumn = 'Date') => {
        return data.filter(row => {
            const rowDate = UTILS.parseDateDMY(row[dateColumn]);
            if (!rowDate) return false;
            return rowDate >= startDate && rowDate <= endDate;
        });
    },

    // Group data by key
    groupBy: (data, key) => {
        return data.reduce((groups, item) => {
            const group = (groups[item[key]] || []);
            group.push(item);
            groups[item[key]] = group;
            return groups;
        }, {});
    },

    // Calculate sum of numeric column
    sumColumn: (data, column) => {
        return data.reduce((sum, row) => {
            return sum + (parseFloat(row[column]) || 0);
        }, 0);
    },

    // Calculate average of numeric column
    avgColumn: (data, column) => {
        if (data.length === 0) return 0;
        return UTILS.sumColumn(data, column) / data.length;
    },

    // Debounce function for performance
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Export for use in other modules
window.CONFIG = CONFIG;
window.GOOGLE_SHEETS = GOOGLE_SHEETS;
window.MONITORING_SHEETS = MONITORING_SHEETS;
window.CHART_CONFIGS = CHART_CONFIGS;
window.UTILS = UTILS;
