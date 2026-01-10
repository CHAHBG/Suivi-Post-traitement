// chronogramIntegration.js
// Modernized Timeline Service for Suivi PROCASEF
// Refactored for High-Density "Tier-1 SaaS" Aesthetic

(function () {
    // NOTE: The timeline range is dynamic (computed from items) to keep the chart readable.
    // We anchor calculations at noon to reduce timezone/DST edge cases.
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Helpers
    function slugify(text) {
        return String(text).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
    }

    function getStatusColor(item) {
        if (!item.start || !item.end) return '#cbd5e1'; // Gray-300
        const daysToFinish = Math.round((item.end - new Date()) / (1000 * 60 * 60 * 24));

        // Use existing theme tokens (avoid hard-coded new colors)
        if (daysToFinish < 0) return 'var(--color-neutral)';
        if (daysToFinish <= 14) return 'var(--color-danger)';
        if (daysToFinish <= 30) return 'var(--color-warning)';
        return 'var(--color-success)';
    }

    function normalizeToNoon(d) {
        if (!(d instanceof Date) || isNaN(d)) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
    }

    function computeRange(items) {
        let min = null;
        let max = null;
        for (const it of items) {
            const s = normalizeToNoon(it.start);
            const e = normalizeToNoon(it.end);
            if (s && (!min || s < min)) min = s;
            if (e && (!max || e > max)) max = e;
        }
        const now = new Date();
        if (!min || !max) {
            // Fallback: current month
            min = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
            max = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12, 0, 0, 0);
        }

        // Pad the range slightly for readability
        min = new Date(min.getTime() - 3 * DAY_MS);
        max = new Date(max.getTime() + 3 * DAY_MS);
        const totalDays = Math.max(1, Math.round((max - min) / DAY_MS));
        return { start: min, end: max, totalDays };
    }

    function renderChrono(items) {
        const container = document.getElementById('projectTimelineGantt');
        const header = document.getElementById('projectTimelineHeader');
        if (!container) return;

        const range = computeRange(items);
        const PROJECT_START = range.start;
        const PROJECT_END = range.end;
        const TOTAL_DAYS = range.totalDays;

        container.innerHTML = '';
        if (header) {
            header.innerHTML = '';
            header.className = 'chronogram-header';
            // Keep header aligned with current label density
            if (container.classList.contains('chronogram-show-labels')) {
                header.classList.add('chronogram-show-labels');
            }

            // Render Month Labels aligned to the exact range (supports partial months)
            let cur = new Date(PROJECT_START.getFullYear(), PROJECT_START.getMonth(), 1, 12, 0, 0, 0);
            while (cur <= PROJECT_END) {
                const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, 12, 0, 0, 0);
                const segmentStart = new Date(Math.max(PROJECT_START.getTime(), cur.getTime()));
                const segmentEnd = new Date(Math.min(PROJECT_END.getTime(), next.getTime()));

                const days = Math.max(1, Math.round((segmentEnd - segmentStart) / DAY_MS));
                const monthEl = document.createElement('div');
                monthEl.className = 'month';
                monthEl.textContent = cur.toLocaleString('fr-FR', { month: 'short' });
                monthEl.style.flex = String(days);
                header.appendChild(monthEl);

                cur = next;
            }
        }

        // Group items by Section
        const groups = {};
        items.forEach(it => {
            const section = it.region || 'Autres';
            if (!groups[section]) groups[section] = [];
            groups[section].push(it);
        });

        // Render Groups
        Object.entries(groups).forEach(([section, tasks]) => {
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'timeline-section-header';
            sectionHeader.textContent = section;
            container.appendChild(sectionHeader);

            tasks.forEach(task => {
                const row = document.createElement('div');
                row.className = 'gantt-row';
                row.setAttribute('data-task-id', task.id || slugify(task.task));

                const label = document.createElement('div');
                label.className = 'gantt-label';
                label.title = task.task;
                // Title + dates (second line) to improve readability
                const titleLine = document.createElement('div');
                titleLine.className = 'gantt-label-title';
                titleLine.textContent = task.task;
                const metaLine = document.createElement('div');
                metaLine.className = 'gantt-label-meta';
                if (task.start && task.end) {
                    metaLine.textContent = `${task.start.toLocaleDateString('fr-FR')} → ${task.end.toLocaleDateString('fr-FR')}`;
                } else {
                    metaLine.textContent = 'Dates non spécifiées';
                }
                label.appendChild(titleLine);
                label.appendChild(metaLine);

                const timeline = document.createElement('div');
                timeline.className = 'gantt-timeline';

                if (task.start && task.end) {
                    const sNoon = normalizeToNoon(task.start);
                    const eNoon = normalizeToNoon(task.end);
                    const left = ((sNoon - PROJECT_START) / DAY_MS) / TOTAL_DAYS * 100;
                    const width = ((eNoon - sNoon) / DAY_MS) / TOTAL_DAYS * 100;

                    const bar = document.createElement('div');
                    bar.className = 'gantt-bar-pill';
                    bar.style.left = `${Math.max(0, left)}%`;
                    bar.style.width = `${Math.max(0.5, width)}%`; // Min width for visibility
                    bar.style.backgroundColor = getStatusColor(task);
                    bar.title = `${task.task}\nDu ${task.start.toLocaleDateString('fr-FR')} au ${task.end.toLocaleDateString('fr-FR')}`;

                    timeline.appendChild(bar);
                } else {
                    timeline.innerHTML = '<span class="text-[10px] text-gray-400 ml-4 italic">Dates non spécifiées</span>';
                }

                row.appendChild(label);
                row.appendChild(timeline);
                container.appendChild(row);
            });
        });
    }

    // Expose API
    window.chronogramService = {
        render: renderChrono
    };

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        // Toggle label density
        try {
            const toggle = document.getElementById('chronogram-toggle-labels');
            const gantt = document.getElementById('projectTimelineGantt');
            const header = document.getElementById('projectTimelineHeader');
            if (toggle && gantt) {
                toggle.addEventListener('click', () => {
                    gantt.classList.toggle('chronogram-show-labels');
                    if (header) header.classList.toggle('chronogram-show-labels');
                });
            }
        } catch (e) { /* ignore */ }

        // Attempt to load data from window.chronogramData
        if (window.chronogramData && Array.isArray(window.chronogramData.tasks)) {
            const items = window.chronogramData.tasks.map(t => ({
                id: t.id,
                task: t.name,
                region: t.section,
                start: t.start ? new Date(t.start) : null,
                end: t.end ? new Date(t.end) : null
            }));
            renderChrono(items);
        }
    });

})();
