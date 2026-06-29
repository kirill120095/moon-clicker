// ============================================================
//  ИГРОВАЯ ЛОГИКА (С DEBOUNCE + НАГРАДЫ)
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
import { BASE_HP, BOSS_INTERVAL, BOSS_TIMER, UPGRADE_COSTS } from './config.js';
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
    // Теперь счетчик показывает осколки, а не клики
    const shards = playerData?.shards || 0;
    counterEl.textContent = `💎 ${shards}`;
    
    levelTitle.textContent = `Уровень ${currentLevel}`;

    const currentHP = Math.round(moonHP);
    const maxHPDisplay = Math.round(maxHP);
    hpPercent.textContent = `${currentHP}/${maxHPDisplay}`;

    const hpPercentValue = Math.max(0, (moonHP / maxHP) * 100);
    hpBar.style.width = Math.min(100, hpPercentValue) + '%';

    // --- УМЕНЬШЕНИЕ ЛУНЫ (степенная) ---
    const hpRatio = Math.max(0, Math.min(1, moonHP / maxHP));
    const scale = Math.pow(hpRatio, 0.4) * 0.95 + 0.05;
    if (moonInner) {
        moonInner.style.transform = `scale(${scale})`;
    }

    // --- ТАЙМЕР БОССА ---
    if (isBossLevel(currentLevel, BOSS_INTERVAL) && moonHP > 0) {
        if (!bossTimerRunning) startBossTimer();
        if (timerBarContainer) timerBarContainer.classList.add('active');
        if (hpBar) hpBar.className = 'bar-fill boss-fill';
    } else {
        if (bossTimerRunning) clearBossTimer();
        if (timerBarContainer) timerBarContainer.classList.remove('active');
        if (hpBar) hpBar.className = 'bar-fill hp-fill';
        if (timerBar) timerBar.style.width = '100%';
        if (timerPercent) timerPercent.textContent = '30с';
    }

    if (currentLevel <= 1) rollbackBtnMain.classList.add('disabled');
    else rollbackBtnMain.classList.remove('disabled');

    updateTimeDisplay();
    
    // Обновляем магазин
    updateShopUI();
}

export function updateTimeDisplay() {
    if (totalTimeDisplay) totalTimeDisplay.textContent = formatTime(totalSecondsPlayed);
}

// --- Обновление магазина ---
export function updateShopUI() {
    const shopLockMessage = document.getElementById('shopLockMessage');
    const buyBtn = document.getElementById('buyClickDamageBtn');
    const priceEl = document.getElementById('clickDamagePrice');
    const levelEl = document.getElementById('clickDamageLevel');
    
    if (!buyBtn || !priceEl || !levelEl) return;
    
    const level = currentLevel || 1;
    const isUnlocked = level >= 5;
    
    // Обновляем сообщение о разблокировке
    if (shopLockMessage) {
        if (isUnlocked) {
            shopLockMessage.textContent = '✅ Магазин доступен';
            shopLockMessage.style.color = 'rgba(80, 255, 150, 0.5)';
        } else {
            shopLockMessage.textContent = `🔒 Доступно с 5 уровня (сейчас ${level})`;
            shopLockMessage.style.color = 'rgba(255, 255, 255, 0.3)';
        }
    }
    
    // Стоимость следующего улучшения
    const currentLevelUpgrade = playerData?.click_damage_level || 0;
    const cost = Math.floor(UPGRADE_COSTS.clickDamage.base * Math.pow(UPGRADE_COSTS.clickDamage.multiplier, currentLevelUpgrade));
    const currentDamage = playerData?.click_damage || 1;
    const nextDamage = currentDamage + 1;
    
    priceEl.textContent = `${cost} 💎`;
    levelEl.textContent = `Ур. ${currentLevelUpgrade} (${currentDamage}→${nextDamage})`;
    
    // Доступность кнопки
    const hasEnoughShards = (playerData?.shards || 0) >= cost;
    buyBtn.disabled = !isUnlocked || !hasEnoughShards || currentLevelUpgrade >= 10;
    buyBtn.textContent = currentLevelUpgrade >= 10 ? 'MAX' : 'Купить';
    
    if (!isUnlocked) {
        buyBtn.classList.add('locked');
    } else {
        buyBtn.classList.remove('locked');
    }
}

// --- Покупка улучшения ---
export async function buyClickDamage() {
    if (!currentUser || !playerData) {
        showToast('⚠️ Войдите в аккаунт', 'warning');
        return;
    }
    
    const level = currentLevel || 1;
    if (level < 5) {
        showToast('🔒 Магазин доступен с 5 уровня', 'warning');
        return;
    }
    
    const currentLevelUpgrade = playerData.click_damage_level || 0;
    if (currentLevelUpgrade >= 10) {
        showToast('⚠️ Максимальный уровень улучшения', 'warning');
        return;
    }
    
    const cost = Math.floor(UPGRADE_COSTS.clickDamage.base * Math.pow(UPGRADE_COSTS.clickDamage.multiplier, currentLevelUpgrade));
    
    if ((playerData.shards || 0) < cost) {
        showToast(`⚠️ Недостаточно осколков! Нужно ${cost}`, 'warning');
        return;
    }
    
    // Списываем осколки и повышаем уровень
    const newShards = (playerData.shards || 0) - cost;
    const newLevel = currentLevelUpgrade + 1;
    const newDamage = playerData.click_damage + 1;
    
    const { error } = await supabaseClient
        .from('players')
        .update({
            shards: newShards,
            click_damage: newDamage,
            click_damage_level: newLevel,
            updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    
    if (error) {
        console.error('Ошибка покупки:', error);
        showToast('⚠️ Ошибка при покупке', 'warning');
        return;
    }
    
    // Обновляем локальные данные
    playerData.shards = newShards;
    playerData.click_damage = newDamage;
    playerData.click_damage_level = newLevel;
    
    updateUI();
    updateShopUI();
    showToast(`✅ Улучшение куплено! Урон: ${newDamage}`, 'success');
}

function startBossTimer() {
    if (bossTimerRunning) return;
    if (bossTimerInterval) clearInterval(bossTimerInterval);

    setBossTimer(BOSS_TIMER);
    setBossTimerRunning(true);
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
    if (timerBarContainer) timerBarContainer.classList.remove('active');
    if (timerBar) timerBar.style.width = '100%';
    if (timerPercent) timerPercent.textContent = '0с';
    if (hpBar) hpBar.className = 'bar-fill hp-fill';
}

function updateTimerBar() {
    const percent = Math.max(0, (bossTimer / BOSS_TIMER) * 100);
    if (timerBar) timerBar.style.width = percent + '%';
    if (timerPercent) timerPercent.textContent = `${Math.ceil(bossTimer)}с`;
}

// --- DEBOUNCE для сохранения прогресса ---
export function debouncedUpdateProgress(playerId, newTotal, clickTimestamp, newLevel, newMoonHP) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await updateProgress(playerId, newTotal, clickTimestamp, newLevel, newMoonHP);
    }, 300);
}

// --- СОХРАНЕНИЕ ПРОГРЕССА ---
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
            .update({ 
                total_clicks: 0, 
                total_seconds_played: 0, 
                level: 1, 
                moon_hp: Math.round(BASE_HP),
                shards: 0,
                click_damage: 1,
                click_damage_level: 0,
                updated_at: new Date().toISOString()
            })
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
            const { setLockIcon } = await import('./ui.js');
            setLockIcon(lockBtn, false);
        }
        localStorage.setItem('levelLocked', 'false');
        updateUI();
        showToast('✅ Прогресс сброшен!', 'success');
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

    const savedMode = localStorage.getItem('moonMode') || 'normal';
    applyMoonStyle(savedMode);

    const savedLock = localStorage.getItem('levelLocked') === 'true';
    setLevelLocked(savedLock);
    const lockToggle = document.getElementById('lockToggleMain');
    if (lockToggle) {
        import('./ui.js').then(module => {
            module.setLockIcon(lockToggle, savedLock);
        });
    }

    const savedTest = localStorage.getItem('testMode') === 'true';
    setTestMode(savedTest);
    const testCheckbox = document.getElementById('testModeCheckbox');
    if (testCheckbox) testCheckbox.checked = savedTest;

    updateProfileAndLeaders();
    updateShopUI();
}

export async function handleClick(e) {
    if (!currentUser || moonHP <= 0) return;

    // --- Урон с учётом улучшения ---
    const damage = playerData?.click_damage || 1;
    
    setClickCount(clickCount + 1);
    if (testMode) {
        setMoonHP(0);
    } else {
        setMoonHP(Math.max(0, moonHP - damage));
    }

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
        
        // --- ПОБЕДА! Рассчитываем награду ---
        const isBoss = isBossLevel(currentLevel, BOSS_INTERVAL);
        let shardReward = Math.floor(currentLevel / 10) + 1;
        if (isBoss) {
            shardReward = Math.floor(currentLevel / 10) * 10 * 5;
        }
        const multiplier = playerData?.shard_multiplier || 1;
        shardReward = Math.floor(shardReward * multiplier);
        
        const currentShards = (playerData?.shards || 0) + shardReward;
        
        // Показываем уведомление о награде
        showToast(`💎 +${shardReward} лунных осколков!`, 'success', 2000);
        
        // Сохраняем осколки
        const { error: updateError } = await supabaseClient
            .from('players')
            .update({
                shards: currentShards,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        
        if (!updateError && playerData) {
            playerData.shards = currentShards;
        }
        updateUI();
        updateShopUI();
        
        // --- ПЕРЕХОД НА СЛЕДУЮЩИЙ УРОВЕНЬ ---
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
        updateShopUI();
        return;
    }

    updateUI();
    const now = new Date().toISOString();
    await updateProgress(currentUser.id, clickCount, now, currentLevel, moonHP);
    updateProfileAndLeaders();
}
