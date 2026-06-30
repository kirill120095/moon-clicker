// Конфигурация игры: URL, ключи, настройки
export const SUPABASE_URL = 'https://zllnsmztaakdwjpnijsk.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_AHp63XmOZhgE2xYmhxFvsw_cB1urGrt';

export const TEST_MODE = true;               // true – HP уменьшены в 10 раз для теста
export const HP_SCALE = TEST_MODE ? 0.1 : 1;
export const BOSS_INTERVAL = 10;             // босс каждые 10 уровней
export const BOSS_TIMER = 30;                // секунд на босса
export const BASE_HP = 100 * HP_SCALE;       // базовое HP для 1-го уровня

// --- Стоимость улучшений в магазине ---
export const UPGRADE_COSTS = {
    clickDamage: {
        base: 50,
        multiplier: 1.8
    }
};

// --- Типы лун ---
export const MOON_TYPES = {
    normal: {
        id: 'normal',
        name: 'Обычная',
        emoji: '🌙',
        cost: 0,
        damageBonus: 0,
        shardBonus: 0,
        gradient: 'radial-gradient(circle at 30% 30%, #f0e6d0, #d4af37)',
        shadow: '0 0 60px rgba(255,215,150,0.4), 0 0 120px rgba(255,215,150,0.2), inset -35px -35px 90px rgba(0,0,0,0.4), inset 35px 35px 90px rgba(255,255,255,0.3)',
        accentColor: '#d4af37'
    },
    blood: {
        id: 'blood',
        name: 'Кровавая',
        emoji: '🩸',
        cost: 1000,
        damageBonus: 0.2,
        shardBonus: 0,
        gradient: 'radial-gradient(circle at 30% 30%, #8b0000, #4a0000)',
        shadow: '0 0 60px rgba(255,0,0,0.6), 0 0 120px rgba(255,0,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,0,0,0.2)',
        accentColor: '#cc0000'
    },
    ice: {
        id: 'ice',
        name: 'Ледяная',
        emoji: '❄️',
        cost: 20000,
        damageBonus: 0,
        shardBonus: 0.3,
        gradient: 'radial-gradient(circle at 30% 30%, #b3e5fc, #4fc3f7)',
        shadow: '0 0 60px rgba(79,195,247,0.6), 0 0 120px rgba(79,195,247,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(79,195,247,0.2)',
        accentColor: '#4fc3f7'
    },
    shadow: {
        id: 'shadow',
        name: 'Теневая',
        emoji: '🌑',
        cost: 400000,
        damageBonus: 0.1,
        shardBonus: 0.15,
        gradient: 'radial-gradient(circle at 30% 30%, #6a1b9a, #2a0a3a)',
        shadow: '0 0 60px rgba(106,27,154,0.6), 0 0 120px rgba(106,27,154,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(106,27,154,0.2)',
        accentColor: '#6a1b9a'
    },
    gold: {
        id: 'gold',
        name: 'Золотая',
        emoji: '🧈',
        cost: 8000000,
        damageBonus: 0.15,
        shardBonus: 0.2,
        gradient: 'radial-gradient(circle at 30% 30%, #fff9c4, #ffd700)',
        shadow: '0 0 60px rgba(255,215,0,0.6), 0 0 120px rgba(255,215,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,215,0,0.2)',
        accentColor: '#ffd700'
    }
};
