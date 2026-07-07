// ============================================================
//  РАСШИРЕННОЕ КЭШИРОВАНИЕ
// ============================================================

export class CacheManager {
    constructor(options = {}) {
        this._cache = new Map();
        this._ttl = options.ttl || 5000;
        this._maxSize = options.maxSize || 100;
        this._enabled = options.enabled !== false;
    }

    // ============================================================
    //  ОСНОВНЫЕ МЕТОДЫ
    // ============================================================
    
    get(key) {
        if (!this._enabled) return null;
        
        const entry = this._cache.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > this._ttl) {
            this._cache.delete(key);
            return null;
        }
        
        return entry.data;
    }

    set(key, data) {
        if (!this._enabled) return;
        
        // Проверяем размер кэша
        if (this._cache.size >= this._maxSize) {
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
        }
        
        this._cache.set(key, {
            data: this._clone(data),
            timestamp: Date.now()
        });
    }

    delete(key) {
        return this._cache.delete(key);
    }

    clear() {
        this._cache.clear();
    }

    has(key) {
        if (!this._enabled) return false;
        const entry = this._cache.get(key);
        if (!entry) return false;
        if (Date.now() - entry.timestamp > this._ttl) {
            this._cache.delete(key);
            return false;
        }
        return true;
    }

    // ============================================================
    //  ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================================
    
    _clone(data) {
        try {
            return JSON.parse(JSON.stringify(data));
        } catch {
            return data;
        }
    }

    getOrSet(key, fn) {
        const cached = this.get(key);
        if (cached !== null) return cached;
        
        const data = fn();
        this.set(key, data);
        return data;
    }

    async getOrSetAsync(key, fn) {
        const cached = this.get(key);
        if (cached !== null) return cached;
        
        const data = await fn();
        this.set(key, data);
        return data;
    }

    // ============================================================
    //  УПРАВЛЕНИЕ TTL
    // ============================================================
    
    setTTL(ttl) {
        this._ttl = ttl;
    }

    getTTL() {
        return this._ttl;
    }

    // ============================================================
    //  СТАТИСТИКА
    // ============================================================
    
    getStats() {
        const now = Date.now();
        let active = 0;
        let expired = 0;
        
        for (const [key, entry] of this._cache) {
            if (now - entry.timestamp > this._ttl) {
                expired++;
            } else {
                active++;
            }
        }
        
        return {
            total: this._cache.size,
            active,
            expired,
            maxSize: this._maxSize
        };
    }

    // ============================================================
    //  BATCH ОПЕРАЦИИ
    // ============================================================
    
    setMany(entries) {
        for (const [key, data] of entries) {
            this.set(key, data);
        }
    }

    getMany(keys) {
        return keys.map(key => this.get(key));
    }

    deleteMany(keys) {
        for (const key of keys) {
            this._cache.delete(key);
        }
    }
}

// ============================================================
//  ПРЕДНАСТРОЕННЫЕ КЭШИ
// ============================================================

// Кэш для игровых данных (короткий TTL)
export const gameCache = new CacheManager({
    ttl: 3000,
    maxSize: 50,
    enabled: true
});

// Кэш для статических данных (долгий TTL)
export const staticCache = new CacheManager({
    ttl: 60000,
    maxSize: 20,
    enabled: true
});

// Кэш для изображений (очень долгий TTL)
export const imageCache = new CacheManager({
    ttl: 3600000,
    maxSize: 100,
    enabled: true
});
