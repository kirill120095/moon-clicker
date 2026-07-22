// ============================================================
// ОСНОВНАЯ ИГРОВАЯ ЛОГИКА
// ============================================================
import { appState, state } from '../../core/state.js';
import { CONSTANTS, MOON_TYPES, SYNERGY_BONUSES } from '../../core/constants.js';
import { getMaxHPForLevel, isBossLevel, getMoonUpgradeCost, getSlotUpgradeCost } from '../../core/config.js';
import { db } from '../network/supabase.js';
import { showToast, updateUI, updateShopUI, updateProfileAndLeaders, updateQuestAndAchievementUI, setLockIcon } from '../ui/renderer.js';
import { throttle } from '../../utils/security.js';
import { CombatSystem } from './combat.js';
import { RewardSystem } from './rewards.js';
import { animations } from '../ui/animations.js';

export class GameEngine {
  constructor() {
    this.combat = new CombatSystem();
    this.rewards = new RewardSystem();
    this.isProcessing = false;
    this._lastSave = 0;
    this._saveInterval = CONSTANTS.INTERVALS.SAVE_TIME;
    this._lastClickEvent = null;

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

    updateUI();
    updateShopUI();
    updateProfileAndLeaders();

    console.log('[Game] Инициализация завершена');
  }

  handleClick = throttle(async (e) => {
    if (this.isProcessing) return;
    if (!state.user) {
      showToast('⚠️ Войдите в аккаунт', 'warning');
      return;
    }
    if (state.moonHP <= 0) {
      return;
    }

    // Сохраняем event для использования в _processClick
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
    const { damage, isCrit } = this.combat.calculateDamage(baseDamage, {
      moonDamageBonus: bonus,
      critChance: 0.05
    });

    appState.incrementClickCount();

    if (state.testMode) {
      appState.set('moonHP', 0);
    } else {
      const newHP = Math.max(0, state.moonHP - damage);
      appState.set('moonHP', newHP);
    }

    // ВИЗУАЛЬНЫЕ ЭФФЕКТЫ КЛИКА
    const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
    if (this._lastClickEvent) {
      animations.playClickVisualFeedback(this._lastClickEvent, damage, isCrit, isBoss);
    }

    this._applyClickEffect();

    if (state.moonHP === 0) {
      await this._onMoonDefeated();
      return;
    }

    await this._saveProgress();
    updateUI();
    updateProfileAndLeaders();
  }

  async _onMoonDefeated() {
    if (state.levelLocked) {
      appState.set('moonHP', state.maxHP);
      updateUI();
      showToast('🔒 Уровень зафиксирован', 'info');
      return;
    }

    const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
    const reward = this.rewards.calculateShardReward(
      state.currentLevel,
      isBoss,
      window._totalShardBonus || 0
    );

    const currentShards = (state.playerData?.shards || 0) + reward;
    appState.set('playerData', { ...state.playerData, shards: currentShards });

    appState.updateQuestProgress('shard', reward);

    if (isBoss) {
      appState.setBossKills(state.bossKills + 1);
      appState.updateQuestProgress('bossKill');
      
      // ЭФФЕКТ УБИЙСТВА БОССА
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

    await this._saveProgress();
    updateUI();
    updateShopUI();
    updateProfileAndLeaders();

    this._checkBoss();
    this.recalcMoonBonuses();
  }

  _checkBoss() {
    if (isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL) && state.moonHP > 0) {
      this.combat.startBossTimer(() => this._onBossTimeout());
    } else {
      this.combat.clearBossTimer();
    }
  }

  _onBossTimeout() {
    appState.set('moonHP', state.maxHP);
    updateUI();
    showToast('⏱️ Время вышло! Босс восстановил здоровье', 'warning');
  }

  recalcMoonBonuses() {
    let totalDamageBonus = 0;
    let totalShardBonus = 0;
    const activeSynergies = [];

    const effectiveActiveMoons = state.activeMoons.slice(0, state.maxSlots);
    const activeIds = effectiveActiveMoons;

    activeIds.forEach(id => {
      const moon = MOON_TYPES[id];
      if (moon) {
        const level = appState.getMoonLevel(id);
        const levelMultiplier = 1 + (level - 1) * 0.05;
        totalDamageBonus += (moon.damageBonus || 0) * levelMultiplier;
        totalShardBonus += (moon.shardBonus || 0) * levelMultiplier;
      }
    });

    if (activeIds.length > 1 && state.maxSlots > 1) {
      const sortedActive = [...activeIds].sort();

      for (const [key, bonus] of Object.entries(SYNERGY_BONUSES)) {
        const moons = key.split('+').sort();
        if (moons.every(m => sortedActive.includes(m))) {
          totalDamageBonus += bonus.damageBonus || 0;
          totalShardBonus += bonus.shardBonus || 0;
          activeSynergies.push({
            name: bonus.name,
            description: bonus.description,
            key: key
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
    window._activeSynergies = activeSynergies;

    return { totalDamageBonus, totalShardBonus, activeSynergies };
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
    this.recalcMoonBonuses();
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
      showToast('⚠️ Все слоты уже открыты', 'warning');
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
      appState.setActiveMoon(moonId);
      appState.set('playerData', { ...state.playerData, shards: newShards });

      updateUI();
      updateShopUI();
      updateProfileAndLeaders();
      this.recalcMoonBonuses();
      showToast(`✅ Куплена луна "${moon.name}"!`, 'success');
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
    if (state.activeMoon === moonId) {
      showToast('⚠️ Эта луна уже активна', 'info');
      return;
    }

    appState.setActiveMoon(moonId);
    updateUI();
    updateShopUI();
    updateProfileAndLeaders();
    this.recalcMoonBonuses();
    showToast(`✅ Активна луна "${MOON_TYPES[moonId].name}"`, 'success');
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
      showToast(`✅ Луна "${MOON_TYPES[moonId].name}" улучшена до ${currentLevelMoon + 1} уровня!`, 'success');
    } catch (error) {
      console.error('[Game] Ошибка прокачки луны:', error);
      showToast('⚠️ Ошибка при прокачке', 'warning');
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

      if (state.user) {
        const userId = state.user.id;
        ['moon_data', 'ach', 'quests', 'bossKills', 'slotLevel', 'levelLocked', 'testMode']
          .forEach(key => localStorage.removeItem(`${key}_${userId}`));
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
