const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math),window:{},appState:{},CombatSystem:class{},RewardSystem:class{}};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return {run:s=>vm.runInContext(s,c),c};}

function constellation(run){
 run("var s=freshState();s.maxSlots=3;s.activeMoons=['gold','cosmic','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={gold:7,cosmic:10,clone:10};s.cloneTargets=['cosmic'];");
}
test('only bound originals strengthen the constellation',()=>{
 const {run}=setup();constellation(run);
 assert.equal(run('getActiveSynergies(s).length'),1);
 assert.equal(run('getActiveSynergies(s)[0].copyMultiplier'),1.2);
 run("s.cloneTargets=['normal','clone','unknown'];");
 assert.equal(run('getActiveSynergies(s)[0].copyMultiplier'),1);
});
test('two reflections amplify the same constellation regardless of distribution',()=>{
 const {run}=setup();constellation(run);
 for(const targets of ["['gold','cosmic']","['cosmic','gold']","['cosmic','cosmic']"]){
  run('s.cloneTargets='+targets);
  assert.equal(run('getActiveSynergies(s).length'),1);
  assert.equal(run('getActiveSynergies(s)[0].key'),'cosmic+gold');
  assert.equal(run('getActiveSynergies(s)[0].copyMultiplier'),1.4);
 }
 run('s.moonLevels.clone=7;');assert.equal(run('getActiveSynergies(s)[0].copyMultiplier'),1.2);
 run("s.activeMoons=['gold','cosmic'];");assert.equal(run('getActiveSynergies(s)[0].copyMultiplier'),1);
});
test('a single original retains its reflection bonuses without producing a constellation',()=>{
 const {run}=setup();
 for(const id of ['normal','blood','ice','shadow','electric','fire','gold','cosmic']){
  run("var s=freshState();s.maxSlots=2;s.activeMoons=['"+id+"','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={"+id+":10,clone:3};s.cloneTargets=['"+id+"'];");
  assert.equal(run('getActiveSynergies(s).length'),0);
  assert.equal(run("getMoonPower(s,'"+id+"')"),2.2);
 }
});
test('server damage, combat profile and the constellation UI agree after changing reflections',()=>{
 const {run,c}=setup();constellation(run);
 run("Math.random=()=>.99;s.currentLevel=100;s=applyAction(s,'load',{},100000);");
 assert.equal(run("ACHIEVEMENTS.synergyHunter.check(s,{target:1})"),true);
 assert.equal(run('getCombatStats(s,100000).finalDamage'),run('s.finalDamage'));
 run("s=applyAction(s,'setCloneTargets',{targets:['cosmic','gold']},100100);");
 assert.equal(run('getCombatStats(s,100100).finalDamage'),run('s.finalDamage'));
 c.state=run('s');vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/game/game.js'),'utf8')),c);
 assert.equal(run("gameEngine.recalcMoonBonuses().activeSynergies[0].key"),run("getActiveSynergies(state)[0].key"));
});
