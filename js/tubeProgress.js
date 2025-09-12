/**
 * Enhanced Tube Progress Indicator Component
 * This service creates and manages interactive tube-style progress indicators
 * that show progress towards goals with animated liquid filling effects.
 */
class TubeProgressService {
    constructor() {
        this.tubes = new Map();
        this.animationFrameId = null;
    this.io = null; // IntersectionObserver (pause when offscreen)
        this.config = {
            animationDuration: 2000,
            waveFrequency: 3,
            colors: {
                primary: '#4B83F6',    // Blue
                success: '#22C55E',    // Green
                warning: '#F97316',    // Orange
                danger: '#EF4444',     // Red
                neutral: '#94A3B8'     // Slate
            },
            thresholds: {
                danger: 30,
                warning: 60,
                success: 90
            }
        };
    }
    
    /**
     * Initialize a tube progress indicator
     * @param {string} elementId - ID of the container element
     * @param {Object} options - Configuration options
     */
    initTube(elementId, options = {}) {
        const container = document.getElementById(elementId);
        if (!container) {
            console.error(`Tube container with ID ${elementId} not found`);
            return false;
        }
        
        // Merge options with defaults
        const config = {
            title: options.title || 'Progress',
            currentValue: options.currentValue || 0,
            targetValue: options.targetValue || 100,
            percentage: options.percentage || 0,
            gap: options.gap || 0,
            status: options.status || this.getStatusFromPercentage(options.percentage || 0),
            showGap: options.showGap !== undefined ? options.showGap : true,
            animated: options.animated !== undefined ? options.animated : true,
            color: options.color || null,
            formatter: options.formatter || this.defaultFormatter
        };
        
        // Create tube structure if it doesn't exist
        if (!container.querySelector('.tube-progress')) {
            this.createTubeStructure(container, config);
        }
        
        // Get tube elements
        const tubeElements = {
            tube: container.querySelector('.tube-progress'),
            liquid: container.querySelector('.tube-liquid'),
            title: container.querySelector('.tube-title'),
            value: container.querySelector('.tube-value'),
            percentage: container.querySelector('.tube-percentage'),
            gap: container.querySelector('.tube-gap')
        };
        
        // Store tube data
        this.tubes.set(elementId, {
            config,
            elements: tubeElements,
            currentPercentage: 0,
            targetPercentage: config.percentage,
            animationStart: Date.now(),
            isVisible: true
        });
        
        // Update tube display
        this.updateTubeDisplay(elementId);
        
        // Start animation if needed
    if (this.shouldAnimate(config) && !this.animationFrameId) {
            this.startAnimationLoop();
        }
    // Observe visibility to pause animations when offscreen
    this.ensureObserver();
    if (this.io && tubeElements.tube) this.io.observe(tubeElements.tube);
        
        return true;
    }
    
    /**
     * Create the HTML structure for a tube progress indicator
     * @param {HTMLElement} container - Container element
     * @param {Object} config - Tube configuration
     */
    createTubeStructure(container, config) {
        // Clear existing content
        container.innerHTML = '';
        
        // Add tube structure
        const shortFmt = (v) => {
            // Round to whole numbers for cleaner display
            const roundedVal = Math.round(v);
            if (Math.abs(roundedVal) >= 1000000) return (roundedVal/1000000).toFixed(1)+'M';
            if (Math.abs(roundedVal) >= 1000) return (roundedVal/1000).toFixed(1)+'K';
            return config.formatter(roundedVal);
        };
        const gapVal = config.gap;
        const gapDisplay = gapVal < 0 ? shortFmt(gapVal) : (gapVal>0? '+'+shortFmt(gapVal): '0');
        container.innerHTML = `
            <div class="tube-progress" role="meter" aria-label="${config.title}" aria-valuemin="0" aria-valuemax="${config.targetValue}" aria-valuenow="${config.currentValue}" tabindex="0" title="${config.formatter(config.currentValue)} / ${config.formatter(config.targetValue)} (écart ${gapDisplay})">
                <div class="tube-liquid" data-percentage="0">
                    <div class="tube-wave"></div>
                </div>
                <div class="tube-label">
                    <div class="tube-title text-sm" title="${config.title}">${config.title}</div>
                    <div class="tube-percentage text-lg font-semibold">0%</div>
                    <div class="tube-value text-[11px] text-contrast font-medium" title="${config.formatter(config.currentValue)} / ${config.formatter(config.targetValue)}">${shortFmt(config.currentValue)} / ${shortFmt(config.targetValue)}</div>
                    ${config.showGap ? `<div class="tube-gap text-[11px] mt-0.5 ${gapVal<0?'text-contrast-red':gapVal>0?'text-contrast-green':'text-contrast-gray'}">${gapDisplay}</div>` : ''}
                </div>
            </div>`;
        
        // Add color class if specified
        if (config.color) {
            container.querySelector('.tube-progress').classList.add(`tube-${config.color}`);
        }
    }
    
    /**
     * Update a tube's display with new data
     * @param {string} elementId - ID of the tube container
     * @param {Object} [data] - New data to update (optional)
     */
    updateTube(elementId, data = {}) {
        const tube = this.tubes.get(elementId);
        if (!tube) {
            console.warn(`Tube with ID ${elementId} not found`);
            return;
        }
        
        // Update config with new data
        if (data.currentValue !== undefined) tube.config.currentValue = data.currentValue;
        if (data.targetValue !== undefined) tube.config.targetValue = data.targetValue;
        
        // Calculate percentage if not provided
        if (data.percentage !== undefined) {
            tube.config.percentage = data.percentage;
        } else if (data.currentValue !== undefined && tube.config.targetValue) {
            tube.config.percentage = Math.min(Math.max((tube.config.currentValue / tube.config.targetValue) * 100, 0), 100);
        }
        
        // Calculate gap if not provided
        if (data.gap !== undefined) {
            tube.config.gap = data.gap;
        } else if (data.currentValue !== undefined && tube.config.targetValue) {
            tube.config.gap = tube.config.currentValue - tube.config.targetValue;
        }
        
        // Update status if not provided
        if (data.status !== undefined) {
            tube.config.status = data.status;
        } else {
            tube.config.status = this.getStatusFromPercentage(tube.config.percentage);
        }
        
        // Reset animation
        tube.animationStart = Date.now();
        tube.targetPercentage = tube.config.percentage;
        
        // Update display
        this.updateTubeDisplay(elementId);
        
        return this;
    }
    
    /**
     * Update the visual display of a tube
     * @param {string} elementId - ID of the tube container
     */
    updateTubeDisplay(elementId) {
        const tube = this.tubes.get(elementId);
        if (!tube) return;
        
        const { elements, config } = tube;
        
        // Update text content
        if (elements.title) elements.title.textContent = config.title;
        if (elements.tube) {
            const gapVal = config.gap;
            const gapDisplay = gapVal < 0 ? config.formatter(gapVal) : (gapVal>0? '+'+config.formatter(gapVal): '0');
            elements.tube.parentElement.setAttribute('title', `${config.formatter(config.currentValue)} / ${config.formatter(config.targetValue)} (écart ${gapDisplay})`);
        }
        if (elements.percentage) elements.percentage.textContent = `${Math.round(config.percentage)}%`;
        if (elements.value) elements.value.textContent = `${config.formatter(config.currentValue)} / ${config.formatter(config.targetValue)}`;
        
        // Update gap display
        if (elements.gap) {
            const gapVal = config.gap;
            if (config.showGap) {
                elements.gap.textContent = gapVal < 0 ? config.formatter(gapVal) : (gapVal>0? '+'+config.formatter(gapVal): '0');
                elements.gap.style.display = 'block';
            } else elements.gap.style.display = 'none';
        }

        // forecast rendering moved to a dedicated forecast card component
        
        // Update color based on status
        this.updateTubeColor(elementId, config.status);

    // Ensure initial text contrast is appropriate even before animations
    this.updateTubeTextContrast(tube);

        // If animations are disabled, set the fill and contrast immediately
        if (!this.shouldAnimate(config) && elements.liquid) {
            tube.currentPercentage = config.percentage || 0;
            const height = `${tube.currentPercentage}%`;
            elements.liquid.style.height = height;
            elements.liquid.style.setProperty('--fill-height', height);
            elements.liquid.setAttribute('data-percentage', Math.round(tube.currentPercentage));
            this.updateTubeTextContrast(tube);
        }
    }
    
    /**
     * Update the color of a tube based on status
     * @param {string} elementId - ID of the tube container
     * @param {string} status - Status: 'danger', 'warning', 'success', or custom
     */
    updateTubeColor(elementId, status) {
        const tube = this.tubes.get(elementId);
        if (!tube) return;
        
    const { elements } = tube;
        
        // Get color based on status
        let color;
        switch (status) {
            case 'danger': color = this.config.colors.danger; break;
            case 'warning': color = this.config.colors.warning; break;
            case 'success': color = this.config.colors.success; break;
            case 'primary': color = this.config.colors.primary; break;
            default: color = status.startsWith('#') ? status : this.config.colors.primary; // Custom color
        }
        
    // Apply color to elements
    if (elements.liquid) elements.liquid.style.background = color;

    // Remember liquid color for dynamic contrast decisions
    tube.liquidColor = color;
    tube.textColorOnLiquid = this.getContrastingTextColor(color);

    // Set a reasonable initial text color; will be refined during animation
    const root = elements.tube; // .tube-progress root
    if (root) root.style.setProperty('--tube-text-color', tube.textColorOnLiquid);
    // Keep explicit fallback colors minimal; CSS now uses --tube-text-color
    }

    /**
     * Compute contrasting text color (black/white) for a given background color
     * @param {string} hexColor - e.g., '#22C55E'
     * @returns {string} '#FFFFFF' or '#111827'
     */
    getContrastingTextColor(hexColor) {
        try {
            const hex = hexColor.replace('#','');
            const bigint = parseInt(hex.length === 3 ? hex.split('').map(c=>c+c).join('') : hex, 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            // Relative luminance (sRGB)
            const [R, G, B] = [r, g, b].map(v => {
                v /= 255;
                return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
            });
            const L = 0.2126*R + 0.7152*G + 0.0722*B;
            // Threshold ~0.5: choose dark text for light backgrounds, white for dark
            return L > 0.5 ? '#111827' : '#FFFFFF';
        } catch(_) {
            return '#111827';
        }
    }

    /**
     * Update the tube text contrast based on whether the label area is over liquid or background
     * @param {Object} tube - Tube state object
     */
    updateTubeTextContrast(tube) {
        if (!tube || !tube.elements || !tube.elements.tube) return;
        const root = tube.elements.tube;
        // Heuristic: label is centered at ~50% height; ensure it's well covered before switching
        const threshold = 55; // percent
        const covered = (tube.currentPercentage || 0) >= threshold;

        // Determine text colors for each background
        const liquidColor = tube.liquidColor || this.config.colors.primary;
        const textOnLiquid = tube.textColorOnLiquid || this.getContrastingTextColor(liquidColor);
        // Tube background is light (#f8fafc); prefer dark text on it
        const textOnBg = '#111827';

        const textColor = covered ? textOnLiquid : textOnBg;
        root.style.setProperty('--tube-text-color', textColor);
    }
    
    /**
     * Start the animation loop for all tubes
     */
    startAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        const animate = () => {
            this.updateAllTubeAnimations();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    /**
     * Update animations for all tubes
     */
    updateAllTubeAnimations() {
        const now = Date.now();
        
        this.tubes.forEach((tube, elementId) => {
            const { elements, config, animationStart, targetPercentage } = tube;
            if (!elements.liquid) return;
            if (!tube.isVisible || !this.shouldAnimate(config)) return; // respect reduced motion & visibility
            
            // Calculate progress based on elapsed time
            const elapsed = now - animationStart;
            const progress = Math.min(elapsed / this.config.animationDuration, 1);
            
            // Apply easing
            const eased = this.easeOutCubic(progress);
            
            // Update current percentage
            tube.currentPercentage = targetPercentage * eased;
            
            // Apply height to liquid
            const height = `${tube.currentPercentage}%`;
            elements.liquid.style.height = height;
            elements.liquid.style.setProperty('--fill-height', height);
            elements.liquid.setAttribute('data-percentage', Math.round(tube.currentPercentage));
            
            // Update wave animation
            this.updateWaveAnimation(elements.liquid, now);
            
            // Update text contrast based on coverage
            this.updateTubeTextContrast(tube);

            // Update percentage text if animated
            if (config.animated && elements.percentage) {
                elements.percentage.textContent = `${Math.round(tube.currentPercentage)}%`;
            }
        });
    }
    
    /**
     * Update wave animation for a tube
     * @param {HTMLElement} liquidElement - Liquid element
     * @param {number} time - Current timestamp
     */
    updateWaveAnimation(liquidElement, time) {
        const wave = liquidElement.querySelector('.tube-wave');
        if (!wave) return;
        
        // Create subtle wave movement
    const timeSeconds = time * 0.001; // Convert to seconds
    const f = this.config.waveFrequency;
    const offsetX = Math.sin(timeSeconds * f) * 12;
    const offsetY = Math.cos(timeSeconds * (f * 0.6)) * 6;
        
        wave.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
    
    /**
     * Get status based on percentage
     * @param {number} percentage - Percentage value
     * @returns {string} - Status: 'danger', 'warning', or 'success'
     */
    getStatusFromPercentage(percentage) {
        if (percentage < this.config.thresholds.danger) return 'danger';
        if (percentage < this.config.thresholds.warning) return 'warning';
        if (percentage < this.config.thresholds.success) return 'success';
        return 'success';
    }
    
    /**
     * Default formatter for values
     * @param {number} value - Value to format
     * @returns {string} - Formatted value
     */
    defaultFormatter(value) {
        return new Intl.NumberFormat('fr-FR').format(value);
    }
    
    /**
     * Cubic ease out function for smooth animations
     * @param {number} x - Input value between 0 and 1
     * @returns {number} - Eased value between 0 and 1
     */
    easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }
    
    /**
     * Initialize multiple tubes with different data
     * @param {Object} tubesConfig - Map of tube IDs to configurations
     */
    initializeTubes(tubesConfig) {
        Object.entries(tubesConfig).forEach(([id, config]) => {
            this.initTube(id, config);
        });
        return this;
    }
    
    /**
     * Update multiple tubes with new data
     * @param {Object} tubesData - Map of tube IDs to data
     */
    updateTubes(tubesData) {
        Object.entries(tubesData).forEach(([id, data]) => {
            this.updateTube(id, data);
        });
        return this;
    }
    
    /**
     * Stop all animations
     */
    stopAnimations() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * Destroy tube (remove from tracking)
     * @param {string} elementId - ID of tube to destroy
     */
    destroyTube(elementId) {
        this.tubes.delete(elementId);
        
        // Stop animation loop if no tubes left
        if (this.tubes.size === 0) {
            this.stopAnimations();
        }
    }
    
    /**
     * Clean up all tubes
     */
    destroy() {
        this.stopAnimations();
        this.tubes.clear();
        if (this.io) { this.io.disconnect(); this.io = null; }
    }

    // Respect user motion preferences
    shouldAnimate(cfg) {
        try {
            const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
            if (mq && mq.matches) return false;
        } catch(_) {}
        return cfg.animated !== false;
    }

    // Setup IntersectionObserver to pause animation when offscreen
    ensureObserver() {
        if (this.io || typeof IntersectionObserver === 'undefined') return;
        this.io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                this.tubes.forEach((t) => {
                    if (t.elements && t.elements.tube === entry.target) {
                        t.isVisible = entry.isIntersecting;
                    }
                });
            });
        }, { threshold: 0.1 });
    }
}

// Create global instance
window.tubeProgressService = new TubeProgressService();
