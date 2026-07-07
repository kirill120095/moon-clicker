// ============================================================
//  УПРАВЛЕНИЕ СОСТОЯНИЕМ (ПАТТЕРН OBSERVER)
// ============================================================
import { CONSTANTS, MOON_TYPES, ACHIEVEMENTS, QUESTS } from './constants.js';
import { getMaxHPForLevel } from './config.js';

class State {
    constructor() {
        // Начальное состояние
        this._state = {
            user: null,
            playerData: null,
            clickCount: 0,
            totalSecondsPlayed: 0,
            currentLevel: 1,
            moonHP: CONSTANTS.BASE_HP,
            maxHP: CONSTANTS.BASE_HP,
            sessionStartTimestamp: null,
            bossKills: 0,
            slotLevel: 1,
            maxSlots: 1,
            levelLocked: false,
            testMode: false,
            activeMoon: 'normal',
            activeMoons: ['normal'],
            ownedMoons: ['normal'],
            moonLevels: { normal: 1 },
            achievements: {},
            quests: {},
            bossTimer: CONSTANTS.BOSS_TIMER,
            bossTimerRunning: false,
            bossTimerInterval: null,
            timeUpdateInterval: null,
            autoSaveInterval: null,
            isProcessing: false,
        };
        
        // Подписчики
        this._observers = new Map();
        
        // Прокси для реактивности
        this._proxy = new Proxy(this._state, {
            set: (target, key, value) => {
                const oldValue = target[key];
                target[key] = value;
                this._notify(key, value, oldValue);
                return true;
            },
            get: (target, key) => {
                return target[key];
            }
        });
    }

    // ============================================================
    //  УПРАВЛЕНИЕ ПОДПИСКАМИ
    // ============================================================
    
    subscribe(key, callback) {
        if (!this._observers.has(key)) {
            this._observers.set(key, new Set());
        }
        this._observers.get(key).add(callback);
        
        // Возвращаем функцию для отписки
        return () => {
            const callbacks = this._observers.get(key);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this._observers.delete(key);
                }
            }
        };
    }

    subscribeMany(keys, callback) {
        const unsubscribers = keys.map(key => this.subscribe(key, callback));
        return () => unsubscribers.forEach(unsub => unsub());
    }

    _notify(key, value, oldValue) {
        const callbacks = this._observers.get(key);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(value, oldValue);
                } catch (e) {
                    console.error(`Ошибка в подписчике для ${key}:`, e);
                }
            });
        }
    }

    // ============================================================
    //  ДОСТУП К СОСТОЯНИЮ
    // ============================================================
    
    get state() {
        return this._proxy;
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        this._proxy[key] = value;
        return this;
    }

    // ============================================================
    //  МЕТОДЫ ДЛЯ РАБОТЫ С ЛУНАМИ
    // ============================================================
    
    setActiveMoon(moonId) {
        if (!this._state.ownedMoons.includes(moonId)) {
            console.warn(`Луна ${moonId} не принадлежит игроку`);
            return;
        }
        this._proxy.activeMoon = moonId;
        if (!this._state.activeMoons.includes(moonId)) {
            this._proxy.activeMoons = [...this._state.activeMoons, moonId];
        }
        this._saveMoonData();
    }

    setActiveMoons(moons) {
        const limitedMoons = moons.slice(0, this._state.maxSlots);
        this._proxy.activeMoons = limitedMoons;
        if (limitedMoons.length > 0) {
            this._proxy.activeMoon = limitedMoons[0];
        }
        this._saveMoonData();
    }

    addOwnedMoon(moonId) {
        if (!this._state.ownedMoons.includes(moonId)) {
            const newOwned = [...this._state.ownedMoons, moonId];
            this._proxy.ownedMoons = newOwned;
            this._saveMoonData();
            this._checkAchievements();
            return true;
        }
        return false;
    }

    setMoonLevel(moonId, level) {
        if (level < 1 || level > 10) return;
        const newLevels = { ...this._state.moonLevels };
        newLevels[moonId] = level;
        this._proxy.moonLevels = newLevels;
        this._saveMoonData();
        this._checkAchievements();
    }

    getMoonLevel(moonId) {
        return this._state.moonLevels[moonId] || 1;
    }

    // ============================================================
    //  РАБОТА С ДОСТИЖЕНИЯМИ
    // ============================================================
    
    unlockAchievement(id) {
        if (this._state.achievements[id]) return;
        
        const ach = ACHIEVEMENTS[id];
        if (!ach) return;
        
        const newAchievements = { ...this._state.achievements };
        newAchievements[id] = true;
        this._proxy.achievements = newAchievements;
        this._saveAchievements();
        
        // Награда
        if (ach.reward && this._state.playerData) {
            const newShards = (this._state.playerData.shards || 0) + ach.reward;
            this._proxy.playerData = { ...this._state.playerData, shards: newShards };
        }
        
        return true;
    }

    _checkAchievements() {
        const state = this._state;
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            if (!state.achievements[id] && ach.check(state)) {
                this.unlockAchievement(id);
            }
        }
    }

    // ============================================================
    //  РАБОТА С КВЕСТАМИ
    // ============================================================
    
    initQuests() {
        const saved = localStorage.getItem(`quests_${this._state.user?.id}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this._proxy.quests = parsed;
                return;
            } catch(e) {
                // Игнорируем
            }
        }
        this.resetQuests();
    }

    resetQuests() {
        const newQuests = {};
        for (const [id, q] of Object.entries(QUESTS)) {
            newQuests[id] = { progress: 0, completed: false, ...q };
        }
        this._proxy.quests = newQuests;
        this._saveQuests();
    }

    updateQuestProgress(type, amount = 1) {
        const quests = this._state.quests;
        if (!quests) return;
        
        let anyCompleted = false;
        const newQuests = { ...quests };
        
        for (const [id, q] of Object.entries(newQuests)) {
            if (q.completed) continue;
            if (q.type === type) {
                q.progress += amount;
                if (q.progress >= q.target) {
                    q.completed = true;
                    if (this._state.playerData) {
                        const newShards = (this._state.playerData.shards || 0) + q.reward;
                        this._proxy.playerData = { ...this._state.playerData, shards: newShards };
                    }
                    anyCompleted = true;
                }
            }
        }
        
        if (anyCompleted) {
            this._proxy.quests = newQuests;
            this._saveQuests();
        }
    }

    // ============================================================
    //  СОХРАНЕНИЕ В LOCALSTORAGE
    // ============================================================
    
    _saveMoonData() {
        if (!this._state.user) return;
        const key = `moon_data_${this._state.user.id}`;
        const data = {
            activeMoon: this._state.activeMoon,
            activeMoons: this._state.activeMoons,
            ownedMoons: this._state.ownedMoons,
            moonLevels: this._state.moonLevels
        };
        localStorage.setItem(key, JSON.stringify(data));
    }

    _loadMoonData() {
        if (!this._state.user) return;
        const key = `moon_data_${this._state.user.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this._proxy.activeMoon = data.activeMoon || 'normal';
                this._proxy.activeMoons = data.activeMoons || ['normal'];
                this._proxy.ownedMoons = data.ownedMoons || ['normal'];
                this._proxy.moonLevels = data.moonLevels || { normal: 1 };
                return;
            } catch(e) {
                // Игнорируем
            }
        }
        // Значения по умолчанию уже установлены
    }

    _saveAchievements() {
        if (!this._state.user) return;
        localStorage.setItem(`ach_${this._state.user.id}`, JSON.stringify(this._state.achievements));
    }

    _loadAchievements() {
        if (!this._state.user) return;
        const saved = localStorage.getItem(`ach_${this._state.user.id}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this._proxy.achievements = parsed;
                return;
            } catch(e) {
                // Игнорируем
            }
        }
        // Инициализируем достижения
        const newAchievements = {};
        for (const key of Object.keys(ACHIEVEMENTS)) {
            newAchievements[key] = false;
        }
        this._proxy.achievements = newAchievements;
        this._saveAchievements();
    }

    _saveQuests() {
        if (!this._state.user) return;
        localStorage.setItem(`quests_${this._state.user.id}`, JSON.stringify(this._state.quests));
    }

    // ============================================================
    //  ОЧИСТКА СОСТОЯНИЯ
    // ============================================================
    
    clearAll() {
        // Очищаем все данные пользователя
        if (this._state.user) {
            const userId = this._state.user.id;
            ['moon_data', 'ach', 'quests', 'bossKills', 'slotLevel', 'levelLocked', 'testMode']
                .forEach(key => localStorage.removeItem(`${key}_${userId}`));
        }
        
        // Сбрасываем состояние
        this._proxy.user = null;
        this._proxy.playerData = null;
        this._proxy.clickCount = 0;
        this._proxy.totalSecondsPlayed = 0;
        this._proxy.currentLevel = 1;
        this._proxy.moonHP = CONSTANTS.BASE_HP;
        this._proxy.maxHP = CONSTANTS.BASE_HP;
        this._proxy.bossKills = 0;
        this._proxy.slotLevel = 1;
        this._proxy.maxSlots = 1;
        this._proxy.levelLocked = false;
        this._proxy.activeMoon = 'normal';
        this._proxy.activeMoons = ['normal'];
        this._proxy.ownedMoons = ['normal'];
        this._proxy.moonLevels = { normal: 1 };
        this._proxy.achievements = {};
        this._proxy.quests = {};
        this._proxy.bossTimerRunning = false;
        this._proxy.isProcessing = false;
        
        // Очищаем интервалы
        if (this._state.bossTimerInterval) {
            clearInterval(this._state.bossTimerInterval);
            this._proxy.bossTimerInterval = null;
        }
        if (this._state.timeUpdateInterval) {
            clearInterval(this._state.timeUpdateInterval);
            this._proxy.timeUpdateInterval = null;
        }
        if (this._state.autoSaveInterval) {
            clearInterval(this._state.autoSaveInterval);
            this._proxy.autoSaveInterval = null;
        }
    }

    // ============================================================
    //  ЗАГРУЗКА ДАННЫХ ИГРОКА
    // ============================================================
    
    loadPlayerData(data) {
        if (!data) return;
        
        this._proxy.playerData = data;
        this._proxy.clickCount = data.total_clicks || 0;
        this._proxy.totalSecondsPlayed = data.total_seconds_played || 0;
        this._proxy.currentLevel = data.level || 1;
        this._proxy.moonHP = data.moon_hp || CONSTANTS.BASE_HP;
        this._proxy.maxHP = getMaxHPForLevel(
            data.level || 1,
            CONSTANTS.BASE_HP,
            CONSTANTS.BOSS_INTERVAL
        );
        
        // Загружаем сохраненные данные
        this._loadMoonData();
        this._loadAchievements();
        this.initQuests();
        
        // Загружаем босс-киллы
        const savedKills = localStorage.getItem(`bossKills_${this._state.user?.id}`);
        if (savedKills) {
            this._proxy.bossKills = parseInt(savedKills) || 0;
        }
        
        // Загружаем уровень слотов
        const savedSlotLevel = localStorage.getItem(`slotLevel_${this._state.user?.id}`);
        if (savedSlotLevel) {
            this._proxy.slotLevel = parseInt(savedSlotLevel) || 1;
        }
        
        // Обновляем максимальное количество слотов
        this._updateMaxSlots();
        
        // Проверяем достижения
        this._checkAchievements();
    }

    _updateMaxSlots() {
        const maxPossible = Math.min(this._state.slotLevel, CONSTANTS.MAX_SLOTS);
        this._proxy.maxSlots = maxPossible;
        if (this._state.activeMoons.length > maxPossible) {
            this._proxy.activeMoons = this._state.activeMoons.slice(0, maxPossible);
            this._saveMoonData();
        }
        return maxPossible;
    }

    // ============================================================
    //  ДОПОЛНИТЕЛЬНЫЕ СЕТТЕРЫ
    // ============================================================
    
    setUser(user) {
        this._proxy.user = user;
        if (user) {
            // Загружаем сохраненные настройки
            const savedLock = localStorage.getItem(`levelLocked_${user.id}`) === 'true';
            this._proxy.levelLocked = savedLock;
            
            const savedTest = localStorage.getItem(`testMode_${user.id}`) === 'true';
            this._proxy.testMode = savedTest;
        }
    }

    setBossKills(value) {
        this._proxy.bossKills = value;
        if (this._state.user) {
            localStorage.setItem(`bossKills_${this._state.user.id}`, String(value));
        }
        this._checkAchievements();
    }

    setSlotLevel(value) {
        const newLevel = Math.min(value, CONSTANTS.MAX_SLOTS);
        this._proxy.slotLevel = newLevel;
        if (this._state.user) {
            localStorage.setItem(`slotLevel_${this._state.user.id}`, String(newLevel));
        }
        this._updateMaxSlots();
        this._checkAchievements();
    }

    setCurrentLevel(value) {
        this._proxy.currentLevel = value;
        this._updateMaxSlots();
        this._checkAchievements();
        this.updateQuestProgress('level', 1);
    }

    setClickCount(value) {
        this._proxy.clickCount = value;
        this._checkAchievements();
        this.updateQuestProgress('click');
    }

    // ============================================================
    //  ОЧИСТКА ДОСТИЖЕНИЙ (ДЛЯ СБРОСА)
    // ============================================================
    
    clearAchievements() {
        const newAchievements = {};
        for (const key of Object.keys(ACHIEVEMENTS)) {
            newAchievements[key] = false;
        }
        this._proxy.achievements = newAchievements;
        this._saveAchievements();
    }
}

// ============================================================
//  ЭКСПОРТ ЕДИНСТВЕННОГО ЭКЗЕМПЛЯРА
// ============================================================
export const appState = new State();

// ============================================================
//  ХЕЛПЕРЫ ДЛЯ УДОБНОГО ИСПОЛЬЗОВАНИЯ
// ============================================================
export const state = appState.state;
export const getState = (key) => appState.get(key);
export const setState = (key, value) => appState.set(key, value);
