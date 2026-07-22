// ============================================================
// ОСНОВНАЯ ИГРОВАЯ ЛОГИКА
// ============================================================
import { appState, state } from '../../core/state.js';
import { 
  CONSTANTS, 
  MOON_TYPES, 
  SYNERGY_BONUSES, 
  ACHIEVEMENTS, 
  QUESTS, 
  QUEST_CATEGORIES,
  RARITY_CONFIG 
} from '../../core/constants.js';
import { 
  getMaxHPForLevel, 
  isBossLevel, 
  getMoonUpgradeCost, 
  getSlotUpgradeCost 
} from '../../core/config.js';
import { db } from '../network/supabase.js';
import { 
  showToast, 
  updateUI, 
  updateShopUI, 
  updateProfileAndLeaders, 
  updateQuestAndAchievementUI, 
  updateQuestUI,
  updateAchievementUI,
  setLockIcon 
} from '../ui/renderer.js';
import { throttle } from '../../utils/security.js';
import { CombatSystem } from './combat.js';
import { RewardSystem } from './rewards.js';
import { animations } from '../ui/animations.js';

if (typeof window !== 'undefined') {
  window.gameEngine = null;
  
  window.claimQuestReward = async (questId) => {
    if (window.gameEngine) {
      await window.gameEngine.claimQuestReward(questId);
    }
  };
  
  window.claimAchievementReward = async (achId, tierLevel) => {
    if (window.gameEngine) {
      await window.gameEngine.claimAchievementReward(achId, tierLevel);
    }
  };
  
  window.toggleMoonActive = (moonId) => {
    if (window.gameEngine) {
      window.gameEngine.toggleMoonActive(moonId);
    }
  };
}

export class GameEngine {
  constructor() {
    this.combat = new CombatSystem();
    this.rewards = new RewardSystem();
    this.isProcessing = false;
    this._lastSave = 0;
    this._saveInterval = CONSTANTS.INTERVALS.SAVE_TIME;
    this._lastClickEvent = null;
    this._clickTimestamps = [];
    
    // НОВОЕ: Счетчики для уникальных механик лун
    this._comboClicks = 0;
    this._burnClicks = 0;
    this._chainTriggered = false;

    this._unsubscribe = appState.subscribeMany(
      ['currentLevel', 'moonHP', 'maxHP', 'activeMoons', 'maxSlots'],
      () => this._onStateChange()
    );
  }

  init() {
    const level = state.currentLevel;
    const newMax = getMaxHPForLevel(level, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
    appState.set('maxHP', newMax);

    if (state.moonHP > newMax) {
      appState.set('moonHP', newMax);
    }
    if (state.moonHP < 0) {
      appState.set('moonHP', 0);
    }

    this._startTimeTracking();
    this._startAutoSave();
    this._checkBoss();
    this.recalcMoonBonuses();
    this._ensureDailyQuests();
    this.checkAchievements();

    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
    updateQuestAndAchievementUI();

    console.log('[Game] Инициализация завершена');
  }

  handleClick = throttle(async (e) => {
    const now = Date.now();
    const recentClicks = this._clickTimestamps.filter(t => now - t < 100);
    if (recentClicks.length > 0) {
      return;
    }
    this._clickTimestamps.push(now);
    this._clickTimestamps = this._clickTimestamps.filter(t => now - t < 1000);

    if (this.isProcessing) return;
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (state.moonHP <= 0) {
      return;
    }

    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    this._lastClickEvent = e;
    this.isProcessing = true;

    try {
      await this._processClick();
    } catch (error) {
      console.error('[Game] Ошибка клика:', error);
      showToast('⚠️ Ошибка обработки клика', 'warning');
    } finally {
      this.isProcessing = false;
    }
  }, 50);

  async _processClick() {
    const baseDamage = state.playerData?.click_damage || 1;
    const bonus = window._totalDamageBonus || 0;
    const critChance = 0.05 + (window._totalCritChanceBonus || 0);
    const critDamageBonus = window._totalCritDamageBonus || 0;
    
    let { damage, isCrit } = this.combat.calculateDamage(baseDamage, {
      moonDamageBonus: bonus,
      critChance: critChance,
      critDamageBonus: critDamageBonus
    });
    
    // === ПРИМЕНЕНИЕ УНИКАЛЬНЫХ МЕХАНИК ЛУН ===
    const mechanics = this._getActiveMechanics();
    
    // COMBO (обычная луна)
    if (mechanics.includes('combo')) {
      this._comboClicks++;
      const comboBonus = Math.min(this._comboClicks, 10) * 0.05;
      damage = Math.round(damage * (1 + comboBonus));
      
      if (this._comboClicks >= 10) {
        this._comboClicks = 0;
      }
    }
    
    // BURN (огненная луна) - каждый 5-й клик +100% урона
    if (mechanics.includes('burn')) {
      this._burnClicks++;
      if (this._burnClicks >= 5) {
        damage = Math.round(damage * 2);
        this._burnClicks = 0;
        // Визуальный эффект огня
        if (this._lastClickEvent) {
          animations.createParticles(null, {
            count: 20,
            color: '#ff6f00',
            size: 6,
            duration: 800,
            spread: 100,
            x: this._lastClickEvent.clientX,
            y: this._lastClickEvent.clientY
          });
        }
      }
    }
    
    // CHAIN (электрическая луна) - 20% шанс двойного удара
    if (mechanics.includes('chain')) {
      if (Math.random() < 0.20) {
        damage = Math.round(damage * 2);
        this._chainTriggered = true;
        // Визуальный эффект молнии
        if (this._lastClickEvent) {
          animations.createParticles(null, {
            count: 15,
            color: '#fdd835',
            size: 5,
            duration: 600,
            spread: 120,
            x: this._lastClickEvent.clientX,
            y: this._lastClickEvent.clientY
          });
        }
      }
    }

    appState.incrementClickCount();
    animations.setBaseDamage(baseDamage);

    if (state.testMode) {
      appState.set('moonHP', 0);
    } else {
      const newHP = Math.max(0, state.moonHP - damage);
      appState.set('moonHP', newHP);
    }

    const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
    if (this._lastClickEvent) {
      animations.playClickVisualFeedback(this._lastClickEvent, damage, isCrit, isBoss);
    }

    this._applyClickEffect();
    this.updateQuestProgress('click', 1);

    if (state.moonHP === 0) {
      await this._onMoonDefeated();
      return;
    }

    await this._saveProgress();
    updateUI();
    updateProfileAndLeaders();
    updateQuestUI();
  }

  // === ПОЛУЧЕНИЕ АКТИВНЫХ МЕХАНИК ЛУН ===
  _getActiveMechanics() {
    const mechanics = [];
    const activeMoons = state.activeMoons || [];
    
    activeMoons.forEach(moonId => {
      const moon = MOON_TYPES[moonId];
      if (moon && moon.specialMechanic) {
        mechanics.push(moon.specialMechanic);
      }
    });
    
    return mechanics;
  }

  async _onMoonDefeated() {
    if (state.levelLocked) {
      appState.set('moonHP', state.maxHP);
      updateUI();
      showToast('🔒 Уровень зафиксирован', 'info');
      return;
    }

    const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
    let reward = this.rewards.calculateShardReward(
      state.currentLevel,
      isBoss,
      window._totalShardBonus || 0
    );
    
    // === LIFESTEAL (кровавая луна) - восстанавливаем HP ===
    const mechanics = this._getActiveMechanics();
    if (mechanics.includes('lifesteal')) {
      const healAmount = Math.round(state.maxHP * 0.20);
      const newHP = Math.min(state.maxHP, state.moonHP + healAmount);
      appState.set('moonHP', newHP);
      showToast(`🩸 Вампиризм: +${healAmount} HP`, 'info', 1500);
    }
    
    // === GOLD RUSH (золотая луна) - +100% осколков от босса ===
    if (isBoss && mechanics.includes('goldRush')) {
      reward = Math.round(reward * 2);
      showToast(`👑 Золотой дождь: x2 осколков!`, 'success', 2000);
    }

    const currentShards = (state.playerData?.shards || 0) + reward;
    appState.set('playerData', { ...state.playerData, shards: currentShards });

    this.updateQuestProgress('shard', reward);
    this.updateQuestProgress('level', 1);

    if (isBoss) {
      appState.setBossKills(state.bossKills + 1);
      this.updateQuestProgress('bossKill', 1);
      
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      animations.playBossDeathEffect(centerX, centerY);
    }

    showToast(`💎 +${reward} лунных осколков!`, 'success', 2000);

    appState.incrementLevel();

    const newLevel = state.currentLevel;
    const newMax = getMaxHPForLevel(newLevel, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
    appState.set('maxHP', newMax);
    appState.set('moonHP', newMax);

    this._applyLevelUpEffect();
    
    // Сбрасываем счетчики механик при смене уровня
    this._comboClicks = 0;
    this._burnClicks = 0;

    this.checkAchievements();

    await this._saveProgress();
    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
    updateQuestUI();
    updateAchievementUI();

    this._checkBoss();
    this.recalcMoonBonuses();
  }

  _checkBoss() {
    if (isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL) && state.moonHP > 0) {
      // === FREEZE (ледяная луна) - увеличиваем таймер босса ===
      const mechanics = this._getActiveMechanics();
      let bossTimer = CONSTANTS.BOSS_TIMER;
      
      if (mechanics.includes('freeze')) {
        bossTimer = Math.round(CONSTANTS.BOSS_TIMER * 1.5);
        showToast(`❄️ Заморозка: +${bossTimer - CONSTANTS.BOSS_TIMER}с к таймеру!`, 'info', 2000);
      }
      
      this.combat.startBossTimer(() => this._onBossTimeout(), bossTimer);
    } else {
      this.combat.clearBossTimer();
    }
  }

  _onBossTimeout() {
    // === EVASION (теневая луна) - 15% шанс уклониться ===
    const mechanics = this._getActiveMechanics();
    if (mechanics.includes('evasion') && Math.random() < 0.15) {
      showToast(`🌑 Уклонение! Босс не восстановил HP!`, 'success', 2500);
      // Не восстанавливаем HP босса - даем ещё шанс
      this.combat.startBossTimer(() => this._onBossTimeout(), CONSTANTS.BOSS_TIMER);
      return;
    }
    
    appState.set('moonHP', state.maxHP);
    updateUI();
    showToast('⏱️ Время вышло! Босс восстановил здоровье', 'warning');
  }

  recalcMoonBonuses() {
    let totalDamageBonus = 0;
    let totalShardBonus = 0;
    let totalCritChanceBonus = 0;
    let totalCritDamageBonus = 0;
    const activeSynergies = [];

    const effectiveActiveMoons = state.activeMoons.slice(0, state.maxSlots);
    const activeIds = effectiveActiveMoons;

    activeIds.forEach(id => {
      const moon = MOON_TYPES[id];
      if (moon) {
        const level = appState.getMoonLevel(id);
        let levelMultiplier = 1 + (level - 1) * 0.05;
        
        // === SCALING (космическая луна) - бонусы масштабируются с уровнем игрока ===
        if (moon.specialMechanic === 'scaling') {
          const scalingBonus = 1 + (state.currentLevel * 0.01);
          levelMultiplier *= scalingBonus;
        }
        
        totalDamageBonus += (moon.damageBonus || 0) * levelMultiplier;
        totalShardBonus += (moon.shardBonus || 0) * levelMultiplier;
        totalCritChanceBonus += (moon.critChanceBonus || 0) * levelMultiplier;
        totalCritDamageBonus += (moon.critDamageBonus || 0) * levelMultiplier;
      }
    });

    if (activeIds.length > 1 && state.maxSlots > 1) {
      const sortedActive = [...activeIds].sort();

      for (const [key, bonus] of Object.entries(SYNERGY_BONUSES)) {
        const moons = key.split('+').sort();
        if (moons.every(m => sortedActive.includes(m))) {
          totalDamageBonus += bonus.damageBonus || 0;
          totalShardBonus += bonus.shardBonus || 0;
          totalCritChanceBonus += bonus.critChanceBonus || 0;
          totalCritDamageBonus += bonus.critDamageBonus || 0;
          activeSynergies.push({
            name: bonus.name,
            description: bonus.description,
            key: key,
            tier: bonus.tier,
            tierName: bonus.tierName,
            tierColor: bonus.tierColor,
            icon: bonus.icon,
            damageBonus: bonus.damageBonus || 0,
            shardBonus: bonus.shardBonus || 0,
            critChanceBonus: bonus.critChanceBonus || 0,
            critDamageBonus: bonus.critDamageBonus || 0,
            auraCombo: bonus.auraCombo || []
          });
        }
      }

      if (sortedActive.includes('normal') && sortedActive.length > 1) {
        totalDamageBonus += 0.05;
        totalShardBonus += 0.05;
      }
    }

    window._totalDamageBonus = totalDamageBonus;
    window._totalShardBonus = totalShardBonus;
    window._totalCritChanceBonus = totalCritChanceBonus;
    window._totalCritDamageBonus = totalCritDamageBonus;
    window._activeSynergies = activeSynergies;

    return { 
      totalDamageBonus, 
      totalShardBonus, 
      totalCritChanceBonus,
      totalCritDamageBonus,
      activeSynergies 
    };
  }

  async _saveProgress() {
    const now = Date.now();
    if (now - this._lastSave < 1000) return;

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
      this._lastSave = now;
      
      if (user.id) {
        localStorage.setItem(`quests_${user.id}`, JSON.stringify(state.quests || {}));
        localStorage.setItem(`ach_${user.id}`, JSON.stringify(state.achievements || {}));
        localStorage.setItem(`activeMoons_${user.id}`, JSON.stringify(state.activeMoons || []));
      }
    } catch (error) {
      console.error('[Game] Ошибка сохранения:', error);
    }
  }

  _startTimeTracking() {
    if (state.timeUpdateInterval) {
      clearInterval(state.timeUpdateInterval);
    }

    const interval = setInterval(() => {
      appState.set('totalSecondsPlayed', state.totalSecondsPlayed + 1);
      if (state.totalSecondsPlayed % 60 === 0) {
        this.checkAchievements();
      }
    }, 1000);

    appState.set('timeUpdateInterval', interval);
  }

  _startAutoSave() {
    if (state.autoSaveInterval) {
      clearInterval(state.autoSaveInterval);
    }

    const interval = setInterval(() => {
      this._saveProgress();
    }, this._saveInterval);

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
      setTimeout(() => {
        wrapper.style.transform = 'scale(1)';
      }, 150);
    }
  }

  _applyLevelUpEffect() {
    const inner = document.getElementById('moonInner');
    if (inner) {
      inner.classList.add('level-up');
      setTimeout(() => {
        inner.classList.remove('level-up');
      }, 800);
    }
  }

  _onStateChange() {
    updateUI();
    updateProfileAndLeaders(); // ВАЖНО: обновляем профиль при изменении состояния
    this.recalcMoonBonuses();
  }
  // ============================================================
  // ТЕСТОВЫЙ РЕЖИМ (ИСПРАВЛЕНО)
  // ============================================================
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
  async buyClickDamage() {
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    const level = state.currentLevel || 1;
    if (level < 5) {
      showToast('🔒 Магазин доступен с 5 уровня', 'warning');
      return;
    }
    const currentLevelUpgrade = state.playerData?.click_damage_level || 0;
    if (currentLevelUpgrade >= CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL) {
      showToast('⚠️ Максимальный уровень улучшения', 'warning');
      return;
    }

    const cost = Math.floor(
      CONSTANTS.UPGRADE_COSTS.clickDamage.base *
      Math.pow(CONSTANTS.UPGRADE_COSTS.clickDamage.multiplier, currentLevelUpgrade)
    );

    if (!state.testMode) {
      if ((state.playerData?.shards || 0) < cost) {
        showToast(`⚠️ Недостаточно осколков! Нужно ${cost}`, 'warning');
        return;
      }
    }

    const newDamage = (state.playerData?.click_damage || 1) + 1;
    const newLevel = (state.playerData?.click_damage_level || 0) + 1;
    const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - cost;

    try {
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
      showToast(`✅ Улучшение куплено! Урон: ${newDamage}`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка покупки улучшения:', error);
      showToast('⚠️ Ошибка при покупке', 'warning');
    }
  }

  async buySlot() {
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (state.maxSlots >= CONSTANTS.MAX_SLOTS) {
      showToast(`⚠️ Все ${CONSTANTS.MAX_SLOTS} слота уже открыты`, 'warning');
      return;
    }

    const cost = getSlotUpgradeCost(state.maxSlots);

    if (!state.testMode) {
      if ((state.playerData?.shards || 0) < cost) {
        showToast(`⚠️ Нужно ${cost} осколков`, 'warning');
        return;
      }
    }

    const newSlotLevel = state.maxSlots + 1;
    const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - cost;

    try {
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
      console.error('[Game] Ошибка покупки слота:', error);
      showToast('⚠️ Ошибка при покупке', 'warning');
    }
  }

  async buyMoon(moonId) {
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    const moon = MOON_TYPES[moonId];
    if (!moon) return;
    if (state.ownedMoons.includes(moonId)) {
      showToast('⚠️ У вас уже есть эта луна', 'warning');
      return;
    }
    if (state.currentLevel < (moon.unlockLevel || 1)) {
      showToast(`🔒 Доступна с ${moon.unlockLevel} уровня`, 'warning');
      return;
    }

    if (!state.testMode) {
      if ((state.playerData?.shards || 0) < moon.cost) {
        showToast(`⚠️ Недостаточно осколков! Нужно ${moon.cost}`, 'warning');
        return;
      }
    }

    const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - moon.cost;

    try {
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
      showToast(`✅ Куплена ${rarityName} луна "${moon.name}"!`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка покупки луны:', error);
      showToast('⚠️ Ошибка при покупке', 'warning');
    }
  }

  async selectMoon(moonId) {
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (!state.ownedMoons.includes(moonId)) {
      showToast('⚠️ У вас нет этой луны', 'warning');
      return;
    }

    if (state.activeMoons.includes(moonId)) {
      this.toggleMoonActive(moonId);
      return;
    }

    if (state.activeMoons.length < state.maxSlots) {
      appState.addActiveMoon(moonId);
      showToast(`✅ Активирована луна "${MOON_TYPES[moonId].name}"`, 'success');
    } else {
      appState.setActiveMoon(moonId);
      showToast(`✅ Заменена активная луна на "${MOON_TYPES[moonId].name}"`, 'success');
    }

    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
    this.recalcMoonBonuses();
  }

  toggleMoonActive(moonId) {
    if (!state.user) return;
    if (!state.ownedMoons.includes(moonId)) return;

    const isActive = state.activeMoons.includes(moonId);
    
    if (isActive) {
      if (state.activeMoons.length === 1) {
        showToast('⚠️ Должна быть хотя бы одна активная луна', 'warning');
        return;
      }
      appState.removeActiveMoon(moonId);
      showToast(`❌ Деактивирована луна "${MOON_TYPES[moonId].name}"`, 'info');
    } else {
      if (state.activeMoons.length >= state.maxSlots) {
        showToast(`⚠️ Нет свободных слотов (макс: ${state.maxSlots})`, 'warning');
        return;
      }
      appState.addActiveMoon(moonId);
      showToast(`✅ Активирована луна "${MOON_TYPES[moonId].name}"`, 'success');
    }

    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
    this.recalcMoonBonuses();
  }

  async upgradeMoon(moonId) {
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (!state.ownedMoons.includes(moonId)) {
      showToast('⚠️ У вас нет этой луны', 'warning');
      return;
    }
    if (state.currentLevel < 10) {
      showToast('🔒 Прокачка лун доступна с 10 уровня', 'warning');
      return;
    }

    const currentLevelMoon = appState.getMoonLevel(moonId);
    if (currentLevelMoon >= CONSTANTS.LIMITS.MAX_MOON_LEVEL) {
      showToast('⚠️ Максимальный уровень луны (10)', 'warning');
      return;
    }

    const cost = getMoonUpgradeCost(moonId, currentLevelMoon);

    if (!state.testMode) {
      if ((state.playerData?.shards || 0) < cost) {
        showToast(`⚠️ Нужно ${cost} осколков`, 'warning');
        return;
      }
    }

    const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - cost;

    try {
      await db.updatePlayer(state.user.id, {
        shards: newShards,
        updated_at: new Date().toISOString()
      });

      appState.setMoonLevel(moonId, currentLevelMoon + 1);
      appState.set('playerData', { ...state.playerData, shards: newShards });

      updateUI();
      updateShopUI();
      updateProfileAndLeaders();
      this.recalcMoonBonuses();
      this.checkAchievements();
      showToast(`✅ Луна "${MOON_TYPES[moonId].name}" улучшена до ${currentLevelMoon + 1} уровня!`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка прокачки луны:', error);
      showToast('⚠️ Ошибка при прокачке', 'warning');
    }
  }

  _ensureDailyQuests() {
    const quests = state.quests || {};
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem(`quests_last_reset_${state.user?.id}`);
    
    if (Object.keys(quests).length > 0 && lastReset === today) {
      return;
    }
    
    this._generateDailyQuests();
    localStorage.setItem(`quests_last_reset_${state.user?.id}`, today);
  }
  
  _generateDailyQuests() {
    const questsByCategory = {};
    
    for (const [id, q] of Object.entries(QUESTS)) {
      if (!questsByCategory[q.category]) {
        questsByCategory[q.category] = [];
      }
      questsByCategory[q.category].push({ id, ...q });
    }
    
    const newQuests = {};
    const categories = ['clicker', 'hunter', 'collector', 'progress'];
    
    categories.forEach(category => {
      const pool = questsByCategory[category] || [];
      if (pool.length === 0) return;
      
      const randomQuest = pool[Math.floor(Math.random() * pool.length)];
      newQuests[randomQuest.id] = {
        progress: 0,
        target: randomQuest.target,
        completed: false,
        claimed: false,
        createdAt: Date.now()
      };
    });
    
    const allQuests = Object.entries(QUESTS);
    for (let i = 0; i < 2; i++) {
      const randomEntry = allQuests[Math.floor(Math.random() * allQuests.length)];
      if (!newQuests[randomEntry[0]]) {
        newQuests[randomEntry[0]] = {
          progress: 0,
          target: randomEntry[1].target,
          completed: false,
          claimed: false,
          createdAt: Date.now()
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
        showToast(`🎯 Квест выполнен: ${questData.name}`, 'success', 2500);
        
        animations.createParticles(null, {
          count: 25,
          color: questData.color,
          size: 5,
          duration: 1200,
          spread: 150,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
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
      
      showToast(`💎 +${reward} осколков за квест!`, 'success', 2500);
      
      animations.createParticles(null, {
        count: 30,
        color: '#ffd700',
        size: 6,
        duration: 1500,
        spread: 200,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    } catch (error) {
      console.error('[Game] Ошибка получения награды:', error);
      showToast('⚠️ Ошибка получения награды', 'warning');
    }
  }

  checkAchievements() {
    const achievements = state.achievements || {};
    let updated = false;
    
    for (const [achId, ach] of Object.entries(ACHIEVEMENTS)) {
      if (!achievements[achId]) {
        achievements[achId] = {};
      }
      
      for (const tier of ach.tiers) {
        if (achievements[achId][tier.level]) continue;
        
        if (ach.check(state, tier)) {
          achievements[achId][tier.level] = 'unclaimed';
          updated = true;
          
          showToast(`🏆 Достижение: ${tier.name}`, 'success', 3000);
          
          animations.createParticles(null, {
            count: 35,
            color: tier.level === 'gold' ? '#ffd700' : (tier.level === 'silver' ? '#c0c0c0' : '#cd7f32'),
            size: 6,
            duration: 1800,
            spread: 250,
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          });
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
      
      animations.createParticles(null, {
        count: 40,
        color: '#ffd700',
        size: 7,
        duration: 1500,
        spread: 200,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    } catch (error) {
      console.error('[Game] Ошибка получения награды:', error);
      showToast('⚠️ Ошибка получения награды', 'warning');
    }
  }

  async resetProgress() {
    if (!state.user) return;

    try {
      await db.updatePlayer(state.user.id, {
        total_clicks: 0,
        total_seconds_played: 0,
        level: 1,
        moon_hp: Math.round(CONSTANTS.BASE_HP),
        shards: 0,
        click_damage: 1,
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
      
      // Сбрасываем счетчики механик
      this._comboClicks = 0;
      this._burnClicks = 0;

      if (state.user) {
        const userId = state.user.id;
        ['moon_data', 'ach', 'quests', 'bossKills', 'slotLevel', 'levelLocked', 'testMode', `quests_last_reset_${userId}`, `activeMoons_${userId}`]
          .forEach(key => localStorage.removeItem(`${key}_${userId}`));
        localStorage.removeItem(`quests_last_reset_${userId}`);
      }

      const freshData = await db.getPlayer(state.user.id, false);
      appState.loadPlayerData(freshData);

      appState.set('levelLocked', false);
      const lockBtn = document.getElementById('lockToggleMain');
      if (lockBtn) {
        setLockIcon(lockBtn, false);
      }

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
      updateShopUI();
      updateProfileAndLeaders();
      updateQuestAndAchievementUI();
      showToast('✅ Прогресс сброшен!', 'success');

    } catch (error) {
      console.error('[Game] Ошибка сброса прогресса:', error);
      showToast('⚠️ Ошибка сброса прогресса', 'warning');
    }
  }

  async rollbackLevel() {
    if (state.currentLevel <= 1) {
      showToast('⚠️ Вы уже на 1 уровне', 'info');
      return;
    }

    const newLevel = state.currentLevel - 1;
    appState.setCurrentLevel(newLevel);
    const newMax = getMaxHPForLevel(newLevel, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
    appState.set('maxHP', newMax);
    appState.set('moonHP', newMax);

    this.combat.clearBossTimer();
    await this._saveProgress();

    updateUI();
    updateProfileAndLeaders();
    showToast(`↩️ Откат до ${newLevel} уровня`, 'info');
  }

  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    if (state.timeUpdateInterval) {
      clearInterval(state.timeUpdateInterval);
      appState.set('timeUpdateInterval', null);
    }

    if (state.autoSaveInterval) {
      clearInterval(state.autoSaveInterval);
      appState.set('autoSaveInterval', null);
    }

    this.combat.clearBossTimer();
    console.log('[Game] Движок уничтожен');
  }
}

export const gameEngine = new GameEngine();

if (typeof window !== 'undefined') {
  window.gameEngine = gameEngine;
}
