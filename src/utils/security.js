// ============================================================
//  БЕЗОПАСНОСТЬ
// ============================================================

// ============================================================
//  ESCAPE HTML (ЗАЩИТА ОТ XSS)
// ============================================================
export function escapeHTML(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    return String(str).replace(/[&<>"'`=/]/g, s => map[s]);
}

// ============================================================
//  SANITIZE (ОЧИСТКА ДАННЫХ)
// ============================================================
export function sanitizeString(str) {
    if (!str) return '';
    return str
        .trim()
        .replace(/[^\w\s\-@.]/g, '')
        .slice(0, 100);
}

export function sanitizeObject(obj, schema) {
    const result = {};
    for (const [key, sanitizer] of Object.entries(schema)) {
        if (obj[key] !== undefined) {
            result[key] = sanitizer(obj[key]);
        }
    }
    return result;
}

// ============================================================
//  CSRF ЗАЩИТА
// ============================================================
class CSRFProtector {
    constructor() {
        this._token = null;
        this._regenerateInterval = 3600000; // 1 час
        this._lastRegenerate = 0;
    }

    getToken() {
        const now = Date.now();
        if (!this._token || now - this._lastRegenerate > this._regenerateInterval) {
            this._token = this._generateToken();
            this._lastRegenerate = now;
        }
        return this._token;
    }

    _generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    validateToken(token) {
        if (!token) return false;
        const current = this.getToken();
        return token === current;
    }
}

export const csrf = new CSRFProtector();

// ============================================================
//  THROTTLE / DEBOUNCE (ЗАЩИТА ОТ SPAM)
// ============================================================
export function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId = null;
    let lastArgs = null;
    
    return function throttled(...args) {
        const now = Date.now();
        lastArgs = args;
        
        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
            timeoutId = null;
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn.apply(this, lastArgs);
                timeoutId = null;
            }, delay - (now - lastCall));
        }
    };
}

export function debounce(fn, delay) {
    let timeoutId = null;
    
    return function debounced(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

// ============================================================
//  RATE LIMITING
// ============================================================
export class RateLimiter {
    constructor(options = {}) {
        this._limit = options.limit || 10;
        this._window = options.window || 1000;
        this._store = new Map();
    }

    check(key) {
        const now = Date.now();
        const entry = this._store.get(key);
        
        if (!entry) {
            this._store.set(key, { count: 1, reset: now + this._window });
            return { allowed: true, remaining: this._limit - 1 };
        }
        
        if (now > entry.reset) {
            this._store.set(key, { count: 1, reset: now + this._window });
            return { allowed: true, remaining: this._limit - 1 };
        }
        
        if (entry.count >= this._limit) {
            return { 
                allowed: false, 
                remaining: 0,
                resetAt: entry.reset 
            };
        }
        
        entry.count++;
        return { 
            allowed: true, 
            remaining: this._limit - entry.count 
        };
    }

    reset(key) {
        this._store.delete(key);
    }

    clear() {
        this._store.clear();
    }
}

// ============================================================
//  SECURE STORAGE (ОБЕРТКА НАД LOCALSTORAGE)
// ============================================================
export class SecureStorage {
    constructor(prefix = 'app_') {
        this._prefix = prefix;
        this._encrypted = new Map();
    }

    _getKey(key) {
        return this._prefix + key;
    }

    set(key, value, encrypt = false) {
        try {
            const data = JSON.stringify(value);
            if (encrypt) {
                // Простое кодирование (не для реального шифрования)
                const encoded = btoa(encodeURIComponent(data));
                localStorage.setItem(this._getKey(key), encoded);
            } else {
                localStorage.setItem(this._getKey(key), data);
            }
            return true;
        } catch {
            return false;
        }
    }

    get(key, decrypt = false) {
        try {
            const data = localStorage.getItem(this._getKey(key));
            if (!data) return null;
            
            let parsed;
            if (decrypt) {
                parsed = JSON.parse(decodeURIComponent(atob(data)));
            } else {
                parsed = JSON.parse(data);
            }
            return parsed;
        } catch {
            return null;
        }
    }

    remove(key) {
        localStorage.removeItem(this._getKey(key));
    }

    clear() {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith(this._prefix)) {
                localStorage.removeItem(key);
            }
        }
    }

    has(key) {
        return localStorage.getItem(this._getKey(key)) !== null;
    }
}

// ============================================================
//  ПРОВЕРКА НА БОТА
// ============================================================
export function isBot() {
    const ua = navigator.userAgent.toLowerCase();
    const botPatterns = [
        'bot', 'crawl', 'spider', 'scrape', 'headless',
        'phantom', 'selenium', 'puppeteer', 'playwright'
    ];
    return botPatterns.some(pattern => ua.includes(pattern));
}

// ============================================================
//  ЗАЩИТА ОТ ИНСПЕКЦИИ
// ============================================================
export function preventInspection() {
    // Защита от консольных команд
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    if (document.querySelector('[data-no-inspect]')) {
        console.log = function() {};
        console.warn = function() {};
        console.error = function() {};
        
        // Восстанавливаем через 5 секунд
        setTimeout(() => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
        }, 5000);
    }
}

// ============================================================
//  ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    escapeHTML,
    sanitizeString,
    sanitizeObject,
    csrf,
    throttle,
    debounce,
    RateLimiter,
    SecureStorage,
    isBot,
    preventInspection
};
