import { getVisibleShards, getVisibleCasinoTotals } from './currency-display.js';
import { renderStarfield } from './starfield.js';
import { formatNumber, formatMoney, formatPrice, formatExact, formatBaseDamage } from '../../utils/numbers.js';
export { formatNumber };
// ============================================================
// РЕНДЕРИНГ UI - ОБНОВЛЁННАЯ СИСТЕМА ЛУН И ПРОКАЧКИ
// ============================================================
import { state, appState } from '../../core/state.js';
import { 
  CONSTANTS, MOON_TYPES, ACHIEVEMENTS, QUESTS, 
  QUEST_CATEGORIES, ACHIEVEMENT_CATEGORIES, 
  SYNERGY_BONUSES, RARITY_CONFIG,
  getMoonMechanicParams, getProgressReward, getQuestPayout, getEffectiveMoonParams, getCloneTargets, getMoonPower, getSlotLimit, getClickCrystalCost, getMoonUpgradeCostForLevel, getUfoMoonDescription, getPrestigeSummary, getPrestigeUpgradeCost, getMoonPurchaseAccess, MOON_ORDER, getCombatStats, PRESTIGE_UPGRADES
} from '../../core/constants.js';
import { getMaxHPForLevel, getTitle, getClickUpgradeCost } from '../../core/config.js';
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
  if(!toastContainer)toastContainer=document.getElementById('toastContainer');
  if (!toastContainer) {
    console.warn('[UI] Toast container not initialized');
    return;
  }

  while(toastContainer.children.length>=3)toastContainer.firstElementChild.remove();

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
    updateHPBar();
    updateTimerBar();
    _updateMoonStyle();
    _updateMoonAuras();
    if (typeof window.updateBuffsDisplay === 'function') {
      window.updateBuffsDisplay();
    }
  },0,'combat-hud');
}

function _updateCounter() {
  const counter = document.getElementById('counter');
  if (!counter) return;
  const shards = getVisibleShards(state.playerData?.shards);
  counter.textContent = `💎 ${formatMoney(shards)}`;
  counter.title = formatExact(shards)+' 💎';
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
  const fiveBtn=document.getElementById('rollbackFiveBtn');
  const jumpInput=document.getElementById('jumpLevelInput');
  if(jumpInput){jumpInput.max=String(Math.max(1,state.runMaxLevel||state.currentLevel));jumpInput.title='Доступные уровни: 1–'+jumpInput.max;}
  fiveBtn?.classList.toggle('hidden',state.currentLevel<=1);
  const recordButton=document.getElementById('returnRecordBtn'),record=Math.max(state.currentLevel,state.runMaxLevel||state.currentLevel);
  if(recordButton){recordButton.classList.toggle('hidden',record<=state.currentLevel);recordButton.title='Вернуться на '+record+' уровень текущего забега';}
  
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

function gameEnginePreviewDamage() { return Math.max(0, Number(window.gameEngine?._previewDamage) || 0); }

export function updateHPBar() {
  // Pending hits affect rendering only; rewards and game state remain server-owned.
  const displayHP = Math.max(1, state.moonHP - (gameEnginePreviewDamage()));
  const hpBar = document.getElementById('hpBar');
  const hpPercent = document.getElementById('hpPercent');
  const moonInner = document.getElementById('moonInner');
  const reward=document.getElementById('moonReward');
  if(reward)reward.textContent='За луну: +'+formatMoney(state.moonReward||0)+' 💎'+(state.ufoMoonReward>state.moonReward?' · тарелка +'+formatMoney(state.ufoMoonReward)+' 💎':'');

  if (hpBar) {
    const percent = Math.max(0, (displayHP / state.maxHP) * 100);
    hpBar.style.transform = 'scaleX('+Math.min(1,percent/100)+')';
  }

  if (hpPercent) {
    hpPercent.textContent = `${formatNumber(displayHP)}/${formatNumber(state.maxHP)}`;
  }

  if (moonInner) {
    const ratio = Math.max(0, Math.min(1, displayHP / state.maxHP));
    const scale = Math.pow(ratio, 0.4) * 0.95 + 0.05;
    moonInner.style.scale = String(scale);
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
    bar.style.transform = 'scaleX('+Math.min(1,pct/100)+')';
    percent.textContent = `${Math.ceil(state.bossTimer)}с`;
  } else {
    container.classList.remove('active');
    bar.style.transform = 'scaleX(1)';
    percent.textContent = `${CONSTANTS.BOSS_TIMER}с`;
  }
}

let lastMoonStyle='';
function _updateMoonStyle() {
  if(lastMoonStyle===state.activeMoon)return;lastMoonStyle=state.activeMoon;
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
  
  const auraKey=JSON.stringify((window._activeSynergies||[]).map(s=>s.key));
  if(moonContainer.dataset.auraKey===auraKey)return;moonContainer.dataset.auraKey=auraKey;
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
    if(document.getElementById('shopPanel')?.classList.contains('hidden'))return;
    updatePrestigeUI();
    if(document.getElementById('moonsTabContent')?.classList.contains('active')){_updateMoonShop();_updateCloneControls();_updateSynergiesDisplay();return;}
    if(!document.getElementById('shopTabContent')?.classList.contains('active'))return;
    _updateClickDamageShop();
    _updateUfoShop();
    _updateSlotShop();
    _updateClickCrystalShop();
  },0,'shop');
}

let prestigeShopKey='',prestigeProfileKey='';
export function updatePrestigeUI(){
 const p=getPrestigeSummary(state),container=document.getElementById('prestigeShop'),profile=document.getElementById('profilePrestige');
 const profileKey=JSON.stringify(p);
 if(profile&&(profileKey!==prestigeProfileKey||!profile.childElementCount)&&!document.getElementById('profilePanel')?.classList.contains('hidden'))profile.innerHTML='<div class="profile-block"><div class="profile-block-header"><span class="block-icon">🌟</span><span class="block-title">Вечный престиж</span></div><div class="stats-grid">'+[
 ['🌟','Монеты',p.coins],['✨','Вознесения',p.ascensions],['⚔️','Урон','+'+Math.round(p.damageBonus*100)+'%'],['💎','Добыча','+'+Math.round(p.shardBonus*100)+'%'],['🎯','Шанс крита','+'+Math.round(p.critBonus*100)+'%'],['🛸','Урон тарелок','+'+Math.round(p.ufoDamage*100)+'%'],['⏱️','Сокращение интервала кликов тарелки',Math.round(p.ufoHaste*100)+'%'],['🎁','Награды заданий','×'+p.rewardMultiplier.toLocaleString('ru-RU')],['🔊','Шанс эха',Math.round(p.echoChance*100)+'%'],['🚀','Стартовый капитал',formatMoney(p.startShards)+' 💎'],['👹','Урон боссам','+'+Math.round(p.bossDamage*100)+'%'],['⏳','Время босса','+'+p.bossTime+' с'],['📚','Космос за убийство',(MOON_TYPES.cosmic.mechanicParams.baseDamagePerKill+p.archivePerKill).toLocaleString('ru-RU')],['🌌','Вечные слоты',p.extraSlots],['📈','Рекорд прохождения',p.runRecord],['🔮','При вознесении',p.pendingCoins+' 🌟']
 ].map(([icon,label,value])=>'<div class="stat-card"><div class="stat-card-icon">'+icon+'</div><div class="stat-card-label">'+label+'</div><div class="stat-card-value">'+value+'</div></div>').join('')+'</div></div>';
 prestigeProfileKey=profile&&!document.getElementById('profilePanel')?.classList.contains('hidden')?profileKey:prestigeProfileKey;
 if(!container||!document.getElementById('prestigeTabContent')?.classList.contains('active'))return;
 const shopKey=JSON.stringify([p,state.prestige?.upgrades]);if(shopKey===prestigeShopKey&&container.childElementCount)return;prestigeShopKey=shopKey;
 container.innerHTML='<div class="prestige-overview">'+
 '<div class="prestige-hero"><div class="prestige-hero-label">🌟 Вечный престиж</div><div class="prestige-hero-balance">🌟 '+p.coins+'</div><div class="prestige-hero-caption">Монеты престижа</div></div>'+
 '<section class="prestige-card"><h3>✨ Награды за прохождение</h3><div class="prestige-rewards">'+
 '<div class="prestige-reward"><span class="prestige-reward-icon">🌟</span><div><strong>Монеты престижа</strong><span>1 монета за каждые 20 достигнутых уровней</span></div></div>'+
 '<div class="prestige-reward"><span class="prestige-reward-icon">⚔️</span><div><strong>Вечный урон</strong><span>+1% к урону за каждые 100 уровней</span></div></div>'+
 '<div class="prestige-reward"><span class="prestige-reward-icon">💎</span><div><strong>Вечная награда</strong><span>+5% к осколкам за каждые 300 уровней</span></div></div>'+
 '<div class="prestige-reward"><span class="prestige-reward-icon">🎁</span><div><strong>Награды заданий</strong><span>+25% от базовой награды за каждое вознесение</span></div></div></div>'+
 '<p class="prestige-note">Вечные бонусы сохраняются между прохождениями и накапливаются.</p></section>'+
 '<div class="prestige-status-grid"><section class="prestige-card prestige-run"><h3>🚀 Текущее прохождение</h3>'+
 '<div class="prestige-metric"><span>Достигнутый уровень</span><strong>'+p.runRecord+'</strong></div>'+
 '<div class="prestige-metric"><span>При вознесении</span><strong>🌟 '+p.pendingCoins+'</strong></div>'+
 '<p class="prestige-note">Обычный прогресс сбросится. Вечные бонусы и покупки сохранятся, достижения и квесты обновятся.</p></section>'+
 '<section class="prestige-card prestige-limit"><h3>⏱️ Лимит вознесений</h3>'+
 '<div class="prestige-limit-count"><strong>'+p.dailyAscensionsLeft+'</strong><span>из '+p.dailyAscensionLimit+' осталось сегодня</span></div>'+
 '<div class="prestige-limit-pips">'+Array.from({length:p.dailyAscensionLimit},(_,i)=>'<span class="'+(i<p.dailyAscensionsLeft?'available':'used')+'"></span>').join('')+'</div>'+
 '<p class="prestige-note">Обновление каждый день ровно в <b>00:00 МСК</b>.</p></section></div>'+
 '<button class="btn-action ascend-button prestige-ascend-button" data-ascend '+(p.canAscend?'':'disabled')+'>'+(p.dailyAscensionsLeft===0?'Лимит исчерпан до 00:00 МСК':p.canAscend?'🌟 Вознестись · +'+p.pendingCoins+' 🌟':'Вознесение доступно с '+CONSTANTS.PRESTIGE.COIN_EVERY+' уровня')+'</button>'+
 '<h3 class="prestige-upgrade-heading">🛍️ Магазин вечных улучшений</h3></div>'+
 Object.entries(PRESTIGE_UPGRADES).map(([id,d])=>{const level=state.prestige?.upgrades?.[id]||0,cost=getPrestigeUpgradeCost(id,level),maxed=level>=d.maxLevel;return '<div class="prestige-item"><h4>'+d.icon+' '+d.name+'</h4><p>'+d.description+' · Ур. '+Math.min(level,d.maxLevel)+' / '+(d.maxLevel===Infinity?'∞':d.maxLevel)+'</p><div class="purchase-split"><button class="btn-buy-shop" data-prestige-upgrade="'+id+'" '+(maxed||p.coins<cost?'disabled':'')+'>'+(maxed?'Куплено':formatPrice(cost)+' 🌟')+'</button>'+(d.maxLevel===1?'':'<button class="btn-buy-shop btn-buy-max" data-prestige-upgrade="'+id+'" data-buy-max="true" title="Купить максимум уровней" '+(maxed||p.coins<cost?'disabled':'')+'>MAX</button>')+'</div></div>';}).join('');
}

function _updateUfoShop() {
  const button=document.getElementById('buyUfoBtn'),info=document.getElementById('ufoInfo'),price=document.getElementById('ufoPrice');
  if(!button||!info||!price)return;
  const c=CONSTANTS.UFO,level=state.ufoLevel||0,cost=Math.floor(c.BASE_COST*Math.pow(c.COST_MULTIPLIER,level));
  const fleet=document.getElementById('ufoFleetInfo'),unitButton=document.getElementById('buyUfoUnitBtn'),unitPrice=document.getElementById('ufoUnitPrice');
  const count=state.ufoCount||0,limit=state.ownedMoons?.length||1,unitCost=Math.floor(c.UNIT_BASE_COST*Math.pow(c.UNIT_COST_MULTIPLIER,Math.max(0,count-1)));
  if(fleet)fleet.textContent='Тарелки: '+count+' / '+limit+' · каждую новую луну можно сопровождать ещё одной тарелкой';
  if(unitPrice)unitPrice.textContent=count>=limit?'Купите ещё одну луну':!count?'Сначала купите первую тарелку':formatPrice(unitCost)+' 💎';
  if(unitButton)unitButton.disabled=!count||count>=limit||(getVisibleShards(state.playerData?.shards))<unitCost;
   const unitMax=document.getElementById('buyUfoUnitBtnMax');if(unitMax)unitMax.disabled=unitButton?.disabled??true;
  const relay=document.getElementById('buyUfoComboRelayBtn'),relayPrice=document.getElementById('ufoComboRelayPrice');
  const relayUnlocked=(state.ownedMoons||[]).includes('electric')&&level>0;
  if(relay){relay.disabled=!!state.ufoComboRelay||!relayUnlocked||(getVisibleShards(state.playerData?.shards))<c.COMBO_RELAY_COST;relay.textContent=state.ufoComboRelay?'Куплено':'Купить';}
  if(relayPrice)relayPrice.textContent=state.ufoComboRelay?'Выстрел даёт 2 шага комбо, жара и тени':!relayUnlocked?'После покупки Электрической луны и тарелки':formatPrice(c.COMBO_RELAY_COST)+' 💎';
  const interval=state.ufoInterval||(c.BASE_INTERVAL-Math.max(0,level-1)*c.INTERVAL_REDUCTION);
  const buffs=document.getElementById('ufoBuffs');if(buffs)buffs.textContent=(state.activeMoons||[]).slice(0,state.maxSlots||1).map(id=>getUfoMoonDescription(id,state.moonLevels?.[id]||1)).join(' · ');
  info.textContent=level?'Ур. '+level+'/'+c.MAX_LEVEL+' · '+formatNumber(state.ufoDamage)+' урона раз в '+(interval/1000).toLocaleString('ru-RU')+' с':'50% финального урона раз в '+(c.BASE_INTERVAL/1000)+' с';
  price.textContent=level>=c.MAX_LEVEL?'Улучшена полностью':state.currentLevel<c.UNLOCK_LEVEL?'Откроется с '+c.UNLOCK_LEVEL+' уровня':formatPrice(cost)+' 💎';
  price.title=formatExact(cost)+' 💎';if(unitPrice)unitPrice.title=formatExact(unitCost)+' 💎';if(relayPrice)relayPrice.title=formatExact(c.COMBO_RELAY_COST)+' 💎';
  button.disabled=level>=c.MAX_LEVEL||state.currentLevel<c.UNLOCK_LEVEL||(getVisibleShards(state.playerData?.shards))<cost;
   const ufoMax=document.getElementById('buyUfoBtnMax');if(ufoMax)ufoMax.disabled=button.disabled;
  button.textContent=level>=c.MAX_LEVEL?'MAX':level?'Улучшить':'Купить';
}

function _updateClickDamageShop() {
  const buyBtn = document.getElementById('buyClickDamageBtn');
  const priceEl = document.getElementById('clickDamagePrice');
  const levelEl = document.getElementById('clickDamageLevel');
  const lockMsg = document.getElementById('shopLockMessage');

  if (!buyBtn || !priceEl || !levelEl) return;

  const level = state.currentLevel || 1;
  const isUnlocked = true; // Магазин всегда доступен

  if (lockMsg) {
    lockMsg.style.display = 'none';
    lockMsg.style.color = isUnlocked ? 'rgba(80, 255, 150, 0.5)' : 'rgba(255, 255, 255, 0.3)';
  }

  const currentLevelUpgrade = state.playerData?.click_damage_level || 0;
  const cost = getClickUpgradeCost(currentLevelUpgrade);
  const goal=document.getElementById('nextGoal');
  if(goal)goal.textContent=currentLevelUpgrade>=CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL?'Урон улучшен полностью':'Следующее улучшение: '+cost.toLocaleString('ru-RU')+' 💎 · ещё '+Math.max(0,cost-(getVisibleShards(state.playerData?.shards))).toLocaleString('ru-RU')+' 💎';
  const currentDamage = state.playerData?.click_damage || CONSTANTS.DEFAULTS.CLICK_DAMAGE;
  const upgradeValue = CONSTANTS.CLICK_DAMAGE_UPGRADE_VALUE;
  const nextDamage = currentDamage + upgradeValue;
  const displayCost = state.testMode ? 0 : cost;

  priceEl.textContent = `${formatPrice(displayCost)} 💎`;
  priceEl.title = formatExact(displayCost)+' 💎';
  levelEl.innerHTML = `Ур. ${currentLevelUpgrade}: ${currentDamage} → ${nextDamage} <span style="color: #4caf50; font-size: 0.75rem;">(+${upgradeValue})</span>`;

  const hasEnoughShards = state.testMode || (getVisibleShards(state.playerData?.shards)) >= cost;
  buyBtn.disabled = !isUnlocked || !hasEnoughShards || currentLevelUpgrade >= CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL;
  buyBtn.textContent = currentLevelUpgrade >= CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL ? 'MAX' : 'Купить';
  buyBtn.classList.toggle('locked', !isUnlocked);
   const damageMax=document.getElementById('buyClickDamageBtnMax');if(damageMax)damageMax.disabled=buyBtn.disabled;
}

function _updateSlotShop() {
  const buyBtn = document.getElementById('buySlotBtn');
  const priceEl = document.getElementById('slotPrice');
  const levelEl = document.getElementById('slotLevel');

  if (!buyBtn || !priceEl || !levelEl) return;

  const currentSlots = state.maxSlots;
  const canUpgrade = currentSlots < getSlotLimit(state);
  const regularSlots=currentSlots-getPrestigeSummary(state).extraSlots;
  const cost = canUpgrade ? Math.floor(
    CONSTANTS.UPGRADE_COSTS.moonSlots.base *
    Math.pow(CONSTANTS.UPGRADE_COSTS.moonSlots.multiplier, regularSlots - 1)
  ) : 0;
  const displayCost = state.testMode ? 0 : cost;

  priceEl.textContent = canUpgrade ? `${formatPrice(displayCost)} 💎` : 'MAX';
  priceEl.title = canUpgrade ? formatExact(displayCost)+' 💎' : '';
  levelEl.textContent = `Слотов: ${currentSlots}/${getSlotLimit(state)}`;

  const hasEnoughShards = state.testMode || (getVisibleShards(state.playerData?.shards)) >= cost;
  buyBtn.disabled = !canUpgrade || !hasEnoughShards;
  buyBtn.textContent = canUpgrade ? 'Купить' : 'MAX';
   const slotMax=document.getElementById('buySlotBtnMax');if(slotMax)slotMax.disabled=buyBtn.disabled;
}

// ============================================================
// НОВЫЙ РЕНДЕР МАГАЗИНА ЛУН (с милестоунами)
// ============================================================
let moonShopKey='';
function _updateMoonShop() {
  const container = document.getElementById('moonShopItems');
  if (!container) return;
  const money=getVisibleShards(state.playerData?.shards);
  const affordability=Object.entries(MOON_TYPES).map(([id,m])=>[getMoonPurchaseAccess(state,id).unlocked,money>=m.cost,money>=getMoonUpgradeCostForLevel(id,state.moonLevels[id]||1)]);
  const key=JSON.stringify([state.activeMoons,state.ownedMoons,state.moonLevels,state.maxSlots,state.cloneTargets,state.prestige?.upgrades,affordability,money,state.testMode]);
  if(key===moonShopKey&&container.childElementCount)return;moonShopKey=key;

  let html = '';
  
  for (const id of MOON_ORDER) {
    const moon=MOON_TYPES[id];
    const owned = state.ownedMoons.includes(id);
    const isActive = state.activeMoons.includes(id);
    const access=getMoonPurchaseAccess(state,id);
    const isLockedByLevel=!access.levelUnlocked,isLockedByMoon=!!access.requiredMoon;
    const moonLevel = owned ? (state.moonLevels[id] || 1) : 0;
    
    const canBuy = !owned && !isLockedByLevel && !isLockedByMoon &&
      (state.testMode || (getVisibleShards(state.playerData?.shards)) >= moon.cost) &&
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
        ${moon.baseStats.critChanceBonus > 0 ? `<div class="moon-shop-stat">🎯 +${(moon.baseStats.critChanceBonus * levelMultiplier * 100).toLocaleString('ru-RU',{maximumFractionDigits:2})}%</div>` : ''}
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
      (state.testMode || (getVisibleShards(state.playerData?.shards)) >= upgradeCost);
    
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
        actionsHtml += `<div class="purchase-split"><button title="${formatExact(displayUpgradeCost)} 💎" class="btn-moon-upgrade ${canUpgrade ? 'can-afford' : 'cannot-afford'}" ${canUpgrade ? '' : 'disabled'} onclick="window.gameEngine.upgradeMoon('${id}')">
          ${canUpgrade ? `⬆️ ${formatPrice(displayUpgradeCost)} 💎` : (moonLevel >= CONSTANTS.LIMITS.MAX_MOON_LEVEL ? 'MAX' : `Нужно ${formatPrice(displayUpgradeCost)} 💎`)}
        </button><button class="btn-moon-upgrade btn-buy-max ${canUpgrade ? 'can-afford' : 'cannot-afford'}" ${canUpgrade ? '' : 'disabled'} onclick="window.gameEngine.upgradeMoon('${id}',true)" title="Купить максимум уровней">MAX</button></div>`;
      } else {
        actionsHtml += `<button class="btn-moon-upgrade cannot-afford" disabled>MAX УРОВЕНЬ</button>`;
      }
    } else {
      if (moon.cost === 0) {
        actionsHtml += '<button class="btn-moon-free" disabled>Доступна</button>';
      } else if (isLockedByLevel||isLockedByMoon) {
        actionsHtml += '<button class="btn-moon-locked" disabled>🔒</button>';
      } else {
        actionsHtml += `<button title="${formatExact(displayCost)} 💎" class="btn-moon-buy ${canBuy ? 'can-afford' : 'cannot-afford'}" ${canBuy ? '' : 'disabled'} onclick="window.gameEngine.buyMoon('${id}')">
          ${canBuy ? `Купить ${formatPrice(displayCost)} 💎` : `Нужно ${formatPrice(displayCost)} 💎`}
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
        
        <div class="ufo-moon-trait">${escapeHTML(getUfoMoonDescription(id,moonLevel||1))}</div>
        ${owned ? `<div class="moon-shop-status"><div class="moon-level">⭐ Уровень: ${moonLevel} / ${CONSTANTS.LIMITS.MAX_MOON_LEVEL}</div></div>` : ''}
        ${isLockedByLevel && !owned ? `<div class="moon-shop-status"><div class="moon-locked">🔒 Нужен ${moon.unlockLevel} уровень в текущем забеге</div></div>` : ''}
        ${isLockedByMoon && !owned ? `<div class="moon-shop-status"><div class="moon-locked">🔗 Сначала купите: ${escapeHTML(MOON_TYPES[access.requiredMoon].name)}</div></div>` : ''}
        
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
      if (params.firstStrikeCrit) shadowDesc += `. Первый ручной удар — гарантированный крит ×${params.firstStrikeMultiplier} от обычного крита`;
      if (params.doubleCritChance > 0) shadowDesc += `. ${Math.round(params.doubleCritChance * 100)}% шанс двойного крита`;
      if (params.fullStackCritChance > 0) shadowDesc += `. При полном стаке +${Math.round(params.fullStackCritChance * 100)}% шанса крита`;
      return shadowDesc;
    
    case 'fire':
      let fireDesc = `Каждые ${params.clicksPerStack} кликов +${Math.round(params.bonusPerStack * 100)}% урона`;
      if (params.maxStacks === Infinity) {
        fireDesc += ` (неограниченно, но ${(params.resetChance * 100).toLocaleString('ru-RU')}% шанс сброса до ${params.safeStacks} стеков, если их больше)`;
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
      if (params.goldenClickChance > 0) goldDesc += `. ${(params.goldenClickChance * 100).toLocaleString('ru-RU')}% шанс +${params.goldenClickReward} 💎`;
      if (params.shardToDamageRatio > 0) goldDesc += `. +${(params.shardToDamageRatio * 100).toLocaleString('ru-RU',{maximumFractionDigits:6})}% урона от осколков`;
      return goldDesc;
    
    case 'clone': return 'Отражений: '+params.copies+' · оригинал и копия по '+Math.round(params.pairScale*100)+'% силы. Выбор оригиналов — над списком лун.';
    case 'cosmic':
      let cosmicDesc = `+${params.baseDamagePerLevel} базового урона за уровень, +${params.baseDamagePerKill.toLocaleString('ru-RU')} базового урона за убитую луну, +${Math.round(params.damagePerLevel * 100)}% урона, +${Math.round(params.shardPerLevel * 100)}% осколков, +${Math.round(params.critDamagePerLevel * 100)}% крит урона за уровень игрока`;
      if (params.critChancePerLevel>0) cosmicDesc += `. +${(params.critChancePerLevel*100).toLocaleString('ru-RU')}% шанса крита за уровень игрока`;
      return cosmicDesc;
    
    default:
      return '';
  }
}

function _updateSynergiesDisplay() {
  const container = document.getElementById('activeSynergies');
  if (!container) return;
  
  const synergies = window._activeSynergies || [];
  const key=JSON.stringify(synergies);if(container._synergyKey===key&&container.childElementCount)return;container._synergyKey=key;
  if (synergies.length === 0) {
    container.innerHTML = '<div class="no-synergies">Комбинируйте луны для активации синергий</div>';
    return;
  }
  
  let html = '';
  synergies.forEach(syn => {
    html += `
      <div class="synergy-badge tier-${syn.tier}" style="--tier-color: ${syn.tierColor}">
        <div class="synergy-icon">${syn.isClone ? '◈' : (syn.icon || '🔗')}</div>
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
  updatePrestigeUI();
  uiScheduler.schedule(() => {
    try{_updateProfile();}catch(error){console.error('[UI] Profile error:',error);}
    _updateLeaders().catch(error=>console.error('[UI] Leaders update error:',error));
  },0,'profile');
}

function _updateProfile() {
  const profileContent = document.getElementById('profileContent');
  if (!profileContent) return;
  
  if (!state.user) {
    if(profileContent.dataset.structureKey==='signed-out')return;
    profileContent.dataset.structureKey='signed-out';
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
  // Server updates (including wheel payouts) must not rebuild the entire profile.
  // Only changes to its structure (moon cards, synergies, identity) require a rebuild.
  const structureKey=JSON.stringify([state.user.id,state.user.email,state.user.user_metadata?.username,state.user.app_metadata?.login_mode,data.level||1,title,activeMoons,ownedMoons,activeMoons.map(id=>[id,state.moonLevels?.[id]]),ownedMoons.map(id=>[id,state.moonLevels?.[id]]),maxSlots,getSlotLimit(state),(window._activeSynergies||[]).map(b=>[b.key,b.tier,b.isClone])]);
  if(profileContent.dataset.structureKey===structureKey&&profileContent.querySelector('[data-live-stat="critDamage"]')){
    updateLiveCombatProfile();
    return;
  }
  profileContent.dataset.structureKey=structureKey;
  const combat=getCombatStats(state);
  const totalDamageBonus=combat.damageBonus,totalShardBonus=combat.shardBonus,totalCritChanceBonus=combat.critChanceBonus,totalCritDamageBonus=combat.critDamageBonus;
  const baseDamage=combat.baseDamage,finalDamage=combat.finalDamage,finalCritChance=Math.round(combat.critChance*100),finalCritMultiplier=(combat.critMultiplier*combat.critTier/2*(combat.firstStrikeMultiplier||1)).toLocaleString('ru-RU',{maximumFractionDigits:2});

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
      const moons = syn.moons || syn.key.split('+');
      const moonsHtml = moons.map(m => {
        const moon = MOON_TYPES[m];
        return moon ? `<span class="synergy-moon-emoji">${moon.emoji}</span>` : '';
      }).join('');
      
      synergiesHtml += `
        <div class="profile-synergy-card tier-${syn.tier}" style="--tier-color: ${syn.tierColor}">
          <div class="synergy-card-header">
            <div class="synergy-card-icon">${syn.isClone ? '◈' : syn.icon}</div>
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
        <div class="profile-email">${state.user.app_metadata?.login_mode === 'username' ? 'Вход по логину' : escapeHTML(state.user.email || '-')}</div>
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
            <div class="combat-stat-value" data-live-stat="baseDamage">${formatBaseDamage(baseDamage)}</div>
          </div>
        </div>
        <div class="combat-stat">
          <div class="combat-stat-icon">💥</div>
          <div class="combat-stat-info">
            <div class="combat-stat-label">Текущий урон · без случайных эффектов</div>
            <div class="combat-stat-value highlight" data-live-stat="finalDamage">${formatNumber(finalDamage)}</div>
          </div>
        </div>
        <div class="combat-stat">
          <div class="combat-stat-icon">🎯</div>
          <div class="combat-stat-info">
            <div class="combat-stat-label">Шанс крита</div>
            <div class="combat-stat-value" data-live-stat="critChance">${finalCritChance}%</div>
          </div>
        </div>
        <div class="combat-stat">
          <div class="combat-stat-icon">⚡</div>
          <div class="combat-stat-info">
            <div class="combat-stat-label">Урон крита</div>
            <div class="combat-stat-value" data-live-stat="critDamage">${formatNumber(combat.critDamage)} · ${finalCritMultiplier}×</div>
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
          <div class="bonus-card-value" data-live-stat="damageBonus">+${Math.round(totalDamageBonus * 100)}%</div>
        </div>
        <div class="bonus-card shard-bonus">
          <div class="bonus-card-icon">💎</div>
          <div class="bonus-card-label">Осколки</div>
          <div class="bonus-card-value" data-live-stat="shardBonus">+${Math.round(totalShardBonus * 100)}%</div>
        </div>
        <div class="bonus-card crit-chance-bonus">
          <div class="bonus-card-icon">🎯</div>
          <div class="bonus-card-label">Крит шанс</div>
          <div class="bonus-card-value" data-live-stat="critChanceBonus">+${Math.round(totalCritChanceBonus * 100)}%</div>
        </div>
        <div class="bonus-card crit-damage-bonus">
          <div class="bonus-card-icon">💥</div>
          <div class="bonus-card-label">Крит урон</div>
          <div class="bonus-card-value" data-live-stat="critDamageBonus">+${Math.round(totalCritDamageBonus * 100)}%</div>
        </div>
      </div>
    </div>

    <div class="profile-block"><div class="profile-block-header"><span class="block-icon">⏱️</span><span class="block-title">Действующие эффекты · сейчас</span></div><div id="liveCombatEffects" class="live-combat-effects"></div><p class="combat-live-note">Обновляется в реальном времени. Случайные молнии и двойные криты указаны отдельно от обычного урона.</p></div>
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
          <div class="stat-card-label">Всего кликов</div>
          <div class="stat-card-value" data-live-stat="lifetimeClicks">${formatNumber(data.total_clicks || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">👆</div>
          <div class="stat-card-label">Кликов в прохождении</div>
          <div class="stat-card-value" data-live-stat="runClicks">${formatNumber(state.runClickCount ?? state.clickCount ?? 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">🌘</div>
          <div class="stat-card-label">Убито лун</div>
          <div class="stat-card-value" data-live-stat="moonKills" title="Убийства в текущем прохождении, включая боссов">${formatNumber(state.moonKills || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">👹</div>
          <div class="stat-card-label">Боссов</div>
          <div class="stat-card-value" data-live-stat="bossKills">${state.bossKills || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">🌙</div>
          <div class="stat-card-label">Лун</div>
          <div class="stat-card-value">${ownedMoons.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">🎰</div>
          <div class="stat-card-label">Слотов</div>
          <div class="stat-card-value" data-live-stat="slots">${maxSlots}/${getSlotLimit(state)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">💎</div>
          <div class="stat-card-label">Всего осколков</div>
          <div class="stat-card-value" data-live-stat="shards">${formatMoney(getVisibleShards(data.shards))}</div>
        </div>
        <div class="stat-card casino-stat-card casino-stat-loss">
          <div class="stat-card-icon">📉</div>
          <div class="stat-card-label">Проиграно в казино</div>
          <div class="stat-card-value"><span data-live-stat="casinoLost">${formatMoney(getVisibleCasinoTotals(state.wheelEconomy).totalLost)}</span> 💎</div>
        </div>
        <div class="stat-card casino-stat-card casino-stat-win">
          <div class="stat-card-icon">📈</div>
          <div class="stat-card-label">Выиграно в казино</div>
          <div class="stat-card-value"><span data-live-stat="casinoWon">${formatMoney(getVisibleCasinoTotals(state.wheelEconomy).totalWon)}</span> 💎</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">⏱️</div>
          <div class="stat-card-label">В игре</div>
          <div class="stat-card-value" data-live-stat="playTime">${formatTime(state.totalSecondsPlayed || 0)}</div>
        </div>
      </div>
    </div>
  `;
  updateLiveCombatProfile();
}

export function updateLiveCombatProfile(){
 const panel=document.getElementById('profilePanel'),tab=document.getElementById('profileTabContent');
 if(!panel||panel.classList.contains('hidden')||tab&&!tab.classList.contains('active'))return;
 const s=getCombatStats(state),pct=n=>(n*100).toLocaleString('ru-RU',{maximumFractionDigits:2})+'%';
 const values={bossKills:String(state.bossKills||0),slots:(state.maxSlots||1)+'/'+getSlotLimit(state),shards:formatMoney(getVisibleShards(state.playerData?.shards)),playTime:formatTime(state.totalSecondsPlayed||0),casinoLost:formatMoney(getVisibleCasinoTotals(state.wheelEconomy).totalLost),casinoWon:formatMoney(getVisibleCasinoTotals(state.wheelEconomy).totalWon),lifetimeClicks:formatNumber(state.clickCount||0),runClicks:formatNumber(state.runClickCount??state.clickCount??0),moonKills:formatNumber(state.moonKills||0),baseDamage:formatBaseDamage(s.baseDamage),finalDamage:formatNumber(s.finalDamage),critChance:pct(s.critChance),
 critDamage:formatNumber(s.critDamage)+' · '+(s.critMultiplier*s.critTier/2*(s.firstStrikeMultiplier||1)).toLocaleString('ru-RU',{maximumFractionDigits:2})+'×'+(s.extraCritChance?' · '+pct(s.extraCritChance)+' → '+formatNumber(s.nextCritDamage):''),
 damageBonus:'+'+pct(s.damageBonus),shardBonus:'+'+pct(s.shardBonus),critChanceBonus:'+'+pct(s.critChanceBonus),critDamageBonus:'+'+pct(s.critDamageBonus)};
 for(const [key,text]of Object.entries(values)){const el=document.querySelector('[data-live-stat="'+key+'"]');if(el&&el.textContent!==text)el.textContent=text;}
 const rows=s.sources.filter(b=>b.damage||b.shards||b.crit||b.critDamage).map(b=>b.name+': '+[['урон',b.damage],['добыча',b.shards],['шанс крита',b.crit],['крит. урон',b.critDamage]].filter(([,v])=>v).map(([label,v])=>label+' +'+pct(v)).join(' · '));
 if(s.echoChance){const full=Math.floor(s.echoChance),extra=s.echoChance-full;rows.push('🔊 Эхо выстрела: '+full+' гарант. повторов'+(extra?' · '+pct(extra)+' шанс ещё одного':'')+' · '+pct(s.echoDamage)+' урона');}
 if(state.pendingEchoes)rows.push('🔊 Ожидают эха: '+formatNumber(state.pendingEchoes)+' повторов');
 if(s.crystalsPerClick)rows.push('💠 Кристалл за клик: +'+formatMoney(s.crystalsPerClick)+' 💎 за клик или выстрел тарелки');
 if(s.cloneTargets?.length)rows.push('🪞 Клон: '+s.cloneTargets.map(id=>MOON_TYPES[id].name+' ×'+getMoonPower(state,id).toLocaleString('ru-RU')).join(' · '));
 if(s.baseDamageBonus)rows.push('Космическая луна: +'+formatBaseDamage(s.baseDamageBonus)+' базового урона (уровень и убийства)');
 if(s.goldMultiplier!==1)rows.push('Золотая луна: награда ×'+s.goldMultiplier);
 if(s.fullCombo)rows.push('Полное комбо: бонус добычи активен');
 if(s.firstStrike)rows.push('Тень: первый ручной удар — гарантированный крит ×'+s.firstStrikeMultiplier.toLocaleString('ru-RU',{maximumFractionDigits:2})+' от обычного крита');
 if(s.nextPierce)rows.push('Лёд: следующий удар — пронзающий');
 if(s.execute)rows.push('Кровь: добивание босса активно');
 rows.push('За текущую луну: '+formatMoney(s.moonReward)+' 💎');
 if(state.ufoLevel)rows.push('Флот: '+s.ufoCount+' тарелок · '+formatNumber(s.ufoDamage)+' урона · интервал '+(s.ufoInterval/1000).toLocaleString('ru-RU')+' с · урон +'+pct(s.ufoDamageBonus)+' · крит '+pct(s.ufoCritChance)+(s.ufoChainEvery?' · цепь каждые '+s.ufoChainEvery+' выстрелов':''));
 const electric=(state.activeMoons||[]).includes('electric')?getMoonMechanicParams('electric',state.moonLevels?.electric||1):null;
 if(electric)rows.push('Молнии: случайные ×2 / ×5 / ×10; накопление неудач '+(state.runtime?._pityClicks||0));
 const target=document.getElementById('liveCombatEffects'),signature=JSON.stringify(rows);
 if(target&&target.dataset.signature!==signature){
  const icons={'Эхо выстрела':'🔊','Ожидают эха':'🔊','Кристалл за клик':'💠','Клон':'🪞','Космическая луна':'🌌','Золотая луна':'🌟','Полное комбо':'✨','Тень':'🌑','Лёд':'🧊','Кровь':'🩸','За текущую луну':'💎','Флот':'🛸','Молнии':'⚡'};
  const metricIcons={'урон':'⚔️','добыча':'💎','шанс крита':'🎯','крит. урон':'💥'};
  target.replaceChildren();
  for(const text of rows){
   const split=text.indexOf(':'),title=split<0?text:text.slice(0,split),details=split<0?'Активно':text.slice(split+1).trim();
   const icon=icons[title]||'✨';
   const tile=document.createElement('div');tile.className='combat-effect-tile';tile.tabIndex=0;tile.setAttribute('aria-label',title+': '+details);tile.title=title+': '+details;
   const heading=document.createElement('div');heading.className='combat-effect-heading';
   const symbol=document.createElement('span');symbol.className='combat-effect-symbol';symbol.textContent=icon;
   const label=document.createElement('span');label.className='combat-effect-label';label.textContent=title;
   heading.append(symbol,label);tile.appendChild(heading);
   const formula=document.createElement('div');formula.className='combat-effect-formula';
   // Keep every value and separator visible; replace only metric names with recognizable symbols.
   const pieces=details.split(/(крит\. урон|шанс крита|добыча|урон)/gi);
   for(const piece of pieces){
    const key=piece.toLowerCase(),symbol=metricIcons[key];
    if(symbol){const metric=document.createElement('span');metric.className='combat-effect-metric';metric.textContent=symbol;metric.title=piece;metric.setAttribute('aria-label',piece);formula.appendChild(metric);}
    else formula.appendChild(document.createTextNode(piece));
   }
   tile.appendChild(formula);target.appendChild(tile);
  }
  target.dataset.signature=signature;
 }
}

function refreshLeaderOnlineMarkers(){
 const list=document.getElementById('leadersList');if(!list)return;
 for(const marker of list.querySelectorAll('[data-online-player]')){
  const online=db.leaderboardPresence?.isOnline(marker.dataset.onlinePlayer)||false;
  const ready=db.leaderboardPresence?.isReady?.()||false;
  marker.classList.toggle('is-online',online);
  marker.title=online?'В игре сейчас':ready?'Не в сети':'Проверяем онлайн…';
  marker.setAttribute('aria-label',online?'Онлайн':ready?'Не в сети':'Подключаем онлайн');
 }
}
let onlineListenerAttached=false;
let leadersUpdatedAt = 0;
let leadersInFlight = false;

async function _updateLeaders() {
  if(!onlineListenerAttached&&db.leaderboardPresence){db.leaderboardPresence.subscribe(refreshLeaderOnlineMarkers);onlineListenerAttached=true;}
  const panel = document.getElementById('profilePanel');
  const tab = document.getElementById('leadersTabContent');
  if (!panel || panel.classList.contains('hidden') || !tab?.classList.contains('active')) return;
  if (leadersInFlight || Date.now() - leadersUpdatedAt < 30000) return;
  const leadersList = document.getElementById('leadersList');
  if (!leadersList) return;

  try {
    leadersInFlight = true;
    const leaders = await db.getLeaders(CONSTANTS.LIMITS.MAX_LEADERS || 10);
    leadersUpdatedAt = Date.now();

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
          <div class="leader-name">${escapeHTML(p.username || 'Аноним')} <span class="leader-online-dot" data-online-player="${escapeHTML(p.player_id || '')}" title="Проверяем онлайн…" aria-label="Подключаем онлайн"></span></div>
          <div class="leader-level" title="Максимальный достигнутый уровень">Макс. ур. ${p.max_level || p.level || 0}</div>
          <div class="leader-clicks">👆 ${formatNumber(p.total_clicks || 0)}</div>
        </div>
      `;
    });
    leadersList.innerHTML = html;
    refreshLeaderOnlineMarkers();
  } catch (error) {
    console.error('[UI] Leaders error:', error);
    leadersList.innerHTML = '<div class="error-data">Ошибка загрузки</div>';
  } finally {
    leadersInFlight = false;
  }
}

// ============================================================
// ЗВЁЗДЫ
// ============================================================
export function createStars(count=300){renderStarfield(document.getElementById('stars'),count);}

// ============================================================
// КВЕСТЫ
// ============================================================
export function setQuestCategory(category) {
  currentQuestCategory = category;
  updateQuestUI();
}

let questPaintAt=0,questCategory='';
export function updateQuestUI() {
  if(document.getElementById('shopPanel')?.classList.contains('hidden')||!document.getElementById('questsTabContent')?.classList.contains('active'))return;
  const readyQuests=Object.entries(state.quests||{}).filter(([id,q])=>QUESTS[id]&&q.completed&&!q.claimed),collect=document.getElementById('claimAllQuestsBtn');
  if(collect){collect.disabled=!readyQuests.length||collect.dataset.pending==='1';collect.textContent=readyQuests.length?'Собрать все · '+readyQuests.length+' наград (+'+formatMoney(readyQuests.reduce((n,[id])=>n+getQuestPayout(QUESTS[id],state).total,0))+' 💎)':'Нет доступных наград';}
  if(Date.now()-questPaintAt<250&&questCategory===currentQuestCategory)return;questPaintAt=Date.now();questCategory=currentQuestCategory;
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
            <span class="reward-value">💎 ${getQuestPayout(questData,state).base}</span>
            ${questData.bonusReward ? `<span class="bonus-reward">+${getQuestPayout(questData,state).bonus}</span>` : ''}
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

let achievementPaintAt=0,achievementCategory='';
export function updateAchievementUI() {
  if(document.getElementById('shopPanel')?.classList.contains('hidden')||!document.getElementById('achievementsTabContent')?.classList.contains('active'))return;
  const readyAchievements=Object.entries(ACHIEVEMENTS).flatMap(([id,def])=>def.tiers.filter(tier=>state.achievements?.[id]?.[tier.level]==='unclaimed')),collect=document.getElementById('claimAllAchievementsBtn');
  if(collect){collect.disabled=!readyAchievements.length||collect.dataset.pending==='1';collect.textContent=readyAchievements.length?'Собрать все · '+readyAchievements.length+' наград (+'+formatMoney(readyAchievements.reduce((n,tier)=>n+getProgressReward(tier.reward,state),0))+' 💎)':'Нет доступных наград';}
  if(Date.now()-achievementPaintAt<250&&achievementCategory===currentAchievementCategory)return;achievementPaintAt=Date.now();achievementCategory=currentAchievementCategory;
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
              <div class="tier-reward">💎 ${getProgressReward(tier.reward,state)}</div>
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

export function updateQuestAndAchievementUI(force=false) {
  if(force){questPaintAt=0;achievementPaintAt=0;}
  updateQuestUI();
  updateAchievementUI();
}
// ============================================================
// ОТОБРАЖЕНИЕ АКТИВНЫХ БАФОВ (БЕЗ МОРГАНИЙ)
// ============================================================
export function updateBuffsDisplay() {
  const container = document.getElementById('buffsContainer');
  if (!container) return;
  
  const buffs = window._activeBuffs || [];
  const structure=JSON.stringify(buffs.map(b=>[b.id,b.isPassive,b.timeLeft!=null,b.isReflection,b.cloneOf,b.name,b.icon]));
  if(buffs.length&&container._buffStructure===structure&&container.childElementCount){
    for(const buff of buffs){
      const card=container.querySelector('[data-buff-id="'+buff.id+'"]');if(!card)continue;
      let stateClass=buff.isPassive?'buff-passive':buff.isMaxed?'buff-maxed':buff.isActive?'buff-active':'buff-charging';
      if(buff.isConditional&&!buff.isActive)stateClass='buff-inactive';
      for(const cls of ['buff-passive','buff-maxed','buff-active','buff-charging','buff-inactive'])card.classList.toggle(cls,cls===stateClass);
      for(const [selector,text]of [['.buff-bonus',buff.bonus],['.buff-stacks',buff.value+'/'+buff.maxStacks],['.buff-timer',buff.timeLeft+'с']]){
        const el=card.querySelector(selector);if(el&&el.textContent!==text)el.textContent=text;
      }
      const timer=card.querySelector('.buff-timer');timer?.classList.toggle('buff-timer-warning',buff.timeLeft<=5);
      const progress=card.querySelector('.buff-progress-bar');if(progress){const transform='scaleX('+Math.max(0,Math.min(1,buff.progress/(buff.progressMax||1)))+')';if(progress.style.transform!==transform)progress.style.transform=transform;}
    }
    return;
  }
  container._buffStructure=structure;
  if (buffs.length === 0) {
    if (!container.classList.contains('buffs-empty')) {
      container.innerHTML = '';
      container.classList.add('buffs-empty');
      container.style.display = 'none';
    }
    window._lastBuffIds = new Set();
    return;
  }
  
  container.classList.remove('buffs-empty');
  container.style.display = 'flex';
  
  const currentBuffIds = new Set(buffs.map(b => b.id));
  const lastBuffIds = window._lastBuffIds || new Set();
  
  const newBuffIds = new Set();
  currentBuffIds.forEach(id => {
    if (!lastBuffIds.has(id)) newBuffIds.add(id);
  });
  
  window._lastBuffIds = currentBuffIds;
  
  let html = '';
  buffs.forEach(buff => {
    const progressPercent = buff.progressMax > 0 
      ? (buff.progress / buff.progressMax) * 100 
      : 0;
    
    let stateClass = 'buff-charging';
    if (buff.isPassive) {
      stateClass = 'buff-passive';
    } else if (buff.isMaxed) {
      stateClass = 'buff-maxed';
    } else if (buff.isActive) {
      stateClass = 'buff-active';
    }
    
    if (buff.isConditional && !buff.isActive) {
      stateClass = 'buff-inactive';
    }
    
    let timerHtml = '';
    if (buff.timeLeft !== null && buff.timeLeft !== undefined) {
      const timerClass = buff.timeLeft <= 5 ? 'buff-timer-warning' : '';
      timerHtml = `<div class="buff-timer ${timerClass}">${buff.timeLeft}с</div>`;
    }
    
    const progressHtml = !buff.isPassive ? `
      <div class="buff-progress">
        <div class="buff-progress-bar" style="transform:scaleX(${Math.max(0,Math.min(1,progressPercent/100))})"></div>
      </div>
      <div class="buff-stacks">${buff.value}/${buff.maxStacks}</div>
    ` : '';
    
    const isNew = newBuffIds.has(buff.id);
    const newClass = isNew ? 'buff-new' : '';
    
    html += `
      <div class="buff-card ${stateClass} ${newClass} ${buff.isReflection ? 'buff-reflection' : ''}" data-buff-id="${buff.id}"${buff.isReflection ? ' data-clone-of="'+buff.cloneOf+'"' : ''}>
        <div class="buff-header">
          <div class="buff-icon">${buff.icon}</div>
          <div class="buff-info">
            <div class="buff-name">${buff.name}</div>
            <div class="buff-bonus">${buff.bonus}</div>
          </div>
          ${timerHtml}
        </div>
        ${progressHtml}
      </div>
    `;
  });
  
  // Обновляем DOM только если HTML изменился
  if (container._lastHTML !== html) {
    container.innerHTML = html;
    container._lastHTML = html;
    
    if (newBuffIds.size > 0) {
      setTimeout(() => {
        container.querySelectorAll('.buff-new').forEach(el => {
          el.classList.remove('buff-new');
        });
      }, 500);
    }
  }
}
// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
if (typeof window !== 'undefined') {
  window.updateProfileAndLeaders = updateProfileAndLeaders;
  window.updateShopUI = updateShopUI;
  window.updateQuestUI = updateQuestUI;
  window.updateAchievementUI = updateAchievementUI;
  window.updatePrestigeUI = updatePrestigeUI;
  window.updateQuestAndAchievementUI = updateQuestAndAchievementUI;
  window.updateTimerBar = updateTimerBar;
  window.updateBuffsDisplay = updateBuffsDisplay;  // ← ЭТА СТРОКА ОБЯЗАТЕЛЬНА
  window.showToast = showToast;
  window._setQuestCategory = setQuestCategory;
  window._setAchievementCategory = setAchievementCategory;
}

function _updateClickCrystalShop(){
 const level=state.clickCrystalLevel||0,cost=getClickCrystalCost(level),price=document.getElementById('clickCrystalPrice'),info=document.getElementById('clickCrystalInfo'),button=document.getElementById('buyClickCrystalBtn');
 if(price){price.textContent=formatPrice(cost)+' 💎';price.title=formatExact(cost)+' 💎';}
 if(info)info.textContent='Ур. '+level+' · '+formatMoney(level)+' → '+formatMoney(level+1)+' 💎 за клик';
 if(button)button.disabled=(getVisibleShards(state.playerData?.shards))<cost;
  const crystalMax=document.getElementById('buyClickCrystalBtnMax');if(crystalMax)crystalMax.disabled=button?.disabled??true;
}
let cloneControlKey='';
function _updateCloneControls(){
 const root=document.getElementById('cloneControls'),fields=document.getElementById('cloneTargetFields');if(!root||!fields)return;
 const enabled=(state.activeMoons||[]).includes('clone');root.classList.toggle('hidden',!enabled);if(!enabled)return;
 const key=JSON.stringify([state.activeMoons,state.moonLevels,state.cloneTargets]);if(key===cloneControlKey&&fields.childElementCount)return;cloneControlKey=key;
 const p=getMoonMechanicParams('clone',state.moonLevels.clone||1),targets=getCloneTargets(state);fields.replaceChildren();
 for(let i=0;i<p.copies;i++){
  const label=document.createElement('label');label.textContent='Оригинал '+(i+1);
  const select=document.createElement('select');select.id='cloneOriginal'+i;
  for(const id of ['',...(state.activeMoons||[]).filter(id=>id!=='clone')]){const option=document.createElement('option');option.value=id;option.textContent=id?MOON_TYPES[id].emoji+' '+MOON_TYPES[id].name+' · Ур. '+(state.moonLevels[id]||1):'Не выбран';select.appendChild(option);}
  select.value=targets[i]||'';label.appendChild(select);fields.appendChild(label);
 }
 const summary=document.getElementById('cloneSummary');if(summary)summary.textContent='Оригинал и отражение: по '+Math.round(p.pairScale*100)+'% силы · отражений '+p.copies;
}
