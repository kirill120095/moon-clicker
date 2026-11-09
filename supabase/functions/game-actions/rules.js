import { CONSTANTS, MOON_TYPES, SYNERGY_BONUSES, QUESTS, ACHIEVEMENTS, rollCritical, getMoonPurchaseAccess, rollEchoRepeats, getProgressReward, getQuestPayout, getBaseDamage, getEffectiveMoonParams, getCombatStats, getSlotLimit, getClickCrystalCost, getPrestigeUpgradeCost, getMoonMechanicParams, getMoonLevelLimit, getMoonUpgradeCostForLevel, getCloneCopyLimit, getLunarDustGain, getUfoBonuses, getPrestigeSummary, getMoscowDay, PRESTIGE_UPGRADES } from './constants.js';
import { getMaxHPForLevel, getSlotUpgradeCost, getClickUpgradeCost } from './config.js';
const showToast=()=>{},updateQuestUI=()=>{},updateAchievementUI=()=>{},updateProfileAndLeaders=()=>{};
export function freshState(username='Игрок') {
 return {runMaxLevel:1,prestige:{coins:0,claimedCoinSteps:0,ascensions:0,upgrades:{}},moonSerial:1,maxLevel:1,ufoCount:0,ufoLevel:0,ufoComboRelay:false,lastComboAt:0,lastAutoClickAt:0,ufoLastShotAt:0,effects:[],currentLevel:1,moonHP:CONSTANTS.BASE_HP,maxHP:CONSTANTS.BASE_HP,clickCount:0,runClickCount:0,totalSecondsPlayed:0,
 playerData:{username,shards:0,click_damage:CONSTANTS.DEFAULTS.CLICK_DAMAGE,click_damage_level:0},
 activeMoon:'normal',activeMoons:['normal'],ownedMoons:['normal'],moonLevels:{normal:1},
 maxSlots:1,echoQueue:[],echoPending:0,cloneTargets:[],clickCrystalLevel:0,moonKills:0,bossKills:0,levelLocked:false,testMode:false,quests:{},achievements:{},runtime:{},
 tokens:CONSTANTS.CLICK_BURST,lastActionAt:0,bossDeadline:null,lastQuestDay:'',inventory:{capacity:20,keepLimit:3,nextId:1,items:[]},equipment:{},lunarLuck:{progress:0,dust:0,claims:0}};
}
export function applyAction(raw, action, payload={}, now=Date.now(), trusted={}) {
 let state=structuredClone(raw);
 state.clickCount=Math.max(0,Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.floor(Number(state.clickCount)||0)));
 state.runClickCount=Number.isSafeInteger(state.runClickCount)&&state.runClickCount>=0?Math.min(state.runClickCount,state.clickCount):state.clickCount;
 state.maxLevel=Math.max(state.maxLevel||1,state.currentLevel);
 state.prestige=state.prestige||{coins:0,ascensions:0,upgrades:{}};
 state.runMaxLevel=Math.max(state.runMaxLevel??state.currentLevel,state.currentLevel);
 function bankMilestones(){const p=state.prestige,c=CONSTANTS.PRESTIGE,d=Math.floor(state.runMaxLevel/c.DAMAGE_EVERY),s=Math.floor(state.runMaxLevel/c.SHARDS_EVERY);p.damageStepsTotal=(p.damageStepsTotal||0)+Math.max(0,d-(p.runDamageSteps||0));p.shardStepsTotal=(p.shardStepsTotal||0)+Math.max(0,s-(p.runShardSteps||0));p.runDamageSteps=d;p.runShardSteps=s;}
 bankMilestones();
 if(action==='ascend'){
  const today=getMoscowDay(now),current=state.prestige.dailyAscensionDay===today?Math.max(0,Math.floor(state.prestige.dailyAscensionCount||0)):0;
  if(current>=CONSTANTS.PRESTIGE.DAILY_ASCENSION_LIMIT)throw Error('Лимит: 3 вознесения в день. Следующее доступно после 00:00 МСК.');
  const summary=getPrestigeSummary(state,now);if(!summary.canAscend)throw Error('Новые монеты престижа появятся на следующем рубеже '+CONSTANTS.PRESTIGE.COIN_EVERY+' уровней');
  const p=structuredClone(state.prestige);p.coins=(p.coins||0)+summary.pendingCoins;p.runDamageSteps=0;p.runShardSteps=0;p.ascensions=(p.ascensions||0)+1;p.dailyAscensionDay=today;p.dailyAscensionCount=current+1;
  const equipment=structuredClone(state.equipment||{}),wheelEconomy=structuredClone(state.wheelEconomy||{}),wheelResult=state.wheelResult,inventory=structuredClone(state.inventory||{capacity:20,keepLimit:3,nextId:1,items:[]}),lunarLuck=structuredClone(state.lunarLuck||{progress:0,dust:0,claims:0});
  const record=state.maxLevel,serial=(state.moonSerial||1)+1,name=state.playerData.username,totalClicks=state.clickCount;
  state=freshState(name);state.equipment=equipment;state.inventory={...inventory,items:inventory.items.filter(item=>item.keep===true).slice(0,inventory.keepLimit)};state.lunarLuck=lunarLuck;state.wheelEconomy=wheelEconomy;state.wheelResult=wheelResult;state.clickCount=totalClicks;state.maxLevel=record;state.moonSerial=serial;state.prestige=p;state.playerData.shards=getPrestigeSummary(state).startShards;action='load';
 }
 state.maxSlots=Math.min(getSlotLimit(state),Math.max(1+getPrestigeSummary(state).extraSlots,state.maxSlots||1));
 state.clickCrystalLevel=Number.isSafeInteger(state.clickCrystalLevel)&&state.clickCrystalLevel>=0?state.clickCrystalLevel:0;
 state.cloneTargets=Array.isArray(state.cloneTargets)?state.cloneTargets.filter(id=>id!=='clone'&&Object.hasOwn(MOON_TYPES,id)).slice(0,4):[];
 state.echoQueue=Array.isArray(state.echoQueue)?state.echoQueue.slice(0,CONSTANTS.ECHO.MAX_QUEUED_BURSTS).filter(b=>Number.isSafeInteger(b.count)&&b.count>0&&Number.isFinite(b.damage)&&b.damage>0).map(b=>({count:b.count,damage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,b.damage),isCrit:!!b.isCrit})):[];
 if(action==='click'&&state.echoQueue.length>CONSTANTS.ECHO.MAX_QUEUED_BURSTS-CONSTANTS.CLICK_BURST)throw Object.assign(Error('Эхо ещё выполняет предыдущие выстрелы. Подождите немного.'),{code:'RATE_LIMIT'});
 state.ufoLevel=state.ufoLevel||0;
 state.ufoCount=Math.min(state.ownedMoons.length,state.ufoCount||(state.ufoLevel?1:0));
 state.moonSerial=state.moonSerial||1;
 state.equipment=state.equipment&&typeof state.equipment==='object'&&!Array.isArray(state.equipment)?state.equipment:{};
 for(const [moonId,slots] of Object.entries(state.equipment)){
  if(!Object.hasOwn(MOON_TYPES,moonId)||!Array.isArray(slots)){delete state.equipment[moonId];continue;}
  state.equipment[moonId]=Array.from({length:3},(_,i)=>({level:Math.max(0,Math.min(30,Math.floor(Number(slots[i]?.level)||0))),itemId:Number.isSafeInteger(slots[i]?.itemId)?slots[i].itemId:null}));
 }
 state.inventory=state.inventory||{capacity:20,keepLimit:3,nextId:1,items:[]};
 state.inventory.capacity=Math.max(20,Math.min(200,Math.floor(Number(state.inventory.capacity)||20)));
 state.inventory.keepLimit=Math.max(3,Math.min(50,Math.floor(Number(state.inventory.keepLimit)||3)));
 state.inventory.items=Array.isArray(state.inventory.items)?state.inventory.items.filter(i=>i&&typeof i.id==='number'&&typeof i.type==='string'&&Number.isInteger(i.rarity)&&i.rarity>=1&&i.rarity<=30).slice(0,state.inventory.capacity):[];
 const validItems=new Set(state.inventory.items.map(i=>i.id));
 const equippedIds=new Set();
 for(const slots of Object.values(state.equipment))for(const slot of slots){
  if(!validItems.has(slot.itemId)||equippedIds.has(slot.itemId)){slot.itemId=null;continue;}
  const item=state.inventory.items.find(i=>i.id===slot.itemId);
  if(!slot.level||item.rarity>slot.level){slot.itemId=null;continue;}
  equippedIds.add(slot.itemId);
 }
 state.inventory.nextId=Math.max(1,Math.floor(Number(state.inventory.nextId)||1),...state.inventory.items.map(i=>i.id+1));
 const savedDust=state.lunarLuck||{},dustScale=CONSTANTS.LUNAR_DUST.PROGRESS_SCALE;
 const roundDustProgress=progress=>Math.max(0,Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.round(progress*dustScale)))/dustScale;
 state.lunarLuck={
  progress:roundDustProgress(Number(savedDust.progress)||0),
  dust:Math.max(0,Math.floor(Number(savedDust.dust)||0))+Math.floor(Math.max(0,Number(savedDust.fragments)||0)/5),
  claims:Math.max(0,Math.floor(Number(savedDust.claims)||0))
 };
 state.moonKills=Number.isSafeInteger(state.moonKills)&&state.moonKills>=0?Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.moonKills):0;
 state.activeMoon=state.activeMoons[state.activeMoons.length-1];
 state.effects=[];state.claimSummary=null;
 const credit=(amount)=>{const before=state.playerData.shards;state.playerData.shards=Math.min(CONSTANTS.SAFE_NUMBER_CAP,before+Math.max(0,Math.round(amount)));return state.playerData.shards-before;};
 const appState={set:(k,v)=>{state[k]=v;}};
 const localStorage={getItem:()=>state.lastQuestDay,setItem:(_k,v)=>{state.lastQuestDay=v;}};
 let passiveKey='',passiveValue=null;
 class Rules {
 constructor(){Object.assign(this,{_comboClicks:0,_fireStacks:0,_shadowCritStacks:0,_clickCounter:0,_pityClicks:0,_superconductorClicksLeft:0,_firstStrikeUsed:false,_newMoon:true},state.runtime);}
   _getMechanicParamsForActiveMoon(moonId) {
    return getEffectiveMoonParams(state,moonId);
  }


  _calculateAllBonuses() {
    const key=JSON.stringify([state.currentLevel,state.maxSlots,state.playerData.shards,state.moonKills,state.activeMoons,state.moonLevels,state.cloneTargets,state.prestige]);
    if(key!==passiveKey){passiveKey=key;passiveValue=getCombatStats(state,now).passive;}return passiveValue;
  }

  // ============================================================
  // ПРИМЕНЕНИЕ МЕХАНИК ЛУН (ПОЛНАЯ ПЕРЕРАБОТКА)
  // ============================================================

  _applyMoonMechanics(baseDamage, bonuses, isBoss) {
    const mechanics = this._getActiveMechanics();
    let damageMultiplier = 1 + bonuses.totalDamageBonus + (isBoss?getPrestigeSummary(state).bossDamage:0);
    let critChance = Math.max(0, 0.05 + bonuses.totalCritChanceBonus);
    let critDamageMultiplier = 2 + bonuses.totalCritDamageBonus;
    let finalMultiplier = 1; // Применяется в самом конце
    let specialEffect = null;
    let firstStrikeMultiplier = 1;
    
    this._clickCounter++;
    
    // ============================================================
    // 🌙 ОБЫЧНАЯ ЛУНА: Комбо-мастер
    // ============================================================
    if (mechanics.includes('combo')) {
      const params = this._getMechanicParamsForActiveMoon('normal');
      if (params) {
        this._comboClicks++;
        const stacks = Math.min(
          Math.floor(this._comboClicks / params.clicksPerStack), 
          params.maxStacks
        );
        damageMultiplier += stacks * params.bonusPerStack;
        // Комбо НЕ сбрасывается при макс. стеках — только по таймауту бездействия
        // _comboClicks ограничен сверху, чтобы не рос бесконечно
        const maxClicks = params.clicksPerStack * params.maxStacks;
        if (this._comboClicks > maxClicks) {
          this._comboClicks = maxClicks;
        }
      }
    }
    
    // ============================================================
    // 🔥 ОГНЕННАЯ ЛУНА: Накопление жара
    // ============================================================
    if (mechanics.includes('fireStacks')) {
      const params = this._getMechanicParamsForActiveMoon('fire');
      if (params) {
        this._fireStacks = Math.min(this._fireStacks + 1, params.maxStacks * params.clicksPerStack);
        const stacks = Math.floor(this._fireStacks / params.clicksPerStack);
        damageMultiplier += stacks * params.bonusPerStack;
        
        // Визуальный эффект при новом стеке
        if (this._fireStacks % params.clicksPerStack === 0 && this._fireStacks > 0) {
          specialEffect = 'fireStack';
        }
        
        // Уровень 10: шанс сброса после safeStacks
        if (params.maxStacks === Infinity && this._fireStacks > params.safeStacks * params.clicksPerStack) {
          if (Math.random() < params.resetChance) {
            this._fireStacks = params.safeStacks * params.clicksPerStack;
          }
        }
      }
    }
    
    // ============================================================
    // 🌑 ТЕНЕВАЯ ЛУНА: Крит стеки
    // ============================================================
    if (mechanics.includes('shadowCritStacks')) {
      const params = this._getMechanicParamsForActiveMoon('shadow');
      if (params) {
        this._shadowCritStacks++;
        const stacks = Math.min(
          Math.floor(this._shadowCritStacks / params.clicksPerStack), 
          params.maxStacks
        );
        critDamageMultiplier += stacks * params.critDamagePerStack;
        
        // Уровень 5: Первый удар = гарантированный крит
        if (params.firstStrikeCrit && this._firstStrikeUsed === false && this._newMoon) {
          critChance = Math.max(1, critChance);
          this._firstStrikeUsed = true;
          firstStrikeMultiplier = params.firstStrikeMultiplier || 1;
        }
        
        // Уровень 10: при полном стаке +10% к шансу крита
        if (params.fullStackCritChance > 0 && stacks >= params.maxStacks) {
          critChance = critChance + params.fullStackCritChance;
        }
        
        // Тень НЕ сбрасывается при макс. стеках — только по таймауту бездействия
        const maxShadowClicks = params.clicksPerStack * params.maxStacks;
        if (this._shadowCritStacks > maxShadowClicks) {
          this._shadowCritStacks = maxShadowClicks;
        }
      }
    }
    
    // ============================================================
    // 🩸 КРОВАВАЯ ЛУНА: Бонус при низком HP босса
    // ============================================================
    if (mechanics.includes('bloodMoon') && isBoss) {
      const params = this._getMechanicParamsForActiveMoon('blood');
      if (params) {
        const hpRatio = state.moonHP / state.maxHP;
        
        if (hpRatio < params.hpThreshold) {
          damageMultiplier += params.damageBonus;
        }
        
        // Мгновенное убийство
        if (params.executeThreshold > 0 && hpRatio <= params.executeThreshold) {
          damageMultiplier = Math.max(damageMultiplier, state.moonHP / baseDamage + 1); // Гарантированное убийство
        }
      }
    }
    
    // ============================================================
    // ❄️ ЛЕДЯНАЯ ЛУНА: Заморозка + пронзающий удар
    // ============================================================
    if (mechanics.includes('freeze')) {
      const params = this._getMechanicParamsForActiveMoon('ice');
      if (params && params.pierceInterval > 0) {
        if (this._clickCounter % params.pierceInterval === 0) {
          damageMultiplier += params.pierceDamage;
          specialEffect = 'icePierce';
        }
      }
    }
    
    // ============================================================
    // ⚡ ЭЛЕКТРИЧЕСКАЯ ЛУНА: Цепная молния
    // ============================================================
    if (mechanics.includes('chainLightning')) {
      const params = this._getMechanicParamsForActiveMoon('electric');
      if (params) {
        // Уровень 5: pity система (накопление шанса)
        let pityBonus = 0;
        if (params.pityMax > 0) {
          pityBonus = Math.min(this._pityClicks * params.pityBonus, params.pityMax);
        }
        
        const roll = Math.random();
        const effectiveX2 = params.chanceX2 + pityBonus;
        const effectiveX5 = params.chanceX5 + pityBonus;
        const effectiveX10 = params.chanceX10 + pityBonus;
        
        if (roll < effectiveX10) {
          finalMultiplier *= 10;
          specialEffect = 'chainLightning';
          this._pityClicks = 0;
          this._superconductorClicksLeft = params.superconductorClicks || 0;
        } else if (roll < effectiveX5 + effectiveX10) {
          finalMultiplier *= 5;
          specialEffect = 'chainLightning';
          this._pityClicks = 0;
          this._superconductorClicksLeft = params.superconductorClicks || 0;
        } else if (roll < effectiveX2 + effectiveX5 + effectiveX10) {
          finalMultiplier *= 2;
          specialEffect = 'chainLightning';
          this._pityClicks = 0;
          this._superconductorClicksLeft = params.superconductorClicks || 0;
        } else {
          this._pityClicks++;
        }
        
        // Уровень 7: Сверхпроводник - следующие N кликов +50% урона
        if (this._superconductorClicksLeft > 0) {
          damageMultiplier += params.superconductorBonus;
          this._superconductorClicksLeft--;
        }
      }
    }
    
    // ============================================================
    // 👑 ЗОЛОТАЯ ЛУНА: Золотой клик (обрабатывается отдельно)
    // ============================================================
    // (обрабатывается в _onMoonDefeated и при клике)
    
    // ============================================================
    // ✨ КОСМИЧЕСКАЯ ЛУНА: Бонусы уже учтены в _calculateAllBonuses
    // ============================================================
    
    // Применяем базовый урон с множителем
    let finalDamage = Math.max(1, Math.round(baseDamage * damageMultiplier));
    
    // Критический удар
    const critical = rollCritical(critChance,critDamageMultiplier);
    const isCrit = critical.isCrit;
    if (isCrit) {
      finalDamage = Math.round(finalDamage * critical.multiplier);
      finalDamage = Math.round(finalDamage * firstStrikeMultiplier);
      
      // Теневая ур. 7: двойной крит
      if (mechanics.includes('shadowCritStacks')) {
        const params = this._getMechanicParamsForActiveMoon('shadow');
        if (params && params.doubleCritChance > 0 && Math.random() < params.doubleCritChance) {
          finalDamage = Math.round(finalDamage * (1 + critDamageMultiplier / 2));
        }
      }
    }
    
    // Применяем финальный множитель (электрическая)
    finalDamage = Math.round(finalDamage * finalMultiplier);
    
    // Золотой клик (отдельная проверка)
    if (mechanics.includes('goldRush')) {
      const params = this._getMechanicParamsForActiveMoon('gold');
      if (params && params.goldenClickChance > 0) {
        if (Math.random() < params.goldenClickChance) {
          const bonus = params.goldenClickReward * (1 + bonuses.totalShardBonus);
          credit(bonus);
          showToast(`🎁 Золотой клик! +${Math.round(bonus)} 💎`, 'success', 1500);
        }
      }
    }
    
    return { finalDamage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,finalDamage), isCrit, specialEffect };
  }


  _getActiveMechanics() {
    const mechanics = [];
    const activeIds = (state.activeMoons || []).slice(0, state.maxSlots);
    activeIds.forEach(id => {
      const moon = MOON_TYPES[id];
      if (moon && moon.specialMechanic) {
        mechanics.push(moon.specialMechanic);
      }
    });
    return mechanics;
  }

  // ============================================================
  // АКТИВНЫЕ БАФЫ ДЛЯ UI
  // ============================================================

  _generateDailyQuests() {
    const questsByCategory = {};
    for (const [id, q] of Object.entries(QUESTS)) {
      if (!questsByCategory[q.category]) questsByCategory[q.category] = [];
      questsByCategory[q.category].push({ id, ...q });
    }
    
    const newQuests = {};
    ['clicker', 'hunter', 'collector', 'progress', 'moons', 'synergies'].forEach(category => {
      const pool = questsByCategory[category] || [];
      if (pool.length === 0) return;
      const rq = pool[Math.floor(Math.random() * pool.length)];
      newQuests[rq.id] = {
        progress: 0, target: rq.target,
        completed: false, claimed: false, createdAt: Date.now()
      };
    });
    
    const allQuests = Object.entries(QUESTS);
    for (let i = 0; i < 2; i++) {
      const re = allQuests[Math.floor(Math.random() * allQuests.length)];
      if (!newQuests[re[0]]) {
        newQuests[re[0]] = {
          progress: 0, target: re[1].target,
          completed: false, claimed: false, createdAt: Date.now()
        };
      }
    }
    
    appState.set('quests', newQuests);
    updateQuestUI();
  }
  

  updateQuestProgress(type, amount = 1, uniqueKey = null) {
    const quests = state.quests || {};
    let updated = false;
    
    for (const [questId, questState] of Object.entries(quests)) {
      if (questState.claimed) continue;
      const questData = QUESTS[questId];
      if (!questData || questData.type !== type) continue;
      
      if(uniqueKey!==null){const seen=questState.seen||[];if(seen.includes(uniqueKey))continue;questState.seen=[...seen.slice(-31),uniqueKey];}
      const newProgress = Math.min(questState.target, (questState.progress || 0) + amount);
      questState.progress = newProgress;
      
      if (newProgress >= questState.target && !questState.completed) {
        questState.completed = true;
        showToast(`🎯 ${questData.name} выполнен!`, 'success', 2500);
      }
      updated = true;
    }
    
    if (updated) {
      appState.set('quests', { ...quests });
      updateQuestUI();
    }
  }
  

  checkAchievements() {
    const achievements = state.achievements || {};
    let updated = false;
    
    for (const [achId, ach] of Object.entries(ACHIEVEMENTS)) {
      if (!achievements[achId]) achievements[achId] = {};
      
      for (const tier of ach.tiers) {
        if (achievements[achId][tier.level]) continue;
        if (ach.check(state, tier)) {
          achievements[achId][tier.level] = 'unclaimed';
          updated = true;
          showToast(`🏆 ${tier.name}!`, 'success', 3000);
        }
      }
    }
    
    if (updated) {
      appState.set('achievements', { ...achievements });
      updateAchievementUI();
      updateProfileAndLeaders();
    }
  }
  

 }
 const rules=new Rules();
 const day=new Date(now).toDateString();
 if(state.lastQuestDay!==day){rules._generateDailyQuests();state.lastQuestDay=day;}
 const elapsed=Math.max(0,(now-(state.lastActionAt||now))/1000);
 state.tokens=Math.min(CONSTANTS.CLICK_TOKEN_CAPACITY,(state.tokens??0)+elapsed*CONSTANTS.MAX_CLICKS_PER_SECOND);
 state.totalSecondsPlayed+=Math.min(elapsed,30);
 const activity=Math.max(state.lastClickAt||0,state.lastAutoClickAt||0),idle=activity?now-activity:0;
 for(const [id,counter] of [['normal','_comboClicks'],['fire','_fireStacks'],['shadow','_shadowCritStacks']]){
  const timeout=rules._getMechanicParamsForActiveMoon(id)?.resetTimeout||15000;
  const mechanicIdle=id==='normal'?now-Math.max(activity||now,state.lastComboAt||0):idle;
  if(action!=='toggleMoon'&&action!=='setCloneTargets'&&mechanicIdle>=timeout)rules[counter]=0;
 }
 function startMoon(){state.moonSerial++;state.maxHP=getMaxHPForLevel(state.currentLevel);state.moonHP=state.maxHP;
 rules._clickCounter=0;rules._pityClicks=0;rules._firstStrikeUsed=false;rules._newMoon=true;
 const ice=rules._getMechanicParamsForActiveMoon('ice');
 state.bossDuration=CONSTANTS.BOSS_TIMER*(1+(ice?.timerBonus||0))+getPrestigeSummary(state).bossTime;
 state.bossDeadline=state.currentLevel%CONSTANTS.BOSS_INTERVAL===0?now+state.bossDuration*1000:null;}
 if(state.bossDeadline&&now>=state.bossDeadline)startMoon();
 const spend=cost=>{if(!Number.isSafeInteger(cost)||cost<0||state.playerData.shards<cost)throw Error('Недостаточно осколков');state.playerData.shards-=cost;};
  const buyLevels=(max,canBuy,buy)=>{let count=0;do{if(!canBuy())break;buy();count++;}while(max&&count<1000000);if(!count)throw Error('Недостаточно средств или достигнут максимум');return count;};

 const finalDamage=()=>{
  const bonuses=rules._calculateAllBonuses();let multiplier=1+bonuses.totalDamageBonus+(state.currentLevel%CONSTANTS.BOSS_INTERVAL===0?getPrestigeSummary(state).bossDamage:0);
  for(const [id,counter] of [['normal','_comboClicks'],['fire','_fireStacks']]){
   const p=rules._getMechanicParamsForActiveMoon(id);
   if(p)multiplier+=Math.min(p.maxStacks,Math.floor((rules[counter]||0)/p.clicksPerStack))*p.bonusPerStack;
  }
  const blood=rules._getMechanicParamsForActiveMoon('blood');
  if(blood&&state.currentLevel%CONSTANTS.BOSS_INTERVAL===0&&state.moonHP/state.maxHP<blood.hpThreshold)multiplier+=blood.damageBonus;
  return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(getBaseDamage(state)*multiplier)));
 };
 function moonReward(bonuses=rules._calculateAllBonuses()){
  const c=CONSTANTS.MOON_REWARD,boss=state.currentLevel%CONSTANTS.BOSS_INTERVAL===0;
  let reward=Math.max(1,Math.round(Math.floor(c.BASE+state.currentLevel*c.PER_LEVEL+Math.pow(state.currentLevel,c.EXPONENT)*c.GROWTH)*(boss?c.BOSS_MULTIPLIER:1)*(1+bonuses.totalShardBonus)));
  const gold=rules._getMechanicParamsForActiveMoon('gold');if(gold)reward=Math.round(reward*(boss?gold.bossMultiplier:gold.normalMultiplier));
  const normal=rules._getMechanicParamsForActiveMoon('normal');
  if(normal?.shardBonusOnFullStack>0&&rules._comboClicks>=normal.clicksPerStack*normal.maxStacks)reward=Math.round(reward*(1+normal.shardBonusOnFullStack));
  return Math.min(CONSTANTS.SAFE_NUMBER_CAP,reward);
 }
 function hit(damage,isCrit,source,bonuses=rules._calculateAllBonuses()){
  const boss=state.currentLevel%CONSTANTS.BOSS_INTERVAL===0;
  const event={source,damage,isCrit,isBoss:boss,reward:0,level:state.currentLevel,moonSerial:state.moonSerial,ufoIndex:source==='ufo'?Math.max(0,(state.ufoShots||1)-1)%Math.max(1,state.ufoCount):null};
  damage=Math.min(CONSTANTS.SAFE_NUMBER_CAP,damage);event.damage=damage;
  state.moonHP=Math.max(0,state.moonHP-damage);
  if(state.moonHP===0){
   state.moonKills=Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.moonKills+1);
   state.lunarLuck.progress=roundDustProgress(state.lunarLuck.progress+getLunarDustGain(state.currentLevel));
   event.reward=moonReward(bonuses);
   if(source==='ufo')event.reward=Math.max(1,Math.floor(event.reward*getUfoBonuses(state,rules).rewardMultiplier));
   event.reward=credit(event.reward);rules.updateQuestProgress('shard',event.reward);
   if(boss){state.bossKills++;rules.updateQuestProgress('bossKill',1);}
   if(!state.levelLocked&&state.currentLevel<CONSTANTS.MAX_PLAYER_LEVEL){state.currentLevel=Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.currentLevel+1);rules.updateQuestProgress('level',1);}
   state.maxLevel=Math.max(state.maxLevel,state.currentLevel);state.runMaxLevel=Math.max(state.runMaxLevel,state.currentLevel);
   startMoon();
  }
  state.effects.push(event);
 }
 let echoBudget=CONSTANTS.ECHO.MAX_HITS_PER_ACTION;
 function drainEchoes(){
  while(echoBudget>0&&state.echoQueue.length){
   const burst=state.echoQueue[0];hit(burst.damage,burst.isCrit,'echo');burst.count--;echoBudget--;
   if(!burst.count)state.echoQueue.shift();
  }
 }
 drainEchoes();
 function registerUfoClick(shotAt){
  const steps=state.ufoComboRelay?2:1;
  for(const [id,counter] of [['normal','_comboClicks'],['fire','_fireStacks'],['shadow','_shadowCritStacks']]){
   const p=rules._getMechanicParamsForActiveMoon(id);if(!p)continue;
   rules[counter]=Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.min(p.maxStacks*p.clicksPerStack,(rules[counter]||0)+steps));
   if(id==='fire'&&p.maxStacks===Infinity&&rules[counter]>p.safeStacks*p.clicksPerStack&&Math.random()<p.resetChance)rules[counter]=p.safeStacks*p.clicksPerStack;
  }
  state.lastAutoClickAt=shotAt;state.lastComboAt=shotAt;
  state.clickCount=Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.clickCount+1);state.runClickCount=Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.runClickCount+1);rules.updateQuestProgress('click',1);
 }
 function ufoInterval(){return Math.max(CONSTANTS.UFO.MIN_INTERVAL,Math.round((CONSTANTS.UFO.BASE_INTERVAL-Math.max(0,state.ufoLevel-1)*CONSTANTS.UFO.INTERVAL_REDUCTION)*(1-getUfoBonuses(state,rules).haste)));}
 // Only server elapsed time permits shots; frequent syncs do not create extra damage.
 if(state.ufoLevel>0){
  if(!state.ufoLastShotAt||action==='load'||now-(state.lastActionAt||now)>CONSTANTS.UFO.MAX_IDLE_MS)state.ufoLastShotAt=now;
  else{
   const interval=ufoInterval()/Math.max(1,state.ufoCount);
   const shots=Math.min(CONSTANTS.UFO.MAX_SHOTS_PER_ACTION,Math.max(0,Math.floor((now-state.ufoLastShotAt)/interval)));
   for(let i=0;i<shots;i++){
    registerUfoClick(state.ufoLastShotAt+(i+1)*interval);
    const buff=getUfoBonuses(state,rules);state.ufoShots=(state.ufoShots||0)+1;
    const critical=rollCritical(buff.critChance,buff.critMultiplier),crit=critical.isCrit,chain=buff.chainEvery&&state.ufoShots%buff.chainEvery===0;
    const damage=Math.max(1,Math.round(finalDamage()*CONSTANTS.UFO.DAMAGE_MULTIPLIER*(1+buff.damage)*critical.multiplier*(chain?buff.chainMultiplier:1)));
    hit(damage,crit,'ufo');
    const gained=credit(state.clickCrystalLevel||0);if(gained)rules.updateQuestProgress('shard',gained);
   }
   state.ufoLastShotAt+=shots*interval;
  }
 }
 if(action==='click'){
  const count=payload.count;
  if(!Number.isInteger(count)||count<1||count>CONSTANTS.CLICK_BURST)throw Error('Некорректное количество кликов');
  if(count>Math.floor(state.tokens))throw Object.assign(Error('Слишком много кликов. Максимум 18 в секунду.'),{code:'RATE_LIMIT'});
  state.tokens-=count;state.lastClickAt=now;
  for(let i=0;i<count;i++){
   const boss=state.currentLevel%CONSTANTS.BOSS_INTERVAL===0,bonuses=rules._calculateAllBonuses();
   const result=rules._applyMoonMechanics(getBaseDamage(state),bonuses,boss);
   state.clickCount=Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.clickCount+1);state.runClickCount=Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.runClickCount+1);rules.updateQuestProgress('click',1);
   hit(result.finalDamage,result.isCrit,'manual',bonuses);
   const gained=credit(state.clickCrystalLevel||0);if(gained)rules.updateQuestProgress('shard',gained);
   const echo=getPrestigeSummary(state),repeats=rollEchoRepeats(echo.echoChance);
   if(repeats){state.echoQueue.push({count:repeats,damage:Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(result.finalDamage*echo.echoDamage))),isCrit:result.isCrit});drainEchoes();}
  }
 } else if(action==='unlockEquipSlot'||action==='upgradeEquipSlot'||action==='equipItem'||action==='unequipItem'){
  const moonId=payload.moonId,slotIndex=payload.slotIndex;
  if(!Object.hasOwn(MOON_TYPES,moonId)||!Number.isInteger(slotIndex)||slotIndex<0||slotIndex>=3)throw Error('Неверный слот луны');
  if(!state.ownedMoons.includes(moonId))throw Error('Сначала откройте эту луну');
  const moonOrder=Object.keys(MOON_TYPES).indexOf(moonId);
  const slots=state.equipment[moonId]||(state.equipment[moonId]=Array.from({length:3},()=>({level:0,itemId:null})));
  const slot=slots[slotIndex];
  if(action==='unlockEquipSlot'){
   if(slot.level)throw Error('Слот уже открыт');
   const cost=Math.ceil([5,15,35][slotIndex]*Math.pow(1.5,moonOrder));
   if(state.lunarLuck.dust<cost)throw Error('Недостаточно Лунной пыли');
   state.lunarLuck.dust-=cost;slot.level=1;
  }else if(action==='upgradeEquipSlot'){
   if(!slot.level||slot.level>=30)throw Error('Улучшение слота недоступно');
   const cost=Math.ceil(15*Math.pow(2.5,slot.level-1)*Math.pow(1.8,moonOrder));
   if(state.lunarLuck.dust<cost)throw Error('Недостаточно Лунной пыли');
   state.lunarLuck.dust-=cost;slot.level++;
  }else if(action==='unequipItem'){
   if(slot.itemId===null)throw Error('Слот пуст');
   slot.itemId=null;
  }else{
   if(!slot.level||slot.itemId!==null)throw Error('Слот закрыт или занят');
   const item=state.inventory.items.find(i=>i.id===payload.id);
   if(!item||item.rarity>slot.level)throw Error('Предмет не подходит по редкости');
   if(Object.values(state.equipment).some(m=>m.some(x=>x.itemId===item.id)))throw Error('Предмет уже экипирован');
   slot.itemId=item.id;
  }
 } else if(action==='lockItem'||action==='keepItem'||action==='mergeItems'||action==='salvageItem'){
  const inv=state.inventory,items=inv.items;
  const item=items.find(i=>i.id===payload.id);
  if(!item)throw Error('Предмет не найден');
  if(action==='lockItem'){item.locked=!item.locked;}
  else if(action==='keepItem'){
   if(!item.keep&&items.filter(i=>i.keep).length>=inv.keepLimit)throw Error('Лимит сохраняемых предметов');
   item.keep=!item.keep;
  }else if(action==='salvageItem'){
   if(item.locked)throw Error('Сначала снимите защиту с предмета');
   if(Object.values(state.equipment).some(m=>m.some(x=>x.itemId===item.id)))throw Error('Сначала снимите предмет с луны');
   inv.items=items.filter(i=>i.id!==item.id);
   state.lunarLuck.dust+=2**(item.rarity-1);
  }else{
   const other=items.find(i=>i.id===payload.otherId);
   if(!other||other.id===item.id||other.type!==item.type||other.rarity!==item.rarity)throw Error('Для объединения нужны два одинаковых предмета одной редкости');
   if(item.locked||other.locked)throw Error('Сначала снимите защиту с обоих предметов');
   if(Object.values(state.equipment).some(m=>m.some(x=>x.itemId===item.id||x.itemId===other.id)))throw Error('Сначала снимите предметы с лун');
   if(item.rarity>=30)throw Error('Достигнут предел редкости');
   item.rarity++;item.keep=false;inv.items=items.filter(i=>i.id!==other.id);
  }
 } else if(action==='claimLunarLuck'){
  const luck=state.lunarLuck,reward=Math.floor(luck.progress/100);
  if(reward===0)throw Error('Шкала Лунной пыли ещё не заполнена');
  const previousDrops=Math.floor(luck.claims/3);
  luck.progress=roundDustProgress(luck.progress-reward*100);
  luck.dust+=reward;
  luck.claims+=reward;
  const types=['moonstone','orbit','comet','starlight'];
  const drops=Math.floor(luck.claims/3);
  for(let i=previousDrops;i<drops&&state.inventory.items.length<state.inventory.capacity;i++){
   const type=types[i%types.length];
   state.inventory.items.push({id:state.inventory.nextId++,type,rarity:1,locked:false,keep:false});
  }
 } else if(action==='spinWheel'){
  if(trusted.canSpinWheel!==true)throw Object.assign(Error('Требуется подтверждённая игровая сессия'),{code:'FORBIDDEN'});
  const bet=payload.bet,choice=payload.choice,config=CONSTANTS.WHEEL,index=trusted.wheelIndex;
  const before=state.playerData.shards,maxBet=Math.floor(before*config.MAX_BET_FRACTION);
  if(!Number.isSafeInteger(bet)||bet<1||bet>maxBet)throw Error('Максимальная ставка — '+(config.MAX_BET_FRACTION*100)+'% баланса. Минимальный баланс для вращения: '+Math.ceil(1/config.MAX_BET_FRACTION)+' 💎.');
  if(!['red','black','zero'].includes(choice))throw Error('Выберите красное, чёрное или зеро');
  if(!Number.isInteger(index)||index<0||index>=config.SECTORS.length)throw Error('Не удалось определить сектор');
  if(state.wheelResult&&now-state.wheelResult.at<config.COOLDOWN_MS)throw Object.assign(Error('Дождитесь окончания вращения'),{code:'RATE_LIMIT'});
  const sector=config.SECTORS[index],multiplier=sector===choice?(choice==='zero'?36:2):0;
  const payout=Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.floor(bet*multiplier));
  state.playerData.shards=Math.min(CONSTANTS.SAFE_NUMBER_CAP,before-bet+payout);
  state.wheelResult={at:now,index,bet,choice,sector,multiplier,payout,balanceBefore:before,balanceAfter:state.playerData.shards,delta:state.playerData.shards-before};
  const economy=state.wheelEconomy||{},delta=state.wheelResult.delta,cap=CONSTANTS.SAFE_NUMBER_CAP;
  state.wheelEconomy={pressure:0,spins:Math.min(cap,(economy.spins||0)+1),wagered:Math.min(cap,(economy.wagered||0)+bet),payouts:Math.min(cap,(economy.payouts||0)+payout),totalWon:Math.min(cap,(economy.totalWon||0)+Math.max(0,delta)),totalLost:Math.min(cap,(economy.totalLost||0)+Math.max(0,-delta)),houseNet:Math.max(-cap,Math.min(cap,(economy.houseNet||0)-delta))};
 } else if(action==='buyClickCrystal'){
  buyLevels(payload.max===true,()=>state.playerData.shards>=getClickCrystalCost(state.clickCrystalLevel),()=>{spend(getClickCrystalCost(state.clickCrystalLevel));state.clickCrystalLevel++;rules.updateQuestProgress('crystalUpgrade');});
 } else if(action==='setCloneTargets'){
  if(!state.activeMoons.includes('clone'))throw Error('Активируйте Клона');
  const targets=payload.targets,count=getCloneCopyLimit(state);
  if(!Array.isArray(targets)||!targets.length||targets.length>count||targets.some(id=>id==='clone'||!state.activeMoons.includes(id)||!state.ownedMoons.includes(id)))throw Error('Выберите активные оригиналы');
  const changed=JSON.stringify(state.cloneTargets)!==JSON.stringify(targets);
  state.cloneTargets=[...targets];if(changed)rules.updateQuestProgress('cloneTune');
 } else if(action==='buyDamage'){
  const level=state.playerData.click_damage_level;
  if(level>=CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL)throw Error('Максимальный уровень');
  buyLevels(payload.max===true,()=>state.playerData.click_damage_level<CONSTANTS.LIMITS.MAX_CLICK_DAMAGE_LEVEL&&state.playerData.shards>=getClickUpgradeCost(state.playerData.click_damage_level),()=>{spend(getClickUpgradeCost(state.playerData.click_damage_level));state.playerData.click_damage_level++;state.playerData.click_damage=Math.min(CONSTANTS.SAFE_NUMBER_CAP,state.playerData.click_damage+CONSTANTS.CLICK_DAMAGE_UPGRADE_VALUE);});
 } else if(action==='buyPrestige'){
  if(!Object.hasOwn(PRESTIGE_UPGRADES,payload.id))throw Error('Неизвестное улучшение престижа');
  const def=PRESTIGE_UPGRADES[payload.id],p=state.prestige,level=p.upgrades?.[payload.id]||0;
  if(level>=def.maxLevel)throw Error('Улучшение уже куплено');
  buyLevels(payload.max===true&&def.maxLevel!==1,()=>{const l=p.upgrades?.[payload.id]||0;return l<def.maxLevel&&(p.coins||0)>=getPrestigeUpgradeCost(payload.id,l);},()=>{const l=p.upgrades?.[payload.id]||0;p.coins-=getPrestigeUpgradeCost(payload.id,l);p.upgrades=p.upgrades||{};p.upgrades[payload.id]=l+1;if(payload.id==='orbit')state.maxSlots=Math.min(getSlotLimit(state),state.maxSlots+1);if(payload.id==='hunter'&&state.bossDeadline){state.bossDeadline+=def.time*1000;state.bossDuration=(state.bossDuration||CONSTANTS.BOSS_TIMER)+def.time;}});
 } else if(action==='buyUfo'){
  if(state.currentLevel<CONSTANTS.UFO.UNLOCK_LEVEL)throw Error('Тарелка доступна с '+CONSTANTS.UFO.UNLOCK_LEVEL+' уровня');
  if(state.ufoLevel>=CONSTANTS.UFO.MAX_LEVEL)throw Error('Тарелка улучшена полностью');
  buyLevels(payload.max===true,()=>state.ufoLevel<CONSTANTS.UFO.MAX_LEVEL&&state.playerData.shards>=Math.floor(CONSTANTS.UFO.BASE_COST*Math.pow(CONSTANTS.UFO.COST_MULTIPLIER,state.ufoLevel)),()=>{spend(Math.floor(CONSTANTS.UFO.BASE_COST*Math.pow(CONSTANTS.UFO.COST_MULTIPLIER,state.ufoLevel)));state.ufoLevel++;state.ufoCount=Math.max(1,state.ufoCount);state.ufoLastShotAt=now;rules.updateQuestProgress('ufoUpgrade');});
 } else if(action==='buyUfoComboRelay'){
  if(state.ufoComboRelay)throw Error('Комбо-ретранслятор уже куплен');
  if(!state.ownedMoons.includes('electric'))throw Error('Сначала купите Электрическую луну');
  if(!state.ufoLevel)throw Error('Сначала купите тарелку');
  spend(CONSTANTS.UFO.COMBO_RELAY_COST);state.ufoComboRelay=true;
 } else if(action==='buyUfoUnit'){
  if(!state.ufoLevel)throw Error('Сначала купите первую тарелку');
  if(state.ufoCount>=state.ownedMoons.length)throw Error('Купите ещё одну луну, чтобы открыть место для тарелки');
  buyLevels(payload.max===true,()=>state.ufoCount<state.ownedMoons.length&&state.playerData.shards>=Math.floor(CONSTANTS.UFO.UNIT_BASE_COST*Math.pow(CONSTANTS.UFO.UNIT_COST_MULTIPLIER,state.ufoCount-1)),()=>{spend(Math.floor(CONSTANTS.UFO.UNIT_BASE_COST*Math.pow(CONSTANTS.UFO.UNIT_COST_MULTIPLIER,state.ufoCount-1)));state.ufoCount++;state.ufoLastShotAt=now;});
 } else if(action==='buySlot'){
  if(state.maxSlots>=getSlotLimit(state))throw Error('Все слоты открыты');buyLevels(payload.max===true,()=>state.maxSlots<getSlotLimit(state)&&state.playerData.shards>=getSlotUpgradeCost(state.maxSlots-getPrestigeSummary(state).extraSlots),()=>{spend(getSlotUpgradeCost(state.maxSlots-getPrestigeSummary(state).extraSlots));state.maxSlots++;});
 } else if(action==='buyMoon'||action==='upgradeMoon'){
  const moon=MOON_TYPES[payload.id];if(!moon)throw Error('Неизвестная луна');
  if(action==='buyMoon'){
   if(state.ownedMoons.includes(moon.id))throw Error('Луна уже куплена');
   const access=getMoonPurchaseAccess(state,moon.id);
   if(access.requiredMoon)throw Error('Сначала купите луну «'+MOON_TYPES[access.requiredMoon].name+'»');
   if(!access.levelUnlocked)throw Error('Нужен рекорд текущего забега: '+moon.unlockLevel);
   spend(moon.cost);state.ownedMoons.push(moon.id);state.moonLevels[moon.id]=1;rules.updateQuestProgress('moonBuy');
  }else{
   const level=state.moonLevels[moon.id],cloneUpgrades=state.prestige?.upgrades?.cloneCopies||0,limit=getMoonLevelLimit(moon.id,cloneUpgrades);
   if(!state.ownedMoons.includes(moon.id)||!level||level>=limit)throw Error('Улучшение недоступно');
   const price=()=>getMoonUpgradeCostForLevel(moon.id,state.moonLevels[moon.id],cloneUpgrades);
   buyLevels(payload.max===true,()=>state.moonLevels[moon.id]<limit&&state.playerData.shards>=price(),()=>{spend(price());state.moonLevels[moon.id]++;rules.updateQuestProgress('moonUpgrade');});
  }
 } else if(action==='toggleMoon'){
  if(!state.ownedMoons.includes(payload.id))throw Error('Луна не куплена');
  const i=state.activeMoons.indexOf(payload.id);
  if(i>=0){if(state.activeMoons.length<=1)throw Error('Нужна хотя бы одна луна');state.activeMoons.splice(i,1);}
  else if(state.activeMoons.length<state.maxSlots)state.activeMoons.push(payload.id);else {state.activeMoons.shift();state.activeMoons.push(payload.id);}
  state.activeMoon=state.activeMoons[state.activeMoons.length-1];
  rules.updateQuestProgress('moonSwitch');
  const elements=state.activeMoons.filter(id=>['blood','fire','ice','electric','shadow','gold','cosmic'].includes(id));
  if(elements.length>=2)rules.updateQuestProgress('synergy',1,[...elements].sort().join(':'));
  if(payload.id==='clone'&&state.activeMoons.includes('clone')&&!state.cloneTargets.length)state.cloneTargets=state.activeMoons.filter(id=>id!=='clone').slice(0,getCloneCopyLimit(state));
 } else if(action==='lock'){state.levelLocked=!state.levelLocked;
 } else if(action==='rollback'||action==='rollbackFive'){if(state.currentLevel>1){state.currentLevel=Math.max(1,state.currentLevel-(action==='rollbackFive'?CONSTANTS.ROLLBACK_LEVELS:1));startMoon();}
  } else if(action==='jumpToLevel'){
   const target=payload.level;
   if(!Number.isSafeInteger(target)||target<1||target>state.runMaxLevel)throw Error('Укажите открытый уровень от 1 до '+state.runMaxLevel);
   if(target===state.currentLevel)throw Error('Вы уже на этом уровне');
   state.currentLevel=target;startMoon();
  } else if(action==='returnToRecord'){
  const target=state.runMaxLevel;if(!Number.isSafeInteger(target)||target<=state.currentLevel)throw Error('Вы уже на последнем достигнутом уровне этого забега');
  state.currentLevel=target;startMoon();
 } else if(action==='claimAllQuests'){
  let count=0,reward=0;
  for(const [id,q]of Object.entries(state.quests||{})){
   const def=QUESTS[id];if(!def||!q.completed||q.claimed)continue;
   q.claimed=true;reward+=credit(getQuestPayout(def,state).total);count++;
  }
  if(!count)throw Error('Нет доступных наград квестов');
  state.claimSummary={kind:'quests',count,reward};
 } else if(action==='claimAllAchievements'){
  rules.checkAchievements();let count=0,reward=0,claimed;
  do{
   claimed=0;
   for(const [id,def]of Object.entries(ACHIEVEMENTS))for(const tier of def.tiers){
    if(state.achievements[id]?.[tier.level]!=='unclaimed')continue;
    state.achievements[id][tier.level]='claimed';reward+=credit(getProgressReward(tier.reward,state));count++;claimed++;
   }
   if(claimed)rules.checkAchievements();
  }while(claimed);
  if(!count)throw Error('Нет доступных наград достижений');
  state.claimSummary={kind:'achievements',count,reward};
 } else if(action==='claimQuest'){
  const q=state.quests[payload.id],def=QUESTS[payload.id];
  if(!q||!def||!q.completed||q.claimed)throw Error('Награда недоступна');
  q.claimed=true;credit(getQuestPayout(def,state).total);
 } else if(action==='claimAchievement'){
  rules.checkAchievements();const def=ACHIEVEMENTS[payload.id],tier=def?.tiers.find(t=>t.level===payload.tier);
  if(!tier||state.achievements[payload.id]?.[payload.tier]!=='unclaimed')throw Error('Награда недоступна');
  state.achievements[payload.id][payload.tier]='claimed';credit(getProgressReward(tier.reward,state));
 } else if(!['load','sync'].includes(action))throw Error('Неизвестное действие');
 rules.checkAchievements();
 state.finalDamage=finalDamage();state.moonReward=moonReward();
 state.ufoDamage=state.ufoLevel?Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(state.finalDamage*CONSTANTS.UFO.DAMAGE_MULTIPLIER*(1+getUfoBonuses(state,rules).damage)))):0;
 state.ufoMoonReward=state.ufoLevel?Math.max(1,Math.floor(state.moonReward*getUfoBonuses(state,rules).rewardMultiplier)):0;
 state.ufoInterval=state.ufoLevel?ufoInterval():0;
 state.ufoNextShotAt=state.ufoLevel?state.ufoLastShotAt+state.ufoInterval/Math.max(1,state.ufoCount):null;
 bankMilestones();
 state.prestigeSummary=getPrestigeSummary(state);
 state.finalCritChance=Math.max(0,0.05+rules._calculateAllBonuses().totalCritChanceBonus);
 const shadow=rules._getMechanicParamsForActiveMoon('shadow');
 if(shadow?.fullStackCritChance>0&&rules._shadowCritStacks>=shadow.clicksPerStack*shadow.maxStacks)state.finalCritChance+=shadow.fullStackCritChance;
 state.echoPending=state.echoQueue.reduce((n,b)=>Math.min(CONSTANTS.SAFE_NUMBER_CAP,n+b.count),0);
 state.gameCompleted=false;
 state.runtime=Object.fromEntries(Object.keys(rules).map(k=>[k,rules[k]]));
 state.lastActionAt=now;state.testMode=false;
 return state;
}
