// ============================================================
//  КОНФИГУРАЦИЯ
// ============================================================
import { CONSTANTS, MOON_TYPES } from './constants.js';

export const CONFIG = {
    supabase: {
        url: 'https://zllnsmztaakdwjpnijsk.supabase.co',
        anonKey: 'sb_publishable_AHp63XmOZhgE2xYmhxFvsw_cB1urGrt',
        options: {
            auth: {
                persistSession: false,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'pkce'
            }
        }
    },
    game: {
        testMode: false,
        hpScale: 1,
        bossInterval: CONSTANTS.BOSS_INTERVAL,
        bossTimer: CONSTANTS.BOSS_TIMER,
        baseHP: CONSTANTS.BASE_HP,
        maxSlots: CONSTANTS.MAX_SLOTS,
        maxClickDamageLevel: 10,
        maxMoonLevel: 10,
        minPasswordLength: 6,
        saveInterval: CONSTANTS.INTERVALS.SAVE_TIME,
        questResetInterval: CONSTANTS.INTERVALS.QUEST_RESET,
        uiUpdateInterval: CONSTANTS.INTERVALS.UI_UPDATE,
    },
    ui: {
        toastDuration: CONSTANTS.INTERVALS.TOAST_DURATION,
        maxStars: CONSTANTS.LIMITS.MAX_STARS,
        maxLeaders: CONSTANTS.LIMITS.MAX_LEADERS,
        animationDuration: 300,
        levelUpDuration: 800,
        clickCooldown: 50,
    },
    endpoints: {
        players: 'players',
        profiles: 'profiles',
        stats: 'stats',
    }
};

export function getMoonUpgradeCost(moonId, currentLevel) {
    const moon = MOON_TYPES[moonId];
    if (!moon) return 100;
    const baseCost = Math.max(100, moon.cost * 0.1);
    return Math.floor(baseCost * Math.pow(1.5, currentLevel - 1));
}

export function getSlotUpgradeCost(slotIndex) {
    return Math.floor(
        CONSTANTS.UPGRADE_COSTS.moonSlots.base *
        Math.pow(CONSTANTS.UPGRADE_COSTS.moonSlots.multiplier, slotIndex - 1)
    );
}

export function getMaxHPForLevel(level, baseHP, bossInterval) {
    if (level % bossInterval === 0) {
        return baseHP * level;
    }
    return baseHP * (1 + (level - 1) * 0.1);
}

export function isBossLevel(level, bossInterval) {
    return level % bossInterval === 0;
}

export function getTitle(level) {
    if (level < 10) return '🌱 Новичок';
    if (level < 20) return '🚀 Исследователь';
    if (level < 50) return '⚡ Мастер';
    if (level < 100) return '🌟 Легенда';
    if (level < 200) return '👑 Герой';
    if (level < 500) return '🔥 Мифический';
    return '💎 Бессмертный';
}
