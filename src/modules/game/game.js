// ============================================================
// ОСНОВНАЯ ИГРОВАЯ ЛОГИКА - ОПТИМИСТИЧНЫЙ UI
// ============================================================
import { appState, state } from '../../core/state.js';
import { 
  CONSTANTS, MOON_TYPES, SYNERGY_BONUSES, ACHIEVEMENTS, QUESTS, RARITY_CONFIG 
} from '../../core/constants.js';
import { 
  getMaxHPForLevel, isBossLevel, getMoonUpgradeCost, getSlotUpgradeCost 
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
    
    // УБРАЛИ isProcessing для кликов - теперь только для покупок
    this._isPurchaseProcessing = false;
    
    this._lastSave = 0;
    this._saveInterval = CONSTANTS.INTERVALS.SAVE_TIME;
    this._lastClickEvent = null;
    
    // Простой throttle через timestamp последнего клика
    this._lastClickTime = 0;
    this._minClickInterval = 16; // ~60 кликов/сек (1 кадр при 60fps)
    
    // Счётчики для механик лун
    this._comboClicks = 0;      // Обычная: сбрасывается каждые 10
    this._fireStacks = 0;       // Огненная: растёт каждые 5, макс 15
    this._clickCounter = 0;     // Электрическая: сбрасывается на 20
    
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
    this._checkBoss();
    this.recalcMoonBonuses();
    this._ensureDailyQuests();
    this.checkAchievements();

    updateUI();
    updateTimerBar();
    updateShopUI();
    updateProfileAndLeaders();
    updateQuestAndAchievementUI();

    console.log('[Game] Инициализация завершена');
  }

  // ============================================================
  // ОБРАБОТКА КЛИКА - ОПТИМИСТИЧНАЯ, БЕЗ БЛОКИРОВКИ
  // ============================================================
  handleClick = (e) => {
    // Простой throttle
    const now = performance.now();
    if (now - this._lastClickTime < this._minClickInterval) {
      return;
    }
    this._lastClickTime = now;

    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (state.moonHP <= 0) return;

    // МГНОВЕННАЯ ОБРАБОТКА - без await, без блокировки
    this._processClickSync(e);
  };

  /**
   * СИНХРОННАЯ обработка клика - мгновенно
   * Все сетевые операции в фоне
   */
  _processClickSync(e) {
    const baseDamage = state.playerData?.click_damage || 1;
    const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
    
    // Рассчитываем все бонусы
    const bonuses = this._calculateAllBonuses();
    
    // Применяем механики лун
    const { finalDamage, isCrit, specialEffect } = this._applyMoonMechanics(
      baseDamage, bonuses, isBoss
    );
    
    // Увеличиваем счётчик кликов
    appState.incrementClickCount();
    animations.setBaseDamage(baseDamage);
    
    // Обновляем HP (синхронно)
    let killed = false;
    if (state.testMode) {
      appState.set('moonHP', 0);
      killed = true;
    } else {
      const newHP = Math.max(0, state.moonHP - finalDamage);
      appState.set('moonHP', newHP);
      killed = newHP === 0;
    }
    
    // МГНОВЕННЫЙ ВИЗУАЛ
    this._lastClickEvent = e;
    if (e) {
      animations.playClickVisualFeedback(e, finalDamage, isCrit, isBoss);
      
      // Спецэффект от механик
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
      }
    }
    
    this._applyClickEffect();
    
    // Обновляем квесты по кликам
    this.updateQuestProgress('click', 1);
    
    // Обновляем UI (мгновенно)
    updateUI();
    updateQuestUI();
    
    // СОХРАНЕНИЕ В ФОНЕ - не блокирует
    this._scheduleSave();
    
    // Если убили - обрабатываем победу (асинхронно, но не блокирует клики)
    if (killed) {
      this._onMoonDefeated(isBoss);
    }
  }

  /**
   * Расчёт всех бонусов (детерминированный)
   */
  _calculateAllBonuses() {
    let totalDamageBonus = 0;
    let totalShardBonus = 0;
    let totalCritChanceBonus = 0;
    let totalCritDamageBonus = 0;
    
    const activeIds = (state.activeMoons || []).slice(0, state.maxSlots);
    
    // Бонусы от активных лун
    activeIds.forEach(id => {
      const moon = MOON_TYPES[id];
      if (!moon) return;
      
      const level = appState.getMoonLevel(id);
      const levelMultiplier = 1 + (level - 1) * 0.05;
      
      // КОСМИЧЕСКАЯ: масштабирование от уровня игрока
      let cosmicDamageBonus = 0;
      let cosmicShardBonus = 0;
      if (moon.specialMechanic === 'scaling') {
        cosmicDamageBonus = moon.specialDamagePerLevel * state.currentLevel;
        cosmicShardBonus = moon.specialShardPerLevel * state.currentLevel;
      }
      
      totalDamageBonus += ((moon.damageBonus || 0) + cosmicDamageBonus) * levelMultiplier;
      totalShardBonus += ((moon.shardBonus || 0) + cosmicShardBonus) * levelMultiplier;
      totalCritChanceBonus += (moon.critChanceBonus || 0) * levelMultiplier;
      totalCritDamageBonus += (moon.critDamageBonus || 0) * levelMultiplier;
    });
    
    // Бонусы от синергий (детерминированно через сортировку)
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
      
      // Бонус за обычную луну с другими
      if (sortedActive.includes('normal') && sortedActive.length > 1) {
        totalDamageBonus += 0.05;
        totalShardBonus += 0.05;
      }
    }
    
    return {
      totalDamageBonus,
      totalShardBonus,
      totalCritChanceBonus,
      totalCritDamageBonus
    };
  }

  /**
   * Применение механик лун
   * @returns {{finalDamage, isCrit, specialEffect}}
   */
  _applyMoonMechanics(baseDamage, bonuses, isBoss) {
    const mechanics = this._getActiveMechanics();
    let damageMultiplier = 1 + bonuses.totalDamageBonus;
    let specialEffect = null;
    
    // ОБЫЧНАЯ: Комбо-мастер - каждые 10 кликов +5% (до +50%)
    if (mechanics.includes('combo')) {
      this._comboClicks++;
      const comboStacks = Math.min(Math.floor(this._comboClicks / 10), 10);
      damageMultiplier += comboStacks * 0.05;
      if (this._comboClicks >= 100) this._comboClicks = 0;
    }
    
    // ОГНЕННАЯ: каждые 5 кликов +10% (макс 15 стеков = +150%)
    if (mechanics.includes('fireStacks')) {
      this._fireStacks = Math.min(this._fireStacks + 1, 75); // 75 = 15 стеков * 5
      const fireStacks = Math.floor(this._fireStacks / 5);
      damageMultiplier += fireStacks * 0.10;
      
      // Визуальный сигнал каждые 5 кликов
      if (this._fireStacks % 5 === 0 && this._fireStacks > 0 && this._fireStacks <= 75) {
        specialEffect = 'fireStack';
      }
    }
    
    // ЭЛЕКТРИЧЕСКАЯ: каждый 20-й клик x10 урон
    if (mechanics.includes('megaStrike')) {
      this._clickCounter++;
      if (this._clickCounter >= 20) {
        damageMultiplier *= 10;
        specialEffect = 'megaStrike';
        this._clickCounter = 0;
      }
    }
    
    // КРОВАВАЯ: при HP босса < 50%: +60% к урону
    if (mechanics.includes('bloodMoon') && isBoss) {
      const hpRatio = state.moonHP / state.maxHP;
      if (hpRatio < 0.5) {
        damageMultiplier += 0.60;
      }
    }
    
    // Применяем множитель к базовому урону
    let finalDamage = Math.max(1, Math.round(baseDamage * damageMultiplier));
    
    // Критический удар
    const critChance = Math.min(0.95, 0.05 + bonuses.totalCritChanceBonus);
    const isCrit = Math.random() < critChance;
    
    if (isCrit) {
      const critMultiplier = 2 + bonuses.totalCritDamageBonus;
      finalDamage = Math.round(finalDamage * critMultiplier);
    }
    
    return { finalDamage, isCrit, specialEffect };
  }

  /**
   * Получение активных механик
   */
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

  /**
   * Победа над луной/боссом (асинхронно, не блокирует клики)
   */
  async _onMoonDefeated(isBoss) {
    if (state.levelLocked) {
      appState.set('moonHP', state.maxHP);
      updateUI();
      showToast('🔒 Уровень зафиксирован', 'info');
      return;
    }
    
    const bonuses = this._calculateAllBonuses();
    const mechanics = this._getActiveMechanics();
    
    // Базовая награда
    let reward = this.rewards.calculateShardReward(
      state.currentLevel, isBoss, bonuses.totalShardBonus
    );
    
    // ЗОЛОТАЯ: x2 с обычных, x3 с боссов
    if (mechanics.includes('goldRush')) {
      const goldMoon = MOON_TYPES.gold;
      const multiplier = isBoss ? goldMoon.specialValueBoss : goldMoon.specialValueNormal;
      reward = Math.round(reward * multiplier);
      showToast(`👑 Золотой дождь: x${multiplier} осколков!`, 'success', 2000);
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
    
    // СБРАСЫВАЕМ СЧЁТЧИКИ МЕХАНИК при смене уровня
    this._comboClicks = 0;
    this._fireStacks = 0;
    this._clickCounter = 0;
    
    this.checkAchievements();
    
    // СЕТЬ В ФОНЕ
    this._forceSave();
    
    updateUI();
    updateTimerBar();
    updateShopUI();
    updateProfileAndLeaders();
    updateQuestUI();
    updateAchievementUI();
    
    this._checkBoss();
    this.recalcMoonBonuses();
  }

  _checkBoss() {
    if (isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL) && state.moonHP > 0) {
      const mechanics = this._getActiveMechanics();
      let bossTimer = CONSTANTS.BOSS_TIMER;
      
      // ЛЕДЯНАЯ: +25% к таймеру
      if (mechanics.includes('freeze')) {
        const iceMoon = MOON_TYPES.ice;
        const extraTime = Math.round(CONSTANTS.BOSS_TIMER * iceMoon.specialValue);
        bossTimer += extraTime;
        showToast(`❄️ Заморозка: +${extraTime}с к таймеру!`, 'info', 2000);
      }
      
      this.combat.startBossTimer(() => this._onBossTimeout(), bossTimer);
    } else {
      this.combat.clearBossTimer();
    }
  }

  _onBossTimeout() {
    appState.set('moonHP', state.maxHP);
    updateUI();
    showToast('⏱️ Время вышло! Босс восстановил здоровье', 'warning');
  }

  /**
   * Публичный пересчёт бонусов для UI (сохраняем в window для синергий)
   */
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
    }
    
    // Сохраняем глобально для доступа из renderer
    window._totalDamageBonus = bonuses.totalDamageBonus;
    window._totalShardBonus = bonuses.totalShardBonus;
    window._totalCritChanceBonus = bonuses.totalCritChanceBonus;
    window._totalCritDamageBonus = bonuses.totalCritDamageBonus;
    window._activeSynergies = activeSynergies;
    
    return { ...bonuses, activeSynergies };
  }

  /**
   * Фоновое сохранение (не чаще раза в секунду)
   */
  _scheduleSave() {
    const now = Date.now();
    if (now - this._lastSave < 1000) return;
    this._lastSave = now;
    
    // Запускаем в фоне, не ждём
    this._saveProgress().catch(err => {
      console.error('[Game] Background save failed:', err);
    });
  }

  /**
   * Принудительное сохранение (при смене уровня)
   */
  _forceSave() {
    this._lastSave = Date.now();
    this._saveProgress().catch(err => {
      console.error('[Game] Force save failed:', err);
    });
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
      }
    } catch (error) {
      console.error('[Game] Ошибка сохранения:', error);
    }
  }

  _startTimeTracking() {
    if (state.timeUpdateInterval) clearInterval(state.timeUpdateInterval);
    
    const interval = setInterval(() => {
      appState.set('totalSecondsPlayed', state.totalSecondsPlayed + 1);
      if (state.totalSecondsPlayed % 60 === 0) {
        this.checkAchievements();
      }
    }, 1000);
    
    appState.set('timeUpdateInterval', interval);
  }

  _startAutoSave() {
    if (state.autoSaveInterval) clearInterval(state.autoSaveInterval);
    
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
      setTimeout(() => inner.classList.remove('level-up'), 800);
    }
  }

  _onStateChange() {
    updateUI();
    updateProfileAndLeaders();
    this.recalcMoonBonuses();
  }

  // ============================================================
  // ТЕСТОВЫЙ РЕЖИМ
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

  // ============================================================
  // ПОКУПКИ (С БЛОКИРОВКОЙ - сетевые операции)
  // ============================================================
  async buyClickDamage() {
    if (this._isPurchaseProcessing) return;
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
    
    if (!state.testMode && (state.playerData?.shards || 0) < cost) {
      showToast(`⚠️ Недостаточно осколков! Нужно ${cost}`, 'warning');
      return;
    }
    
    this._isPurchaseProcessing = true;
    
    try {
      const newDamage = (state.playerData?.click_damage || 1) + 1;
      const newLevel = (state.playerData?.click_damage_level || 0) + 1;
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
      showToast(`✅ Улучшение куплено! Урон: ${newDamage}`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка покупки:', error);
      showToast('⚠️ Ошибка при покупке', 'warning');
    } finally {
      this._isPurchaseProcessing = false;
    }
  }

  async buySlot() {
    if (this._isPurchaseProcessing) return;
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (state.maxSlots >= CONSTANTS.MAX_SLOTS) {
      showToast(`⚠️ Все ${CONSTANTS.MAX_SLOTS} слота уже открыты`, 'warning');
      return;
    }
    
    const cost = getSlotUpgradeCost(state.maxSlots);
    
    if (!state.testMode && (state.playerData?.shards || 0) < cost) {
      showToast(`⚠️ Нужно ${cost} осколков`, 'warning');
      return;
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
      console.error('[Game] Ошибка покупки слота:', error);
      showToast('⚠️ Ошибка при покупке', 'warning');
    } finally {
      this._isPurchaseProcessing = false;
    }
  }

  async buyMoon(moonId) {
    if (this._isPurchaseProcessing) return;
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
    if (!state.testMode && (state.playerData?.shards || 0) < moon.cost) {
      showToast(`⚠️ Недостаточно осколков! Нужно ${moon.cost}`, 'warning');
      return;
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
      showToast(`✅ Куплена ${rarityName} луна "${moon.name}"!`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка покупки луны:', error);
      showToast('⚠️ Ошибка при покупке', 'warning');
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
    
    // СБРАСЫВАЕМ СЧЁТЧИКИ МЕХАНИК при изменении активных лун
    this._comboClicks = 0;
    this._fireStacks = 0;
    this._clickCounter = 0;
    
    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
    this.recalcMoonBonuses();
  }

  async upgradeMoon(moonId) {
    if (this._isPurchaseProcessing) return;
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
    
    if (!state.testMode && (state.playerData?.shards || 0) < cost) {
      showToast(`⚠️ Нужно ${cost} осколков`, 'warning');
      return;
    }
    
    this._isPurchaseProcessing = true;
    
    try {
      const newShards = state.testMode ? (state.playerData?.shards || 0) : (state.playerData?.shards || 0) - cost;
      
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
        progress: 0, target: randomQuest.target,
        completed: false, claimed: false, createdAt: Date.now()
      };
    });
    
    const allQuests = Object.entries(QUESTS);
    for (let i = 0; i < 2; i++) {
      const randomEntry = allQuests[Math.floor(Math.random() * allQuests.length)];
      if (!newQuests[randomEntry[0]]) {
        newQuests[randomEntry[0]] = {
          progress: 0, target: randomEntry[1].target,
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
        showToast(`🎯 Квест выполнен: ${questData.name}`, 'success', 2500);
        
        animations.createParticles(null, {
          count: 25, color: questData.color, size: 5,
          duration: 1200, spread: 150,
          x: window.innerWidth / 2, y: window.innerHeight / 2
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
        count: 30, color: '#ffd700', size: 6,
        duration: 1500, spread: 200,
        x: window.innerWidth / 2, y: window.innerHeight / 2
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
      if (!achievements[achId]) achievements[achId] = {};
      
      for (const tier of ach.tiers) {
        if (achievements[achId][tier.level]) continue;
        
        if (ach.check(state, tier)) {
          achievements[achId][tier.level] = 'unclaimed';
          updated = true;
          
          showToast(`🏆 Достижение: ${tier.name}`, 'success', 3000);
          
          animations.createParticles(null, {
            count: 35,
            color: tier.level === 'gold' ? '#ffd700' : (tier.level === 'silver' ? '#c0c0c0' : '#cd7f32'),
            size: 6, duration: 1800, spread: 250,
            x: window.innerWidth / 2, y: window.innerHeight / 2
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
        count: 40, color: '#ffd700', size: 7,
        duration: 1500, spread: 200,
        x: window.innerWidth / 2, y: window.innerHeight / 2
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
      
      this._comboClicks = 0;
      this._fireStacks = 0;
      this._clickCounter = 0;
      
      if (state.user) {
        const userId = state.user.id;
        ['moon_data', 'ach', 'quests', 'bossKills', 'slotLevel', 'levelLocked', 'testMode', 
         `quests_last_reset_${userId}`, `activeMoons_${userId}`]
          .forEach(key => localStorage.removeItem(`${key}_${userId}`));
        localStorage.removeItem(`quests_last_reset_${userId}`);
      }
      
      const freshData = await db.getPlayer(state.user.id, false);
      appState.loadPlayerData(freshData);
      
      appState.set('levelLocked', false);
      const lockBtn = document.getElementById('lockToggleMain');
      if (lockBtn) setLockIcon(lockBtn, false);
      
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
    this._forceSave();
    
    updateUI();
    updateTimerBar();
    updateProfileAndLeaders();
    showToast(`↩️ Откат до ${newLevel} уровня`, 'info');
  }

  destroy() {
    if (this._unsubscribeMain) {
      this._unsubscribeMain();
      this._unsubscribeMain = null;
    }
    if (this._unsubscribeTimer) {
      this._unsubscribeTimer();
      this._unsubscribeTimer = null;
    }
    if (this._unsubscribeTimerRunning) {
      this._unsubscribeTimerRunning();
      this._unsubscribeTimerRunning = null;
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
