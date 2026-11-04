const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math),window:{},appState:{},CombatSystem:class{},RewardSystem:class{}};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return {run:s=>vm.runInContext(s,c),c};}
test('clone links require the selected original rather than mere presence',()=>{
 const {run}=setup();run("var s=freshState();s.maxSlots=3;s.activeMoons=['gold','cosmic','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={gold:7,cosmic:10,clone:7};s.cloneTargets=['cosmic'];var links=getActiveSynergies(s);");
 assert.equal(run("links.filter(b=>b.isClone&&b.moons.length===2).length"),1);
 assert.equal(run("links.some(b=>b.key==='clone+cosmic')"),true);assert.equal(run("links.some(b=>b.key==='clone+gold')"),false);
 assert.equal(run("links.some(b=>b.name==='Галактическая корона')"),true);
 assert.equal(run("links.find(b=>b.key==='clone+cosmic').name"),'Зеркальная вселенная');
 assert.ok(run("links.find(b=>b.key==='clone+cosmic').description.includes('150%')"));
});
test('level ten grants two distinct links and exactly one dual resonance with stable identity',()=>{
 const {run}=setup();run("var s=freshState();s.maxSlots=3;s.activeMoons=['gold','cosmic','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={gold:7,cosmic:10,clone:10};s.cloneTargets=['gold','cosmic'];var links=getActiveSynergies(s);");
 assert.equal(run("links.filter(b=>b.isClone).length"),3);assert.equal(run("links.filter(b=>b.name==='Двойной зеркальный резонанс').length"),1);
 assert.equal(run('new Set(links.map(b=>b.key)).size'),run('links.length'));
 assert.ok(Math.abs(run("links.find(b=>b.key==='clone+cosmic+gold').damageBonus")-.225)<1e-12);
 const key=run("links.find(b=>b.name==='Двойной зеркальный резонанс').key");
 run("s.cloneTargets.reverse();");assert.equal(run("getActiveSynergies(s).find(b=>b.name==='Двойной зеркальный резонанс').key"),key);
 run("s.moonLevels.clone=7;");assert.equal(run('getActiveSynergies(s).filter(b=>b.isClone&&b.moons.length===2).length'),1);
 run("s.activeMoons=['gold','cosmic'];");assert.equal(run('getActiveSynergies(s).some(b=>b.isClone)'),false);
});
test('all original targets have unique reflection names, and inactive or recursive links award nothing',()=>{
 const {run}=setup();const names=new Set();
 for(const id of ['normal','blood','ice','shadow','electric','fire','gold','cosmic']){
  run("var s=freshState();s.maxSlots=2;s.activeMoons=['"+id+"','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={"+id+":10,clone:3};s.cloneTargets=['"+id+"'];var link=getActiveSynergies(s).find(b=>b.isClone);");
  names.add(run('link.name'));assert.ok(Math.abs(run('link.damageBonus')-.11)<1e-12);
 }
 assert.equal(names.size,8);
 run("s.cloneTargets=['clone','unknown'];");assert.equal(run('getActiveSynergies(s).some(b=>b.isClone)'),false);
 assert.equal(run("Object.keys(SYNERGY_BONUSES).some(key=>key.split('+').includes('clone'))"),false);
});
test('server damage, shared profile and achievement counts agree with bound clone synergies',()=>{
 const {run,c}=setup();run("Math.random=()=>.99;var s=freshState();s.maxSlots=3;s.activeMoons=['gold','cosmic','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={gold:7,cosmic:10,clone:7};s.cloneTargets=['cosmic'];s.currentLevel=100;s=applyAction(s,'load',{},100000);");
 assert.equal(run("ACHIEVEMENTS.synergyHunter.check(s,{target:4})"),false);assert.equal(run('getCombatStats(s,100000).finalDamage'),run('s.finalDamage'));
 run("s.moonLevels.clone=10;s=applyAction(s,'setCloneTargets',{targets:['cosmic','gold']},100100);");
 assert.equal(run("ACHIEVEMENTS.synergyHunter.check(s,{target:3})"),true);
 assert.equal(run('getCombatStats(s,100100).finalDamage'),run('s.finalDamage'));
 c.state=run('s');vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/game/game.js'),'utf8')),c);
 assert.equal(run("gameEngine.recalcMoonBonuses().activeSynergies.map(b=>b.key).sort().join('|')"),run("getActiveSynergies(state).map(b=>b.key).sort().join('|')"));
});
