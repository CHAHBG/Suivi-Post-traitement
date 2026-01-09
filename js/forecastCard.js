(function () {
    // Small forecast card renderer: uses the SINGLE source of truth for KPIs
    const containerId = 'forecastContent';
    const STORAGE_KEY = 'monthlyForecastCard_v1';

    function findKPIs() {
        // SINGLE SOURCE OF TRUTH: only use window.kpis which is set by enhancedDashboard
        // This ensures the forecast card and the KPI card show the exact same date
        if (window.kpis && window.kpis.monthly && window.kpis.monthly.forecast) {
            return window.kpis;
        }
        // Fallback to last good KPIs if available
        if (window.__lastGoodKPIs && window.__lastGoodKPIs.monthly && window.__lastGoodKPIs.monthly.forecast) {
            return window.__lastGoodKPIs;
        }
        // Do NOT recalculate - this would cause date mismatch
        return null;
    }
    
    // Update the KPI card "Fin Objectif" to ensure it matches
    function updateKPICard(fc) {
        const ccEl = document.getElementById('completionConfidence');
        if (ccEl && fc && fc.estimatedCompletionDateShort) {
            ccEl.textContent = fc.estimatedCompletionDateShort;
        }
    }

    function formatNumber(v) {
        try { return new Intl.NumberFormat('fr-FR').format(Math.round(v)); } catch (e) { return String(v); }
    }

    function renderForecast(fc) {
        const el = document.getElementById(containerId);
        if (!el) return;
        
        // ALWAYS update the KPI card too to ensure sync
        updateKPICard(fc);
        
        if (!fc) {
            el.innerHTML = '<div class="text-xs text-slate-500">Aucune prévision disponible</div>';
            return;
        }

        // New January 2026 Logic
        if (fc.janCurrent !== undefined) {
            const achievable = fc.achievable;
            const reqRate = formatNumber(fc.requiredDailyRate || 0);
            const curRate = formatNumber(fc.currentDailyAvg || 0);

            // Use the pre-calculated estimated completion date
            let estimateHtml = '';
            if (fc.estimatedCompletionDateStr && !fc.estimatedCompletionDateStr.includes('--')) {
                const dateStr = fc.estimatedCompletionDateStr;
                
                // Check if late (after January)
                let isLate = false;
                if (fc.estimatedCompletionDate) {
                    const estDate = fc.estimatedCompletionDate instanceof Date 
                        ? fc.estimatedCompletionDate 
                        : new Date(fc.estimatedCompletionDate);
                    isLate = estDate.getMonth() > 0 && estDate.getFullYear() >= 2026;
                }

                estimateHtml = `<div class="mt-2 text-xs border-t border-slate-100 pt-2 flex justify-between">
                    <span class="text-slate-500">Objectif atteint le:</span>
                    <span class="font-bold ${!isLate ? 'text-emerald-600' : 'text-red-500'}">${dateStr}</span>
                </div>`;
            }

            el.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-medium">Objectif Janvier: <span class="font-bold">${formatNumber(fc.janGoal)}</span></div>
                    <div class="text-xs text-slate-500">${fc.daysRemaining}j restants</div>
                </div>
                <div class="space-y-2">
                    <div class="flex justify-between items-center bg-slate-50 p-2 rounded">
                        <span class="text-xs text-slate-600">Requis / Jour</span>
                        <span class="font-bold text-orange-600">${reqRate}</span>
                    </div>
                    <div class="flex justify-between items-center bg-slate-50 p-2 rounded">
                        <span class="text-xs text-slate-600">Actuel / Jour</span>
                        <span class="font-bold ${achievable ? 'text-emerald-600' : 'text-red-600'}">${curRate}</span>
                    </div>
                </div>
                ${estimateHtml}
                <div class="mt-2 text-center text-xs font-semibold ${achievable ? 'text-emerald-600' : 'text-red-500'}">
                    ${fc.alert || (achievable ? 'Objectif Atteignable' : 'Rythme Insuffisant')}
                </div>
            `;
            return;
        }

        // Legacy / Fallback Logic
        const achievable = !!fc.achievable;
        const proj = fc.projections || {};
        const months = Object.keys(proj);
        let rows = '';
        months.forEach(m => {
            const entry = proj[m] || {};
            const val = (typeof entry === 'number') ? entry : (entry.projectedTotal !== undefined ? entry.projectedTotal : NaN);
            const daysLeft = entry.daysRemaining !== undefined ? entry.daysRemaining : null;
            rows += `<div class="flex justify-between py-1"><span>${m}${daysLeft !== null ? ` <span class=\"text-xs text-slate-400\">(${daysLeft}j)</span>` : ''}</span><strong>${isNaN(Number(val)) ? '—' : formatNumber(val)}</strong></div>`;
        });
        el.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="text-sm font-medium">Statut: <span class="font-semibold">${achievable ? '<span style=\"color:#10B981\">Atteignable</span>' : '<span style=\"color:#EF4444\">Non atteignable</span>'}</span></div>
                <div class="text-xs text-slate-500">Mise à jour: ${new Date().toLocaleString()}</div>
            </div>
            <div class="mt-2">${rows}</div>
        `;
    }

    // --- Popover & Modal UI ---
    function buildPopover() {
        let pop = document.getElementById('forecastPopover');
        if (pop) return pop;
        pop = document.createElement('div');
        pop.id = 'forecastPopover';
        pop.className = 'forecast-popover';
        // Ensure the popover floats above other UI layers
        pop.style.zIndex = '99999';
        pop.style.position = 'absolute';
        pop.style.display = 'none';
        // Localization defaults (French); page can override via window.localeForecastStrings
        const LOC = (window.localeForecastStrings && typeof window.localeForecastStrings === 'object') ? window.localeForecastStrings : {
            close: 'Fermer',
            details: 'Voir détails',
            title: 'Détails des Prévisions',
            noData: 'Aucune prévision'
        };
        pop.innerHTML = `
                <div class="popover-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h4 id="forecastPopoverTitle" style="margin:0; font-size:1rem; font-weight:600;">${LOC.title}</h4>
                    <button id="popoverCloseBtn" aria-label="${LOC.close}" class="action-button" style="margin-left:8px;">${LOC.close}</button>
                </div>
                <div id="popoverContent" tabindex="-1" style="margin-top:0.5rem; outline:none;">Chargement...</div>
                <div id="popoverExplain" style="margin-top:0.5rem; font-size:0.9rem; color:var(--color-gray-600);"></div>
                <div style="text-align:right; margin-top:0.5rem;"><button id="popoverDetailsBtn" class="action-button" style="display:none;">${LOC.details}</button></div>
            `;
        document.body.appendChild(pop);
        try { console.debug('[forecastCard] buildPopover: appended popover to body', pop); } catch (e) { }
        try {
            const detailsBtn = document.getElementById('popoverDetailsBtn');
            if (detailsBtn) detailsBtn.addEventListener('click', () => { openModal(); closePopover(); });
            const closeBtn = document.getElementById('popoverCloseBtn');
            if (closeBtn) closeBtn.addEventListener('click', () => closePopover());
        } catch (e) { /* ignore */ }
        return pop;
    }

    function openPopover(anchorEl) {
        try { console.debug('[forecastCard] openPopover called, anchorEl:', anchorEl); } catch (e) { }
        // Close any existing popover state before opening a new one
        try { closePopover(); } catch (e) { }
        // Defensive fallback: if anchor is missing or detached, fall back to first known opener or the forecast card
        try {
            if (!anchorEl || typeof anchorEl.getBoundingClientRect !== 'function') {
                try { console.debug('[forecastCard] openPopover: invalid anchorEl, falling back to query'); } catch (e) { }
                anchorEl = document.querySelector('.forecast-icon-btn') || document.getElementById('monthlyForecastCard') || document.body;
            }
        } catch (e) { /* continue with whatever anchorEl we have */ }

        const prevActive = document.activeElement;
        const pop = buildPopover();
        // Accessibility attributes
        try { pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', 'forecastPopoverTitle'); pop.setAttribute('aria-modal', 'true'); pop.setAttribute('aria-hidden', 'false'); } catch (e) { }

        const kpis = findKPIs();
        const fc = kpis && kpis.monthly && kpis.monthly.forecast ? kpis.monthly.forecast : null;
        const content = pop.querySelector('#popoverContent');
        const explain = pop.querySelector('#popoverExplain');

        if (!fc) {
            content.innerHTML = '<div class="text-xs text-slate-500">Aucune prévision</div>';
            if (explain) explain.innerHTML = '';
        }
        else if (fc.janCurrent !== undefined) {
            // New January Logic Popover
            const achievable = fc.achievable;

            // Use the pre-calculated date from forecast
            let dateText = fc.estimatedCompletionDateStr || 'Inconnue';
            let isLate = false;
            
            // Check if late (after January)
            if (fc.estimatedCompletionDate) {
                const estDate = fc.estimatedCompletionDate instanceof Date 
                    ? fc.estimatedCompletionDate 
                    : new Date(fc.estimatedCompletionDate);
                isLate = estDate.getMonth() > 0 && estDate.getFullYear() >= 2026;
                // Format with weekday for popover
                if (!dateText.includes('Atteint') && !dateText.includes('Inconnue')) {
                    dateText = estDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                }
            }

            content.innerHTML = `
                <div style="font-weight:600; margin-bottom:8px;">
                    ${achievable ? '<span style=\"color:#10B981\">Objectif Atteignable</span>' : '<span style=\"color:#EF4444\">Rythme Insuffisant</span>'}
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.9rem;">
                    <div class="bg-gray-50 p-2 rounded">
                        <span class="block text-xs text-gray-500">Réalisé</span>
                        <span class="font-bold">${formatNumber(fc.janCurrent)}</span>
                    </div>
                    <div class="bg-gray-50 p-2 rounded">
                        <span class="block text-xs text-gray-500">Reste (Obj. ${formatNumber(fc.janGoal)})</span>
                        <span class="font-bold">${formatNumber(fc.remainingToGoal)}</span>
                    </div>
                </div>
                <div class="mt-3 bg-blue-50 p-2 rounded border border-blue-100">
                    <span class="block text-xs text-blue-600">Objectif atteint le:</span>
                    <span class="font-bold ${!isLate ? 'text-blue-700' : 'text-red-600'}">${dateText}</span>
                </div>
             `;

            if (explain) {
                const gap = fc.janGoal - fc.janCurrent;
                const dailyGap = gap > 0 ? Math.round(gap / (fc.daysRemaining || 1)) : 0;
                explain.innerHTML = `
                    <div style="margin-top:8px; font-size:0.85rem;">
                        ${achievable
                        ? `À ce rythme (${formatNumber(fc.currentDailyAvg)}/j), vous dépasserez l'objectif de <strong>${formatNumber((fc.currentDailyAvg * fc.daysRemaining) - gap)}</strong> parcelles.`
                        : `Il manque <strong>${formatNumber(gap)}</strong> parcelles. Il faut augmenter la cadence de <strong>+${formatNumber(Math.max(0, fc.requiredDailyRate - fc.currentDailyAvg))}</strong>/j.`}
                    </div>
                 `;
            }
        } else {
            // Legacy Logic
            const achievable = !!fc.achievable;
            const proj = fc.projections || {};
            const firstEntry = Object.entries(proj)[0];
            let line = '—';
            if (firstEntry) {
                const key = firstEntry[0];
                const entry = firstEntry[1];
                const val = (typeof entry === 'number') ? entry : (entry && entry.projectedTotal !== undefined ? entry.projectedTotal : NaN);
                line = isNaN(Number(val)) ? `${key}: —` : `${key}: ${formatNumber(val)}`;
            }
            content.innerHTML = `<div style="font-weight:600;">${achievable ? '<span style=\"color:#10B981\">Atteignable</span>' : '<span style=\"color:#EF4444\">Non atteignable</span>'}</div><div style="font-size:0.9rem; margin-top:0.25rem;">${line}</div>`;

            // Render explanation + recommendations
            try {
                if (explain) {
                    const reason = fc.achievable ? 'Le rythme actuel est suffisant pour atteindre l\'objectif mensuel.' : 'Le rythme actuel n\'est pas suffisant pour atteindre l\'objectif mensuel.';
                    const recs = fc.achievable ? ['Maintenir la cadence actuelle', 'Vérifier la qualité pour éviter retards'] : ['Augmenter les levées quotidiennes', 'Reprioriser communes à faible performance', 'Ajouter ressources temporaires'];
                    explain.innerHTML = `<div style="font-weight:600; margin-bottom:6px;">Pourquoi:</div><div style="margin-bottom:6px;">${reason}</div><div style="font-weight:600; margin-bottom:4px;">Recommandations:</div><ul style="margin-left:1rem;">${recs.map(r => `<li>${r}</li>`).join('')}</ul>`;
                }
            } catch (e) { }
        }

        // Apply flash class to popover and forecast card based on achievability
        try {
            const forecastCardEl = document.getElementById('monthlyForecastCard');
            if (forecastCardEl) {
                forecastCardEl.classList.remove('forecast-flash-success', 'forecast-flash-danger');
                if (fc && fc.achievable) forecastCardEl.classList.add('forecast-flash-success');
                else if (fc) forecastCardEl.classList.add('forecast-flash-danger');
            }
            // Also flash the popover itself
            if (pop) {
                pop.classList.remove('forecast-flash-success', 'forecast-flash-danger');
                if (fc && fc.achievable) pop.classList.add('forecast-flash-success');
                else if (fc) pop.classList.add('forecast-flash-danger');
            }
        } catch (e) { }

        // Ensure popover is styled visibly (border color indicates status)
        try {
            const borderColor = fc ? (fc.achievable ? '#10B981' : '#EF4444') : '#E5E7EB';
            pop.style.border = `2px solid ${borderColor}`;
            pop.style.background = '#fff';
            pop.style.padding = '10px';
            pop.style.borderRadius = '6px';
            pop.style.boxShadow = '0 8px 24px rgba(15,23,42,0.15)';
            pop.style.pointerEvents = 'auto';
        } catch (e) { }

        // Position popover with simple collision handling + responsive behavior
        pop.style.display = 'block';
        pop.style.visibility = 'hidden'; // measure without flicker
        requestAnimationFrame(() => {
            try {
                const viewportWidth = document.documentElement.clientWidth;
                const viewportHeight = document.documentElement.clientHeight;
                if (viewportWidth <= 520) {
                    // Mobile: fixed full-width-ish panel at top
                    pop.style.position = 'fixed';
                    pop.style.left = '8px';
                    pop.style.right = '8px';
                    pop.style.top = '8px';
                    pop.style.width = 'auto';
                    pop.style.maxWidth = 'calc(100% - 16px)';
                    pop.style.visibility = 'visible';
                    const contentEl = pop.querySelector('#popoverContent');
                    try { contentEl && contentEl.focus(); } catch (_) { }
                    return;
                }
                const rect = anchorEl.getBoundingClientRect();
                const popRect = pop.getBoundingClientRect();
                // Prefer below the anchor
                let top = rect.bottom + window.scrollY + 8; // 8px gap
                let left = rect.left + window.scrollX;
                // If pop would overflow right, shift left
                if (left + popRect.width > viewportWidth - 8) {
                    left = Math.max(8, viewportWidth - popRect.width - 8);
                }
                // If not enough space below, place above
                if (top + popRect.height - window.scrollY > viewportHeight - 16) {
                    top = rect.top + window.scrollY - popRect.height - 8;
                }
                left = Math.max(8, left);
                pop.style.left = `${left}px`;
                pop.style.top = `${top}px`;
                pop.style.visibility = 'visible';
                // focus close button or content
                try {
                    const focusable = pop.querySelector('#popoverCloseBtn') || pop.querySelector('#popoverDetailsBtn') || pop.querySelector('#popoverContent');
                    if (focusable && typeof focusable.focus === 'function') focusable.focus();
                } catch (e) { }
            } catch (e) { try { pop.style.visibility = 'visible'; } catch (_) { } }
        });

        // Save previous active element so we can restore focus
        try { pop.__prevActive = prevActive; } catch (e) { }

        // Event handlers: outside click, escape to close, and tab key trap
        const onDocClick = (ev) => {
            const p = document.getElementById('forecastPopover');
            if (!p) return;
            if (p.contains(ev.target) || (anchorEl && anchorEl.contains && anchorEl.contains(ev.target))) return; // click inside -> ignore
            closePopover();
        };
        const onDocKey = (ev) => {
            if (ev.key === 'Escape') closePopover();
        };
        const onKeyTrap = (ev) => {
            if (ev.key !== 'Tab') return;
            const focusables = Array.from(pop.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(n => n.offsetParent !== null);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
            else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        };
        // Attach handlers and keep refs for cleanup
        window.__forecastOnDocClick = onDocClick;
        window.__forecastOnDocKey = onDocKey;
        window.__forecastOnKeyTrap = onKeyTrap;
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onDocKey);
        document.addEventListener('keydown', onKeyTrap);

        // set aria-expanded on opener when possible
        try { if (anchorEl && anchorEl.setAttribute) anchorEl.setAttribute('aria-expanded', 'true'); } catch (e) { }
    }

    function closePopover() {
        const p = document.getElementById('forecastPopover');
        if (p) {
            p.style.display = 'none';
            p.classList.remove('forecast-flash-success', 'forecast-flash-danger');
            try { p.setAttribute('aria-hidden', 'true'); } catch (e) { }
        }
        const fc = document.getElementById('monthlyForecastCard');
        if (fc) fc.classList.remove('forecast-flash-success', 'forecast-flash-danger');
        // Restore aria-expanded on openers
        try {
            const opener = document.querySelector('.forecast-icon-btn[aria-expanded="true"]');
            if (opener) try { opener.setAttribute('aria-expanded', 'false'); } catch (e) { }
        } catch (e) { }

        // Remove document-level handlers if registered
        try {
            if (window.__forecastOnDocClick) { document.removeEventListener('click', window.__forecastOnDocClick); delete window.__forecastOnDocClick; }
            if (window.__forecastOnDocKey) { document.removeEventListener('keydown', window.__forecastOnDocKey); delete window.__forecastOnDocKey; }
            if (window.__forecastOnKeyTrap) { document.removeEventListener('keydown', window.__forecastOnKeyTrap); delete window.__forecastOnKeyTrap; }
        } catch (e) { }

        // Restore focus to previously focused element if available
        try {
            if (p && p.__prevActive && typeof p.__prevActive.focus === 'function') {
                p.__prevActive.focus();
                delete p.__prevActive;
            }
        } catch (e) { }
    }

    function buildModal() {
        let m = document.getElementById('forecastModalBackdrop');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'forecastModalBackdrop';
        m.className = 'forecast-modal-backdrop';
        m.style.display = 'none';
        m.innerHTML = `
            <div class="forecast-modal" role="dialog" aria-modal="true">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>Prévisions mensuelles — Détails</h3>
                    <button id="modalCloseBtn" class="action-button">Fermer</button>
                </div>
                <div id="modalContent" style="margin-top:0.75rem; max-height:60vh; overflow:auto;"></div>
            </div>
        `;
        document.body.appendChild(m);
        m.querySelector('#modalCloseBtn').addEventListener('click', closeModal);
        return m;
    }

    function openModal() {
        const m = buildModal();
        const kpis = findKPIs();
        const fc = kpis && kpis.monthly && kpis.monthly.forecast ? kpis.monthly.forecast : null;
        if (fc && (!fc.projections || Object.keys(fc.projections).length === 0)) {
            console.debug('[forecastCard] forecast object present but projections empty or malformed:', fc);
        }
        const content = m.querySelector('#modalContent');
        if (!fc) {
            content.innerHTML = '<div class="text-xs text-slate-500">Aucune prévision disponible</div>';
        } else {
            const achievable = !!fc.achievable;
            const proj = fc.projections || {};
            let rows = '<div style="margin-bottom:0.5rem;">Statut: ' + (achievable ? '<span style="color:#10B981">Atteignable</span>' : '<span style="color:#EF4444">Non atteignable</span>') + '</div>';
            rows += '<div>';
            Object.entries(proj).forEach(([mName, entry]) => {
                const val = (typeof entry === 'number') ? entry : (entry && entry.projectedTotal !== undefined ? entry.projectedTotal : NaN);
                const daysLeft = entry && entry.daysRemaining !== undefined ? entry.daysRemaining : null;
                rows += `<div class="month-row"><div>${mName}${daysLeft !== null ? ` <span class=\"text-xs text-slate-400\">(${daysLeft}j)</span>` : ''}</div><div><strong>${isNaN(Number(val)) ? '—' : formatNumber(val)}</strong></div></div>`;
            });
            rows += '</div>';
            content.innerHTML = rows;
        }
        m.style.display = 'flex';
        // flash modal/backdrop based on achievability
        try {
            const kpis = findKPIs();
            const fc = kpis && kpis.monthly && kpis.monthly.forecast ? kpis.monthly.forecast : null;
            if (fc) {
                m.classList.remove('forecast-flash-success', 'forecast-flash-danger');
                if (fc.achievable) m.classList.add('forecast-flash-success'); else m.classList.add('forecast-flash-danger');
            }
        } catch (e) { }
    }

    function closeModal() {
        const m = document.getElementById('forecastModalBackdrop');
        if (m) {
            m.style.display = 'none';
            m.classList.remove('forecast-flash-success', 'forecast-flash-danger');
        }
    }

    // expose API
    window.forecastCard = {
        openPopover,
        closePopover,
        openModal,
        closeModal,
        update: function (kpis) {
            if (kpis && kpis.monthly && kpis.monthly.forecast) {
                renderForecast(kpis.monthly.forecast);
            } else {
                // Try finding them if not provided
                const found = findKPIs();
                if (found && found.monthly && found.monthly.forecast) {
                    renderForecast(found.monthly.forecast);
                }
            }
        }
    };

    // Test helper for manual invocation from console
    try {
        window.forecastCard.testOpen = function () {
            try { console.debug('[forecastCard] testOpen invoked'); } catch (e) { }
            const anchor = document.querySelector('.forecast-icon-btn') || document.getElementById('monthlyForecastCard') || document.body;
            window.forecastCard.openPopover(anchor);
        };
    } catch (e) { }

    // Init: attach a delegated click handler for forecast icon buttons (fallback) and add small icon to forecast card header
    function attachIconFallback() {
        // Capturing click listener: defensive — runs before other bubble handlers and before stopPropagation in bubbling
        document.addEventListener('click', (ev) => {
            const btn = ev.target && ev.target.closest && ev.target.closest('.forecast-icon-btn');
            if (btn) {
                try { console.debug('[forecastCard] capturing click detected for forecast-icon-btn'); } catch (e) { }
                // Do NOT stopPropagation here so other UI can also react if needed
                if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') {
                    window.forecastCard.openPopover(btn);
                }
            }
        }, true);

        // Delegated click for any .forecast-icon-btn that may be added later (bubble phase)
        document.addEventListener('click', (ev) => {
            const btn = ev.target && ev.target.closest && ev.target.closest('.forecast-icon-btn');
            if (btn) {
                ev.stopPropagation();
                try { console.debug('[forecastCard] delegated click detected for forecast-icon-btn'); } catch (e) { }
                if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') {
                    window.forecastCard.openPopover(btn);
                }
            }
        });

        // Also attach direct listeners to any already-present buttons to be defensive
        try {
            const existing = Array.from(document.querySelectorAll('.forecast-icon-btn'));
            existing.forEach(btn => {
                if (btn.dataset && btn.dataset.fcBound) return; // already bound
                // ensure accessible attributes
                try { if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false'); if (!btn.hasAttribute('aria-haspopup')) btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('type', 'button'); } catch (e) { }
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try { console.debug('[forecastCard] direct click detected for forecast-icon-btn'); } catch (e) { }
                    if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(btn);
                });
                btn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); window.forecastCard && typeof window.forecastCard.openPopover === 'function' && window.forecastCard.openPopover(btn); } });
                try { btn.dataset.fcBound = '1'; } catch (_) { }
            });
            try { console.debug('[forecastCard] attachIconFallback: direct listeners attached to', existing.length, 'buttons'); } catch (e) { }
        } catch (e) { /* ignore */ }
        // Keyboard activation: open popover when focused button receives Enter or Space
        try {
            document.addEventListener('keydown', (ev) => {
                const active = document.activeElement;
                if (!active) return;
                if (active.classList && active.classList.contains('forecast-icon-btn')) {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        try { console.debug('[forecastCard] keyboard activation for forecast-icon-btn'); } catch (e) { }
                        if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(active);
                    }
                }
            }, true);
        } catch (e) { /* ignore */ }

        // Also add a small icon inside the forecast card header as an alternate opener
        try {
            const card = document.getElementById('monthlyForecastCard');
            if (card && !card.querySelector('.forecast-icon-btn.alt')) {
                const header = card.querySelector('.metric-header');
                if (header) {
                    const altBtn = document.createElement('button');
                    altBtn.type = 'button';
                    altBtn.className = 'forecast-icon-btn alt';
                    altBtn.title = 'Afficher prévisions';
                    altBtn.setAttribute('aria-expanded', 'false');
                    altBtn.setAttribute('aria-haspopup', 'dialog');
                    altBtn.innerHTML = '<i class="fas fa-chart-line"></i>';
                    altBtn.style.position = 'absolute';
                    altBtn.style.top = '12px';
                    altBtn.style.right = '12px';
                    header.style.position = 'relative';
                    header.appendChild(altBtn);
                    altBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(altBtn);
                    });
                    altBtn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(altBtn); } });
                    try { console.debug('[forecastCard] attachIconFallback: created alt opener inside monthlyForecastCard'); } catch (e) { }
                }
            }
        } catch (e) { /* ignore */ }

        // MutationObserver: watch for future insertions of .forecast-icon-btn and bind listeners
        try {
            if (!window.__forecastBtnObserverBound) {
                const obs = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        for (const node of Array.from(m.addedNodes || [])) {
                            if (node.nodeType !== 1) continue;
                            try {
                                if (node.matches && node.matches('.forecast-icon-btn')) {
                                    if (!node.dataset || !node.dataset.fcBound) {
                                        try { if (!node.hasAttribute('aria-expanded')) node.setAttribute('aria-expanded', 'false'); if (!node.hasAttribute('aria-haspopup')) node.setAttribute('aria-haspopup', 'dialog'); node.setAttribute('type', 'button'); } catch (e) { }
                                        node.addEventListener('click', (e) => {
                                            e.stopPropagation();
                                            try { console.debug('[forecastCard] observer-bound click detected for forecast-icon-btn'); } catch (e) { }
                                            if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(node);
                                        });
                                        node.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(node); } });
                                        try { node.dataset.fcBound = '1'; } catch (_) { }
                                    }
                                }
                                const inner = node.querySelector && node.querySelectorAll ? Array.from(node.querySelectorAll('.forecast-icon-btn')) : [];
                                inner.forEach(btn => {
                                    if (btn.dataset && btn.dataset.fcBound) return;
                                    try { if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false'); if (!btn.hasAttribute('aria-haspopup')) btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('type', 'button'); } catch (e) { }
                                    btn.addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        try { console.debug('[forecastCard] observer-bound inner click detected for forecast-icon-btn'); } catch (e) { }
                                        if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(btn);
                                    });
                                    btn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(btn); } });
                                    try { btn.dataset.fcBound = '1'; } catch (_) { }
                                });
                            } catch (_) { }
                        }
                    }
                });
                obs.observe(document.body, { childList: true, subtree: true });
                window.__forecastBtnObserverBound = true;
                try { console.debug('[forecastCard] MutationObserver attached to watch for forecast-icon-btn insertions'); } catch (e) { }
            }
        } catch (e) { /* ignore */ }
    }

    function init() {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = 'Chargement...';

        // Try to find KPIs now, else poll a few times
        let attempts = 0;
        const maxAttempts = 30; // Increased to ensure late data arrival is caught
        const poll = setInterval(() => {
            attempts++;
            const kpis = findKPIs();
            if (kpis && kpis.monthly && kpis.monthly.forecast) {
                clearInterval(poll);
                renderForecast(kpis.monthly.forecast);
            } else if (attempts >= maxAttempts) {
                clearInterval(poll);
                // final attempt: render what's available
                if (kpis && kpis.monthly && kpis.monthly.forecast) renderForecast(kpis.monthly.forecast);
                else renderForecast(null);
            }
        }, 1000); // Slower poll, longer duration (30s total)

        // Attach click handler for the forecast logo button in the card
        try {
            const logoBtn = document.getElementById('forecastLogoBtn');
            if (logoBtn) {
                logoBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    try { console.debug('[forecastCard] forecastLogoBtn clicked'); } catch (e) { }
                    if (window.forecastCard && typeof window.forecastCard.openPopover === 'function') window.forecastCard.openPopover(logoBtn);
                });
            }
            try { console.debug('[forecastCard] init: forecastLogoBtn present?', !!document.getElementById('forecastLogoBtn'), 'any forecast-icon-btn?', !!document.querySelector('.forecast-icon-btn')); } catch (e) { }
        } catch (e) { }
    }

    // Start after DOM ready
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    // Attach fallback click handlers / alt opener after DOM ready
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachIconFallback); else attachIconFallback();
})();
