const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/modules/game/secure-game.js'),'utf8').replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'');
function setup(){
 let now=900000,perf=10000,calls=[],ticks=[],hpUpdates=0,buffUpdates=0;
 const state={moonHP:100,maxHP:100,currentLevel:1,playerData:{click_damage:10,click_damage_level:0,shards:0}};
 const snapshot={...state,lastClickAt:999000,runtime:{_comboClicks:10}};
 const result=()=>({serverNow:now+100000,state:structuredClone(snapshot)});
 const engine={combat:{},destroy(){},recalcMoonBonuses(){},_comboClicks:0,
 _calculateAllBonuses:()=>({totalDamageBonus:0}),_getMechanicParamsForActiveMoon:()=>null,
 _updateBuffsDisplay(){buffUpdates++;},_getActiveBuffs(){return[{isTemporary:true,timeLeft:this._comboClicks>0?Math.max(0,Math.ceil((10000-(now-this._lastActivityTime))/1000)):null}];}};
 const context={gameEngine:engine,state,appState:{setMany:s=>Object.assign(state,s),set:(k,v)=>state[k]=v},CONSTANTS:{MAX_CLICKS_PER_SECOND:12,CLICK_BURST:12,BOSS_TIMER:30,BOSS_INTERVAL:10,UPGRADE_COSTS:{clickDamage:{base:60,multiplier:1.22}},LIMITS:{MAX_CLICK_DAMAGE_LEVEL:200}},db:{action(action,payload){calls.push({action,payload});if(action==='load')return Promise.resolve(result());return new Promise((resolve,reject)=>calls.at(-1).settle={resolve,reject});}},document:{getElementById:()=>null},animations:{playClickVisualFeedback(){}},audio:{click(){},purchase(){}},showToast(){},updateUI(){},updateHPBar(){hpUpdates++;},updateShopUI(){},updateProfileAndLeaders(){},updateQuestAndAchievementUI(){},updateTimerBar(){},setInterval(fn,ms){ticks.push({fn,ms});return ticks.length;},clearInterval(){},setTimeout(){return 1;},clearTimeout(){},performance:{now:()=>perf},Date:{now:()=>now},console,Math};
 vm.createContext(context);vm.runInContext(source,context);
 return{context,engine,state,calls,result,ticks,get hpUpdates(){return hpUpdates;},get buffUpdates(){return buffUpdates;},advance(ms){now+=ms;perf+=ms;}};
}
test('combo uses server last-click time corrected for clock skew and ticks while idle',async()=>{
 const s=setup();await s.engine.init();assert.equal(s.engine._lastActivityTime,899000);assert.equal(s.engine._getActiveBuffs()[0].timeLeft,9);
 s.advance(3000);const tick=s.ticks.find(t=>t.ms===250).fn;tick();assert.equal(s.engine._getActiveBuffs()[0].timeLeft,6);assert.ok(s.buffUpdates>=2);
 s.advance(6000);tick();assert.equal(s.calls.at(-1).action,'sync');
});
test('HP responds immediately before network confirmation without changing authoritative state',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});assert.equal(s.engine._previewDamage,10);assert.equal(s.state.moonHP,100);assert.equal(s.calls.at(-1).action,'click');assert.ok(s.hpUpdates>0);
 const response=s.result();response.state.moonHP=90;s.calls.at(-1).settle.resolve(response);await new Promise(setImmediate);
 assert.equal(s.state.moonHP,90);assert.equal(s.engine._previewDamage,0);
});
test('rejected hits remove only their visual prediction',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});s.calls.at(-1).settle.reject(Error('offline'));await new Promise(setImmediate);
 assert.equal(s.engine._previewDamage,0);assert.equal(s.state.moonHP,100);
});
test('slow network keeps one click request in flight and preserves later hit previews',async()=>{
 const s=setup();await s.engine.init();s.engine.handleClick({});for(let i=0;i<5;i++){s.advance(100);s.engine.handleClick({});}
 assert.equal(s.calls.filter(c=>c.action==='click').length,1);assert.equal(s.engine._previewDamage,60);
 const response=s.result();response.state.moonHP=90;s.calls.at(-1).settle.resolve(response);await new Promise(setImmediate);
 assert.equal(s.engine._previewDamage,50);assert.equal(s.state.moonHP,90);
 s.engine.destroy();assert.equal(s.engine._previewDamage,0);
});
