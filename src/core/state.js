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
  
  /**
   * Подписаться на изменение конкретного свойства
   * @param {string} property - имя свойства
   * @param {Function} callback - функция обратного вызова
   * @returns {Function} - функция отписки
   */
  subscribe(property, callback) {
    if (!this._subscribers.has(property)) {
      this._subscribers.set(property, new Set());
    }
    
    this._subscribers.get(property).add(callback);
    
    // Возвращаем функцию отписки
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

  /**
   * Подписаться на изменения нескольких свойств сразу
   * @param {Array<string>} properties - массив имен свойств
   * @param {Function} callback - функция обратного вызова
   * @returns {Function} - функция отписки
   */
  subscribeMany(properties, callback) {
    const unsubscribes = properties.map(prop => this.subscribe(prop, callback));
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }

  /**
   * Подписаться на все изменения
   * @param {Function} callback - функция обратного вызова
   * @returns {Function} - функция отписки
   */
  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  // ============================================================
  // УВЕДОМЛЕНИЕ ПОДПИСЧИКОВ
  // ============================================================
  
  _notify(property, newValue, oldValue) {
    // Уведомляем подписчиков конкретного свойства
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
    
    // Уведомляем подписчиков всех изменений
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
  // Пакетное обновление (для нескольких изменений сразу)
  // ============================================================
  
  startBatch() {
    this._batchUpdates = true;
    this._pendingUpdates.clear();
  }

  endBatch() {
    this._batchUpdates = false;
    
    // Уведомляем обо всех измененных свойствах
    this._pendingUpdates.forEach(property => {
      const value = this._state[property];
      this._notify(property, value, undefined);
    });
    
    this._pendingUpdates.clear();
  }

  // ============================================================
  // УСТАНОВКА ЗНАЧЕНИЙ
  // ============================================================
  
  /**
   * Установить значение свойства
   * @param {string} property - имя свойства
   * @param {*} value - значение
   */
  set(property, value) {
    this._proxy[property] = value;
  }

  /**
   * Установить несколько свойств сразу
   * @param {Object} updates - объект с обновлениями
   */
  setMany(updates) {
    this.startBatch();
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
    this.endBatch();
  }

  /**
   * Получить значение свойства
   * @param {string} property - имя свойства
   * @returns {*} значение
   */
  get(property) {
    return this._state[property];
  }

  // ============================================================
  // СПЕЦИФИЧНЫЕ МЕТОДЫ ДЛЯ ИГРЫ
  // ============================================================
  
  /**
   * Увеличить счетчик кликов
   */
  incrementClickCount() {
    this.set('clickCount', this._state.clickCount + 1);
  }

  /**
   * Увеличить уровень
   */
  incrementLevel() {
    this.set('currentLevel', this._state.currentLevel + 1);
  }

  /**
   * Установить текущий уровень
   */
  setCurrentLevel(level) {
    this.set('currentLevel', level);
  }

  /**
   * Установить количество убитых боссов
   */
  setBossKills(count) {
    this.set('bossKills', count);
  }

  /**
   * Установить уровень слотов
   */
  setSlotLevel(level) {
    this.set('maxSlots', level);
  }

  // ============================================================
  // УПРАВЛЕНИЕ ЛУНАМИ
  // ============================================================
  
  /**
   * Добавить луну в коллекцию
   */
  addOwnedMoon(moonId) {
    const owned = this._state.ownedMoons || [];
    if (!owned.includes(moonId)) {
      this.set('ownedMoons', [...owned, moonId]);
      
      // Устанавливаем начальный уровень
      const levels = this._state.moonLevels || {};
      if (!levels[moonId]) {
        this.set('moonLevels', { ...levels, [moonId]: 1 });
      }
    }
  }

  /**
   * Установить уровень луны
   */
  setMoonLevel(moonId, level) {
    const levels = this._state.moonLevels || {};
    this.set('moonLevels', { ...levels, [moonId]: level });
  }

  /**
   * Получить уровень луны
   */
  getMoonLevel(moonId) {
    return this._state.moonLevels?.[moonId] || 1;
  }

  /**
   * Добавить активную луну
   */
  addActiveMoon(moonId) {
    const current = this._state.activeMoons || [];
    if (!current.includes(moonId) && current.length < this._state.maxSlots) {
      this.set('activeMoons', [...current, moonId]);
      this.set('activeMoon', moonId);
      
      // Сохраняем в localStorage
      if (this._state.user?.id) {
        localStorage.setItem(`activeMoons_${this._state.user.id}`, JSON.stringify([...current, moonId]));
      }
    }
  }

  /**
   * Удалить активную луну
   */
  removeActiveMoon(moonId) {
    const current = this._state.activeMoons || [];
    if (current.includes(moonId) && current.length > 1) {
      const newActive = current.filter(id => id !== moonId);
      this.set('activeMoons', newActive);
      this.set('activeMoon', newActive[0] || 'normal');
      
      // Сохраняем в localStorage
      if (this._state.user?.id) {
        localStorage.setItem(`activeMoons_${this._state.user.id}`, JSON.stringify(newActive));
      }
    }
  }

  /**
   * Установить активную луну
   */
  setActiveMoon(moonId) {
    const current = this._state.activeMoons || ['normal'];
    
    if (current.includes(moonId)) {
      // Луна уже в списке активных - просто делаем её главной
      this.set('activeMoon', moonId);
    } else if (current.length < this._state.maxSlots) {
      // Есть свободный слот - добавляем
      this.set('activeMoons', [...current, moonId]);
      this.set('activeMoon', moonId);
    } else {
      // Нет свободных слотов - заменяем первую луну
      const newActive = [moonId, ...current.slice(1)];
      this.set('activeMoons', newActive);
      this.set('activeMoon', moonId);
    }
    
    // Сохраняем в localStorage
    if (this._state.user?.id) {
      localStorage.setItem(`activeMoons_${this._state.user.id}`, JSON.stringify(this._state.activeMoons));
    }
  }

  /**
   * Загрузить активные луны из localStorage
   */
  loadActiveMoons() {
    if (this._state.user?.id) {
      const saved = localStorage.getItem(`activeMoons_${this._state.user.id}`);
      if (saved) {
        try {
          const moons = JSON.parse(saved);
          if (Array.isArray(moons) && moons.length > 0) {
            // Проверяем, что все луны действительно куплены
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
  
  /**
   * Обновить прогресс квеста
   */
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

  /**
   * Сбросить квесты
   */
  resetQuests() {
    this.set('quests', {});
  }

  // ============================================================
  // ДОСТИЖЕНИЯ
  // ============================================================
  
  /**
   * Очистить достижения
   */
  clearAchievements() {
    this.set('achievements', {});
  }

  // ============================================================
  // ЗАГРУЗКА ДАННЫХ ИЗ SUPABASE
  // ============================================================
  
  /**
   * Загрузить данные игрока из Supabase
   */
  loadPlayerData(data) {
    if (!data) return;

    this.startBatch();

    // Основные данные
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

    // Данные игрока
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

    // Загружаем активные луны после загрузки данных
    this.loadActiveMoons();
  }

  // ============================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================================
  
  init() {
    // Загружаем активные луны из localStorage
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
