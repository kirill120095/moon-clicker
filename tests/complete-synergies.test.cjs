const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
function groups(ids,n,start=0,prefix=[]){if(prefix.length===n)return[prefix];return ids.slice(start).flatMap((id,i)=>groups(ids,n,start+i+1,[...prefix,id]));}
test('all 154 pairs triples and quadruples excluding normal have an exact synergy',()=>{
 const run=setup(),ids=['blood','ice','shadow','electric','fire','gold','cosmic','clone'];let total=0;
 for(const size of [2,3,4])for(const group of groups(ids,size)){
  run("var s=freshState();s.maxSlots="+size+";s.activeMoons="+JSON.stringify(group)+";s.ownedMoons=['normal',...s.activeMoons];s.moonLevels=Object.fromEntries(s.activeMoons.map(id=>[id,10]));s.cloneTargets=s.activeMoons.filter(id=>id!=='clone').slice(0,2);var synergies=getActiveSynergies(s);");
  const canonical=[...group].sort().join('+');
  assert.equal(run("synergies.filter(b=>[...b.moons].sort().join('+')==='"+canonical+"').length"),1,canonical);
  assert.equal(run("new Set(synergies.map(b=>[...b.moons].sort().join('+'))).size"),run('synergies.length'),canonical);total++;
 }
 assert.equal(total,154);
});
test('dark discharge grants the advertised electric-shadow bonuses',()=>{
 const run=setup();run("var s=freshState();s.maxSlots=2;s.activeMoons=['electric','shadow'];var syn=getActiveSynergies(s).find(b=>b.moons.length===2);");
 assert.equal(run('syn.name'),'Тёмный разряд');assert.equal(run('syn.damageBonus'),.35);assert.equal(run('syn.shardBonus'),.15);assert.equal(run('syn.critChanceBonus'),.03);assert.equal(run('syn.critDamageBonus'),.25);
});
test('clone unions require a bound member and cannot create duplicate dual resonance',()=>{
 const run=setup();run("var s=freshState();s.maxSlots=4;s.activeMoons=['gold','cosmic','fire','clone'];s.ownedMoons=[...s.activeMoons];s.moonLevels={gold:7,cosmic:10,fire:10,clone:10};s.cloneTargets=['cosmic','fire'];var synergies=getActiveSynergies(s);");
 assert.equal(run("synergies.filter(b=>b.moons.length===4&&b.isClone).length"),1);
 assert.equal(run("synergies.filter(b=>b.name==='Двойной зеркальный резонанс').length"),1);
 assert.equal(run("synergies.some(b=>b.key==='clone+gold')"),false);
 run("s.cloneTargets=[];");assert.equal(run("getActiveSynergies(s).some(b=>b.isClone)"),false);
});
test('original triples and clone groups agree between authoritative state and combat profile',()=>{
 const run=setup();
 for(const group of [['blood','electric','shadow'],['ice','fire','gold'],['gold','cosmic','fire','clone']]){
  run("var s=freshState();s.currentLevel=150;s.maxSlots="+group.length+";s.activeMoons="+JSON.stringify(group)+";s.ownedMoons=['normal',...s.activeMoons];s.moonLevels=Object.fromEntries(s.activeMoons.map(id=>[id,10]));s.cloneTargets=s.activeMoons.filter(id=>id!=='clone').slice(0,2);s=applyAction(s,'load',{},100000);");
  assert.equal(run('getCombatStats(s,100000).finalDamage'),run('s.finalDamage'));assert.equal(run('getCombatStats(s,100000).moonReward'),run('s.moonReward'));
 }
});
