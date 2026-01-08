// chronogramIntegration.js
// Modernized Timeline Service for Suivi PROCASEF
// Refactored for High-Density "Tier-1 SaaS" Aesthetic

(function () {
    // Date Constants
    const PROJECT_START = new Date(2025, 7, 1); // Aug 2025
    const PROJECT_END = new Date(2026, 11, 31); // Dec 2026
    const TOTAL_DAYS = (PROJECT_END - PROJECT_START) / (1000 * 60 * 60 * 24);

    // Helpers
    function slugify(text) {
        return String(text).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
    }

    function getStatusColor(item) {
        if (!item.start || !item.end) return '#cbd5e1'; // Gray-300
        const daysToFinish = Math.round((item.end - new Date()) / (1000 * 60 * 60 * 24));

        // Tier-1 SaaS Semantic Palette
        if (daysToFinish < 0) return '#64748b'; // Overdue/Completed -> Slate-500
        if (daysToFinish <= 14) return '#ef4444'; // Urgent -> Red-500
        if (daysToFinish <= 30) return '#f59e0b'; // Approaching -> Amber-500
        return '#10b981'; // On Track -> Emerald-500
    }

    function renderChrono(items) {
        const container = document.getElementById('projectTimelineGantt');
        const header = document.getElementById('projectTimelineHeader');
        if (!container) return;

        container.innerHTML = '';
        if (header) {
            header.innerHTML = '';
            header.className = 'chronogram-header';

            // Render Month Labels
            let cur = new Date(PROJECT_START.getFullYear(), PROJECT_START.getMonth(), 1);
            while (cur <= PROJECT_END) {
                const monthEl = document.createElement('div');
                monthEl.className = 'month';
                monthEl.textContent = cur.toLocaleString('fr-FR', { month: 'short' });
                header.appendChild(monthEl);
                cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
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
                label.textContent = task.task;

                const timeline = document.createElement('div');
                timeline.className = 'gantt-timeline';

                if (task.start && task.end) {
                    const left = ((task.start - PROJECT_START) / (1000 * 60 * 60 * 24)) / TOTAL_DAYS * 100;
                    const width = ((task.end - task.start) / (1000 * 60 * 60 * 24)) / TOTAL_DAYS * 100;

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
