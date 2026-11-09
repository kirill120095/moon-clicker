const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('cosmic adds ten base damage per current player level before existing percentage bonuses',()=>{
 const run=setup();run("var s=freshState();s.activeMoons=['cosmic'];s.ownedMoons=['normal','cosmic'];s.moonLevels.cosmic=1;s.currentLevel=100;");
 assert.equal(run('getBaseDamage(s)'),1010);assert.equal(run('getCombatStats(s,100000).baseDamageBonus'),1000);
 assert.equal(run('getCombatStats(s,100000).finalDamage'),2020);
 assert.equal(run("getMoonMechanicParams('cosmic',1).damagePerLevel"),0.01);
 run("s.moonLevels.cosmic=3;");assert.equal(run('getBaseDamage(s)'),1010);assert.equal(run('getCombatStats(s,100000).finalDamage'),3030);
 assert.equal(run('s.playerData.click_damage'),10);
});
test('cosmic base damage updates on level changes, deactivation and ascension without accumulating',()=>{
 const run=setup();run("var s=freshState();s.currentLevel=150;s.maxLevel=150;s.activeMoons=['cosmic'];s.ownedMoons=['normal','cosmic'];s.moonLevels.cosmic=1;");
 assert.equal(run('getBaseDamage(s)'),1510);assert.equal(run('getBaseDamage(s)'),1510);
 run('s.currentLevel=100;');assert.equal(run('getBaseDamage(s)'),1010);
 run("s.activeMoons=['normal','cosmic'];s.maxSlots=1;");assert.equal(run('getBaseDamage(s)'),10);
 run("s.maxSlots=2;");assert.equal(run('getBaseDamage(s)'),1010);
 assert.equal(run("applyAction(s,'ascend',{},100000).playerData.click_damage"),10);
 assert.equal(run("getBaseDamage(applyAction(s,'ascend',{},100000))"),10);
});
test('server manual hits, displayed final damage and UFO damage use the same cosmic base',()=>{
 const run=setup();run("Math.random=()=>0.99;var s=freshState();s.currentLevel=100;s.maxLevel=100;s.activeMoons=['cosmic'];s.ownedMoons=['normal','cosmic'];s.moonLevels.cosmic=1;s.ufoLevel=1;s.ufoCount=1;s=applyAction(s,'load',{},100000);var live=getCombatStats(s,100000);");
 assert.equal(run('s.finalDamage'),2030);assert.equal(run('live.finalDamage'),run('s.finalDamage'));assert.equal(run('live.ufoDamage'),run('s.ufoDamage'));
 assert.equal(run("var hit=applyAction(s,'click',{count:1},100100);hit.effects.find(e=>e.source==='manual').damage"),run('s.finalDamage'));
 assert.equal(run("var shot=applyAction(s,'sync',{},103000);shot.effects.find(e=>e.source==='ufo').damage"),run('s.ufoDamage'));
 assert.equal(run('s.playerData.click_damage'),10);
});

test('only actual deaths increment moonKills, including locked-level farming and UFO kills',()=>{
 const run=setup();run("Math.random=()=>0.99;var s=freshState();s.levelLocked=true;s.playerData.click_damage=1000000;s=applyAction(s,'click',{count:3,moonKills:999999},100000);");
 assert.equal(run('s.moonKills'),3);assert.equal(run('s.currentLevel'),1);
 run("s.ufoLevel=1;s.ufoCount=1;s=applyAction(s,'load',{},101000);s=applyAction(s,'sync',{},104000);");
 assert.equal(run('s.moonKills'),4);assert.equal(run("s.effects[0].source"),'ufo');
 run("s.currentLevel=10;s.moonHP=1;s=applyAction(s,'click',{count:1},104100);");
 assert.equal(run('s.moonKills'),5);assert.equal(run('s.bossKills'),1);
});
test('navigation, boss timeout, nonlethal hits and forged payload counters do not award kills',()=>{
 const run=setup();run("Math.random=()=>0.99;var s=freshState();delete s.moonKills;s=applyAction(s,'load',{moonKills:999999},100000);");
 assert.equal(run('s.moonKills'),0);
 run("s.moonHP=1000;s.maxHP=1000;s=applyAction(s,'click',{count:1},100100);");assert.equal(run('s.moonKills'),0);
 run("s.currentLevel=10;s.moonKills=12;s.bossDeadline=100101;s=applyAction(s,'sync',{},100200);");assert.equal(run('s.moonKills'),12);
 run("s=applyAction(s,'rollbackFive',{},100300);");assert.equal(run('s.moonKills'),12);
 run("s=applyAction(JSON.parse(JSON.stringify(s)),'load',{},100400);");assert.equal(run('s.moonKills'),12);
});
test('fractional kill bonuses accumulate before rounding and require active cosmic moon',()=>{
 const run=setup();run("var s=freshState();s.currentLevel=1;s.activeMoons=['cosmic'];s.ownedMoons=['normal','cosmic'];s.moonLevels.cosmic=1;s.moonKills=3;");
 assert.equal(run('getBaseDamage(s)'),22);assert.equal(run('getCombatStats(s,100000).baseDamageBonus'),12);
 run('s.moonKills=2;');assert.equal(run('getBaseDamage(s)'),21);
 run('s.moonKills=1000;s.currentLevel=100;');assert.equal(run('getBaseDamage(s)'),1510);
 run("s.activeMoons=['normal'];");assert.equal(run('getBaseDamage(s)'),10);assert.equal(run('s.moonKills'),1000);
 run("s.activeMoons=['cosmic'];s=applyAction(s,'ascend',{},100000);");assert.equal(run('s.moonKills'),0);assert.equal(run('getBaseDamage(s)'),10);
});
test('fractional cosmic base is visible without changing rounded hit labels',()=>{
 const c={};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/utils/numbers.js'),'utf8')),c);
 assert.equal(vm.runInContext('formatBaseDamage(20.3)',c),'20,3');assert.equal(vm.runInContext('formatBaseDamage(1100)',c).replace(/\s/g,''),'1100');
 const ui=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8');assert.match(ui,/data-live-stat="moonKills"/);assert.match(ui,/formatBaseDamage\(s.baseDamageBonus\)/);
});
