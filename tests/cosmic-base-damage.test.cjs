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
