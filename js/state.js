// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
import { BASE_HP, BOSS_TIMER, MOON_TYPES, ACHIEVEMENTS, QUESTS, MAX_SLOTS } from './config.js';
import { supabaseClient } from './supabase.js';
import { showToast } from './utils.js';

// Основные переменные
export let currentUser = null;
export let playerData = null;
export let clickCount = 0;
export let totalSecondsPlayed = 0;
export let currentLevel = 1;
export let moonHP = BASE_HP;
export let maxHP = BASE_HP;
export let sessionStartTimestamp = null;
export let bossKills = 0;
export let slotLevel = 1; // 1 = 1 слот, 2 = 2 слота, 3 = 3 слота

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
export let activeMoon = 'normal';
export let activeMoons = ['normal'];
export let ownedMoons = ['normal'];
export let moonLevels = { normal: 1 };

// Достижения и квесты
export let achievements = {};
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
        loadMoonData();
        loadAchievements();
        initQuests();
        const savedKills = localStorage.getItem(`bossKills_${currentUser?.id}`);
        if (savedKills) setBossKills(parseInt(savedKills) || 0);
        const savedSlotLevel = localStorage.getItem(`slotLevel_${currentUser?.id}`);
        if (savedSlotLevel) {
            slotLevel = parseInt(savedSlotLevel) || 1;
            updateMaxSlots();
        }
    }
}
export function setClickCount(value) {
    clickCount = value;
    if (clickCount >= 10000) unlockAchievement('clickMaster');
}
export function setTotalSecondsPlayed(value) { totalSecondsPlayed = value; }
export function setCurrentLevel(value) {
    currentLevel = value;
    updateMaxSlots();
    if (currentLevel >= 20) unlockAchievement('level20');
    updateQuestProgress('level', 1);
}
export function setMoonHP(value) { moonHP = value; }
export function setMaxHP(value) { maxHP = value; }
export function setSessionStartTimestamp(value) { sessionStartTimestamp = value; }
export function setLevelLocked(value) { levelLocked = value; }
export function setTestMode(value) { testMode = value; }
export function setBossTimerRunning(value) { bossTimerRunning = value; }
export function setBossTimer(value) { bossTimer = value; }
export function setBossTimerInterval(value) { bossTimerInterval = value; }
export function setBossKills(value) {
    bossKills = value;
    if (currentUser) {
        localStorage.setItem(`bossKills_${currentUser.id}`, String(value));
    }
    if (bossKills >= 10) unlockAchievement('bossSlayer');
}
export function setSlotLevel(value) {
    slotLevel = Math.min(value, MAX_SLOTS);
    if (currentUser) {
        localStorage.setItem(`slotLevel_${currentUser.id}`, String(slotLevel));
    }
    updateMaxSlots();
    if (maxSlots >= 3) unlockAchievement('slotMaster');
    updateQuestProgress('slot', 1);
}

// --- Луны ---
export function setActiveMoon(moonId) {
    activeMoon = moonId;
    if (!activeMoons.includes(moonId)) {
        activeMoons.push(moonId);
    }
    saveMoonData();
}
export function setActiveMoons(moons) {
    activeMoons = moons;
    if (moons.length > 0) {
        activeMoon = moons[0];
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
        if (ownedMoons.length > 1) unlockAchievement('firstMoon');
        if (ownedMoons.length >= Object.keys(MOON_TYPES).length) unlockAchievement('moonCollector');
    }
}
export function setMoonLevel(moonId, level) {
    moonLevels[moonId] = level;
    saveMoonData();
    if (level >= 5) unlockAchievement('moonUpgrader');
    if (level >= 10) unlockAchievement('maxMoon');
}
export function getMoonLevel(moonId) {
    return moonLevels[moonId] || 1;
}

// --- Слоты ---
export function updateMaxSlots() {
    const maxPossible = Math.min(slotLevel, MAX_SLOTS);
    maxSlots = maxPossible;
    if (activeMoons.length > maxSlots) {
        activeMoons = activeMoons.slice(0, maxSlots);
        saveMoonData();
    }
    return maxSlots;
}

// --- Достижения ---
export function loadAchievements() {
    const saved = localStorage.getItem(`ach_${currentUser?.id}`);
    if (saved) {
        try {
            achievements = JSON.parse(saved);
            let needSave = false;
            for (const key of Object.keys(ACHIEVEMENTS)) {
                if (!(key in achievements)) {
                    achievements[key] = false;
                    needSave = true;
                }
            }
            if (needSave) saveAchievements();
        } catch(e) {
            achievements = {};
            for (const key of Object.keys(ACHIEVEMENTS)) {
                achievements[key] = false;
            }
            saveAchievements();
        }
    } else {
        achievements = {};
        for (const key of Object.keys(ACHIEVEMENTS)) {
            achievements[key] = false;
        }
        saveAchievements();
    }
    checkAllAchievements();
}
export function saveAchievements() {
    if (!currentUser) return;
    localStorage.setItem(`ach_${currentUser.id}`, JSON.stringify(achievements));
}
export function unlockAchievement(id) {
    if (!achievements[id]) {
        achievements[id] = true;
        saveAchievements();
        const ach = ACHIEVEMENTS[id];
        if (ach && ach.reward) {
            if (playerData) {
                playerData.shards = (playerData.shards || 0) + ach.reward;
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
export function checkAllAchievements() {
    for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
        if (!achievements[id] && ach.check({ ownedMoons, currentLevel, bossKills, clickCount, moonLevels, maxSlots })) {
            unlockAchievement(id);
        }
    }
}

// --- Квесты ---
export function initQuests() {
    const saved = localStorage.getItem(`quests_${currentUser?.id}`);
    if (saved) {
        try {
            quests = JSON.parse(saved);
            let needSave = false;
            for (const [id, q] of Object.entries(QUESTS)) {
                if (!quests[id]) {
                    quests[id] = { progress: 0, completed: false, ...q };
                    needSave = true;
                }
            }
            if (needSave) saveQuests();
        } catch(e) {
            resetQuests();
        }
    } else {
        resetQuests();
    }
}
export function resetQuests() {
    const newQuests = {};
    for (const [id, q] of Object.entries(QUESTS)) {
        newQuests[id] = { progress: 0, completed: false, ...q };
    }
    quests = newQuests;
    saveQuests();
}
export function saveQuests() {
    if (!currentUser) return;
    localStorage.setItem(`quests_${currentUser.id}`, JSON.stringify(quests));
}
export function updateQuestProgress(type, amount = 1) {
    if (!quests) return;
    let anyCompleted = false;
    for (const [id, q] of Object.entries(quests)) {
        if (q.completed) continue;
        if (q.type === type) {
            q.progress += amount;
            if (q.progress >= q.target) {
                q.completed = true;
                if (playerData) {
                    playerData.shards = (playerData.shards || 0) + q.reward;
                    supabaseClient
                        .from('players')
                        .update({ shards: playerData.shards })
                        .eq('id', currentUser.id)
                        .then(() => {});
                    showToast(`✅ Квест "${q.name}" выполнен! +${q.reward} осколков!`, 'success');
                }
                anyCompleted = true;
            }
        }
    }
    if (anyCompleted) saveQuests();
}

// --- Сохранение и загрузка данных о лунах ---
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
            activeMoon = 'normal';
            activeMoons = ['normal'];
            ownedMoons = ['normal'];
            moonLevels = { normal: 1 };
        }
    } else {
        activeMoon = 'normal';
        activeMoons = ['normal'];
        ownedMoons = ['normal'];
        moonLevels = { normal: 1 };
        saveMoonData();
    }
    updateMaxSlots();
}
