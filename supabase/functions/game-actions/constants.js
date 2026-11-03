// ============================================================
// КОНСТАНТЫ - ОБНОВЛЁННАЯ СИСТЕМА ЛУН И ПРОКАЧКИ
// ============================================================

export const CONSTANTS = {
  BOSS_INTERVAL: 10,
  MOON_UPGRADE_COST_RATIO: 0.6,
  MOON_UPGRADE_PRICE_DIVISORS: { gold: 4, fire: 3 },
  BOSS_TIMER: 30,
  BASE_HP: 1000,
  MAX_SLOTS: 3,

  // Цены увеличены в 2 раза
  UPGRADE_COSTS: {
    clickDamage: { base: 60, multiplier: 1.22 },   // было 30
    moonSlots: { base: 3000, multiplier: 2.8 }      // было 1500
  },

  CLICK_DAMAGE_UPGRADE_VALUE: 20,
  HP_GROWTH: 1.08,
  SAFE_NUMBER_CAP: Number.MAX_SAFE_INTEGER,
  BOSS_HP_MULTIPLIER: 5,
  MAX_PLAYER_LEVEL: Infinity,
  MAX_CLICKS_PER_SECOND: 18,
  CLICK_BURST: 18,
  CLICK_TOKEN_CAPACITY: 36,
  ROLLBACK_LEVELS: 5,
  PRESTIGE: { DAMAGE_EVERY: 100, DAMAGE_PER_STEP: 0.01, SHARDS_EVERY: 300, SHARDS_PER_STEP: 0.05, COIN_EVERY: 50 },
  UFO: { UNLOCK_LEVEL: 5, BASE_COST: 400, COST_MULTIPLIER: 1.8, MAX_LEVEL: 5, BASE_INTERVAL: 3000, MIN_INTERVAL: 100, COMBO_RELAY_COST: 1000000, MAX_SHOTS_PER_ACTION: 32, INTERVAL_REDUCTION: 400, DAMAGE_MULTIPLIER: 0.5, MAX_IDLE_MS: 5000, UNIT_BASE_COST: 2400, UNIT_COST_MULTIPLIER: 2, MOON_BUFF_SCALE: 0.05, MOON_BUFFS: { normal: { comboDamage: 0.10 }, blood: { bossDamage: 0.20 }, ice: { haste: 0.10 }, shadow: { critChance: 0.08, critMultiplier: 1.5 }, fire: { damage: 0.15 }, electric: { chainEvery: 5, chainMultiplier: 1.5 }, gold: { rewardMultiplier: 0.5 }, cosmic: { damagePerLevel: 0.001 } } },
  MOON_REWARD: { BASE: 5, PER_LEVEL: 2, EXPONENT: 1.3, GROWTH: 0.5, BOSS_MULTIPLIER: 2.5 },

  INTERVALS: {
    SAVE_TIME: 30000,
    QUEST_RESET: 86400000,
    WEEKLY_RESET: 604800000,
    UI_UPDATE: 16,
    BOSS_TICK: 1000,
    TOAST_DURATION: 2000,
  },

  LIMITS: {
    MAX_CLICK_DAMAGE_LEVEL: Infinity,
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
    MOON_HP: 1000,
    BOSS_KILLS: 0,
    SLOT_LEVEL: 1,
    CLICK_DAMAGE: 10,
    ACTIVE_MOON: 'normal',
    ACTIVE_MOONS: ['normal'],
    OWNED_MOONS: ['normal'],
    MOON_LEVELS: { normal: 1 },
  },

  // Пароль для тестового режима
  TEST_MODE_PASSWORD: '1488'
};

// ============================================================
// ЦЕНЫ ПРОКАЧКИ ЛУН (зависят от редкости)
// Формула: baseCost × 1.5^(level-1)
// ============================================================
export const MOON_UPGRADE_BASE_COSTS = {
  common: 200,       // Обычная (было ~100, x2)
  rare: 1000,        // Редкие (было ~500, x2)
  epic: 5000,        // Эпические (было ~2500, x2)
  legendary: 20000,  // Легендарная (было ~10000, x2)
  mythic: 100000     // Мифическая (было ~50000, x2)
};

// ============================================================
// ТИПЫ ЛУН - ПОЛНАЯ СИСТЕМА С МИЛЕСТОУНАМИ
// ============================================================
export const MOON_TYPES = {
  // ============================================================
  // 🌙 ОБЫЧНАЯ ЛУНА
  // ============================================================
  normal: {
    id: 'normal',
    name: 'Обычная',
    emoji: '🌙',
    cost: 0,
    unlockLevel: 1,
    rarity: 'common',
    
    // Начальные параметры при покупке
    baseStats: {
      damageBonus: 0.05,
      shardBonus: 0,
      critChanceBonus: 0,
      critDamageBonus: 0
    },
    
    // Базовая механика
    specialMechanic: 'combo',
    specialName: 'Комбо-мастер',
    specialDescription: 'Каждые 10 кликов +5% урона (макс 10 стеков = +50%)',
    
    // Параметры механики (меняются с прокачкой)
    mechanicParams: {
      clicksPerStack: 10,
      bonusPerStack: 0.05,
      maxStacks: 10,
      resetTimeout: 15000
    },
    
    // Милестоуны прокачки
    milestones: {
      3: {
        icon: '🎯',
        name: 'Усиленное комбо',
        description: 'Урон за стек: 5% → 7.5% (макс +75%)',
        apply: (params) => { params.bonusPerStack = 0.075; }
      },
      5: {
        icon: '🎯',
        name: 'Быстрое комбо',
        description: 'Требуется кликов на стек: 10 → 8',
        apply: (params) => { params.clicksPerStack = 8; }
      },
      7: {
        icon: '🎯',
        name: 'Комбо-удача',
        description: 'При полном стаке: +10% получаемых осколков',
        apply: (params) => { params.shardBonusOnFullStack = 0.10; }
      },
      10: {
        icon: '👑',
        name: 'Мастер комбо',
        description: 'Не сбрасывается 30с + Урон за стек: 7.5% → 10% (макс +100%)',
        apply: (params) => { 
          params.resetTimeout = 30000; 
          params.bonusPerStack = 0.10; 
        }
      }
    },
    
    // Описание для магазина
    shopDescription: 'Верный спутник. Набирает силу с каждым ударом.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #f0e6d0, #d4af37)',
    shadow: '0 0 60px rgba(255,215,150,0.4), 0 0 120px rgba(255,215,150,0.2), inset -35px -35px 90px rgba(0,0,0,0.4), inset 35px 35px 90px rgba(255,255,255,0.3)',
    accentColor: '#d4af37'
  },

  // ============================================================
  // 🩸 КРОВАВАЯ ЛУНА
  // ============================================================
  blood: {
    id: 'blood',
    name: 'Кровавая',
    emoji: '🩸',
    cost: 1600,
    unlockLevel: 5,
    rarity: 'rare',
    
    baseStats: {
      damageBonus: 0.20,
      shardBonus: 0,
      critChanceBonus: 0.01,
      critDamageBonus: 0.50
    },
    
    specialMechanic: 'bloodMoon',
    specialName: 'Кровавая луна',
    specialDescription: 'При HP босса < 50%: +100% к урону',
    
    mechanicParams: {
      hpThreshold: 0.50,
      damageBonus: 1.00,
      executeThreshold: 0
    },
    
    milestones: {
      3: {
        icon: '🎯',
        name: 'Жажда крови',
        description: 'Бонус урона: +100% → +125%',
        apply: (params) => { params.damageBonus = 1.25; }
      },
      5: {
        icon: '🎯',
        name: 'Кровавый нюх',
        description: 'Порог активации: 50% → 75% HP (раньше!)',
        apply: (params) => { params.hpThreshold = 0.75; }
      },
      7: {
        icon: '🎯',
        name: 'Добивание',
        description: 'Бонус: +150%. При HP < 5% — мгновенная смерть',
        apply: (params) => { 
          params.damageBonus = 1.50; 
          params.executeThreshold = 0.05; 
        }
      },
      10: {
        icon: '👑',
        name: 'Кровавая жатва',
        description: 'Бонус: +200%. При HP < 10% — мгновенная смерть',
        apply: (params) => { 
          params.damageBonus = 2.00; 
          params.executeThreshold = 0.10; 
        }
      }
    },
    
    shopDescription: 'Питается слабостью раненых врагов.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #8b0000, #4a0000)',
    shadow: '0 0 60px rgba(255,0,0,0.6), 0 0 120px rgba(255,0,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,0,0,0.2)',
    accentColor: '#cc0000'
  },

  // ============================================================
  // ❄️ ЛЕДЯНАЯ ЛУНА
  // ============================================================
  ice: {
    id: 'ice',
    name: 'Ледяная',
    emoji: '❄️',
    cost: 6000,
    unlockLevel: 20,
    rarity: 'rare',
    
    baseStats: {
      damageBonus: 0.10,
      shardBonus: 0.20,
      critChanceBonus: 0.02,
      critDamageBonus: 0
    },
    
    specialMechanic: 'freeze',
    specialName: 'Заморозка времени',
    specialDescription: '+25% к таймеру босса',
    
    mechanicParams: {
      timerBonus: 0.25,
      pierceInterval: 0,
      pierceDamage: 0
    },
    
    milestones: {
      3: {
        icon: '🎯',
        name: 'Глубокая заморозка',
        description: 'Бонус времени: +25% → +35%',
        apply: (params) => { params.timerBonus = 0.35; }
      },
      5: {
        icon: '🎯',
        name: 'Ледяной покров',
        description: 'Бонус времени: +35% → +50%',
        apply: (params) => { params.timerBonus = 0.50; }
      },
      7: {
        icon: '🎯',
        name: 'Заморозка',
        description: 'Каждый 20-й клик: +500% урона (лёд колет)',
        apply: (params) => { 
          params.pierceInterval = 20; 
          params.pierceDamage = 5.00; 
        }
      },
      10: {
        icon: '👑',
        name: 'Вечная мерзлота',
        description: 'Каждый 10-й клик: +1000% урона',
        apply: (params) => { 
          params.pierceInterval = 10; 
          params.pierceDamage = 10.00; 
        }
      }
    },
    
    shopDescription: 'Замораживает время и пронзает врагов льдом.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #b3e5fc, #4fc3f7)',
    shadow: '0 0 60px rgba(79,195,247,0.6), 0 0 120px rgba(79,195,247,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(79,195,247,0.2)',
    accentColor: '#4fc3f7'
  },

  // ============================================================
  // 🌑 ТЕНЕВАЯ ЛУНА
  // ============================================================
  shadow: {
    id: 'shadow',
    name: 'Теневая',
    emoji: '🌑',
    cost: 18000,
    unlockLevel: 40,
    rarity: 'epic',
    
    baseStats: {
      damageBonus: 0.20,
      shardBonus: 0.10,
      critChanceBonus: 0.03,
      critDamageBonus: 1.00
    },
    
    specialMechanic: 'shadowCritStacks',
    specialName: 'Теневой удар',
    specialDescription: 'Каждые 10 кликов +25% крит урона (макс 10 стеков = +250%)',
    
    mechanicParams: {
      clicksPerStack: 10,
      critDamagePerStack: 0.25,
      maxStacks: 10,
      resetTimeout: 15000,
      firstStrikeCrit: false,
      doubleCritChance: 0,
      fullStackCritChance: 0
    },
    
    milestones: {
      3: {
        icon: '🎯',
        name: 'Глубокая тень',
        description: 'Урон за стек: 25% → 35% (макс +350%)',
        apply: (params) => { params.critDamagePerStack = 0.35; }
      },
      5: {
        icon: '🎯',
        name: 'Первый удар',
        description: 'Первый удар по любой луне = гарантированный крит',
        apply: (params) => { params.firstStrikeCrit = true; }
      },
      7: {
        icon: '🎯',
        name: 'Теневой двойник',
        description: '25% шанс что крит нанесёт ещё один удар',
        apply: (params) => { params.doubleCritChance = 0.25; }
      },
      10: {
        icon: '👑',
        name: 'Критическая удача',
        description: 'При полном стаке: +10% к шансу крита',
        apply: (params) => { params.fullStackCritChance = 0.10; }
      }
    },
    
    shopDescription: 'Накапливает силу тени для сокрушительных критов.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #6a1b9a, #2a0a3a)',
    shadow: '0 0 60px rgba(106,27,154,0.6), 0 0 120px rgba(106,27,154,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(106,27,154,0.2)',
    accentColor: '#6a1b9a'
  },

  // ============================================================
  // 🔥 ОГНЕННАЯ ЛУНА
  // ============================================================
  fire: {
    id: 'fire',
    name: 'Огненная',
    emoji: '🔥',
    cost: 350000,
    unlockLevel: 90,
    rarity: 'epic',
    
    baseStats: {
      damageBonus: 0.40,
      shardBonus: 0.20,
      critChanceBonus: 0.03,
      critDamageBonus: 0.50
    },
    
    specialMechanic: 'fireStacks',
    specialName: 'Накопление жара',
    specialDescription: 'Каждые 5 кликов +20% урона (макс 20 стеков = +400%)',
    
    mechanicParams: {
      clicksPerStack: 5,
      bonusPerStack: 0.20,
      maxStacks: 20,
      resetTimeout: 15000,
      safeStacks: 0,
      resetChance: 0
    },
    
    milestones: {
      3: {
        icon: '🎯',
        name: 'Адское пламя',
        description: 'Макс стеков: 20 → 30 (макс +600%)',
        apply: (params) => { params.maxStacks = 30; }
      },
      5: {
        icon: '🎯',
        name: 'Раскалённый металл',
        description: 'Бонус за стек: +20% → +25% (макс +750%)',
        apply: (params) => { params.bonusPerStack = 0.25; }
      },
      7: {
        icon: '🎯',
        name: 'Инферно',
        description: 'Бонус за стек: +25% → +30% (макс +900%)',
        apply: (params) => { params.bonusPerStack = 0.30; }
      },
      10: {
        icon: '👑',
        name: 'Атомная бомба',
        description: 'Неограниченные стеки: 0,01% шанс сброса до 30 стеков, если накоплено больше 30',
        apply: (params) => { 
          params.maxStacks = Infinity; 
          params.safeStacks = 30; 
          params.resetChance = 0.0001; 
        }
      }
    },
    
    shopDescription: 'Разогревается до невероятных температур.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #ff6f00, #bf360c)',
    shadow: '0 0 60px rgba(255,100,0,0.6), 0 0 120px rgba(255,100,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,100,0,0.2)',
    accentColor: '#ff6f00'
  },

  // ============================================================
  // ⚡ ЭЛЕКТРИЧЕСКАЯ ЛУНА
  // ============================================================
  electric: {
    id: 'electric',
    name: 'Электрическая',
    emoji: '⚡',
    cost: 140000,
    unlockLevel: 60,
    rarity: 'epic',
    
    baseStats: {
      damageBonus: 0.50,
      shardBonus: 0.50,
      critChanceBonus: 0.05,
      critDamageBonus: 0.50
    },
    
    specialMechanic: 'chainLightning',
    specialName: 'Цепная молния',
    specialDescription: 'Шанс вызвать молнию: 25%→x2, 5%→x5, 1%→x10',
    
    mechanicParams: {
      chanceX2: 0.25,
      chanceX5: 0.05,
      chanceX10: 0.01,
      pityBonus: 0,
      pityMax: 0,
      superconductorBonus: 0,
      superconductorClicks: 0,
      clickDamageBonusPerLevel: 1
    },
    
    milestones: {
      3: {
        icon: '🎯',
        name: 'Усиленный разряд',
        description: 'Шансы: 30%→x2, 7%→x5, 2%→x10',
        apply: (params) => { 
          params.chanceX2 = 0.30; 
          params.chanceX5 = 0.07; 
          params.chanceX10 = 0.02; 
        }
      },
      5: {
        icon: '🎯',
        name: 'Накопление заряда',
        description: 'Каждый клик без молнии: +2% к шансу (макс +20%)',
        apply: (params) => { 
          params.pityBonus = 0.02; 
          params.pityMax = 0.20; 
        }
      },
      7: {
        icon: '🎯',
        name: 'Сверхпроводник',
        description: 'При x5+: следующие 3 клика получают +50% к базовому урону',
        apply: (params) => { 
          params.superconductorBonus = 0.50; 
          params.superconductorClicks = 3; 
        }
      },
      10: {
        icon: '👑',
        name: 'Громовержец',
        description: 'Шансы: 40%→x2, 10%→x5, 3%→x10',
        apply: (params) => { 
          params.chanceX2 = 0.40; 
          params.chanceX5 = 0.10; 
          params.chanceX10 = 0.03; 
        }
      }
    },
    
    shopDescription: 'Хаотичные разряды огромной мощности.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #fff176, #fdd835)',
    shadow: '0 0 60px rgba(255,235,59,0.6), 0 0 120px rgba(255,235,59,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,235,59,0.2)',
    accentColor: '#fdd835'
  },

  // ============================================================
  // 👑 ЗОЛОТАЯ ЛУНА
  // ============================================================
  gold: {
    id: 'gold',
    name: 'Золотая',
    emoji: '👑',
    cost: 600000,
    unlockLevel: 120,
    rarity: 'legendary',
    
    baseStats: {
      damageBonus: 0.05,
      shardBonus: 1.00,
      critChanceBonus: 0.005,
      critDamageBonus: 0.05
    },
    
    specialMechanic: 'goldRush',
    specialName: 'Золотой дождь',
    specialDescription: 'x1,5 осколков с обычных, x2 с боссов',
    
    mechanicParams: {
      normalMultiplier: 1.5,
      bossMultiplier: 2,
      goldenClickChance: 0,
      goldenClickReward: 0,
      shardToDamageRatio: 0
    },
    
    milestones: {
      3: {
        icon: '🎯',
        name: 'Золотой клик I',
        description: '2,5% шанс получить +25 💎 за клик',
        apply: (params) => { 
          params.goldenClickChance = 0.025; 
          params.goldenClickReward = 25; 
        }
      },
      5: {
        icon: '🎯',
        name: 'Золотой клик II',
        description: '2,5% шанс получить +50 💎 за клик',
        apply: (params) => { 
          params.goldenClickChance = 0.025; 
          params.goldenClickReward = 50; 
        }
      },
      7: {
        icon: '🎯',
        name: 'Щедрость',
        description: 'Множители: x1,5/x2 → x2/x2,5',
        apply: (params) => { 
          params.normalMultiplier = 2; 
          params.bossMultiplier = 2.5; 
        }
      },
      10: {
        icon: '👑',
        name: 'Золотой дождь',
        description: '+0,0005% урона от текущего количества осколков',
        apply: (params) => { params.shardToDamageRatio = 0.000005; }
      }
    },
    
    shopDescription: 'Превращает клики в золото.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #fff9c4, #ffd700)',
    shadow: '0 0 60px rgba(255,215,0,0.6), 0 0 120px rgba(255,215,0,0.3), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(255,215,0,0.2)',
    accentColor: '#ffd700'
  },

  // ============================================================
  // ✨ КОСМИЧЕСКАЯ ЛУНА
  // ============================================================
  cosmic: {
    id: 'cosmic',
    name: 'Космическая',
    emoji: '✨',
    cost: 1500000,
    unlockLevel: 150,
    rarity: 'mythic',
    
    baseStats: {
      damageBonus: 0,
      shardBonus: 0,
      critChanceBonus: 0,
      critDamageBonus: 0
    },
    
    specialMechanic: 'scaling',
    specialName: 'Космическая мощь',
    specialDescription: '+1% урона, +0.25% осколков, +0.25% крит урона за уровень',
    
    mechanicParams: {
      damagePerLevel: 0.01,
      shardPerLevel: 0.0025,
      critDamagePerLevel: 0.0025,
      supernovaTriggered: false
    },
    
    milestones: {
      3: {
        icon: '🎯',
        name: 'Космический рост',
        description: 'Бонус урона за уровень: +1% → +2%',
        apply: (params) => { params.damagePerLevel = 0.02; }
      },
      5: {
        icon: '🎯',
        name: 'Космическое богатство',
        description: 'Бонус осколков за уровень: +0.25% → +1%',
        apply: (params) => { params.shardPerLevel = 0.01; }
      },
      7: {
        icon: '🎯',
        name: 'Космический резонанс',
        description: 'Бонус крит урона за уровень: +0.25% → +1%',
        apply: (params) => { params.critDamagePerLevel = 0.01; }
      },
      10: {
        icon: '👑',
        name: 'Сверхновая',
        description: 'Визуальный взрыв вселенной! (шуточный финал)',
        apply: (params) => { params.supernovaAvailable = true; }
      }
    },
    
    shopDescription: 'Сила самой вселенной. Растёт бесконечно.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #e1bee7, #4a148c, #1a237e)',
    shadow: '0 0 80px rgba(156,39,176,0.8), 0 0 160px rgba(63,81,181,0.4), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(233,30,99,0.3)',
    accentColor: '#9c27b0'
  }
};

// ============================================================
// СИНЕРГИИ (без изменений)
// ============================================================
export const SYNERGY_BONUSES = {
  'blood+fire': { name: 'Адское пламя', tier: 1, tierName: 'Начальная', tierColor: '#8bc34a', damageBonus: 0.25, shardBonus: 0, critChanceBonus: 0.02, critDamageBonus: 0.15, icon: '🔥', description: 'Огонь и кровь питают друг друга', auraCombo: ['aura-blood', 'aura-fire'] },
  'blood+ice': { name: 'Кровавый лёд', tier: 1, tierName: 'Начальная', tierColor: '#8bc34a', damageBonus: 0.20, shardBonus: 0.15, critChanceBonus: 0.02, critDamageBonus: 0.10, icon: '🧊', description: 'Замороженная кровь', auraCombo: ['aura-blood', 'aura-ice'] },
  'ice+shadow': { name: 'Ледяная тень', tier: 1, tierName: 'Начальная', tierColor: '#8bc34a', damageBonus: 0.15, shardBonus: 0.20, critChanceBonus: 0.02, critDamageBonus: 0.05, icon: '🌑', description: 'Тени крадут тепло', auraCombo: ['aura-ice', 'aura-shadow'] },
  'blood+shadow': { name: 'Тёмная кровь', tier: 2, tierName: 'Средняя', tierColor: '#03a9f4', damageBonus: 0.35, shardBonus: 0.20, critChanceBonus: 0.03, critDamageBonus: 0.20, icon: '🌒', description: 'Тени пропитаны кровью', auraCombo: ['aura-blood', 'aura-shadow'] },
  'fire+electric': { name: 'Грозовой пожар', tier: 2, tierName: 'Средняя', tierColor: '#03a9f4', damageBonus: 0.40, shardBonus: 0.15, critChanceBonus: 0.02, critDamageBonus: 0.25, icon: '⚡', description: 'Молнии разжигают пожары', auraCombo: ['aura-fire', 'aura-electric'] },
  'ice+electric': { name: 'Ледяная буря', tier: 2, tierName: 'Средняя', tierColor: '#03a9f4', damageBonus: 0.25, shardBonus: 0.30, critChanceBonus: 0.03, critDamageBonus: 0.10, icon: '❄️', description: 'Мороз усиливает разряды', auraCombo: ['aura-ice', 'aura-electric'] },
  'fire+shadow': { name: 'Теневой огонь', tier: 2, tierName: 'Средняя', tierColor: '#03a9f4', damageBonus: 0.35, shardBonus: 0.15, critChanceBonus: 0.02, critDamageBonus: 0.20, icon: '🔥', description: 'Огонь скрытый во тьме', auraCombo: ['aura-fire', 'aura-shadow'] },
  'fire+gold': { name: 'Пылающее золото', tier: 3, tierName: 'Продвинутая', tierColor: '#ff9800', damageBonus: 0.35, shardBonus: 0.50, critChanceBonus: 0.03, critDamageBonus: 0.25, icon: '🔱', description: 'Расплавленное богатство', auraCombo: ['aura-fire', 'aura-gold'] },
  'electric+gold': { name: 'Золотая молния', tier: 3, tierName: 'Продвинутая', tierColor: '#ff9800', damageBonus: 0.30, shardBonus: 0.55, critChanceBonus: 0.03, critDamageBonus: 0.20, icon: '⚡', description: 'Золото проводит ток', auraCombo: ['aura-electric', 'aura-gold'] },
  'shadow+gold': { name: 'Теневой капитал', tier: 3, tierName: 'Продвинутая', tierColor: '#ff9800', damageBonus: 0.25, shardBonus: 0.50, critChanceBonus: 0.02, critDamageBonus: 0.15, icon: '💰', description: 'Тень приносит богатство', auraCombo: ['aura-shadow', 'aura-gold'] },
  'ice+gold': { name: 'Замороженное богатство', tier: 3, tierName: 'Продвинутая', tierColor: '#ff9800', damageBonus: 0.25, shardBonus: 0.60, critChanceBonus: 0.02, critDamageBonus: 0.10, icon: '💎', description: 'Лёд сохраняет сокровища', auraCombo: ['aura-ice', 'aura-gold'] },
  'blood+fire+shadow': { name: 'Адская тень', tier: 3, tierName: 'Продвинутая', tierColor: '#ff9800', damageBonus: 0.60, shardBonus: 0.20, critChanceBonus: 0.04, critDamageBonus: 0.40, icon: '👹', description: 'Три стихии тьмы', auraCombo: ['aura-blood', 'aura-fire', 'aura-shadow'] },
  'blood+ice+electric': { name: 'Шторм стихий', tier: 3, tierName: 'Продвинутая', tierColor: '#ff9800', damageBonus: 0.45, shardBonus: 0.35, critChanceBonus: 0.04, critDamageBonus: 0.25, icon: '🌪️', description: 'Буря крови, льда и молний', auraCombo: ['aura-blood', 'aura-ice', 'aura-electric'] },
  'electric+cosmic': { name: 'Звёздный разряд', tier: 4, tierName: 'Легендарная', tierColor: '#e91e63', damageBonus: 0.50, shardBonus: 0.40, critChanceBonus: 0.04, critDamageBonus: 0.35, icon: '🌌', description: 'Космическая энергия молний', auraCombo: ['aura-electric', 'aura-cosmic'] },
  'fire+cosmic': { name: 'Звёздное пламя', tier: 4, tierName: 'Легендарная', tierColor: '#e91e63', damageBonus: 0.55, shardBonus: 0.35, critChanceBonus: 0.03, critDamageBonus: 0.45, icon: '☀️', description: 'Пламя звезды', auraCombo: ['aura-fire', 'aura-cosmic'] },
  'ice+cosmic': { name: 'Космический мороз', tier: 4, tierName: 'Легендарная', tierColor: '#e91e63', damageBonus: 0.35, shardBonus: 0.55, critChanceBonus: 0.04, critDamageBonus: 0.20, icon: '❄️', description: 'Абсолютный ноль космоса', auraCombo: ['aura-ice', 'aura-cosmic'] },
  'shadow+cosmic': { name: 'Тёмная материя', tier: 4, tierName: 'Легендарная', tierColor: '#e91e63', damageBonus: 0.50, shardBonus: 0.45, critChanceBonus: 0.05, critDamageBonus: 0.30, icon: '🌑', description: 'Сила тёмной материи', auraCombo: ['aura-shadow', 'aura-cosmic'] },
  'blood+cosmic': { name: 'Кровавая звезда', tier: 4, tierName: 'Легендарная', tierColor: '#e91e63', damageBonus: 0.60, shardBonus: 0.30, critChanceBonus: 0.04, critDamageBonus: 0.50, icon: '🌟', description: 'Кровь звёзд', auraCombo: ['aura-blood', 'aura-cosmic'] },
  'gold+cosmic': { name: 'Галактическая корона', tier: 4, tierName: 'Легендарная', tierColor: '#e91e63', damageBonus: 0.40, shardBonus: 0.80, critChanceBonus: 0.03, critDamageBonus: 0.30, icon: '👑', description: 'Золото галактики', auraCombo: ['aura-gold', 'aura-cosmic'] },
  'blood+fire+cosmic': { name: 'Адская звезда', tier: 5, tierName: 'Мифическая', tierColor: '#9c27b0', damageBonus: 0.90, shardBonus: 0.50, critChanceBonus: 0.05, critDamageBonus: 0.70, icon: '💥', description: 'Звезда питающаяся кровью', auraCombo: ['aura-blood', 'aura-fire', 'aura-cosmic'] },
  'fire+gold+cosmic': { name: 'Солнечная корона', tier: 5, tierName: 'Мифическая', tierColor: '#9c27b0', damageBonus: 0.70, shardBonus: 0.90, critChanceBonus: 0.05, critDamageBonus: 0.60, icon: '☀️', description: 'Пылающее золото звезды', auraCombo: ['aura-fire', 'aura-gold', 'aura-cosmic'] },
  'ice+electric+cosmic': { name: 'Квантовый шторм', tier: 5, tierName: 'Мифическая', tierColor: '#9c27b0', damageBonus: 0.80, shardBonus: 0.70, critChanceBonus: 0.05, critDamageBonus: 0.55, icon: '🌀', description: 'Квантовая буря', auraCombo: ['aura-ice', 'aura-electric', 'aura-cosmic'] },
  'blood+shadow+cosmic': { name: 'Тёмная дыра', tier: 5, tierName: 'Мифическая', tierColor: '#9c27b0', damageBonus: 0.95, shardBonus: 0.60, critChanceBonus: 0.05, critDamageBonus: 0.75, icon: '🕳️', description: 'Поглощает всё вокруг', auraCombo: ['aura-blood', 'aura-shadow', 'aura-cosmic'] },
  'shadow+gold+cosmic': { name: 'Звёздный торговец', tier: 5, tierName: 'Мифическая', tierColor: '#9c27b0', damageBonus: 0.65, shardBonus: 1.20, critChanceBonus: 0.05, critDamageBonus: 0.50, icon: '🌌', description: 'Торговец между галактиками', auraCombo: ['aura-shadow', 'aura-gold', 'aura-cosmic'] },
  'fire+electric+cosmic': { name: 'Сверхновая', tier: 5, tierName: 'Мифическая', tierColor: '#9c27b0', damageBonus: 1.10, shardBonus: 0.60, critChanceBonus: 0.05, critDamageBonus: 0.85, icon: '💫', description: 'Взрыв звезды', auraCombo: ['aura-fire', 'aura-electric', 'aura-cosmic'] }
};

// ============================================================
// ДОСТИЖЕНИЯ (без изменений)
// ============================================================
export const ACHIEVEMENTS = {
  clickNovice: { id: 'clickNovice', category: 'clicks', categoryName: 'Клики', icon: '👆', tiers: [{ level: 'bronze', target: 100, name: 'Начинающий кликер', description: 'Сделайте 100 кликов', reward: 25 }, { level: 'silver', target: 1000, name: 'Опытный кликер', description: 'Сделайте 1 000 кликов', reward: 125 }, { level: 'gold', target: 10000, name: 'Мастер кликов', description: 'Сделайте 10 000 кликов', reward: 625 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.clickCount || 0) >= tier.target; } },
  clickMaster: { id: 'clickMaster', category: 'clicks', categoryName: 'Клики', icon: '🖱️', tiers: [{ level: 'bronze', target: 50000, name: 'Кликомания', description: 'Сделайте 50 000 кликов', reward: 2500 }, { level: 'silver', target: 250000, name: 'Кликер-легенда', description: 'Сделайте 250 000 кликов', reward: 12500 }, { level: 'gold', target: 1000000, name: 'Бог кликов', description: 'Сделайте 1 000 000 кликов', reward: 37500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.clickCount || 0) >= tier.target; } },
  levelUp: { id: 'levelUp', category: 'levels', categoryName: 'Уровни', icon: '📈', tiers: [{ level: 'bronze', target: 10, name: 'Путь начат', description: 'Достигните 10 уровня', reward: 75 }, { level: 'silver', target: 25, name: 'Опытный искатель', description: 'Достигните 25 уровня', reward: 500 }, { level: 'gold', target: 50, name: 'Покоритель миров', description: 'Достигните 50 уровня', reward: 2500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.runMaxLevel ?? state?.maxLevel ?? state?.currentLevel ?? 1) >= tier.target; } },
  levelMaster: { id: 'levelMaster', category: 'levels', categoryName: 'Уровни', icon: '⭐', tiers: [{ level: 'bronze', target: 75, name: 'Ветеран', description: 'Достигните 75 уровня', reward: 6250 }, { level: 'silver', target: 100, name: 'Сотня!', description: 'Достигните 100 уровня', reward: 18750 }, { level: 'gold', target: 200, name: 'Легенда галактики', description: 'Достигните 200 уровня', reward: 62500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.runMaxLevel ?? state?.maxLevel ?? state?.currentLevel ?? 1) >= tier.target; } },
  bossSlayer: { id: 'bossSlayer', category: 'bosses', categoryName: 'Боссы', icon: '👹', tiers: [{ level: 'bronze', target: 5, name: 'Охотник на боссов', description: 'Убейте 5 боссов', reward: 125 }, { level: 'silver', target: 25, name: 'Гроза боссов', description: 'Убейте 25 боссов', reward: 1000 }, { level: 'gold', target: 100, name: 'Легендарный убийца', description: 'Убейте 100 боссов', reward: 5000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.bossKills || 0) >= tier.target; } },
  moonCollector: { id: 'moonCollector', category: 'moons', categoryName: 'Луны', icon: '🌙', tiers: [{ level: 'bronze', target: 3, name: 'Собиратель', description: 'Соберите 3 разных луны', reward: 75 }, { level: 'silver', target: 5, name: 'Коллекционер', description: 'Соберите 5 разных лун', reward: 750 }, { level: 'gold', target: 8, name: 'Повелитель лун', description: 'Соберите все 8 лун', reward: 3750 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.ownedMoons?.length || 0) >= tier.target; } },
  moonUpgrader: { id: 'moonUpgrader', category: 'moons', categoryName: 'Луны', icon: '⬆️', tiers: [{ level: 'bronze', target: 3, name: 'Улучшатель', description: 'Прокачайте любую луну до 3 уровня', reward: 125 }, { level: 'silver', target: 7, name: 'Мастер лун', description: 'Прокачайте любую луну до 7 уровня', reward: 1875 }, { level: 'gold', target: 10, name: 'Максимальная мощь', description: 'Прокачайте любую луну до 10 уровня', reward: 10000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; const moonLevels = state?.moonLevels || {}; const maxLevel = Math.max(0, ...Object.values(moonLevels)); return maxLevel >= tier.target; } },
  shardCollector: { id: 'shardCollector', category: 'wealth', categoryName: 'Богатство', icon: '💎', tiers: [{ level: 'bronze', target: 1000, name: 'Первая тысяча', description: 'Накопите 1 000 осколков', reward: 63 }, { level: 'silver', target: 10000, name: 'Десять тысяч', description: 'Накопите 10 000 осколков', reward: 500 }, { level: 'gold', target: 100000, name: 'Сто тысяч!', description: 'Накопите 100 000 осколков', reward: 2500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.playerData?.shards || 0) >= tier.target; } },
  shardMillionaire: { id: 'shardMillionaire', category: 'wealth', categoryName: 'Богатство', icon: '💰', tiers: [{ level: 'bronze', target: 500000, name: 'Полмиллиона', description: 'Накопите 500 000 осколков', reward: 7500 }, { level: 'silver', target: 2000000, name: 'Мультимиллионер', description: 'Накопите 2 000 000 осколков', reward: 25000 }, { level: 'gold', target: 10000000, name: 'Миллиардер', description: 'Накопите 10 000 000 осколков', reward: 125000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.playerData?.shards || 0) >= tier.target; } },
  slotMaster: { id: 'slotMaster', category: 'slots', categoryName: 'Слоты', icon: '🎰', tiers: [{ level: 'bronze', target: 2, name: 'Двойной слот', description: 'Откройте 2 слота', reward: 250 }, { level: 'silver', target: 3, name: 'Все слоты открыты', description: 'Откройте все 3 слота', reward: 1250 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.maxSlots || 1) >= tier.target; } },
  synergyHunter: { id: 'synergyHunter', category: 'synergies', categoryName: 'Синергии', icon: '🔗', tiers: [{ level: 'bronze', target: 1, name: 'Первая синергия', description: 'Активируйте 1 синергию', reward: 188 }, { level: 'silver', target: 3, name: 'Мастер комбинаций', description: 'Активируйте 3 синергии', reward: 1250 }, { level: 'gold', target: 5, name: 'Синергетический бог', description: 'Активируйте 5 синергий', reward: 5000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; const active = (state?.activeMoons || []).slice(0, state?.maxSlots || 1); return Object.keys(SYNERGY_BONUSES).filter(key => key.split('+').every(id => active.includes(id))).length >= tier.target; } },
  timePlayed: { id: 'timePlayed', category: 'time', categoryName: 'Время', icon: '⏱️', tiers: [{ level: 'bronze', target: 3600, name: 'Первый час', description: 'Сыграйте 1 час', reward: 125 }, { level: 'silver', target: 36000, name: '10 часов', description: 'Сыграйте 10 часов', reward: 2500 }, { level: 'gold', target: 360000, name: '100 часов!', description: 'Сыграйте 100 часов', reward: 25000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.totalSecondsPlayed || 0) >= tier.target; } }
};

// ============================================================
// КВЕСТЫ (без изменений)
// ============================================================
export const QUESTS = {
  clickDaily100: { id: 'clickDaily100', category: 'clicker', categoryName: 'Кликер', icon: '👆', name: 'Утренняя разминка', description: 'Сделайте 100 кликов за день', target: 100, reward: 25, bonusReward: 13, type: 'click', difficulty: 'easy', color: '#4caf50' },
  clickDaily500: { id: 'clickDaily500', category: 'clicker', categoryName: 'Кликер', icon: '🖱️', name: 'Марафон кликов', description: 'Сделайте 500 кликов за день', target: 500, reward: 125, bonusReward: 63, type: 'click', difficulty: 'medium', color: '#ff9800' },
  clickDaily2000: { id: 'clickDaily2000', category: 'clicker', categoryName: 'Кликер', icon: '⚡', name: 'Кликомания', description: 'Сделайте 2000 кликов за день', target: 2000, reward: 625, bonusReward: 313, type: 'click', difficulty: 'hard', color: '#f44336' },
  killBoss1: { id: 'killBoss1', category: 'hunter', categoryName: 'Охотник', icon: '👹', name: 'Первая кровь', description: 'Убейте 1 босса', target: 1, reward: 75, bonusReward: 38, type: 'bossKill', difficulty: 'easy', color: '#4caf50' },
  killBoss3: { id: 'killBoss3', category: 'hunter', categoryName: 'Охотник', icon: '⚔️', name: 'Серия убийств', description: 'Убейте 3 боссов', target: 3, reward: 375, bonusReward: 188, type: 'bossKill', difficulty: 'medium', color: '#ff9800' },
  killBoss10: { id: 'killBoss10', category: 'hunter', categoryName: 'Охотник', icon: '💀', name: 'Истребитель', description: 'Убейте 10 боссов', target: 10, reward: 1750, bonusReward: 875, type: 'bossKill', difficulty: 'hard', color: '#f44336' },
  shardDaily200: { id: 'shardDaily200', category: 'collector', categoryName: 'Коллекционер', icon: '💎', name: 'Скромная добыча', description: 'Соберите 200 осколков за день', target: 200, reward: 25, bonusReward: 13, type: 'shard', difficulty: 'easy', color: '#4caf50' },
  shardDaily1000: { id: 'shardDaily1000', category: 'collector', categoryName: 'Коллекционер', icon: '💰', name: 'Хороший улов', description: 'Соберите 1000 осколков за день', target: 1000, reward: 125, bonusReward: 63, type: 'shard', difficulty: 'medium', color: '#ff9800' },
  shardDaily5000: { id: 'shardDaily5000', category: 'collector', categoryName: 'Коллекционер', icon: '🏆', name: 'Богатая жатва', description: 'Соберите 5000 осколков за день', target: 5000, reward: 625, bonusReward: 313, type: 'shard', difficulty: 'hard', color: '#f44336' },
  levelUp2: { id: 'levelUp2', category: 'progress', categoryName: 'Прогресс', icon: '📈', name: 'Быстрый рост', description: 'Повысьте уровень 2 раза за день', target: 2, reward: 50, bonusReward: 25, type: 'level', difficulty: 'easy', color: '#4caf50' },
  levelUp5: { id: 'levelUp5', category: 'progress', categoryName: 'Прогресс', icon: '🚀', name: 'Взрывной рост', description: 'Повысьте уровень 5 раз за день', target: 5, reward: 250, bonusReward: 125, type: 'level', difficulty: 'medium', color: '#ff9800' }
};

export const QUEST_CATEGORIES = {
  all: { name: 'Все', icon: '📋', color: '#9e9e9e' },
  clicker: { name: 'Кликер', icon: '👆', color: '#4caf50' },
  hunter: { name: 'Охотник', icon: '⚔️', color: '#f44336' },
  collector: { name: 'Коллекционер', icon: '💎', color: '#2196f3' },
  progress: { name: 'Прогресс', icon: '📈', color: '#ff9800' }
};

export const ACHIEVEMENT_CATEGORIES = {
  all: { name: 'Все', icon: '🏆' }, clicks: { name: 'Клики', icon: '👆' }, levels: { name: 'Уровни', icon: '📈' }, bosses: { name: 'Боссы', icon: '👹' }, moons: { name: 'Луны', icon: '🌙' }, wealth: { name: 'Богатство', icon: '💎' }, slots: { name: 'Слоты', icon: '🎰' }, synergies: { name: 'Синергии', icon: '🔗' }, time: { name: 'Время', icon: '⏱️' }
};

export const RARITY_CONFIG = {
  common: { name: 'Обычная', color: '#9e9e9e', gradient: 'linear-gradient(135deg, #9e9e9e, #616161)' },
  rare: { name: 'Редкая', color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3, #0d47a1)' },
  epic: { name: 'Эпическая', color: '#9c27b0', gradient: 'linear-gradient(135deg, #9c27b0, #4a148c)' },
  legendary: { name: 'Легендарная', color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800, #e65100)' },
  mythic: { name: 'Мифическая', color: '#e91e63', gradient: 'linear-gradient(135deg, #e91e63, #880e4f)' }
};

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Получить актуальные параметры механики
// с учётом уровня прокачки луны
// ============================================================
export function getMoonMechanicParams(moonId, moonLevel) {
  const moon = MOON_TYPES[moonId];
  if (!moon) return null;
  
  // Клонируем базовые параметры
  const params = { ...moon.mechanicParams };
  
  // Применяем все милестоуны до текущего уровня
  for (let lvl = 1; lvl <= moonLevel; lvl++) {
    if (moon.milestones[lvl]) {
      moon.milestones[lvl].apply(params);
    }
  }
  
  return params;
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Получить цену прокачки луны
// ============================================================
export function getMoonUpgradeCostForLevel(moonId, currentLevel) {
  const moon = MOON_TYPES[moonId];
  if (!moon || currentLevel >= CONSTANTS.LIMITS.MAX_MOON_LEVEL) return Infinity;
  
  const rarityCost=MOON_UPGRADE_BASE_COSTS[moon.rarity]||100;
  const baseCost=MOON_ORDER.indexOf(moonId)>=MOON_ORDER.indexOf('ice')?Math.max(rarityCost,moon.cost*CONSTANTS.MOON_UPGRADE_COST_RATIO):rarityCost;
  return Math.floor(baseCost * Math.pow(1.5, currentLevel) / (CONSTANTS.MOON_UPGRADE_PRICE_DIVISORS[moonId]||1));
}

/** UFO-only traits combine across active moons; values grow with moon upgrades. */
export function getUfoBonuses(state, runtime=state.runtime||{}) {
 const result={damage:0,haste:0,critChance:0,critMultiplier:1.5,rewardMultiplier:1,chainEvery:0,chainMultiplier:1};
 const prestige=getPrestigeSummary(state);result.damage+=prestige.ufoDamage;
 const active=(state.activeMoons||[]).slice(0,state.maxSlots||1),c=CONSTANTS.UFO;
 for(const id of active){
  const buff=c.MOON_BUFFS[id];if(!buff)continue;
  const scale=1+Math.max(0,(state.moonLevels?.[id]||1)-1)*c.MOON_BUFF_SCALE;
  result.damage+=(buff.damage||0)*scale;
  if(buff.comboDamage&&(runtime._comboClicks||0)>=getMoonMechanicParams('normal',state.moonLevels?.normal||1).clicksPerStack)result.damage+=buff.comboDamage*scale;
  if(buff.bossDamage&&state.currentLevel%CONSTANTS.BOSS_INTERVAL===0)result.damage+=buff.bossDamage*scale;
  result.damage+=(buff.damagePerLevel||0)*(state.currentLevel||1)*scale;
  result.haste+=(buff.haste||0)*scale;result.critChance+=(buff.critChance||0)*scale;
  if(buff.rewardMultiplier)result.rewardMultiplier=buff.rewardMultiplier;
  if(buff.critMultiplier)result.critMultiplier=buff.critMultiplier;
  if(buff.chainEvery){result.chainEvery=buff.chainEvery;result.chainMultiplier=1+(buff.chainMultiplier-1)*scale;}
 }
 result.haste=1-(1-result.haste)*(1-prestige.ufoHaste);
 return result;
}
export function getUfoMoonDescription(id,level=1) {
 const b=CONSTANTS.UFO.MOON_BUFFS[id];if(!b)return '';
 const scale=1+Math.max(0,level-1)*CONSTANTS.UFO.MOON_BUFF_SCALE,percent=n=>Math.round(n*scale*100)+'%';
 if(b.comboDamage)return '🛸 Комбо: +'+percent(b.comboDamage)+' урона тарелки';
 if(b.bossDamage)return '🛸 +'+percent(b.bossDamage)+' урона тарелки по боссам';
 if(b.haste)return '🛸 Интервал выстрелов короче на '+percent(b.haste);
 if(b.critChance)return '🛸 '+percent(b.critChance)+' шанс крита ×'+b.critMultiplier;
 if(b.damage)return '🛸 +'+percent(b.damage)+' урона тарелки';
 if(b.chainEvery)return '🛸 Каждый '+b.chainEvery+'-й выстрел: ×'+(1+(b.chainMultiplier-1)*scale).toLocaleString('ru-RU',{maximumFractionDigits:2})+' урона';
 if(b.rewardMultiplier)return '🛸 Убийство тарелкой: половина ручной награды';
 return '🛸 +'+(b.damagePerLevel*scale*100).toLocaleString('ru-RU',{maximumFractionDigits:2})+'% урона за уровень игрока';
}

export const PRESTIGE_UPGRADES={
 reactor:{id:'reactor',name:'Вечный реактор',icon:'⚔️',description:'+10% урона за уровень',baseCost:1,multiplier:2,maxLevel:Infinity,damage:0.10},
 treasury:{id:'treasury',name:'Звёздная казна',icon:'💎',description:'+10% добычи кристаллов за уровень',baseCost:1,multiplier:2,maxLevel:Infinity,shards:0.10},
 fleet:{id:'fleet',name:'Бессмертная армада',icon:'🛸',description:'+5% урона тарелок за уровень',baseCost:2,multiplier:2,maxLevel:Infinity,ufoDamage:0.05},
 clock:{id:'clock',name:'Вечный хронометр',icon:'⏱️',description:'Каждый уровень сокращает интервал тарелок ещё на 3%',baseCost:2,multiplier:2,maxLevel:Infinity,ufoHaste:0.03},
 critical:{id:'critical',name:'Звёздное прицеливание',icon:'🎯',description:'+1% шанса крита за уровень',baseCost:2,multiplier:2,maxLevel:Infinity,crit:0.01}
};
export function getPrestigeSummary(state){
 const p=state.prestige||{},up=p.upgrades||{},c=CONSTANTS.PRESTIGE;
 const record=state.runMaxLevel??Math.max(state.maxLevel||1,state.currentLevel||1);
 const damageSteps=(p.damageStepsTotal||0)+Math.max(0,Math.floor(record/c.DAMAGE_EVERY)-(p.runDamageSteps||0));
 const shardSteps=(p.shardStepsTotal||0)+Math.max(0,Math.floor(record/c.SHARDS_EVERY)-(p.runShardSteps||0));
 return {coins:p.coins||0,ascensions:p.ascensions||0,runRecord:record,
 pendingCoins:Math.floor(record/c.COIN_EVERY),
 damageBonus:damageSteps*c.DAMAGE_PER_STEP+(up.reactor||0)*PRESTIGE_UPGRADES.reactor.damage,
 shardBonus:shardSteps*c.SHARDS_PER_STEP+(up.treasury||0)*PRESTIGE_UPGRADES.treasury.shards,
 critBonus:(up.critical||0)*PRESTIGE_UPGRADES.critical.crit,
 ufoDamage:(up.fleet||0)*PRESTIGE_UPGRADES.fleet.ufoDamage,
 ufoHaste:1-Math.pow(1-PRESTIGE_UPGRADES.clock.ufoHaste,up.clock||0)};
}

/** Every full 100% adds a crit tier; the remainder can roll the next tier. */
export function rollCritical(chance,multiplier=2,random=Math.random){
 chance=Math.max(0,Number.isFinite(chance)?chance:0);
 if(chance<1){const isCrit=random()<chance;return {isCrit,isOvercrit:false,tier:isCrit?2:1,multiplier:isCrit?multiplier:1};}
 const full=Math.floor(chance),fraction=chance-full;
 const tier=full+1+(fraction>0&&random()<fraction?1:0);
 return {isCrit:true,isOvercrit:tier>2,tier,multiplier:multiplier*tier/2};
}
export function getPrestigeUpgradeCost(id,level){
 const d=PRESTIGE_UPGRADES[id];
 return d?Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.floor(d.baseCost*Math.pow(d.multiplier,level))):Infinity;
}

/** Pure live view of the same passive and temporary combat modifiers used by the server. */
export function getCombatStats(state,now=Date.now()+(state.serverClockOffset||0)){
 const p=getPrestigeSummary(state),active=[...new Set((state.activeMoons||[]).slice(0,state.maxSlots||1))],runtime={...(state.runtime||{})},sources=[];
 let damage=p.damageBonus,shards=p.shardBonus,crit=p.critBonus,critDamage=0;
 const add=(id,name,d=0,s=0,c=0,cd=0)=>{damage+=d;shards+=s;crit+=c;critDamage+=cd;sources.push({id,name,damage:d,shards:s,crit:c,critDamage:cd});};
 if(damage||shards||crit)sources.push({id:'prestige',name:'Престиж и вечные улучшения',damage,shards,crit,critDamage:0});
 const params=id=>active.includes(id)?getMoonMechanicParams(id,state.moonLevels?.[id]||1):null;
 for(const id of active){
  const moon=MOON_TYPES[id];if(!moon)continue;const scale=1+((state.moonLevels?.[id]||1)-1)*.05,b=moon.baseStats;
  add(id,moon.name,(b.damageBonus||0)*scale,(b.shardBonus||0)*scale,(b.critChanceBonus||0)*scale,(b.critDamageBonus||0)*scale);
  const m=params(id);
  if(id==='cosmic')add('cosmic-level','Космическое масштабирование',m.damagePerLevel*state.currentLevel,m.shardPerLevel*state.currentLevel,0,m.critDamagePerLevel*state.currentLevel);
  if(id==='gold'&&m.shardToDamageRatio>0)add('gold-wealth','Золотой дождь',(state.playerData?.shards||0)*m.shardToDamageRatio);
 }
 for(const [key,b] of Object.entries(SYNERGY_BONUSES))if(key.split('+').every(id=>active.includes(id)))add(key,b.name,b.damageBonus||0,b.shardBonus||0,b.critChanceBonus||0,b.critDamageBonus||0);
 if(active.includes('normal')&&active.length>1)add('normal-link','Связь обычной луны',.05,.05);
 const passive={totalDamageBonus:damage,totalShardBonus:shards,totalCritChanceBonus:crit,totalCritDamageBonus:critDamage};
 for(const [id,key]of [['normal','_comboClicks'],['fire','_fireStacks'],['shadow','_shadowCritStacks']]){
  const m=params(id),last=id==='normal'?Math.max(state.lastClickAt||0,state.lastComboAt||0):state.lastClickAt||0;
  if(m&&last&&now-last>=(m.resetTimeout||15000))runtime[key]=0;
 }
 const normal=params('normal'),fire=params('fire'),shadow=params('shadow'),blood=params('blood'),electric=params('electric'),ice=params('ice'),gold=params('gold');
 const stacks=(m,key)=>m?Math.min(m.maxStacks,Math.floor((runtime[key]||0)/m.clicksPerStack)):0;
 const combo=stacks(normal,'_comboClicks'),heat=stacks(fire,'_fireStacks'),shadowStacks=stacks(shadow,'_shadowCritStacks');
 if(combo)add('combo','Комбо · '+combo+' ст.',combo*normal.bonusPerStack);
 if(heat)add('heat','Жар · '+heat+' ст.',heat*fire.bonusPerStack);
 if(shadowStacks)add('shadow-stacks','Тень · '+shadowStacks+' ст.',0,0,0,shadowStacks*shadow.critDamagePerStack);
 if(shadow?.fullStackCritChance>0&&shadowStacks>=shadow.maxStacks)add('shadow-full','Полные стаки тени',0,0,shadow.fullStackCritChance);
 const boss=(state.currentLevel||1)%CONSTANTS.BOSS_INTERVAL===0,ratio=state.moonHP/state.maxHP;
 if(boss&&blood&&ratio<blood.hpThreshold)add('blood-boss','Кровавая ярость',blood.damageBonus);
 const base=state.playerData?.click_damage||CONSTANTS.DEFAULTS.CLICK_DAMAGE;
 const steadyDamage=Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(base*(1+damage))));
 if(electric&&(runtime._superconductorClicksLeft||0)>0)add('superconductor','Сверхпроводник · '+runtime._superconductorClicksLeft+' ударов',electric.superconductorBonus);
 const nextPierce=!!(ice?.pierceInterval>0&&((runtime._clickCounter||0)+1)%ice.pierceInterval===0);
 const execute=!!(boss&&blood?.executeThreshold>0&&ratio<=blood.executeThreshold);
 let finalDamage=Math.max(1,Math.round(base*(1+damage)));
 if(execute)finalDamage=Math.max(finalDamage,Math.round(base*(state.moonHP/base+1)));
 let chance=Math.max(0,.05+crit);
 const firstStrike=!!(shadow?.firstStrikeCrit&&!runtime._firstStrikeUsed&&runtime._newMoon);
 if(firstStrike)chance=Math.max(1,chance);
 const critMultiplier=2+critDamage,tier=chance>=1?Math.floor(chance)+1:2,extraChance=chance>=1?chance-Math.floor(chance):0;
 const fullCombo=!!(normal?.shardBonusOnFullStack&&combo>=normal.maxStacks),goldMultiplier=gold?(boss?gold.bossMultiplier:gold.normalMultiplier):1;
 const rewardMultiplier=(1+shards)*goldMultiplier*(fullCombo?1+normal.shardBonusOnFullStack:1);
 const c=CONSTANTS.MOON_REWARD,level=state.currentLevel||1;
 let reward=Math.max(1,Math.round(Math.floor(c.BASE+level*c.PER_LEVEL+Math.pow(level,c.EXPONENT)*c.GROWTH)*(boss?c.BOSS_MULTIPLIER:1)*(1+shards)));
 if(gold)reward=Math.round(reward*goldMultiplier);if(fullCombo)reward=Math.round(reward*(1+normal.shardBonusOnFullStack));
 const ufo=getUfoBonuses(state,runtime),interval=Math.max(CONSTANTS.UFO.MIN_INTERVAL,Math.round((CONSTANTS.UFO.BASE_INTERVAL-Math.max(0,(state.ufoLevel||0)-1)*CONSTANTS.UFO.INTERVAL_REDUCTION)*(1-ufo.haste)));
 return {passive,sources,runtime,baseDamage:base,finalDamage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,finalDamage),damageBonus:damage,shardBonus:rewardMultiplier-1,critChance:chance,critChanceBonus:chance-.05,critDamageBonus:critDamage,critMultiplier,critTier:tier,extraCritChance:extraChance,critDamage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.round(finalDamage*critMultiplier*tier/2)),nextCritDamage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.round(finalDamage*critMultiplier*(tier+1)/2)),nextPierce,firstStrike,execute,
 moonReward:Math.min(CONSTANTS.SAFE_NUMBER_CAP,reward),ufoDamage:state.ufoLevel?Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(steadyDamage*CONSTANTS.UFO.DAMAGE_MULTIPLIER*(1+ufo.damage)))):0,ufoInterval:interval,ufoCount:state.ufoCount||0,goldMultiplier,fullCombo,ufoCritChance:ufo.critChance,ufoCritMultiplier:ufo.critMultiplier,ufoChainEvery:ufo.chainEvery,ufoDamageBonus:ufo.damage,ufoHaste:ufo.haste,ufoRewardMultiplier:ufo.rewardMultiplier,superconductorHits:runtime._superconductorClicksLeft||0};
}

export const MOON_ORDER=Object.freeze(['normal','blood','ice','shadow','electric','fire','gold','cosmic']);
export function getMoonPurchaseAccess(state,id){
 const moon=MOON_TYPES[id],index=MOON_ORDER.indexOf(id),record=Math.max(state.maxLevel||1,state.currentLevel||1);
 const requiredMoon=index>0?MOON_ORDER.slice(0,index).find(previous=>!(state.ownedMoons||[]).includes(previous)):null;
 const levelUnlocked=!!moon&&record>=moon.unlockLevel;
 return {record,requiredMoon:requiredMoon||null,levelUnlocked,unlocked:levelUnlocked&&!requiredMoon};
}
