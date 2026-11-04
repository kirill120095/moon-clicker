const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('shadow first manual crit is exactly ten ordinary crits and is consumed only once',()=>{
 const run=setup();run("Math.random=()=>0;var s=freshState();s.activeMoons=['shadow'];s.ownedMoons=['normal','shadow'];s.moonLevels.shadow=5;s.playerData.click_damage=100;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);var preview=getCombatStats(s,100000);var a=applyAction(s,'click',{count:1},100100);var b=applyAction(a,'click',{count:1},100200);");
 assert.equal(run('a.effects[0].isCrit'),true);assert.equal(run('a.effects[0].damage'),run('b.effects[0].damage*10'));
 assert.equal(run('preview.firstStrikeMultiplier'),10);assert.equal(run('preview.critDamage'),run('a.effects[0].damage'));
 assert.equal(run('getCombatStats(a,100100).firstStrikeMultiplier'),1);
 assert.equal(run("applyAction(a,'load',{},100300).runtime._firstStrikeUsed"),true);
});
test('shadow below level five receives no first strike multiplier',()=>{
 const run=setup();run("Math.random=()=>.99;var s=freshState();s.activeMoons=['shadow'];s.moonLevels.shadow=4;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);s=applyAction(s,'click',{count:1},100100);");
 assert.equal(run('s.effects[0].isCrit'),false);assert.equal(run("getMoonMechanicParams('shadow',4).firstStrikeMultiplier"),1);
});
test('a fresh boss receives a fresh first strike while a second strike is normal',()=>{
 const run=setup();run("Math.random=()=>0;var s=freshState();s.currentLevel=9;s.maxLevel=9;s.activeMoons=['shadow'];s.moonLevels.shadow=5;s.playerData.click_damage=100;s.moonHP=1;s=applyAction(s,'load',{},100000);s=applyAction(s,'click',{count:1},100100);");
 assert.equal(run('s.currentLevel'),10);assert.equal(run('s.runtime._firstStrikeUsed'),false);
 run("s=applyAction(s,'click',{count:1},100200);var boosted=s.effects[0].damage;s=applyAction(s,'click',{count:1},100300);");
 assert.equal(run('boosted'),run('s.effects[0].damage*10'));
});
test('clone scales added first strike power without multiplying copies recursively',()=>{
 const run=setup();run("Math.random=()=>0;var s=freshState();s.maxSlots=2;s.activeMoons=['shadow','clone'];s.ownedMoons=[...s.activeMoons];s.cloneTargets=['shadow'];s.moonLevels={shadow:5,clone:7};s.playerData.click_damage=100;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);var preview=getCombatStats(s,100000);var a=applyAction(s,'click',{count:1},100100);var b=applyAction(a,'click',{count:1},100200);");
 assert.equal(run("getEffectiveMoonParams(s,'shadow').firstStrikeMultiplier"),28);assert.equal(run('a.effects[0].damage'),run('b.effects[0].damage*28'));assert.equal(run('preview.critDamage'),run('a.effects[0].damage'));
});
test('UFO does not consume manual first strike and echo repeats its final damage only once',()=>{
 const run=setup();run("Math.random=()=>0;var s=freshState();s.activeMoons=['shadow'];s.moonLevels.shadow=5;s.playerData.click_damage=100;s.ufoLevel=1;s.prestige.upgrades.echo=10;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);s=applyAction(s,'sync',{},103000);");
 assert.equal(run('s.runtime._firstStrikeUsed'),false);
 run("s=applyAction(s,'click',{count:1},103100);");
 assert.equal(run("s.effects.filter(e=>e.source==='echo').length"),1);assert.equal(run("s.effects.find(e=>e.source==='echo').damage"),run("s.effects.find(e=>e.source==='manual').damage"));assert.equal(run('s.runtime._firstStrikeUsed'),true);
});
