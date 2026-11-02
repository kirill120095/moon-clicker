// ============================================================
// SUPABASE DATABASE CLIENT
// Singleton-паттерн для предотвращения множественных инстансов
// ============================================================

const SUPABASE_URL = 'https://zllnsmztaakdwjpnijsk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AHp63XmOZhgE2xYmhxFvsw_cB1urGrt';

// ============================================================
// SINGLETON ИНИЦИАЛИЗАЦИЯ (через Promise)
// ============================================================

let _initPromise = null;
let _writeQueue = Promise.resolve();
let _actionQueue = Promise.resolve();

/**
 * Ждёт загрузки библиотеки Supabase с CDN
 */
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

/**
 * Инициализирует Supabase клиент (singleton)
 * Все параллельные вызовы получат один и тот же Promise
 */
function initSupabase() {
  // Если уже есть Promise инициализации - возвращаем его
  if (_initPromise) {
    return _initPromise;
  }
  
  // Создаём Promise инициализации ОДИН раз
  _initPromise = (async () => {
    try {
      const supabase = await waitForSupabase();
      const { createClient } = supabase;
      
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      
      console.log('[Supabase] Client initialized');
      return client;
    } catch (error) {
      console.error('[Supabase] Init error:', error);
      // Сбрасываем Promise при ошибке, чтобы можно было попробовать снова
      _initPromise = null;
      throw error;
    }
  })();
  
  return _initPromise;
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

export const db = {
  action(action, payload = {}) {
    const request_id = crypto.randomUUID();
    const run = async () => {
      const client = await initSupabase();
      const result = await client.functions.invoke('game-actions', { body: { action, payload, request_id } });
      if (result.error) {
        let message = 'Сервер недоступен. Повторите действие.';
        try { const body = await result.error.context.json(); message = body.error || message; } catch {}
        throw new Error(message);
      }
      if (result.data?.error) throw new Error(result.data.error);
      return result.data;
    };
    const pending = _actionQueue.then(run);
    _actionQueue = pending.catch(() => {});
    return pending;
  },
  // ============================================================
  // AUTH: ПОЛУЧЕНИЕ СЕССИИ
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
  async getPlayer() {
    const result = await this.action('load');
    const s = result.state;
    return { id: (await this.getUser())?.id, ...s.playerData,
      level:s.currentLevel, moon_hp:s.moonHP, total_clicks:s.clickCount,
      total_seconds_played:s.totalSecondsPlayed, game_state:s };
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
      moon_hp: 1000,  // ← БЫЛО 100
      shards: 0,
      click_damage: 10,  // ← БЫЛО 1, СТАЛО 10
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
  async updatePlayer() {
    throw new Error('Обновите страницу: прогресс сохраняется сервером нового сезона.');
  },

  // ============================================================
  // DB: ПОЛУЧЕНИЕ ЛИДЕРОВ
  // ============================================================
  async getLeaders(limit = 10) {
    try {
      const client = await initSupabase();
      const { data, error } = await client
        .from('leaderboard')
        .select('username, level, total_clicks')
        .order('level', { ascending: false })
        .order('total_clicks', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[DB] getLeaders error:', error);
      throw error;
    }
  }
};

// ============================================================
// ЭКСПОРТ ФУНКЦИИ ИНИЦИАЛИЗАЦИИ (для прямого использования)
// ============================================================
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
  if (error.message && error.message.includes('Email not confirmed')) {
    return 'Email не подтверждён';
  }
  if (error.error_description) {
    return error.error_description;
  }
  
  return error.message || 'Ошибка базы данных';
}
