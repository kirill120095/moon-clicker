// ============================================================
// КОНФИГУРАЦИЯ ИГРЫ - РАСЧЁТНЫЕ ФУНКЦИИ
// ============================================================
import { CONSTANTS, MOON_UPGRADE_BASE_COSTS } from './constants.js';

/**
 * Расчёт максимального HP для уровня
 * @param {number} level - текущий уровень
 * @param {number} baseHP - базовое HP (1000)
 * @param {number} bossInterval - интервал боссов (10)
 * @returns {number}
 */
export function getMaxHPForLevel(level, baseHP = CONSTANTS.BASE_HP, bossInterval = CONSTANTS.BOSS_INTERVAL) {
  const boss = level % bossInterval === 0 && level > 0;
  const cap=CONSTANTS.SAFE_NUMBER_CAP, multiplier=boss?CONSTANTS.BOSS_HP_MULTIPLIER:1;
  const maxExponent=Math.log(cap/baseHP/multiplier)/Math.log(CONSTANTS.HP_GROWTH);
  if(level-1>=maxExponent)return cap;
  return Math.min(cap,Math.round(baseHP*Math.pow(CONSTANTS.HP_GROWTH,level-1)*multiplier));
}

/**
 * Проверка является ли уровень боссом
 * @param {number} level - уровень
 * @param {number} bossInterval - интервал
 * @returns {boolean}
 */
export function isBossLevel(level, bossInterval = CONSTANTS.BOSS_INTERVAL) {
  return level % bossInterval === 0 && level > 0;
}

/**
 * Расчёт стоимости улучшения слотов
 * @param {number} currentSlots - текущее количество слотов
 * @returns {number}
 */
export function getSlotUpgradeCost(currentSlots) {
  return Math.floor(
    CONSTANTS.UPGRADE_COSTS.moonSlots.base *
    Math.pow(CONSTANTS.UPGRADE_COSTS.moonSlots.multiplier, currentSlots - 1)
  );
}

/**
 * Расчёт стоимости прокачки луны (старая функция для совместимости)
 * @param {string} moonId - ID луны
 * @param {number} currentLevel - текущий уровень луны
 * @returns {number}
 */
export function getMoonUpgradeCost(moonId, currentLevel) {
  const { MOON_TYPES } = require('./constants.js');
  const moon = MOON_TYPES[moonId];
  if (!moon) return Infinity;
  
  const baseCost = MOON_UPGRADE_BASE_COSTS[moon.rarity] || 200;
  return Math.floor(baseCost * Math.pow(1.5, currentLevel));
}

/**
 * Получение титула по уровню
 * @param {number} level - уровень
 * @returns {string}
 */
export function getTitle(level) {
  if (level >= 200) return '🌟 Легенда Галактики';
  if (level >= 150) return '💫 Повелитель Звёзд';
  if (level >= 100) return '☀️ Солнечный Странник';
  if (level >= 75) return '🌌 Космический Рыцарь';
  if (level >= 50) return '⭐ Звёздный Охотник';
  if (level >= 40) return '🔮 Мистик';
  if (level >= 30) return '👑 Золотой Воин';
  if (level >= 25) return '⚡ Громовержец';
  if (level >= 20) return '🔥 Огненный Мастер';
  if (level >= 15) return '🌑 Теневой Клинок';
  if (level >= 10) return '❄️ Ледяной Странник';
  if (level >= 5) return '🩸 Кровавый Новичок';
  if (level >= 3) return '🌙 Ученик Луны';
  return '✨ Новичок';
}

export function getClickUpgradeCost(level) {
 const c=CONSTANTS.UPGRADE_COSTS.clickDamage,cap=CONSTANTS.SAFE_NUMBER_CAP;
 if(level>=Math.log(cap/c.base)/Math.log(c.multiplier))return cap;
 return Math.min(cap,Math.floor(c.base*Math.pow(c.multiplier,level)));
}
