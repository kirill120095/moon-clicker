// ============================================================
// СИСТЕМА НАГРАД
// ============================================================
import { CONSTANTS } from '../../core/constants.js';

export class RewardSystem {
  /**
   * Расчёт награды в осколках за убийство луны/босса
   * @param {number} level - текущий уровень
   * @param {boolean} isBoss - убит ли босс
   * @param {number} shardBonus - бонус к осколкам (0.0 - 1.0+)
   * @returns {number}
   */
  calculateShardReward(level, isBoss = false, shardBonus = 0) {
    // Базовая награда растёт с уровнем
    const baseReward = Math.floor(5 + level * 2 + Math.pow(level, 1.3) * 0.5);
    
    // Множитель за босса
    const bossMultiplier = isBoss ? 5 : 1;
    
    // Бонус от лун и синергий
    const bonusMultiplier = 1 + shardBonus;
    
    return Math.max(1, Math.round(baseReward * bossMultiplier * bonusMultiplier));
  }

  /**
   * Расчёт награды за квест
   * @param {Object} questData - данные квеста
   * @returns {number}
   */
  calculateQuestReward(questData) {
    return (questData.reward || 0) + (questData.bonusReward || 0);
  }

  /**
   * Расчёт награды за достижение
   * @param {Object} tier - уровень достижения
   * @returns {number}
   */
  calculateAchievementReward(tier) {
    return tier.reward || 0;
  }
}
