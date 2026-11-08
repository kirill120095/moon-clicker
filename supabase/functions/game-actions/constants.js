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
  CLICK_CRYSTALS: { BASE_COST: 5000, MULTIPLIER: 3 },
  CLONE: { COST: 12000000, UNLOCK_LEVEL: 200, LINK_BONUS: { damageBonus: .10, shardBonus: .05, critChanceBonus: .01, critDamageBonus: .05 }, DUAL_BONUS: { damageBonus: .15, shardBonus: .10, critChanceBonus: .01, critDamageBonus: .10 }, GROUP_THREE: { damageBonus: .10, shardBonus: .08, critChanceBonus: .005, critDamageBonus: .05 }, GROUP_FOUR: { damageBonus: .18, shardBonus: .12, critChanceBonus: .01, critDamageBonus: .10 } },

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
  ROLLBACK_LEVELS: 10,
  PRESTIGE: { DAILY_ASCENSION_LIMIT: 3, DAMAGE_EVERY: 100, DAMAGE_PER_STEP: 0.01, SHARDS_EVERY: 300, SHARDS_PER_STEP: 0.05, COIN_EVERY: 20, REWARD_PER_ASCENSION: 0.25, UFO_HASTE_CAP: 0.95, PRICE_STEP_RATIO: 0.2, PRICE_QUADRATIC_DIVISOR: 10 },
  WHEEL: { COOLDOWN_MS: 5200, SPIN_MS: 5200, MAX_BET_FRACTION: 0.05, SECTORS: Array.from({length:37},(_,i)=>i===0?'zero':i<=18?'red':'black'), WEIGHTS: Array(37).fill(1), VISUAL_WEIGHTS: Array(37).fill(1) },
  ECHO: { MAX_HITS_PER_ACTION: 128, MAX_QUEUED_BURSTS: 64 },
  UFO: { UNLOCK_LEVEL: 5, BASE_COST: 400, COST_MULTIPLIER: 1.8, MAX_LEVEL: 5, BASE_INTERVAL: 3000, MIN_INTERVAL: 100, COMBO_RELAY_COST: 1000000, MAX_SHOTS_PER_ACTION: 32, INTERVAL_REDUCTION: 400, DAMAGE_MULTIPLIER: 0.5, MAX_IDLE_MS: 5000, UNIT_BASE_COST: 2400, UNIT_COST_MULTIPLIER: 2, MOON_BUFF_SCALE: 0.05, MOON_BUFFS: { normal: { comboDamage: 0.10 }, blood: { bossDamage: 0.20 }, ice: { haste: 0.10 }, shadow: { critChance: 0.08, critMultiplier: 1.5 }, fire: { damage: 0.15 }, electric: { chainEvery: 5, chainMultiplier: 1.5 }, gold: { rewardMultiplier: 0.5 }, cosmic: { damagePerLevel: 0.001 } } },
  MOON_REWARD: { BASE: 5, PER_LEVEL: 2, EXPONENT: 1.5, GROWTH: 0.5, BOSS_MULTIPLIER: 2.5 },

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
    unlockLevel: 20,
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
    unlockLevel: 40,
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
    unlockLevel: 50,
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
      firstStrikeMultiplier: 1,
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
        description: 'Первый ручной удар по новой луне — гарантированный крит в 10 раз сильнее обычного крита',
        apply: (params) => { params.firstStrikeCrit = true; params.firstStrikeMultiplier = 10; }
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
    unlockLevel: 70,
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
    unlockLevel: 100,
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
    unlockLevel: 120,
    rarity: 'mythic',
    
    baseStats: {
      damageBonus: 0,
      shardBonus: 0,
      critChanceBonus: 0,
      critDamageBonus: 0
    },
    
    specialMechanic: 'scaling',
    specialName: 'Космическая мощь',
    specialDescription: '+10 базового урона за уровень и +0,5 за убитую луну, +1% урона, +0.25% осколков, +0.25% крит урона за уровень',
    
    mechanicParams: {
      baseDamagePerLevel: 10,
      baseDamagePerKill: 0.5,
      damagePerLevel: 0.01,
      shardPerLevel: 0.0025,
      critDamagePerLevel: 0.0025,
      critChancePerLevel: 0
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
        description: '+0,1% шанса крита за каждый уровень игрока',
        apply: (params) => { params.critChancePerLevel = 0.001; }
      }
    },
    
    shopDescription: 'Сила самой вселенной. Растёт бесконечно.',
    
    gradient: 'radial-gradient(circle at 30% 30%, #e1bee7, #4a148c, #1a237e)',
    shadow: '0 0 80px rgba(156,39,176,0.8), 0 0 160px rgba(63,81,181,0.4), inset -35px -35px 90px rgba(0,0,0,0.5), inset 35px 35px 90px rgba(233,30,99,0.3)',
    accentColor: '#9c27b0'
  },
  clone: {
    id:'clone',name:'Клон',emoji:'🪞',cost:CONSTANTS.CLONE.COST,unlockLevel:CONSTANTS.CLONE.UNLOCK_LEVEL,rarity:'mythic',
    baseStats:{damageBonus:0,shardBonus:0,critChanceBonus:0,critDamageBonus:0},
    specialMechanic:'reflection',specialName:'Зеркальная связь',
    specialDescription:'Копирует активный оригинал, его уровень, бонусы и механику. Занимает один слот.',
    mechanicParams:{pairScale:1,copies:1},
    milestones:{
      3:{icon:'🪞',name:'Чистое зеркало',description:'Оригинал и копия работают со 110% силой',apply:p=>{p.pairScale=1.1;}},
      5:{icon:'🔗',name:'Обратная связь',description:'Оригинал и копия работают со 125% силой',apply:p=>{p.pairScale=1.25;}},
      7:{icon:'✨',name:'Зеркальный резонанс',description:'Оригинал и копия работают со 150% силой',apply:p=>{p.pairScale=1.5;}},
      10:{icon:'👑',name:'Идеальная пара',description:'Две копии разных активных оригиналов; каждый со своей копией работает со 150% силой',apply:p=>{p.copies=2;}}
    },
    shopDescription:'Отражает силу выбранных активных лун. Накопления механик общие; численные вклады складываются.',
    gradient:'radial-gradient(circle at 30% 30%,#ecfeff,#a5b4fc,#312e81)',shadow:'0 0 70px #a5b4fc88,inset -30px -30px 80px #312e81',accentColor:'#c4b5fd'
  }

};

// ============================================================
// СИНЕРГИИ (без изменений)
// ============================================================
export const SYNERGY_BONUSES = {
  'blood+electric': {name:'Кровавая молния',tier:2,tierName:'Средняя',tierColor:'#03a9f4',damageBonus:.35,shardBonus:.10,critChanceBonus:.03,critDamageBonus:.25,icon:'⚡',description:'Кровь питает электрический разряд',auraCombo:['aura-blood','aura-electric']},
  'blood+gold': {name:'Кровавое золото',tier:3,tierName:'Продвинутая',tierColor:'#ff9800',damageBonus:.25,shardBonus:.40,critChanceBonus:.02,critDamageBonus:.15,icon:'👑',description:'Кровавая ярость притягивает сокровища',auraCombo:['aura-blood','aura-gold']},
  'ice+fire': {name:'Паровой взрыв',tier:2,tierName:'Средняя',tierColor:'#03a9f4',damageBonus:.30,shardBonus:.20,critChanceBonus:.02,critDamageBonus:.15,icon:'♨',description:'Столкновение жара и холода',auraCombo:['aura-ice','aura-fire']},
  'electric+shadow': {name:'Тёмный разряд',tier:2,tierName:'Средняя',tierColor:'#03a9f4',damageBonus:.35,shardBonus:.15,critChanceBonus:.03,critDamageBonus:.25,icon:'⚡',description:'Молния пробивает завесу теней',auraCombo:['aura-electric','aura-shadow']},

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
/** Four-moon constellations are built once, never during a click. */
{
 const ids=Object.keys(MOON_TYPES).filter(id=>id!=='clone');
 for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++)for(let d=b+1;d<ids.length;d++)for(let e=d+1;e<ids.length;e++){
  const group=[ids[a],ids[b],ids[d],ids[e]];
  SYNERGY_BONUSES[group.join('+')]={name:'Созвездие '+group.map(id=>MOON_TYPES[id].emoji).join(''),tier:5,tierName:'Созвездие',tierColor:'#c4b5fd',damageBonus:.25,shardBonus:.2,critChanceBonus:.02,critDamageBonus:.15,icon:'🌌',description:'Четыре разные луны образуют созвездие',auraCombo:[]};
 }

}


/** Fill missing triples once; canonical membership preserves existing named recipes. */
{
 const ids=Object.keys(MOON_TYPES).filter(id=>id!=='normal'&&id!=='clone');
 const words={blood:'крови',ice:'льда',shadow:'тени',electric:'молний',fire:'пламени',gold:'золота',cosmic:'космоса'};
 const known=new Set(Object.keys(SYNERGY_BONUSES).map(key=>key.split('+').sort().join('+')));
 for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++)for(let d=b+1;d<ids.length;d++){
  const group=[ids[a],ids[b],ids[d]],key=[...group].sort().join('+');if(known.has(key))continue;
  const name='Союз '+group.slice(0,2).map(id=>words[id]).join(', ')+' и '+words[group[2]];
  SYNERGY_BONUSES[key]={name,tier:3,tierName:'Тройная',tierColor:'#ff9800',damageBonus:.30,shardBonus:.20,critChanceBonus:.02,critDamageBonus:.15,icon:'✦',description:group.map(id=>MOON_TYPES[id].name).join(' + ')+': совместный бонус трёх лун',auraCombo:[]};
  known.add(key);
 }
}

// Approved exclusive constellation catalog (21/35/35).
const CONSTELLATION_CATALOG=[{"key":"blood+fire","name":null,"damageBonus":1,"shardBonus":0.2},{"key":"blood+ice","name":null,"damageBonus":0.75,"shardBonus":0.25},{"key":"blood+electric","name":null,"damageBonus":0.85,"shardBonus":0.2},{"key":"blood+shadow","name":null,"damageBonus":0.9,"shardBonus":0.2},{"key":"blood+gold","name":null,"damageBonus":0.55,"shardBonus":0.6},{"key":"blood+cosmic","name":null,"damageBonus":1,"shardBonus":0.3},{"key":"fire+ice","name":null,"damageBonus":0.9,"shardBonus":0.2},{"key":"electric+fire","name":null,"damageBonus":1,"shardBonus":0.2},{"key":"fire+shadow","name":null,"damageBonus":0.95,"shardBonus":0.2},{"key":"fire+gold","name":null,"damageBonus":0.7,"shardBonus":0.4},{"key":"cosmic+fire","name":null,"damageBonus":1,"shardBonus":0.3},{"key":"electric+ice","name":null,"damageBonus":0.9,"shardBonus":0.2},{"key":"ice+shadow","name":null,"damageBonus":0.75,"shardBonus":0.25},{"key":"gold+ice","name":null,"damageBonus":0.4,"shardBonus":0.7},{"key":"cosmic+ice","name":null,"damageBonus":0.9,"shardBonus":0.35},{"key":"electric+shadow","name":null,"damageBonus":0.9,"shardBonus":0.2},{"key":"electric+gold","name":null,"damageBonus":0.65,"shardBonus":0.45},{"key":"cosmic+electric","name":null,"damageBonus":1,"shardBonus":0.3},{"key":"gold+shadow","name":null,"damageBonus":0.45,"shardBonus":0.65},{"key":"cosmic+shadow","name":null,"damageBonus":0.95,"shardBonus":0.35},{"key":"cosmic+gold","name":null,"damageBonus":0.6,"shardBonus":0.7},{"key":"blood+fire+ice","name":"Кипящая кровь","damageBonus":4.8,"shardBonus":1.1},{"key":"blood+electric+fire","name":"Багровый разряд","damageBonus":5.5,"shardBonus":1},{"key":"blood+fire+shadow","name":"Адская тень","damageBonus":5.7,"shardBonus":1},{"key":"blood+fire+gold","name":"Кровавая кузница","damageBonus":4,"shardBonus":2.3},{"key":"blood+cosmic+fire","name":"Адская звезда","damageBonus":6,"shardBonus":1.2},{"key":"blood+electric+ice","name":"Шторм стихий","damageBonus":5.3,"shardBonus":1.1},{"key":"blood+ice+shadow","name":"Призрачный мороз","damageBonus":4.7,"shardBonus":1.3},{"key":"blood+gold+ice","name":"Кровавый клад","damageBonus":3.5,"shardBonus":2.6},{"key":"blood+cosmic+ice","name":"Багровая комета","damageBonus":5.4,"shardBonus":1.4},{"key":"blood+electric+shadow","name":"Теневой импульс","damageBonus":5.6,"shardBonus":1},{"key":"blood+electric+gold","name":"Золотой разряд крови","damageBonus":4.2,"shardBonus":2.2},{"key":"blood+cosmic+electric","name":"Пульсар крови","damageBonus":5.9,"shardBonus":1.2},{"key":"blood+gold+shadow","name":"Проклятое золото","damageBonus":3.7,"shardBonus":2.5},{"key":"blood+cosmic+shadow","name":"Тёмная дыра","damageBonus":6,"shardBonus":1.2},{"key":"blood+cosmic+gold","name":"Кровавая галактика","damageBonus":4.3,"shardBonus":2.8},{"key":"electric+fire+ice","name":"Перегрузка стихий","damageBonus":5.7,"shardBonus":1},{"key":"fire+ice+shadow","name":"Пламя вечной зимы","damageBonus":5.2,"shardBonus":1.1},{"key":"fire+gold+ice","name":"Закалённое богатство","damageBonus":3.9,"shardBonus":2.4},{"key":"cosmic+fire+ice","name":"Звёздный термошок","damageBonus":5.8,"shardBonus":1.3},{"key":"electric+fire+shadow","name":"Чёрная гроза","damageBonus":5.9,"shardBonus":1},{"key":"electric+fire+gold","name":"Грозовая сокровищница","damageBonus":4.5,"shardBonus":2.2},{"key":"cosmic+electric+fire","name":"Сверхновая","damageBonus":6,"shardBonus":1.4},{"key":"fire+gold+shadow","name":"Пепел империи","damageBonus":4.3,"shardBonus":2.3},{"key":"cosmic+fire+shadow","name":"Пламя бездны","damageBonus":6,"shardBonus":1.3},{"key":"cosmic+fire+gold","name":"Солнечная корона","damageBonus":4,"shardBonus":2},{"key":"electric+ice+shadow","name":"Тихая буря","damageBonus":5.3,"shardBonus":1.1},{"key":"electric+gold+ice","name":"Электроледяной клад","damageBonus":3.6,"shardBonus":2.7},{"key":"cosmic+electric+ice","name":"Квантовый шторм","damageBonus":5.9,"shardBonus":1.3},{"key":"gold+ice+shadow","name":"Сокровища вечной ночи","damageBonus":3.2,"shardBonus":2.9},{"key":"cosmic+ice+shadow","name":"Абсолютная тьма","damageBonus":5.6,"shardBonus":1.4},{"key":"cosmic+gold+ice","name":"Хранилище звёзд","damageBonus":3.5,"shardBonus":3},{"key":"electric+gold+shadow","name":"Теневой рынок молний","damageBonus":4,"shardBonus":2.4},{"key":"cosmic+electric+shadow","name":"Чёрный пульсар","damageBonus":6,"shardBonus":1.3},{"key":"cosmic+electric+gold","name":"Золотой пульсар","damageBonus":4.5,"shardBonus":2.8},{"key":"cosmic+gold+shadow","name":"Звёздный торговец","damageBonus":3.8,"shardBonus":3},{"key":"blood+electric+fire+ice","name":"Стихийный апокалипсис","damageBonus":9.8175,"shardBonus":2.31},{"key":"blood+fire+ice+shadow","name":"Багровое затмение","damageBonus":9.52875,"shardBonus":2.31},{"key":"blood+fire+gold+ice","name":"Плавильня богов","damageBonus":7.21875,"shardBonus":4.0425},{"key":"blood+cosmic+fire+ice","name":"Криозвёздный ад","damageBonus":10.68375,"shardBonus":2.59875},{"key":"blood+electric+fire+shadow","name":"Демонический шторм","damageBonus":10.9725,"shardBonus":2.31},{"key":"blood+electric+fire+gold","name":"Золотой катаклизм","damageBonus":8.085,"shardBonus":3.75375},{"key":"blood+cosmic+electric+fire","name":"Сердце сверхновой","damageBonus":11.55,"shardBonus":2.59875},{"key":"blood+fire+gold+shadow","name":"Проклятая сокровищница","damageBonus":7.5075,"shardBonus":4.33125},{"key":"blood+cosmic+fire+shadow","name":"Конец света","damageBonus":11.55,"shardBonus":2.59875},{"key":"blood+cosmic+fire+gold","name":"Кровавое солнце","damageBonus":8.95125,"shardBonus":4.0425},{"key":"blood+electric+ice+shadow","name":"Безмолвная буря","damageBonus":9.8175,"shardBonus":2.31},{"key":"blood+electric+gold+ice","name":"Ледяная казна","damageBonus":6.64125,"shardBonus":4.62},{"key":"blood+cosmic+electric+ice","name":"Абсолютный ноль","damageBonus":10.68375,"shardBonus":2.59875},{"key":"blood+gold+ice+shadow","name":"Призрачное наследство","damageBonus":6.06375,"shardBonus":4.90875},{"key":"blood+cosmic+ice+shadow","name":"Холодная бездна","damageBonus":10.395,"shardBonus":2.59875},{"key":"blood+cosmic+gold+ice","name":"Астральные сокровища","damageBonus":6.93,"shardBonus":5.1975},{"key":"blood+electric+gold+shadow","name":"Тёмный монетный шторм","damageBonus":7.79625,"shardBonus":4.0425},{"key":"blood+cosmic+electric+shadow","name":"Разлом реальности","damageBonus":11.26125,"shardBonus":2.59875},{"key":"blood+cosmic+electric+gold","name":"Империя молний","damageBonus":8.6625,"shardBonus":4.62},{"key":"blood+cosmic+gold+shadow","name":"Багровая империя","damageBonus":8.085,"shardBonus":4.90875},{"key":"electric+fire+ice+shadow","name":"Хаос четырёх стихий","damageBonus":10.9725,"shardBonus":2.31},{"key":"electric+fire+gold+ice","name":"Небесная кузница","damageBonus":8.085,"shardBonus":4.0425},{"key":"cosmic+electric+fire+ice","name":"Первозданный взрыв","damageBonus":11.55,"shardBonus":2.59875},{"key":"fire+gold+ice+shadow","name":"Проклятый слиток","damageBonus":7.5075,"shardBonus":4.33125},{"key":"cosmic+fire+ice+shadow","name":"Затмение стихий","damageBonus":10.9725,"shardBonus":2.59875},{"key":"cosmic+fire+gold+ice","name":"Солнечный кристалл","damageBonus":8.37375,"shardBonus":4.90875},{"key":"electric+fire+gold+shadow","name":"Чёрная золотая буря","damageBonus":8.6625,"shardBonus":4.0425},{"key":"cosmic+electric+fire+shadow","name":"Гибель галактики","damageBonus":11.55,"shardBonus":2.59875},{"key":"cosmic+electric+fire+gold","name":"Золотая сверхновая","damageBonus":8.085,"shardBonus":2.8875},{"key":"cosmic+fire+gold+shadow","name":"Корона затмения","damageBonus":8.95125,"shardBonus":4.90875},{"key":"electric+gold+ice+shadow","name":"Ледяной монолит","damageBonus":6.93,"shardBonus":4.62},{"key":"cosmic+electric+ice+shadow","name":"Квантовая бездна","damageBonus":10.9725,"shardBonus":2.59875},{"key":"cosmic+electric+gold+ice","name":"Кристальная галактика","damageBonus":7.79625,"shardBonus":5.1975},{"key":"cosmic+gold+ice+shadow","name":"Замёрзшая вечность","damageBonus":6.64125,"shardBonus":5.1975},{"key":"cosmic+electric+gold+shadow","name":"Тёмная сингулярность","damageBonus":8.6625,"shardBonus":4.90875}];
const OLD_SYNERGY_BY_SET=new Map(Object.entries(SYNERGY_BONUSES).map(([key,value])=>[key.split('+').sort().join('+'),value]));
for(const key of Object.keys(SYNERGY_BONUSES))delete SYNERGY_BONUSES[key];
for(const recipe of CONSTELLATION_CATALOG){const old=OLD_SYNERGY_BY_SET.get(recipe.key)||{};SYNERGY_BONUSES[recipe.key]={...old,...recipe,name:recipe.name||old.name,tier:recipe.key.split('+').length,tierName:'Созвездие',critChanceBonus:0,critDamageBonus:0,description:'Созвездие '+(recipe.name||old.name)};}
// Cache requirements once; combat only tests membership in the active set.
const ORIGINAL_SYNERGY_ENTRIES=Object.entries(SYNERGY_BONUSES).map(([key,bonus])=>({key,bonus,moons:key.split('+')}));
const CLONE_LINK_NAMES={normal:'Зеркальное комбо',blood:'Зеркальная ярость',ice:'Зеркальный мороз',shadow:'Зеркальная тень',electric:'Зеркальный разряд',fire:'Зеркальный жар',gold:'Зеркальное богатство',cosmic:'Зеркальная вселенная'};

export const ACHIEVEMENTS = {
  moonSquad: { id: 'moonSquad', category: 'moons', categoryName: 'Луны', icon: '🌗', tiers: [{ level: 'bronze', target: 2, name: 'Лунный отряд 1', description: 'Держите 2 луны одновременно в активных слотах', reward: 150}, { level: 'silver', target: 3, name: 'Лунный отряд 2', description: 'Держите 3 луны одновременно в активных слотах', reward: 850}, { level: 'gold', target: 4, name: 'Лунный отряд 3', description: 'Держите 4 луны одновременно в активных слотах', reward: 3500}], check: (state,tier) => ((state?.activeMoons||[]).length) >= tier.target },
  moonVariety: { id: 'moonVariety', category: 'moons', categoryName: 'Луны', icon: '🧬', tiers: [{ level: 'bronze', target: 4, name: 'Арсенал стихий 1', description: 'Купите 4 разных лун за один забег', reward: 300}, { level: 'silver', target: 6, name: 'Арсенал стихий 2', description: 'Купите 6 разных лун за один забег', reward: 1400}, { level: 'gold', target: 8, name: 'Арсенал стихий 3', description: 'Купите 8 разных лун за один забег', reward: 6000}], check: (state,tier) => ((state?.ownedMoons||[]).length) >= tier.target },
  moonForge: { id: 'moonForge', category: 'moons', categoryName: 'Луны', icon: '🔧', tiers: [{ level: 'bronze', target: 8, name: 'Лунная кузница 1', description: 'Суммарно повысьте уровни своих лун 8 раз за один забег', reward: 200}, { level: 'silver', target: 20, name: 'Лунная кузница 2', description: 'Суммарно повысьте уровни своих лун 20 раз за один забег', reward: 1200}, { level: 'gold', target: 40, name: 'Лунная кузница 3', description: 'Суммарно повысьте уровни своих лун 40 раз за один забег', reward: 6000}], check: (state,tier) => (Object.values(state?.moonLevels||{}).reduce((a,b)=>a+Math.max(0,b-1),0)) >= tier.target },
  ufoCommander: { id: 'ufoCommander', category: 'ufo', categoryName: 'НЛО', icon: '🛸', tiers: [{ level: 'bronze', target: 1, name: 'Адмирал орбиты 1', description: 'Улучшите НЛО до 1-го уровня', reward: 250}, { level: 'silver', target: 3, name: 'Адмирал орбиты 2', description: 'Улучшите НЛО до 3-го уровня', reward: 1200}, { level: 'gold', target: 5, name: 'Адмирал орбиты 3', description: 'Улучшите НЛО до 5-го уровня', reward: 4500}], check: (state,tier) => (state?.ufoLevel||0) >= tier.target },
  cloneArchitect: { id: 'cloneArchitect', category: 'clone', categoryName: 'Клон', icon: '🪞', tiers: [{ level: 'bronze', target: 1, name: 'Зеркальный лабиринт 1', description: 'Активируйте Клона и назначьте ему 1 отражение', reward: 350}, { level: 'silver', target: 2, name: 'Зеркальный лабиринт 2', description: 'Активируйте Клона и назначьте ему 2 отражения', reward: 1800}, { level: 'gold', target: 4, name: 'Зеркальный лабиринт 3', description: 'Активируйте Клона и назначьте ему 4 отражений', reward: 7500}], check: (state,tier) => ((state?.activeMoons||[]).includes('clone')?(state?.cloneTargets||[]).length:0) >= tier.target },
  cosmicBuilder: { id: 'cosmicBuilder', category: 'synergies', categoryName: 'Синергии', icon: '🌌', tiers: [{ level: 'bronze', target: 2, name: 'Космический ансамбль 1', description: 'Одновременно активируйте 2 разных стихийных лун (без обычной и Клона)', reward: 250}, { level: 'silver', target: 3, name: 'Космический ансамбль 2', description: 'Одновременно активируйте 3 разных стихийных лун (без обычной и Клона)', reward: 1600}, { level: 'gold', target: 4, name: 'Космический ансамбль 3', description: 'Одновременно активируйте 4 разных стихийных лун (без обычной и Клона)', reward: 6500}], check: (state,tier) => ((state?.activeMoons||[]).filter(id=>['blood','fire','ice','electric','shadow','gold','cosmic'].includes(id)).length) >= tier.target },
  prestigeTraveler: { id: 'prestigeTraveler', category: 'prestige', categoryName: 'Престиж', icon: '🌟', tiers: [{ level: 'bronze', target: 1, name: 'Петля времени 1', description: 'Совершите 1 вознесение (престиж)', reward: 400}, { level: 'silver', target: 3, name: 'Петля времени 2', description: 'Совершите 3 вознесения (престиж)', reward: 2500}, { level: 'gold', target: 10, name: 'Петля времени 3', description: 'Совершите 10 вознесений (престиж)', reward: 11000}], check: (state,tier) => (state?.prestige?.ascensions||0) >= tier.target },
  prestigeEngineer: { id: 'prestigeEngineer', category: 'prestige', categoryName: 'Престиж', icon: '🧪', tiers: [{ level: 'bronze', target: 1, name: 'Архитектор вечности 1', description: 'Купите суммарно 1 уровень улучшений престижа', reward: 400}, { level: 'silver', target: 3, name: 'Архитектор вечности 2', description: 'Купите суммарно 3 уровня улучшений престижа', reward: 2000}, { level: 'gold', target: 6, name: 'Архитектор вечности 3', description: 'Купите суммарно 6 уровней улучшений престижа', reward: 8500}], check: (state,tier) => (Object.values(state?.prestige?.upgrades||{}).reduce((a,b)=>a+(Number(b)||0),0)) >= tier.target },
  crystalEngineer: { id: 'crystalEngineer', category: 'wealth', categoryName: 'Богатство', icon: '🔮', tiers: [{ level: 'bronze', target: 1, name: 'Кристальный двигатель 1', description: 'Прокачайте улучшение «Кристаллы за клик» до 1-го уровня', reward: 200}, { level: 'silver', target: 5, name: 'Кристальный двигатель 2', description: 'Прокачайте улучшение «Кристаллы за клик» до 5-го уровня', reward: 1000}, { level: 'gold', target: 15, name: 'Кристальный двигатель 3', description: 'Прокачайте улучшение «Кристаллы за клик» до 15-го уровня', reward: 5000}], check: (state,tier) => (state?.clickCrystalLevel||0) >= tier.target },
  ufoFleet: { id: 'ufoFleet', category: 'ufo', categoryName: 'НЛО', icon: '🚀', tiers: [{ level: 'bronze', target: 1, name: 'Небесная эскадрилья 1', description: 'Соберите флот из 1 НЛО одновременно', reward: 250}, { level: 'silver', target: 3, name: 'Небесная эскадрилья 2', description: 'Соберите флот из 3 НЛО одновременно', reward: 1400}, { level: 'gold', target: 6, name: 'Небесная эскадрилья 3', description: 'Соберите флот из 6 НЛО одновременно', reward: 6500}], check: (state,tier) => (state?.ufoCount||0) >= tier.target },
  clickNovice: { id: 'clickNovice', category: 'clicks', categoryName: 'Клики', icon: '👆', tiers: [{ level: 'bronze', target: 100, name: 'Начинающий кликер', description: 'Сделайте 100 кликов', reward: 25 }, { level: 'silver', target: 1000, name: 'Опытный кликер', description: 'Сделайте 1 000 кликов', reward: 125 }, { level: 'gold', target: 10000, name: 'Мастер кликов', description: 'Сделайте 10 000 кликов', reward: 625 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.runClickCount ?? state?.clickCount ?? 0) >= tier.target; } },
  clickMaster: { id: 'clickMaster', category: 'clicks', categoryName: 'Клики', icon: '🖱️', tiers: [{ level: 'bronze', target: 50000, name: 'Кликомания', description: 'Сделайте 50 000 кликов', reward: 2500 }, { level: 'silver', target: 250000, name: 'Кликер-легенда', description: 'Сделайте 250 000 кликов', reward: 12500 }, { level: 'gold', target: 1000000, name: 'Бог кликов', description: 'Сделайте 1 000 000 кликов', reward: 37500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.runClickCount ?? state?.clickCount ?? 0) >= tier.target; } },
  levelUp: { id: 'levelUp', category: 'levels', categoryName: 'Уровни', icon: '📈', tiers: [{ level: 'bronze', target: 10, name: 'Путь начат', description: 'Достигните 10 уровня', reward: 75 }, { level: 'silver', target: 25, name: 'Опытный искатель', description: 'Достигните 25 уровня', reward: 500 }, { level: 'gold', target: 50, name: 'Покоритель миров', description: 'Достигните 50 уровня', reward: 2500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.runMaxLevel ?? state?.maxLevel ?? state?.currentLevel ?? 1) >= tier.target; } },
  levelMaster: { id: 'levelMaster', category: 'levels', categoryName: 'Уровни', icon: '⭐', tiers: [{ level: 'bronze', target: 75, name: 'Ветеран', description: 'Достигните 75 уровня', reward: 6250 }, { level: 'silver', target: 100, name: 'Сотня!', description: 'Достигните 100 уровня', reward: 18750 }, { level: 'gold', target: 200, name: 'Легенда галактики', description: 'Достигните 200 уровня', reward: 62500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.runMaxLevel ?? state?.maxLevel ?? state?.currentLevel ?? 1) >= tier.target; } },
  bossSlayer: { id: 'bossSlayer', category: 'bosses', categoryName: 'Боссы', icon: '👹', tiers: [{ level: 'bronze', target: 5, name: 'Охотник на боссов', description: 'Убейте 5 боссов', reward: 125 }, { level: 'silver', target: 25, name: 'Гроза боссов', description: 'Убейте 25 боссов', reward: 1000 }, { level: 'gold', target: 100, name: 'Легендарный убийца', description: 'Убейте 100 боссов', reward: 5000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.bossKills || 0) >= tier.target; } },
  moonCollector: { id: 'moonCollector', category: 'moons', categoryName: 'Луны', icon: '🌙', tiers: [{ level: 'bronze', target: 3, name: 'Собиратель', description: 'Соберите 3 разных луны', reward: 75 }, { level: 'silver', target: 5, name: 'Коллекционер', description: 'Соберите 5 разных лун', reward: 750 }, { level: 'gold', target: 8, name: 'Повелитель лун', description: 'Соберите все 8 лун', reward: 3750 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.ownedMoons?.length || 0) >= tier.target; } },
  moonUpgrader: { id: 'moonUpgrader', category: 'moons', categoryName: 'Луны', icon: '⬆️', tiers: [{ level: 'bronze', target: 3, name: 'Улучшатель', description: 'Прокачайте любую луну до 3 уровня', reward: 125 }, { level: 'silver', target: 7, name: 'Мастер лун', description: 'Прокачайте любую луну до 7 уровня', reward: 1875 }, { level: 'gold', target: 10, name: 'Максимальная мощь', description: 'Прокачайте любую луну до 10 уровня', reward: 10000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; const moonLevels = state?.moonLevels || {}; const maxLevel = Math.max(0, ...Object.values(moonLevels)); return maxLevel >= tier.target; } },
  shardCollector: { id: 'shardCollector', category: 'wealth', categoryName: 'Богатство', icon: '💎', tiers: [{ level: 'bronze', target: 1000, name: 'Первая тысяча', description: 'Накопите 1 000 осколков', reward: 63 }, { level: 'silver', target: 10000, name: 'Десять тысяч', description: 'Накопите 10 000 осколков', reward: 500 }, { level: 'gold', target: 100000, name: 'Сто тысяч!', description: 'Накопите 100 000 осколков', reward: 2500 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.playerData?.shards || 0) >= tier.target; } },
  shardMillionaire: { id: 'shardMillionaire', category: 'wealth', categoryName: 'Богатство', icon: '💰', tiers: [{ level: 'bronze', target: 500000, name: 'Полмиллиона', description: 'Накопите 500 000 осколков', reward: 7500 }, { level: 'silver', target: 2000000, name: 'Мультимиллионер', description: 'Накопите 2 000 000 осколков', reward: 25000 }, { level: 'gold', target: 10000000, name: 'Миллиардер', description: 'Накопите 10 000 000 осколков', reward: 125000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.playerData?.shards || 0) >= tier.target; } },
  slotMaster: { id: 'slotMaster', category: 'slots', categoryName: 'Слоты', icon: '🎰', tiers: [{ level: 'bronze', target: 2, name: 'Двойной слот', description: 'Откройте 2 слота', reward: 250 }, { level: 'silver', target: 3, name: 'Три слота', description: 'Откройте 3 слота', reward: 1250 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.maxSlots || 1) >= tier.target; } },
  synergyHunter: { id: 'synergyHunter', category: 'synergies', categoryName: 'Синергии', icon: '🔗', tiers: [{ level: 'bronze', target: 1, name: 'Первая синергия', description: 'Активируйте 1 синергию', reward: 188 }, { level: 'silver', target: 3, name: 'Мастер комбинаций', description: 'Активируйте 3 синергии', reward: 1250 }, { level: 'gold', target: 5, name: 'Синергетический бог', description: 'Активируйте 5 синергий', reward: 5000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; const active = (state?.activeMoons || []).slice(0, state?.maxSlots || 1); return getActiveSynergies(state).length >= tier.target; } },
  timePlayed: { id: 'timePlayed', category: 'time', categoryName: 'Время', icon: '⏱️', tiers: [{ level: 'bronze', target: 3600, name: 'Первый час', description: 'Сыграйте 1 час', reward: 125 }, { level: 'silver', target: 36000, name: '10 часов', description: 'Сыграйте 10 часов', reward: 2500 }, { level: 'gold', target: 360000, name: '100 часов!', description: 'Сыграйте 100 часов', reward: 25000 }], check: (state, tier) => { if (!tier || typeof tier.target !== 'number') return false; return (state?.totalSecondsPlayed || 0) >= tier.target; } }
};

// ============================================================
// КВЕСТЫ (без изменений)
// ============================================================
export const QUESTS = {
  moonBuyDaily: { id:'moonBuyDaily', category:'moons', categoryName:'Луны', icon:'🌙', name:'Пополнение орбиты', description:'Купите 1 новую луну', target:1, reward:160, bonusReward:80, type:'moonBuy', difficulty:'easy', color:'#7986cb' },
  moonUpgradeDaily: { id:'moonUpgradeDaily', category:'moons', categoryName:'Луны', icon:'🔧', name:'Лунный механик', description:'Улучшите луны 3 раза', target:3, reward:210, bonusReward:105, type:'moonUpgrade', difficulty:'medium', color:'#7986cb' },
  moonUpgradeMarathon: { id:'moonUpgradeMarathon', category:'moons', categoryName:'Луны', icon:'⚙️', name:'Мастерская сверхновой', description:'Улучшите луны 8 раз', target:8, reward:650, bonusReward:325, type:'moonUpgrade', difficulty:'hard', color:'#7986cb' },
  moonSwitchDaily: { id:'moonSwitchDaily', category:'moons', categoryName:'Луны', icon:'🔄', name:'Смена тактики', description:'Смените состав активных лун 5 раз', target:5, reward:190, bonusReward:95, type:'moonSwitch', difficulty:'hard', color:'#7986cb' },
  synergyDaily: { id:'synergyDaily', category:'synergies', categoryName:'Синергии', icon:'🔗', name:'Алхимия стихий', description:'Активируйте 2 разные сборки синергий', target:2, reward:260, bonusReward:130, type:'synergy', difficulty:'medium', color:'#7986cb' },
  synergyMarathon: { id:'synergyMarathon', category:'synergies', categoryName:'Синергии', icon:'🌌', name:'Звёздный дирижёр', description:'Активируйте 5 разных сборок синергий', target:5, reward:850, bonusReward:425, type:'synergy', difficulty:'hard', color:'#7986cb' },
  ufoDaily: { id:'ufoDaily', category:'ufo', categoryName:'НЛО', icon:'🛸', name:'Командир тарелок', description:'Улучшите НЛО 1 раз', target:1, reward:250, bonusReward:125, type:'ufoUpgrade', difficulty:'easy', color:'#7986cb' },
  crystalDaily: { id:'crystalDaily', category:'progress', categoryName:'Прогресс', icon:'🔮', name:'Кристальный инженер', description:'Улучшите кристаллы за клик 2 раза', target:2, reward:200, bonusReward:100, type:'crystalUpgrade', difficulty:'medium', color:'#7986cb' },
  cloneDaily: { id:'cloneDaily', category:'clone', categoryName:'Клон', icon:'🪞', name:'Игра отражений', description:'Перенастройте отражения Клона 2 раза', target:2, reward:300, bonusReward:150, type:'cloneTune', difficulty:'medium', color:'#7986cb' },
  bossRush: { id:'bossRush', category:'hunter', categoryName:'Охотник', icon:'⚔️', name:'Босс за боссом', description:'Победите 5 боссов', target:5, reward:600, bonusReward:300, type:'bossKill', difficulty:'hard', color:'#7986cb' },
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
  progress: { name: 'Прогресс', icon: '📈', color: '#ff9800' },
  moons:{name:'Луны',icon:'🌙',color:'#7986cb'}, synergies:{name:'Синергии',icon:'🔗',color:'#9575cd'}, ufo:{name:'НЛО',icon:'🛸',color:'#26a69a'}, clone:{name:'Клон',icon:'🪞',color:'#ab47bc'}
};

export const ACHIEVEMENT_CATEGORIES = {
  all: { name: 'Все', icon: '🏆' }, clicks: { name: 'Клики', icon: '👆' }, levels: { name: 'Уровни', icon: '📈' }, bosses: { name: 'Боссы', icon: '👹' }, moons: { name: 'Луны', icon: '🌙' }, wealth: { name: 'Богатство', icon: '💎' }, slots: { name: 'Слоты', icon: '🎰' }, ufo:{name:'НЛО',icon:'🛸'}, clone:{name:'Клон',icon:'🪞'}, prestige:{name:'Престиж',icon:'🌟'}, synergies: { name: 'Синергии', icon: '🔗' }, time: { name: 'Время', icon: '⏱️' }
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
  const scale=(1+Math.max(0,(state.moonLevels?.[id]||1)-1)*c.MOON_BUFF_SCALE)*getMoonPower(state,id);
  result.damage+=(buff.damage||0)*scale;
  if(buff.comboDamage&&(runtime._comboClicks||0)>=getMoonMechanicParams('normal',state.moonLevels?.normal||1).clicksPerStack)result.damage+=buff.comboDamage*scale;
  if(buff.bossDamage&&state.currentLevel%CONSTANTS.BOSS_INTERVAL===0)result.damage+=buff.bossDamage*scale;
  result.damage+=(buff.damagePerLevel||0)*(state.currentLevel||1)*scale;
  result.haste+=(buff.haste||0)*scale;result.critChance+=(buff.critChance||0)*scale;
  if(buff.rewardMultiplier)result.rewardMultiplier=Math.pow(buff.rewardMultiplier,getMoonPower(state,id));
  if(buff.critMultiplier)result.critMultiplier=buff.critMultiplier;
  if(buff.chainEvery){result.chainEvery=buff.chainEvery;result.chainMultiplier=1+(buff.chainMultiplier-1)*scale;}
 }
 result.haste=Math.min(CONSTANTS.PRESTIGE.UFO_HASTE_CAP,1-(1-Math.min(.9,result.haste))*(1-prestige.ufoHaste));
 return result;
}
export function getUfoMoonDescription(id,level=1) {
 if(id==='clone')return '🛸 Повторяет и усиливает баффы выбранных оригиналов для тарелок';
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
 whiteDamage:{id:'whiteDamage',name:'Белый урон',icon:'🤍',description:'Множитель белого урона: x0.05 за уровень',baseCost:1,maxLevel:Infinity},
 cloneCopies:{id:'cloneCopies',name:'Дополнительные отражения',icon:'🪞',description:'Позволяет клону создать еще одну копию',baseCost:50,maxLevel:2},
 reactor:{id:'reactor',name:'Вечный реактор',icon:'⚔️',description:'+25% урона за уровень',baseCost:1,maxLevel:Infinity,damage:0.25},
 treasury:{id:'treasury',name:'Звёздная казна',icon:'💎',description:'+25% добычи кристаллов за уровень',baseCost:1,maxLevel:Infinity,shards:0.25},
 fleet:{id:'fleet',name:'Бессмертная армада',icon:'🛸',description:'+15% урона тарелок за уровень',baseCost:2,maxLevel:Infinity,ufoDamage:0.15},
 clock:{id:'clock',name:'Вечный хронометр',icon:'⏱️',description:'Ускоряет стрельбу тарелок: каждый уровень сокращает интервал между выстрелами ещё на 6%; предел 95%, минимум 100 мс',baseCost:2,maxLevel:49,ufoHaste:0.06},
 echo:{id:'echo',name:'Эхо выстрела',icon:'🔊',description:'+10% шанса повторить 100% урона ручного выстрела за уровень. Каждые полные 100% дают гарантированный повтор, остаток — шанс ещё одного.',baseCost:25,maxLevel:Infinity,chance:0.10,damage:1},
 capital:{id:'capital',name:'Стартовый капитал',icon:'🚀',description:'+2000 кристаллов за уровень после вознесения',baseCost:3,maxLevel:Infinity,shards:2000},
 hunter:{id:'hunter',name:'Охотник на боссов',icon:'👹',description:'+25% урона боссам и +2 секунды боя за уровень',baseCost:5,maxLevel:Infinity,damage:0.25,time:2},
 archive:{id:'archive',name:'Лунный архив',icon:'📚',description:'Навсегда +1,5 к базовому урону Космической за убитую луну за каждый уровень улучшения',baseCost:30,maxLevel:Infinity,perKill:1.5},
 orbit:{id:'orbit',name:'Вечная орбита',icon:'🌌',description:'Один дополнительный слот активной луны, сохраняется при вознесении',baseCost:100,maxLevel:1},
 autoclick:{id:'autoclick',name:'Автопилот кликов',icon:'⚡',description:'+15 секунд автокликов за уровень',baseCost:1,maxLevel:Infinity,seconds:15},
 critical:{id:'critical',name:'Звёздное прицеливание',icon:'🎯',description:'+3% шанса крита за уровень',baseCost:2,maxLevel:Infinity,crit:0.03}
};
export function getMoscowDay(now=Date.now()){return new Date(now+3*60*60*1000).toISOString().slice(0,10);}
export function getPrestigeSummary(state,now=Date.now()+(state.serverClockOffset||0)){
 const p=state.prestige||{},up=p.upgrades||{},c=CONSTANTS.PRESTIGE;
 const record=state.runMaxLevel??Math.max(state.maxLevel||1,state.currentLevel||1);
 const damageSteps=(p.damageStepsTotal||0)+Math.max(0,Math.floor(record/c.DAMAGE_EVERY)-(p.runDamageSteps||0));
 const shardSteps=(p.shardStepsTotal||0)+Math.max(0,Math.floor(record/c.SHARDS_EVERY)-(p.runShardSteps||0));
 const today=getMoscowDay(now);
 const used=p.dailyAscensionDay===today?Math.max(0,Math.min(c.DAILY_ASCENSION_LIMIT,Math.floor(p.dailyAscensionCount||0))):0;
 return {coins:p.coins||0,ascensions:p.ascensions||0,runRecord:record,dailyAscensionsUsed:used,dailyAscensionsLeft:c.DAILY_ASCENSION_LIMIT-used,dailyAscensionLimit:c.DAILY_ASCENSION_LIMIT,
 pendingCoins:Math.floor(record/c.COIN_EVERY),
 canAscend:used<c.DAILY_ASCENSION_LIMIT&&Number.isSafeInteger(Math.floor(record/c.COIN_EVERY))&&Math.floor(record/c.COIN_EVERY)>0,
 damageBonus:damageSteps*c.DAMAGE_PER_STEP+(up.reactor||0)*PRESTIGE_UPGRADES.reactor.damage,
 shardBonus:shardSteps*c.SHARDS_PER_STEP+(up.treasury||0)*PRESTIGE_UPGRADES.treasury.shards,
 critBonus:(up.critical||0)*PRESTIGE_UPGRADES.critical.crit,
 echoChance:(up.echo||0)*PRESTIGE_UPGRADES.echo.chance,echoDamage:PRESTIGE_UPGRADES.echo.damage,
 startShards:Math.min(CONSTANTS.SAFE_NUMBER_CAP,(up.capital||0)*PRESTIGE_UPGRADES.capital.shards),
 bossDamage:(up.hunter||0)*PRESTIGE_UPGRADES.hunter.damage,bossTime:(up.hunter||0)*PRESTIGE_UPGRADES.hunter.time,
 archivePerKill:(up.archive||0)*PRESTIGE_UPGRADES.archive.perKill,extraSlots:Math.min(1,up.orbit||0),
 ufoDamage:(up.fleet||0)*PRESTIGE_UPGRADES.fleet.ufoDamage,whiteDamageMultiplier:1+(up.whiteDamage||0)*0.05,
 rewardMultiplier:1+(p.ascensions||0)*c.REWARD_PER_ASCENSION,
 ufoHaste:Math.min(c.UFO_HASTE_CAP,1-Math.pow(1-PRESTIGE_UPGRADES.clock.ufoHaste,up.clock||0))};
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
 if(id==='autoclick')return level>=0?1:Infinity;
 if(id==='cloneCopies')return level===0?50:level===1?150:Infinity;
 const d=PRESTIGE_UPGRADES[id];
 return d&&level<d.maxLevel?Math.min(CONSTANTS.SAFE_NUMBER_CAP,d.baseCost+Math.max(1,Math.ceil(d.baseCost*CONSTANTS.PRESTIGE.PRICE_STEP_RATIO))*level+Math.floor(level*level/CONSTANTS.PRESTIGE.PRICE_QUADRATIC_DIVISOR)):Infinity;
}

/** Whole percentages repeat guaranteed hits; the remainder rolls one extra. */
export function rollEchoRepeats(chance,random=Math.random){
 const value=Math.max(0,Number.isFinite(chance)?chance:0),whole=Math.floor(value),fraction=value-whole;
 return Math.min(CONSTANTS.SAFE_NUMBER_CAP,whole+(fraction>0&&random()<fraction?1:0));
}
export function getProgressReward(amount,state){
 return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(0,Math.round(amount*getPrestigeSummary(state).rewardMultiplier)));
}
export function getQuestPayout(def,state){
 const total=getProgressReward(def.reward+(def.bonusReward||0),state),base=Math.min(total,getProgressReward(def.reward,state));
 return {base,bonus:total-base,total};
}

/** Pure live view of the same passive and temporary combat modifiers used by the server. */

/** At most two distinct active originals; reflections never reflect reflections. */
export function getCloneTargets(state){
 const active=(state.activeMoons||[]).slice(0,state.maxSlots||1);
 if(!active.includes('clone'))return [];
 const level=state.moonLevels?.clone||1,up=state.prestige?.upgrades?.cloneCopies||0;
 const count=getMoonMechanicParams('clone',level).copies+(level>=15&&up>=1?1:0)+(level>=20&&up>=2?1:0);
 return (state.cloneTargets||[]).filter(id=>id!=='clone'&&active.includes(id)&&Object.hasOwn(MOON_TYPES,id)).slice(0,count);
}

/** Reflected synergies require real bindings; no virtual clone can clone another. */
export function getActiveSynergies(state){
 const originals=[...new Set((state.activeMoons||[]).slice(0,state.maxSlots||1))].filter(id=>id!=='normal'&&id!=='clone'&&Object.hasOwn(MOON_TYPES,id)).sort();
 if(originals.length<2||originals.length>4)return [];
 const entry=ORIGINAL_SYNERGY_ENTRIES.find(e=>e.moons.length===originals.length&&e.moons.every(id=>originals.includes(id)));
 if(!entry)return [];
 const targets=getCloneTargets(state);
 const reflectionCount=targets.filter(id=>originals.includes(id)).length;
 const copyMultiplier=1+0.20*reflectionCount;
 return [{key:entry.key,...entry.bonus,moons:entry.moons,copyMultiplier,damageBonus:entry.bonus.damageBonus*copyMultiplier,shardBonus:entry.bonus.shardBonus*copyMultiplier,critChanceBonus:0,critDamageBonus:0}];
}

export function getMoonPower(state,id){
 if(id==='clone')return 0;
 const copies=getCloneTargets(state).filter(target=>target===id).length;
 return copies?(1+copies)*getMoonMechanicParams('clone',state.moonLevels?.clone||1).pairScale:1;
}
export function getEffectiveMoonParams(state,id){
 if(!(state.activeMoons||[]).slice(0,state.maxSlots||1).includes(id)||!Object.hasOwn(MOON_TYPES,id))return null;
 const p=getMoonMechanicParams(id,state.moonLevels?.[id]||1),power=getMoonPower(state,id);
 if(id==='cosmic')p.baseDamagePerKill+=getPrestigeSummary(state).archivePerKill;
 for(const key of ['bonusPerStack','damageBonus','timerBonus','pierceDamage','critDamagePerStack','fullStackCritChance','pityBonus','pityMax','superconductorBonus','goldenClickReward','shardToDamageRatio','baseDamagePerLevel','baseDamagePerKill','damagePerLevel','shardPerLevel','critDamagePerLevel','critChancePerLevel','shardBonusOnFullStack'])if(typeof p[key]==='number')p[key]*=power;
 for(const key of ['normalMultiplier','bossMultiplier','firstStrikeMultiplier'])if(p[key])p[key]=1+(p[key]-1)*power;
 if(p.doubleCritChance)p.doubleCritChance=1-Math.pow(1-p.doubleCritChance,power);
 if(id==='electric'&&power!==1){
  const total=p.chanceX2+p.chanceX5+p.chanceX10,combined=1-Math.pow(1-total,power);
  for(const key of ['chanceX2','chanceX5','chanceX10'])p[key]=p[key]/total*combined;
 }
 return p;
}
export function getClickCrystalCost(level){return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.floor(CONSTANTS.CLICK_CRYSTALS.BASE_COST*Math.pow(CONSTANTS.CLICK_CRYSTALS.MULTIPLIER,level)));}
export function getSlotLimit(state){return CONSTANTS.MAX_SLOTS+getPrestigeSummary(state).extraSlots;}

/** Temporary flat damage is recalculated, never written into purchased click damage. */
export function getBaseDamage(state){
 const base=state.playerData?.click_damage||CONSTANTS.DEFAULTS.CLICK_DAMAGE;
 if(!(state.activeMoons||[]).slice(0,state.maxSlots||1).includes('cosmic'))return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.round(base*getPrestigeSummary(state).whiteDamageMultiplier));
 const params=getEffectiveMoonParams(state,'cosmic');
 return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.round((base+params.baseDamagePerLevel*(state.currentLevel||1)+params.baseDamagePerKill*(state.moonKills||0))*getPrestigeSummary(state).whiteDamageMultiplier));
}

export function getCombatStats(state,now=Date.now()+(state.serverClockOffset||0)){
 const p=getPrestigeSummary(state),active=[...new Set((state.activeMoons||[]).slice(0,state.maxSlots||1))],runtime={...(state.runtime||{})},sources=[];
 let damage=p.damageBonus,shards=p.shardBonus,crit=p.critBonus,critDamage=0;
 const add=(id,name,d=0,s=0,c=0,cd=0)=>{damage+=d;shards+=s;crit+=c;critDamage+=cd;sources.push({id,name,damage:d,shards:s,crit:c,critDamage:cd});};
 if(damage||shards||crit)sources.push({id:'prestige',name:'Престиж и вечные улучшения',damage,shards,crit,critDamage:0});
 const params=id=>getEffectiveMoonParams(state,id);
 for(const id of active){
  const moon=MOON_TYPES[id];if(!moon)continue;const scale=(1+((state.moonLevels?.[id]||1)-1)*.05)*getMoonPower(state,id),b=moon.baseStats;
  add(id,moon.name,(b.damageBonus||0)*scale,(b.shardBonus||0)*scale,(b.critChanceBonus||0)*scale,(b.critDamageBonus||0)*scale);
  const m=params(id);
  if(id==='cosmic')add('cosmic-level','Космическое масштабирование',m.damagePerLevel*state.currentLevel,m.shardPerLevel*state.currentLevel,(m.critChancePerLevel||0)*state.currentLevel,m.critDamagePerLevel*state.currentLevel);
  if(id==='gold'&&m.shardToDamageRatio>0)add('gold-wealth','Золотой дождь',(state.playerData?.shards||0)*m.shardToDamageRatio);
 }
 const constellation=getActiveSynergies(state)[0];
 const synergyDamage=constellation?.damageBonus||0,synergyShards=constellation?.shardBonus||0;
 if(constellation)sources.push({id:constellation.key,name:constellation.name,damage:synergyDamage,shards:synergyShards,crit:0,critDamage:0});
 if(active.includes('normal')&&active.length>1)add('normal-link','Связь обычной луны',.05,.05);
 const passive={totalDamageBonus:(1+damage)*(1+synergyDamage)-1,totalShardBonus:(1+shards)*(1+synergyShards)-1,totalCritChanceBonus:crit,totalCritDamageBonus:critDamage};
 for(const [id,key]of [['normal','_comboClicks'],['fire','_fireStacks'],['shadow','_shadowCritStacks']]){
  const m=params(id),last=id==='normal'?Math.max(state.lastClickAt||0,state.lastAutoClickAt||0,state.lastComboAt||0):Math.max(state.lastClickAt||0,state.lastAutoClickAt||0);
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
 if(boss&&p.bossDamage)add('hunter','Охотник на боссов',p.bossDamage);
 if(boss&&blood&&ratio<blood.hpThreshold)add('blood-boss','Кровавая ярость',blood.damageBonus);
 const base=getBaseDamage(state),baseDamageBonus=base-(state.playerData?.click_damage||CONSTANTS.DEFAULTS.CLICK_DAMAGE);
 const steadyDamage=Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(base*(1+damage)*(1+synergyDamage))));
 if(electric&&(runtime._superconductorClicksLeft||0)>0)add('superconductor','Сверхпроводник · '+runtime._superconductorClicksLeft+' ударов',electric.superconductorBonus);
 const nextPierce=!!(ice?.pierceInterval>0&&((runtime._clickCounter||0)+1)%ice.pierceInterval===0);
 const execute=!!(boss&&blood?.executeThreshold>0&&ratio<=blood.executeThreshold);
 let finalDamage=Math.max(1,Math.round(base*(1+damage)*(1+synergyDamage)));
 if(execute)finalDamage=Math.max(finalDamage,Math.round(base*(state.moonHP/base+1)));
 let chance=Math.max(0,.05+crit);
 const firstStrike=!!(shadow?.firstStrikeCrit&&!runtime._firstStrikeUsed&&runtime._newMoon);
 if(firstStrike)chance=Math.max(1,chance);
 const firstStrikeMultiplier=firstStrike?(shadow.firstStrikeMultiplier||1):1;
 const critMultiplier=2+critDamage,tier=chance>=1?Math.floor(chance)+1:2,extraChance=chance>=1?chance-Math.floor(chance):0;
 const fullCombo=!!(normal?.shardBonusOnFullStack&&combo>=normal.maxStacks),goldMultiplier=gold?(boss?gold.bossMultiplier:gold.normalMultiplier):1;
 const rewardMultiplier=(1+shards)*(1+synergyShards)*goldMultiplier*(fullCombo?1+normal.shardBonusOnFullStack:1);
 const c=CONSTANTS.MOON_REWARD,level=state.currentLevel||1;
 let reward=Math.max(1,Math.round(Math.floor(c.BASE+level*c.PER_LEVEL+Math.pow(level,c.EXPONENT)*c.GROWTH)*(boss?c.BOSS_MULTIPLIER:1)*(1+shards)*(1+synergyShards)));
 if(gold)reward=Math.round(reward*goldMultiplier);if(fullCombo)reward=Math.round(reward*(1+normal.shardBonusOnFullStack));
 const ufo=getUfoBonuses(state,runtime),interval=Math.max(CONSTANTS.UFO.MIN_INTERVAL,Math.round((CONSTANTS.UFO.BASE_INTERVAL-Math.max(0,(state.ufoLevel||0)-1)*CONSTANTS.UFO.INTERVAL_REDUCTION)*(1-ufo.haste)));
 return {passive,sources,runtime,baseDamage:base,baseDamageBonus,echoChance:p.echoChance,echoDamage:p.echoDamage,crystalsPerClick:state.clickCrystalLevel||0,cloneTargets:getCloneTargets(state),finalDamage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,finalDamage),damageBonus:(1+damage)*(1+synergyDamage)-1,shardBonus:rewardMultiplier-1,critChance:chance,critChanceBonus:chance-.05,critDamageBonus:critDamage,critMultiplier,critTier:tier,extraCritChance:extraChance,critDamage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.round(Math.round(finalDamage*critMultiplier*tier/2)*firstStrikeMultiplier)),nextCritDamage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.round(Math.round(finalDamage*critMultiplier*(tier+1)/2)*firstStrikeMultiplier)),nextPierce,firstStrike,firstStrikeMultiplier,execute,
 moonReward:Math.min(CONSTANTS.SAFE_NUMBER_CAP,reward),ufoDamage:state.ufoLevel?Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(steadyDamage*CONSTANTS.UFO.DAMAGE_MULTIPLIER*(1+ufo.damage)))):0,ufoInterval:interval,ufoCount:state.ufoCount||0,goldMultiplier,fullCombo,ufoCritChance:ufo.critChance,ufoCritMultiplier:ufo.critMultiplier,ufoChainEvery:ufo.chainEvery,ufoDamageBonus:ufo.damage,ufoHaste:ufo.haste,ufoRewardMultiplier:ufo.rewardMultiplier,superconductorHits:runtime._superconductorClicksLeft||0};
}

export const MOON_ORDER=Object.freeze(['normal','blood','ice','shadow','electric','fire','gold','cosmic','clone']);
export function getMoonPurchaseAccess(state,id){
 const moon=MOON_TYPES[id],index=MOON_ORDER.indexOf(id),record=Math.max(state.runMaxLevel??state.currentLevel??1,state.currentLevel||1);
 const requiredMoon=index>0?MOON_ORDER.slice(0,index).find(previous=>!(state.ownedMoons||[]).includes(previous)):null;
 const levelUnlocked=!!moon&&record>=moon.unlockLevel;
 return {record,requiredMoon:requiredMoon||null,levelUnlocked,unlocked:levelUnlocked&&!requiredMoon};
}

// Outcome weights are server-owned; wheel geometry shows possible outcomes.
export function getWheelWeights(){return CONSTANTS.WHEEL.WEIGHTS.slice();}
export function getWheelSectorIndex(ticket,state={}){
 const weights=getWheelWeights(state),total=weights.reduce((sum,w)=>sum+w,0);
 if(!Number.isInteger(ticket)||ticket<0||ticket>=total)throw Error('Invalid wheel ticket');
 let edge=0;return weights.findIndex(weight=>(edge+=weight)>ticket);
}
