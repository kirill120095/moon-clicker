// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
import { BASE_HP, BOSS_TIMER, MOON_TYPES, MOON_SLOT_UNLOCK, ACHIEVEMENTS, QUESTS } from './config.js';

// Основные переменные
export let currentUser = null;
export let playerData = null;
export let clickCount = 0;
export let totalSecondsPlayed = 0;
export let currentLevel = 1;
export let moonHP = BASE_HP;
export let maxHP = BASE_HP;
export let sessionStartTimestamp = null;
export let bossKills = 0;          // для ачивок

// Таймеры
export let timeUpdateInterval = null;
export let autoSaveInterval = null;
export let bossTimer = BOSS_TIMER;
export let bossTimerInterval = null;
export let bossTimerRunning = false;

// Настройки
export let levelLocked = false;
export let testMode = false;

// Луны (активные и владение)
export let activeMoon = 'normal';           // основной активный (для совместимости)
export let activeMoons = ['normal'];        // массив активных лун (несколько слотов)
export let ownedMoons = ['normal'];
export let moonLevels = { normal: 1 };      // уровень прокачки каждой луны (1 - базовый)

// Достижения
export let achievements = {};

// Квесты
export let quests = {};

// Слоты
export let maxSlots = 1;

// ============================================================
//  СЕТТЕРЫ
// ============================================================
export function setUser(user) { currentUser = user; }
export function setPlayerData(data) {
    playerData = data;
    if (data) {
        // загрузка из localStorage уже обработана в инициализации
    }
}
export function setClickCount(value) { clickCount = value; }
export function setTotalSecondsPlayed(value) { totalSecondsPlayed = value; }
export function setCurrentLevel(value) {
    currentLevel = value;
    // обновляем максимальное количество слотов
    updateMaxSlots();
}
export function setMoonHP(value) { moonHP = value; }
export function setMaxHP(value) { maxHP = value; }
export function setSessionStartTimestamp(value) { sessionStartTimestamp = value; }
export function setLevelLocked(value) { levelLocked = value; }
export function setTestMode(value) { testMode = value; }
export function setBossTimerRunning(value) { bossTimerRunning = value; }
export function setBossTimer(value) { bossTimer = value; }
export function setBossTimerInterval(value) { bossTimerInterval = value; }
export function setBossKills(value) { bossKills = value; }

// --- Луны ---
export function setActiveMoon(moonId) {
    activeMoon = moonId;
    // также добавляем в activeMoons если ещё не было (для совместимости)
    if (!activeMoons.includes(moonId)) {
        activeMoons.push(moonId);
    }
    saveMoonData();
}
export function setActiveMoons(moons) {
    activeMoons = moons;
    if (moons.length > 0) {
        activeMoon = moons[0]; // первый как основной
    }
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
export function setMoonLevel(moonId, level) {
    moonLevels[moonId] = level;
    saveMoonData();
}
export function getMoonLevel(moonId) {
    return moonLevels[moonId] || 1;
}

// --- Слоты ---
export function updateMaxSlots() {
    let max = 1;
    for (const [slot, level] of Object.entries(MOON_SLOT_UNLOCK)) {
        if (currentLevel >= level) {
            max = Math.max(max, parseInt(slot));
        }
    }
    maxSlots = max;
    // обрезаем активные луны, если их больше слотов
    if (activeMoons.length > maxSlots) {
        activeMoons = activeMoons.slice(0, maxSlots);
    }
    return maxSlots;
}

// --- Достижения ---
export function loadAchievements() {
    // загружаем из localStorage (или из БД)
    const saved = localStorage.getItem(`ach_${currentUser?.id}`);
    if (saved) {
        try {
            achievements = JSON.parse(saved);
        } catch(e) {}
    } else {
        // инициализируем
        achievements = {};
        for (const key of Object.keys(ACHIEVEMENTS)) {
            achievements[key] = false;
        }
        saveAchievements();
    }
}
export function saveAchievements() {
    if (!currentUser) return;
    localStorage.setItem(`ach_${currentUser.id}`, JSON.stringify(achievements));
}
export function unlockAchievement(id) {
    if (!achievements[id]) {
        achievements[id] = true;
        saveAchievements();
        // даём награду
        const ach = ACHIEVEMENTS[id];
        if (ach && ach.reward) {
            // добавляем осколки
            if (playerData) {
                playerData.shards = (playerData.shards || 0) + ach.reward;
                // сохраняем в БД (можно сразу)
                supabaseClient
                    .from('players')
                    .update({ shards: playerData.shards })
                    .eq('id', currentUser.id)
                    .then(() => {});
                showToast(`🏆 Достижение "${ach.name}"! +${ach.reward} осколков!`, 'success');
            }
        }
    }
}

// --- Квесты ---
export function initQuests() {
    // загружаем квесты из localStorage
    const saved = localStorage.getItem(`quests_${currentUser?.id}`);
    if (saved) {
        try {
            quests = JSON.parse(saved);
        } catch(e) {}
    } else {
        // инициализируем новыми квестами
        resetQuests();
    }
}
export function resetQuests() {
    const newQuests = {};
    for (const [id, q] of Object.entries(QUESTS)) {
        newQuests[id] = {
            progress: 0,
            completed: false,
            ...q
        };
    }
    quests = newQuests;
    saveQuests();
}
export function saveQuests() {
    if (!currentUser) return;
    localStorage.setItem(`quests_${currentUser.id}`, JSON.stringify(quests));
}
export function updateQuestProgress(type, amount = 1) {
    for (const [id, q] of Object.entries(quests)) {
        if (q.completed) continue;
        if (q.type === type) {
            q.progress += amount;
            if (q.progress >= q.target) {
                q.completed = true;
                // награда
                if (playerData) {
                    playerData.shards = (playerData.shards || 0) + q.reward;
                    supabaseClient
                        .from('players')
                        .update({ shards: playerData.shards })
                        .eq('id', currentUser.id)
                        .then(() => {});
                    showToast(`✅ Квест "${q.name}" выполнен! +${q.reward} осколков!`, 'success');
                }
            }
            saveQuests();
        }
    }
}

// --- Сохранение данных о лунах ---
export function saveMoonData() {
    if (!currentUser) return;
    const key = `moon_data_${currentUser.id}`;
    const data = {
        activeMoon,
        activeMoons,
        ownedMoons,
        moonLevels
    };
    localStorage.setItem(key, JSON.stringify(data));
}
export function loadMoonData() {
    if (!currentUser) return;
    const key = `moon_data_${currentUser.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            activeMoon = data.activeMoon || 'normal';
            activeMoons = data.activeMoons || ['normal'];
            ownedMoons = data.ownedMoons || ['normal'];
            moonLevels = data.moonLevels || { normal: 1 };
        } catch(e) {
            // ошибка, устанавливаем по умолчанию
            activeMoon = 'normal';
            activeMoons = ['normal'];
            ownedMoons = ['normal'];
            moonLevels = { normal: 1 };
        }
    } else {
        // инициализация
        activeMoon = 'normal';
        activeMoons = ['normal'];
        ownedMoons = ['normal'];
        moonLevels = { normal: 1 };
        saveMoonData();
    }
    updateMaxSlots();
}
