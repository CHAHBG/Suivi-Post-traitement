// Liquid Progress Service for animated progress indicators

class LiquidProgressService {
    constructor() {
        this.progressElements = new Map();
        this.animationFrameId = null;
    }

    // Initialize all liquid progress indicators
    initializeLiquidProgress(kpis) {
        // Ensure we have valid KPI data
        if (!kpis) {
            console.warn('No KPI data provided for liquid progress indicators');
            return;
        }
        
        // Update each progress indicator if the corresponding data exists
        if (kpis.daily) this.updateLiquidProgress('dailyProgress', kpis.daily);
        if (kpis.weekly) this.updateLiquidProgress('weeklyProgress', kpis.weekly);
        if (kpis.monthly) this.updateLiquidProgress('monthlyProgress', kpis.monthly);
        
        // Start animation loop
        this.startAnimationLoop();
    }

    // Update individual liquid progress indicator
    updateLiquidProgress(elementId, data) {
        const container = document.getElementById(elementId);
        if (!container) return;

        const liquidFill = container.querySelector('.liquid-fill');
        const liquidLabel = container.querySelector('.liquid-label');
        
        if (!liquidFill || !liquidLabel) return;
        
        // Calculate percentage with safeguards
        let percentage = 0;
        if (data && typeof data === 'object') {
            if (data.current !== undefined && data.target !== undefined && data.target !== 0) {
                percentage = Math.min(Math.max((data.current / data.target) * 100, 0), 100);
            } else if (data.percentage !== undefined) {
                percentage = Math.min(Math.max(data.percentage, 0), 100);
            }
        }

        // Store element data
        this.progressElements.set(elementId, {
            container,
            liquidFill,
            liquidLabel,
            data,
            currentPercentage: 0,
            targetPercentage: percentage,
            animationStart: Date.now()
        });

        // Update labels immediately
        this.updateLabels(elementId, data);
        
        // Animate liquid fill
        this.animateLiquidFill(elementId);
    }

    // Update labels with formatted values
    updateLabels(elementId, data) {
        const element = this.progressElements.get(elementId);
        if (!element) return;

        const titleElement = element.liquidLabel.querySelector('.liquid-title');
        const valueElement = element.liquidLabel.querySelector('.liquid-value');
        const percentageElement = element.liquidLabel.querySelector('.liquid-percentage');
        const gapElement = element.liquidLabel.querySelector('.liquid-gap');

        // Get the correct title based on element ID
        if (titleElement) {
            if (elementId === 'dailyProgress') {
                titleElement.textContent = 'Objectif Quotidien';
            } else if (elementId === 'weeklyProgress') {
                titleElement.textContent = 'Objectif Hebdomadaire';
            } else if (elementId === 'monthlyProgress') {
                titleElement.textContent = 'Objectif Septembre';
            }
        }

        if (valueElement && data) {
            const current = data.current !== undefined ? data.current : 0;
            const target = data.target !== undefined ? data.target : 0;
            
            // Format numbers with space as thousands separator (French format)
            const currentFormatted = new Intl.NumberFormat('fr-FR').format(current);
            const targetFormatted = new Intl.NumberFormat('fr-FR').format(target);
            
            valueElement.textContent = `${currentFormatted} / ${targetFormatted}`;
            
            // Calculate and display the gap
            if (gapElement) {
                // Calculate the gap between current and target (negative if below target)
                const gap = current - target;
                
                // Only show gap if it's negative
                if (gap < 0) {
                    // Format the gap with 6 decimal places
                    const gapFormatted = gap.toFixed(6);
                    gapElement.textContent = gapFormatted;
                    gapElement.style.display = 'block';
                } else {
                    gapElement.style.display = 'none';
                }
            }
        }

        if (percentageElement) {
            const percentage = data && data.percentage !== undefined ? 
                Math.round(data.percentage) : 
                element.targetPercentage !== undefined ? 
                    Math.round(element.targetPercentage) : 0;
                    
            percentageElement.textContent = `${percentage}%`;
        }

        // Update color based on performance
        this.updateProgressColor(elementId, element.targetPercentage || 0);
    }

    // Update progress color based on percentage
    updateProgressColor(elementId, percentage) {
        const element = this.progressElements.get(elementId);
        if (!element) return;

        let gradient;
        if (percentage >= 100) {
            gradient = 'linear-gradient(135deg, #22C55E, #16A34A)'; // Green
        } else if (percentage >= 80) {
            gradient = 'linear-gradient(135deg, #3B82F6, #06B6D4)'; // Blue
        } else if (percentage >= 50) {
            gradient = 'linear-gradient(135deg, #F59E0B, #F97316)'; // Orange
        } else {
            gradient = 'linear-gradient(135deg, #EF4444, #F87171)'; // Red
        }

        element.liquidFill.style.background = gradient;
    }

    // Animate liquid fill to target percentage
    animateLiquidFill(elementId) {
        const element = this.progressElements.get(elementId);
        if (!element) return;

        const duration = 2000; // 2 seconds
        const startTime = element.animationStart;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (easeOutCubic)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Calculate current percentage
            element.currentPercentage = element.targetPercentage * easeProgress;
            
            // Update visual height
            const height = (element.currentPercentage / 100) * 100;
            element.liquidFill.style.height = `${height}%`;
            
            // Update percentage display
            const percentageElement = element.liquidLabel.querySelector('.liquid-percentage');
            if (percentageElement) {
                percentageElement.textContent = `${Math.round(element.currentPercentage)}%`;
            }
            
            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    // Start continuous wave animation
    startAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        const animate = () => {
            this.updateWaveAnimations();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Update wave animations for all liquid progress indicators
    updateWaveAnimations() {
        const time = Date.now() * 0.001; // Convert to seconds

        this.progressElements.forEach((element, elementId) => {
            const liquidFill = element.liquidFill;
            if (!liquidFill) return;

            // Animate percentage
            const elapsedTime = Math.min((Date.now() - element.animationStart) / 2000, 1);
            const easedProgress = this.easeOutQuart(elapsedTime);
            element.currentPercentage = element.currentPercentage + 
                (element.targetPercentage - element.currentPercentage) * easedProgress;
            
            // Update fill height based on percentage
            const fillHeight = `${element.currentPercentage}%`;
            liquidFill.style.height = fillHeight;
            liquidFill.style.setProperty('--fill-height', fillHeight);
            
            // Add data attribute for CSS targeting
            liquidFill.setAttribute('data-percentage', Math.round(element.currentPercentage));
            
            // Add subtle opacity variation for more realistic effect
            const opacity = 0.9 + Math.sin(time * 0.8) * 0.1;
            liquidFill.style.opacity = opacity;
        });
    }

    // Stop all animations
    stopAnimations() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Create custom liquid progress indicator
    createCustomLiquidProgress(containerId, config) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const liquidProgressHTML = `
            <div class="liquid-progress" style="background: ${config.backgroundColor || '#f0f9ff'};">
                <div class="liquid-fill" style="background: ${config.fillColor || CONFIG.COLORS.primary};"></div>
            </div>
            <div class="liquid-label">
                <div class="liquid-title">${config.title || 'Progress'}</div>
                <div class="liquid-value">${config.value || '0 / 100'}</div>
                <div class="liquid-percentage">0%</div>
                <div class="liquid-gap" style="display: none;"></div>
            </div>
        `;

        container.innerHTML = liquidProgressHTML;
        
        // Initialize with provided data
        if (config.data) {
            this.updateLiquidProgress(containerId, config.data);
        }
    }

    // Add pulsing effect for critical states
    addPulseEffect(elementId, enable = true) {
        const element = this.progressElements.get(elementId);
        if (!element) return;

        if (enable) {
            element.container.classList.add('pulse-critical');
        } else {
            element.container.classList.remove('pulse-critical');
        }
    }

    // Add sparkle effect for achievements
    addSparkleEffect(elementId, duration = 3000) {
        const element = this.progressElements.get(elementId);
        if (!element) return;

        const sparkles = this.createSparkles(element.container);
        
        setTimeout(() => {
            sparkles.forEach(sparkle => {
                if (sparkle && sparkle.parentElement) {
                    sparkle.parentElement.removeChild(sparkle);
                }
            });
        }, duration);
    }

    // Create sparkle elements
    createSparkles(container) {
        const sparkles = [];
        const sparkleCount = 8;

        for (let i = 0; i < sparkleCount; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.cssText = `
                position: absolute;
                width: 10px;
                height: 10px;
                background: #fff;
                border-radius: 50%;
                top: ${Math.random() * 100}%;
                left: ${Math.random() * 100}%;
                opacity: 0;
                animation: sparkleAnimation 1s ease-in-out infinite;
                animation-delay: ${Math.random() * 0.5}s;
            `;
            container.appendChild(sparkle);
            sparkles.push(sparkle);
        }

        return sparkles;
    }

    // Update all liquid progress indicators
    updateAllProgress(kpis) {
        // Ensure we have valid KPI data
        if (!kpis) {
            console.warn('No KPI data provided for updating liquid progress indicators');
            return;
        }
        
        // Update each progress indicator if the corresponding data exists
        if (kpis.daily) this.updateLiquidProgress('dailyProgress', kpis.daily);
        if (kpis.weekly) this.updateLiquidProgress('weeklyProgress', kpis.weekly);
        if (kpis.monthly) this.updateLiquidProgress('monthlyProgress', kpis.monthly);

        // Add effects based on performance if data exists
        if (kpis.daily && typeof kpis.daily.percentage !== 'undefined') {
            if (kpis.daily.percentage >= 100) {
                this.addSparkleEffect('dailyProgress');
            }
            
            if (kpis.daily.percentage < 50) {
                this.addPulseEffect('dailyProgress', true);
            } else {
                this.addPulseEffect('dailyProgress', false);
            }
        }
    }

    // Get progress data for specific indicator
    getProgressData(elementId) {
        const element = this.progressElements.get(elementId);
        return element ? element.data : null;
    }

    // Reset all progress indicators
    resetAllProgress() {
        this.progressElements.forEach((element, elementId) => {
            element.targetPercentage = 0;
            element.animationStart = Date.now();
            this.animateLiquidFill(elementId);
        });
    }

    // Destroy all progress indicators
    destroy() {
        this.stopAnimations();
        this.progressElements.clear();
    }
}

// Add CSS animations for sparkles
const sparkleCSS = `
    @keyframes sparkleAnimation {
        0% {
            transform: scale(0) rotate(0deg);
            opacity: 1;
        }
        50% {
            transform: scale(1) rotate(180deg);
            opacity: 0.8;
        }
        100% {
            transform: scale(0) rotate(360deg);
            opacity: 0;
        }
    }
    
    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
        }
        50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
        }
    }
`;

// Add easing function for smoother animations
LiquidProgressService.prototype.easeOutQuart = function(x) {
    return 1 - Math.pow(1 - x, 4);
};

// Inject CSS if not already present
if (!document.getElementById('liquid-progress-styles')) {
    const style = document.createElement('style');
    style.id = 'liquid-progress-styles';
    style.textContent = sparkleCSS;
    document.head.appendChild(style);
}

// Create global instance
window.liquidProgressService = new LiquidProgressService();
