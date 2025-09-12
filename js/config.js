// Configuration file for Cadastre Senegal Dashboard
// All Google Sheets configurations and constants

const CONFIG = {
    // Base Google Sheets URL
    SHEETS_BASE_URL: 'https://docs.google.com/spreadsheets/d/1CbDBJtoWWPRjEH4DOSlv4jjnJ2G-1MvW/export?format=csv&gid=',
    
    // Refresh interval (5 minutes)
    REFRESH_INTERVAL: 5 * 60 * 1000,
    
    // Performance targets
    TARGETS: {
        DAILY_PARCELS: 832.77,
        WEEKLY_PARCELS: 5829.39, // 832.77 * 7
        SEPTEMBER_2025_GOAL: 60830.22,
        TEAMS_COUNT: 20,
        TOTAL_PER_DAY_PER_TEAM: 832.777777777778 / 20
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
    overview: {
        gid: '589154853',
        name: 'Overview Metrics',
        columns: ['Metric', 'Value'],
        url: CONFIG.SHEETS_BASE_URL + '589154853'
    },
    
    processing1: {
        gid: '778550489',
        name: 'Processing Phase 1',
        columns: ['Phase', 'Tool', 'Parcel Type', 'Total'],
        url: CONFIG.SHEETS_BASE_URL + '778550489'
    },
    
    processing2: {
        gid: '1687610293',
        name: 'Processing Phase 2', 
        columns: ['Phase', 'Tool', 'Parcel Type', 'Total'],
        url: CONFIG.SHEETS_BASE_URL + '1687610293'
    },
    
    teamProductivity: {
        gid: '1397416280',
    name: 'Team Productivity',
        columns: ['Team', 'Champs/Equipe/Jour'],
        url: CONFIG.SHEETS_BASE_URL + '1397416280'
    },
    
    projectTimeline: {
        gid: '660642704',
        name: 'Project Timeline',
        columns: ['Order', 'Tambacounda', 'Tambacounda Status', 'Tambacounda Start Date', 'Tambacounda End Date', 'Kedougou', 'Kedougou Status', 'Kedougou Start Date', 'Kedougou End Date'],
        url: CONFIG.SHEETS_BASE_URL + '660642704'
    },
    
    projectionCollection: {
        gid: '1151168155',
        name: 'Collection Projections',
        columns: ['Metric', 'Value', 'Sept 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'],
        url: CONFIG.SHEETS_BASE_URL + '1151168155'
    },
    
    projectionDisplay: {
        gid: '2035205606',
        name: 'Display Projections',
        columns: ['Metric', 'Value', 'Parcels Displayed', 'Expected Display', 'Sept 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'],
        url: CONFIG.SHEETS_BASE_URL + '2035205606'
    },
    
    projectionCtasf: {
        gid: '1574818070',
        name: 'CTASF Projections',
        columns: ['Metric', 'Value', 'Parcels NICAD', 'Parcels CTASF', 'Sept 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'],
        url: CONFIG.SHEETS_BASE_URL + '1574818070'
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
        url: CONFIG.SHEETS_BASE_URL + '1421590976'
    },
    
    documentation: {
        gid: '1203072335',
        name: 'Documentation',
        columns: ['Section', 'Description'],
        url: CONFIG.SHEETS_BASE_URL + '1203072335'
    }
};

// Follow-up/Monitoring Sheets (Daily Data Entry)
const MONITORING_SHEETS = {
    publicDisplayFollowup: {
        gid: '614496809',
        name: 'Public Display Follow-up',
        columns: ['Date', 'Région', 'Commune', 'Motif retour', 'Nombre de parcelles affichées sans erreurs', 'Nombre Parcelles avec erreur'],
        url: CONFIG.SHEETS_BASE_URL + '614496809'
    },
    
    ctasfFollowup: {
        gid: '1629996903', 
        name: 'CTASF Follow-up',
        columns: ['Date', 'Région', 'Commune', 'Nombre parcelles emmenées au CTASF', 'Nombre parcelles retenues CTASF', 'Nombre parcelles à délibérer', 'Nombre parcelles délibérées'],
        url: CONFIG.SHEETS_BASE_URL + '1629996903'
    },
    
    postProcessFollowup: {
        gid: '202408760',
        name: 'Post Process Follow-up', 
        columns: ['Date', 'Geomaticien', 'Région', 'Commune', 'Parcelles reçues (Brutes)', 'Parcelles post traitées (Sans Doublons et topoplogie correcte)', 'Parcelles individuelles Jointes', 'Parcelles collectives Jointes', 'Parcelles sans jointure', 'Parcelles retournées aux topos', 'Motif'],
        url: CONFIG.SHEETS_BASE_URL + '202408760'
    },
    
    yieldsProjection: {
        gid: '1397416280',
        name: 'Yields Projections',
        columns: ['Date', 'Région', 'Commune', 'Nombre de levées'],
        url: CONFIG.SHEETS_BASE_URL + '1397416280'
    }
};

// Chart Configuration Templates
const CHART_CONFIGS = {
    defaultOptions: {
        responsive: true,
        maintainAspectRatio: true,
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
    
    // Parse CSV data
    parseCSV: (csvText) => {
        try {
            if (!csvText || typeof csvText !== 'string') return [];

            // Remove BOM if present
            csvText = csvText.replace(/^\uFEFF/, '');

            // Normalize line endings and split
            const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
            if (lines.length === 0) return [];

            // Detect delimiter (comma or semicolon)
            const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';

            const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, '').replace(/\u00A0/g, ' '));
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(delimiter);
                // Allow rows shorter than headers but skip empty lines
                if (values.every(v => v === undefined || v.trim() === '')) continue;
                const row = {};
                headers.forEach((header, index) => {
                    const raw = values[index] !== undefined ? values[index].trim().replace(/"/g, '') : '';
                    row[header] = raw;
                });
                data.push(row);
            }

            return data;
        } catch (err) {
            // Suppressed parseCSV error log
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
