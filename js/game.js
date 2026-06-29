// ============================================================
//  ИГРОВАЯ ЛОГИКА
// ============================================================
import { supabaseClient } from './supabase.js';
import {
    currentUser, playerData, clickCount, totalSecondsPlayed,
    currentLevel, moonHP, maxHP, sessionStartTimestamp,
    timeUpdateInterval, autoSaveInterval,
    bossTimer, bossTimerInterval, bossTimerRunning,
    levelLocked, testMode,
    setClickCount, setTotalSecondsPlayed, setCurrentLevel,
    setMoonHP, setMaxHP, setSessionStartTimestamp,
    setBossTimerRunning, setBossTimer, setBossTimerInterval
} from './state.js';
import { showToast, formatTime, getMaxHPForLevel, isBossLevel } from './utils.js';
import { updateProfileAndLeaders } from './profile.js';
import { updateUI as updateUIView } from './ui.js';
import { BASE_HP, BOSS_INTERVAL, BOSS_TIMER } from './config.js';

// --- DOM-элементы (будут инициализированы в ui.js) ---
let moonWrapper, moonInner, clickEffect, counterEl, levelTitle, hpBar, hpPercent,
    timerBarContainer, timerBar, timerPercent, totalTimeDisplay, rollbackBtnMain, lockToggleMain;

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

// ============================================================
//  ОСНОВНАЯ ЛОГИКА
// ============================================================
export function updateUI() {
    if (!counterEl) return;
    counterEl.textContent = clickCount;
    levelTitle.textContent = `Уровень ${currentLevel}`;

    const currentHP = Math.round(moonHP);
    const maxHPDisplay = Math.round(maxHP);
    hpPercent.textContent = `${currentHP}/${maxHPDisplay}`;

    const hpPercentValue = Math.max(0, (moonHP / maxHP) * 100);
    hpBar.style.width = Math.min(100, hpPercentValue) + '%';

    const scale = Math.max(0.05, moonHP / maxHP);
    moonInner.style.transform = `scale(${scale})`;

    // Босс-таймер
    if (isBossLevel(currentLevel, BOSS_INTERVAL) && moonHP > 0) {
        if (!bossTimerRunning) {
            startBossTimer();
        }
    } else {
        if (bossTimerRunning) {
            clearBossTimer();
        }
        timerBarContainer.classList.remove('active');
        hpBar.className = 'bar-fill hp-fill';
    }

    // Активность кнопки отката
    if (currentLevel <= 1) {
        rollbackBtnMain.classList.add('disabled');
    } else {
        rollbackBtnMain.classList.remove('disabled');
    }

    updateTimeDisplay();
}

export function updateTimeDisplay() {
    if (totalTimeDisplay) {
        totalTimeDisplay.textContent = formatTime(totalSecondsPlayed);
    }
}

// --- Босс-таймер ---
function startBossTimer() {
    if (bossTimerRunning) return;
    if (bossTimerInterval) {
        clearInterval(bossTimerInterval);
        setBossTimerInterval(null);
    }
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
            const now = new Date().toISOString();
            updateProgress(currentUser.id, clickCount, now, currentLevel, moonHP);
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
    timerBar.style.width = '100%';
    timerPercent.textContent = '0с';
    hpBar.className = 'bar-fill hp-fill';
}

function updateTimerBar() {
    const percent = Math.max(0, (bossTimer / BOSS_TIMER) * 100);
    timerBar.style.width = percent + '%';
    timerPercent.textContent = `${Math.ceil(bossTimer)}с`;
}

// --- Сохранение прогресса ---
export async function updateProgress(playerId, newTotal, clickTimestamp, newLevel, newMoonHP) {
    if (!playerId || !currentUser) {
        console.warn('updateProgress: нет playerId или currentUser');
        return false;
    }

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

        if (error) {
            console.error('Ошибка обновления прогресса:', error);
            showToast('⚠️ Ошибка сохранения прогресса', 'warning');
            return false;
        }

        // Обновляем локальный playerData
        if (playerData) {
            playerData.total_clicks = newTotal;
            playerData.total_seconds_played = totalSecondsPlayed;
            playerData.level = newLevel;
            playerData.moon_hp = Math.round(newMoonHP);
            playerData.last_click_at = clickTimestamp;
            playerData.updated_at = new Date().toISOString();
        }
        return true;
    } catch (err) {
        console.error('Исключение в updateProgress:', err);
        showToast('⚠️ Ошибка сохранения прогресса', 'warning');
        return false;
    }
}

export async function saveTimeOnly() {
    if (!currentUser || !playerData) return;
    const { error } = await supabaseClient
        .from('players')
        .update({
            total_seconds_played: totalSecondsPlayed || 0,
            updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    if (error) console.error('Ошибка сохранения времени:', error);
}

// --- Сброс прогресса ---
export async function resetProgress() {
    if (!currentUser || !playerData) {
        showToast('⚠️ Данные игрока не загружены', 'warning');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('players')
            .update({
                total_clicks: 0,
                total_seconds_played: 0,
                level: 1,
                moon_hp: Math.round(BASE_HP),
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (error) {
            console.error('Ошибка сброса прогресса:', error);
            showToast('⚠️ Ошибка при сбросе прогресса', 'warning');
            return;
        }

        // Перезагружаем данные из БД
        const { data: freshData } = await supabaseClient
            .from('players')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        if (freshData) {
            Object.assign(playerData, freshData);
            setClickCount(freshData.total_clicks || 0);
            setTotalSecondsPlayed(freshData.total_seconds_played || 0);
            setCurrentLevel(freshData.level || 1);
            setMoonHP(freshData.moon_hp || BASE_HP);
            setMaxHP(getMaxHPForLevel(freshData.level || 1, BASE_HP, BOSS_INTERVAL));
        } else {
            // fallback
            setClickCount(0);
            setTotalSecondsPlayed(0);
            setCurrentLevel(1);
            setMoonHP(BASE_HP);
            setMaxHP(BASE_HP);
            if (playerData) {
                playerData.total_clicks = 0;
                playerData.total_seconds_played = 0;
                playerData.level = 1;
                playerData.moon_hp = Math.round(BASE_HP);
            }
        }

        clearBossTimer();
        setLevelLocked(false);
        document.getElementById('lockToggleMain').textContent = '🔓';
        document.getElementById('lockToggleMain').classList.remove('locked');
        localStorage.setItem('levelLocked', 'false');
        updateUI();
        showToast('✅ Прогресс успешно сброшен!', 'success');
        document.getElementById('settingsModal').classList.remove('active');
        if (currentUser) updateProfileAndLeaders();
    } catch (err) {
        console.error('Исключение при сбросе:', err);
        showToast('⚠️ Ошибка при сбросе прогресса', 'warning');
    }
}

// --- Откат уровня ---
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
    if (currentUser) updateProfileAndLeaders();
}

// --- Инициализация игры (запускается после входа) ---
export function initGame() {
    const authBlock = document.getElementById('authBlock');
    const gameArea = document.getElementById('gameArea');
    if (authBlock) authBlock.classList.add('hidden');
    if (gameArea) gameArea.classList.add('active');

    // Рассчитываем maxHP
    const newMax = getMaxHPForLevel(currentLevel, BASE_HP, BOSS_INTERVAL);
    setMaxHP(newMax);
    if (moonHP > newMax) setMoonHP(newMax);
    if (moonHP < 0) setMoonHP(0);

    // Обновляем UI
    updateUI();

    // Запускаем таймеры
    setSessionStartTimestamp(Date.now());
    if (timeUpdateInterval) clearInterval(timeUpdateInterval);
    timeUpdateInterval = setInterval(() => {
        setTotalSecondsPlayed(totalSecondsPlayed + 1);
        updateTimeDisplay();
    }, 1000);

    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(saveTimeOnly, 30000);

    // Загружаем настройки из localStorage
    const savedMode = localStorage.getItem('moonMode') || 'normal';
    setMoonMode(savedMode);
    const savedLock = localStorage.getItem('levelLocked') === 'true';
    setLevelLocked(savedLock);
    const lockToggle = document.getElementById('lockToggleMain');
    if (lockToggle) {
        lockToggle.textContent = savedLock ? '🔒' : '🔓';
        if (savedLock) lockToggle.classList.add('locked');
        else lockToggle.classList.remove('locked');
    }
    const savedTestMode = localStorage.getItem('testMode') === 'true';
    setTestMode(savedTestMode);
    const testCheckbox = document.getElementById('testModeCheckbox');
    if (testCheckbox) testCheckbox.checked = savedTestMode;

    // Обновляем профиль и лидеров
    if (currentUser) updateProfileAndLeaders();
}

// --- Обработчик клика по луне ---
export async function handleClick(e) {
    if (!currentUser) {
        showToast('⚠️ Войдите в аккаунт', 'warning');
        return;
    }
    if (moonHP <= 0) return;

    // Увеличиваем счётчик
    setClickCount(clickCount + 1);

    // Уменьшаем HP
    if (testMode) {
        setMoonHP(0);
    } else {
        setMoonHP(Math.max(0, moonHP - 1));
    }

    // Эффект клика
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

    // Если луна убита
    if (moonHP === 0) {
        if (levelLocked) {
            setMoonHP(maxHP);
            updateUI();
            const now = new Date().toISOString();
            await updateProgress(currentUser.id, clickCount, now, currentLevel, moonHP);
            return;
        }

        // Переход на следующий уровень
        const newLevel = currentLevel + 1;
        setCurrentLevel(newLevel);
        const newMax = getMaxHPForLevel(newLevel, BASE_HP, BOSS_INTERVAL);
        setMaxHP(newMax);
        setMoonHP(newMax);
        // Анимация появления
        if (moonInner) {
            moonInner.classList.remove('level-up');
            void moonInner.offsetWidth;
            moonInner.classList.add('level-up');
            setTimeout(() => {
                moonInner.classList.remove('level-up');
                const scale2 = Math.max(0.05, moonHP / newMax);
                moonInner.style.transform = `scale(${scale2})`;
            }, 800);
        }
        updateUI();
        const now = new Date().toISOString();
        await updateProgress(currentUser.id, clickCount, now, newLevel, moonHP);
        if (currentUser) updateProfileAndLeaders();
        return;
    }

    // Обычный клик
    updateUI();

    // Сохраняем прогресс
    const rect = moonWrapper ? moonWrapper.getBoundingClientRect() : { left: 0, top: 0 };
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = new Date().toISOString();
    await updateProgress(currentUser.id, clickCount, now, currentLevel, moonHP);
    if (currentUser) updateProfileAndLeaders();
}

// --- Установка фона луны ---
function setMoonMode(mode) {
    const container = document.getElementById('app');
    if (mode === 'blood') {
        container.classList.add('blood-mode');
        if (moonInner) {
            moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #ff4444, #cc0000)';
        }
    } else {
        container.classList.remove('blood-mode');
        if (moonInner) {
            moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #f0e6d0, #d4af37)';
        }
    }
    localStorage.setItem('moonMode', mode);
    document.querySelectorAll('.bg-options button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-bg') === mode) {
            btn.classList.add('active');
        }
    });
}
