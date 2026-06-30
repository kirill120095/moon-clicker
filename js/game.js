// ============================================================
//  ИГРОВАЯ ЛОГИКА
// ============================================================
import { supabaseClient } from './supabase.js';
import {
    currentUser, playerData, clickCount, totalSecondsPlayed,
    currentLevel, moonHP, maxHP, bossTimer, bossTimerInterval, bossTimerRunning,
    levelLocked, testMode, activeMoon, activeMoons, ownedMoons, moonLevels,
    bossKills, maxSlots,
    setClickCount, setTotalSecondsPlayed, setCurrentLevel,
    setMoonHP, setMaxHP, setSessionStartTimestamp, setPlayerData,
    setBossTimerRunning, setBossTimer, setBossTimerInterval, 
    setLevelLocked, setTestMode, setActiveMoon, setActiveMoons,
    setOwnedMoons, addOwnedMoon, setMoonLevel, getMoonLevel,
    setBossKills, updateMaxSlots,
    achievements, unlockAchievement,
    quests, updateQuestProgress, initQuests, resetQuests,
    loadAchievements, saveAchievements,
    loadMoonData, saveMoonData
} from './state.js';
import { showToast, formatTime, getMaxHPForLevel, isBossLevel } from './utils.js';
import { updateProfileAndLeaders } from './profile.js';
import {
    BASE_HP, BOSS_INTERVAL, BOSS_TIMER, UPGRADE_COSTS,
    MOON_TYPES, getMoonUpgradeCost, SYNERGY_BONUSES, ACHIEVEMENTS, QUESTS
} from './config.js';
import { applyMoonStyle } from './ui.js';

let moonWrapper, moonInner, clickEffect, counterEl, levelTitle, hpBar, hpPercent,
    timerBarContainer, timerBar, timerPercent, totalTimeDisplay, rollbackBtnMain, lockToggleMain;

export let timeUpdateIntervalRef = null;
export let autoSaveIntervalRef = null;
let saveTimeout = null;

// Глобальные бонусы
let totalDamageBonus = 0;
let totalShardBonus = 0;

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

    const hpRatio = Math.max(0, Math.min(1, moonHP / maxHP));
    const scale = Math.pow(hpRatio, 0.4) * 0.95 + 0.05;
    if (moonInner) moonInner.style.transform = `scale(${scale})`;

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
    recalcMoonBonuses();
    applyMoonStyle(activeMoon);
}

export function recalcMoonBonuses() {
    totalDamageBonus = 0;
    totalShardBonus = 0;
    const activeIds = activeMoons;

    activeIds.forEach(id => {
        const moon = MOON_TYPES[id];
        if (moon) {
            const level = getMoonLevel(id);
            const levelMultiplier = 1 + (level - 1) * 0.05;
            totalDamageBonus += (moon.damageBonus || 0) * levelMultiplier;
            totalShardBonus += (moon.shardBonus || 0) * levelMultiplier;
        }
    });

    const comboKeys = Object.keys(SYNERGY_BONUSES);
    comboKeys.forEach(key => {
        const moons = key.split('+');
        if (moons.every(m => activeIds.includes(m))) {
            const bonus = SYNERGY_BONUSES[key];
            totalDamageBonus += bonus.damageBonus || 0;
            totalShardBonus += bonus.shardBonus || 0;
        }
    });

    if (activeIds.includes('normal') && activeIds.length > 1) {
        totalDamageBonus += 0.05;
        totalShardBonus += 0.05;
    }

    window._totalDamageBonus = totalDamageBonus;
    window._totalShardBonus = totalShardBonus;
}

export function updateTimeDisplay() {
    if (totalTimeDisplay) totalTimeDisplay.textContent = formatTime(totalSecondsPlayed);
}

export function updateShopUI() {
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
        const currentTotalBonus = `+${(currentDamage - 1)} урона`;
        const nextTotalBonus = `+${(nextDamage - 1)} урона`;
        priceEl.textContent = `${cost} 💎`;
        levelEl.innerHTML = `Ур. ${currentLevelUpgrade} (${currentTotalBonus} → ${nextTotalBonus})`;
        const hasEnoughShards = (playerData?.shards || 0) >= cost;
        buyBtn.disabled = !isUnlocked || !hasEnoughShards || currentLevelUpgrade >= 10;
        buyBtn.textContent = currentLevelUpgrade >= 10 ? 'MAX' : 'Купить';
        buyBtn.classList.toggle('locked', !isUnlocked);
    }

    const moonShopContainer = document.getElementById('moonShopItems');
    if (moonShopContainer) {
        let html = '';
        for (const [id, moon] of Object.entries(MOON_TYPES)) {
            const owned = ownedMoons.includes(id);
            const active = (activeMoon === id);
            const canBuy = !owned && (playerData?.shards || 0) >= moon.cost && moon.cost > 0 && currentLevel >= (moon.unlockLevel || 1);
            const isLockedByLevel = currentLevel < (moon.unlockLevel || 1);

            let bonusDesc = [];
            if (moon.damageBonus > 0) bonusDesc.push(`урон +${Math.round(moon.damageBonus*100)}%`);
            if (moon.shardBonus > 0) bonusDesc.push(`осколки +${Math.round(moon.shardBonus*100)}%`);
            const bonusText = bonusDesc.length ? `Бонус: ${bonusDesc.join(', ')}` : 'Без бонусов';

            const level = owned ? getMoonLevel(id) : 0;
            const upgradeCost = owned ? getMoonUpgradeCost(id, level) : 0;
            const canUpgrade = owned && currentLevel >= 10 && level < 10 && (playerData?.shards || 0) >= upgradeCost;

            html += `
                <div class="shop-item moon-item" data-moon-id="${id}">
                    <div class="shop-item-info">
                        <span class="shop-item-name">${moon.emoji} ${moon.name}</span>
                        <span class="shop-item-desc">${moon.cost === 0 ? 'Начальная' : `Цена: ${moon.cost} 💎`}</span>
                        <span class="shop-item-desc">${bonusText}</span>
                        ${owned ? `<span class="shop-item-desc">Уровень: ${level} / 10</span>` : ''}
                        ${isLockedByLevel ? `<span class="shop-item-desc" style="color: #ff6b6b;">Открывается с ${moon.unlockLevel} уровня</span>` : ''}
                    </div>
                    <div class="shop-item-right">
                        ${owned ? (active ? '<span style="color:#4ecdc4;">Активна</span>' : `<button class="shop-buy-btn select-moon-btn" data-moon-id="${id}">Выбрать</button>`)
                        : (moon.cost === 0 ? '<span style="color:#4ecdc4;">Доступна</span>' :
                           (isLockedByLevel ? `<span style="color:#ff6b6b;">🔒</span>` :
                           `<button class="shop-buy-btn buy-moon-btn" data-moon-id="${id}" ${!canBuy ? 'disabled' : ''}>${canBuy ? 'Купить' : 'Не хватает'}</button>`))}
                        ${owned && level < 10 ? `<button class="shop-buy-btn upgrade-moon-btn" data-moon-id="${id}" ${!canUpgrade ? 'disabled' : ''}>${canUpgrade ? `Улучшить (${upgradeCost} 💎)` : 'MAX'}</button>` : ''}
                    </div>
                </div>
            `;
        }
        moonShopContainer.innerHTML = html;

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
        document.querySelectorAll('.upgrade-moon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moonId = btn.dataset.moonId;
                upgradeMoon(moonId);
            });
        });
    }
}

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
    if (currentLevel < (moon.unlockLevel || 1)) {
        showToast(`🔒 Доступна с ${moon.unlockLevel} уровня`, 'warning');
        return;
    }
    if ((playerData.shards || 0) < moon.cost) {
        showToast(`⚠️ Недостаточно осколков! Нужно ${moon.cost}`, 'warning');
        return;
    }

    const newShards = (playerData.shards || 0) - moon.cost;
    const { error } = await supabaseClient
        .from('players')
        .update({
            shards: newShards,
            updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

    if (error) {
        console.error('Ошибка покупки луны:', error);
        showToast('⚠️ Ошибка при покупке', 'warning');
        return;
    }

    playerData.shards = newShards;
    addOwnedMoon(moonId);
    setActiveMoon(moonId);

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

    setActiveMoon(moonId);
    updateUI();
    updateShopUI();
    updateProfileAndLeaders(true);
    showToast(`✅ Активна луна "${MOON_TYPES[moonId].name}"`, 'success');
}

export async function upgradeMoon(moonId) {
    if (!currentUser || !playerData) {
        showToast('⚠️ Войдите в аккаунт', 'warning');
        return;
    }
    if (!ownedMoons.includes(moonId)) {
        showToast('⚠️ У вас нет этой луны', 'warning');
        return;
    }
    if (currentLevel < 10) {
        showToast('🔒 Прокачка лун доступна с 10 уровня', 'warning');
        return;
    }
    const currentLevelMoon = getMoonLevel(moonId);
    if (currentLevelMoon >= 10) {
        showToast('⚠️ Максимальный уровень луны (10)', 'warning');
        return;
    }
    const cost = getMoonUpgradeCost(moonId, currentLevelMoon);
    if ((playerData.shards || 0) < cost) {
        showToast(`⚠️ Нужно ${cost} осколков`, 'warning');
        return;
    }
    const newShards = playerData.shards - cost;
    const { error } = await supabaseClient
        .from('players')
        .update({ shards: newShards })
        .eq('id', currentUser.id);
    if (error) {
        showToast('⚠️ Ошибка прокачки', 'warning');
        return;
    }
    playerData.shards = newShards;
    setMoonLevel(moonId, currentLevelMoon + 1);
    updateUI();
    updateShopUI();
    updateProfileAndLeaders(true);
    showToast(`✅ Луна "${MOON_TYPES[moonId].name}" улучшена до ${currentLevelMoon + 1} уровня!`, 'success');
}

export function toggleMoon(moonId) {
    if (!ownedMoons.includes(moonId)) {
        showToast('⚠️ У вас нет этой луны', 'warning');
        return;
    }
    const index = activeMoons.indexOf(moonId);
    if (index !== -1) {
        if (activeMoons.length > 1) {
            activeMoons.splice(index, 1);
        } else {
            showToast('⚠️ Нельзя деактивировать последнюю луну', 'warning');
            return;
        }
    } else {
        if (activeMoons.length < maxSlots) {
            activeMoons.push(moonId);
        } else {
            showToast(`⚠️ Достигнут лимит активных лун (макс. ${maxSlots})`, 'warning');
            return;
        }
    }
    setActiveMoons(activeMoons);
    updateUI();
    updateShopUI();
    updateProfileAndLeaders(true);
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
            setMoonLevel('normal', 1);
            setBossKills(0);
            resetQuests();
            achievements = {};
            saveAchievements();
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

    loadMoonData();
    loadAchievements();
    initQuests();

    updateUI();
    setSessionStartTimestamp(Date.now());

    if (timeUpdateIntervalRef) clearInterval(timeUpdateIntervalRef);
    timeUpdateIntervalRef = setInterval(() => {
        setTotalSecondsPlayed(totalSecondsPlayed + 1);
        updateTimeDisplay();
    }, 1000);

    if (autoSaveIntervalRef) clearInterval(autoSaveIntervalRef);
    autoSaveIntervalRef = setInterval(saveTimeOnly, 30000);

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

    const baseDamage = playerData?.click_damage || 1;
    const bonus = window._totalDamageBonus || 0;
    const damage = baseDamage * (1 + bonus);

    setClickCount(clickCount + 1);
    updateQuestProgress('click');

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
            if (!testMode) {
                setMoonHP(maxHP);
                updateUI();
            }
            return;
        }

        const isBoss = isBossLevel(currentLevel, BOSS_INTERVAL);
        let shardReward = Math.floor(currentLevel / 5) + 1;
        if (isBoss) {
            shardReward = Math.floor(currentLevel / 10) * 3 + 5;
            setBossKills(bossKills + 1);
            updateQuestProgress('bossKill');
        }
        const shardBonus = window._totalShardBonus || 0;
        shardReward = Math.floor(shardReward * (1 + shardBonus));

        const currentShards = (playerData?.shards || 0) + shardReward;
        updateQuestProgress('shard', shardReward);

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

    playerData.shards = newShards;
    playerData.click_damage = newDamage;
    playerData.click_damage_level = newLevel;

    updateUI();
    updateShopUI();
    showToast(`✅ Улучшение куплено! Урон: ${newDamage}`, 'success');
}
