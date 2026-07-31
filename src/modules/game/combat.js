// ============================================================
// БОЕВАЯ СИСТЕМА
// ============================================================
import { appState } from '../../core/state.js';
import { CONSTANTS } from '../../core/constants.js';

export class CombatSystem {
  constructor() {
    this._bossInterval = null;
    this._timeLeft = 0;
    this._onTimeout = null;
  }

  calculateDamage(baseDamage, options = {}) {
    const {
      moonDamageBonus = 0,
      critChance = 0.05,
      critDamageBonus = 0
    } = options;

    let damage = Math.max(1, Math.round(baseDamage * (1 + moonDamageBonus)));
    const effectiveCritChance = Math.min(critChance, 0.95);
    const isCrit = Math.random() < effectiveCritChance;

    if (isCrit) {
      const critMultiplier = 2 + critDamageBonus;
      damage = Math.round(damage * critMultiplier);
    }

    return { damage: Math.max(1, damage), isCrit };
  }

  calculateMaxHP(level, baseHP = CONSTANTS.BASE_HP, bossInterval = CONSTANTS.BOSS_INTERVAL) {
    const isBoss = level % bossInterval === 0;
    const hp = baseHP * Math.pow(1.15, level - 1);
    if (isBoss) return Math.round(hp * 5);
    return Math.round(hp);
  }

  startBossTimer(onTimeout, customDuration = null) {
    this.clearBossTimer();

    const duration = customDuration || CONSTANTS.BOSS_TIMER;
    this._timeLeft = duration;
    this._onTimeout = onTimeout;

    appState.set('bossTimer', this._timeLeft);
    appState.set('bossTimerRunning', true);

    this._bossInterval = setInterval(() => {
      this._timeLeft--;
      appState.set('bossTimer', Math.max(0, this._timeLeft));

      if (this._timeLeft <= 0) {
        this.clearBossTimer();
        if (this._onTimeout) this._onTimeout();
      }
    }, 1000);
  }

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

  getTimeLeft() { return this._timeLeft; }
  isTimerRunning() { return this._bossInterval !== null; }

  isBossLevel(level, bossInterval = CONSTANTS.BOSS_INTERVAL) {
    return level % bossInterval === 0 && level > 0;
  }

  getBossMultiplier(level) {
    if (level % 50 === 0) return 10;
    return 5;
  }

  calculateReward(level, isBoss = false, shardBonus = 0) {
    const baseReward = Math.floor(5 + level * 2 + Math.pow(level, 1.3) * 0.5);
    const bossMultiplier = isBoss ? 5 : 1;
    const bonusMultiplier = 1 + shardBonus;
    return Math.max(1, Math.round(baseReward * bossMultiplier * bonusMultiplier));
  }

  destroy() {
    this.clearBossTimer();
    console.log('[Combat] Боевая система уничтожена');
  }
}
