/**
 * Guided Tour System for PROCASSEF Dashboard
 * Provides an interactive onboarding experience for first-time users
 * All in French with preference persistence
 */
(function () {
    const STORAGE_KEY = 'procassef_tour_preferences';
    const TOUR_VERSION = '1.0'; // Increment this to show tour again after major updates

    // Tour configuration
    const tourSteps = [
        // Vue d'ensemble tab
        {
            target: '.nav-tabs',
            title: 'Navigation Principale',
            content: 'Utilisez ces onglets pour naviguer entre les différentes sections du tableau de bord : Vue d\'ensemble, Analyse Performance, Analyse Régionale et Suivi Temporel.',
            position: 'bottom',
            tab: 'overview'
        },
        {
            target: '#regionFilter',
            title: 'Filtres',
            content: 'Filtrez les données par région et par période (Quotidien, Hebdomadaire, Mensuel) pour une analyse plus précise.',
            position: 'bottom',
            tab: 'overview'
        },
        {
            target: '.kpi-card:first-child',
            title: 'Indicateurs Clés',
            content: 'Ces cartes affichent les métriques essentielles : Taux de Réussite, Prochain Lot, Pertes, Cadence Requise, Écart Cumulé et Date de Fin d\'Objectif. Survolez-les pour voir les détails de calcul.',
            position: 'bottom',
            tab: 'overview'
        },
        {
            target: '#completionConfidence',
            title: 'Date Fin Objectif',
            content: 'Cette date indique quand l\'objectif mensuel sera atteint au rythme actuel de travail. Elle est calculée en divisant les parcelles restantes par la moyenne quotidienne.',
            position: 'left',
            tab: 'overview'
        },
        {
            target: '#dailyStat',
            title: 'Performance Journalière',
            content: 'Suivez votre progression quotidienne par rapport à l\'objectif. La barre de progression et le pourcentage vous indiquent où vous en êtes.',
            position: 'left',
            tab: 'overview'
        },
        {
            target: '#monthlyStat',
            title: 'Objectif Mensuel',
            content: 'Vue d\'ensemble de la progression vers l\'objectif du mois. Le graphique sparkline montre la tendance récente.',
            position: 'left',
            tab: 'overview'
        },
        {
            target: '#overviewDailyYieldsChart',
            title: 'Évolution Quotidienne',
            content: 'Ce graphique montre l\'évolution des levées jour par jour. La ligne rouge pointillée représente l\'objectif quotidien.',
            position: 'top',
            tab: 'overview'
        },
        {
            target: '#forecastContent',
            title: 'Projection Fin de Mois',
            content: 'Cette section calcule si l\'objectif mensuel est atteignable au rythme actuel. Elle affiche le taux requis vs le taux actuel et la date estimée d\'atteinte de l\'objectif.',
            position: 'left',
            tab: 'overview'
        },
        {
            target: '#monitoringIndicators',
            title: 'Statut du Pipeline',
            content: 'Visualisez la progression des parcelles à travers les étapes : NICAD, CTASF et Délibérées.',
            position: 'top',
            tab: 'overview'
        },
        // Analyse Performance tab
        {
            target: '[data-panel="performance"]',
            title: 'Analyse Performance',
            content: 'Cet onglet offre une vue détaillée des performances avec des graphiques Burn-Up, vélocité et analyse des tendances.',
            position: 'bottom',
            tab: 'performance',
            clickTab: true
        },
        // Analyse Régionale tab
        {
            target: '[data-panel="regional"]',
            title: 'Analyse Régionale',
            content: 'Comparez les performances par commune et région. Accédez au chronogramme détaillé pour chaque zone.',
            position: 'bottom',
            tab: 'regional',
            clickTab: true
        },
        // Suivi Temporel tab
        {
            target: '[data-panel="temporal"]',
            title: 'Suivi Temporel',
            content: 'Analysez les données sur différentes périodes : journalier, hebdomadaire et mensuel avec des tableaux détaillés.',
            position: 'bottom',
            tab: 'temporal',
            clickTab: true
        },
        // Final step
        {
            target: '#refreshBtn',
            title: 'Actualisation des Données',
            content: 'Les données sont automatiquement actualisées toutes les 5 minutes. Cliquez sur ce bouton pour forcer une actualisation immédiate.',
            position: 'bottom',
            tab: 'overview',
            clickTab: true
        }
    ];

    let currentStep = 0;
    let overlay = null;
    let tooltip = null;
    let isActive = false;

    // Load preferences from localStorage
    function getPreferences() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Error loading tour preferences:', e);
        }
        return {
            completed: false,
            skipped: false,
            neverShowAgain: false,
            version: null,
            lastShown: null
        };
    }

    // Save preferences to localStorage
    function savePreferences(prefs) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.warn('Error saving tour preferences:', e);
        }
    }

    // Create the overlay element
    function createOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.className = 'tour-overlay';
        overlay.innerHTML = `
            <div class="tour-spotlight"></div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    // Create the tooltip element
    function createTooltip() {
        tooltip = document.createElement('div');
        tooltip.id = 'tour-tooltip';
        tooltip.className = 'tour-tooltip';
        tooltip.innerHTML = `
            <div class="tour-tooltip-arrow"></div>
            <div class="tour-tooltip-header">
                <span class="tour-tooltip-title"></span>
                <button class="tour-tooltip-close" aria-label="Fermer">&times;</button>
            </div>
            <div class="tour-tooltip-content"></div>
            <div class="tour-tooltip-footer">
                <div class="tour-tooltip-progress">
                    <span class="tour-step-current">1</span> / <span class="tour-step-total">${tourSteps.length}</span>
                </div>
                <div class="tour-tooltip-buttons">
                    <button class="tour-btn tour-btn-skip">Passer</button>
                    <button class="tour-btn tour-btn-prev" disabled>Précédent</button>
                    <button class="tour-btn tour-btn-next tour-btn-primary">Suivant</button>
                </div>
            </div>
            <div class="tour-tooltip-checkbox">
                <label>
                    <input type="checkbox" id="tour-never-show"> Ne plus afficher cette visite
                </label>
            </div>
        `;
        document.body.appendChild(tooltip);

        // Event listeners
        tooltip.querySelector('.tour-tooltip-close').addEventListener('click', endTour);
        tooltip.querySelector('.tour-btn-skip').addEventListener('click', skipTour);
        tooltip.querySelector('.tour-btn-prev').addEventListener('click', prevStep);
        tooltip.querySelector('.tour-btn-next').addEventListener('click', nextStep);

        return tooltip;
    }

    // Position the tooltip near the target element
    function positionTooltip(targetEl, position) {
        if (!targetEl || !tooltip) return;

        const rect = targetEl.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const padding = 20;
        const arrowSize = 12;

        let top, left;
        const arrow = tooltip.querySelector('.tour-tooltip-arrow');

        // Reset arrow classes
        arrow.className = 'tour-tooltip-arrow';

        switch (position) {
            case 'top':
                top = rect.top - tooltipRect.height - padding - arrowSize;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                arrow.classList.add('arrow-bottom');
                break;
            case 'bottom':
                top = rect.bottom + padding + arrowSize;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                arrow.classList.add('arrow-top');
                break;
            case 'left':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.left - tooltipRect.width - padding - arrowSize;
                arrow.classList.add('arrow-right');
                break;
            case 'right':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.right + padding + arrowSize;
                arrow.classList.add('arrow-left');
                break;
            default:
                top = rect.bottom + padding;
                left = rect.left;
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < padding) left = padding;
        if (left + tooltipRect.width > viewportWidth - padding) {
            left = viewportWidth - tooltipRect.width - padding;
        }
        if (top < padding) {
            // If tooltip doesn't fit on top, try bottom
            if (position === 'top') {
                top = rect.bottom + padding + arrowSize;
                arrow.className = 'tour-tooltip-arrow arrow-top';
            } else {
                top = padding;
            }
        }
        if (top + tooltipRect.height > viewportHeight - padding) {
            // If tooltip doesn't fit on bottom, try top
            if (position === 'bottom') {
                top = rect.top - tooltipRect.height - padding - arrowSize;
                arrow.className = 'tour-tooltip-arrow arrow-bottom';
            } else {
                top = viewportHeight - tooltipRect.height - padding;
            }
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    // Highlight the target element
    function highlightElement(targetEl) {
        if (!targetEl || !overlay) return;

        // First scroll element into view with proper centering
        targetEl.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center' 
        });

        // Wait for scroll to complete before positioning spotlight
        setTimeout(() => {
            const rect = targetEl.getBoundingClientRect();
            const spotlight = overlay.querySelector('.tour-spotlight');
            const padding = 10;

            // Add scroll offsets for accurate positioning
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            spotlight.style.top = `${rect.top + scrollTop - padding}px`;
            spotlight.style.left = `${rect.left + scrollLeft - padding}px`;
            spotlight.style.width = `${rect.width + padding * 2}px`;
            spotlight.style.height = `${rect.height + padding * 2}px`;

            // Ensure element is visible and not covered
            targetEl.style.position = 'relative';
            targetEl.style.zIndex = '99992';
        }, 100);
    }

    // Show a specific step
    function showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= tourSteps.length) return;

        const step = tourSteps[stepIndex];
        currentStep = stepIndex;

        // Hide tooltip during transition
        if (tooltip) {
            tooltip.classList.remove('visible');
        }

        // Switch tab if needed
        if (step.clickTab && step.tab) {
            const tabBtn = document.querySelector(`[data-tab="${step.tab}"]`);
            if (tabBtn) {
                tabBtn.click();
                // Wait longer for tab switch animation and content rendering
                setTimeout(() => {
                    // Wait for the element to be available
                    waitForElement(step.target, () => {
                        showStepContent(step);
                    });
                }, 500);
                return;
            }
        }

        // Wait for element to be available
        waitForElement(step.target, () => {
            showStepContent(step);
        });
    }

    // Wait for element to be available in DOM
    function waitForElement(selector, callback, timeout = 3000) {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                // Element exists and is visible
                clearInterval(checkInterval);
                callback();
            } else if (Date.now() - startTime > timeout) {
                // Timeout reached
                clearInterval(checkInterval);
                console.warn(`Tour element not found after ${timeout}ms: ${selector}`);
                // Skip to next step
                if (currentStep < tourSteps.length - 1) {
                    showStep(currentStep + 1);
                } else {
                    endTour();
                }
            }
        }, 100);
    }

    function showStepContent(step) {
        const targetEl = document.querySelector(step.target);

        if (!targetEl) {
            console.warn(`Tour target not found: ${step.target}`);
            // Skip to next step
            if (currentStep < tourSteps.length - 1) {
                showStep(currentStep + 1);
            } else {
                endTour();
            }
            return;
        }

        // Update tooltip content
        tooltip.querySelector('.tour-tooltip-title').textContent = step.title;
        tooltip.querySelector('.tour-tooltip-content').textContent = step.content;
        tooltip.querySelector('.tour-step-current').textContent = currentStep + 1;

        // Update buttons
        const prevBtn = tooltip.querySelector('.tour-btn-prev');
        const nextBtn = tooltip.querySelector('.tour-btn-next');

        prevBtn.disabled = currentStep === 0;

        if (currentStep === tourSteps.length - 1) {
            nextBtn.textContent = 'Terminer';
            nextBtn.classList.add('tour-btn-finish');
        } else {
            nextBtn.textContent = 'Suivant';
            nextBtn.classList.remove('tour-btn-finish');
        }

        // Clean up previous element styling
        document.querySelectorAll('[style*="z-index: 99992"]').forEach(el => {
            el.style.position = '';
            el.style.zIndex = '';
        });

        // Position elements
        highlightElement(targetEl);
        
        // Wait for scroll and spotlight positioning before showing tooltip
        setTimeout(() => {
            positionTooltip(targetEl, step.position);
            tooltip.classList.add('visible');
        }, 250);
    }

    // Navigation functions
    function nextStep() {
        if (currentStep < tourSteps.length - 1) {
            showStep(currentStep + 1);
        } else {
            completeTour();
        }
    }

    function prevStep() {
        if (currentStep > 0) {
            showStep(currentStep - 1);
        }
    }

    function skipTour() {
        const prefs = getPreferences();
        prefs.skipped = true;
        prefs.neverShowAgain = document.getElementById('tour-never-show')?.checked || false;
        prefs.version = TOUR_VERSION;
        prefs.lastShown = new Date().toISOString();
        savePreferences(prefs);
        endTour();
    }

    function completeTour() {
        const prefs = getPreferences();
        prefs.completed = true;
        prefs.neverShowAgain = document.getElementById('tour-never-show')?.checked || false;
        prefs.version = TOUR_VERSION;
        prefs.lastShown = new Date().toISOString();
        savePreferences(prefs);
        endTour();
        
        // Show completion message
        showCompletionMessage();
    }

    function showCompletionMessage() {
        const toast = document.createElement('div');
        toast.className = 'tour-toast';
        toast.innerHTML = `
            <div class="tour-toast-icon">✓</div>
            <div class="tour-toast-content">
                <strong>Visite terminée !</strong>
                <p>Vous pouvez relancer la visite à tout moment depuis le menu d'aide.</p>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('visible');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Start the tour
    function startTour() {
        if (isActive) return;
        isActive = true;
        currentStep = 0;

        createOverlay();
        createTooltip();

        overlay.classList.add('visible');

        // Make sure we're on the overview tab
        const overviewTab = document.querySelector('[data-tab="overview"]');
        if (overviewTab) {
            overviewTab.click();
        }

        setTimeout(() => {
            showStep(0);
        }, 500);

        // Handle resize
        window.addEventListener('resize', handleResize);
        
        // Handle escape key
        document.addEventListener('keydown', handleKeydown);
    }

    // End the tour
    function endTour() {
        isActive = false;

        // Clean up any element styling
        document.querySelectorAll('[style*="z-index: 99992"]').forEach(el => {
            el.style.position = '';
            el.style.zIndex = '';
        });

        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                overlay = null;
            }, 300);
        }

        if (tooltip) {
            tooltip.classList.remove('visible');
            setTimeout(() => {
                tooltip.remove();
                tooltip = null;
            }, 300);
        }

        window.removeEventListener('resize', handleResize);
        document.removeEventListener('keydown', handleKeydown);
    }

    function handleResize() {
        if (!isActive) return;
        const step = tourSteps[currentStep];
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
            highlightElement(targetEl);
            positionTooltip(targetEl, step.position);
        }
    }

    function handleKeydown(e) {
        if (!isActive) return;
        if (e.key === 'Escape') {
            skipTour();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            nextStep();
        } else if (e.key === 'ArrowLeft') {
            prevStep();
        }
    }

    // Show welcome modal for first-time users
    function showWelcomeModal() {
        const modal = document.createElement('div');
        modal.id = 'tour-welcome-modal';
        modal.className = 'tour-modal-overlay';
        modal.innerHTML = `
            <div class="tour-modal">
                <div class="tour-modal-icon">
                    <i class="fas fa-compass"></i>
                </div>
                <h2>Bienvenue sur PROCASSEF !</h2>
                <p>Souhaitez-vous faire une visite guidée du tableau de bord ?</p>
                <p class="tour-modal-subtitle">Cette visite vous présentera les principales fonctionnalités en quelques minutes.</p>
                <div class="tour-modal-buttons">
                    <button class="tour-modal-btn tour-modal-btn-secondary" id="tour-skip-btn">
                        Non merci
                    </button>
                    <button class="tour-modal-btn tour-modal-btn-primary" id="tour-start-btn">
                        <i class="fas fa-play"></i> Commencer la visite
                    </button>
                </div>
                <div class="tour-modal-checkbox">
                    <label>
                        <input type="checkbox" id="tour-modal-never-show"> Ne plus me demander
                    </label>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        setTimeout(() => modal.classList.add('visible'), 100);

        document.getElementById('tour-start-btn').addEventListener('click', () => {
            const neverShow = document.getElementById('tour-modal-never-show')?.checked;
            if (neverShow) {
                const prefs = getPreferences();
                prefs.neverShowAgain = true;
                prefs.version = TOUR_VERSION;
                savePreferences(prefs);
            }
            closeWelcomeModal();
            setTimeout(() => startTour(), 300);
        });

        document.getElementById('tour-skip-btn').addEventListener('click', () => {
            const neverShow = document.getElementById('tour-modal-never-show')?.checked;
            const prefs = getPreferences();
            prefs.skipped = true;
            prefs.neverShowAgain = neverShow;
            prefs.version = TOUR_VERSION;
            prefs.lastShown = new Date().toISOString();
            savePreferences(prefs);
            closeWelcomeModal();
        });
    }

    function closeWelcomeModal() {
        const modal = document.getElementById('tour-welcome-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 300);
        }
    }

    // Check if tour should be shown
    function shouldShowTour() {
        const prefs = getPreferences();

        // Never show if user opted out
        if (prefs.neverShowAgain) return false;

        // Show if new version
        if (prefs.version !== TOUR_VERSION) return true;

        // Show if never completed or skipped
        if (!prefs.completed && !prefs.skipped) return true;

        return false;
    }

    // Initialize
    function init() {
        // Wait for dashboard to be ready
        const checkReady = setInterval(() => {
            if (document.getElementById('forecastContent') && window.kpis) {
                clearInterval(checkReady);
                
                if (shouldShowTour()) {
                    // Small delay to let the dashboard fully render
                    setTimeout(() => {
                        showWelcomeModal();
                    }, 1500);
                }
            }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => clearInterval(checkReady), 10000);
    }

    // Expose public API
    window.guidedTour = {
        start: startTour,
        end: endTour,
        reset: function () {
            localStorage.removeItem(STORAGE_KEY);
            console.log('Tour preferences reset');
        },
        showWelcome: showWelcomeModal
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
