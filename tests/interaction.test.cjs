const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/modules/game/secure-game.js'),'utf8').replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'');
const {getBaseDamage,getPrestigeSummary}=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/core/constants.js'),'utf8').replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'')+'\n({getBaseDamage,getPrestigeSummary});');
function setup(){
 let now=900000,perf=10000,calls=[],ticks=[],hpUpdates=0,buffUpdates=0,nextTimer=0;
 const timeouts=new Map();
 const state={moonHP:100,maxHP:100,currentLevel:1,playerData:{click_damage:10,click_damage_level:0,shards:0}};
 const snapshot={...state,lastClickAt:999000,runtime:{_comboClicks:10}};
 const result=()=>({serverNow:now+100000,state:structuredClone(snapshot)});
 const engine={combat:{},destroy(){},recalcMoonBonuses(){},_comboClicks:0,
 _calculateAllBonuses:()=>({totalDamageBonus:0}),_getMechanicParamsForActiveMoon:()=>null,
 _updateBuffsDisplay(){buffUpdates++;},_getActiveBuffs(){return[{isTemporary:true,timeLeft:this._comboClicks>0?Math.max(0,Math.ceil((10000-(now-this._lastActivityTime))/1000)):null}];}};
 const context={getBaseDamage,getPrestigeSummary,fortuneWheel:{bind(){},connect(){},disconnect(){}},gameAdmin:{connect:()=>Promise.resolve(),disconnect(){}},radio:{connect:()=>Promise.resolve(),disconnect(){}},gameEngine:engine,state,appState:{setMany:s=>Object.assign(state,s),set:(k,v)=>state[k]=v},CONSTANTS:{PRESTIGE:{COIN_EVERY:20},SAFE_NUMBER_CAP:Number.MAX_SAFE_INTEGER,MAX_CLICKS_PER_SECOND:12,CLICK_BURST:12,BOSS_TIMER:30,BOSS_INTERVAL:10,UPGRADE_COSTS:{clickDamage:{base:60,multiplier:1.22}},LIMITS:{MAX_CLICK_DAMAGE_LEVEL:200}},db:{action(action,payload){calls.push({action,payload});if(action==='load')return Promise.resolve(result());return new Promise((resolve,reject)=>calls.at(-1).settle={resolve,reject});}},document:{getElementById:()=>null},animations:{playClickVisualFeedback(){}},audio:{click(){},purchase(){}},showToast(){},updateUI(){},updateHPBar(){hpUpdates++;},updateShopUI(){},updateProfileAndLeaders(){},updateQuestAndAchievementUI(){},updateTimerBar(){},updateLiveCombatProfile(){},setInterval(fn,ms){ticks.push({fn,ms});return ticks.length;},clearInterval(){},setTimeout(fn,ms){const id=++nextTimer;timeouts.set(id,{fn,ms});return id;},clearTimeout(id){timeouts.delete(id);},performance:{now:()=>perf},Date:{now:()=>now},console,Math};
 vm.createContext(context);vm.runInContext(source,context);
 return{context,engine,state,calls,result,ticks,runClickTimer(){const timer=[...timeouts.values()].find(t=>t.ms===120);assert.ok(timer);timer.fn();},get hpUpdates(){return hpUpdates;},get buffUpdates(){return buffUpdates;},advance(ms){now+=ms;perf+=ms;}};
}
test('inventory skips closed panels and rebuilds only when displayed data changes',async()=>{
 const s=setup();
 let hidden=true,selected=false,rebuilds=0,removed=0;
 const classList={contains:token=>token==='hidden'?hidden:selected};
 const picker={remove(){removed++;}};
 const elements={profilePanel:{classList},inventoryTabContent:{classList},moonEquipFloatingInventory:picker};
 s.context.document.getElementById=id=>elements[id]||null;
 s.context.renderItemInventory=()=>{rebuilds++;};
 s.context.renderMoonEquipment=()=>{rebuilds++;};
 await s.engine.init();
 assert.equal(rebuilds,0);
 hidden=false;
 s.engine.refreshInventory();
 assert.equal(rebuilds,0);
 selected=true;
 s.engine.refreshInventory();
 assert.equal(rebuilds,2);
 s.state.inventory={capacity:20,items:[]};
 s.engine.refreshInventory();
 for(let i=0;i<18;i++){
  s.state.inventory=structuredClone(s.state.inventory);
  s.state.lunarLuck={progress:i,dust:0};
  s.engine.refreshInventory();
 }
 assert.equal(rebuilds,6);
 s.state.lunarLuck.dust++;
 s.engine.refreshInventory();
 assert.equal(rebuilds,8);
 vm.runInContext("chosenEquipSlot={moonId:'normal',slotIndex:0}",s.context);
 s.engine.closeEquipmentPicker();
 assert.equal(removed,1);
 assert.equal(vm.runInContext('chosenEquipSlot',s.context),null);
});
test('auto-click reads moon geometry only when a hit can enter the queue',async()=>{
 const s=setup();
 let reads=0;
 s.context.document.getElementById=id=>id==='moonWrapper'?{getBoundingClientRect(){reads++;return {left:10,top:10,width:20,height:20};},addEventListener(){}}:null;
 await s.engine.init();
 s.engine.activateAutoClick();
 const step=s.ticks.find(t=>t.fn.name==='autoClickStep').fn;
 step();
 for(let i=0;i<4;i++){s.advance(19);step();}
 assert.equal(reads,1);
 s.advance(19);step();
 assert.equal(reads,2);
});
test('combo uses server last-click time corrected for clock skew and ticks while idle',async()=>{
 const s=setup();await s.engine.init();assert.equal(s.engine._lastActivityTime,899000);assert.equal(s.engine._getActiveBuffs()[0].timeLeft,9);
 s.advance(3000);const tick=s.ticks.find(t=>t.ms===250).fn;tick();assert.equal(s.engine._getActiveBuffs()[0].timeLeft,6);assert.ok(s.buffUpdates>=2);
 s.advance(6000);tick();assert.equal(s.calls.at(-1).action,'sync');
});
test('HP responds immediately before network confirmation without changing authoritative state',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});assert.equal(s.engine._previewDamage,10);assert.equal(s.state.moonHP,100);assert.equal(s.calls.at(-1).action,'load');assert.ok(s.hpUpdates>0);s.runClickTimer();assert.equal(s.calls.at(-1).action,'click');
 const response=s.result();response.state.moonHP=90;s.calls.at(-1).settle.resolve(response);await new Promise(setImmediate);
 assert.equal(s.state.moonHP,90);assert.equal(s.engine._previewDamage,0);
});
test('rejected hits remove only their visual prediction',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});s.runClickTimer();s.calls.at(-1).settle.reject(Error('offline'));await new Promise(setImmediate);
 assert.equal(s.engine._previewDamage,0);assert.equal(s.state.moonHP,100);
});
test('rapid manual hits share one packet and take priority over background sync',async()=>{
 const s=setup();await s.engine.init();
 const heartbeat=s.ticks.find(t=>t.ms===20000).fn;
 s.engine.handleClick({});s.advance(100);s.engine.handleClick({});
 heartbeat();
 assert.deepEqual(s.calls.map(call=>call.action),['load']);
 s.runClickTimer();heartbeat();
 assert.deepEqual(s.calls.map(call=>call.action),['load','click']);
 assert.equal(s.calls.at(-1).payload.count,2);
 s.calls.at(-1).settle.resolve(s.result());await new Promise(setImmediate);
 heartbeat();heartbeat();
 assert.deepEqual(s.calls.map(call=>call.action),['load','click','sync']);
 s.engine.destroy();
});
test('rapid kills show one total reward and limit combat effects for locked and advancing levels',async()=>{
 for(const locked of [true,false]){
  const s=setup();await s.engine.init();
  const rewards=[],numbers=[],shots=[];
  let geometryReads=0;
  s.context.document.getElementById=id=>id==='moonWrapper'?{
   getBoundingClientRect(){geometryReads++;return {x:0,y:0,width:100,height:100};}
  }:null;
  Object.assign(s.context.animations,{
   showMoonReward:amount=>rewards.push(amount),
   showDamageNumber:(_x,_y,damage,crit)=>numbers.push({damage,crit}),
   playUfoShot:index=>shots.push(index)
  });
  s.context.audio.shoot=()=>{};
  s.engine.handleClick({});s.runClickTimer();
  const response=s.result();
  Object.assign(response.state,{levelLocked:locked,currentLevel:locked?1:19,moonKills:18,moonSerial:19,
   effects:Array.from({length:18},(_,i)=>({source:'ufo',damage:i+1,isCrit:i%2===1,reward:10,ufoIndex:i%2}))});
  s.calls.at(-1).settle.resolve(response);await new Promise(setImmediate);
  const visualTick=s.ticks.find(t=>t.ms===135).fn;
  visualTick();visualTick();visualTick();
  assert.deepEqual(rewards,[180]);
  assert.deepEqual(shots,[1]);
  assert.deepEqual(numbers,[{damage:18,crit:true},{damage:17,crit:false}]);
  assert.equal(geometryReads,1);
  assert.equal(s.state.currentLevel,locked?1:19);
  assert.equal(s.state.moonKills,18);
  s.engine.destroy();
 }
});
test('slow network keeps one click request in flight and preserves later hit previews',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});s.runClickTimer();for(let i=0;i<5;i++){s.advance(100);s.engine.handleClick({});}
 assert.equal(s.calls.filter(c=>c.action==='click').length,1);assert.equal(s.engine._previewDamage,60);
 const response=s.result();response.state.moonHP=90;s.calls.at(-1).settle.resolve(response);await new Promise(setImmediate);
 assert.equal(s.engine._previewDamage,50);assert.equal(s.state.moonHP,90);
 s.engine.destroy();assert.equal(s.engine._previewDamage,0);
});

test('temporary stack resets cannot make predicted HP rebound on confirmation',async()=>{
 const s=setup();await s.engine.init();s.engine._calculateAllBonuses=()=>({totalDamageBonus:0.1});s.engine._comboClicks=100;s.engine._fireStacks=500;
 s.engine._getMechanicParamsForActiveMoon=()=>({clicksPerStack:1,maxStacks:100,bonusPerStack:1});s.engine.handleClick({});
 const predicted=s.state.moonHP-s.engine._previewDamage;assert.equal(predicted,89);s.runClickTimer();
 const response=s.result();response.state.moonHP=89;s.calls.at(-1).settle.resolve(response);await new Promise(setImmediate);assert.equal(s.state.moonHP,89);assert.equal(s.engine._previewDamage,0);
});
test('purchases wait until every earlier click packet is acknowledged',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});s.runClickTimer();s.advance(100);s.engine.handleClick({});s.advance(100);s.engine.handleClick({});
 const purchase=s.engine.buyClickDamage();s.calls.at(-1).settle.resolve(s.result());await new Promise(setImmediate);
 assert.equal(s.calls.at(-1).action,'click');assert.equal(s.calls.at(-1).payload.count,2);assert.equal(s.calls.some(c=>c.action==='buyDamage'),false);
 s.calls.at(-1).settle.resolve(s.result());await new Promise(setImmediate);assert.equal(s.calls.at(-1).action,'buyDamage');s.calls.at(-1).settle.resolve(s.result());await purchase;
});
test('older acknowledgements cannot replace a newer HP state',async()=>{
 const s=setup();await s.engine.init();s.context.newer=s.result();s.context.newer.revision=3;s.context.newer.state.moonHP=60;vm.runInContext('apply(newer)',s.context);
 s.context.older=s.result();s.context.older.revision=2;s.context.older.state.moonHP=90;vm.runInContext('apply(older)',s.context);assert.equal(s.state.moonHP,60);
});

test('new quest and achievement completions notify once with a temporary duration',async()=>{
 const s=setup();s.context.QUESTS={qa:{name:'QA quest'}};s.context.ACHIEVEMENTS={qa:{tiers:[{level:'bronze',name:'QA achievement'}]}};const notices=[];s.context.showToast=(...args)=>notices.push(args);await s.engine.init();
 s.context.result=s.result();s.context.result.state.quests={qa:{completed:true}};s.context.result.state.achievements={qa:{bronze:'unclaimed'}};vm.runInContext('apply(result)',s.context);vm.runInContext('apply(result)',s.context);assert.equal(notices.length,2);assert.ok(notices.every(n=>n[2]===3500));
});

test('cosmic flat damage is included in immediate hit prediction without changing purchased damage',async()=>{
 const s=setup();await s.engine.init();s.state.currentLevel=100;s.state.activeMoons=['cosmic'];s.state.moonLevels={cosmic:1};
 s.engine.handleClick({});assert.equal(s.engine._previewDamage,1010);assert.equal(s.state.playerData.click_damage,10);s.engine.destroy();
});

test('empty ascension cannot invoke native confirmation or ascend with stale summary',async()=>{
 const s=setup();await s.engine.init();let confirmations=0;s.context.confirm=()=>{confirmations++;return false;};
 s.state.prestigeSummary={pendingCoins:999};s.engine.ascend();assert.equal(confirmations,0);assert.equal(s.calls.filter(c=>c.action==='ascend').length,0);
 s.state.runMaxLevel=20;s.engine.ascend();assert.equal(confirmations,0);assert.equal(s.calls.filter(c=>c.action==='ascend').length,0);
});
test('bulk collection sends one request while an earlier click is in flight',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});const collecting=s.engine.claimAllQuests();
 assert.equal(s.calls.filter(c=>c.action==='claimAllQuests').length,0);
 s.calls.find(c=>c.action==='click').settle.resolve(s.result());await new Promise(setImmediate);
 assert.equal(s.calls.filter(c=>c.action==='claimAllQuests').length,1);
 s.engine.claimAllQuests();assert.equal(s.calls.filter(c=>c.action==='claimAllQuests').length,1);
 s.calls.find(c=>c.action==='claimAllQuests').settle.resolve(s.result());await collecting;
});

test('public fortune initializes for a regular player even if optional admin check fails',async()=>{
 const s=setup(),allowed=[];let disconnected=0;s.state.user={id:'regular-player'};
 s.context.gameAdmin.allowed=false;s.context.gameAdmin.connect=async()=>{throw Error('Admin role unavailable');};
 s.context.fortuneWheel.connect=value=>allowed.push(value);s.context.fortuneWheel.disconnect=()=>{disconnected++;};
 await s.engine.init();assert.deepEqual(allowed,[true]);assert.equal(s.context.gameAdmin.allowed,false);s.engine.destroy();assert.equal(disconnected,1);
});
test('fortune never initializes when the authoritative game load fails',async()=>{
 const s=setup();let connected=0;s.context.db.action=async()=>{throw Error('Invalid session');};s.context.fortuneWheel.connect=()=>{connected++;};
 await assert.rejects(s.engine.init(),/Invalid session/);assert.equal(connected,0);
});

test('a late click response from the previous session cannot overwrite the new session',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});s.runClickTimer();const previous=s.calls.at(-1);s.engine.destroy();await s.engine.init();
 const response=s.result();response.state.moonHP=1;response.revision=99;previous.settle.resolve(response);await new Promise(setImmediate);assert.equal(s.state.moonHP,100);
});

test('wheel winnings do not emit achievement toasts before wheel presentation settles',async()=>{
 const s=setup(),toasts=[];let reveal;s.context.fortuneWheel.bind=(spin,onReveal)=>{reveal=onReveal;};s.context.showToast=(...args)=>toasts.push(args);s.context.ACHIEVEMENTS={wealth:{tiers:[{level:'bronze',name:'Wealth'}]}};s.context.QUESTS={};await s.engine.init();
 const response=s.result();response.state.quests={};response.state.achievements={wealth:{bronze:'unclaimed'}};s.context.resultToApply=response;s.context.applyDeferred=true;
 vm.runInContext('apply(resultToApply,[],applyDeferred)',s.context);assert.equal(toasts.length,0);assert.equal(vm.runInContext('pendingWheelNotices.length',s.context),1);reveal();assert.equal(toasts.length,1);assert.match(toasts[0][0],/Wealth/);assert.equal(vm.runInContext('pendingWheelNotices.length',s.context),0);
 s.engine.destroy();assert.equal(vm.runInContext('pendingWheelNotices.length',s.context),0);
});
