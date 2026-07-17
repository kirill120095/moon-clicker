// ============================================================
//  РЕНДЕРИНГ UI
// ============================================================
import { state, appState } from './state.js';
import { CONSTANTS, MOON_TYPES, ACHIEVEMENTS, QUESTS } from './constants.js';
import { getMaxHPForLevel, getTitle } from './config.js';
import { escapeHTML } from './security.js';
import { uiScheduler } from './performance.js';
import { db } from './supabase.js';

let toastContainer = null;

export function initToastContainer(container) {
    toastContainer = container;
}

export function showToast(message, type = 'info', duration = 2000) {
    if (!toastContainer) {
        console.warn('[UI] Toast container not initialized');
        return;
    }

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

export function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const totalSec = Math.round(seconds);

    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    let parts = [];

    if (days > 0) {
        parts.push(`${days}д`);
        if (hours > 0) parts.push(`${hours}ч`);
    } else if (hours > 0) {
        parts.push(`${hours}ч`);
        if (minutes > 0) parts.push(`${minutes}м`);
    } else if (minutes > 0) {
        parts.push(`${minutes}м`);
        if (secs > 0) parts.push(`${secs}с`);
    } else {
        parts.push(`${secs}с`);
    }

    return parts.join(' ') || '0с';
}

const lockOpenSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const lockClosedSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>`;

export function setLockIcon(btn, locked) {
    if (!btn) return;
    btn.innerHTML = locked ? lockClosedSVG : lockOpenSVG;
    btn.classList.toggle('locked', locked);
}

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

        const level = owned ? (state.moonLevels[id] || 1) : 0;
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

async function _updateLeaders() {
    const leadersList = document.getElementById('leadersList');
    if (!leadersList) return;

    try {
        const leaders = await db.getLeaders(CONSTANTS.LIMITS.MAX_LEADERS || 10);

        if (!leaders || leaders.length === 0) {
            leadersList.innerHTML = '<div class="no-data">Нет данных</div>';
            return;
        }

        let html = '';
        leaders.forEach((p, i) => {
            const isMe = p.username === state.playerData?.username;
            html += `
                <div class="leader-item ${isMe ? 'me' : ''}">
                    <span class="pos">#${i + 1}</span>
                    <span class="name">${escapeHTML(p.username || 'Аноним')}</span>
                    <span class="stats">
                        <span>Ур. ${p.level || 0}</span>
                        <span style="font-size:0.7rem;">кликов: ${p.total_clicks || 0}</span>
                    </span>
                </div>
            `;
        });
        leadersList.innerHTML = html;
    } catch (error) {
        console.error('[UI] Leaders error:', error);
        leadersList.innerHTML = '<div class="no-data">Ошибка загрузки</div>';
    }
}

export function createStars(count = 300) {
    const container = document.getElementById('stars');
    if (!container) return;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 3 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
        star.style.animationDelay = Math.random() * 5 + 's';
        fragment.appendChild(star);
    }

    container.appendChild(fragment);
}

export function updateQuestUI() {
    const container = document.getElementById('questsList');
    if (!container) return;

    const quests = state.quests || {};
    let html = '';

    for (const [id, q] of Object.entries(quests)) {
        const progress = q.progress || 0;
        const target = q.target || 100;
        const percent = Math.min(100, Math.round((progress / target) * 100));

        html += `
            <div class="quest-item ${q.completed ? 'completed' : ''}">
                <span class="quest-name">${escapeHTML(q.name)}</span>
                <span class="quest-desc">${escapeHTML(q.description)}</span>
                <div class="quest-bar">
                    <div class="quest-fill" style="width: ${percent}%;"></div>
                </div>
                <span class="quest-progress">${progress}/${target}</span>
                ${q.completed ? '<span class="quest-done">✅ Выполнено</span>' : ''}
                <span class="quest-reward">+${q.reward} 💎</span>
            </div>
        `;
    }

    container.innerHTML = html || 'Нет активных квестов';
}

export function updateAchievementUI() {
    const container = document.getElementById('achievementsList');
    if (!container) return;

    const achievements = state.achievements || {};
    let html = '';

    for (const [id, ach] of Object.entries(ACHIEVEMENTS || {})) {
        const achieved = achievements[id] || false;
        html += `
            <div class="achievement-item ${achieved ? 'achieved' : ''}">
                <span class="ach-name">${escapeHTML(ach.name)}</span>
                <span class="ach-desc">${escapeHTML(ach.description)}</span>
                <span class="ach-status">${achieved ? '✅' : '🔒'}</span>
                <span class="ach-reward">+${ach.reward} 💎</span>
            </div>
        `;
    }

    container.innerHTML = html || 'Нет достижений';
}

export function updateQuestAndAchievementUI() {
    updateQuestUI();
    updateAchievementUI();
}
