/**
 * StatCardService
 * Handles the rendering and updating of the new "Stat Cards" in the Bento Grid.
 * Enhanced with goal visualization and smoother animations.
 */
class StatCardService {
    constructor() {
        this.sparklines = new Map();
        this.config = {
            colors: {
                success: '#10b981',
                warning: '#f59e0b',
                danger: '#ef4444',
                primary: '#2563eb',
                secondary: '#64748b'
            }
        };
    }

    /**
     * Update all stat cards with new KPI data
     */
    updateCards(kpis, rawData) {
        if (!kpis) return;

        this._updateCard('daily', kpis.daily, rawData);
        this._updateCard('weekly', kpis.weekly, rawData);
        this._updateCard('monthly', kpis.monthly, rawData);
    }

    /**
     * Update a single card
     * @private
     */
    _updateCard(type, data, rawData) {
        const valueEl = document.getElementById(`${type}Value`);
        const deltaEl = document.getElementById(`${type}Delta`);
        const targetEl = document.getElementById(`${type}Target`);
        const progressFill = document.getElementById(`${type}ProgressFill`);
        const percentEl = document.getElementById(`${type}Percent`);
        const badgeEl = document.getElementById(`${type}Badge`);
        const dateLabel = document.getElementById(`${type}DateLabel`);

        if (!valueEl || !data) return;

        // Display reference date
        if (dateLabel && data.refDate) {
            dateLabel.textContent = `· ${data.refDate}`;
        }

        // 1. Smooth Value Animation
        const startVal = parseInt(valueEl.textContent.replace(/[^0-9]/g, '')) || 0;
        this._animateValue(valueEl, startVal, data.current);

        // 2. Delta Indicator
        if (deltaEl) {
            const change = data.changePct || 0;
            const isPositive = change >= 0;
            const absChange = Math.abs(change).toFixed(1);
            deltaEl.textContent = `${isPositive ? '▲' : '▼'} ${absChange}%`;
            deltaEl.className = `text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-danger'}`;
        }

        // 3. Goal Visualization (Progress Bar & Status)
        if (data.target > 0) {
            const progress = Math.min((data.current / data.target) * 100, 100);

            if (targetEl) targetEl.textContent = new Intl.NumberFormat('fr-FR').format(data.target);
            if (percentEl) percentEl.textContent = `${Math.round(progress)}%`;

            if (progressFill) {
                progressFill.style.width = `${progress}%`;
                // Set color based on progress
                if (progress >= 100) progressFill.style.backgroundColor = this.config.colors.success;
                else if (progress >= 70) progressFill.style.backgroundColor = this.config.colors.primary;
                else if (progress >= 40) progressFill.style.backgroundColor = this.config.colors.warning;
                else progressFill.style.backgroundColor = this.config.colors.danger;
            }

            // 4. Achievement Badge
            if (badgeEl) {
                if (progress >= 100) {
                    badgeEl.textContent = 'Atteint';
                    badgeEl.className = 'stat-card-badge bg-emerald-100 text-emerald-700';
                } else if (progress > 0) {
                    badgeEl.textContent = 'En cours';
                    badgeEl.className = 'stat-card-badge bg-blue-100 text-blue-700';
                } else {
                    badgeEl.textContent = 'En attente';
                    badgeEl.className = 'stat-card-badge bg-slate-100 text-slate-700';
                }
            }
        }

        // 5. Render/Update Sparkline with dynamic color
        const statusColor = this._getStatusColor(data);
        this._renderSparkline(type, rawData, statusColor);
    }

    _getStatusColor(data) {
        if (!data || data.target <= 0) return this.config.colors.primary;
        const p = (data.current / data.target) * 100;
        if (p >= 100) return this.config.colors.success;
        if (p >= 70) return this.config.colors.primary;
        if (p >= 40) return this.config.colors.warning;
        return this.config.colors.danger;
    }

    /**
     * Smoothly animate numeric values with Quintic easing
     */
    _animateValue(element, start, end) {
        if (start === end) {
            element.textContent = new Intl.NumberFormat('fr-FR').format(end);
            return;
        }

        const duration = 1200;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Quintic Out easing for a premium feel
            const eased = 1 - Math.pow(1 - progress, 5);
            const current = Math.floor(start + (end - start) * eased);

            element.textContent = new Intl.NumberFormat('fr-FR').format(current);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    }

    /**
     * Render a sparkline using Chart.js
     */
    _renderSparkline(type, rawData, color) {
        const canvasId = `${type}SparklineCanvas`;
        const canvas = document.getElementById(canvasId);
        if (!canvas || !rawData) return;

        const timeframeData = this._getSparklineData(type, rawData);
        if (!timeframeData || timeframeData.length < 2) return;

        if (this.sparklines.has(type)) {
            this.sparklines.get(type).destroy();
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 40);
        gradient.addColorStop(0, color + '44');
        gradient.addColorStop(1, color + '00');

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeframeData.map((_, i) => i),
                datasets: [{
                    data: timeframeData,
                    borderColor: color,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.45,
                    pointRadius: 0,
                    pointHoverRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false, beginAtZero: false }
                },
                animation: { duration: 1000 }
            }
        });

        this.sparklines.set(type, chart);
    }

    _getSparklineData(type, rawData) {
        try {
            const sheet = rawData['dailyLeveeSource'] || rawData['Daily Levee Source'] || rawData['Yields Projections'] || rawData['Yields'] || rawData['Suivi_Parcelles_journaliers'] || [];
            if (!sheet || !sheet.length) return [];

            const dailyTotals = new Map();
            sheet.forEach(row => {
                const date = row['Date'] || row['date'];
                if (!date) return;
                const dateKey = String(date).split('T')[0];
                const val = Number(String(row['Nombre de levées'] || row['levées'] || 0).replace(/\s+/g, '')) || 0;
                dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + val);
            });

            const sortedDates = Array.from(dailyTotals.keys()).sort();
            const allValues = sortedDates.map(d => dailyTotals.get(d));

            if (type === 'daily') return allValues.slice(-7);
            if (type === 'weekly') return allValues.slice(-14);
            return allValues.slice(-30);
        } catch (e) {
            return [0, 0];
        }
    }
}

window.statCardService = new StatCardService();
