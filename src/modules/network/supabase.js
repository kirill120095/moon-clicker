// ============================================================
//  SUPABASE КЛИЕНТ С РЕТРИ И КЭШИРОВАНИЕМ
// ============================================================
import { CONFIG } from '../../core/config.js';

if (typeof window.supabase === 'undefined') {
    throw new Error('Supabase library not loaded');
}

export const supabaseClient = window.supabase.createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.anonKey,
    CONFIG.supabase.options
);

class Cache {
    constructor() {
        this._cache = new Map();
        this._ttl = 5000;
    }

    get(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this._ttl) {
            this._cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(key, data) {
        this._cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clear() {
        this._cache.clear();
    }

    invalidate(key) {
        this._cache.delete(key);
    }
}

export const cache = new Cache();

export async function fetchWithRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i === maxRetries - 1) break;
            const jitter = Math.random() * 200;
            await new Promise(r => setTimeout(r, delay * Math.pow(2, i) + jitter));
        }
    }
    throw lastError;
}

export const db = {
    async getPlayer(userId, useCache = true) {
        const cacheKey = `player_${userId}`;
        if (useCache) {
            const cached = cache.get(cacheKey);
            if (cached) return cached;
        }
        
        const result = await fetchWithRetry(async () => {
            const { data, error } = await supabaseClient
                .from(CONFIG.endpoints.players)
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) throw error;
            return data;
        });
        
        if (useCache) {
            cache.set(cacheKey, result);
        }
        return result;
    },

    // НОВЫЙ МЕТОД
    async getPlayerByUsername(username) {
        const cacheKey = `player_username_${username}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const result = await fetchWithRetry(async () => {
            const { data, error } = await supabaseClient
                .from(CONFIG.endpoints.players)
                .select('*')
                .eq('username', username)
                .single();

            if (error) throw error;
            return data;
        });

        cache.set(cacheKey, result);
        return result;
    },

    async updatePlayer(userId, updates) {
        cache.invalidate(`player_${userId}`);
        
        const result = await fetchWithRetry(async () => {
            const { data, error } = await supabaseClient
                .from(CONFIG.endpoints.players)
                .update(updates)
                .eq('id', userId)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        });
        
        cache.set(`player_${userId}`, result);
        return result;
    },

    async createPlayer(data) {
        const result = await fetchWithRetry(async () => {
            const { data: created, error } = await supabaseClient
                .from(CONFIG.endpoints.players)
                .insert(data)
                .select()
                .single();
            
            if (error) throw error;
            return created;
        });
        
        cache.set(`player_${result.id}`, result);
        return result;
    },

    async getLeaders(limit = 10) {
        const cacheKey = 'leaders';
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const result = await fetchWithRetry(async () => {
            const { data, error } = await supabaseClient
                .from(CONFIG.endpoints.players)
                .select('username, level, total_clicks, total_seconds_played')
                .order('level', { ascending: false })
                .order('total_clicks', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        });
        
        cache.set(cacheKey, result);
        return result;
    },

    async signIn(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    async signUp(email, password, metadata) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: metadata }
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        cache.clear();
    },

    async getSession() {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        return data;
    }
};

export class DatabaseError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.details = details;
    }
}

export function handleDatabaseError(error) {
    console.error('Database error:', error);
    
    if (error.code === 'PGRST116') {
        return new DatabaseError('Запись не найдена', error.code);
    }
    if (error.code === '23505') {
        return new DatabaseError('Запись уже существует', error.code);
    }
    if (error.code === '42501') {
        return new DatabaseError('Недостаточно прав', error.code);
    }
    if (error.message?.includes('network')) {
        return new DatabaseError('Ошибка сети, попробуйте позже', 'NETWORK_ERROR');
    }
    
    return new DatabaseError(
        error.message || 'Неизвестная ошибка',
        error.code || 'UNKNOWN_ERROR'
    );
}
