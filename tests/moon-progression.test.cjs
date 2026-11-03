const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
test('moon purchase order puts electric before fire and requires all earlier moons',()=>{
 const run=setup();assert.equal(run("MOON_ORDER.join(',')"),'normal,blood,ice,shadow,electric,fire,gold,cosmic');
 assert.throws(()=>run("var s=freshState();s.maxLevel=1000;s.playerData.shards=1e9;applyAction(s,'buyMoon',{id:'gold'},100000)"),/Сначала/);
 assert.equal(run("for(var id of MOON_ORDER.slice(1))s=applyAction(s,'buyMoon',{id},100000);s.ownedMoons.length"),8);
});
test('unlock checks lifetime record, not current or current-run level',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.currentLevel=1;s.runMaxLevel=1;s.maxLevel=60;s.ownedMoons=['normal','blood','ice','shadow'];s.playerData.shards=1e6;applyAction(s,'buyMoon',{id:'electric'},100000).ownedMoons.includes('electric')"),true);
 assert.throws(()=>run("s.maxLevel=59;applyAction(s,'buyMoon',{id:'electric'},100000)"),/максимальный/);
});
test('blood unlock stays at five while every later moon has a higher threshold',()=>{
 const run=setup();assert.equal(run('MOON_TYPES.blood.unlockLevel'),5);
 for(const [id,old] of [['ice',10],['shadow',15],['electric',25],['fire',20],['gold',30],['cosmic',40]])assert.ok(run("MOON_TYPES."+id+".unlockLevel")>old);
 assert.ok(run('MOON_TYPES.fire.unlockLevel>MOON_TYPES.electric.unlockLevel&&MOON_TYPES.fire.cost>MOON_TYPES.electric.cost'));
 assert.equal(run('MOON_TYPES.gold.cost'),600000);
});
test('upgrade costs from ice scale with moon purchase prices while early moons stay unchanged',()=>{
 const run=setup();assert.equal(run("getMoonUpgradeCostForLevel('normal',1)"),300);assert.equal(run("getMoonUpgradeCostForLevel('blood',1)"),1500);
 for(const id of ['ice','shadow','electric','fire','gold','cosmic']){
  assert.equal(run("getMoonUpgradeCostForLevel('"+id+"',1)"),run("Math.floor(MOON_TYPES."+id+".cost*.6*1.5/(CONSTANTS.MOON_UPGRADE_PRICE_DIVISORS['"+id+"']||1))"));
  assert.ok(run("getMoonUpgradeCostForLevel('"+id+"',9)>getMoonUpgradeCostForLevel('"+id+"',1)"));
 }
 assert.equal(run("getMoonUpgradeCostForLevel('gold',1)"),135000);
});
test('a server upgrade charges the new price once and ignores client-supplied prices',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.ownedMoons.push('gold');s.moonLevels.gold=1;s.playerData.shards=1e6;s=applyAction(s,'upgradeMoon',{id:'gold',cost:0},100000);s.playerData.shards"),865000);assert.equal(run('s.moonLevels.gold'),2);
});
test('ascension refreshes quests and achievements, preserving only eternal progress and lifetime record',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.currentLevel=200;s.maxLevel=200;s.clickCount=10000;s.playerData.shards=1e6;s.prestige.upgrades.reactor=2;s=applyAction(s,'load',{},100000);for(var q of Object.values(s.quests)){q.completed=true;q.claimed=true;q.progress=99999;}s.achievements.clickNovice={bronze:'claimed',silver:'claimed'};s=applyAction(s,'ascend',{},100100);Object.values(s.quests).every(q=>!q.completed&&!q.claimed&&q.progress===0)"),true);
 assert.equal(run('Object.values(s.achievements).flatMap(tiers=>Object.values(tiers)).length'),0);assert.equal(run('s.runMaxLevel'),1);assert.equal(run('s.maxLevel'),200);assert.equal(run('s.prestige.upgrades.reactor'),2);assert.ok(run('Object.keys(s.quests).length')>0);
});
test('shop and server share the purchase gate and the shop lists moons in progression order',()=>{
 const renderer=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8');assert.match(renderer,/for \(const id of MOON_ORDER\)/);assert.match(renderer,/getMoonPurchaseAccess\(state,id\)/);
 const secure=fs.readFileSync(path.join(__dirname,'../src/modules/game/secure-game.js'),'utf8');assert.match(secure,/action==='ascend'[\s\S]*?updateQuestAndAchievementUI\(true\)/);
});
