// ============================================================
//  КОНСТАНТЫ
// ============================================================

export const CONSTANTS = {
    // Игровые константы
    BOSS_INTERVAL: 10,
    BOSS_TIMER: 30,
    BASE_HP: 100,
    MAX_SLOTS: 3,
    
    // Стоимость улучшений
    UPGRADE_COSTS: {
        clickDamage: {
            base: 50,
            multiplier: 1.8
        },
        moonSlots: {
            base: 5000,
            multiplier: 3.0
        }
    },
    
    // Временные интервалы (в миллисекундах)
    INTERVALS: {
        SAVE_TIME: 30000,        // 30 секунд
        QUEST_RESET: 3600000,    // 1 час
        UI_UPDATE: 16,           // ~60 FPS
        BOSS_TICK: 1000,         // 1 секунда
        TOAST_DURATION: 2000,    // 2 секунды
    },
    
    // Ограничения
    LIMITS: {
        MAX_CLICK_DAMAGE_LEVEL: 10,
        MAX_MOON_LEVEL: 10,
        MAX_LEADERS: 10,
        MAX_STARS: 300,
        MAX_QUESTS: 8,
    },
    
    // Значения по умолчанию
    DEFAULTS: {
        LEVEL: 1,
        SHARDS: 0,
        CLICKS: 0,
        TIME_PLAYED: 0,
        MOON_HP: 100,
        BOSS_KILLS: 0,
        SLOT_LEVEL: 1,
        ACTIVE_MOON: 'normal',
        ACTIVE_MOONS: ['normal'],
        OWNED_MOONS: ['normal'],
        MOON_LEVELS: { normal: 1 },
    }
};

// ============================================================
//  ТИПЫ ЛУН
// ============================================================
export const MOON_TYPES = {
    normal: {
        id: 'normal',
        name: 'Обычная',
        emoji: '🌙',
        cost: 0,
        unlockLevel: 1,
        damageBonus: 0.05,
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
        damageBonus: 0.25,
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
        shardBonus: 0.35,
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
        damageBonus: 0.15,
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
        damageBonus: 0.2,
        shardBonus: 0.25,
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
        damageBonus: 0.3,
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
        damageBonus: 0.15,
        shardBonus: 0.15,
        gradient: 'radial-gradient(circle at 30% 30%, #fff176, #fdd835)',
        shadow: '0 0 60px rgba(255,235,59,0.6), 0 0 120px rgba(255,235,59,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,235,59,0.2)',
        accentColor: '#fdd835'
    }
};

// ============================================================
//  СИНЕРГИИ
// ============================================================
export const SYNERGY_BONUSES = {
    'blood+fire': {
        name: 'Адское пламя',
        damageBonus: 0.35,
        shardBonus: 0,
        description: '+35% урона'
    },
    'ice+electric': {
        name: 'Ледяная буря',
        damageBonus: 0,
        shardBonus: 0.45,
        description: '+45% осколков'
    },
    'shadow+gold': {
        name: 'Теневой капитал',
        damageBonus: 0.15,
        shardBonus: 0.25,
        description: '+15% урона, +25% осколков'
    },
    'blood+ice': {
        name: 'Кровавый лёд',
        damageBonus: 0.2,
        shardBonus: 0.15,
        description: '+20% урона, +15% осколков'
    },
    'fire+shadow': {
        name: 'Теневой огонь',
        damageBonus: 0.25,
        shardBonus: 0.1,
        description: '+25% урона, +10% осколков'
    },
    'gold+electric': {
        name: 'Золотая молния',
        damageBonus: 0.15,
        shardBonus: 0.3,
        description: '+15% урона, +30% осколков'
    },
    'ice+shadow': {
        name: 'Ледяная тень',
        damageBonus: 0.05,
        shardBonus: 0.25,
        description: '+5% урона, +25% осколков'
    },
    'fire+electric': {
        name: 'Грозовой пожар',
        damageBonus: 0.25,
        shardBonus: 0.2,
        description: '+25% урона, +20% осколков'
    },
    'blood+fire+ice': {
        name: 'Адский лёд',
        damageBonus: 0.45,
        shardBonus: 0.2,
        description: '+45% урона, +20% осколков'
    },
    'blood+fire+shadow': {
        name: 'Теневой ад',
        damageBonus: 0.5,
        shardBonus: 0.15,
        description: '+50% урона, +15% осколков'
    },
    'blood+fire+electric': {
        name: 'Грозовая кровь',
        damageBonus: 0.45,
        shardBonus: 0.25,
        description: '+45% урона, +25% осколков'
    },
    'blood+ice+electric': {
        name: 'Кровавая буря',
        damageBonus: 0.25,
        shardBonus: 0.55,
        description: '+25% урона, +55% осколков'
    },
    'blood+ice+shadow': {
        name: 'Кровавая тень',
        damageBonus: 0.3,
        shardBonus: 0.35,
        description: '+30% урона, +35% осколков'
    },
    'blood+shadow+gold': {
        name: 'Кровавый капитал',
        damageBonus: 0.35,
        shardBonus: 0.35,
        description: '+35% урона, +35% осколков'
    },
    'blood+gold+electric': {
        name: 'Золотая кровь',
        damageBonus: 0.35,
        shardBonus: 0.4,
        description: '+35% урона, +40% осколков'
    },
    'fire+ice+shadow': {
        name: 'Огненная тень',
        damageBonus: 0.35,
        shardBonus: 0.3,
        description: '+35% урона, +30% осколков'
    },
    'fire+ice+electric': {
        name: 'Ледяной гром',
        damageBonus: 0.3,
        shardBonus: 0.5,
        description: '+30% урона, +50% осколков'
    },
    'fire+shadow+gold': {
        name: 'Огненный капитал',
        damageBonus: 0.4,
        shardBonus: 0.3,
        description: '+40% урона, +30% осколков'
    },
    'fire+gold+electric': {
        name: 'Золотой гром',
        damageBonus: 0.35,
        shardBonus: 0.35,
        description: '+35% урона, +35% осколков'
    },
    'ice+shadow+gold': {
        name: 'Теневой лёд',
        damageBonus: 0.2,
        shardBonus: 0.45,
        description: '+20% урона, +45% осколков'
    },
    'ice+gold+electric': {
        name: 'Золотая стужа',
        damageBonus: 0.2,
        shardBonus: 0.55,
        description: '+20% урона, +55% осколков'
    },
    'shadow+gold+electric': {
        name: 'Теневая молния',
        damageBonus: 0.25,
        shardBonus: 0.45,
        description: '+25% урона, +45% осколков'
    },
    'blood+fire+gold': {
        name: 'Адское золото',
        damageBonus: 0.55,
        shardBonus: 0.25,
        description: '+55% урона, +25% осколков'
    }
};

// ============================================================
//  ДОСТИЖЕНИЯ
// ============================================================
export const ACHIEVEMENTS = {
    firstMoon: {
        id: 'firstMoon',
        name: 'Первая луна',
        description: 'Купите свою первую луну (не обычную)',
        check: (state) => state.ownedMoons && state.ownedMoons.length > 1,
        reward: 100
    },
    moonCollector: {
        id: 'moonCollector',
        name: 'Коллекционер',
        description: 'Соберите все 7 лун',
        check: (state) => state.ownedMoons && state.ownedMoons.length >= Object.keys(MOON_TYPES).length,
        reward: 5000
    },
    level20: {
        id: 'level20',
        name: 'Покоритель 20-го',
        description: 'Достигните 20 уровня',
        check: (state) => state.currentLevel >= 20,
        reward: 1000
    },
    bossSlayer: {
        id: 'bossSlayer',
        name: 'Убийца боссов',
        description: 'Убейте 10 боссов',
        check: (state) => state.bossKills >= 10,
        reward: 2000
    },
    clickMaster: {
        id: 'clickMaster',
        name: 'Мастер кликов',
        description: 'Сделайте 10 000 кликов',
        check: (state) => state.clickCount >= 10000,
        reward: 3000
    },
    moonUpgrader: {
        id: 'moonUpgrader',
        name: 'Улучшатель лун',
        description: 'Прокачайте любую луну до 5 уровня',
        check: (state) => Object.values(state.moonLevels || {}).some(lvl => lvl >= 5),
        reward: 1500
    },
    maxMoon: {
        id: 'maxMoon',
        name: 'Максимальная луна',
        description: 'Прокачайте любую луну до 10 уровня',
        check: (state) => Object.values(state.moonLevels || {}).some(lvl => lvl >= 10),
        reward: 5000
    },
    slotMaster: {
        id: 'slotMaster',
        name: 'Мастер слотов',
        description: 'Откройте 3 слота для лун',
        check: (state) => state.maxSlots >= 3,
        reward: 1000
    }
};

// ============================================================
//  КВЕСТЫ
// ============================================================
export const QUESTS = {
    click100: {
        id: 'click100',
        name: '100 кликов',
        description: 'Сделайте 100 кликов',
        target: 100,
        reward: 50,
        type: 'click'
    },
    killBoss: {
        id: 'killBoss',
        name: 'Убить босса',
        description: 'Убейте 1 босса',
        target: 1,
        reward: 200,
        type: 'bossKill'
    },
    shard100: {
        id: 'shard100',
        name: 'Соберите 100 осколков',
        description: 'Накопите 100 осколков',
        target: 100,
        reward: 100,
        type: 'shard'
    },
    click500: {
        id: 'click500',
        name: '500 кликов',
        description: 'Сделайте 500 кликов',
        target: 500,
        reward: 150,
        type: 'click'
    },
    killBoss3: {
        id: 'killBoss3',
        name: 'Убить 3 боссов',
        description: 'Убейте 3 боссов',
        target: 3,
        reward: 500,
        type: 'bossKill'
    },
    shard500: {
        id: 'shard500',
        name: 'Соберите 500 осколков',
        description: 'Накопите 500 осколков',
        target: 500,
        reward: 300,
        type: 'shard'
    },
    level5: {
        id: 'level5',
        name: 'Достигните 5 уровня',
        description: 'Достигните 5 уровня',
        target: 5,
        reward: 100,
        type: 'level'
    },
    slotUpgrade: {
        id: 'slotUpgrade',
        name: 'Откройте 2 слота',
        description: 'Откройте второй слот для лун',
        target: 1,
        reward: 300,
        type: 'slot'
    }
};
