// ============================================================
// УПРАВЛЕНИЕ СОСТОЯНИЕМ (STATE MANAGEMENT)
// Реактивный стейт-менеджер на основе Proxy + Observer pattern
// ============================================================

import { CONSTANTS, MOON_TYPES } from './constants.js';

// ============================================================
// НАЧАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
const initialState = {
  // Пользователь
  user: null,
  
  // Игровые данные
  currentLevel: CONSTANTS.DEFAULTS.LEVEL,
  moonHP: CONSTANTS.DEFAULTS.MOON_HP,
  maxHP: CONSTANTS.DEFAULTS.MOON_HP,
  clickCount: CONSTANTS.DEFAULTS.CLICKS,
  totalSecondsPlayed: CONSTANTS.DEFAULTS.TIME_PLAYED,
  
  // Данные игрока из Supabase
  playerData: {
    shards: CONSTANTS.DEFAULTS.SHARDS,
    click_damage: 1,
    click_damage_level: 0,
    crit_chance_level: 0,
    crit_damage_level: 0,
    level: 1,
    total_clicks: 0,
    total_seconds_played: 0,
    moon_hp: 100,
    username: ''
  },
  
  // Луны
  activeMoon: CONSTANTS.DEFAULTS.ACTIVE_MOON,
  activeMoons: CONSTANTS.DEFAULTS.ACTIVE_MOONS,
  ownedMoons: CONSTANTS.DEFAULTS.OWNED_MOONS,
  moonLevels: CONSTANTS.DEFAULTS.MOON_LEVELS,
  
  // Слоты
  maxSlots: CONSTANTS.DEFAULTS.SLOT_LEVEL,
  
  // Боссы
  bossKills: CONSTANTS.DEFAULTS.BOSS_KILLS,
  bossTimer: CONSTANTS.BOSS_TIMER,
  bossTimerRunning: false,
  
  // Режимы
  levelLocked: false,
  testMode: false,
  
  // Квесты и достижения
  quests: {},
  achievements: {},
  
  // Интервалы (не реактивные)
  timeUpdateInterval: null,
  autoSaveInterval: null
};

// ============================================================
// КЛАСС STATE (РЕАКТИВНЫЙ)
// ============================================================
class State {
  constructor() {
    this._subscribers = new Map();
    this._batchUpdates = false;
    this._pendingUpdates = new Set();
    
    // Создаем глубокую копию начального состояния
    this._state = JSON.parse(JSON.stringify(initialState));
    
    // Оборачиваем в Proxy для реактивности
    this._proxy = new Proxy(this._state, {
      set: (target, property, value) => {
        const oldValue = target[property];
        target[property] = value;
        
        // Уведомляем подписчиков только если значение изменилось
        if (oldValue !== value) {
          if (this._batchUpdates) {
            this._pendingUpdates.add(property);
          } else {
            this._notify(property, value, oldValue);
          }
        }
        
        return true;
      },
      
      get: (target, property) => {
        return target[property];
      }
    });
  }

  // ============================================================
  // ПОДПИСКА НА ИЗМЕНЕНИЯ
  // ============================================================
  
  subscribe(property, callback) {
    if (!this._subscribers.has(property)) {
      this._subscribers.set(property, new Set());
    }
    
    this._subscribers.get(property).add(callback);
    
    return () => {
      const subs = this._subscribers.get(property);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(property);
        }
      }
    };
  }

  subscribeMany(properties, callback) {
    const unsubscribes = properties.map(prop => this.subscribe(prop, callback));
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }

  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  // ============================================================
  // УВЕДОМЛЕНИЕ ПОДПИСЧИКОВ
  // ============================================================
  
  _notify(property, newValue, oldValue) {
    const subs = this._subscribers.get(property);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(newValue, oldValue, property);
        } catch (error) {
          console.error(`[State] Error in subscriber for ${property}:`, error);
        }
      });
    }
    
    const allSubs = this._subscribers.get('*');
    if (allSubs) {
      allSubs.forEach(callback => {
        try {
          callback(newValue, oldValue, property);
        } catch (error) {
          console.error(`[State] Error in global subscriber:`, error);
        }
      });
    }
  }

  // ============================================================
  // Пакетное обновление
  // ============================================================
  
  startBatch() {
    this._batchUpdates = true;
    this._pendingUpdates.clear();
  }

  endBatch() {
    this._batchUpdates = false;
    
    this._pendingUpdates.forEach(property => {
      const value = this._state[property];
      this._notify(property, value, undefined);
    });
    
    this._pendingUpdates.clear();
  }

  // ============================================================
  // УСТАНОВКА ЗНАЧЕНИЙ
  // ============================================================
  
  set(property, value) {
    this._proxy[property] = value;
  }

  setMany(updates) {
    this.startBatch();
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
    this.endBatch();
  }

  get(property) {
    return this._state[property];
  }

  // ============================================================
  // УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЕМ (ДЛЯ AUTH.JS)
  // ============================================================
  
  /**
   * Установить текущего пользователя
   * @param {Object|null} user - объект пользователя Supabase или null
   */
  setUser(user) {
    this.set('user', user);
    
    // Если пользователь установлен - загружаем его данные из localStorage
    if (user?.id) {
      this._loadUserLocalStorage(user.id);
    }
  }

  /**
   * Получить текущего пользователя
   * @returns {Object|null}
   */
  getUser() {
    return this._state.user;
  }

  /**
   * Загрузить сохраненные данные пользователя из localStorage
   */
  _loadUserLocalStorage(userId) {
    try {
      // Загружаем активные луны
      const activeMoons = localStorage.getItem(`activeMoons_${userId}`);
      if (activeMoons) {
        const moons = JSON.parse(activeMoons);
        if (Array.isArray(moons) && moons.length > 0) {
          const validMoons = moons.filter(id => this._state.ownedMoons.includes(id));
          if (validMoons.length > 0) {
            this._state.activeMoons = validMoons;
            this._state.activeMoon = validMoons[0];
          }
        }
      }

      // Загружаем квесты
      const quests = localStorage.getItem(`quests_${userId}`);
      if (quests) {
        try {
          this._state.quests = JSON.parse(quests);
        } catch (e) {
          this._state.quests = {};
        }
      }

      // Загружаем достижения
      const achievements = localStorage.getItem(`ach_${userId}`);
      if (achievements) {
        try {
          this._state.achievements = JSON.parse(achievements);
        } catch (e) {
          this._state.achievements = {};
        }
      }

      // Загружаем режимы
      const levelLocked = localStorage.getItem(`levelLocked_${userId}`);
      if (levelLocked !== null) {
        this._state.levelLocked = levelLocked === 'true';
      }

      const testMode = localStorage.getItem(`testMode_${userId}`);
      if (testMode !== null) {
        this._state.testMode = testMode === 'true';
      }

      const bossKills = localStorage.getItem(`bossKills_${userId}`);
      if (bossKills !== null) {
        this._state.bossKills = parseInt(bossKills, 10) || 0;
      }

      const slotLevel = localStorage.getItem(`slotLevel_${userId}`);
      if (slotLevel !== null) {
        this._state.maxSlots = parseInt(slotLevel, 10) || 1;
      }

    } catch (error) {
      console.error('[State] Error loading user localStorage:', error);
    }
  }

  /**
   * Очистить пользователя (при выходе)
   */
  clearUser() {
    this.set('user', null);
  }

  // ============================================================
  // СПЕЦИФИЧНЫЕ МЕТОДЫ ДЛЯ ИГРЫ
  // ============================================================
  
  incrementClickCount() {
    this.set('clickCount', this._state.clickCount + 1);
  }

  incrementLevel() {
    this.set('currentLevel', this._state.currentLevel + 1);
  }

  setCurrentLevel(level) {
    this.set('currentLevel', level);
  }

  setBossKills(count) {
    this.set('bossKills', count);
    
    // Сохраняем в localStorage
    if (this._state.user?.id) {
      localStorage.setItem(`bossKills_${this._state.user.id}`, count.toString());
    }
  }

  setSlotLevel(level) {
    this.set('maxSlots', level);
    
    // Сохраняем в localStorage
    if (this._state.user?.id) {
      localStorage.setItem(`slotLevel_${this._state.user.id}`, level.toString());
    }
  }

  // ============================================================
  // УПРАВЛЕНИЕ ЛУНАМИ
  // ============================================================
  
  addOwnedMoon(moonId) {
    const owned = this._state.ownedMoons || [];
    if (!owned.includes(moonId)) {
      this.set('ownedMoons', [...owned, moonId]);
      
      const levels = this._state.moonLevels || {};
      if (!levels[moonId]) {
        this.set('moonLevels', { ...levels, [moonId]: 1 });
      }
    }
  }

  setMoonLevel(moonId, level) {
    const levels = this._state.moonLevels || {};
    this.set('moonLevels', { ...levels, [moonId]: level });
  }

  getMoonLevel(moonId) {
    return this._state.moonLevels?.[moonId] || 1;
  }

  addActiveMoon(moonId) {
    const current = this._state.activeMoons || [];
    if (!current.includes(moonId) && current.length < this._state.maxSlots) {
      this.set('activeMoons', [...current, moonId]);
      this.set('activeMoon', moonId);
      
      if (this._state.user?.id) {
        localStorage.setItem(`activeMoons_${this._state.user.id}`, JSON.stringify([...current, moonId]));
      }
    }
  }

  removeActiveMoon(moonId) {
    const current = this._state.activeMoons || [];
    if (current.includes(moonId) && current.length > 1) {
      const newActive = current.filter(id => id !== moonId);
      this.set('activeMoons', newActive);
      this.set('activeMoon', newActive[0] || 'normal');
      
      if (this._state.user?.id) {
        localStorage.setItem(`activeMoons_${this._state.user.id}`, JSON.stringify(newActive));
      }
    }
  }

  setActiveMoon(moonId) {
    const current = this._state.activeMoons || ['normal'];
    
    if (current.includes(moonId)) {
      this.set('activeMoon', moonId);
    } else if (current.length < this._state.maxSlots) {
      this.set('activeMoons', [...current, moonId]);
      this.set('activeMoon', moonId);
    } else {
      const newActive = [moonId, ...current.slice(1)];
      this.set('activeMoons', newActive);
      this.set('activeMoon', moonId);
    }
    
    if (this._state.user?.id) {
      localStorage.setItem(`activeMoons_${this._state.user.id}`, JSON.stringify(this._state.activeMoons));
    }
  }

  loadActiveMoons() {
    if (this._state.user?.id) {
      const saved = localStorage.getItem(`activeMoons_${this._state.user.id}`);
      if (saved) {
        try {
          const moons = JSON.parse(saved);
          if (Array.isArray(moons) && moons.length > 0) {
            const validMoons = moons.filter(id => this._state.ownedMoons.includes(id));
            if (validMoons.length > 0) {
              this._state.activeMoons = validMoons;
              this._state.activeMoon = validMoons[0];
            }
          }
        } catch (e) {
          console.error('[State] Error loading active moons:', e);
        }
      }
    }
  }

  // ============================================================
  // КВЕСТЫ
  // ============================================================
  
  updateQuestProgress(questId, progress) {
    const quests = this._state.quests || {};
    const quest = quests[questId];
    
    if (quest) {
      quest.progress = progress;
      if (progress >= quest.target) {
        quest.completed = true;
      }
      this.set('quests', { ...quests });
    }
  }

  resetQuests() {
    this.set('quests', {});
    
    if (this._state.user?.id) {
      localStorage.removeItem(`quests_${this._state.user.id}`);
      localStorage.removeItem(`quests_last_reset_${this._state.user.id}`);
    }
  }

  // ============================================================
  // ДОСТИЖЕНИЯ
  // ============================================================
  
  clearAchievements() {
    this.set('achievements', {});
    
    if (this._state.user?.id) {
      localStorage.removeItem(`ach_${this._state.user.id}`);
    }
  }

  // ============================================================
  // РЕЖИМЫ
  // ============================================================
  
  setLevelLocked(locked) {
    this.set('levelLocked', locked);
    
    if (this._state.user?.id) {
      localStorage.setItem(`levelLocked_${this._state.user.id}`, locked.toString());
    }
  }

  setTestMode(enabled) {
    this.set('testMode', enabled);
    
    if (this._state.user?.id) {
      localStorage.setItem(`testMode_${this._state.user.id}`, enabled.toString());
    }
  }

  // ============================================================
  // ЗАГРУЗКА ДАННЫХ ИЗ SUPABASE
  // ============================================================
  
  loadPlayerData(data) {
    if (!data) return;

    this.startBatch();

    if (data.level !== undefined) {
      this.set('currentLevel', data.level);
    }
    if (data.total_clicks !== undefined) {
      this.set('clickCount', data.total_clicks);
    }
    if (data.total_seconds_played !== undefined) {
      this.set('totalSecondsPlayed', data.total_seconds_played);
    }
    if (data.moon_hp !== undefined) {
      this.set('moonHP', data.moon_hp);
    }

    this.set('playerData', {
      shards: data.shards || 0,
      click_damage: data.click_damage || 1,
      click_damage_level: data.click_damage_level || 0,
      crit_chance_level: data.crit_chance_level || 0,
      crit_damage_level: data.crit_damage_level || 0,
      level: data.level || 1,
      total_clicks: data.total_clicks || 0,
      total_seconds_played: data.total_seconds_played || 0,
      moon_hp: data.moon_hp || 100,
      username: data.username || ''
    });

    this.endBatch();

    this.loadActiveMoons();
  }

  // ============================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================================
  
  init() {
    this.loadActiveMoons();
    console.log('[State] Инициализация завершена');
  }

  // ============================================================
  // ПОЛУЧЕНИЕ ВСЕГО СОСТОЯНИЯ (для отладки)
  // ============================================================
  
  getState() {
    return { ...this._state };
  }

  // ============================================================
  // СБРОС СОСТОЯНИЯ
  // ============================================================
  
  reset() {
    this.startBatch();
    Object.entries(initialState).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.set(key, JSON.parse(JSON.stringify(value)));
      } else {
        this.set(key, value);
      }
    });
    this.endBatch();
  }
}

// ============================================================
// ЭКСПОРТ ЕДИНСТВЕННОГО ЭКЗЕМПЛЯРА
// ============================================================
export const appState = new State();

// Удобный доступ к состоянию (только для чтения)
export const state = appState._state;

// Инициализация
appState.init();
