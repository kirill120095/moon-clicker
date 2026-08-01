// ============================================================
// ОСНОВНАЯ ИГРОВАЯ ЛОГИКА - НОВАЯ СИСТЕМА МЕХАНИК
// ============================================================
import { appState, state } from '../../core/state.js';
import { 
  CONSTANTS, MOON_TYPES, SYNERGY_BONUSES, ACHIEVEMENTS, QUESTS, RARITY_CONFIG,
  getMoonMechanicParams, getMoonUpgradeCostForLevel
} from '../../core/constants.js';
import { 
  getMaxHPForLevel, isBossLevel, getSlotUpgradeCost 
} from '../../core/config.js';
import { db } from '../network/supabase.js';
import { 
  showToast, updateUI, updateShopUI, updateProfileAndLeaders, 
  updateQuestAndAchievementUI, updateQuestUI, updateAchievementUI,
  updateTimerBar, setLockIcon 
} from '../ui/renderer.js';
import { CombatSystem } from './combat.js';
import { RewardSystem } from './rewards.js';
import { animations } from '../ui/animations.js';

export class GameEngine {
  constructor() {
    this.combat = new CombatSystem();
    this.rewards = new RewardSystem();
    
    this._isPurchaseProcessing = false;
    this._lastSave = 0;
    this._saveInterval = CONSTANTS.INTERVALS.SAVE_TIME;
    this._lastClickEvent = null;
    
    this._lastClickTime = 0;
    this._minClickInterval = 16;
    
    // Счётчики механик (сбрасываются при бездействии)
    this._comboClicks = 0;
    this._fireStacks = 0;
    this._shadowCritStacks = 0;
    this._clickCounter = 0;
    this._pityClicks = 0; // Для электрической луны
    this._superconductorClicksLeft = 0; // Для электрической ур. 7
    this._firstStrikeUsed = false; // Для теневой ур. 5
    this._newMoon = true; // Флаг новой луны (для первого удара)
    
    // Таймер активности
    this._lastActivityTime = Date.now();
    this._activityCheckInterval = null;
    this._ACTIVITY_TIMEOUT = 15000;
    this._buffsAlreadyReset = false;
    
    // Подписки
    this._unsubscribeMain = appState.subscribeMany(
      ['currentLevel', 'moonHP', 'maxHP', 'activeMoons', 'maxSlots'],
      () => this._onStateChange()
    );
    
    this._unsubscribeTimer = appState.subscribe('bossTimer', () => updateTimerBar());
    this._unsubscribeTimerRunning = appState.subscribe('bossTimerRunning', () => updateTimerBar());
  }

  init() {
    const level = state.currentLevel;
    const newMax = getMaxHPForLevel(level, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
    appState.set('maxHP', newMax);

    if (state.moonHP > newMax) appState.set('moonHP', newMax);
    if (state.moonHP < 0) appState.set('moonHP', 0);

    this._startTimeTracking();
    this._startAutoSave();
    this._startActivityCheck();
    this._checkBoss();
    this.recalcMoonBonuses();
    this._ensureDailyQuests();
    this.checkAchievements();
    this._updateBuffsDisplay();

    updateUI();
    updateTimerBar();
    updateShopUI();
    updateProfileAndLeaders();
    updateQuestAndAchievementUI();

    console.log('[Game] Инициализация завершена');
  }

  // ============================================================
  // ПРОВЕРКА АКТИВНОСТИ
  // ============================================================
  _startActivityCheck() {
    if (this._activityCheckInterval) clearInterval(this._activityCheckInterval);
    
    this._activityCheckInterval = setInterval(() => {
      const timeSinceLastClick = Date.now() - this._lastActivityTime;
      
      if (timeSinceLastClick >= this._ACTIVITY_TIMEOUT) {
        // Проверяем, есть ли механики с resetTimeout
        const mechanics = this._getActiveMechanics();
        let shouldReset = false;
        
        // Обычная луна (combo)
        if (mechanics.includes('combo')) {
          const normalParams = this._getMechanicParamsForActiveMoon('normal');
          const timeout = normalParams?.resetTimeout || 15000;
          if (timeSinceLastClick >= timeout && this._comboClicks > 0) {
            shouldReset = true;
          }
        }
        
        // Огненная луна (fireStacks)
        if (mechanics.includes('fireStacks')) {
          const fireParams = this._getMechanicParamsForActiveMoon('fire');
          const timeout = fireParams?.resetTimeout || 15000;
          if (timeSinceLastClick >= timeout && this._fireStacks > 0) {
            shouldReset = true;
          }
        }
        
        // Теневая луна (shadowCritStacks)
        if (mechanics.includes('shadowCritStacks')) {
          const shadowParams = this._getMechanicParamsForActiveMoon('shadow');
          const timeout = shadowParams?.resetTimeout || 15000;
          if (timeSinceLastClick >= timeout && this._shadowCritStacks > 0) {
            shouldReset = true;
          }
        }
        
        if (shouldReset && !this._buffsAlreadyReset) {
          this._comboClicks = 0;
          this._fireStacks = 0;
          this._shadowCritStacks = 0;
          this._buffsAlreadyReset = true;
          this._updateBuffsDisplay();
        }
      }
      
      this._updateBuffsDisplay();
    }, 500);
  }

  _getMechanicParamsForActiveMoon(moonId) {
    if (!state.activeMoons.includes(moonId)) return null;
    const moonLevel = state.moonLevels[moonId] || 1;
    return getMoonMechanicParams(moonId, moonLevel);
  }

  handleClick = (e) => {
    const now = performance.now();
    if (now - this._lastClickTime < this._minClickInterval) return;
    this._lastClickTime = now;

    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (state.moonHP <= 0) return;

    this._lastActivityTime = Date.now();
    this._buffsAlreadyReset = false;

    this._processClickSync(e);
  };

  _processClickSync(e) {
    const baseDamage = state.playerData?.click_damage || CONSTANTS.DEFAULTS.CLICK_DAMAGE;
    const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
    
    const bonuses = this._calculateAllBonuses();
    const result = this._applyMoonMechanics(baseDamage, bonuses, isBoss);
    const { finalDamage, isCrit, specialEffect } = result;
    
    appState.incrementClickCount();
    animations.setBaseDamage(baseDamage);
    
    let killed = false;
    if (state.testMode) {
      appState.set('moonHP', 0);
      killed = true;
    } else {
      const newHP = Math.max(0, state.moonHP - finalDamage);
      appState.set('moonHP', newHP);
      killed = newHP === 0;
    }
    
    this._lastClickEvent = e;
    if (e) {
      animations.playClickVisualFeedback(e, finalDamage, isCrit, isBoss);
      
      if (specialEffect === 'megaStrike') {
        animations.createParticles(null, {
          count: 40, color: '#fdd835', size: 8,
          duration: 1200, spread: 200,
          x: e.clientX, y: e.clientY
        });
      } else if (specialEffect === 'fireStack') {
        animations.createParticles(null, {
          count: 15, color: '#ff6f00', size: 5,
          duration: 800, spread: 100,
          x: e.clientX, y: e.clientY
        });
      } else if (specialEffect === 'chainLightning') {
        animations.createParticles(null, {
          count: 25, color: '#fff176', size: 6,
          duration: 1000, spread: 150,
          x: e.clientX, y: e.clientY
        });
      } else if (specialEffect === 'icePierce') {
        animations.createParticles(null, {
          count: 20, color: '#4fc3f7', size: 6,
          duration: 900, spread: 120,
          x: e.clientX, y: e.clientY
        });
      }
    }
    
    this._applyClickEffect();
    this.updateQuestProgress('click', 1);
    this._updateBuffsDisplay();
    
    updateUI();
    updateQuestUI();
    
    this._scheduleSave();
    
    if (killed) {
      this._onMoonDefeated(isBoss);
    }
  }

  // ============================================================
  // РАСЧЁТ ВСЕХ БОНУСОВ (С УЧЁТОМ ПРОКАЧКИ ЛУН)
  // ============================================================
  _calculateAllBonuses() {
    let totalDamageBonus = 0;
    let totalShardBonus = 0;
    let totalCritChanceBonus = 0;
    let totalCritDamageBonus = 0;
    
    const activeIds = (state.activeMoons || []).slice(0, state.maxSlots);
    
    activeIds.forEach(id => {
      const moon = MOON_TYPES[id];
      if (!moon) return;
      
      const moonLevel = state.moonLevels[id] || 1;
      const levelMultiplier = 1 + (moonLevel - 1) * 0.05;
      
      // Базовые статы с учётом уровня
      totalDamageBonus += (moon.baseStats.damageBonus || 0) * levelMultiplier;
      totalShardBonus += (moon.baseStats.shardBonus || 0) * levelMultiplier;
      totalCritChanceBonus += (moon.baseStats.critChanceBonus || 0) * levelMultiplier;
      totalCritDamageBonus += (moon.baseStats.critDamageBonus || 0) * levelMultiplier;
      
      // Космическая луна - бонусы от уровня игрока
      if (moon.specialMechanic === 'scaling') {
        const cosmicParams = getMoonMechanicParams(id, moonLevel);
        const levelBonus = state.currentLevel;
        totalDamageBonus += cosmicParams.damagePerLevel * levelBonus;
        totalShardBonus += cosmicParams.shardPerLevel * levelBonus;
        totalCritDamageBonus += cosmicParams.critDamagePerLevel * levelBonus;
      }
      
      // Золотая луна ур. 10 - +0.1% урона от осколков
      if (moon.specialMechanic === 'goldRush') {
        const goldParams = getMoonMechanicParams(id, moonLevel);
        if (goldParams.shardToDamageRatio > 0) {
          const shards = state.playerData?.shards || 0;
          totalDamageBonus += shards * goldParams.shardToDamageRatio;
        }
      }
    });
    
    // Синергии
    if (activeIds.length > 1 && state.maxSlots > 1) {
      const sortedActive = [...activeIds].sort();
      
      for (const [key, bonus] of Object.entries(SYNERGY_BONUSES)) {
        const moons = key.split('+').sort();
        if (moons.every(m => sortedActive.includes(m))) {
          totalDamageBonus += bonus.damageBonus || 0;
          totalShardBonus += bonus.shardBonus || 0;
          totalCritChanceBonus += bonus.critChanceBonus || 0;
          totalCritDamageBonus += bonus.critDamageBonus || 0;
        }
      }
      
      if (sortedActive.includes('normal') && sortedActive.length > 1) {
        totalDamageBonus += 0.05;
        totalShardBonus += 0.05;
      }
    }
    
    return { totalDamageBonus, totalShardBonus, totalCritChanceBonus, totalCritDamageBonus };
  }

  // ============================================================
  // ПРИМЕНЕНИЕ МЕХАНИК ЛУН (ПОЛНАЯ ПЕРЕРАБОТКА)
  // ============================================================
  _applyMoonMechanics(baseDamage, bonuses, isBoss) {
    const mechanics = this._getActiveMechanics();
    let damageMultiplier = 1 + bonuses.totalDamageBonus;
    let critChance = Math.min(0.95, 0.05 + bonuses.totalCritChanceBonus);
    let critDamageMultiplier = 2 + bonuses.totalCritDamageBonus;
    let finalMultiplier = 1; // Применяется в самом конце
    let specialEffect = null;
    
    this._clickCounter++;
    
    // ============================================================
    // 🌙 ОБЫЧНАЯ ЛУНА: Комбо-мастер
    // ============================================================
    if (mechanics.includes('combo')) {
      const params = this._getMechanicParamsForActiveMoon('normal');
      if (params) {
        this._comboClicks++;
        const stacks = Math.min(
          Math.floor(this._comboClicks / params.clicksPerStack), 
          params.maxStacks
        );
        damageMultiplier += stacks * params.bonusPerStack;
        // Комбо НЕ сбрасывается при макс. стеках — только по таймауту бездействия
        // _comboClicks ограничен сверху, чтобы не рос бесконечно
        const maxClicks = params.clicksPerStack * params.maxStacks;
        if (this._comboClicks > maxClicks) {
          this._comboClicks = maxClicks;
        }
      }
    }
    
    // ============================================================
    // 🔥 ОГНЕННАЯ ЛУНА: Накопление жара
    // ============================================================
    if (mechanics.includes('fireStacks')) {
      const params = this._getMechanicParamsForActiveMoon('fire');
      if (params) {
        this._fireStacks = Math.min(this._fireStacks + 1, params.maxStacks);
        const stacks = Math.floor(this._fireStacks / params.clicksPerStack);
        damageMultiplier += stacks * params.bonusPerStack;
        
        // Визуальный эффект при новом стеке
        if (this._fireStacks % params.clicksPerStack === 0 && this._fireStacks > 0) {
          specialEffect = 'fireStack';
        }
        
        // Уровень 10: шанс сброса после safeStacks
        if (params.maxStacks === Infinity && this._fireStacks > params.safeStacks) {
          if (Math.random() < params.resetChance) {
            this._fireStacks = 0;
          }
        }
      }
    }
    
    // ============================================================
    // 🌑 ТЕНЕВАЯ ЛУНА: Крит стеки
    // ============================================================
    if (mechanics.includes('shadowCritStacks')) {
      const params = this._getMechanicParamsForActiveMoon('shadow');
      if (params) {
        this._shadowCritStacks++;
        const stacks = Math.min(
          Math.floor(this._shadowCritStacks / params.clicksPerStack), 
          params.maxStacks
        );
        critDamageMultiplier += stacks * params.critDamagePerStack;
        
        // Уровень 5: Первый удар = гарантированный крит
        if (params.firstStrikeCrit && this._firstStrikeUsed === false && this._newMoon) {
          critChance = 1.0;
          this._firstStrikeUsed = true;
        }
        
        // Уровень 10: при полном стаке +10% к шансу крита
        if (params.fullStackCritChance > 0 && stacks >= params.maxStacks) {
          critChance = Math.min(0.95, critChance + params.fullStackCritChance);
        }
        
        // Тень НЕ сбрасывается при макс. стеках — только по таймауту бездействия
        const maxShadowClicks = params.clicksPerStack * params.maxStacks;
        if (this._shadowCritStacks > maxShadowClicks) {
          this._shadowCritStacks = maxShadowClicks;
        }
      }
    }
    
    // ============================================================
    // 🩸 КРОВАВАЯ ЛУНА: Бонус при низком HP босса
    // ============================================================
    if (mechanics.includes('bloodMoon') && isBoss) {
      const params = this._getMechanicParamsForActiveMoon('blood');
      if (params) {
        const hpRatio = state.moonHP / state.maxHP;
        
        if (hpRatio < params.hpThreshold) {
          damageMultiplier += params.damageBonus;
        }
        
        // Мгновенное убийство
        if (params.executeThreshold > 0 && hpRatio <= params.executeThreshold) {
          damageMultiplier = 999; // Гарантированное убийство
        }
      }
    }
    
    // ============================================================
    // ❄️ ЛЕДЯНАЯ ЛУНА: Заморозка + пронзающий удар
    // ============================================================
    if (mechanics.includes('freeze')) {
      const params = this._getMechanicParamsForActiveMoon('ice');
      if (params && params.pierceInterval > 0) {
        if (this._clickCounter % params.pierceInterval === 0) {
          damageMultiplier += params.pierceDamage;
          specialEffect = 'icePierce';
        }
      }
    }
    
    // ============================================================
    // ⚡ ЭЛЕКТРИЧЕСКАЯ ЛУНА: Цепная молния
    // ============================================================
    if (mechanics.includes('chainLightning')) {
      const params = this._getMechanicParamsForActiveMoon('electric');
      if (params) {
        // Уровень 5: pity система (накопление шанса)
        let pityBonus = 0;
        if (params.pityMax > 0) {
          pityBonus = Math.min(this._pityClicks * params.pityBonus, params.pityMax);
        }
        
        const roll = Math.random();
        const effectiveX2 = params.chanceX2 + pityBonus;
        const effectiveX5 = params.chanceX5 + pityBonus;
        const effectiveX10 = params.chanceX10 + pityBonus;
        
        if (roll < effectiveX10) {
          finalMultiplier *= 10;
          specialEffect = 'chainLightning';
          this._pityClicks = 0;
          this._superconductorClicksLeft = params.superconductorClicks || 0;
        } else if (roll < effectiveX5 + effectiveX10) {
          finalMultiplier *= 5;
          specialEffect = 'chainLightning';
          this._pityClicks = 0;
          this._superconductorClicksLeft = params.superconductorClicks || 0;
        } else if (roll < effectiveX2 + effectiveX5 + effectiveX10) {
          finalMultiplier *= 2;
          specialEffect = 'chainLightning';
          this._pityClicks = 0;
          this._superconductorClicksLeft = params.superconductorClicks || 0;
        } else {
          this._pityClicks++;
        }
        
        // Уровень 7: Сверхпроводник - следующие N кликов +50% урона
        if (this._superconductorClicksLeft > 0) {
          damageMultiplier += params.superconductorBonus;
          this._superconductorClicksLeft--;
        }
      }
    }
    
    // ============================================================
    // 👑 ЗОЛОТАЯ ЛУНА: Золотой клик (обрабатывается отдельно)
    // ============================================================
    // (обрабатывается в _onMoonDefeated и при клике)
    
    // ============================================================
    // ✨ КОСМИЧЕСКАЯ ЛУНА: Бонусы уже учтены в _calculateAllBonuses
    // ============================================================
    
    // Применяем базовый урон с множителем
    let finalDamage = Math.max(1, Math.round(baseDamage * damageMultiplier));
    
    // Критический удар
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      finalDamage = Math.round(finalDamage * critDamageMultiplier);
      
      // Теневая ур. 7: двойной крит
      if (mechanics.includes('shadowCritStacks')) {
        const params = this._getMechanicParamsForActiveMoon('shadow');
        if (params && params.doubleCritChance > 0 && Math.random() < params.doubleCritChance) {
          finalDamage = Math.round(finalDamage * (1 + critDamageMultiplier / 2));
        }
      }
    }
    
    // Применяем финальный множитель (электрическая)
    finalDamage = Math.round(finalDamage * finalMultiplier);
    
    // Золотой клик (отдельная проверка)
    if (mechanics.includes('goldRush')) {
      const params = this._getMechanicParamsForActiveMoon('gold');
      if (params && params.goldenClickChance > 0) {
        if (Math.random() < params.goldenClickChance) {
          const bonus = params.goldenClickReward * (1 + bonuses.totalShardBonus);
          const currentShards = (state.playerData?.shards || 0) + Math.round(bonus);
          appState.set('playerData', { ...state.playerData, shards: currentShards });
          showToast(`🎁 Золотой клик! +${Math.round(bonus)} 💎`, 'success', 1500);
        }
      }
    }
    
    return { finalDamage, isCrit, specialEffect };
  }

  _getActiveMechanics() {
    const mechanics = [];
    const activeIds = (state.activeMoons || []).slice(0, state.maxSlots);
    activeIds.forEach(id => {
      const moon = MOON_TYPES[id];
      if (moon && moon.specialMechanic) {
        mechanics.push(moon.specialMechanic);
      }
    });
    return mechanics;
  }

  // ============================================================
  // АКТИВНЫЕ БАФЫ ДЛЯ UI
  // ============================================================
  _getActiveBuffs() {
    const buffs = [];
    const mechanics = this._getActiveMechanics();
    const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
    const timeSinceLastClick = Date.now() - this._lastActivityTime;
    
    // 🌙 Комбо
    if (mechanics.includes('combo')) {
      const params = this._getMechanicParamsForActiveMoon('normal');
      if (params) {
        const stacks = Math.min(
          Math.floor(this._comboClicks / params.clicksPerStack), 
          params.maxStacks
        );
        const progress = this._comboClicks % params.clicksPerStack;
        const timeLeft = this._comboClicks > 0 ? 
          Math.max(0, Math.ceil((params.resetTimeout - timeSinceLastClick) / 1000)) : null;
        
        buffs.push({
          id: 'combo', icon: '🌙', name: 'Комбо',
          value: stacks, maxStacks: params.maxStacks,
          progress, progressMax: params.clicksPerStack,
          bonus: `+${Math.round(stacks * params.bonusPerStack * 100)}% урон`,
          timeLeft, isActive: stacks > 0,
          isMaxed: stacks >= params.maxStacks,
          isTemporary: true
        });
      }
    }
    
    // 🔥 Жар
    if (mechanics.includes('fireStacks')) {
      const params = this._getMechanicParamsForActiveMoon('fire');
      if (params) {
        const stacks = Math.floor(this._fireStacks / params.clicksPerStack);
        const progress = this._fireStacks % params.clicksPerStack;
        const maxDisplay = params.maxStacks === Infinity ? '∞' : params.maxStacks;
        const timeLeft = this._fireStacks > 0 ? 
          Math.max(0, Math.ceil((params.resetTimeout - timeSinceLastClick) / 1000)) : null;
        
        buffs.push({
          id: 'fire', icon: '🔥', name: 'Жар',
          value: stacks, maxStacks: params.maxStacks === Infinity ? 999 : params.maxStacks,
          progress, progressMax: params.clicksPerStack,
          bonus: params.maxStacks === Infinity 
            ? `+${Math.round(stacks * params.bonusPerStack * 100)}%${this._fireStacks > params.safeStacks ? ' ⚠️' : ''}`
            : `+${Math.round(stacks * params.bonusPerStack * 100)}% урон`,
          timeLeft, isActive: stacks > 0,
          isMaxed: params.maxStacks !== Infinity && stacks >= params.maxStacks,
          isTemporary: true
        });
      }
    }
    
    // 🌑 Теневые криты
    if (mechanics.includes('shadowCritStacks')) {
      const params = this._getMechanicParamsForActiveMoon('shadow');
      if (params) {
        const stacks = Math.min(
          Math.floor(this._shadowCritStacks / params.clicksPerStack), 
          params.maxStacks
        );
        const progress = this._shadowCritStacks % params.clicksPerStack;
        const timeLeft = this._shadowCritStacks > 0 ? 
          Math.max(0, Math.ceil((params.resetTimeout - timeSinceLastClick) / 1000)) : null;
        
        buffs.push({
          id: 'shadow', icon: '🌑', name: 'Тень',
          value: stacks, maxStacks: params.maxStacks,
          progress, progressMax: params.clicksPerStack,
          bonus: `+${Math.round(stacks * params.critDamagePerStack * 100)}% крит`,
          timeLeft, isActive: stacks > 0,
          isMaxed: stacks >= params.maxStacks,
          isTemporary: true
        });
      }
    }
    
    // ⚡ Электрический заряд
    if (mechanics.includes('chainLightning')) {
      const params = this._getMechanicParamsForActiveMoon('electric');
      if (params) {
        buffs.push({
          id: 'electric', icon: '⚡', name: 'Заряд',
          value: this._pityClicks, maxStacks: 20,
          progress: this._pityClicks, progressMax: 20,
          bonus: params.pityMax > 0 
            ? `+${Math.round(Math.min(this._pityClicks * params.pityBonus, params.pityMax) * 100)}% шанс`
            : `Молния готова`,
          timeLeft: null,
          isActive: this._pityClicks > 0 || this._superconductorClicksLeft > 0,
          isMaxed: this._superconductorClicksLeft > 0,
          isPassive: params.pityMax === 0
        });
      }
    }
    
    // 🩸 Кровавая луна
    if (mechanics.includes('bloodMoon') && isBoss) {
      const params = this._getMechanicParamsForActiveMoon('blood');
      if (params) {
        const hpRatio = state.moonHP / state.maxHP;
        const isActive = hpRatio < params.hpThreshold;
        
        buffs.push({
          id: 'blood', icon: '🩸', name: 'Кровь',
          value: isActive ? 100 : Math.round(hpRatio * 100),
          maxStacks: 100,
          progress: isActive ? 100 : Math.round((params.hpThreshold - hpRatio) * 100 / params.hpThreshold),
          progressMax: 100,
          bonus: isActive 
            ? `💀 +${Math.round(params.damageBonus * 100)}%` 
            : `${Math.round(hpRatio * 100)}% HP`,
          timeLeft: null,
          isActive, isMaxed: isActive,
          isConditional: true
        });
      }
    }
    
    // ❄️ Заморозка
    if (mechanics.includes('freeze') && isBoss) {
      const params = this._getMechanicParamsForActiveMoon('ice');
      if (params) {
        buffs.push({
          id: 'freeze', icon: '❄️', name: 'Заморозка',
          value: Math.round(params.timerBonus * 100), maxStacks: 100,
          progress: 100, progressMax: 100,
          bonus: `+${Math.round(params.timerBonus * 100)}% времени`,
          timeLeft: null, isActive: true, isMaxed: true, isPassive: true
        });
      }
    }
    
    // ✨ Космос
    if (mechanics.includes('scaling')) {
      const params = this._getMechanicParamsForActiveMoon('cosmic');
      if (params) {
        const level = state.currentLevel;
        buffs.push({
          id: 'cosmic', icon: '✨', name: 'Космос',
          value: level, maxStacks: 100,
          progress: Math.min(level, 100), progressMax: 100,
          bonus: `+${Math.round(params.damagePerLevel * level * 100)}% урон`,
          timeLeft: null, isActive: true, isMaxed: level >= 100, isPassive: true
        });
      }
    }
    
    // 👑 Золото
    if (mechanics.includes('goldRush')) {
      const params = this._getMechanicParamsForActiveMoon('gold');
      if (params) {
        buffs.push({
          id: 'gold', icon: '👑', name: 'Золото',
          value: 100, maxStacks: 100,
          progress: 100, progressMax: 100,
          bonus: `x${params.normalMultiplier}/x${params.bossMultiplier}`,
          timeLeft: null, isActive: true, isMaxed: true, isPassive: true
        });
      }
    }
    
    return buffs.slice(0, 3);
  }

  _updateBuffsDisplay() {
    const buffs = this._getActiveBuffs();
    window._activeBuffs = buffs;
    
    if (typeof window.updateBuffsDisplay === 'function') {
      window.updateBuffsDisplay();
    }
  }

  // ============================================================
  // ПОБЕДА НАД ЛУНОЙ
  // ============================================================
  async _onMoonDefeated(isBoss) {
    const bonuses = this._calculateAllBonuses();
    const mechanics = this._getActiveMechanics();
    
    let reward = this.rewards.calculateShardReward(
      state.currentLevel, isBoss, bonuses.totalShardBonus
    );
    
    // Золотая луна: множитель
    if (mechanics.includes('goldRush')) {
      const params = this._getMechanicParamsForActiveMoon('gold');
      if (params) {
        const multiplier = isBoss ? params.bossMultiplier : params.normalMultiplier;
        reward = Math.round(reward * multiplier);
      }
    }
    
    // Обычная луна ур. 7: +10% осколков при полном стаке
    if (mechanics.includes('combo')) {
      const params = this._getMechanicParamsForActiveMoon('normal');
      if (params && params.shardBonusOnFullStack > 0) {
        const stacks = Math.min(
          Math.floor(this._comboClicks / params.clicksPerStack), 
          params.maxStacks
        );
        if (stacks >= params.maxStacks) {
          reward = Math.round(reward * (1 + params.shardBonusOnFullStack));
        }
      }
    }
    
    const currentShards = (state.playerData?.shards || 0) + reward;
    appState.set('playerData', { ...state.playerData, shards: currentShards });
    
    this.updateQuestProgress('shard', reward);
    
    if (isBoss) {
      appState.setBossKills(state.bossKills + 1);
      this.updateQuestProgress('bossKill', 1);
      animations.playBossDeathEffect(window.innerWidth / 2, window.innerHeight / 2);
    }
    
    showToast(`💎 +${reward} осколков!`, 'success', 2000);
    
    // ── ЗАМОК: награда выдана, уровень не растёт, HP восстанавливается ──
    if (state.levelLocked) {
      appState.set('moonHP', state.maxHP);
      this._newMoon = true;
      this._firstStrikeUsed = false;
      this._clickCounter = 0;
      this._pityClicks = 0;
      this._superconductorClicksLeft = 0;
      // combo / fire / shadow — НЕ сбрасываем
      
      this._forceSave();
      updateUI();
      updateTimerBar();
      updateShopUI();
      updateProfileAndLeaders();
      this._updateBuffsDisplay();
      this._checkBoss(); // перезапуск таймера босса
      showToast('🔒 Уровень закреплён — фармим дальше', 'info');
      return;
    }
    
    // ── Обычный прогресс ──
    this.updateQuestProgress('level', 1);
    appState.incrementLevel();
    
    const newLevel = state.currentLevel;
    const newMax = getMaxHPForLevel(newLevel, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
    appState.set('maxHP', newMax);
    appState.set('moonHP', newMax);
    
    this._applyLevelUpEffect();
    
    // Сброс только «лунных» счётчиков — combo/fire/shadow НЕ трогаем
    this._clickCounter = 0;
    this._pityClicks = 0;
    this._superconductorClicksLeft = 0;
    this._firstStrikeUsed = false;
    this._newMoon = true;
    
    this.checkAchievements();
    this._forceSave();
    
    updateUI();
    updateTimerBar();
    updateShopUI();
    updateProfileAndLeaders();
    updateQuestUI();
    updateAchievementUI();
    this._updateBuffsDisplay();
    
    this._checkBoss();
    this.recalcMoonBonuses();
  }

  _checkBoss() {
    if (isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL) && state.moonHP > 0) {
      const mechanics = this._getActiveMechanics();
      let bossTimer = CONSTANTS.BOSS_TIMER;
      
      if (mechanics.includes('freeze')) {
        const params = this._getMechanicParamsForActiveMoon('ice');
        if (params) {
          const extraTime = Math.round(CONSTANTS.BOSS_TIMER * params.timerBonus);
          bossTimer += extraTime;
        }
      }
      
      this.combat.startBossTimer(() => this._onBossTimeout(), bossTimer);
    } else {
      this.combat.clearBossTimer();
    }
  }

  _onBossTimeout() {
    appState.set('moonHP', state.maxHP);
    this._newMoon = true;
    this._firstStrikeUsed = false;
    updateUI();
    showToast('⏱️ Время вышло! Босс начинается заново', 'warning');
    // Перезапуск таймера босса
    this._checkBoss();
  }

  recalcMoonBonuses() {
    const bonuses = this._calculateAllBonuses();
    const activeIds = (state.activeMoons || []).slice(0, state.maxSlots);
    const activeSynergies = [];
    
    if (activeIds.length > 1 && state.maxSlots > 1) {
      const sortedActive = [...activeIds].sort();
      
      for (const [key, bonus] of Object.entries(SYNERGY_BONUSES)) {
        const moons = key.split('+').sort();
        if (moons.every(m => sortedActive.includes(m))) {
          activeSynergies.push({
            name: bonus.name, description: bonus.description, key: key,
            tier: bonus.tier, tierName: bonus.tierName, tierColor: bonus.tierColor,
            icon: bonus.icon,
            damageBonus: bonus.damageBonus || 0, shardBonus: bonus.shardBonus || 0,
            critChanceBonus: bonus.critChanceBonus || 0, critDamageBonus: bonus.critDamageBonus || 0,
            auraCombo: bonus.auraCombo || []
          });
        }
      }
    }
    
    window._totalDamageBonus = bonuses.totalDamageBonus;
    window._totalShardBonus = bonuses.totalShardBonus;
    window._totalCritChanceBonus = bonuses.totalCritChanceBonus;
    window._totalCritDamageBonus = bonuses.totalCritDamageBonus;
    window._activeSynergies = activeSynergies;
    
    this._updateBuffsDisplay();
    
    return { ...bonuses, activeSynergies };
  }

  _scheduleSave() {
    const now = Date.now();
    if (now - this._lastSave < 1000) return;
    this._lastSave = now;
    this._saveProgress().catch(err => console.error('[Game] Background save failed:', err));
  }

  _forceSave() {
    this._lastSave = Date.now();
    this._saveProgress().catch(err => console.error('[Game] Force save failed:', err));
  }

  async _saveProgress() {
    const user = state.user;
    if (!user) return;
    
    try {
      await db.updatePlayer(user.id, {
        total_clicks: state.clickCount,
        total_seconds_played: state.totalSecondsPlayed,
        level: state.currentLevel,
        moon_hp: Math.round(state.moonHP),
        shards: state.playerData?.shards || 0,
        updated_at: new Date().toISOString()
      });
      
      if (user.id) {
        localStorage.setItem(`quests_${user.id}`, JSON.stringify(state.quests || {}));
        localStorage.setItem(`ach_${user.id}`, JSON.stringify(state.achievements || {}));
        localStorage.setItem(`activeMoons_${user.id}`, JSON.stringify(state.activeMoons || []));
        localStorage.setItem(`moonLevels_${user.id}`, JSON.stringify(state.moonLevels || {}));
      }
    } catch (error) {
      console.error('[Game] Ошибка сохранения:', error);
    }
  }

  _startTimeTracking() {
    if (state.timeUpdateInterval) clearInterval(state.timeUpdateInterval);
    const interval = setInterval(() => {
      appState.set('totalSecondsPlayed', state.totalSecondsPlayed + 1);
      if (state.totalSecondsPlayed % 60 === 0) this.checkAchievements();
    }, 1000);
    appState.set('timeUpdateInterval', interval);
  }

  _startAutoSave() {
    if (state.autoSaveInterval) clearInterval(state.autoSaveInterval);
    const interval = setInterval(() => this._saveProgress(), this._saveInterval);
    appState.set('autoSaveInterval', interval);
  }

  _applyClickEffect() {
    const effect = document.getElementById('clickEffect');
    if (effect) {
      effect.classList.remove('active');
      void effect.offsetWidth;
      effect.classList.add('active');
    }
    
    const wrapper = document.getElementById('moonWrapper');
    if (wrapper) {
      wrapper.style.transform = 'scale(0.92)';
      setTimeout(() => wrapper.style.transform = 'scale(1)', 150);
    }
  }

  _applyLevelUpEffect() {
    const inner = document.getElementById('moonInner');
    if (inner) {
      inner.classList.add('level-up');
      setTimeout(() => inner.classList.remove('level-up'), 800);
    }
  }

  _onStateChange() {
    updateUI();
    updateProfileAndLeaders();
    this.recalcMoonBonuses();
    this._updateBuffsDisplay();
  }

  toggleTestMode() {
    const newMode = !state.testMode;
    appState.setTestMode(newMode);
    
    const toggleBtn = document.getElementById('testModeToggle');
    if (toggleBtn) {
      toggleBtn.textContent = newMode ? 'ВКЛ' : 'ВЫКЛ';
      toggleBtn.classList.toggle('active', newMode);
    }
    
    showToast(newMode ? '🧪 Тестовый режим ВКЛЮЧЁН' : '🎮 Тестовый режим ВЫКЛЮЧЕН', 'info');
    
    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
  }

  // ============================================================
  // ПОКУПКИ
  // ============================================================
  async buyClickDamage() {
    if (this._isPurchaseProcessing) return;
    if (!state.user) return showToast('⚠️ Войдите в аккаунт', 'warning');
    
    const level = state.currentLevel || 1;
    if (level < 5) return showToast('🔒 Доступно с 5 уровня', 'warning');
    
    const currentLevelUpgrade = state.playerData?.click_damage_level || 0;
    if (currentLevelUpgrade >= CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL) {
      return showToast('⚠️ Максимальный уровень', 'warning');
    }
    
    const cost = Math.floor(
      CONSTANTS.UPGRADE_COSTS.clickDamage.base *
      Math.pow(CONSTANTS.UPGRADE_COSTS.clickDamage.multiplier, currentLevelUpgrade)
    );
    
    if (!state.testMode && (state.playerData?.shards || 0) < cost) {
      return showToast(`⚠️ Нужно ${cost} 💎`, 'warning');
    }
    
    this._isPurchaseProcessing = true;
    
    try {
      const upgradeValue = CONSTANTS.CLICK_DAMAGE_UPGRADE_VALUE;
      const newDamage = (state.playerData?.click_damage || CONSTANTS.DEFAULTS.CLICK_DAMAGE) + upgradeValue;
      const newLevel = currentLevelUpgrade + 1;
      const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - cost;
      
      await db.updatePlayer(state.user.id, {
        click_damage: newDamage,
        click_damage_level: newLevel,
        shards: newShards,
        updated_at: new Date().toISOString()
      });
      
      appState.set('playerData', {
        ...state.playerData,
        click_damage: newDamage,
        click_damage_level: newLevel,
        shards: newShards
      });
      
      updateUI();
      updateShopUI();
      updateProfileAndLeaders();
      this.checkAchievements();
      showToast(`✅ Урон: ${newDamage} (+${upgradeValue})`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка покупки:', error);
      showToast('⚠️ Ошибка', 'warning');
    } finally {
      this._isPurchaseProcessing = false;
    }
  }

  async buySlot() {
    if (this._isPurchaseProcessing) return;
    if (!state.user) return showToast('⚠️ Войдите в аккаунт', 'warning');
    if (state.maxSlots >= CONSTANTS.MAX_SLOTS) {
      return showToast(`⚠️ Все ${CONSTANTS.MAX_SLOTS} слота открыты`, 'warning');
    }
    
    const cost = getSlotUpgradeCost(state.maxSlots);
    
    if (!state.testMode && (state.playerData?.shards || 0) < cost) {
      return showToast(`⚠️ Нужно ${cost} 💎`, 'warning');
    }
    
    this._isPurchaseProcessing = true;
    
    try {
      const newSlotLevel = state.maxSlots + 1;
      const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - cost;
      
      await db.updatePlayer(state.user.id, {
        shards: newShards,
        updated_at: new Date().toISOString()
      });
      
      appState.setSlotLevel(newSlotLevel);
      appState.set('playerData', { ...state.playerData, shards: newShards });
      
      updateUI();
      updateShopUI();
      updateProfileAndLeaders();
      this.recalcMoonBonuses();
      this.checkAchievements();
      showToast(`✅ Открыт ${state.maxSlots} слот!`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка:', error);
      showToast('⚠️ Ошибка', 'warning');
    } finally {
      this._isPurchaseProcessing = false;
    }
  }

  async buyMoon(moonId) {
    if (this._isPurchaseProcessing) return;
    if (!state.user) return showToast('⚠️ Войдите', 'warning');
    
    const moon = MOON_TYPES[moonId];
    if (!moon) return;
    if (state.ownedMoons.includes(moonId)) return showToast('⚠️ Уже есть', 'warning');
    if (state.currentLevel < (moon.unlockLevel || 1)) {
      return showToast(`🔒 С ${moon.unlockLevel} уровня`, 'warning');
    }
    if (!state.testMode && (state.playerData?.shards || 0) < moon.cost) {
      return showToast(`⚠️ Нужно ${moon.cost} 💎`, 'warning');
    }
    
    this._isPurchaseProcessing = true;
    
    try {
      const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - moon.cost;
      
      await db.updatePlayer(state.user.id, {
        shards: newShards,
        updated_at: new Date().toISOString()
      });
      
      appState.addOwnedMoon(moonId);
      if (state.activeMoons.length < state.maxSlots) {
        appState.addActiveMoon(moonId);
      } else {
        appState.setActiveMoon(moonId);
      }
      appState.set('playerData', { ...state.playerData, shards: newShards });
      
      updateUI();
      updateShopUI();
      updateProfileAndLeaders();
      this.recalcMoonBonuses();
      this.checkAchievements();
      
      const rarityName = RARITY_CONFIG[moon.rarity]?.name || '';
      showToast(`✅ ${rarityName} "${moon.name}" куплена!`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка:', error);
      showToast('⚠️ Ошибка', 'warning');
    } finally {
      this._isPurchaseProcessing = false;
    }
  }

  toggleMoonActive(moonId) {
    if (!state.user) return;
    if (!state.ownedMoons.includes(moonId)) return;
    
    const isActive = state.activeMoons.includes(moonId);
    
    if (isActive) {
      if (state.activeMoons.length === 1) {
        return showToast('⚠️ Нужна хотя бы 1 луна', 'warning');
      }
      appState.removeActiveMoon(moonId);
      showToast(`❌ ${MOON_TYPES[moonId].name} деактивирована`, 'info');
    } else {
      if (state.activeMoons.length >= state.maxSlots) {
        return showToast(`⚠️ Нет слотов (макс: ${state.maxSlots})`, 'warning');
      }
      appState.addActiveMoon(moonId);
      showToast(`✅ ${MOON_TYPES[moonId].name} активирована`, 'success');
    }
    
    this._newMoon = true;
    this._firstStrikeUsed = false;
    
    // combo / fire / shadow — НЕ сбрасываем при смене луны
    this._clickCounter = 0;
    this._pityClicks = 0;
    this._superconductorClicksLeft = 0;
    
    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
    this.recalcMoonBonuses();
    this._updateBuffsDisplay();
  }

  async upgradeMoon(moonId) {
    if (this._isPurchaseProcessing) return;
    if (!state.user) return showToast('⚠️ Войдите', 'warning');
    if (!state.ownedMoons.includes(moonId)) return showToast('⚠️ Нет луны', 'warning');
    if (state.currentLevel < 10) return showToast('🔒 С 10 уровня', 'warning');
    
    const currentLevel = state.moonLevels[moonId] || 1;
    if (currentLevel >= CONSTANTS.LIMITS.MAX_MOON_LEVEL) {
      return showToast('⚠️ Макс. уровень', 'warning');
    }
    
    const cost = getMoonUpgradeCostForLevel(moonId, currentLevel);
    
    if (!state.testMode && (state.playerData?.shards || 0) < cost) {
      return showToast(`⚠️ Нужно ${cost} 💎`, 'warning');
    }
    
    this._isPurchaseProcessing = true;
    
    try {
      const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - cost;
      
      await db.updatePlayer(state.user.id, {
        shards: newShards,
        updated_at: new Date().toISOString()
      });
      
      appState.setMoonLevel(moonId, currentLevel + 1);
      appState.set('playerData', { ...state.playerData, shards: newShards });
      
      // Проверяем милестоун
      const moon = MOON_TYPES[moonId];
      const newLevel = currentLevel + 1;
      const milestone = moon.milestones[newLevel];
      
      if (milestone) {
        showToast(`🎯 ${milestone.icon} ${milestone.name} разблокирован!`, 'success', 3000);
        
        // Сверхновая (космическая ур. 10)
        if (moonId === 'cosmic' && newLevel === 10) {
          setTimeout(() => {
            if (typeof window.showSupernovaModal === 'function') {
              window.showSupernovaModal();
            }
          }, 500);
        }
      }
      
      updateUI();
      updateShopUI();
      updateProfileAndLeaders();
      this.recalcMoonBonuses();
      this.checkAchievements();
      showToast(`✅ ${moon.name} → Ур. ${newLevel}!`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка:', error);
      showToast('⚠️ Ошибка', 'warning');
    } finally {
      this._isPurchaseProcessing = false;
    }
  }

  _ensureDailyQuests() {
    const quests = state.quests || {};
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem(`quests_last_reset_${state.user?.id}`);
    
    if (Object.keys(quests).length > 0 && lastReset === today) return;
    
    this._generateDailyQuests();
    localStorage.setItem(`quests_last_reset_${state.user?.id}`, today);
  }
  
  _generateDailyQuests() {
    const questsByCategory = {};
    for (const [id, q] of Object.entries(QUESTS)) {
      if (!questsByCategory[q.category]) questsByCategory[q.category] = [];
      questsByCategory[q.category].push({ id, ...q });
    }
    
    const newQuests = {};
    ['clicker', 'hunter', 'collector', 'progress'].forEach(category => {
      const pool = questsByCategory[category] || [];
      if (pool.length === 0) return;
      const rq = pool[Math.floor(Math.random() * pool.length)];
      newQuests[rq.id] = {
        progress: 0, target: rq.target,
        completed: false, claimed: false, createdAt: Date.now()
      };
    });
    
    const allQuests = Object.entries(QUESTS);
    for (let i = 0; i < 2; i++) {
      const re = allQuests[Math.floor(Math.random() * allQuests.length)];
      if (!newQuests[re[0]]) {
        newQuests[re[0]] = {
          progress: 0, target: re[1].target,
          completed: false, claimed: false, createdAt: Date.now()
        };
      }
    }
    
    appState.set('quests', newQuests);
    updateQuestUI();
  }
  
  updateQuestProgress(type, amount = 1) {
    const quests = state.quests || {};
    let updated = false;
    
    for (const [questId, questState] of Object.entries(quests)) {
      if (questState.claimed) continue;
      const questData = QUESTS[questId];
      if (!questData || questData.type !== type) continue;
      
      const newProgress = Math.min(questState.target, (questState.progress || 0) + amount);
      questState.progress = newProgress;
      
      if (newProgress >= questState.target && !questState.completed) {
        questState.completed = true;
        showToast(`🎯 ${questData.name} выполнен!`, 'success', 2500);
      }
      updated = true;
    }
    
    if (updated) {
      appState.set('quests', { ...quests });
      updateQuestUI();
    }
  }
  
  async claimQuestReward(questId) {
    const quests = state.quests || {};
    const questState = quests[questId];
    const questData = QUESTS[questId];
    
    if (!questState || !questData) return;
    if (!questState.completed || questState.claimed) return;
    
    const reward = questData.reward + (questData.bonusReward || 0);
    const currentShards = (state.playerData?.shards || 0) + reward;
    
    try {
      if (state.user) {
        await db.updatePlayer(state.user.id, {
          shards: currentShards,
          updated_at: new Date().toISOString()
        });
      }
      
      questState.claimed = true;
      appState.set('playerData', { ...state.playerData, shards: currentShards });
      appState.set('quests', { ...quests });
      
      updateUI();
      updateShopUI();
      updateQuestUI();
      updateProfileAndLeaders();
      showToast(`💎 +${reward} за квест!`, 'success', 2500);
    } catch (error) {
      console.error('[Game] Ошибка:', error);
      showToast('⚠️ Ошибка', 'warning');
    }
  }

  checkAchievements() {
    const achievements = state.achievements || {};
    let updated = false;
    
    for (const [achId, ach] of Object.entries(ACHIEVEMENTS)) {
      if (!achievements[achId]) achievements[achId] = {};
      
      for (const tier of ach.tiers) {
        if (achievements[achId][tier.level]) continue;
        if (ach.check(state, tier)) {
          achievements[achId][tier.level] = 'unclaimed';
          updated = true;
          showToast(`🏆 ${tier.name}!`, 'success', 3000);
        }
      }
    }
    
    if (updated) {
      appState.set('achievements', { ...achievements });
      updateAchievementUI();
      updateProfileAndLeaders();
    }
  }
  
  async claimAchievementReward(achId, tierLevel) {
    const achievements = state.achievements || {};
    const ach = ACHIEVEMENTS[achId];
    
    if (!ach || !achievements[achId]) return;
    if (achievements[achId][tierLevel] !== 'unclaimed') return;
    
    const tier = ach.tiers.find(t => t.level === tierLevel);
    if (!tier) return;
    
    const currentShards = (state.playerData?.shards || 0) + tier.reward;
    
    try {
      if (state.user) {
        await db.updatePlayer(state.user.id, {
          shards: currentShards,
          updated_at: new Date().toISOString()
        });
      }
      
      achievements[achId][tierLevel] = 'claimed';
      appState.set('playerData', { ...state.playerData, shards: currentShards });
      appState.set('achievements', { ...achievements });
      
      updateUI();
      updateShopUI();
      updateAchievementUI();
      updateProfileAndLeaders();
      showToast(`💎 +${tier.reward} за "${tier.name}"!`, 'success', 2500);
    } catch (error) {
      console.error('[Game] Ошибка:', error);
      showToast('⚠️ Ошибка', 'warning');
    }
  }

  async resetProgress() {
    if (!state.user) return;
    
    try {
      await db.updatePlayer(state.user.id, {
        total_clicks: 0, total_seconds_played: 0, level: 1,
        moon_hp: Math.round(CONSTANTS.BASE_HP), shards: 0,
        click_damage: CONSTANTS.DEFAULTS.CLICK_DAMAGE,
        click_damage_level: 0,
        updated_at: new Date().toISOString()
      });
      
      appState.set('clickCount', 0);
      appState.set('totalSecondsPlayed', 0);
      appState.set('currentLevel', 1);
      appState.set('moonHP', CONSTANTS.BASE_HP);
      appState.set('maxHP', CONSTANTS.BASE_HP);
      appState.set('activeMoon', 'normal');
      appState.set('activeMoons', ['normal']);
      appState.set('ownedMoons', ['normal']);
      appState.set('moonLevels', { normal: 1 });
      appState.setBossKills(0);
      appState.setSlotLevel(1);
      appState.clearAchievements();
      appState.resetQuests();
      
      this._resetAllCounters();
      
      if (state.user) {
        const userId = state.user.id;
        ['moon_data', 'ach', 'quests', 'bossKills', 'slotLevel', 'levelLocked', 'testMode', 
         `quests_last_reset_${userId}`, `activeMoons_${userId}`, `moonLevels_${userId}`]
          .forEach(key => localStorage.removeItem(`${key}_${userId}`));
      }
      
      const freshData = await db.getPlayer(state.user.id, false);
      appState.loadPlayerData(freshData);
      
      appState.set('levelLocked', false);
      
      this.combat.clearBossTimer();
      
      if (state.timeUpdateInterval) {
        clearInterval(state.timeUpdateInterval);
        appState.set('timeUpdateInterval', null);
      }
      if (state.autoSaveInterval) {
        clearInterval(state.autoSaveInterval);
        appState.set('autoSaveInterval', null);
      }
      
      this.recalcMoonBonuses();
      this._generateDailyQuests();
      
      updateUI();
      updateTimerBar();
      updateShopUI();
      updateProfileAndLeaders();
      updateQuestAndAchievementUI();
      this._updateBuffsDisplay();
      showToast('✅ Прогресс сброшен!', 'success');
      
    } catch (error) {
      console.error('[Game] Ошибка:', error);
      showToast('⚠️ Ошибка сброса', 'warning');
    }
  }

  async rollbackLevel() {
    if (state.currentLevel <= 1) {
      return showToast('⚠️ Уже 1 уровень', 'info');
    }
    
    const newLevel = state.currentLevel - 1;
    appState.setCurrentLevel(newLevel);
    const newMax = getMaxHPForLevel(newLevel, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
    appState.set('maxHP', newMax);
    appState.set('moonHP', newMax);
    
    this.combat.clearBossTimer();
    this._resetAllCounters();
    this._forceSave();
    
    updateUI();
    updateTimerBar();
    updateProfileAndLeaders();
    this._updateBuffsDisplay();
    showToast(`↩️ Откат до ${newLevel} уровня`, 'info');
  }

  _resetAllCounters() {
    this._comboClicks = 0;
    this._fireStacks = 0;
    this._shadowCritStacks = 0;
    this._clickCounter = 0;
    this._pityClicks = 0;
    this._superconductorClicksLeft = 0;
    this._firstStrikeUsed = false;
    this._newMoon = true;
    this._lastActivityTime = Date.now();
    this._buffsAlreadyReset = false;
  }

  destroy() {
    if (this._unsubscribeMain) { this._unsubscribeMain(); this._unsubscribeMain = null; }
    if (this._unsubscribeTimer) { this._unsubscribeTimer(); this._unsubscribeTimer = null; }
    if (this._unsubscribeTimerRunning) { this._unsubscribeTimerRunning(); this._unsubscribeTimerRunning = null; }
    if (this._activityCheckInterval) { clearInterval(this._activityCheckInterval); this._activityCheckInterval = null; }
    if (state.timeUpdateInterval) { clearInterval(state.timeUpdateInterval); appState.set('timeUpdateInterval', null); }
    if (state.autoSaveInterval) { clearInterval(state.autoSaveInterval); appState.set('autoSaveInterval', null); }
    this.combat.clearBossTimer();
    console.log('[Game] Движок уничтожен');
  }
}

export const gameEngine = new GameEngine();

if (typeof window !== 'undefined') {
  window.gameEngine = gameEngine;
}
