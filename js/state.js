// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
import { BASE_HP, BOSS_TIMER } from './config.js';

// Основные переменные
export let currentUser = null;
export let playerData = null;
export let clickCount = 0;
export let totalSecondsPlayed = 0;
export let currentLevel = 1;
export let moonHP = BASE_HP;
export let maxHP = BASE_HP;
export let sessionStartTimestamp = null;

// Таймеры
export let timeUpdateInterval = null;
export let autoSaveInterval = null;
export let bossTimer = BOSS_TIMER;
export let bossTimerInterval = null;
export let bossTimerRunning = false;

// Настройки
export let levelLocked = false;
export let testMode = false;

// Луны (хранятся в localStorage)
export let activeMoon = 'normal';
export let ownedMoons = ['normal'];

// ============================================================
//  СЕТТЕРЫ
// ============================================================
export function setUser(user) { currentUser = user; }
export function setPlayerData(data) { 
    playerData = data;
    // Загружаем луны из localStorage, если пользователь залогинен
    if (currentUser) {
        const key = `moon_data_${currentUser.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                activeMoon = parsed.activeMoon || 'normal';
                ownedMoons = parsed.ownedMoons || ['normal'];
            } catch(e) { /* ignore */ }
        } else {
            // Если нет сохранённых данных, устанавливаем значения по умолчанию и сохраняем
            activeMoon = 'normal';
            ownedMoons = ['normal'];
            saveMoonData();
        }
    }
}
export function setClickCount(value) { clickCount = value; }
export function setTotalSecondsPlayed(value) { totalSecondsPlayed = value; }
export function setCurrentLevel(value) { currentLevel = value; }
export function setMoonHP(value) { moonHP = value; }
export function setMaxHP(value) { maxHP = value; }
export function setSessionStartTimestamp(value) { sessionStartTimestamp = value; }
export function setLevelLocked(value) { levelLocked = value; }
export function setTestMode(value) { testMode = value; }
export function setBossTimerRunning(value) { bossTimerRunning = value; }
export function setBossTimer(value) { bossTimer = value; }
export function setBossTimerInterval(value) { bossTimerInterval = value; }

export function setActiveMoon(moonId) {
    activeMoon = moonId;
    saveMoonData();
}
export function setOwnedMoons(moons) {
    ownedMoons = moons;
    saveMoonData();
}
export function addOwnedMoon(moonId) {
    if (!ownedMoons.includes(moonId)) {
        ownedMoons.push(moonId);
        saveMoonData();
    }
}

function saveMoonData() {
    if (!currentUser) return;
    const key = `moon_data_${currentUser.id}`;
    const data = {
        activeMoon,
        ownedMoons
    };
    localStorage.setItem(key, JSON.stringify(data));
}
