// ============================================================
//  РЕНДЕРИНГ UI
// ============================================================
import { state } from '../../core/state.js';
import { CONSTANTS, MOON_TYPES } from '../../core/constants.js';
import { getTitle, getMaxHPForLevel } from '../../core/config.js';
import { escapeHTML } from '../../utils/security.js';
import { uiScheduler } from '../../utils/performance.js';

// ============================================================
//  TOAST СИСТЕМА
// ============================================================
let toastContainer = null;

export function initToastContainer(container) {
    toastContainer = container;
}

export function showToast(message, type = 'info', duration = 2000) {
    if (!toastContainer) {
        console.warn('[UI] Toast container not initialized');
        return;
    }

    // Очищаем контейнер
    toastContainer.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

// ============================================================
//  ОСНОВНОЙ РЕНДЕРИНГ
// ============================================================
export function updateUI() {
    uiScheduler.schedule(() => {
        _updateCounter();
        _updateLevelTitle();
        _updateHPBar();
        _updateTimerBar();
        _updateRollbackButton();
        _updateMoonStyle();
    });
}

function _updateCounter() {
    const counter = document.getElementById('counter');
    if (!counter) return;
    const shards = state.playerData?.shards || 0;
    counter.textContent = `💎 ${shards}`;
}

function _updateLevelTitle() {
    const title = document.getElementById('levelTitle');
    if (!title) return;
    title.textContent = `Уровень ${state.currentLevel}`;
}

function _updateHPBar() {
    const hpBar = document.getElementById('hpBar');
    const hpPercent = document.getElementById('hpPercent');
    const moonInner = document.getElementById('moonInner');
    
    if (hpBar) {
        const percent = Math.max(0, (state.moonHP / state.maxHP) * 100);
        hpBar.style.width = Math.min(100, percent) + '%';
    }
    
    if (hpPercent) {
        hpPercent.textContent = `${Math.round(state.moonHP)}/${Math.round(state.maxHP)}`;
    }
    
    if (moonInner) {
        const ratio = Math.max(0, Math.min(1, state.moonHP / state.maxHP));
        const scale = Math.pow(ratio, 0.4) * 0.95 + 0.05;
        moonInner.style.transform = `scale(${scale})`;
    }
}

function _updateTimerBar() {
    const container = document.getElementById('timerBarContainer');
    const bar = document.getElementById('timerBar');
    const percent = document.getElementById('timerPercent');
    
    if (!container || !bar || !percent) return;

    const isBoss = state.currentLevel % CONSTANTS.BOSS_INTERVAL === 0;
    const isActive = isBoss && state.moonHP > 0 && state.bossTimerRunning;

    if (isActive) {
        container.classList.add('active');
        const pct = Math.max(0, (state.bossTimer / CONSTANTS.BOSS_TIMER) * 100);
        bar.style.width = pct + '%';
        percent.textContent = `${Math.ceil(state.bossTimer)}с`;
    } else {
        container.classList.remove('active');
        bar.style.width = '100%';
        percent.textContent = '30с';
    }
}

function _updateRollbackButton() {
    const btn = document.getElementById('rollbackBtnMain');
    if (!btn) return;
    if (state.currentLevel <= 1) {
        btn.classList.add('disabled');
    } else {
        btn.classList.remove('disabled');
    }
}

function _updateMoonStyle() {
    const moonInner = document.getElementById('moonInner');
    const container = document.getElementById('app');
    if (!moonInner || !container) return;

    const moon = MOON_TYPES[state.activeMoon];
    if (!moon) return;

    moonInner.style.backgroundImage = moon.gradient;
    moonInner.style.boxShadow = moon.shadow;

    // Обновляем тему контейнера
    container.classList.remove(
        'moon-theme-normal', 'moon-theme-blood', 'moon-theme-ice',
        'moon-theme-shadow', 'moon-theme-gold', 'moon-theme-fire',
        'moon-theme-electric'
    );
    container.classList.add(`moon-theme-${state.activeMoon}`);

    if (state.activeMoon === 'blood') {
        container.classList.add('blood-mode');
    } else {
        container.classList.remove('blood-mode');
    }
}

// ============================================================
//  МАГАЗИН
// ============================================================
export function updateShopUI() {
    uiScheduler.schedule(() => {
        _updateClickDamageShop();
        _updateSlotShop();
        _updateMoonShop();
    });
}

function _updateClickDamageShop() {
    const buyBtn = document.getElementById('buyClickDamageBtn');
    const priceEl = document.getElementById('clickDamagePrice');
    const levelEl = document.getElementById('clickDamageLevel');
    const lockMsg = document.getElementById('shopLockMessage');
    
    if (!buyBtn || !priceEl || !levelEl) return;

    const level = state.currentLevel || 1;
    const isUnlocked = level >= 5;
    
    if (lockMsg) {
        lockMsg.textContent = isUnlocked ? '✅ Магазин доступен' : `🔒 Доступно с 5 уровня (сейчас ${level})`;
        lockMsg.style.color = isUnlocked ? 'rgba(80, 255, 150, 0.5)' : 'rgba(255, 255, 255, 0.3)';
    }

    const currentLevelUpgrade = state.playerData?.click_damage_level || 0;
    const cost = Math.floor(
        CONSTANTS.UPGRADE_COSTS.clickDamage.base *
        Math.pow(CONSTANTS.UPGRADE_COSTS.clickDamage.multiplier, currentLevelUpgrade)
    );
    const currentDamage = state.playerData?.click_damage || 1;
    const nextDamage = currentDamage + 1;
    const displayCost = state.testMode ? 0 : cost;
    
    priceEl.textContent = `${displayCost} 💎`;
    levelEl.innerHTML = `Ур. ${currentLevelUpgrade}: ${currentDamage} → ${nextDamage}`;
    
    const hasEnoughShards = state.testMode || (state.playerData?.shards || 0) >= cost;
    buyBtn.disabled = !isUnlocked || !hasEnoughShards || currentLevelUpgrade >= 10;
    buyBtn.textContent = currentLevelUpgrade >= 10 ? 'MAX' : 'Купить';
    buyBtn.classList.toggle('locked', !isUnlocked);
}

function _updateSlotShop() {
    const buyBtn = document.getElementById('buySlotBtn');
    const priceEl = document.getElementById('slotPrice');
    const levelEl = document.getElementById('slotLevel');
    
    if (!buyBtn || !priceEl || !levelEl) return;

    const currentSlots = state.maxSlots;
    const canUpgrade = currentSlots < CONSTANTS.MAX_SLOTS;
    const cost = canUpgrade ? Math.floor(
        CONSTANTS.UPGRADE_COSTS.moonSlots.base *
        Math.pow(CONSTANTS.UPGRADE_COSTS.moonSlots.multiplier, currentSlots - 1)
    ) : 0;
    const displayCost = state.testMode ? 0 : cost;
    
    priceEl.textContent = canUpgrade ? `${displayCost} 💎` : 'MAX';
    levelEl.textContent = `Слотов: ${currentSlots}/${CONSTANTS.MAX_SLOTS}`;
    
    const hasEnoughShards = state.testMode || (state.playerData?.shards || 0) >= cost;
    buyBtn.disabled = !canUpgrade || !hasEnoughShards;
    buyBtn.textContent = canUpgrade ? 'Купить' : 'MAX';
}

function _updateMoonShop() {
    const container = document.getElementById('moonShopItems');
    if (!container) return;

    let html = '';
    for (const [id, moon] of Object.entries(MOON_TYPES)) {
        const owned = state.ownedMoons.includes(id);
        const active = (state.activeMoon === id);
        const isLockedByLevel = state.currentLevel < (moon.unlockLevel || 1);
        const canBuy = !owned && !isLockedByLevel && 
            (state.testMode || (state.playerData?.shards || 0) >= moon.cost) && 
            moon.cost > 0;

        const level = owned ? appState.getMoonLevel(id) : 0;
        const damageBonus = (moon.damageBonus || 0) * (1 + (level - 1) * 0.05);
        const shardBonus = (moon.shardBonus || 0) * (1 + (level - 1) * 0.05);
        
        let bonusDesc = [];
        if (damageBonus > 0) bonusDesc.push(`урон +${Math.round(damageBonus * 100)}%`);
        if (shardBonus > 0) bonusDesc.push(`осколки +${Math.round(shardBonus * 100)}%`);
        const bonusText = bonusDesc.length ? `Бонус: ${bonusDesc.join(', ')}` : 'Без бонусов';

        const upgradeCost = owned ? Math.floor(Math.max(100, moon.cost * 0.1) * Math.pow(1.5, level - 1)) : 0;
        const displayUpgradeCost = state.testMode ? 0 : upgradeCost;
        const canUpgrade = owned && state.currentLevel >= 10 && level < 10 && 
            (state.testMode || (state.playerData?.shards || 0) >= upgradeCost);

        const displayCost = state.testMode ? 0 : moon.cost;

        html += `
            <div class="shop-item moon-item" data-moon-id="${id}">
                <div class="shop-item-info">
                    <span class="shop-item-name">${moon.emoji} ${escapeHTML(moon.name)}</span>
                    <span class="shop-item-desc">${moon.cost === 0 ? 'Начальная' : `Цена: ${displayCost} 💎`}</span>
                    <span class="shop-item-desc">${bonusText}</span>
                    ${owned ? `<span class="shop-item-desc">Уровень: ${level} / 10</span>` : ''}
                    ${isLockedByLevel ? `<span class="shop-item-desc" style="color: #ff6b6b;">Открывается с ${moon.unlockLevel} уровня</span>` : ''}
                </div>
                <div class="shop-item-right">
                    ${owned ? (active ? '<span style="color:#4ecdc4;">Активна</span>' : 
                        `<button class="shop-buy-btn select-moon-btn" data-moon-id="${id}">Выбрать</button>`)
                    : (moon.cost === 0 ? '<span style="color:#4ecdc4;">Доступна</span>' :
                        (isLockedByLevel ? `<span style="color:#ff6b6b;">🔒</span>` :
                        `<button class="shop-buy-btn buy-moon-btn" data-moon-id="${id}" ${!canBuy ? 'disabled' : ''}>${canBuy ? 'Купить' : 'Не хватает'}</button>`))}
                    ${owned && level < 10 ? 
                        `<button class="shop-buy-btn upgrade-moon-btn" data-moon-id="${id}" ${!canUpgrade ? 'disabled' : ''}>
                            ${canUpgrade ? `Улучшить (${displayUpgradeCost} 💎)` : 'MAX'}
                        </button>` : ''}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ============================================================
//  ПРОФИЛЬ И ЛИДЕРЫ
// ============================================================
export function updateProfileAndLeaders() {
    uiScheduler.schedule(() => {
        _updateProfile();
        _updateLeaders();
    });
}

function _updateProfile() {
    const profileContent = document.getElementById('profileContent');
    if (!profileContent || !state.user || !state.playerData) return;

    const data = state.playerData;
    const title = getTitle(data.level || 1);
    const timePlayed = data.total_seconds_played || 0;

    profileContent.innerHTML = `
        <div class="profile-account">
            <p>👤 <strong>${escapeHTML(state.user.user_metadata?.username || 'Игрок')}</strong></p>
            <p>📧 <strong>${escapeHTML(state.user.email || '-')}</strong></p>
        </div>
        <div class="profile-section-title">📊 Статистика</div>
        <div class="profile-row"><span class="label">Звание</span><span class="value" style="color:#d4af37; font-weight:bold;">${title}</span></div>
        <div class="profile-row"><span class="label">Текущий уровень</span><span class="value">${data.level || 1}</span></div>
        <div class="profile-row"><span class="label">Всего кликов</span><span class="value">${data.total_clicks || 0}</span></div>
        <div class="profile-row"><span class="label">Лунных осколков</span><span class="value" style="color:#ffd700;">${data.shards || 0} 💎</span></div>
        <div class="profile-row"><span class="label">Убито боссов</span><span class="value">${state.bossKills || 0}</span></div>
        <div class="profile-row"><span class="label">Активных слотов</span><span class="value">${state.activeMoons.length} / ${state.maxSlots}</span></div>
    `;
}

function _updateLeaders() {
    // Лидеры обновляются через отдельный вызов
}
