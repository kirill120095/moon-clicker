// ============================================================
//  КОНФИГУРАЦИЯ
// ============================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants.js';

export const CONFIG = {
    // Supabase
    supabase: {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        options: {
            auth: {
                persistSession: false,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'pkce'
            }
        }
    },
    
    // Игровые настройки
    game: {
        testMode: false,
        hpScale: 1,
        bossInterval: 10,
        bossTimer: 30,
        baseHP: 100,
        maxSlots: 3,
        maxClickDamageLevel: 10,
        maxMoonLevel: 10,
        minPasswordLength: 6,
        saveInterval: 30000,
        questResetInterval: 3600000,
        uiUpdateInterval: 16,
    },
    
    // UI настройки
    ui: {
        toastDuration: 2000,
        maxStars: 300,
        maxLeaders: 10,
        animationDuration: 300,
        levelUpDuration: 800,
        clickCooldown: 50,
    },
    
    // API эндпоинты
    endpoints: {
        players: 'players',
        profiles: 'profiles',
        stats: 'stats',
    }
};

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КОНФИГУРАЦИИ
// ============================================================

export function getMoonUpgradeCost(moonId, currentLevel) {
    const { MOON_TYPES } = await import('./constants.js');
    const moon = MOON_TYPES[moonId];
    if (!moon) return 100;
    const baseCost = Math.max(100, moon.cost * 0.1);
    return Math.floor(baseCost * Math.pow(1.5, currentLevel - 1));
}

export function getSlotUpgradeCost(slotIndex) {
    const { CONSTANTS } = await import('./constants.js');
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
