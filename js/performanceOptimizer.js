/**
 * Performance Optimizer for PROCASSEF Dashboard
 * Provides utilities for faster loading, rendering, and responsiveness
 * 
 * @class PerformanceOptimizer
 * @version 1.0.0
 */
class PerformanceOptimizer {
    constructor() {
        // Memoization cache for computed values
        this._memoCache = new Map();
        this._memoCacheMaxSize = 100;
        
        // Batch update queue
        this._updateQueue = [];
        this._updateScheduled = false;
        
        // Intersection observer for lazy loading
        this._lazyObserver = null;
        
        // Idle callback tracking
        this._idleCallbackId = null;
        
        // Performance marks for debugging
        this._marks = new Map();
        
        // Initialize
        this._initLazyLoading();
        this._initIdleScheduler();
    }

    // ==================== TIMING UTILITIES ====================

    /**
     * Mark a performance timestamp
     * @param {string} name - Mark name
     */
    mark(name) {
        this._marks.set(name, performance.now());
    }

    /**
     * Measure time between marks
     * @param {string} startMark - Start mark name
     * @param {string} endMark - End mark name (optional, uses now if omitted)
     * @returns {number} Duration in milliseconds
     */
    measure(startMark, endMark) {
        const start = this._marks.get(startMark) || 0;
        const end = endMark ? (this._marks.get(endMark) || performance.now()) : performance.now();
        return end - start;
    }

    // ==================== MEMOIZATION ====================

    /**
     * Memoize a function result based on arguments
     * @param {string} key - Unique cache key
     * @param {Function} fn - Function to memoize
     * @param {number} ttl - Time to live in ms (default 60s)
     * @returns {*} Cached or computed result
     */
    memoize(key, fn, ttl = 60000) {
        const cached = this._memoCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < ttl) {
            return cached.value;
        }
        
        const value = fn();
        
        // Enforce cache size limit
        if (this._memoCache.size >= this._memoCacheMaxSize) {
            // Remove oldest entry
            const oldestKey = this._memoCache.keys().next().value;
            this._memoCache.delete(oldestKey);
        }
        
        this._memoCache.set(key, { value, timestamp: now });
        return value;
    }

    /**
     * Clear memoization cache
     * @param {string} keyPattern - Optional pattern to match keys
     */
    clearMemoCache(keyPattern) {
        if (!keyPattern) {
            this._memoCache.clear();
            return;
        }
        
        const regex = new RegExp(keyPattern);
        for (const key of this._memoCache.keys()) {
            if (regex.test(key)) {
                this._memoCache.delete(key);
            }
        }
    }

    // ==================== DEBOUNCE & THROTTLE ====================

    /**
     * Debounce with leading edge option
     * @param {Function} fn - Function to debounce
     * @param {number} wait - Wait time in ms
     * @param {boolean} immediate - Execute on leading edge
     * @returns {Function} Debounced function
     */
    debounce(fn, wait = 150, immediate = false) {
        let timeout;
        return function(...args) {
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = null;
                if (!immediate) fn.apply(this, args);
            }, wait);
            if (callNow) fn.apply(this, args);
        };
    }

    /**
     * Throttle function execution
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Minimum time between calls in ms
     * @returns {Function} Throttled function
     */
    throttle(fn, limit = 100) {
        let inThrottle = false;
        let lastArgs = null;
        
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                    if (lastArgs) {
                        fn.apply(this, lastArgs);
                        lastArgs = null;
                    }
                }, limit);
            } else {
                lastArgs = args;
            }
        };
    }

    // ==================== BATCH DOM UPDATES ====================

    /**
     * Queue a DOM update to be batched with requestAnimationFrame
     * @param {Function} updateFn - Update function to queue
     */
    queueUpdate(updateFn) {
        this._updateQueue.push(updateFn);
        
        if (!this._updateScheduled) {
            this._updateScheduled = true;
            requestAnimationFrame(() => this._flushUpdates());
        }
    }

    /**
     * Flush all queued updates
     * @private
     */
    _flushUpdates() {
        const updates = this._updateQueue.slice();
        this._updateQueue.length = 0;
        this._updateScheduled = false;
        
        // Execute all updates in a single frame
        updates.forEach(fn => {
            try {
                fn();
            } catch (e) {
                console.error('Error in batched update:', e);
            }
        });
    }

    /**
     * Batch multiple DOM reads then writes to avoid layout thrashing
     * @param {Function[]} reads - Array of read functions
     * @param {Function} write - Write function receiving read results
     */
    batchReadWrite(reads, write) {
        requestAnimationFrame(() => {
            // Batch all reads first
            const results = reads.map(fn => fn());
            // Then batch all writes
            requestAnimationFrame(() => {
                write(results);
            });
        });
    }

    // ==================== LAZY LOADING ====================

    /**
     * Initialize intersection observer for lazy loading
     * @private
     */
    _initLazyLoading() {
        if (typeof IntersectionObserver === 'undefined') return;
        
        this._lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const callback = el._lazyCallback;
                    
                    if (callback) {
                        callback(el);
                        delete el._lazyCallback;
                    }
                    
                    this._lazyObserver.unobserve(el);
                }
            });
        }, {
            rootMargin: '100px', // Start loading 100px before visible
            threshold: 0.01
        });
    }

    /**
     * Register element for lazy initialization
     * @param {HTMLElement} element - Element to observe
     * @param {Function} callback - Callback when element is visible
     */
    lazyLoad(element, callback) {
        if (!this._lazyObserver || !element) return;
        
        element._lazyCallback = callback;
        this._lazyObserver.observe(element);
    }

    // ==================== IDLE SCHEDULING ====================

    /**
     * Initialize idle callback scheduler
     * @private
     */
    _initIdleScheduler() {
        this._idleQueue = [];
        this._idleRunning = false;
    }

    /**
     * Schedule work during idle time
     * @param {Function} task - Task to execute during idle
     * @param {number} timeout - Maximum wait time before forced execution
     */
    scheduleIdle(task, timeout = 2000) {
        this._idleQueue.push({ task, timeout });
        
        if (!this._idleRunning) {
            this._runIdleQueue();
        }
    }

    /**
     * Process idle queue
     * @private
     */
    _runIdleQueue() {
        if (this._idleQueue.length === 0) {
            this._idleRunning = false;
            return;
        }
        
        this._idleRunning = true;
        const { task, timeout } = this._idleQueue.shift();
        
        const callback = (deadline) => {
            try {
                task(deadline);
            } catch (e) {
                console.error('Error in idle task:', e);
            }
            this._runIdleQueue();
        };
        
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(callback, { timeout });
        } else {
            // Fallback for Safari
            setTimeout(() => callback({ timeRemaining: () => 50 }), 1);
        }
    }

    // ==================== VIRTUAL SCROLLING HELPERS ====================

    /**
     * Calculate visible items for virtual scrolling
     * @param {number} scrollTop - Current scroll position
     * @param {number} containerHeight - Visible container height
     * @param {number} itemHeight - Height of each item
     * @param {number} totalItems - Total number of items
     * @param {number} overscan - Number of extra items to render
     * @returns {Object} Start index, end index, and offset
     */
    getVisibleRange(scrollTop, containerHeight, itemHeight, totalItems, overscan = 3) {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);
        const offsetY = startIndex * itemHeight;
        
        return { startIndex, endIndex, offsetY };
    }

    // ==================== DOCUMENT FRAGMENTS ====================

    /**
     * Create elements efficiently using document fragment
     * @param {Array} items - Array of items to render
     * @param {Function} renderFn - Function that returns HTML element for each item
     * @returns {DocumentFragment} Fragment containing all elements
     */
    createFragment(items, renderFn) {
        const fragment = document.createDocumentFragment();
        
        items.forEach((item, index) => {
            const el = renderFn(item, index);
            if (el) fragment.appendChild(el);
        });
        
        return fragment;
    }

    // ==================== PROGRESSIVE RENDERING ====================

    /**
     * Render items progressively in chunks
     * @param {Array} items - Items to render
     * @param {Function} renderFn - Render function for each item
     * @param {HTMLElement} container - Container element
     * @param {number} chunkSize - Items per chunk (default 20)
     * @returns {Promise} Resolves when all items rendered
     */
    async progressiveRender(items, renderFn, container, chunkSize = 20) {
        const chunks = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            chunks.push(items.slice(i, i + chunkSize));
        }
        
        for (const chunk of chunks) {
            const fragment = this.createFragment(chunk, renderFn);
            container.appendChild(fragment);
            
            // Yield to browser between chunks
            await new Promise(resolve => {
                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(resolve, { timeout: 100 });
                } else {
                    setTimeout(resolve, 0);
                }
            });
        }
    }

    // ==================== SKELETON SCREENS ====================

    /**
     * Show skeleton loading state for an element
     * @param {HTMLElement} element - Element to show skeleton for
     * @param {string} type - Skeleton type: 'card', 'table', 'chart', 'text'
     */
    showSkeleton(element, type = 'card') {
        if (!element) return;
        
        // Store original content
        element._originalContent = element.innerHTML;
        element._originalClasses = element.className;
        
        const skeletonHTML = this._getSkeletonHTML(type);
        element.innerHTML = skeletonHTML;
        element.classList.add('skeleton-loading');
    }

    /**
     * Hide skeleton and restore content
     * @param {HTMLElement} element - Element to restore
     * @param {string} newContent - Optional new content to set
     */
    hideSkeleton(element, newContent) {
        if (!element) return;
        
        element.classList.remove('skeleton-loading');
        
        if (newContent !== undefined) {
            element.innerHTML = newContent;
        } else if (element._originalContent !== undefined) {
            element.innerHTML = element._originalContent;
            delete element._originalContent;
        }
    }

    /**
     * Get skeleton HTML for different types
     * @private
     */
    _getSkeletonHTML(type) {
        const templates = {
            card: `
                <div class="skeleton-card animate-pulse">
                    <div class="skeleton-line w-1/3 h-4 mb-2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div class="skeleton-line w-full h-8 mb-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div class="skeleton-line w-2/3 h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
            `,
            table: `
                <div class="skeleton-table animate-pulse space-y-2">
                    <div class="skeleton-row flex gap-4">
                        <div class="skeleton-cell flex-1 h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        <div class="skeleton-cell flex-1 h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        <div class="skeleton-cell flex-1 h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                    <div class="skeleton-row flex gap-4">
                        <div class="skeleton-cell flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        <div class="skeleton-cell flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        <div class="skeleton-cell flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    </div>
                    <div class="skeleton-row flex gap-4">
                        <div class="skeleton-cell flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        <div class="skeleton-cell flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        <div class="skeleton-cell flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    </div>
                </div>
            `,
            chart: `
                <div class="skeleton-chart animate-pulse flex items-end justify-around h-48 px-4">
                    <div class="skeleton-bar w-8 h-1/3 bg-slate-200 dark:bg-slate-700 rounded-t"></div>
                    <div class="skeleton-bar w-8 h-2/3 bg-slate-200 dark:bg-slate-700 rounded-t"></div>
                    <div class="skeleton-bar w-8 h-1/2 bg-slate-200 dark:bg-slate-700 rounded-t"></div>
                    <div class="skeleton-bar w-8 h-3/4 bg-slate-200 dark:bg-slate-700 rounded-t"></div>
                    <div class="skeleton-bar w-8 h-1/4 bg-slate-200 dark:bg-slate-700 rounded-t"></div>
                    <div class="skeleton-bar w-8 h-1/2 bg-slate-200 dark:bg-slate-700 rounded-t"></div>
                </div>
            `,
            text: `
                <div class="skeleton-text animate-pulse space-y-2">
                    <div class="skeleton-line w-full h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div class="skeleton-line w-4/5 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div class="skeleton-line w-3/5 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
            `
        };
        
        return templates[type] || templates.card;
    }

    // ==================== DATA PREFETCHING ====================

    /**
     * Prefetch data for likely next user actions
     * @param {string[]} urls - URLs to prefetch
     */
    prefetch(urls) {
        if (!Array.isArray(urls)) return;
        
        urls.forEach(url => {
            // Use link prefetch for supported browsers
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            link.as = 'fetch';
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Check if element is in viewport
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if in viewport
     */
    isInViewport(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Get optimized scroll handler
     * @param {Function} callback - Callback for scroll events
     * @returns {Function} Optimized scroll handler
     */
    getScrollHandler(callback) {
        let ticking = false;
        
        return function(e) {
            if (!ticking) {
                requestAnimationFrame(() => {
                    callback(e);
                    ticking = false;
                });
                ticking = true;
            }
        };
    }
}

// Create global instance
window.performanceOptimizer = new PerformanceOptimizer();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
