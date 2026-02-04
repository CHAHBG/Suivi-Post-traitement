/**
 * Security Utilities Module
 * Provides centralized security functions for input sanitization, 
 * XSS prevention, and safe DOM manipulation.
 * 
 * @module securityUtils
 * @version 1.0.0
 */
(function() {
    'use strict';

    /**
     * HTML entity encoding map for XSS prevention
     * @private
     */
    const HTML_ENTITIES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    /**
     * Escape HTML entities to prevent XSS attacks
     * Use this when inserting user-provided or external data into the DOM
     * 
     * @param {string} str - The string to escape
     * @returns {string} - The escaped string safe for HTML insertion
     * @example
     * securityUtils.escapeHtml('<script>alert("xss")</script>')
     * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);
        return str.replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char]);
    }

    /**
     * Sanitize a string for use in HTML attributes
     * More aggressive escaping for attribute contexts
     * 
     * @param {string} str - The string to sanitize
     * @returns {string} - The sanitized string safe for HTML attributes
     */
    function sanitizeAttribute(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);
        // Remove any characters that could break out of attribute context
        return str
            .replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char])
            .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    }

    /**
     * Sanitize URL to prevent javascript: and data: URI attacks
     * Only allows http, https, mailto, and tel protocols
     * 
     * @param {string} url - The URL to sanitize
     * @returns {string} - The sanitized URL or empty string if invalid
     */
    function sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        
        const trimmed = url.trim().toLowerCase();
        
        // Block dangerous protocols
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
        for (const protocol of dangerousProtocols) {
            if (trimmed.startsWith(protocol)) {
                console.warn('Security: Blocked dangerous URL protocol:', protocol);
                return '';
            }
        }
        
        // Allow safe protocols
        const safeProtocols = ['http://', 'https://', 'mailto:', 'tel:', '//', '/'];
        const hasValidProtocol = safeProtocols.some(p => trimmed.startsWith(p));
        
        // Allow relative URLs (starting with /, ./, or alphanumeric)
        const isRelative = /^[a-zA-Z0-9]|^\.\/|^\.\.\//.test(trimmed) && !trimmed.includes(':');
        
        if (!hasValidProtocol && !isRelative) {
            console.warn('Security: URL with unknown protocol blocked:', url);
            return '';
        }
        
        return url;
    }

    /**
     * Safely set text content of an element (automatically escapes HTML)
     * Preferred method over innerHTML when displaying user data
     * 
     * @param {HTMLElement|string} elementOrId - Element or element ID
     * @param {string} text - Text to set
     * @returns {boolean} - True if successful
     */
    function setTextContent(elementOrId, text) {
        const element = typeof elementOrId === 'string' 
            ? document.getElementById(elementOrId) 
            : elementOrId;
        
        if (!element) return false;
        
        element.textContent = text ?? '';
        return true;
    }

    /**
     * Create a text node safely
     * 
     * @param {string} text - Text content
     * @returns {Text} - Text node
     */
    function createTextNode(text) {
        return document.createTextNode(text ?? '');
    }

    /**
     * Safely create an element with sanitized attributes and text content
     * 
     * @param {string} tagName - HTML tag name
     * @param {Object} attributes - Object with attribute key-value pairs
     * @param {string} textContent - Text content for the element
     * @returns {HTMLElement} - The created element
     */
    function createElement(tagName, attributes = {}, textContent = null) {
        // Validate tag name (alphanumeric and hyphens only)
        if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tagName)) {
            console.error('Security: Invalid tag name:', tagName);
            return document.createElement('span');
        }
        
        const element = document.createElement(tagName);
        
        // Set attributes safely
        for (const [key, value] of Object.entries(attributes)) {
            // Block dangerous attributes
            const lowerKey = key.toLowerCase();
            if (lowerKey.startsWith('on') || lowerKey === 'srcdoc') {
                console.warn('Security: Blocked potentially dangerous attribute:', key);
                continue;
            }
            
            // Sanitize href/src URLs
            if (lowerKey === 'href' || lowerKey === 'src') {
                const sanitized = sanitizeUrl(String(value));
                if (sanitized) {
                    element.setAttribute(key, sanitized);
                }
            } else {
                element.setAttribute(key, sanitizeAttribute(value));
            }
        }
        
        // Set text content (not innerHTML) if provided
        if (textContent !== null) {
            element.textContent = textContent;
        }
        
        return element;
    }

    /**
     * Validate and sanitize numeric input
     * 
     * @param {*} value - Value to validate
     * @param {Object} options - Validation options
     * @param {number} options.min - Minimum allowed value
     * @param {number} options.max - Maximum allowed value
     * @param {number} options.default - Default value if invalid
     * @returns {number} - Validated number
     */
    function sanitizeNumber(value, options = {}) {
        const { min = -Infinity, max = Infinity, default: defaultVal = 0 } = options;
        
        let num = parseFloat(value);
        
        if (isNaN(num) || !isFinite(num)) {
            return defaultVal;
        }
        
        return Math.max(min, Math.min(max, num));
    }

    /**
     * Validate and sanitize string input with length limits
     * 
     * @param {*} value - Value to sanitize
     * @param {Object} options - Options
     * @param {number} options.maxLength - Maximum string length (default 10000)
     * @param {string} options.default - Default value if invalid
     * @param {boolean} options.trim - Whether to trim whitespace (default true)
     * @returns {string} - Sanitized string
     */
    function sanitizeString(value, options = {}) {
        const { maxLength = 10000, default: defaultVal = '', trim: shouldTrim = true } = options;
        
        if (value === null || value === undefined) {
            return defaultVal;
        }
        
        let str = String(value);
        
        if (shouldTrim) {
            str = str.trim();
        }
        
        // Limit length to prevent DoS
        if (str.length > maxLength) {
            str = str.substring(0, maxLength);
        }
        
        return str;
    }

    /**
     * Deep freeze an object to prevent modification
     * Useful for configuration objects
     * 
     * @param {Object} obj - Object to freeze
     * @returns {Object} - Frozen object
     */
    function deepFreeze(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (value && typeof value === 'object') {
                deepFreeze(value);
            }
        });
        
        return Object.freeze(obj);
    }

    /**
     * Safely parse JSON with error handling
     * 
     * @param {string} jsonString - JSON string to parse
     * @param {*} defaultValue - Default value if parsing fails
     * @returns {*} - Parsed value or default
     */
    function safeJsonParse(jsonString, defaultValue = null) {
        if (!jsonString || typeof jsonString !== 'string') {
            return defaultValue;
        }
        
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn('Security: Failed to parse JSON:', e.message);
            return defaultValue;
        }
    }

    /**
     * Validate that a value is a safe integer within bounds
     * 
     * @param {*} value - Value to check
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean} - True if valid
     */
    function isValidInteger(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
        return Number.isInteger(value) && value >= min && value <= max;
    }

    /**
     * Rate limiting helper for preventing abuse
     * Returns a function that limits how often another function can be called
     * 
     * @param {number} limit - Maximum calls allowed
     * @param {number} interval - Time interval in ms
     * @returns {Function} - Rate limiter function
     */
    function createRateLimiter(limit, interval) {
        const calls = [];
        
        return function checkLimit() {
            const now = Date.now();
            // Remove old entries
            while (calls.length > 0 && calls[0] < now - interval) {
                calls.shift();
            }
            
            if (calls.length >= limit) {
                return false; // Rate limited
            }
            
            calls.push(now);
            return true; // Allowed
        };
    }

    // Export security utilities
    window.securityUtils = Object.freeze({
        escapeHtml,
        sanitizeAttribute,
        sanitizeUrl,
        setTextContent,
        createTextNode,
        createElement,
        sanitizeNumber,
        sanitizeString,
        deepFreeze,
        safeJsonParse,
        isValidInteger,
        createRateLimiter
    });

})();
