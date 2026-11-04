const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){
 const state={currentLevel:100,maxSlots:3,activeMoons:['fire','cosmic','clone'],cloneTargets:['fire','cosmic'],moonLevels:{fire:10,cosmic:10,clone:10},moonKills:3,playerData:{click_damage:10,shards:0},runtime:{}};
 const c={state,appState:{},CombatSystem:class{},RewardSystem:class{},window:{},console};
 vm.createContext(c);vm.runInContext(['src/core/constants.js','src/core/config.js','src/modules/game/game.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'..',p),'utf8'))).join('\n'),c);
 return {run:s=>vm.runInContext(s,c),state};
}
test('clone buffs have separate IDs and equal half contributions while damage stays unchanged',()=>{
 const {run}=setup();run('gameEngine._fireStacks=160;gameEngine._lastActivityTime=Date.now();var before=getBaseDamage(state);var buffs=gameEngine._getActiveBuffs();');
 const fire=run("buffs.find(b=>b.id==='fire')"),copy=run("buffs.find(b=>b.id==='clone-fire')");
 assert.ok(copy.isReflection);assert.equal(copy.bonus,fire.bonus);assert.equal(copy.value,fire.value);assert.equal(copy.timeLeft,fire.timeLeft);assert.ok(copy.name.startsWith('Клон'));
 assert.equal(run("buffs.find(b=>b.id==='cosmic').bonus"),run("buffs.find(b=>b.id==='clone-cosmic').bonus"));assert.equal(run('getBaseDamage(state)'),run('before'));
 assert.equal(run('new Set(buffs.map(b=>b.id)).size'),run('buffs.length'));
});
test('four originals and two distinct reflection slots are not hidden by the old three-card limit',()=>{
 const {run}=setup();run("state.maxSlots=4;state.activeMoons=['normal','fire','cosmic','clone'];state.cloneTargets=['fire','cosmic'];var buffs=gameEngine._getActiveBuffs();");
 assert.equal(run('buffs.length'),5);assert.equal(run('buffs.filter(b=>b.isReflection).length'),2);
 run("state.activeMoons=['normal','fire','cosmic'];");assert.equal(run('gameEngine._getActiveBuffs().some(b=>b.isReflection)'),false);
});
test('clone card shows 110 percent shares accurately and never changes shared stacks',()=>{
 const {run}=setup();run("state.moonLevels.clone=3;state.cloneTargets=['fire'];gameEngine._fireStacks=5;var buffs=gameEngine._getActiveBuffs();");
 assert.match(run("buffs.find(b=>b.id==='fire').bonus"),/33%/);assert.equal(run('gameEngine._fireStacks'),5);
});
test('chosen reward curve C matches previews before bonus multipliers',()=>{
 const {run}=setup();assert.equal(run('CONSTANTS.MOON_REWARD.EXPONENT'),1.5);
 for(const [level,reward] of [[99,695],[100,1763],[249,2467],[250,6203],[499,6576],[500,16488],[999,17790],[1000,44540]]){
  assert.equal(run("Math.round(Math.floor(5+2*"+level+"+.5*Math.pow("+level+",CONSTANTS.MOON_REWARD.EXPONENT))*("+level+"%10===0?2.5:1))"),reward);
 }
});

test('server curve C credits exactly its preview including existing prestige and UFO multipliers',()=>{
 const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);
 vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);
 for(const level of [99,100,250,500,1000]){
  const run=s=>vm.runInContext(s,c);
  run("Math.random=()=>.99;var s=freshState();s.currentLevel="+level+";s=applyAction(s,'load',{},100000);var preview=s.moonReward;");
  const base=Math.floor(5+2*level+.5*Math.pow(level,1.5)),expected=Math.round(base*(level%10===0?2.5:1)*(1+Math.floor(level/300)*.05));
  assert.equal(run('preview'),expected);
  assert.equal(run("s.moonHP=1;applyAction(s,'click',{count:1},100100).effects[0].reward"),expected);
 }
});
