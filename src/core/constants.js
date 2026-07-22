// ============================================================
// КОНСТАНТЫ
// ============================================================

export const CONSTANTS = {
  BOSS_INTERVAL: 10,
  BOSS_TIMER: 30,
  BASE_HP: 100,
  MAX_SLOTS: 3, // УМЕНЬШЕНО ДО 3

  UPGRADE_COSTS: {
    clickDamage: {
      base: 30,
      multiplier: 1.35
    },
    moonSlots: {
      base: 1500,
      multiplier: 2.8 // УВЕЛИЧЕНО, так как всего 3 слота
    }
  },

  INTERVALS: {
    SAVE_TIME: 30000,
    QUEST_RESET: 86400000,
    WEEKLY_RESET: 604800000,
    UI_UPDATE: 16,
    BOSS_TICK: 1000,
    TOAST_DURATION: 2000,
  },

  LIMITS: {
    MAX_CLICK_DAMAGE_LEVEL: 50,
    MAX_MOON_LEVEL: 10,
    MAX_LEADERS: 10,
    MAX_STARS: 300,
    MAX_QUESTS: 6,
  },

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
// ТИПЫ ЛУН - КАЖДАЯ УНИКАЛЬНА
// ============================================================
export const MOON_TYPES = {
  normal: {
    id: 'normal',
    name: 'Обычная',
    emoji: '🌙',
    cost: 0,
    unlockLevel: 1,
    rarity: 'common',
    
    // Базовые бонусы
    damageBonus: 0.05,
    shardBonus: 0,
    critChanceBonus: 0,
    critDamageBonus: 0,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Combo Master
    specialMechanic: 'combo',
    specialName: 'Комбо-мастер',
    specialDescription: 'Каждые 10 кликов подряд дают +5% к урону (до +50%)',
    specialValue: 0.05,
    specialMaxStacks: 10,
    
    description: 'Верный спутник, становящийся сильнее с каждым ударом',
    gradient: 'radial-gradient(circle at 30% 30%, #f0e6d0, #d4af37)',
    shadow: '0 0 60px rgba(255,215,150,0.4), 0 0 120px rgba(255,215,150,0.2), inset -35px -35px 90px rgba(0,0,0,0.4), inset 35px 35px 90px rgba(255,255,255,0.3)',
    accentColor: '#d4af37',
    auraColor: 'rgba(240, 230, 208, 0.4)',
    auraClass: 'aura-normal'
  },
  
  blood: {
    id: 'blood',
    name: 'Кровавая',
    emoji: '🩸',
    cost: 800,
    unlockLevel: 5,
    rarity: 'rare',
    
    damageBonus: 0.25,
    shardBonus: 0,
    critChanceBonus: 0.03,
    critDamageBonus: 0.15,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Lifesteal
    specialMechanic: 'lifesteal',
    specialName: 'Вампиризм',
    specialDescription: 'Убийство восстанавливает 20% от макс. HP луны',
    specialValue: 0.20,
    
    description: 'Питается жизненной силой, исцеляя себя',
    gradient: 'radial-gradient(circle at 30% 30%, #8b0000, #4a0000)',
    shadow: '0 0 60px rgba(255,0,0,0.6), 0 0 120px rgba(255,0,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,0,0,0.2)',
    accentColor: '#cc0000',
    auraColor: 'rgba(255, 0, 0, 0.5)',
    auraClass: 'aura-blood'
  },
  
  ice: {
    id: 'ice',
    name: 'Ледяная',
    emoji: '❄️',
    cost: 5000,
    unlockLevel: 10,
    rarity: 'rare',
    
    damageBonus: 0.10,
    shardBonus: 0.35,
    critChanceBonus: 0.02,
    critDamageBonus: 0,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Заморозка босса
    specialMechanic: 'freeze',
    specialName: 'Заморозка времени',
    specialDescription: 'Таймер босса замедляется на 50%, давая больше времени',
    specialValue: 0.50,
    
    description: 'Замораживает время вокруг врагов',
    gradient: 'radial-gradient(circle at 30% 30%, #b3e5fc, #4fc3f7)',
    shadow: '0 0 60px rgba(79,195,247,0.6), 0 0 120px rgba(79,195,247,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(79,195,247,0.2)',
    accentColor: '#4fc3f7',
    auraColor: 'rgba(79, 195, 247, 0.5)',
    auraClass: 'aura-ice'
  },
  
  shadow: {
    id: 'shadow',
    name: 'Теневая',
    emoji: '🌑',
    cost: 25000,
    unlockLevel: 15,
    rarity: 'epic',
    
    damageBonus: 0.20,
    shardBonus: 0.15,
    critChanceBonus: 0.08,
    critDamageBonus: 0.10,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Уклонение
    specialMechanic: 'evasion',
    specialName: 'Уклонение',
    specialDescription: 'Шанс 15% уклониться от атаки босса (не потерять время)',
    specialValue: 0.15,
    
    description: 'Скрывается во мраке, уклоняясь от ударов',
    gradient: 'radial-gradient(circle at 30% 30%, #6a1b9a, #2a0a3a)',
    shadow: '0 0 60px rgba(106,27,154,0.6), 0 0 120px rgba(106,27,154,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(106,27,154,0.2)',
    accentColor: '#6a1b9a',
    auraColor: 'rgba(106, 27, 154, 0.5)',
    auraClass: 'aura-shadow'
  },
  
  fire: {
    id: 'fire',
    name: 'Огненная',
    emoji: '🔥',
    cost: 75000,
    unlockLevel: 20,
    rarity: 'epic',
    
    damageBonus: 0.30,
    shardBonus: 0.05,
    critChanceBonus: 0.05,
    critDamageBonus: 0.35,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Поджог
    specialMechanic: 'burn',
    specialName: 'Поджог',
    specialDescription: 'Каждый 5-й клик наносит额外 100% урона как огонь',
    specialValue: 1.0,
    specialInterval: 5,
    
    description: 'Обжигает всё живое, нанося дополнительный урон',
    gradient: 'radial-gradient(circle at 30% 30%, #ff6f00, #bf360c)',
    shadow: '0 0 60px rgba(255,100,0,0.6), 0 0 120px rgba(255,100,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,100,0,0.2)',
    accentColor: '#ff6f00',
    auraColor: 'rgba(255, 100, 0, 0.5)',
    auraClass: 'aura-fire'
  },
  
  electric: {
    id: 'electric',
    name: 'Электрическая',
    emoji: '⚡',
    cost: 250000,
    unlockLevel: 25,
    rarity: 'epic',
    
    damageBonus: 0.20,
    shardBonus: 0.20,
    critChanceBonus: 0.06,
    critDamageBonus: 0.20,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Цепная молния
    specialMechanic: 'chain',
    specialName: 'Цепная молния',
    specialDescription: 'Шанс 20% нанести двойной удар (2x урон)',
    specialValue: 0.20,
    
    description: 'Разряды молний бьют с удвоенной силой',
    gradient: 'radial-gradient(circle at 30% 30%, #fff176, #fdd835)',
    shadow: '0 0 60px rgba(255,235,59,0.6), 0 0 120px rgba(255,235,59,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,235,59,0.2)',
    accentColor: '#fdd835',
    auraColor: 'rgba(255, 235, 59, 0.5)',
    auraClass: 'aura-electric'
  },
  
  gold: {
    id: 'gold',
    name: 'Золотая',
    emoji: '👑',
    cost: 1000000,
    unlockLevel: 30,
    rarity: 'legendary',
    
    damageBonus: 0.15,
    shardBonus: 0.70,
    critChanceBonus: 0.04,
    critDamageBonus: 0.15,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Золотой дождь
    specialMechanic: 'goldRush',
    specialName: 'Золотой дождь',
    specialDescription: 'Убийство босса дает +100% осколков бонусом',
    specialValue: 1.0,
    
    description: 'Притягивает богатство из космоса',
    gradient: 'radial-gradient(circle at 30% 30%, #fff9c4, #ffd700)',
    shadow: '0 0 60px rgba(255,215,0,0.6), 0 0 120px rgba(255,215,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,215,0,0.2)',
    accentColor: '#ffd700',
    auraColor: 'rgba(255, 215, 0, 0.5)',
    auraClass: 'aura-gold'
  },
  
  cosmic: {
    id: 'cosmic',
    name: 'Космическая',
    emoji: '✨',
    cost: 5000000,
    unlockLevel: 40,
    rarity: 'mythic',
    
    damageBonus: 0.35,
    shardBonus: 0.40,
    critChanceBonus: 0.10,
    critDamageBonus: 0.30,
    
    // УНИКАЛЬНАЯ МЕХАНИКА: Космическое масштабирование
    specialMechanic: 'scaling',
    specialName: 'Космическая мощь',
    specialDescription: 'Все бонусы увеличиваются на +1% за каждый уровень игрока',
    specialValue: 0.01,
    
    description: 'Сила вселенной растет вместе с вами',
    gradient: 'radial-gradient(circle at 30% 30%, #e1bee7, #4a148c, #1a237e)',
    shadow: '0 0 80px rgba(156,39,176,0.8), 0 0 160px rgba(63,81,181,0.4), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(233,30,99,0.3)',
    accentColor: '#9c27b0',
    auraColor: 'rgba(156, 39, 176, 0.5)',
    auraClass: 'aura-cosmic'
  }
};

// ============================================================
// СИНЕРГИИ (МАКС 3 ЛУНЫ, ЧЕМ ДОРОЖЕ - ТЕМ СИЛЬНЕЕ)
// ============================================================
export const SYNERGY_BONUSES = {
  // ==== TIER 1: НАЧАЛЬНЫЕ (дешёвые луны) ====
  'blood+fire': {
    name: 'Адское пламя',
    tier: 1,
    tierName: 'Начальная',
    tierColor: '#8bc34a',
    damageBonus: 0.25,
    shardBonus: 0,
    critChanceBonus: 0.03,
    critDamageBonus: 0.15,
    icon: '🔥',
    description: 'Огонь и кровь питают друг друга',
    auraCombo: ['aura-blood', 'aura-fire']
  },
  'blood+ice': {
    name: 'Кровавый лёд',
    tier: 1,
    tierName: 'Начальная',
    tierColor: '#8bc34a',
    damageBonus: 0.20,
    shardBonus: 0.15,
    critChanceBonus: 0.04,
    critDamageBonus: 0.10,
    icon: '🧊',
    description: 'Замороженная кровь',
    auraCombo: ['aura-blood', 'aura-ice']
  },
  'ice+shadow': {
    name: 'Ледяная тень',
    tier: 1,
    tierName: 'Начальная',
    tierColor: '#8bc34a',
    damageBonus: 0.15,
    shardBonus: 0.20,
    critChanceBonus: 0.05,
    critDamageBonus: 0.05,
    icon: '🌑',
    description: 'Тени крадут тепло',
    auraCombo: ['aura-ice', 'aura-shadow']
  },
  
  // ==== TIER 2: СРЕДНИЕ (комбинации средних лун) ====
  'blood+shadow': {
    name: 'Тёмная кровь',
    tier: 2,
    tierName: 'Средняя',
    tierColor: '#03a9f4',
    damageBonus: 0.35,
    shardBonus: 0.20,
    critChanceBonus: 0.08,
    critDamageBonus: 0.20,
    icon: '🌒',
    description: 'Тени пропитаны кровью',
    auraCombo: ['aura-blood', 'aura-shadow']
  },
  'fire+electric': {
    name: 'Грозовой пожар',
    tier: 2,
    tierName: 'Средняя',
    tierColor: '#03a9f4',
    damageBonus: 0.40,
    shardBonus: 0.15,
    critChanceBonus: 0.07,
    critDamageBonus: 0.25,
    icon: '⚡',
    description: 'Молнии разжигают пожары',
    auraCombo: ['aura-fire', 'aura-electric']
  },
  'ice+electric': {
    name: 'Ледяная буря',
    tier: 2,
    tierName: 'Средняя',
    tierColor: '#03a9f4',
    damageBonus: 0.25,
    shardBonus: 0.30,
    critChanceBonus: 0.10,
    critDamageBonus: 0.10,
    icon: '❄️',
    description: 'Мороз усиливает разряды',
    auraCombo: ['aura-ice', 'aura-electric']
  },
  'fire+shadow': {
    name: 'Теневой огонь',
    tier: 2,
    tierName: 'Средняя',
    tierColor: '#03a9f4',
    damageBonus: 0.35,
    shardBonus: 0.15,
    critChanceBonus: 0.06,
    critDamageBonus: 0.20,
    icon: '🔥',
    description: 'Огонь скрытый во тьме',
    auraCombo: ['aura-fire', 'aura-shadow']
  },
  
  // ==== TIER 3: ПРОДВИНУТЫЕ (с дорогими лунами) ====
  'fire+gold': {
    name: 'Пылающее золото',
    tier: 3,
    tierName: 'Продвинутая',
    tierColor: '#ff9800',
    damageBonus: 0.35,
    shardBonus: 0.50,
    critChanceBonus: 0.08,
    critDamageBonus: 0.25,
    icon: '🔱',
    description: 'Расплавленное богатство',
    auraCombo: ['aura-fire', 'aura-gold']
  },
  'electric+gold': {
    name: 'Золотая молния',
    tier: 3,
    tierName: 'Продвинутая',
    tierColor: '#ff9800',
    damageBonus: 0.30,
    shardBonus: 0.55,
    critChanceBonus: 0.12,
    critDamageBonus: 0.20,
    icon: '⚡',
    description: 'Золото проводит ток',
    auraCombo: ['aura-electric', 'aura-gold']
  },
  'shadow+gold': {
    name: 'Теневой капитал',
    tier: 3,
    tierName: 'Продвинутая',
    tierColor: '#ff9800',
    damageBonus: 0.25,
    shardBonus: 0.50,
    critChanceBonus: 0.08,
    critDamageBonus: 0.15,
    icon: '💰',
    description: 'Тень приносит богатство',
    auraCombo: ['aura-shadow', 'aura-gold']
  },
  'ice+gold': {
    name: 'Замороженное богатство',
    tier: 3,
    tierName: 'Продвинутая',
    tierColor: '#ff9800',
    damageBonus: 0.25,
    shardBonus: 0.60,
    critChanceBonus: 0.06,
    critDamageBonus: 0.10,
    icon: '💎',
    description: 'Лёд сохраняет сокровища',
    auraCombo: ['aura-ice', 'aura-gold']
  },
  'blood+fire+shadow': {
    name: 'Адская тень',
    tier: 3,
    tierName: 'Продвинутая',
    tierColor: '#ff9800',
    damageBonus: 0.60,
    shardBonus: 0.20,
    critChanceBonus: 0.15,
    critDamageBonus: 0.40,
    icon: '👹',
    description: 'Три стихии тьмы',
    auraCombo: ['aura-blood', 'aura-fire', 'aura-shadow']
  },
  'blood+ice+electric': {
    name: 'Шторм стихий',
    tier: 3,
    tierName: 'Продвинутая',
    tierColor: '#ff9800',
    damageBonus: 0.45,
    shardBonus: 0.35,
    critChanceBonus: 0.20,
    critDamageBonus: 0.25,
    icon: '🌪️',
    description: 'Буря крови, льда и молний',
    auraCombo: ['aura-blood', 'aura-ice', 'aura-electric']
  },
  
  // ==== TIER 4: ЛЕГЕНДАРНЫЕ (с cosmic) ====
  'electric+cosmic': {
    name: 'Звёздный разряд',
    tier: 4,
    tierName: 'Легендарная',
    tierColor: '#e91e63',
    damageBonus: 0.50,
    shardBonus: 0.40,
    critChanceBonus: 0.20,
    critDamageBonus: 0.35,
    icon: '🌌',
    description: 'Космическая энергия молний',
    auraCombo: ['aura-electric', 'aura-cosmic']
  },
  'fire+cosmic': {
    name: 'Звёздное пламя',
    tier: 4,
    tierName: 'Легендарная',
    tierColor: '#e91e63',
    damageBonus: 0.55,
    shardBonus: 0.35,
    critChanceBonus: 0.15,
    critDamageBonus: 0.45,
    icon: '☀️',
    description: 'Пламя звезды',
    auraCombo: ['aura-fire', 'aura-cosmic']
  },
  'ice+cosmic': {
    name: 'Космический мороз',
    tier: 4,
    tierName: 'Легендарная',
    tierColor: '#e91e63',
    damageBonus: 0.35,
    shardBonus: 0.55,
    critChanceBonus: 0.18,
    critDamageBonus: 0.20,
    icon: '❄️',
    description: 'Абсолютный ноль космоса',
    auraCombo: ['aura-ice', 'aura-cosmic']
  },
  'shadow+cosmic': {
    name: 'Тёмная материя',
    tier: 4,
    tierName: 'Легендарная',
    tierColor: '#e91e63',
    damageBonus: 0.50,
    shardBonus: 0.45,
    critChanceBonus: 0.22,
    critDamageBonus: 0.30,
    icon: '🌑',
    description: 'Сила тёмной материи',
    auraCombo: ['aura-shadow', 'aura-cosmic']
  },
  'blood+cosmic': {
    name: 'Кровавая звезда',
    tier: 4,
    tierName: 'Легендарная',
    tierColor: '#e91e63',
    damageBonus: 0.60,
    shardBonus: 0.30,
    critChanceBonus: 0.18,
    critDamageBonus: 0.50,
    icon: '🌟',
    description: 'Кровь звёзд',
    auraCombo: ['aura-blood', 'aura-cosmic']
  },
  'gold+cosmic': {
    name: 'Галактическая корона',
    tier: 4,
    tierName: 'Легендарная',
    tierColor: '#e91e63',
    damageBonus: 0.40,
    shardBonus: 0.80,
    critChanceBonus: 0.15,
    critDamageBonus: 0.30,
    icon: '👑',
    description: 'Золото галактики',
    auraCombo: ['aura-gold', 'aura-cosmic']
  },
  
  // ==== TIER 5: МИФИЧЕСКИЕ (3 луны с cosmic) ====
  'blood+fire+cosmic': {
    name: 'Адская звезда',
    tier: 5,
    tierName: 'Мифическая',
    tierColor: '#9c27b0',
    damageBonus: 0.90,
    shardBonus: 0.50,
    critChanceBonus: 0.30,
    critDamageBonus: 0.70,
    icon: '💥',
    description: 'Звезда питающаяся кровью',
    auraCombo: ['aura-blood', 'aura-fire', 'aura-cosmic']
  },
  'fire+gold+cosmic': {
    name: 'Солнечная корона',
    tier: 5,
    tierName: 'Мифическая',
    tierColor: '#9c27b0',
    damageBonus: 0.70,
    shardBonus: 0.90,
    critChanceBonus: 0.25,
    critDamageBonus: 0.60,
    icon: '☀️',
    description: 'Пылающее золото звезды',
    auraCombo: ['aura-fire', 'aura-gold', 'aura-cosmic']
  },
  'ice+electric+cosmic': {
    name: 'Квантовый шторм',
    tier: 5,
    tierName: 'Мифическая',
    tierColor: '#9c27b0',
    damageBonus: 0.80,
    shardBonus: 0.70,
    critChanceBonus: 0.35,
    critDamageBonus: 0.55,
    icon: '🌀',
    description: 'Квантовая буря',
    auraCombo: ['aura-ice', 'aura-electric', 'aura-cosmic']
  },
  'blood+shadow+cosmic': {
    name: 'Тёмная дыра',
    tier: 5,
    tierName: 'Мифическая',
    tierColor: '#9c27b0',
    damageBonus: 0.95,
    shardBonus: 0.60,
    critChanceBonus: 0.35,
    critDamageBonus: 0.75,
    icon: '🕳️',
    description: 'Поглощает всё вокруг',
    auraCombo: ['aura-blood', 'aura-shadow', 'aura-cosmic']
  },
  'shadow+gold+cosmic': {
    name: 'Звёздный торговец',
    tier: 5,
    tierName: 'Мифическая',
    tierColor: '#9c27b0',
    damageBonus: 0.65,
    shardBonus: 1.20,
    critChanceBonus: 0.25,
    critDamageBonus: 0.50,
    icon: '🌌',
    description: 'Торговец между галактиками',
    auraCombo: ['aura-shadow', 'aura-gold', 'aura-cosmic']
  },
  'fire+electric+cosmic': {
    name: 'Сверхновая',
    tier: 5,
    tierName: 'Мифическая',
    tierColor: '#9c27b0',
    damageBonus: 1.10,
    shardBonus: 0.60,
    critChanceBonus: 0.35,
    critDamageBonus: 0.85,
    icon: '💫',
    description: 'Взрыв звезды',
    auraCombo: ['aura-fire', 'aura-electric', 'aura-cosmic']
  }
};

// ============================================================
// ДОСТИЖЕНИЯ
// ============================================================
export const ACHIEVEMENTS = {
  clickNovice: {
    id: 'clickNovice',
    category: 'clicks',
    categoryName: 'Клики',
    icon: '👆',
    tiers: [
      { level: 'bronze', target: 100, name: 'Начинающий кликер', description: 'Сделайте 100 кликов', reward: 15 },
      { level: 'silver', target: 1000, name: 'Опытный кликер', description: 'Сделайте 1 000 кликов', reward: 50 },
      { level: 'gold', target: 10000, name: 'Мастер кликов', description: 'Сделайте 10 000 кликов', reward: 200 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      return (state?.clickCount || 0) >= tier.target;
    }
  },
  clickMaster: {
    id: 'clickMaster',
    category: 'clicks',
    categoryName: 'Клики',
    icon: '🖱️',
    tiers: [
      { level: 'bronze', target: 50000, name: 'Кликомания', description: 'Сделайте 50 000 кликов', reward: 500 },
      { level: 'silver', target: 250000, name: 'Кликер-легенда', description: 'Сделайте 250 000 кликов', reward: 1500 },
      { level: 'gold', target: 1000000, name: 'Бог кликов', description: 'Сделайте 1 000 000 кликов', reward: 5000 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      return (state?.clickCount || 0) >= tier.target;
    }
  },
  levelUp: {
    id: 'levelUp',
    category: 'levels',
    categoryName: 'Уровни',
    icon: '📈',
    tiers: [
      { level: 'bronze', target: 10, name: 'Путь начат', description: 'Достигните 10 уровня', reward: 40 },
      { level: 'silver', target: 25, name: 'Опытный искатель', description: 'Достигните 25 уровня', reward: 150 },
      { level: 'gold', target: 50, name: 'Покоритель миров', description: 'Достигните 50 уровня', reward: 500 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      return (state?.currentLevel || 1) >= tier.target;
    }
  },
  levelMaster: {
    id: 'levelMaster',
    category: 'levels',
    categoryName: 'Уровни',
    icon: '⭐',
    tiers: [
      { level: 'bronze', target: 75, name: 'Ветеран', description: 'Достигните 75 уровня', reward: 800 },
      { level: 'silver', target: 100, name: 'Сотня!', description: 'Достигните 100 уровня', reward: 2000 },
      { level: 'gold', target: 200, name: 'Легенда галактики', description: 'Достигните 200 уровня', reward: 5000 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      return (state?.currentLevel || 1) >= tier.target;
    }
  },
  bossSlayer: {
    id: 'bossSlayer',
    category: 'bosses',
    categoryName: 'Боссы',
    icon: '👹',
    tiers: [
      { level: 'bronze', target: 5, name: 'Охотник на боссов', description: 'Убейте 5 боссов', reward: 100 },
      { level: 'silver', target: 25, name: 'Гроза боссов', description: 'Убейте 25 боссов', reward: 400 },
      { level: 'gold', target: 100, name: 'Легендарный убийца', description: 'Убейте 100 боссов', reward: 1500 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      return (state?.bossKills || 0) >= tier.target;
    }
  },
  moonCollector: {
    id: 'moonCollector',
    category: 'moons',
    categoryName: 'Луны',
    icon: '🌙',
    tiers: [
      { level: 'bronze', target: 3, name: 'Собиратель', description: 'Соберите 3 разных луны', reward: 80 },
      { level: 'silver', target: 5, name: 'Коллекционер', description: 'Соберите 5 разных лун', reward: 300 },
      { level: 'gold', target: 8, name: 'Повелитель лун', description: 'Соберите все 8 лун', reward: 1500 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      const ownedCount = state?.ownedMoons?.length || 0;
      return ownedCount >= tier.target;
    }
  },
  moonUpgrader: {
    id: 'moonUpgrader',
    category: 'moons',
    categoryName: 'Луны',
    icon: '⬆️',
    tiers: [
      { level: 'bronze', target: 3, name: 'Улучшатель', description: 'Прокачайте любую луну до 3 уровня', reward: 100 },
      { level: 'silver', target: 7, name: 'Мастер лун', description: 'Прокачайте любую луну до 7 уровня', reward: 400 },
      { level: 'gold', target: 10, name: 'Максимальная мощь', description: 'Прокачайте любую луну до 10 уровня', reward: 1200 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      const moonLevels = state?.moonLevels || {};
      const maxLevel = Math.max(0, ...Object.values(moonLevels));
      return maxLevel >= tier.target;
    }
  },
  shardCollector: {
    id: 'shardCollector',
    category: 'wealth',
    categoryName: 'Богатство',
    icon: '💎',
    tiers: [
      { level: 'bronze', target: 1000, name: 'Первая тысяча', description: 'Накопите 1 000 осколков', reward: 30 },
      { level: 'silver', target: 10000, name: 'Десять тысяч', description: 'Накопите 10 000 осколков', reward: 150 },
      { level: 'gold', target: 100000, name: 'Сто тысяч!', description: 'Накопите 100 000 осколков', reward: 600 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      const shards = state?.playerData?.shards || 0;
      return shards >= tier.target;
    }
  },
  shardMillionaire: {
    id: 'shardMillionaire',
    category: 'wealth',
    categoryName: 'Богатство',
    icon: '💰',
    tiers: [
      { level: 'bronze', target: 500000, name: 'Полмиллиона', description: 'Накопите 500 000 осколков', reward: 1000 },
      { level: 'silver', target: 2000000, name: 'Мультимиллионер', description: 'Накопите 2 000 000 осколков', reward: 3000 },
      { level: 'gold', target: 10000000, name: 'Миллиардер', description: 'Накопите 10 000 000 осколков', reward: 10000 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      const shards = state?.playerData?.shards || 0;
      return shards >= tier.target;
    }
  },
  slotMaster: {
    id: 'slotMaster',
    category: 'slots',
    categoryName: 'Слоты',
    icon: '🎰',
    tiers: [
      { level: 'bronze', target: 2, name: 'Двойной слот', description: 'Откройте 2 слота', reward: 80 },
      { level: 'silver', target: 3, name: 'Все слоты открыты', description: 'Откройте все 3 слота', reward: 500 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      return (state?.maxSlots || 1) >= tier.target;
    }
  },
  synergyHunter: {
    id: 'synergyHunter',
    category: 'synergies',
    categoryName: 'Синергии',
    icon: '🔗',
    tiers: [
      { level: 'bronze', target: 1, name: 'Первая синергия', description: 'Активируйте 1 синергию', reward: 100 },
      { level: 'silver', target: 3, name: 'Мастер комбинаций', description: 'Активируйте 3 синергии', reward: 400 },
      { level: 'gold', target: 5, name: 'Синергетический бог', description: 'Активируйте 5 синергий', reward: 1500 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      if (typeof window === 'undefined') return false;
      const synergyCount = window._activeSynergies?.length || 0;
      return synergyCount >= tier.target;
    }
  },
  timePlayed: {
    id: 'timePlayed',
    category: 'time',
    categoryName: 'Время',
    icon: '⏱️',
    tiers: [
      { level: 'bronze', target: 3600, name: 'Первый час', description: 'Сыграйте 1 час', reward: 50 },
      { level: 'silver', target: 36000, name: '10 часов', description: 'Сыграйте 10 часов', reward: 300 },
      { level: 'gold', target: 360000, name: '100 часов!', description: 'Сыграйте 100 часов', reward: 1500 }
    ],
    check: (state, tier) => {
      if (!tier || typeof tier.target !== 'number') return false;
      return (state?.totalSecondsPlayed || 0) >= tier.target;
    }
  }
};

// ============================================================
// КВЕСТЫ
// ============================================================
export const QUESTS = {
  clickDaily100: {
    id: 'clickDaily100',
    category: 'clicker',
    categoryName: 'Кликер',
    icon: '👆',
    name: 'Утренняя разминка',
    description: 'Сделайте 100 кликов за день',
    target: 100,
    reward: 20,
    bonusReward: 10,
    type: 'click',
    difficulty: 'easy',
    color: '#4caf50'
  },
  clickDaily500: {
    id: 'clickDaily500',
    category: 'clicker',
    categoryName: 'Кликер',
    icon: '🖱️',
    name: 'Марафон кликов',
    description: 'Сделайте 500 кликов за день',
    target: 500,
    reward: 60,
    bonusReward: 30,
    type: 'click',
    difficulty: 'medium',
    color: '#ff9800'
  },
  clickDaily2000: {
    id: 'clickDaily2000',
    category: 'clicker',
    categoryName: 'Кликер',
    icon: '⚡',
    name: 'Кликомания',
    description: 'Сделайте 2000 кликов за день',
    target: 2000,
    reward: 200,
    bonusReward: 100,
    type: 'click',
    difficulty: 'hard',
    color: '#f44336'
  },
  killBoss1: {
    id: 'killBoss1',
    category: 'hunter',
    categoryName: 'Охотник',
    icon: '👹',
    name: 'Первая кровь',
    description: 'Убейте 1 босса',
    target: 1,
    reward: 80,
    bonusReward: 40,
    type: 'bossKill',
    difficulty: 'easy',
    color: '#4caf50'
  },
  killBoss3: {
    id: 'killBoss3',
    category: 'hunter',
    categoryName: 'Охотник',
    icon: '⚔️',
    name: 'Серия убийств',
    description: 'Убейте 3 боссов',
    target: 3,
    reward: 200,
    bonusReward: 100,
    type: 'bossKill',
    difficulty: 'medium',
    color: '#ff9800'
  },
  killBoss10: {
    id: 'killBoss10',
    category: 'hunter',
    categoryName: 'Охотник',
    icon: '💀',
    name: 'Истребитель',
    description: 'Убейте 10 боссов',
    target: 10,
    reward: 600,
    bonusReward: 300,
    type: 'bossKill',
    difficulty: 'hard',
    color: '#f44336'
  },
  shardDaily200: {
    id: 'shardDaily200',
    category: 'collector',
    categoryName: 'Коллекционер',
    icon: '💎',
    name: 'Скромная добыча',
    description: 'Соберите 200 осколков за день',
    target: 200,
    reward: 40,
    bonusReward: 20,
    type: 'shard',
    difficulty: 'easy',
    color: '#4caf50'
  },
  shardDaily1000: {
    id: 'shardDaily1000',
    category: 'collector',
    categoryName: 'Коллекционер',
    icon: '💰',
    name: 'Хороший улов',
    description: 'Соберите 1000 осколков за день',
    target: 1000,
    reward: 120,
    bonusReward: 60,
    type: 'shard',
    difficulty: 'medium',
    color: '#ff9800'
  },
  shardDaily5000: {
    id: 'shardDaily5000',
    category: 'collector',
    categoryName: 'Коллекционер',
    icon: '🏆',
    name: 'Богатая жатва',
    description: 'Соберите 5000 осколков за день',
    target: 5000,
    reward: 400,
    bonusReward: 200,
    type: 'shard',
    difficulty: 'hard',
    color: '#f44336'
  },
  levelUp2: {
    id: 'levelUp2',
    category: 'progress',
    categoryName: 'Прогресс',
    icon: '📈',
    name: 'Быстрый рост',
    description: 'Повысьте уровень 2 раза за день',
    target: 2,
    reward: 50,
    bonusReward: 25,
    type: 'level',
    difficulty: 'easy',
    color: '#4caf50'
  },
  levelUp5: {
    id: 'levelUp5',
    category: 'progress',
    categoryName: 'Прогресс',
    icon: '🚀',
    name: 'Взрывной рост',
    description: 'Повысьте уровень 5 раз за день',
    target: 5,
    reward: 150,
    bonusReward: 75,
    type: 'level',
    difficulty: 'medium',
    color: '#ff9800'
  }
};

export const QUEST_CATEGORIES = {
  all: { name: 'Все', icon: '📋', color: '#9e9e9e' },
  clicker: { name: 'Кликер', icon: '👆', color: '#4caf50' },
  hunter: { name: 'Охотник', icon: '⚔️', color: '#f44336' },
  collector: { name: 'Коллекционер', icon: '💎', color: '#2196f3' },
  progress: { name: 'Прогресс', icon: '📈', color: '#ff9800' }
};

export const ACHIEVEMENT_CATEGORIES = {
  all: { name: 'Все', icon: '🏆' },
  clicks: { name: 'Клики', icon: '👆' },
  levels: { name: 'Уровни', icon: '📈' },
  bosses: { name: 'Боссы', icon: '👹' },
  moons: { name: 'Луны', icon: '🌙' },
  wealth: { name: 'Богатство', icon: '💎' },
  slots: { name: 'Слоты', icon: '🎰' },
  synergies: { name: 'Синергии', icon: '🔗' },
  time: { name: 'Время', icon: '⏱️' }
};

export const RARITY_CONFIG = {
  common: { name: 'Обычная', color: '#9e9e9e', gradient: 'linear-gradient(135deg, #9e9e9e, #616161)' },
  rare: { name: 'Редкая', color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3, #0d47a1)' },
  epic: { name: 'Эпическая', color: '#9c27b0', gradient: 'linear-gradient(135deg, #9c27b0, #4a148c)' },
  legendary: { name: 'Легендарная', color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800, #e65100)' },
  mythic: { name: 'Мифическая', color: '#e91e63', gradient: 'linear-gradient(135deg, #e91e63, #880e4f)' }
};
