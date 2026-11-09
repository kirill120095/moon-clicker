import { recordDiagnostic } from '../../utils/diagnostics.js';
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
let _snapshot=null,_snapshotRevision=0,_retryAt=0,_failures=0;
let _actionSession=0;

function resetActionSession() {
  _actionSession++;
  _actionQueue=Promise.resolve();
  _snapshot=null;
  _snapshotRevision=0;
  _retryAt=0;
  _failures=0;
}

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
        global:{fetch:async(input,options={})=>{
          const url=String(input?.url||input),ms=url.includes('/storage/')?120000:20000;
          const signal=options.signal&&typeof AbortSignal.any==='function'?AbortSignal.any([options.signal,AbortSignal.timeout(ms)]):options.signal||AbortSignal.timeout(ms);
          return fetch(input,{...options,signal});
        }},
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

// One low-frequency Realtime Presence channel for the leaderboard (no polling or database writes).
let onlineChannel=null,onlineUserId=null,onlineGeneration=0,onlineReady=false;
const onlineIds=new Set(),onlineListeners=new Set();
function notifyOnline(){for(const fn of onlineListeners)try{fn();}catch(error){console.warn('[Presence] listener',error);}}
function syncOnline(){
 const wasReady=onlineReady;onlineReady=true;
 const next=new Set();
 for(const entries of Object.values(onlineChannel?.presenceState()||{})){
  for(const entry of entries)if(typeof entry.player_id==='string')next.add(entry.player_id);
 }
 if(next.size!==onlineIds.size||[...next].some(id=>!onlineIds.has(id))){onlineIds.clear();for(const id of next)onlineIds.add(id);notifyOnline();}
 else if(!wasReady)notifyOnline();
}
export const leaderboardPresence={
 isOnline:id=>onlineIds.has(id),
 isReady:()=>onlineReady,
 subscribe(fn){onlineListeners.add(fn);return()=>onlineListeners.delete(fn);},
 async start(playerId){
  if(!playerId||onlineChannel&&onlineUserId===playerId)return;
  const generation=++onlineGeneration;
  if(onlineChannel){const old=onlineChannel;onlineChannel=null;initSupabase().then(client=>client.removeChannel(old)).catch(()=>{});}
  onlineUserId=playerId;onlineReady=false;onlineIds.clear();notifyOnline();
  try{
   const client=await initSupabase();if(generation!==onlineGeneration)return;
   const channel=client.channel('moon-clicker-online',{config:{presence:{key:playerId}}});
   onlineChannel=channel;
   channel.on('presence',{event:'sync'},syncOnline)
    .subscribe(async status=>{
      if(generation!==onlineGeneration)return;
       if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){onlineReady=false;notifyOnline();return;}
       if(status!=='SUBSCRIBED')return;
      try{await channel.track({player_id:playerId});}catch(error){console.warn('[Presence] track failed',error);}
    });
  }catch(error){console.warn('[Presence] connection unavailable',error);}
 },
 stop(){
  ++onlineGeneration;onlineUserId=null;onlineReady=false;onlineIds.clear();notifyOnline();
  if(onlineChannel){const old=onlineChannel;onlineChannel=null;initSupabase().then(client=>client.removeChannel(old)).catch(()=>{});}
 }
};

// ============================================================
// DATABASE OPERATIONS
// ============================================================

export const db = {
  leaderboardPresence,
  action(action, payload = {}) {
    const request_id = crypto.randomUUID();
    const session = _actionSession;
    const checkSession = () => {
      if(session!==_actionSession)throw new Error('Игровая сессия изменилась.');
    };
    const run = async () => {
      checkSession();
      const client = await initSupabase();
      for(let attempt=0;;attempt++){
        const delay=_retryAt-Date.now();
        if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));
        checkSession();
        // Keep the request ID if the server committed but its response was lost.
        let result;
        try{
          result=await client.functions.invoke('game-actions', { body: { action, payload, request_id, snapshot:_snapshot } });
        }catch(error){result={error};}
        checkSession();
        if(!result.error){
          _retryAt=0;
          _failures=0;
          if(result.data?.error){const error=new Error(result.data.error);error.code=result.data.code;recordDiagnostic('game',action,error.code,error);throw error;}
          if(action==='load')recordDiagnostic('game','load','OK','Сохранение загружено');
          if(result.data.snapshot&&result.data.revision>=_snapshotRevision){_snapshot=result.data.snapshot;_snapshotRevision=result.data.revision;}
          return result.data;
        }
        let message = 'Сервер недоступен. Повторите действие.';
        let code='NETWORK_ERROR',status=result.error.context?.status||0;
        try { const body = await result.error.context.json(); message = body.error || message;code=body.code||code; } catch {}
        checkSession();
        const temporary=status>=500||!status;
        if(temporary){_failures++;_retryAt=Date.now()+Math.min(30000,2000*Math.pow(2,_failures-1));}
        else{_failures=0;_retryAt=0;}
        recordDiagnostic('game',action,code,message);
        if(!temporary||attempt>0){
          const error=new Error(temporary?'Сервер пока недоступен. Попробуйте через несколько секунд.':message);
          error.code=code;
          error.status=status;
          throw error;
        }
      }
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
  async signInWithPassword(identifier, password) {
    resetActionSession();
    try {
      const client = await initSupabase();
      const email = identifier.includes('@') ? identifier.trim() : identifier.trim().toLowerCase() + '@players.moon-clicker.invalid';
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      recordDiagnostic('auth','login','OK','Авторизация успешна');
      return data;
    } catch (error) {
      recordDiagnostic('auth','login',error.code||'AUTH_ERROR',error);
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
  async register(username, password) {
    const client = await initSupabase();
    const result = await client.functions.invoke('register-player', { body: { username, password } });
    if (result.error) {
      let message = 'Не удалось зарегистрироваться. Попробуйте ещё раз.';
      try { message = (await result.error.context.json()).error || message; } catch {}
      throw new Error(message);
    }
    if (result.data?.error) throw new Error(result.data.error);
    return this.signInWithPassword(username, password);
  },

  // ============================================================
  // AUTH: ВЫХОД
  // ============================================================
  async signOut() {
    resetActionSession();
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
        .select('player_id, username, max_level, total_clicks')
        .order('max_level', { ascending: false })
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
  const message = String(error?.message || '').toLowerCase();
  if (error?.code === 'over_email_send_rate_limit' || message.includes('email rate limit')) {
    return 'Лимит отправки писем исчерпан. Проверьте уже полученное письмо подтверждения или попробуйте позже.';
  }

  console.error('[DB] Error:', error);
  
  if (error.code === '23505') {
    return 'Пользователь уже существует';
  }
  if (error.code === 'PGRST116') {
    return 'Запись не найдена';
  }
  if (error.message && error.message.includes('Invalid login credentials')) {
    return 'Неверный логин или пароль';
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
