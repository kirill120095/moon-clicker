// ============================================================
// SUPABASE DATABASE CLIENT
// ============================================================

const SUPABASE_URL = 'https://zllnsmztaakdwjpnijsk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbG5zbXp0YWFrZHdqcG5panNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwNTQwNTQsImV4cCI6MjA1MjYzMDA1NH0.5qXZz8wvZxVXqYxYxYxYxYxYxYxYxYxYxYxYxYxYxY';

// Ждём загрузки Supabase
function waitForSupabase() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.supabase) {
      resolve(window.supabase);
      return;
    }
    
    let attempts = 0;
    const maxAttempts = 50;
    
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && window.supabase) {
        clearInterval(checkInterval);
        resolve(window.supabase);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('Supabase library not loaded after 5 seconds'));
      }
    }, 100);
  });
}

let supabaseClient = null;

// Инициализация клиента
async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  
  try {
    const supabase = await waitForSupabase();
    const { createClient } = supabase;
    
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
    
    console.log('[Supabase] Client initialized');
    return supabaseClient;
  } catch (error) {
    console.error('[Supabase] Init error:', error);
    throw error;
  }
}

// Запускаем инициализацию сразу
initSupabase().catch(err => {
  console.error('[Supabase] Failed to initialize:', err);
});

// ============================================================
// DATABASE OPERATIONS
// ============================================================

export const db = {
  // ============================================================
  // AUTH: ПОЛУЧЕНИЕ СЕССИИ (ИСПРАВЛЕНО)
  // ============================================================
  async getSession() {
    try {
      const client = await initSupabase();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[DB] getSession error:', error);
      return { session: null };
    }
  },

  // ============================================================
  // AUTH: ВХОД С ПАРОЛЕМ
  // ============================================================
  async signInWithPassword(email, password) {
    try {
      const client = await initSupabase();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[DB] signInWithPassword error:', error);
      throw error;
    }
  },

  // Алиас для совместимости
  async login(email, password) {
    return this.signInWithPassword(email, password);
  },

  // ============================================================
  // AUTH: РЕГИСТРАЦИЯ
  // ============================================================
  async signUp(email, password, options = {}) {
    try {
      const client = await initSupabase();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: options
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[DB] signUp error:', error);
      throw error;
    }
  },

  // Алиас для совместимости
  async register(email, password, username) {
    try {
      const result = await this.signUp(email, password, {
        data: { username: username }
      });
      
      if (result.user) {
        await this.createPlayer(result.user.id);
        await this.updatePlayer(result.user.id, { username });
      }
      
      return result;
    } catch (error) {
      console.error('[DB] register error:', error);
      throw error;
    }
  },

  // ============================================================
  // AUTH: ВЫХОД
  // ============================================================
  async signOut() {
    try {
      const client = await initSupabase();
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('[DB] signOut error:', error);
      throw error;
    }
  },

  // Алиас для совместимости
  async logout() {
    return this.signOut();
  },

  // ============================================================
  // AUTH: ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
  // ============================================================
  async getUser() {
    try {
      const client = await initSupabase();
      const { data: { user }, error } = await client.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('[DB] getUser error:', error);
      return null;
    }
  },

  // Алиас для совместимости
  async getCurrentUser() {
    return this.getUser();
  },

  // ============================================================
  // AUTH: ПОДПИСКА НА ИЗМЕНЕНИЯ
  // ============================================================
  onAuthStateChange(callback) {
    initSupabase().then(client => {
      client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });
    }).catch(err => {
      console.error('[DB] onAuthStateChange init error:', err);
    });
  },

  // ============================================================
  // DB: ПОЛУЧЕНИЕ ИГРОКА
  // ============================================================
  async getPlayer(userId, createIfNotExists = true) {
    try {
      const client = await initSupabase();
      const { data, error } = await client
        .from('players')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data && createIfNotExists) {
        return await this.createPlayer(userId);
      }

      return data;
    } catch (error) {
      console.error('[DB] getPlayer error:', error);
      throw error;
    }
  },

  // ============================================================
  // DB: СОЗДАНИЕ ИГРОКА
  // ============================================================
  async createPlayer(userId) {
    try {
      const client = await initSupabase();
      const newPlayer = {
        id: userId,
        level: 1,
        total_clicks: 0,
        total_seconds_played: 0,
        moon_hp: 100,
        shards: 0,
        click_damage: 1,
        click_damage_level: 0,
        username: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('players')
        .insert(newPlayer)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[DB] createPlayer error:', error);
      throw error;
    }
  },

  // ============================================================
  // DB: ОБНОВЛЕНИЕ ИГРОКА
  // ============================================================
  async updatePlayer(userId, updates) {
    try {
      const client = await initSupabase();
      updates.updated_at = new Date().toISOString();

      const { data, error } = await client
        .from('players')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[DB] updatePlayer error:', error);
      throw error;
    }
  },

  // ============================================================
  // DB: ПОЛУЧЕНИЕ ЛИДЕРОВ
  // ============================================================
  async getLeaders(limit = 10) {
    try {
      const client = await initSupabase();
      const { data, error } = await client
        .from('players')
        .select('username, level, total_clicks, shards')
        .order('level', { ascending: false })
        .order('total_clicks', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[DB] getLeaders error:', error);
      return [];
    }
  }
};

// ============================================================
// ЭКСПОРТ КЛИЕНТА (для прямого использования)
// ============================================================
export { supabaseClient };
export { initSupabase };

// ============================================================
// ERROR HANDLER
// ============================================================
export function handleDatabaseError(error) {
  console.error('[DB] Error:', error);
  
  if (error.code === '23505') {
    return 'Пользователь уже существует';
  }
  if (error.code === 'PGRST116') {
    return 'Запись не найдена';
  }
  if (error.message && error.message.includes('Invalid login credentials')) {
    return 'Неверный email или пароль';
  }
  if (error.message && error.message.includes('User already registered')) {
    return 'Пользователь уже зарегистрирован';
  }
  if (error.error_description) {
    return error.error_description;
  }
  
  return error.message || 'Ошибка базы данных';
}
