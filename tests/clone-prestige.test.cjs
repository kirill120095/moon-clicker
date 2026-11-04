const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('cosmic kill coefficient is 0.5 and permanent archive levels increase it before clone strength',()=>{
 const run=setup();run("var s=freshState();s.activeMoons=['cosmic'];s.moonLevels.cosmic=1;s.currentLevel=100;s.moonKills=100;s.prestige.upgrades.archive=3;");
 assert.equal(run('getBaseDamage(s)'),1210);assert.equal(run("getMoonMechanicParams('cosmic',1).baseDamagePerKill"),.5);
 run("s.currentLevel=150;s.maxLevel=150;s=applyAction(s,'ascend',{},100000);");assert.equal(run('s.moonKills'),0);assert.equal(run('s.prestige.upgrades.archive'),3);assert.equal(run('getBaseDamage(s)'),10);
});
test('prestige purchases use authoritative prices and permanent orbit is single purchase',()=>{
 const run=setup();run("var s=freshState();s.prestige.coins=2000;s=applyAction(s,'buyPrestige',{id:'archive',cost:0},100000);");
 assert.equal(run('s.prestige.coins'),1970);run("s=applyAction(s,'buyPrestige',{id:'orbit',cost:0},100000);");
 assert.equal(run('s.maxSlots'),2);assert.equal(run('getSlotLimit(s)'),4);assert.throws(()=>run("applyAction(s,'buyPrestige',{id:'orbit'},100001)"));
 run("s.playerData.shards=100000;s=applyAction(s,'buySlot',{},100002);s=applyAction(s,'buySlot',{},100003);");assert.equal(run('s.maxSlots'),4);assert.throws(()=>run("applyAction(s,'buySlot',{},100004)"));
 run("s.currentLevel=150;s=applyAction(s,'ascend',{},100005);");assert.equal(run('s.maxSlots'),2);assert.equal(run('getSlotLimit(s)'),4);
});
test('starting capital pays only after ascension and survives later loads without paying twice',()=>{
 const run=setup();run("var s=freshState();s.prestige.coins=3;s=applyAction(s,'buyPrestige',{id:'capital'},100000);");assert.equal(run('s.playerData.shards'),0);
 run("s.currentLevel=50;s=applyAction(s,'ascend',{},100100);");assert.equal(run('s.playerData.shards'),500);
 assert.equal(run("applyAction(s,'load',{},100200).playerData.shards"),500);assert.equal(run('s.prestige.upgrades.capital'),1);
});
test('click crystals credit manual and UFO hits once, excluding echo hits',()=>{
 const run=setup();run("Math.random=()=>0;var s=freshState();s.playerData.shards=5000;s=applyAction(s,'buyClickCrystal',{cost:0},100000);s.prestige.upgrades.echo=1;s.moonHP=1000000;s.maxHP=1000000;s=applyAction(s,'click',{count:1},100100);");
 assert.equal(run('s.clickCount'),1);assert.equal(run('s.playerData.shards'),1);assert.equal(run('s.effects.length'),2);assert.equal(run("s.effects[1].source"),'echo');
 assert.equal(run("getClickCrystalCost(1)"),15000);
 run("s.ufoLevel=1;s=applyAction(s,'load',{},101000);s=applyAction(s,'sync',{},104000);");assert.equal(run('s.playerData.shards'),2);
 assert.throws(()=>run("applyAction(s,'buyClickCrystal',{},104100)"));
});
test('boss hunter affects confirmed, profile and UFO damage and extends current boss deadline',()=>{
 const run=setup();run("Math.random=()=>.99;var s=freshState();s.currentLevel=10;s.moonHP=100000;s.maxHP=100000;s.bossDuration=30;s.bossDeadline=130000;s.prestige.coins=5;s=applyAction(s,'buyPrestige',{id:'hunter'},100000);");
 assert.equal(run('s.bossDeadline'),131000);assert.equal(run('s.bossDuration'),31);
 assert.equal(run('getCombatStats(s,100000).finalDamage'),run('s.finalDamage'));
 assert.equal(run("applyAction(s,'click',{count:1},100100).effects[0].damage"),run('s.finalDamage'));
});
test('supernova grants 0.1 percentage point of crit per level and has no completion flag',()=>{
 const run=setup();run("var s=freshState();s.currentLevel=100;s.activeMoons=['cosmic'];s.moonLevels.cosmic=10;");
 assert.ok(Math.abs(run('getCombatStats(s,100000).critChance')-.15)<1e-12);assert.equal(run("applyAction(s,'load',{},100000).gameCompleted"),false);
});
test('clone milestones strengthen both original and reflection without changing original levels',()=>{
 const run=setup();run("var s=freshState();s.maxSlots=2;s.activeMoons=['cosmic','clone'];s.ownedMoons=['normal','cosmic','clone'];s.cloneTargets=['cosmic'];s.moonLevels={cosmic:10,clone:1};s.currentLevel=100;s.moonKills=20;");
 for(const [level,power] of [[1,2],[3,2.2],[5,2.5],[7,3],[10,3]]){
  run('s.moonLevels.clone='+level);assert.equal(run("getMoonPower(s,'cosmic')"),power);assert.equal(run('getBaseDamage(s)'),10+(1000+10)*power);
 }
 assert.equal(run('s.moonLevels.cosmic'),10);assert.equal(run("getEffectiveMoonParams(s,'cosmic').critChancePerLevel"),.003);
});
test('level ten clone reflects two distinct active originals and server rejects invalid bindings',()=>{
 const run=setup();run("var s=freshState();s.maxSlots=3;s.activeMoons=['fire','cosmic','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={fire:10,cosmic:10,clone:10};s.runtime={_fireStacks:500};s=applyAction(s,'setCloneTargets',{targets:['fire','cosmic']},100000);");
 assert.equal(run("getMoonPower(s,'fire')"),3);assert.equal(run("getMoonPower(s,'cosmic')"),3);assert.equal(run("getMoonPower(s,'clone')"),0);assert.equal(run('s.runtime._fireStacks'),0);
 for(const targets of ["['fire','fire']","['clone']","['gold']","['fire','cosmic','gold']"])assert.throws(()=>run("applyAction(s,'setCloneTargets',{targets:"+targets+"},100001)"));
 run('s.moonLevels.clone=7;');assert.throws(()=>run("applyAction(s,'setCloneTargets',{targets:['fire','cosmic']},100002)"));
 run("s.activeMoons=['clone'];");assert.equal(run('getCloneTargets(s).length'),0);
});
test('every original shares effective mechanics, passives and UFO strength with its reflection',()=>{
 const run=setup();
 for(const id of ['normal','blood','ice','shadow','electric','fire','gold','cosmic']){
  run("var s=freshState();s.currentLevel=100;s.maxLevel=100;s.maxSlots=2;s.activeMoons=['"+id+"','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={"+id+":10,clone:7};s.cloneTargets=['"+id+"'];s.ufoLevel=1;s.ufoCount=1;s=applyAction(s,'load',{},100000);var live=getCombatStats(s,100000);");
  assert.equal(run('s.finalDamage'),run('live.finalDamage'),id);assert.equal(run('s.ufoDamage'),run('live.ufoDamage'),id);
  assert.equal(run("getMoonPower(s,'"+id+"')"),3);
  assert.ok(run("getUfoBonuses(s).haste")<1);
 }
});
test('four active originals unlock a constellation and UI separates moons from ordinary shop',()=>{
 const run=setup();assert.equal(run("Object.keys(SYNERGY_BONUSES).filter(k=>k.split('+').length===4).length"),70);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),shop=html.slice(html.indexOf('id="shopTabContent"'),html.indexOf('id="moonsTabContent"'));
 assert.ok(!shop.includes('id="moonShopItems"'));assert.ok(shop.includes('id="buyClickCrystalBtn"'));assert.ok(html.indexOf('data-tab="moons"')<html.indexOf('data-tab="shop"'));assert.ok(!html.includes('id="supernovaModal"'));
});
