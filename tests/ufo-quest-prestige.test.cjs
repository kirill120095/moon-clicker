const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('twenty level coin thresholds pay once per ascension and restart in the new run',()=>{
 const run=setup();for(const [level,coins] of [[19,0],[20,1],[39,1],[40,2],[100,5],[300,15]])assert.equal(run("var s=freshState();s.runMaxLevel="+level+";getPrestigeSummary(s).pendingCoins"),coins);
 assert.throws(()=>run("s=freshState();s.currentLevel=19;applyAction(s,'ascend',{},100000)"));
 run("s=freshState();s.currentLevel=40;s=applyAction(s,'sync',{},100000);s=applyAction(s,'rollbackFive',{},100100);");
 assert.equal(run('s.prestigeSummary.pendingCoins'),2);
 run("s=applyAction(s,'ascend',{},100200);");assert.equal(run('s.prestige.coins'),2);assert.throws(()=>run("applyAction(s,'ascend',{},100300)"));
 run("s.currentLevel=20;s=applyAction(s,'ascend',{},100400);");assert.equal(run('s.prestige.coins'),3);
});
test('each UFO shot advances click quests for every moon and awards upgraded click crystals',()=>{
 const run=setup();for(const id of ['normal','blood','ice','shadow','electric','fire','gold','cosmic','clone']){
  run("Math.random=()=>.99;var s=freshState();s.activeMoons=['"+id+"'];s.moonLevels={"+id+":1};s.ufoLevel=1;s.clickCrystalLevel=3;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);var q=Object.values(QUESTS).find(q=>q.type==='click');s.quests={[q.id]:{progress:0,target:q.target,completed:false,claimed:false}};s=applyAction(s,'sync',{},103000);");
  assert.equal(run('s.clickCount'),1,id);assert.equal(run('s.quests[q.id].progress'),1,id);assert.equal(run('s.playerData.shards'),3,id);assert.equal(run('s.effects.length'),1,id);
  assert.equal(run("applyAction(s,'sync',{},103000).clickCount"),1,id);
 }
});
test('automatic timestamps keep fire and shadow visible and idle gaps still expire them',()=>{
 const run=setup();run("Math.random=()=>.99;var s=freshState();s.maxSlots=3;s.activeMoons=['normal','fire','shadow'];s.moonLevels={normal:1,fire:1,shadow:1};s.ufoLevel=1;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);for(var t=103000;t<=130000;t+=3000)s=applyAction(s,'sync',{},t);");
 assert.equal(run('s.runtime._comboClicks'),10);assert.equal(run('s.runtime._fireStacks'),10);assert.equal(run('s.runtime._shadowCritStacks'),10);
 assert.equal(run('s.lastAutoClickAt'),130000);assert.equal(run('s.lastClickAt'),undefined);
 assert.ok(run("getCombatStats(s,130100).sources.some(b=>b.id==='heat')"));
 assert.ok(run("getCombatStats(s,130100).sources.some(b=>b.id==='shadow-stacks')"));
 run("s=applyAction(s,'sync',{},150000);");assert.equal(run('s.runtime._comboClicks+s.runtime._fireStacks+s.runtime._shadowCritStacks'),0);
});
test('archive upgrades permanently add 1.5 per kill each, with existing levels upgraded too',()=>{
 const run=setup();run("var s=freshState();s.activeMoons=['cosmic'];s.moonLevels.cosmic=1;s.currentLevel=100;s.moonKills=100;s.prestige.upgrades.archive=2;");
 assert.equal(run("getPrestigeSummary(s).archivePerKill"),3);assert.equal(run('getBaseDamage(s)'),1360);
 run("s=applyAction(s,'ascend',{},100000);");assert.equal(run('s.prestige.upgrades.archive'),2);assert.equal(run('s.moonKills'),0);
});

test('click crystals pay once per actual shot regardless of relay and never on duplicate sync',()=>{
 const run=setup();for(const relay of [false,true]){
  run("Math.random=()=>.99;var s=freshState();s.ufoLevel=1;s.ufoCount=2;s.ownedMoons.push('blood');s.ufoComboRelay="+relay+";s.clickCrystalLevel=4;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);s=applyAction(s,'sync',{},103000);");
  assert.equal(run('s.effects.length'),2);assert.equal(run('s.playerData.shards'),8);assert.equal(run('s.clickCount'),2);
  assert.equal(run("applyAction(s,'sync',{},103000).playerData.shards"),8);
  assert.equal(run("applyAction(s,'click',{count:1},103100).playerData.shards"),12);
 }
 run("s=freshState();s.ufoLevel=1;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);s=applyAction(s,'sync',{},103000);");assert.equal(run('s.playerData.shards'),0);
});
