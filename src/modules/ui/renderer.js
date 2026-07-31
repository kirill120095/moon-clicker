// ============================================================
// РЕНДЕРИНГ UI - ОБНОВЛЁННАЯ СИСТЕМА ЛУН И ПРОКАЧКИ
// ============================================================
import { state, appState } from '../../core/state.js';
import { 
  CONSTANTS, MOON_TYPES, ACHIEVEMENTS, QUESTS, 
  QUEST_CATEGORIES, ACHIEVEMENT_CATEGORIES, 
  SYNERGY_BONUSES, RARITY_CONFIG,
  getMoonMechanicParams, getMoonUpgradeCostForLevel
} from '../../core/constants.js';
import { getMaxHPForLevel, getTitle } from '../../core/config.js';
import { escapeHTML } from '../../utils/security.js';
import { uiScheduler } from '../../utils/performance.js';
import { db } from '../network/supabase.js';

let toastContainer = null;
let currentQuestCategory = 'all';
let currentAchievementCategory = 'all';

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
      if (toast.parentNode) toast.remove();
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
  if (days > 0) { parts.push(`${days}д`); if (hours > 0) parts.push(`${hours}ч`); }
  else if (hours > 0) { parts.push(`${hours}ч`); if (minutes > 0) parts.push(`${minutes}м`); }
  else if (minutes > 0) { parts.push(`${minutes}м`); if (secs > 0) parts.push(`${secs}с`); }
  else { parts.push(`${secs}с`); }
  return parts.join(' ') || '0с';
}

export function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  num = Math.floor(num);
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 10000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString('ru-RU');
}

const lockOpenSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const lockClosedSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>`;

export function setLockIcon(btn, locked) {
  if (!btn) return;
  btn.innerHTML = locked ? lockClosedSVG : lockOpenSVG;
  btn.classList.toggle('locked', locked);
}

// ============================================================
// ОСНОВНОЕ ОБНОВЛЕНИЕ UI
// ============================================================
export function updateUI() {
  uiScheduler.schedule(() => {
    _updateCounter();
    _updateLevelTitle();
    _updateLevelControls();
    _updateHPBar();
    updateTimerBar();
    _updateMoonStyle();
    _updateMoonAuras();
    if (typeof window.updateBuffsDisplay === 'function') {
      window.updateBuffsDisplay();
    }
  });
}

function _updateCounter() {
  const counter = document.getElementById('counter');
  if (!counter) return;
  const shards = state.playerData?.shards || 0;
  counter.textContent = `💎 ${formatNumber(shards)}`;
}

function _updateLevelTitle() {
  const title = document.getElementById('levelTitle');
  if (!title) return;
  title.textContent = `Уровень ${state.currentLevel}`;
}

// ============================================================
// НОВОЕ: ОБНОВЛЕНИЕ КНОПОК УПРАВЛЕНИЯ УРОВНЕМ
// ============================================================
function _updateLevelControls() {
  const rollbackBtn = document.getElementById('rollbackLevelBtn');
  const lockBtn = document.getElementById('lockLevelBtn');
  
  if (rollbackBtn) {
    // Скрываем кнопку отката на 1 уровне
    if (state.currentLevel <= 1) {
      rollbackBtn.classList.add('hidden');
    } else {
      rollbackBtn.classList.remove('hidden');
    }
  }
  
  if (lockBtn) {
    const isLocked = state.levelLocked || false;
    lockBtn.classList.toggle('locked', isLocked);
    
    // Меняем иконку
    const iconOpen = lockBtn.querySelector('#lockIconOpen');
    const iconClosed = lockBtn.querySelector('#lockIconClosed');
    if (iconOpen && iconClosed) {
      iconOpen.style.display = isLocked ? 'none' : 'block';
      iconClosed.style.display = isLocked ? 'block' : 'none';
    }
    
    lockBtn.title = isLocked ? 'Открепить уровень' : 'Закрепить уровень';
  }
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

// ============================================================
// ТАЙМЕР БОССА (ЭКСПОРТИРУЕМЫЙ)
// ============================================================
export function updateTimerBar() {
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
    percent.textContent = `${CONSTANTS.BOSS_TIMER}с`;
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
    'moon-theme-electric', 'moon-theme-cosmic'
  );
  container.classList.add(`moon-theme-${state.activeMoon}`);

  if (state.activeMoon === 'blood') {
    container.classList.add('blood-mode');
  } else {
    container.classList.remove('blood-mode');
  }
}

function _updateMoonAuras() {
  const moonContainer = document.getElementById('moonContainer');
  if (!moonContainer) return;
  
  const auraClasses = [
    'aura-normal', 'aura-blood', 'aura-ice', 'aura-shadow',
    'aura-fire', 'aura-electric', 'aura-gold', 'aura-cosmic',
    'has-synergy-aura', 'has-multi-aura'
  ];
  auraClasses.forEach(cls => moonContainer.classList.remove(cls));
  
  const synergies = window._activeSynergies || [];
  if (synergies.length === 0) return;
  
  const allAuraClasses = new Set();
  synergies.forEach(syn => {
    if (syn.auraCombo && Array.isArray(syn.auraCombo)) {
      syn.auraCombo.forEach(aura => allAuraClasses.add(aura));
    }
  });
  
  allAuraClasses.forEach(auraClass => moonContainer.classList.add(auraClass));
  
  if (allAuraClasses.size > 0) {
    moonContainer.classList.add('has-synergy-aura');
    if (allAuraClasses.size > 1) {
      moonContainer.classList.add('has-multi-aura');
    }
  }
}

// ============================================================
// ОБНОВЛЕНИЕ МАГАЗИНА
// ============================================================
export function updateShopUI() {
  uiScheduler.schedule(() => {
    _updateClickDamageShop();
    _updateSlotShop();
    _updateMoonShop();
    _updateSynergiesDisplay();
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
  const currentDamage = state.playerData?.click_damage || CONSTANTS.DEFAULTS.CLICK_DAMAGE;
  const upgradeValue = CONSTANTS.CLICK_DAMAGE_UPGRADE_VALUE;
  const nextDamage = currentDamage + upgradeValue;
  const displayCost = state.testMode ? 0 : cost;

  priceEl.textContent = `${formatNumber(displayCost)} 💎`;
  levelEl.innerHTML = `Ур. ${currentLevelUpgrade}: ${currentDamage} → ${nextDamage} <span style="color: #4caf50; font-size: 0.75rem;">(+${upgradeValue})</span>`;

  const hasEnoughShards = state.testMode || (state.playerData?.shards || 0) >= cost;
  buyBtn.disabled = !isUnlocked || !hasEnoughShards || currentLevelUpgrade >= CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL;
  buyBtn.textContent = currentLevelUpgrade >= CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL ? 'MAX' : 'Купить';
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

  priceEl.textContent = canUpgrade ? `${formatNumber(displayCost)} 💎` : 'MAX';
  levelEl.textContent = `Слотов: ${currentSlots}/${CONSTANTS.MAX_SLOTS}`;

  const hasEnoughShards = state.testMode || (state.playerData?.shards || 0) >= cost;
  buyBtn.disabled = !canUpgrade || !hasEnoughShards;
  buyBtn.textContent = canUpgrade ? 'Купить' : 'MAX';
}

// ============================================================
// НОВЫЙ РЕНДЕР МАГАЗИНА ЛУН (с милестоунами)
// ============================================================
function _updateMoonShop() {
  const container = document.getElementById('moonShopItems');
  if (!container) return;

  let html = '';
  
  for (const [id, moon] of Object.entries(MOON_TYPES)) {
    const owned = state.ownedMoons.includes(id);
    const isActive = state.activeMoons.includes(id);
    const isLockedByLevel = state.currentLevel < (moon.unlockLevel || 1);
    const moonLevel = owned ? (state.moonLevels[id] || 1) : 0;
    
    const canBuy = !owned && !isLockedByLevel &&
      (state.testMode || (state.playerData?.shards || 0) >= moon.cost) &&
      moon.cost > 0;
    
    // Актуальные параметры с учётом прокачки
    const currentParams = owned ? getMoonMechanicParams(id, moonLevel) : null;
    const nextParams = owned && moonLevel < CONSTANTS.LIMITS.MAX_MOON_LEVEL 
      ? getMoonMechanicParams(id, moonLevel + 1) 
      : null;
    
    // Применяем уровень к базовым статам (+8% за уровень, но у нас +1% для обычной и т.д. - используем просто levelMultiplier)
    const levelMultiplier = owned ? (1 + (moonLevel - 1) * 0.05) : 1;
    
    // Рендер базовых параметров
    const baseStatsHtml = `
      <div class="moon-shop-base-stats">
        ${moon.baseStats.damageBonus > 0 ? `<div class="moon-shop-stat">⚔️ +${Math.round(moon.baseStats.damageBonus * levelMultiplier * 100)}%</div>` : ''}
        ${moon.baseStats.shardBonus > 0 ? `<div class="moon-shop-stat">💎 +${Math.round(moon.baseStats.shardBonus * levelMultiplier * 100)}%</div>` : ''}
        ${moon.baseStats.critChanceBonus > 0 ? `<div class="moon-shop-stat">🎯 +${Math.round(moon.baseStats.critChanceBonus * levelMultiplier * 100)}%</div>` : ''}
        ${moon.baseStats.critDamageBonus > 0 ? `<div class="moon-shop-stat">💥 +${Math.round(moon.baseStats.critDamageBonus * levelMultiplier * 100)}%</div>` : ''}
        ${moon.baseStats.damageBonus === 0 && moon.baseStats.shardBonus === 0 && moon.baseStats.critChanceBonus === 0 && moon.baseStats.critDamageBonus === 0 
          ? `<div class="moon-shop-stat" style="opacity: 0.5;">Растёт с уровнем</div>` 
          : ''}
      </div>
    `;
    
    // Рендер механики
    let mechanicDescHtml = moon.specialDescription;
    if (currentParams && owned) {
      mechanicDescHtml = _getMechanicDescription(id, currentParams);
    }
    
    const mechanicHtml = `
      <div class="moon-shop-mechanic">
        <div class="moon-shop-mechanic-name">✨ ${escapeHTML(moon.specialName)}</div>
        <div class="moon-shop-mechanic-desc">${escapeHTML(mechanicDescHtml)}</div>
      </div>
    `;
    
    // Рендер милестоунов
    let milestonesHtml = '';
    if (owned || !isLockedByLevel) {
      milestonesHtml = '<div class="moon-shop-milestones">';
      
      for (let lvl = 1; lvl <= CONSTANTS.LIMITS.MAX_MOON_LEVEL; lvl++) {
        const milestone = moon.milestones[lvl];
        if (!milestone) continue;
        
        let stateClass = 'locked';
        if (owned && moonLevel >= lvl) {
          stateClass = 'unlocked';
        } else if (owned && moonLevel === lvl - 1) {
          stateClass = 'current';
        }
        
        milestonesHtml += `
          <div class="moon-shop-milestone ${stateClass}">
            <div class="milestone-icon">${milestone.icon}</div>
            <div class="milestone-info">
              <div class="milestone-level">Уровень ${lvl}</div>
              <div class="milestone-name">${escapeHTML(milestone.name)}</div>
              <div class="milestone-desc">${escapeHTML(milestone.description)}</div>
            </div>
          </div>
        `;
      }
      
      milestonesHtml += '</div>';
    }
    
    // Цена прокачки
    const rarity = RARITY_CONFIG[moon.rarity] || RARITY_CONFIG.common;
    const upgradeCost = owned ? getMoonUpgradeCostForLevel(id, moonLevel) : 0;
    const displayUpgradeCost = state.testMode ? 0 : upgradeCost;
    const canUpgrade = owned && moonLevel < CONSTANTS.LIMITS.MAX_MOON_LEVEL &&
      (state.testMode || (state.playerData?.shards || 0) >= upgradeCost);
    
    const displayCost = state.testMode ? 0 : moon.cost;
    
    // Кнопки действий
    let actionsHtml = '';
    if (owned) {
      if (isActive) {
        actionsHtml += `<button class="btn-moon-active" onclick="window.toggleMoonActive('${id}')">✓ Активна</button>`;
      } else {
        actionsHtml += `<button class="btn-moon-activate" onclick="window.toggleMoonActive('${id}')">Активировать</button>`;
      }
      
      if (moonLevel < CONSTANTS.LIMITS.MAX_MOON_LEVEL) {
        actionsHtml += `<button class="btn-moon-upgrade ${canUpgrade ? 'can-afford' : 'cannot-afford'}" onclick="window.gameEngine.upgradeMoon('${id}')">
          ${canUpgrade ? `⬆️ ${formatNumber(displayUpgradeCost)} 💎` : (moonLevel >= CONSTANTS.LIMITS.MAX_MOON_LEVEL ? 'MAX' : `Нужно ${formatNumber(displayUpgradeCost)} 💎`)}
        </button>`;
      } else {
        actionsHtml += `<button class="btn-moon-upgrade cannot-afford" disabled>MAX УРОВЕНЬ</button>`;
      }
    } else {
      if (moon.cost === 0) {
        actionsHtml += '<button class="btn-moon-free" disabled>Доступна</button>';
      } else if (isLockedByLevel) {
        actionsHtml += '<button class="btn-moon-locked" disabled>🔒</button>';
      } else {
        actionsHtml += `<button class="btn-moon-buy ${canBuy ? 'can-afford' : 'cannot-afford'}" onclick="window.gameEngine.buyMoon('${id}')">
          ${canBuy ? `Купить ${formatNumber(displayCost)} 💎` : `Нужно ${formatNumber(displayCost)} 💎`}
        </button>`;
      }
    }
    
    html += `
      <div class="moon-shop-card rarity-${moon.rarity}">
        <div class="moon-shop-header">
          <div class="moon-shop-emoji">${moon.emoji}</div>
          <div class="moon-shop-rarity" style="background: ${rarity.gradient}">
            ${rarity.name}
          </div>
        </div>
        <div class="moon-shop-name">${escapeHTML(moon.name)}</div>
        <div class="moon-shop-desc">${escapeHTML(moon.shopDescription || moon.description || '')}</div>
        
        ${owned ? `<div class="moon-shop-status"><div class="moon-level">⭐ Уровень: ${moonLevel} / ${CONSTANTS.LIMITS.MAX_MOON_LEVEL}</div></div>` : ''}
        ${isLockedByLevel && !owned ? `<div class="moon-shop-status"><div class="moon-locked">🔒 Доступна с ${moon.unlockLevel} уровня</div></div>` : ''}
        
        ${baseStatsHtml}
        ${mechanicHtml}
        ${milestonesHtml}
        
        <div class="moon-shop-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

// ============================================================
// ПОМОЩНИК: Описание механики с учётом текущих параметров
// ============================================================
function _getMechanicDescription(moonId, params) {
  switch (moonId) {
    case 'normal':
      return `Каждые ${params.clicksPerStack} кликов +${Math.round(params.bonusPerStack * 100)}% урона (макс ${params.maxStacks} стеков = +${Math.round(params.bonusPerStack * params.maxStacks * 100)}%)`;
    
    case 'blood':
      let desc = `При HP босса < ${Math.round(params.hpThreshold * 100)}%: +${Math.round(params.damageBonus * 100)}% к урону`;
      if (params.executeThreshold > 0) {
        desc += `. При HP < ${Math.round(params.executeThreshold * 100)}% — мгновенная смерть`;
      }
      return desc;
    
    case 'ice':
      let iceDesc = `+${Math.round(params.timerBonus * 100)}% к таймеру босса`;
      if (params.pierceInterval > 0) {
        iceDesc += `. Каждый ${params.pierceInterval}-й клик: +${Math.round(params.pierceDamage * 100)}% урона`;
      }
      return iceDesc;
    
    case 'shadow':
      let shadowDesc = `Каждые ${params.clicksPerStack} кликов +${Math.round(params.critDamagePerStack * 100)}% крит урона (макс ${params.maxStacks} стеков = +${Math.round(params.critDamagePerStack * params.maxStacks * 100)}%)`;
      if (params.firstStrikeCrit) shadowDesc += `. Первый удар = гарантированный крит`;
      if (params.doubleCritChance > 0) shadowDesc += `. ${Math.round(params.doubleCritChance * 100)}% шанс двойного крита`;
      if (params.fullStackCritChance > 0) shadowDesc += `. При полном стаке +${Math.round(params.fullStackCritChance * 100)}% шанса крита`;
      return shadowDesc;
    
    case 'fire':
      let fireDesc = `Каждые ${params.clicksPerStack} кликов +${Math.round(params.bonusPerStack * 100)}% урона`;
      if (params.maxStacks === Infinity) {
        fireDesc += ` (неограниченно, но ${Math.round(params.resetChance * 100)}% шанс сброса после ${params.safeStacks} стеков)`;
      } else {
        fireDesc += ` (макс ${params.maxStacks} стеков = +${Math.round(params.bonusPerStack * params.maxStacks * 100)}%)`;
      }
      return fireDesc;
    
    case 'electric':
      let elecDesc = `Шанс молнии: ${Math.round(params.chanceX2 * 100)}%→x2, ${Math.round(params.chanceX5 * 100)}%→x5, ${Math.round(params.chanceX10 * 100)}%→x10`;
      if (params.pityMax > 0) elecDesc += `. Без срабатывания: +${Math.round(params.pityBonus * 100)}% к шансу (макс +${Math.round(params.pityMax * 100)}%)`;
      if (params.superconductorBonus > 0) elecDesc += `. При x5+: +${Math.round(params.superconductorBonus * 100)}% урона на ${params.superconductorClicks} клика`;
      return elecDesc;
    
    case 'gold':
      let goldDesc = `x${params.normalMultiplier} осколков с обычных, x${params.bossMultiplier} с боссов`;
      if (params.goldenClickChance > 0) goldDesc += `. ${Math.round(params.goldenClickChance * 100)}% шанс +${params.goldenClickReward} 💎`;
      if (params.shardToDamageRatio > 0) goldDesc += `. +${Math.round(params.shardToDamageRatio * 100)}% урона от осколков`;
      return goldDesc;
    
    case 'cosmic':
      let cosmicDesc = `+${Math.round(params.damagePerLevel * 100)}% урона, +${Math.round(params.shardPerLevel * 100)}% осколков, +${Math.round(params.critDamagePerLevel * 100)}% крит урона за уровень игрока`;
      if (params.supernovaAvailable) cosmicDesc += `. 🌟 Сверхновая доступна!`;
      return cosmicDesc;
    
    default:
      return '';
  }
}

function _updateSynergiesDisplay() {
  const container = document.getElementById('activeSynergies');
  if (!container) return;
  
  const synergies = window._activeSynergies || [];
  
  if (synergies.length === 0) {
    container.innerHTML = '<div class="no-synergies">Комбинируйте луны для активации синергий</div>';
    return;
  }
  
  let html = '';
  synergies.forEach(syn => {
    html += `
      <div class="synergy-badge tier-${syn.tier}" style="--tier-color: ${syn.tierColor}">
        <div class="synergy-icon">${syn.icon || '🔗'}</div>
        <div class="synergy-info">
          <div class="synergy-name">${escapeHTML(syn.name)}</div>
          <div class="synergy-tier">${syn.tierName}</div>
          <div class="synergy-desc">${escapeHTML(syn.description || '')}</div>
          <div class="synergy-bonuses">
            ${syn.damageBonus > 0 ? `<span class="bonus">⚔️+${Math.round(syn.damageBonus*100)}%</span>` : ''}
            ${syn.shardBonus > 0 ? `<span class="bonus">💎+${Math.round(syn.shardBonus*100)}%</span>` : ''}
            ${syn.critChanceBonus > 0 ? `<span class="bonus">🎯+${Math.round(syn.critChanceBonus*100)}%</span>` : ''}
            ${syn.critDamageBonus > 0 ? `<span class="bonus">💥+${Math.round(syn.critDamageBonus*100)}%</span>` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ============================================================
// ПРОФИЛЬ И ЛИДЕРЫ
// ============================================================
export function updateProfileAndLeaders() {
  uiScheduler.schedule(() => {
    _updateProfile();
    _updateLeaders();
  });
}

function _updateProfile() {
  const profileContent = document.getElementById('profileContent');
  if (!profileContent) return;
  
  if (!state.user) {
    profileContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <div class="empty-state-text">Войдите в аккаунт</div>
      </div>
    `;
    return;
  }

  const data = state.playerData || {};
  const title = getTitle(data.level || 1);
  const activeMoons = state.activeMoons || [];
  const ownedMoons = state.ownedMoons || [];
  const maxSlots = state.maxSlots || 1;
  const totalDamageBonus = window._totalDamageBonus || 0;
  const totalShardBonus = window._totalShardBonus || 0;
  const totalCritChanceBonus = window._totalCritChanceBonus || 0;
  const totalCritDamageBonus = window._totalCritDamageBonus || 0;
  const baseDamage = data.click_damage || CONSTANTS.DEFAULTS.CLICK_DAMAGE;
  const finalDamage = Math.round(baseDamage * (1 + totalDamageBonus));
  const finalCritChance = Math.round((0.05 + totalCritChanceBonus) * 100);
  const finalCritDamage = Math.round((2 + totalCritDamageBonus) * 100);

  let activeMoonsHtml = '';
  activeMoons.forEach(moonId => {
    const moon = MOON_TYPES[moonId];
    if (!moon) return;
    const level = state.moonLevels[moonId] || 1;
    activeMoonsHtml += `
      <div class="profile-moon-card active rarity-${moon.rarity}">
        <div class="profile-moon-emoji" style="background-image: ${moon.gradient}; box-shadow: ${moon.shadow}"></div>
        <div class="profile-moon-info">
          <div class="profile-moon-name">${escapeHTML(moon.name)}</div>
          <div class="profile-moon-level">Ур. ${level}</div>
          <div class="profile-moon-special">✨ ${escapeHTML(moon.specialName || '')}</div>
        </div>
        <button class="btn-moon-deactivate" onclick="window.toggleMoonActive('${moonId}')" title="Деактивировать">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
  });

  const emptySlotsCount = Math.max(0, maxSlots - activeMoons.length);
  for (let i = 0; i < emptySlotsCount; i++) {
    activeMoonsHtml += `
      <div class="profile-moon-card empty-slot">
        <div class="profile-moon-emoji empty"></div>
        <div class="profile-moon-info">
          <div class="profile-moon-name empty-name">Пустой слот</div>
        </div>
      </div>
    `;
  }

  let ownedMoonsHtml = '';
  ownedMoons.forEach(moonId => {
    const moon = MOON_TYPES[moonId];
    if (!moon) return;
    const isActive = activeMoons.includes(moonId);
    const level = state.moonLevels[moonId] || 1;
    const rarity = RARITY_CONFIG[moon.rarity] || RARITY_CONFIG.common;
    
    ownedMoonsHtml += `
      <div class="owned-moon-card rarity-${moon.rarity} ${isActive ? 'is-active' : ''}" onclick="window.toggleMoonActive('${moonId}')">
        <div class="owned-moon-visual">
          <div class="owned-moon-emoji" style="background-image: ${moon.gradient}; box-shadow: ${moon.shadow}"></div>
          <div class="owned-moon-level-badge">Ур. ${level}</div>
        </div>
        <div class="owned-moon-name">${escapeHTML(moon.name)}</div>
        <div class="owned-moon-rarity" style="background: ${rarity.gradient}">${rarity.name}</div>
        <button class="btn-owned-moon-toggle ${isActive ? 'active' : ''}">
          ${isActive ? '✓' : '+'}
        </button>
      </div>
    `;
  });

  const activeSynergies = window._activeSynergies || [];
  let synergiesHtml = '';
  if (activeSynergies.length > 0) {
    activeSynergies.forEach(syn => {
      const moons = syn.key.split('+');
      const moonsHtml = moons.map(m => {
        const moon = MOON_TYPES[m];
        return moon ? `<span class="synergy-moon-emoji">${moon.emoji}</span>` : '';
      }).join('');
      
      synergiesHtml += `
        <div class="profile-synergy-card tier-${syn.tier}" style="--tier-color: ${syn.tierColor}">
          <div class="synergy-card-header">
            <div class="synergy-card-icon">${syn.icon}</div>
            <div class="synergy-card-info">
              <div class="synergy-card-name">${escapeHTML(syn.name)}</div>
              <div class="synergy-card-tier">${syn.tierName}</div>
            </div>
          </div>
          <div class="synergy-card-moons">${moonsHtml}</div>
          <div class="synergy-card-desc">${escapeHTML(syn.description || '')}</div>
          <div class="synergy-card-bonuses">
            ${syn.damageBonus > 0 ? `<span>⚔️+${Math.round(syn.damageBonus*100)}%</span>` : ''}
            ${syn.shardBonus > 0 ? `<span>💎+${Math.round(syn.shardBonus*100)}%</span>` : ''}
            ${syn.critChanceBonus > 0 ? `<span>🎯+${Math.round(syn.critChanceBonus*100)}%</span>` : ''}
            ${syn.critDamageBonus > 0 ? `<span>💥+${Math.round(syn.critDamageBonus*100)}%</span>` : ''}
          </div>
        </div>
      `;
    });
  } else {
    synergiesHtml = `
      <div class="empty-state">
        <div class="empty-state-text">Нет активных синергий</div>
        <div class="empty-state-hint">Активируйте несколько лун</div>
      </div>
    `;
  }

  profileContent.innerHTML = `
    <div class="profile-block profile-header-block">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar">👤</div>
        <div class="profile-level-badge">Ур. ${data.level || 1}</div>
      </div>
      <div class="profile-info">
        <div class="profile-name">${escapeHTML(state.user.user_metadata?.username || 'Игрок')}</div>
        <div class="profile-email">${escapeHTML(state.user.email || '-')}</div>
        <div class="profile-title">${title}</div>
      </div>
    </div>

    <div class="profile-block">
      <div class="profile-block-header">
        <span class="block-icon">⚔️</span>
        <span class="block-title">Боевые характеристики</span>
      </div>
      <div class="combat-stats">
        <div class="combat-stat">
          <div class="combat-stat-icon">🗡️</div>
          <div class="combat-stat-info">
            <div class="combat-stat-label">Базовый урон</div>
            <div class="combat-stat-value">${baseDamage}</div>
          </div>
        </div>
        <div class="combat-stat">
          <div class="combat-stat-icon">💥</div>
          <div class="combat-stat-info">
            <div class="combat-stat-label">Финальный урон</div>
            <div class="combat-stat-value highlight">${finalDamage}</div>
          </div>
        </div>
        <div class="combat-stat">
          <div class="combat-stat-icon">🎯</div>
          <div class="combat-stat-info">
            <div class="combat-stat-label">Шанс крита</div>
            <div class="combat-stat-value">${finalCritChance}%</div>
          </div>
        </div>
        <div class="combat-stat">
          <div class="combat-stat-icon">⚡</div>
          <div class="combat-stat-info">
            <div class="combat-stat-label">Урон крита</div>
            <div class="combat-stat-value">${finalCritDamage}%</div>
          </div>
        </div>
      </div>
    </div>

    <div class="profile-block">
      <div class="profile-block-header">
        <span class="block-icon">📊</span>
        <span class="block-title">Текущие бонусы</span>
      </div>
      <div class="bonuses-grid">
        <div class="bonus-card damage-bonus">
          <div class="bonus-card-icon">⚔️</div>
          <div class="bonus-card-label">Урон</div>
          <div class="bonus-card-value">+${Math.round(totalDamageBonus * 100)}%</div>
        </div>
        <div class="bonus-card shard-bonus">
          <div class="bonus-card-icon">💎</div>
          <div class="bonus-card-label">Осколки</div>
          <div class="bonus-card-value">+${Math.round(totalShardBonus * 100)}%</div>
        </div>
        <div class="bonus-card crit-chance-bonus">
          <div class="bonus-card-icon">🎯</div>
          <div class="bonus-card-label">Крит шанс</div>
          <div class="bonus-card-value">+${Math.round(totalCritChanceBonus * 100)}%</div>
        </div>
        <div class="bonus-card crit-damage-bonus">
          <div class="bonus-card-icon">💥</div>
          <div class="bonus-card-label">Крит урон</div>
          <div class="bonus-card-value">+${Math.round(totalCritDamageBonus * 100)}%</div>
        </div>
      </div>
    </div>

    <div class="profile-block">
      <div class="profile-block-header">
        <span class="block-icon">⭐</span>
        <span class="block-title">Активные луны</span>
        <span class="block-counter">${activeMoons.length}/${maxSlots}</span>
      </div>
      <div class="active-moons-list">${activeMoonsHtml}</div>
    </div>

    <div class="profile-block">
      <div class="profile-block-header">
        <span class="block-icon">🌙</span>
        <span class="block-title">Коллекция лун</span>
        <span class="block-counter">${ownedMoons.length}/${Object.keys(MOON_TYPES).length}</span>
      </div>
      <div class="owned-moons-grid">${ownedMoonsHtml}</div>
    </div>

    <div class="profile-block">
      <div class="profile-block-header">
        <span class="block-icon">🔗</span>
        <span class="block-title">Активные синергии</span>
        <span class="block-counter">${activeSynergies.length}</span>
      </div>
      <div class="synergies-list">${synergiesHtml}</div>
    </div>

    <div class="profile-block">
      <div class="profile-block-header">
        <span class="block-icon">📈</span>
        <span class="block-title">Статистика</span>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-icon">👆</div>
          <div class="stat-card-label">Кликов</div>
          <div class="stat-card-value">${formatNumber(data.total_clicks || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">👹</div>
          <div class="stat-card-label">Боссов</div>
          <div class="stat-card-value">${state.bossKills || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">🌙</div>
          <div class="stat-card-label">Лун</div>
          <div class="stat-card-value">${ownedMoons.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">🎰</div>
          <div class="stat-card-label">Слотов</div>
          <div class="stat-card-value">${maxSlots}/${CONSTANTS.MAX_SLOTS}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">💎</div>
          <div class="stat-card-label">Всего осколков</div>
          <div class="stat-card-value">${formatNumber(data.shards || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">⏱️</div>
          <div class="stat-card-label">В игре</div>
          <div class="stat-card-value">${formatTime(state.totalSecondsPlayed || 0)}</div>
        </div>
      </div>
    </div>
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
      const rankClass = i === 0 ? 'rank-gold' : (i === 1 ? 'rank-silver' : (i === 2 ? 'rank-bronze' : ''));
      html += `
        <div class="leader-item ${isMe ? 'is-me' : ''} ${rankClass}">
          <div class="leader-rank">#${i + 1}</div>
          <div class="leader-name">${escapeHTML(p.username || 'Аноним')}</div>
          <div class="leader-level">Ур. ${p.level || 0}</div>
          <div class="leader-clicks">👆 ${formatNumber(p.total_clicks || 0)}</div>
        </div>
      `;
    });
    leadersList.innerHTML = html;
  } catch (error) {
    console.error('[UI] Leaders error:', error);
    leadersList.innerHTML = '<div class="error-data">Ошибка загрузки</div>';
  }
}

// ============================================================
// ЗВЁЗДЫ
// ============================================================
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

// ============================================================
// КВЕСТЫ
// ============================================================
export function setQuestCategory(category) {
  currentQuestCategory = category;
  updateQuestUI();
}

export function updateQuestUI() {
  const container = document.getElementById('questsList');
  if (!container) return;

  const quests = state.quests || {};
  
  let tabsHtml = '<div class="filter-tabs quest-tabs">';
  for (const [catId, cat] of Object.entries(QUEST_CATEGORIES)) {
    const isActive = currentQuestCategory === catId;
    tabsHtml += `
      <button class="filter-tab quest-tab ${isActive ? 'active' : ''}" 
              onclick="window.setQuestCategory('${catId}')"
              style="--tab-color: ${cat.color}">
        <span class="tab-icon">${cat.icon}</span>
        <span class="tab-name">${cat.name}</span>
      </button>
    `;
  }
  tabsHtml += '</div>';
  
  let listHtml = '<div class="quest-list">';
  let questCount = 0;
  
  for (const [id, q] of Object.entries(quests)) {
    const questData = QUESTS[id];
    if (!questData) continue;
    
    if (currentQuestCategory !== 'all' && questData.category !== currentQuestCategory) continue;
    
    questCount++;
    const progress = q.progress || 0;
    const target = q.target || 100;
    const percent = Math.min(100, Math.round((progress / target) * 100));
    const isCompleted = q.completed;
    const isClaimed = q.claimed;
    
    listHtml += `
      <div class="quest-card difficulty-${questData.difficulty} ${isCompleted ? 'completed' : ''} ${isClaimed ? 'claimed' : ''}">
        <div class="quest-header">
          <div class="quest-icon" style="background: ${questData.color}22; color: ${questData.color}">
            ${questData.icon}
          </div>
          <div class="quest-title-wrap">
            <div class="quest-name">${escapeHTML(questData.name)}</div>
            <div class="quest-category">${questData.categoryName}</div>
          </div>
          <div class="quest-difficulty difficulty-${questData.difficulty}">
            ${questData.difficulty === 'easy' ? 'Легко' : (questData.difficulty === 'medium' ? 'Средне' : 'Сложно')}
          </div>
        </div>
        <div class="quest-desc">${escapeHTML(questData.description)}</div>
        <div class="quest-progress">
          <div class="quest-progress-bar">
            <div class="quest-progress-fill" style="width: ${percent}%; background: ${questData.color}"></div>
          </div>
          <div class="quest-progress-text">${progress} / ${target}</div>
        </div>
        <div class="quest-footer">
          <div class="quest-reward">
            <span class="reward-label">Награда:</span>
            <span class="reward-value">💎 ${questData.reward}</span>
            ${questData.bonusReward ? `<span class="bonus-reward">+${questData.bonusReward}</span>` : ''}
          </div>
          <div class="quest-status">
            ${isClaimed ? '<span class="status-claimed">✓ Получено</span>' :
              (isCompleted ? 
                `<button class="btn-claim" onclick="window.claimQuestReward('${id}')">Получить</button>` :
                `<span class="status-progress">${percent}%</span>`)}
          </div>
        </div>
      </div>
    `;
  }
  
  if (questCount === 0) {
    listHtml += '<div class="no-quests">В этой категории нет активных квестов</div>';
  }
  
  listHtml += '</div>';
  
  container.innerHTML = tabsHtml + listHtml;
}

// ============================================================
// ДОСТИЖЕНИЯ
// ============================================================
export function setAchievementCategory(category) {
  currentAchievementCategory = category;
  updateAchievementUI();
}

export function updateAchievementUI() {
  const container = document.getElementById('achievementsList');
  if (!container) return;

  const achievements = state.achievements || {};
  
  let tabsHtml = '<div class="filter-tabs achievement-tabs">';
  for (const [catId, cat] of Object.entries(ACHIEVEMENT_CATEGORIES)) {
    const isActive = currentAchievementCategory === catId;
    tabsHtml += `
      <button class="filter-tab achievement-tab ${isActive ? 'active' : ''}" 
              onclick="window.setAchievementCategory('${catId}')">
        <span class="tab-icon">${cat.icon}</span>
        <span class="tab-name">${cat.name}</span>
      </button>
    `;
  }
  tabsHtml += '</div>';
  
  const grouped = {};
  for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
    if (currentAchievementCategory !== 'all' && ach.category !== currentAchievementCategory) continue;
    if (!grouped[ach.category]) {
      grouped[ach.category] = { name: ach.categoryName, icon: ach.icon, achievements: [] };
    }
    grouped[ach.category].achievements.push({ id, ...ach });
  }
  
  let listHtml = '<div class="achievement-list">';
  
  for (const [catId, group] of Object.entries(grouped)) {
    listHtml += `
      <div class="achievement-category">
        <div class="category-header">
          <span class="category-icon">${group.icon}</span>
          <span class="category-name">${group.name}</span>
        </div>
    `;
    
    for (const ach of group.achievements) {
      const achState = achievements[ach.id] || {};
      
      listHtml += `
        <div class="achievement-card">
          <div class="achievement-header">
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-info">
              <div class="achievement-title-group">
      `;
      
      ach.tiers.forEach((tier, idx) => {
        const tierState = achState[tier.level];
        const isAchieved = tierState === 'claimed';
        const isUnclaimed = tierState === 'unclaimed';
        
        const tierIcon = isAchieved ? 
          (tier.level === 'gold' ? '🥇' : (tier.level === 'silver' ? '🥈' : '🥉')) : 
          (isUnclaimed ? '🎁' : '🔒');
        
        listHtml += `
          <div class="achievement-tier tier-${tier.level} ${isAchieved ? 'achieved' : (isUnclaimed ? 'unclaimed' : 'locked')}">
            <span class="tier-medal">${tierIcon}</span>
            <div class="tier-info">
              <div class="tier-name">${escapeHTML(tier.name)}</div>
              <div class="tier-desc">${escapeHTML(tier.description)}</div>
              <div class="tier-reward">💎 ${tier.reward}</div>
            </div>
            ${isUnclaimed ? 
              `<button class="btn-claim-tier" onclick="window.claimAchievementReward('${ach.id}', '${tier.level}')">Получить</button>` 
              : ''}
          </div>
        `;
      });
      
      listHtml += `
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    listHtml += `</div>`;
  }
  
  if (Object.keys(grouped).length === 0) {
    listHtml += '<div class="no-achievements">Нет достижений в этой категории</div>';
  }
  
  listHtml += '</div>';
  
  container.innerHTML = tabsHtml + listHtml;
}

export function updateQuestAndAchievementUI() {
  updateQuestUI();
  updateAchievementUI();
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
if (typeof window !== 'undefined') {
  window.updateProfileAndLeaders = updateProfileAndLeaders;
  window.updateShopUI = updateShopUI;
  window.updateQuestUI = updateQuestUI;
  window.updateAchievementUI = updateAchievementUI;
  window.updateQuestAndAchievementUI = updateQuestAndAchievementUI;
  window.updateTimerBar = updateTimerBar;
  window.showToast = showToast;
  window._setQuestCategory = setQuestCategory;
  window._setAchievementCategory = setAchievementCategory;
}
