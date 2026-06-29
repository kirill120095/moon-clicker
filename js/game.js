// ============================================================
//  ИГРОВАЯ ЛОГИКА (ИСПРАВЛЕННОЕ СОХРАНЕНИЕ)
// ============================================================
import { supabaseClient } from './supabase.js';
import {
    currentUser, playerData, clickCount, totalSecondsPlayed,
    currentLevel, moonHP, maxHP, bossTimer, bossTimerInterval, bossTimerRunning,
    levelLocked, testMode,
    setClickCount, setTotalSecondsPlayed, setCurrentLevel,
    setMoonHP, setMaxHP, setSessionStartTimestamp, setPlayerData,
    setBossTimerRunning, setBossTimer, setBossTimerInterval, 
    setLevelLocked, setTestMode
} from './state.js';
import { showToast, formatTime, getMaxHPForLevel, isBossLevel } from './utils.js';
import { updateProfileAndLeaders } from './profile.js';
import { BASE_HP, BOSS_INTERVAL, BOSS_TIMER } from './config.js';
import { applyMoonStyle } from './ui.js';

let moonWrapper, moonInner, clickEffect, counterEl, levelTitle, hpBar, hpPercent,
    timerBarContainer, timerBar, timerPercent, totalTimeDisplay, rollbackBtnMain, lockToggleMain;

export let timeUpdateIntervalRef = null;
export let autoSaveIntervalRef = null;
let saveTimeout = null;

export function initGameElements(elements) {
    moonWrapper = elements.moonWrapper;
    moonInner = elements.moonInner;
    clickEffect = elements.clickEffect;
    counterEl = elements.counterEl;
    levelTitle = elements.levelTitle;
    hpBar = elements.hpBar;
    hpPercent = elements.hpPercent;
    timerBarContainer = elements.timerBarContainer;
    timerBar = elements.timerBar;
    timerPercent = elements.timerPercent;
    totalTimeDisplay = elements.totalTimeDisplay;
    rollbackBtnMain = elements.rollbackBtnMain;
    lockToggleMain = elements.lockToggleMain;
}

export function updateUI() {
    if (!counterEl) return;
    counterEl.textContent = clickCount;
    levelTitle.textContent = `Уровень ${currentLevel}`;

    const currentHP = Math.round(moonHP);
    const maxHPDisplay = Math.round(maxHP);
    hpPercent.textContent = `${currentHP}/${maxHPDisplay}`;

    const hpPercentValue = Math.max(0, (moonHP / maxHP) * 100);
    hpBar.style.width = Math.min(100, hpPercentValue) + '%';

    const scale = Math.max(0.18, Math.min(1.0, moonHP / maxHP));
    if (moonInner) moonInner.style.transform = `scale(${scale})`;

    if (isBossLevel(currentLevel, BOSS_INTERVAL) && moonHP > 0) {
        if (!bossTimerRunning) startBossTimer();
    } else if (bossTimerRunning) {
        clearBossTimer();
    }

    if (currentLevel <= 1) rollbackBtnMain.classList.add('disabled');
    else rollbackBtnMain.classList.remove('disabled');

    updateTimeDisplay();
}

export function updateTimeDisplay() {
    if (totalTimeDisplay) totalTimeDisplay.textContent = formatTime(totalSecondsPlayed);
}

function startBossTimer() {
    if (bossTimerRunning) return;
    if (bossTimerInterval) clearInterval(bossTimerInterval);

    setBossTimer(BOSS_TIMER);
    setBossTimerRunning(true);
    timerBarContainer.classList.add('active');
    hpBar.className = 'bar-fill boss-fill';
    updateTimerBar();

    const interval = setInterval(() => {
        const newTimer = bossTimer - 1;
        setBossTimer(newTimer);
        updateTimerBar();
        if (newTimer <= 0) {
            clearBossTimer();
            setMoonHP(maxHP);
            updateUI();
        }
    }, 1000);
    setBossTimerInterval(interval);
}

function clearBossTimer() {
    if (bossTimerInterval) {
        clearInterval(bossTimerInterval);
        setBossTimerInterval(null);
    }
    setBossTimerRunning(false);
    timerBarContainer.classList.remove('active');
    if (timerBar) timerBar.style.width = '100%';
    if (timerPercent) timerPercent.textContent = '0с';
    hpBar.className = 'bar-fill hp-fill';
}

function updateTimerBar() {
    const percent = Math.max(0, (bossTimer / BOSS_TIMER) * 100);
    if (timerBar) timerBar.style.width = percent + '%';
    if (timerPercent) timerPercent.textContent = `${Math.ceil(bossTimer)}с`;
}

// --- СОХРАНЕНИЕ ПРОГРЕССА (исправлено) ---
export async function updateProgress(playerId, newTotal, clickTimestamp, newLevel, newMoonHP) {
    if (!playerId || !currentUser) return false;

    const updateData = {
        total_clicks: newTotal,
        last_click_at: clickTimestamp,
        total_seconds_played: totalSecondsPlayed || 0,
        level: newLevel,
        moon_hp: Math.round(newMoonHP),
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient
            .from('players')
            .update(updateData)
            .eq('id', playerId);

        if (error) throw error;

        // Обновляем локальные данные
        if (playerData) {
            Object.assign(playerData, updateData);
        }
        return true;
    } catch (err) {
        console.error('Ошибка сохранения прогресса:', err);
        showToast('⚠️ Ошибка сохранения прогресса', 'warning');
        return false;
    }
}

export async function saveTimeOnly() {
    if (!currentUser) return;
    try {
        await supabaseClient.from('players')
            .update({ total_seconds_played: totalSecondsPlayed, updated_at: new Date().toISOString() })
            .eq('id', currentUser.id);
    } catch (e) {
        console.error('Ошибка сохранения времени:', e);
    }
}

export async function resetProgress() {
    if (!currentUser) return;
    try {
        const { error } = await supabaseClient.from('players')
            .update({ total_clicks: 0, total_seconds_played: 0, level: 1, moon_hp: Math.round(BASE_HP), updated_at: new Date().toISOString() })
            .eq('id', currentUser.id);

        if (error) throw error;

        const { data: freshData } = await supabaseClient.from('players').select('*').eq('id', currentUser.id).single();
        if (freshData) {
            setPlayerData(freshData);
            setClickCount(0);
            setTotalSecondsPlayed(0);
            setCurrentLevel(1);
            setMoonHP(BASE_HP);
            setMaxHP(BASE_HP);
        }

        clearBossTimer();
        setLevelLocked(false);
        const lockBtn = document.getElementById('lockToggleMain');
        if (lockBtn) {
            lockBtn.textContent = '🔓';
            lockBtn.classList.remove('locked');
        }
        localStorage.setItem('levelLocked', 'false');
        updateUI();
        showToast('✅ Прогресс сброшен!', 'success');
        document.getElementById('settingsModal')?.classList.remove('active');
        updateProfileAndLeaders();
    } catch (err) {
        console.error(err);
        showToast('⚠️ Ошибка сброса прогресса', 'warning');
    }
}

export async function rollbackLevel() {
    if (currentLevel <= 1) return;
    const newLevel = currentLevel - 1;
    setCurrentLevel(newLevel);
    const newMax = getMaxHPForLevel(newLevel, BASE_HP, BOSS_INTERVAL);
    setMaxHP(newMax);
    setMoonHP(newMax);
    clearBossTimer();
    updateUI();
    const now = new Date().toISOString();
    await updateProgress(currentUser.id, clickCount, now, newLevel, newMax);
    updateProfileAndLeaders();
}

export function initGame() {
    document.getElementById('authBlock').classList.add('hidden');
    document.getElementById('gameArea').classList.add('active');

    const newMax = getMaxHPForLevel(currentLevel, BASE_HP, BOSS_INTERVAL);
    setMaxHP(newMax);
    if (moonHP > newMax) setMoonHP(newMax);
    if (moonHP < 0) setMoonHP(0);

    updateUI();
    setSessionStartTimestamp(Date.now());

    if (timeUpdateIntervalRef) clearInterval(timeUpdateIntervalRef);
    timeUpdateIntervalRef = setInterval(() => {
        setTotalSecondsPlayed(totalSecondsPlayed + 1);
        updateTimeDisplay();
    }, 1000);

    if (autoSaveIntervalRef) clearInterval(autoSaveIntervalRef);
    autoSaveIntervalRef = setInterval(saveTimeOnly, 30000);

    // Безопасная инициализация сохраненного стиля луны из памяти
    const savedMode = localStorage.getItem('moonMode') || 'normal';
    applyMoonStyle(savedMode);

    const savedLock = localStorage.getItem('levelLocked') === 'true';
    setLevelLocked(savedLock);
    const lockToggle = document.getElementById('lockToggleMain');
    if (lockToggle) {
        lockToggle.textContent = savedLock ? '🔒' : '🔓';
        lockToggle.classList.toggle('locked', savedLock);
    }

    const savedTest = localStorage.getItem('testMode') === 'true';
    setTestMode(savedTest);
    const testCheckbox = document.getElementById('testModeCheckbox');
    if (testCheckbox) testCheckbox.checked = savedTest;

    updateProfileAndLeaders();
}

export async function handleClick(e) {
    if (!currentUser || moonHP <= 0) return;

    setClickCount(clickCount + 1);
    if (testMode) setMoonHP(0);
    else setMoonHP(Math.max(0, moonHP - 1));

    const eff = document.getElementById('clickEffect');
    if (eff) {
        eff.classList.remove('active');
        void eff.offsetWidth;
        eff.classList.add('active');
    }
    if (moonWrapper) {
        moonWrapper.style.transform = 'scale(0.92)';
        setTimeout(() => { moonWrapper.style.transform = 'scale(1)'; }, 150);
    }

    if (moonHP === 0) {
        if (levelLocked) {
            setMoonHP(maxHP);
            updateUI();
            return;
        }
        const newLevel = currentLevel + 1;
        setCurrentLevel(newLevel);
        const newMax = getMaxHPForLevel(newLevel, BASE_HP, BOSS_INTERVAL);
        setMaxHP(newMax);
        setMoonHP(newMax);

        if (moonInner) {
            moonInner.classList.add('level-up');
            setTimeout(() => moonInner.classList.remove('level-up'), 800);
        }
        updateUI();
        const now = new Date().toISOString();
        await updateProgress(currentUser.id, clickCount, now, newLevel, moonHP);
        updateProfileAndLeaders();
        return;
    }

    updateUI();
    const now = new Date().toISOString();
    await updateProgress(currentUser.id, clickCount, now, currentLevel, moonHP);
    updateProfileAndLeaders();
}
