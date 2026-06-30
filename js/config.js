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
    },
    moonSlots: {
        base: 500,          // начальная цена за дополнительный слот
        multiplier: 2.5     // множитель цены за каждый следующий слот
    }
};

// --- Типы лун (с уровнями открытия) ---
export const MOON_TYPES = {
    normal: {
        id: 'normal',
        name: 'Обычная',
        emoji: '🌙',
        cost: 0,
        unlockLevel: 1,
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
        unlockLevel: 5,
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
        unlockLevel: 10,
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
        unlockLevel: 20,
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
        unlockLevel: 30,
        damageBonus: 0.15,
        shardBonus: 0.2,
        gradient: 'radial-gradient(circle at 30% 30%, #fff9c4, #ffd700)',
        shadow: '0 0 60px rgba(255,215,0,0.6), 0 0 120px rgba(255,215,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,215,0,0.2)',
        accentColor: '#ffd700'
    },
    fire: {
        id: 'fire',
        name: 'Огненная',
        emoji: '🔥',
        cost: 16000000,
        unlockLevel: 15,
        damageBonus: 0.25,
        shardBonus: 0,
        gradient: 'radial-gradient(circle at 30% 30%, #ff6f00, #bf360c)',
        shadow: '0 0 60px rgba(255,100,0,0.6), 0 0 120px rgba(255,100,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,100,0,0.2)',
        accentColor: '#ff6f00'
    },
    electric: {
        id: 'electric',
        name: 'Электрическая',
        emoji: '⚡',
        cost: 32000000,
        unlockLevel: 25,
        damageBonus: 0.1,
        shardBonus: 0.1,
        gradient: 'radial-gradient(circle at 30% 30%, #fff176, #fdd835)',
        shadow: '0 0 60px rgba(255,235,59,0.6), 0 0 120px rgba(255,235,59,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,235,59,0.2)',
        accentColor: '#fdd835'
    }
};

// --- Индивидуальная стоимость прокачки уровня луны (зависит от начальной цены) ---
export function getMoonUpgradeCost(moonId, currentLevel) {
    const moon = MOON_TYPES[moonId];
    if (!moon) return 100;
    // Базовая стоимость = 10% от начальной цены луны (минимум 100)
    const baseCost = Math.max(100, moon.cost * 0.1);
    // Стоимость растёт с каждым уровнем
    return Math.floor(baseCost * Math.pow(1.5, currentLevel - 1));
}

// --- Открытие слотов для активации нескольких лун (уровни) ---
export const MOON_SLOT_UNLOCK = {
    1: 1,    // 1 слот с 1 уровня
    2: 5,    // 2 слота с 5 уровня
    3: 15,   // 3 слота с 15 уровня
    4: 30,   // 4 слота с 30 уровня
    5: 50    // 5 слотов с 50 уровня
};

// --- Стоимость покупки дополнительного слота (если слота не хватает по уровням) ---
// В данной версии мы не используем покупку слотов за осколки, только через уровни.
// Но если вы хотите добавить такую возможность, раскомментируйте и используйте.

// --- Комбо-бонусы (синергия) ---
export const SYNERGY_BONUSES = {
    'blood+fire': {
        name: 'Адское пламя',
        damageBonus: 0.3,
        shardBonus: 0,
        description: '+30% урона'
    },
    'ice+electric': {
        name: 'Ледяная буря',
        damageBonus: 0,
        shardBonus: 0.4,
        description: '+40% осколков'
    },
    'shadow+gold': {
        name: 'Теневой капитал',
        damageBonus: 0.1,
        shardBonus: 0.2,
        description: '+10% урона, +20% осколков'
    },
    'normal+any': {
        name: 'Баланс',
        damageBonus: 0.05,
        shardBonus: 0.05,
        description: '+5% урона, +5% осколков'
    },
    'blood+ice': {
        name: 'Кровавый лёд',
        damageBonus: 0.15,
        shardBonus: 0.1,
        description: '+15% урона, +10% осколков'
    },
    'fire+shadow': {
        name: 'Теневой огонь',
        damageBonus: 0.2,
        shardBonus: 0.1,
        description: '+20% урона, +10% осколков'
    },
    'gold+electric': {
        name: 'Золотая молния',
        damageBonus: 0.1,
        shardBonus: 0.25,
        description: '+10% урона, +25% осколков'
    },
    'ice+shadow': {
        name: 'Ледяная тень',
        damageBonus: 0.05,
        shardBonus: 0.2,
        description: '+5% урона, +20% осколков'
    },
    'fire+electric': {
        name: 'Грозовой пожар',
        damageBonus: 0.2,
        shardBonus: 0.15,
        description: '+20% урона, +15% осколков'
    }
};

// --- Ачивки ---
export const ACHIEVEMENTS = {
    firstMoon: {
        id: 'firstMoon',
        name: 'Первая луна',
        description: 'Купите свою первую луну (не обычную)',
        check: (state) => state.ownedMoons && state.ownedMoons.length > 1,
        reward: 100,
        achieved: false
    },
    moonCollector: {
        id: 'moonCollector',
        name: 'Коллекционер',
        description: 'Соберите все 7 лун',
        check: (state) => state.ownedMoons && state.ownedMoons.length >= Object.keys(MOON_TYPES).length,
        reward: 5000,
        achieved: false
    },
    level20: {
        id: 'level20',
        name: 'Покоритель 20-го',
        description: 'Достигните 20 уровня',
        check: (state) => state.currentLevel >= 20,
        reward: 1000,
        achieved: false
    },
    bossSlayer: {
        id: 'bossSlayer',
        name: 'Убийца боссов',
        description: 'Убейте 10 боссов',
        check: (state) => state.bossKills >= 10,
        reward: 2000,
        achieved: false
    },
    clickMaster: {
        id: 'clickMaster',
        name: 'Мастер кликов',
        description: 'Сделайте 10 000 кликов',
        check: (state) => state.clickCount >= 10000,
        reward: 3000,
        achieved: false
    },
    moonUpgrader: {
        id: 'moonUpgrader',
        name: 'Улучшатель лун',
        description: 'Прокачайте любую луну до 5 уровня',
        check: (state) => Object.values(state.moonLevels || {}).some(lvl => lvl >= 5),
        reward: 1500,
        achieved: false
    },
    maxMoon: {
        id: 'maxMoon',
        name: 'Максимальная луна',
        description: 'Прокачайте любую луну до 10 уровня',
        check: (state) => Object.values(state.moonLevels || {}).some(lvl => lvl >= 10),
        reward: 5000,
        achieved: false
    }
};

// --- Квесты (обновляются каждый час) ---
export const QUESTS = {
    click100: {
        id: 'click100',
        name: '100 кликов',
        description: 'Сделайте 100 кликов',
        progress: 0,
        target: 100,
        reward: 50,
        type: 'click'
    },
    killBoss: {
        id: 'killBoss',
        name: 'Убить босса',
        description: 'Убейте 1 босса',
        progress: 0,
        target: 1,
        reward: 200,
        type: 'bossKill'
    },
    shard100: {
        id: 'shard100',
        name: 'Соберите 100 осколков',
        description: 'Накопите 100 осколков (суммарно за уровень)',
        progress: 0,
        target: 100,
        reward: 100,
        type: 'shard'
    },
    click500: {
        id: 'click500',
        name: '500 кликов',
        description: 'Сделайте 500 кликов',
        progress: 0,
        target: 500,
        reward: 150,
        type: 'click'
    },
    killBoss3: {
        id: 'killBoss3',
        name: 'Убить 3 боссов',
        description: 'Убейте 3 боссов',
        progress: 0,
        target: 3,
        reward: 500,
        type: 'bossKill'
    },
    shard500: {
        id: 'shard500',
        name: 'Соберите 500 осколков',
        description: 'Накопите 500 осколков',
        progress: 0,
        target: 500,
        reward: 300,
        type: 'shard'
    },
    level5: {
        id: 'level5',
        name: 'Достигните 5 уровня',
        description: 'Достигните 5 уровня',
        progress: 0,
        target: 5,
        reward: 100,
        type: 'level'
    }
};
