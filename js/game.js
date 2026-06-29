// ============================================================
//  ИГРОВАЯ ЛОГИКА
// ============================================================
import { supabaseClient } from './supabase.js';
import {
    currentUser, playerData, clickCount, totalSecondsPlayed,
    currentLevel, moonHP, maxHP, bossTimer, bossTimerInterval, bossTimerRunning,
    levelLocked, testMode, activeMoon, ownedMoons,
    setClickCount, setTotalSecondsPlayed, setCurrentLevel,
    setMoonHP, setMaxHP, setSessionStartTimestamp, setPlayerData,
    setBossTimerRunning, setBossTimer, setBossTimerInterval, 
    setLevelLocked, setTestMode, setActiveMoon, setOwnedMoons
} from './state.js';
import { showToast, formatTime, getMaxHPForLevel, isBossLevel } from './utils.js';
import { updateProfileAndLeaders } from './profile.js';
import { BASE_HP, BOSS_INTERVAL, BOSS_TIMER, UPGRADE_COSTS, MOON_TYPES } from './config.js';
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
    const shards = playerData?.shards || 0;
    counterEl.textContent = `💎 ${shards}`;
    
    levelTitle.textContent = `Уровень ${currentLevel}`;

    const currentHP = Math.round(moonHP);
    const maxHPDisplay = Math.round(maxHP);
    hpPercent.textContent = `${currentHP}/${maxHPDisplay}`;

    const hpPercentValue = Math.max(0, (moonHP / maxHP) * 100);
    if (hpBar) {
        hpBar.style.width = Math.min(100, hpPercentValue) + '%';
    }

    // Уменьшение луны
    const hpRatio = Math.max(0, Math.min(1, moonHP / maxHP));
    const scale = Math.pow(hpRatio, 0.4) * 0.95 + 0.05;
    if (moonInner) moonInner.style.transform = `scale(${scale})`;

    // Таймер босса
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
    updateShopUI();

    // Применить стиль активной луны
    applyMoonStyle(activeMoon);
}

export function updateTimeDisplay() {
    if (totalTimeDisplay) totalTimeDisplay.textContent = formatTime(totalSecondsPlayed);
}

// --- Обновление магазина ---
export function updateShopUI() {
    // Обновление улучшения клика
    const shopLockMessage = document.getElementById('shopLockMessage');
    const buyBtn = document.getElementById('buyClickDamageBtn');
    const priceEl = document.getElementById('clickDamagePrice');
    const levelEl = document.getElementById('clickDamageLevel');
    if (buyBtn && priceEl && levelEl) {
        const level = currentLevel || 1;
        const isUnlocked = level >= 5;
        if (shopLockMessage) {
            shopLockMessage.textContent = isUnlocked ? '✅ Магазин доступен' : `🔒 Доступно с 5 уровня (сейчас ${level})`;
            shopLockMessage.style.color = isUnlocked ? 'rgba(80, 255, 150, 0.5)' : 'rgba(255, 255, 255, 0.3)';
        }
        const currentLevelUpgrade = playerData?.click_damage_level || 0;
        const cost = Math.floor(UPGRADE_COSTS.clickDamage.base * Math.pow(UPGRADE_COSTS.clickDamage.multiplier, currentLevelUpgrade));
        const currentDamage = playerData?.click_damage || 1;
        const nextDamage = currentDamage + 1;
        priceEl.textContent = `${cost} 💎`;
        levelEl.textContent = `Ур. ${currentLevelUpgrade} (${currentDamage}→${nextDamage})`;
        const hasEnoughShards = (playerData?.shards || 0) >= cost;
        buyBtn.disabled = !isUnlocked || !hasEnoughShards || currentLevelUpgrade >= 10;
        buyBtn.textContent = currentLevelUpgrade >= 10 ? 'MAX' : 'Купить';
        buyBtn.classList.toggle('locked', !isUnlocked);
    }

    // Обновление магазина лун
    const moonShopContainer = document.getElementById('moonShopItems');
    if (moonShopContainer) {
        let html = '';
        for (const [id, moon] of Object.entries(MOON_TYPES)) {
            const owned = ownedMoons.includes(id);
            const active = (activeMoon === id);
            const canBuy = !owned && (playerData?.shards || 0) >= moon.cost && moon.cost > 0;
            html += `
                <div class="shop-item moon-item" data-moon-id="${id}">
                    <div class="shop-item-info">
                        <span class="shop-item-name">${moon.emoji} ${moon.name}</span>
                        <span class="shop-item-desc">${moon.cost === 0 ? 'Начальная' : `Цена: ${moon.cost} 💎`}</span>
                        <span class="shop-item-desc">Бонус: урон +${Math.round(moon.damageBonus*100)}%, осколки +${Math.round(moon.shardBonus*100)}%</span>
                    </div>
                    <div class="shop-item-right">
                        ${owned ? (active ? '<span style="color:#4ecdc4;">✅ Активна</span>' : `<button class="shop-buy-btn select-moon-btn" data-moon-id="${id}">Выбрать</button>`) 
                        : (moon.cost === 0 ? '<span style="color:#4ecdc4;">Доступна</span>' : 
                           `<button class="shop-buy-btn buy-moon-btn" data-moon-id="${id}" ${!canBuy ? 'disabled' : ''}>${canBuy ? 'Купить' : 'Не хватает'}</button>`)}
                    </div>
                </div>
            `;
        }
        moonShopContainer.innerHTML = html;

        // Добавляем обработчики для кнопок покупки и выбора
        document.querySelectorAll('.buy-moon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moonId = btn.dataset.moonId;
                buyMoon(moonId);
            });
        });
        document.querySelectorAll('.select-moon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moonId = btn.dataset.moonId;
                selectMoon(moonId);
            });
        });
    }
}

// --- Покупка и выбор луны ---
export async function buyMoon(moonId) {
    if (!currentUser || !playerData) {
        showToast('⚠️ Войдите в аккаунт', 'warning');
        return;
    }
    const moon = MOON_TYPES[moonId];
    if (!moon) return;
    if (ownedMoons.includes(moonId)) {
        showToast('⚠️ У вас уже есть эта луна', 'warning');
        return;
    }
    if ((playerData.shards || 0) < moon.cost) {
        showToast(`⚠️ Недостаточно осколков! Нужно ${moon.cost}`, 'warning');
        return;
    }

    const newShards = (playerData.shards || 0) - moon.cost;
    const newOwned = [...ownedMoons, moonId];
    const newActive = moonId;

    const { error } = await supabaseClient
        .from('players')
        .update({
            shards: newShards,
            owned_moons: JSON.stringify(newOwned),
            active_moon: newActive,
            updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

    if (error) {
        console.error('Ошибка покупки луны:', error);
        showToast('⚠️ Ошибка при покупке', 'warning');
        return;
    }

    // Обновляем локальное состояние
    playerData.shards = newShards;
    playerData.owned_moons = JSON.stringify(newOwned);
    playerData.active_moon = newActive;
    setOwnedMoons(newOwned);
    setActiveMoon(newActive);

    updateUI();
    updateShopUI();
    updateProfileAndLeaders(true);
    showToast(`✅ Куплена луна "${moon.name}"!`, 'success');
}

export async function selectMoon(moonId) {
    if (!currentUser || !playerData) {
        showToast('⚠️ Войдите в аккаунт', 'warning');
        return;
    }
    if (!ownedMoons.includes(moonId)) {
        showToast('⚠️ У вас нет этой луны', 'warning');
        return;
    }
    if (activeMoon === moonId) {
        showToast('⚠️ Эта луна уже активна', 'info');
        return;
    }

    const { error } = await supabaseClient
        .from('players')
        .update({
            active_moon: moonId,
            updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

    if (error) {
        console.error('Ошибка выбора луны:', error);
        showToast('⚠️ Ошибка при выборе', 'warning');
        return;
    }

    setActiveMoon(moonId);
    updateUI();
    updateShopUI();
    updateProfileAndLeaders(true);
    showToast(`✅ Активна луна "${MOON_TYPES[moonId].name}"`, 'success');
}

// --- Таймер босса ---
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

// --- Сохранение ---
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
        const { error } = await supabaseClient.from('players').update(updateData).eq('id', playerId);
        if (error) throw error;
        if (playerData) Object.assign(playerData, updateData);
        return true;
    } catch (err) {
        console.error('Ошибка сохранения:', err);
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
                total_clicks: 0, total_seconds_played: 0, level: 1, 
                moon_hp: Math.round(BASE_HP), shards: 0,
                click_damage: 1, click_damage_level: 0,
                owned_moons: JSON.stringify(['normal']),
                active_moon: 'normal',
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
            setActiveMoon('normal');
            setOwnedMoons(['normal']);
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

    // Применить стиль активной луны
    applyMoonStyle(activeMoon);

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

    // Урон с учетом бонуса от луны
    const baseDamage = playerData?.click_damage || 1;
    const moonBonus = MOON_TYPES[activeMoon]?.damageBonus || 0;
    const damage = baseDamage * (1 + moonBonus);

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
        
        const isBoss = isBossLevel(currentLevel, BOSS_INTERVAL);
        // Пересчет наград
        let shardReward = Math.floor(currentLevel / 5) + 1; // обычный уровень
        if (isBoss) {
            shardReward = Math.floor(currentLevel / 10) * 3 + 5; // босс
        }
        // Применяем бонус от луны на осколки
        const shardBonus = MOON_TYPES[activeMoon]?.shardBonus || 0;
        shardReward = Math.floor(shardReward * (1 + shardBonus));

        const currentShards = (playerData?.shards || 0) + shardReward;
        
        showToast(`💎 +${shardReward} лунных осколков!`, 'success', 2000);
        
        await supabaseClient.from('players')
            .update({ shards: currentShards, updated_at: new Date().toISOString() })
            .eq('id', currentUser.id);
        if (playerData) playerData.shards = currentShards;
        updateUI();
        updateShopUI();
        
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
