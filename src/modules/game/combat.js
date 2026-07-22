// ============================================================
// БОЕВАЯ СИСТЕМА
// ============================================================
import { appState, state } from '../../core/state.js';
import { CONSTANTS } from '../../core/constants.js';

export class CombatSystem {
  constructor() {
    this._bossInterval = null;
    this._timeLeft = 0;
    this._onTimeout = null;
  }

  // ============================================================
  // РАСЧЁТ УРОНА
  // ============================================================
  
  /**
   * Рассчитать урон с учётом бонусов и крита
   * @param {number} baseDamage - базовый урон игрока
   * @param {Object} options - опции
   * @param {number} options.moonDamageBonus - бонус урона от лун и синергий (0.0 - 1.0+)
   * @param {number} options.critChance - шанс крита (0.0 - 1.0)
   * @param {number} options.critDamageBonus - бонус к крит-урону (0.0+)
   * @returns {{ damage: number, isCrit: boolean }}
   */
  calculateDamage(baseDamage, options = {}) {
    const {
      moonDamageBonus = 0,
      critChance = 0.05,
      critDamageBonus = 0
    } = options;

    // Базовый урон с бонусами
    let damage = Math.max(1, Math.round(baseDamage * (1 + moonDamageBonus)));

    // Критический удар
    const effectiveCritChance = Math.min(critChance, 0.95); // Макс 95%
    const isCrit = Math.random() < effectiveCritChance;

    if (isCrit) {
      // Крит множитель: базовые 200% + бонусы
      const critMultiplier = 2 + critDamageBonus;
      damage = Math.round(damage * critMultiplier);
    }

    return { damage: Math.max(1, damage), isCrit };
  }

  // ============================================================
  // РАСЧЁТ HP БОССА
  // ============================================================
  
  /**
   * Рассчитать максимальное HP для уровня
   * @param {number} level - текущий уровень
   * @param {number} baseHP - базовое HP
   * @param {number} bossInterval - интервал боссов
   * @returns {number}
   */
  calculateMaxHP(level, baseHP = CONSTANTS.BASE_HP, bossInterval = CONSTANTS.BOSS_INTERVAL) {
    const isBoss = level % bossInterval === 0;
    const hp = baseHP * Math.pow(1.15, level - 1);
    
    if (isBoss) {
      return Math.round(hp * 5); // Боссы имеют x5 HP
    }
    
    return Math.round(hp);
  }

  // ============================================================
  // ТАЙМЕР БОССА
  // ============================================================
  
  /**
   * Запустить таймер босса
   * @param {Function} onTimeout - callback при истечении времени
   * @param {number} customDuration - кастомная длительность в секундах (для ледяной луны)
   */
  startBossTimer(onTimeout, customDuration = null) {
    // Очищаем предыдущий таймер если есть
    this.clearBossTimer();

    const duration = customDuration || CONSTANTS.BOSS_TIMER;
    this._timeLeft = duration;
    this._onTimeout = onTimeout;

    // Обновляем state
    appState.set('bossTimer', this._timeLeft);
    appState.set('bossTimerRunning', true);

    // Запускаем интервал
    this._bossInterval = setInterval(() => {
      this._timeLeft--;
      appState.set('bossTimer', Math.max(0, this._timeLeft));

      if (this._timeLeft <= 0) {
        this.clearBossTimer();
        if (this._onTimeout) {
          this._onTimeout();
        }
      }
    }, 1000);
  }

  /**
   * Очистить таймер босса
   */
  clearBossTimer() {
    if (this._bossInterval) {
      clearInterval(this._bossInterval);
      this._bossInterval = null;
    }

    this._timeLeft = 0;
    this._onTimeout = null;

    appState.set('bossTimer', CONSTANTS.BOSS_TIMER);
    appState.set('bossTimerRunning', false);
  }

  /**
   * Получить оставшееся время таймера
   * @returns {number}
   */
  getTimeLeft() {
    return this._timeLeft;
  }

  /**
   * Проверить, запущен ли таймер
   * @returns {boolean}
   */
  isTimerRunning() {
    return this._bossInterval !== null;
  }

  // ============================================================
  // ПРОВЕРКА БОССА
  // ============================================================
  
  /**
   * Проверить, является ли текущий уровень боссом
   * @param {number} level - уровень
   * @param {number} bossInterval - интервал боссов
   * @returns {boolean}
   */
  isBossLevel(level, bossInterval = CONSTANTS.BOSS_INTERVAL) {
    return level % bossInterval === 0 && level > 0;
  }

  /**
   * Получить множитель HP босса
   * @param {number} level - уровень
   * @returns {number}
   */
  getBossMultiplier(level) {
    // Каждый 50-й уровень - супер-босс с x10 HP
    if (level % 50 === 0) return 10;
    // Каждый 10-й уровень - обычный босс с x5 HP
    return 5;
  }

  // ============================================================
  // РАСЧЁТ НАГРАДЫ
  // ============================================================
  
  /**
   * Рассчитать награду в осколках за убийство
   * @param {number} level - уровень
   * @param {boolean} isBoss - убит ли босс
   * @param {number} shardBonus - бонус к осколкам (0.0 - 1.0+)
   * @returns {number}
   */
  calculateReward(level, isBoss = false, shardBonus = 0) {
    const baseReward = Math.floor(5 + level * 2 + Math.pow(level, 1.3) * 0.5);
    const bossMultiplier = isBoss ? 5 : 1;
    const bonusMultiplier = 1 + shardBonus;

    return Math.max(1, Math.round(baseReward * bossMultiplier * bonusMultiplier));
  }

  // ============================================================
  // УНИЧТОЖЕНИЕ
  // ============================================================
  
  destroy() {
    this.clearBossTimer();
    console.log('[Combat] Боевая система уничтожена');
  }
}
