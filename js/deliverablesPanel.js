/**
 * Deliverables Panel Controller
 * Handles the deliverables tracking UI, filtering, search, and table rendering
 */

class DeliverablesPanel {
    constructor() {
        this.currentFilter = 'all';
        this.currentSort = { column: null, direction: 'asc' };
        this.searchQuery = '';
        this.deliverables = [];
        this.statistics = null;
    }

    /**
     * Initialize the panel
     */
    async initialize() {
        try {
            // Fetch deliverables data
            const data = await window.deliverablesService.fetchDeliverables();
            this.deliverables = data.deliverables;
            this.statistics = data.statistics;

            // Update KPIs in Vue d'ensemble
            this.updateOverviewKPIs();

            // Render the panel
            this.renderPanel();

            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            console.error('Error initializing deliverables panel:', error);
            this.showError();
        }
    }

    /**
     * Update KPIs in Vue d'ensemble section
     */
    updateOverviewKPIs() {
        if (!this.statistics) return;

        const stats = this.statistics;

        // Update the 6 deliverables KPI cards
        this.updateKPI('livrablesValides', stats.valides);
        this.updateKPI('livrablesEnExamen', stats.enExamen);
        this.updateKPI('livrablesEnRetard', stats.enRetard);
        this.updateKPI('livrablesAVenir', stats.aVenir);

    }

    /**
     * Helper to update a KPI element
     */
    updateKPI(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
        }
    }

    /**
     * Render the entire panel
     */
    renderPanel() {
        this.renderFilterCounts();
        this.renderExpertBreakdown();
        this.renderTimelineMetrics();
        this.renderTable();
    }

    /**
     * Update filter button counts
     */
    renderFilterCounts() {
        if (!this.statistics) return;

        document.getElementById('filter-count-all').textContent = this.statistics.total;
        document.getElementById('filter-count-valide').textContent = this.statistics.valides;
        document.getElementById('filter-count-examen').textContent = this.statistics.enExamen;
        document.getElementById('filter-count-retard').textContent = this.statistics.enRetard;
        document.getElementById('filter-count-avenir').textContent = this.statistics.aVenir;
    }

    /**
     * Render expert breakdown
     */
    renderExpertBreakdown() {
        const container = document.getElementById('expertBreakdown');
        if (!container || !this.statistics) return;

        const experts = this.statistics.byExpert;
        let html = '';

        Object.keys(experts).forEach(expert => {
            const data = experts[expert];
            const percentage = data.total > 0 ? Math.round((data.valides / data.total) * 100) : 0;

            html += `
                <div class="flex justify-between items-center">
                    <span class="text-slate-600">${expert}:</span>
                    <span class="font-semibold text-slate-700">${data.valides}/${data.total} (${percentage}%)</span>
                </div>
            `;
        });

        container.innerHTML = html || '<div class="text-slate-500">Aucune donnée</div>';
    }

    /**
     * Render timeline metrics
     */
    renderTimelineMetrics() {
        if (!this.statistics) return;

        const stats = this.statistics;

        document.getElementById('stat-valides-temps').textContent =
            `${stats.validesATemps} (${stats.tauxPonctualite}%)`;

        document.getElementById('stat-valides-retard').textContent =
            `${stats.validesEnRetard}`;

        document.getElementById('stat-retard-moyen').textContent =
            stats.retardMoyen > 0 ? `${stats.retardMoyen} jours` : '--';

        document.getElementById('stat-plus-grand-retard').textContent =
            stats.plusGrandRetard > 0
                ? `${stats.plusGrandRetard}j (${stats.plusGrandRetardLivrable})`
                : '--';
    }

    /**
     * Render the deliverables table
     */
    renderTable() {
        const tbody = document.getElementById('deliverablesTableBody');
        if (!tbody) return;

        // Get filtered and sorted deliverables
        let filtered = this.getFilteredDeliverables();
        filtered = this.getSortedDeliverables(filtered);

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-3 py-8 text-center text-slate-500">
                        Aucun livrable trouvé
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(d => {
            const alert = d.alertStatus;

            // Parse the date first, then format it
            let dateDisplay = '<span class="text-slate-400">--</span>';
            if (d.date) {
                const parsedDate = window.UTILS.parseDateDMY(d.date);
                if (parsedDate instanceof Date && !isNaN(parsedDate)) {
                    dateDisplay = parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
            }

            // Alert badge
            const alertBadge = this.getAlertBadge(alert);

            // Status badge
            const statusBadge = this.getStatusBadge(d);

            html += `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="px-3 py-2 font-semibold text-slate-700">${d.index}</td>
                    <td class="px-3 py-2 text-slate-600 max-w-xs truncate" title="${d.livrable}">
                        ${d.livrable}
                    </td>
                    <td class="px-3 py-2 text-slate-600">${d.expert}</td>
                    <td class="px-3 py-2 text-slate-600">${dateDisplay}</td>
                    <td class="px-3 py-2">${statusBadge}</td>
                    <td class="px-3 py-2 text-center">${alertBadge}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    /**
     * Get alert badge HTML
     */
    getAlertBadge(alert) {
        if (!alert) return '<span class="text-slate-400">--</span>';

        const colorMap = {
            'danger': 'bg-red-100 text-red-700 border-red-200',
            'warning': 'bg-orange-100 text-orange-700 border-orange-200',
            'caution': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'success': 'bg-green-100 text-green-700 border-green-200',
            'info': 'bg-blue-100 text-blue-700 border-blue-200',
            'normal': 'bg-slate-100 text-slate-700 border-slate-200'
        };

        const colorClass = colorMap[alert.level] || colorMap['normal'];
        const daysText = alert.daysUntilDue !== undefined
            ? (alert.daysUntilDue > 0 ? `J-${alert.daysUntilDue}` : `J+${Math.abs(alert.daysUntilDue)}`)
            : '';

        return `
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${colorClass}" 
                  title="${alert.label}">
                ${alert.icon} ${daysText}
            </span>
        `;
    }

    /**
     * Get status badge HTML
     */
    getStatusBadge(deliverable) {
        const status = deliverable.statut;

        if (status.toLowerCase().includes('validé')) {
            return '<span class="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Validé</span>';
        }
        if (status.toLowerCase().includes('examen') || status.toLowerCase().includes('transmis')) {
            return '<span class="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">En examen</span>';
        }
        if (status.toLowerCase().includes('retard') || status.toLowerCase().includes('non transmis')) {
            return '<span class="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">En retard</span>';
        }

        return `<span class="text-xs text-slate-600">${status}</span>`;
    }

    /**
     * Get filtered deliverables based on current filter and search
     */
    getFilteredDeliverables() {
        let filtered = this.deliverables;

        // Apply status filter
        if (this.currentFilter !== 'all') {
            filtered = window.deliverablesService.filterByStatus(this.currentFilter);
        }

        // Apply search
        if (this.searchQuery) {
            filtered = window.deliverablesService.search(this.searchQuery);
        }

        return filtered;
    }

    /**
     * Get sorted deliverables
     */
    getSortedDeliverables(deliverables) {
        if (!this.currentSort.column) return deliverables;

        return [...deliverables].sort((a, b) => {
            let aVal, bVal;

            switch (this.currentSort.column) {
                case 'index':
                    aVal = a.index;
                    bVal = b.index;
                    break;
                case 'expert':
                    aVal = a.expert;
                    bVal = b.expert;
                    break;
                case 'date':
                    aVal = window.UTILS.parseDateDMY(a.dateAjustee || a.date);
                    bVal = window.UTILS.parseDateDMY(b.dateAjustee || b.date);
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return this.currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.deliverables-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const status = e.currentTarget.dataset.status;
                this.setFilter(status);
            });
        });

        // Search input
        const searchInput = document.getElementById('delivrablesSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim();
                this.renderTable();
            });
        }

        // Sort headers
        document.querySelectorAll('[data-sort]').forEach(header => {
            header.addEventListener('click', (e) => {
                const column = e.currentTarget.dataset.sort;
                this.toggleSort(column);
            });
        });
    }

    /**
     * Set active filter
     */
    setFilter(status) {
        this.currentFilter = status;

        // Update button states
        document.querySelectorAll('.deliverables-filter-btn').forEach(btn => {
            if (btn.dataset.status === status) {
                btn.classList.add('active', 'bg-blue-600', 'text-white');
                btn.classList.remove('bg-green-50', 'bg-blue-50', 'bg-red-50', 'bg-gray-50');
            } else {
                btn.classList.remove('active', 'bg-blue-600', 'text-white');
            }
        });

        this.renderTable();
    }

    /**
     * Toggle sort direction
     */
    toggleSort(column) {
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }

        this.renderTable();
    }

    /**
     * Show error message
     */
    showError() {
        const tbody = document.getElementById('deliverablesTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-3 py-8 text-center text-red-500">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Erreur lors du chargement des livrables
                    </td>
                </tr>
            `;
        }
    }
}

// Create global instance
window.deliverablesPanel = new DeliverablesPanel();
