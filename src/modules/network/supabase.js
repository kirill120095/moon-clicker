// ============================================================
// SUPABASE DATABASE CLIENT
// ============================================================

// Конфигурация Supabase
const SUPABASE_URL = 'https://zllnsmztaakdwjpnijsk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbG5zbXp0YWFrZHdqcG5panNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwNTQwNTQsImV4cCI6MjA1MjYzMDA1NH0.5qXZz8wvZxVXqYxYxYxYxYxYxYxYxYxYxYxYxYxYxY';

// Проверка загрузки Supabase
if (typeof window.supabase === 'undefined') {
  console.error('[Supabase] Библиотека не загружена! Проверьте CDN в index.html');
  throw new Error('Supabase library not loaded');
}

// Создаем клиент Supabase
const { createClient } = window.supabase;

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// ============================================================
// DATABASE OPERATIONS
// ============================================================

export const db = {
  // ============================================================
  // ПОЛУЧЕНИЕ ИГРОКА
  // ============================================================
  async getPlayer(userId, createIfNotExists = true) {
    try {
      const { data, error } = await supabaseClient
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
  // СОЗДАНИЕ ИГРОКА
  // ============================================================
  async createPlayer(userId) {
    try {
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

      const { data, error } = await supabaseClient
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
  // ОБНОВЛЕНИЕ ИГРОКА
  // ============================================================
  async updatePlayer(userId, updates) {
    try {
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseClient
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
  // ПОЛУЧЕНИЕ ЛИДЕРОВ
  // ============================================================
  async getLeaders(limit = 10) {
    try {
      const { data, error } = await supabaseClient
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
  },

  // ============================================================
  // РЕГИСТРАЦИЯ
  // ============================================================
  async register(email, password, username) {
    try {
      // Создаем пользователя в Supabase Auth
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Создаем запись в таблице players
        await this.createPlayer(authData.user.id);
        
        // Обновляем username
        await this.updatePlayer(authData.user.id, { username });
      }

      return authData;
    } catch (error) {
      console.error('[DB] register error:', error);
      throw error;
    }
  },

  // ============================================================
  // ВХОД
  // ============================================================
  async login(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[DB] login error:', error);
      throw error;
    }
  },

  // ============================================================
  // ВЫХОД
  // ============================================================
  async logout() {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('[DB] logout error:', error);
      throw error;
    }
  },

  // ============================================================
  // ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
  // ============================================================
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('[DB] getCurrentUser error:', error);
      return null;
    }
  },

  // ============================================================
  // ПОДПИСКА НА ИЗМЕНЕНИЯ AUTH
  // ============================================================
  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
};

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
  if (error.message.includes('Invalid login credentials')) {
    return 'Неверный email или пароль';
  }
  if (error.message.includes('User already registered')) {
    return 'Пользователь уже зарегистрирован';
  }
  
  return error.message || 'Ошибка базы данных';
}
