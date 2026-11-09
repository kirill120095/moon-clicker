const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
function groups(ids,n,start=0,prefix=[]){if(prefix.length===n)return[prefix];return ids.slice(start).flatMap((id,i)=>groups(ids,n,start+i+1,[...prefix,id]));}
test('all 91 elemental pairs, triples and quadruples activate exactly one constellation',()=>{
 const run=setup(),ids=['blood','ice','shadow','electric','fire','gold','cosmic'];let total=0;
 for(const size of [2,3,4])for(const group of groups(ids,size)){
  run("var s=freshState();s.maxSlots="+size+";s.activeMoons="+JSON.stringify(group)+";s.ownedMoons=['normal',...s.activeMoons];s.moonLevels=Object.fromEntries(s.activeMoons.map(id=>[id,10]));s.cloneTargets=s.activeMoons.filter(id=>id!=='clone').slice(0,2);var synergies=getActiveSynergies(s);");
  const canonical=[...group].sort().join('+');
  assert.equal(run("synergies.filter(b=>[...b.moons].sort().join('+')==='"+canonical+"').length"),1,canonical);
  assert.equal(run('synergies.length'),1,canonical);total++;
 }
 assert.equal(total,91);
});
test('dark discharge grants the advertised electric-shadow bonuses',()=>{
 const run=setup();run("var s=freshState();s.maxSlots=2;s.activeMoons=['electric','shadow'];var syn=getActiveSynergies(s).find(b=>b.moons.length===2);");
 assert.equal(run('syn.name'),'Тёмный разряд');assert.equal(run('syn.damageBonus'),.9);assert.equal(run('syn.shardBonus'),.2);assert.equal(run('syn.critChanceBonus'),0);assert.equal(run('syn.critDamageBonus'),0);
});
test('reflections strengthen the original constellation without adding a second one',()=>{
 const run=setup();run("var s=freshState();s.maxSlots=4;s.activeMoons=['gold','cosmic','fire','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={gold:7,cosmic:10,fire:10,clone:10};s.cloneTargets=['cosmic','fire'];var synergies=getActiveSynergies(s);");
 assert.equal(run('synergies.length'),1);
 assert.equal(run('synergies[0].key'),'cosmic+fire+gold');
 assert.equal(run('synergies[0].copyMultiplier'),1.4);
 run("s.cloneTargets=[];");assert.equal(run('getActiveSynergies(s)[0].copyMultiplier'),1);
});
test('original triples and clone groups agree between authoritative state and combat profile',()=>{
 const run=setup();
 for(const group of [['blood','electric','shadow'],['ice','fire','gold'],['gold','cosmic','fire','clone']]){
  run("var s=freshState();s.currentLevel=150;s.maxSlots="+group.length+";s.activeMoons="+JSON.stringify(group)+";s.ownedMoons=['normal',...s.activeMoons];s.moonLevels=Object.fromEntries(s.activeMoons.map(id=>[id,10]));s.cloneTargets=s.activeMoons.filter(id=>id!=='clone').slice(0,2);s=applyAction(s,'load',{},100000);");
  assert.equal(run('getCombatStats(s,100000).finalDamage'),run('s.finalDamage'));assert.equal(run('getCombatStats(s,100000).moonReward'),run('s.moonReward'));
 }
});
