const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
test('moon purchase order puts electric before fire and requires all earlier moons',()=>{
 const run=setup();assert.equal(run("MOON_ORDER.join(',')"),'normal,blood,ice,shadow,electric,fire,gold,cosmic,clone');
 assert.throws(()=>run("var s=freshState();s.maxLevel=1000;s.runMaxLevel=1000;s.playerData.shards=1e9;applyAction(s,'buyMoon',{id:'gold'},100000)"),/Сначала/);
 assert.equal(run("for(var id of MOON_ORDER.slice(1))s=applyAction(s,'buyMoon',{id},100000);s.ownedMoons.length"),9);
});
test('unlock checks the current run record while lifetime record cannot bypass it',()=>{
 const run=setup();assert.throws(()=>run("var s=freshState();s.currentLevel=1;s.runMaxLevel=1;s.maxLevel=1000;s.ownedMoons=['normal','blood','ice','shadow'];s.playerData.shards=1e6;applyAction(s,'buyMoon',{id:'electric'},100000)"),/забега/);
 assert.equal(run("s.runMaxLevel=60;applyAction(s,'buyMoon',{id:'electric'},100000).ownedMoons.includes('electric')"),true);
 assert.throws(()=>run("s.runMaxLevel=59;applyAction(s,'buyMoon',{id:'electric'},100000)"),/забега/);
});
test('moon unlock thresholds follow the selected progression without changing purchase costs',()=>{
 const run=setup();
 for(const [id,level]of Object.entries({blood:20,ice:40,shadow:50,electric:60,fire:70,gold:100,cosmic:120,clone:200}))assert.equal(run('MOON_TYPES.'+id+'.unlockLevel'),level);
 assert.equal(run('MOON_TYPES.gold.cost'),600000);assert.equal(run('MOON_TYPES.fire.cost'),350000);assert.equal(run('MOON_TYPES.clone.cost'),12000000);
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

test('every moon enforces its exact record threshold and the previous-moon purchase chain',()=>{
 const run=setup();
 for(const [id,level]of Object.entries({blood:20,ice:40,shadow:50,electric:60,fire:70,gold:100,cosmic:120,clone:200})){
  run("var s=freshState();s.currentLevel=1;s.maxLevel=1000;s.runMaxLevel="+(level-1)+";s.playerData.shards=1e9;s.ownedMoons=MOON_ORDER.slice(0,MOON_ORDER.indexOf('"+id+"'));s.moonLevels=Object.fromEntries(s.ownedMoons.map(id=>[id,1]));");
  assert.throws(()=>run("applyAction(s,'buyMoon',{id:'"+id+"'},100000)"),/забега/);
  assert.equal(run("s.runMaxLevel="+level+";applyAction(s,'buyMoon',{id:'"+id+"'},100000).ownedMoons.includes('"+id+"')"),true);
  if(id!=='blood'){run('s.ownedMoons.pop();');assert.throws(()=>run("applyAction(s,'buyMoon',{id:'"+id+"'},100000)"),/Сначала/);}
 }
});

test('ascension relocks moons despite a high lifetime record and missing run fields never inherit it',()=>{
 const run=setup();run("var s=freshState();s.currentLevel=200;s.maxLevel=1000;s.runMaxLevel=200;s.playerData.shards=1e9;s=applyAction(s,'ascend',{},100000);s.playerData.shards=1e9;");
 assert.equal(run('s.maxLevel'),1000);assert.equal(run('s.runMaxLevel'),1);assert.equal(run("getMoonPurchaseAccess(s,'blood').unlocked"),false);
 assert.throws(()=>run("applyAction(s,'buyMoon',{id:'blood'},100100)"),/забега/);
 assert.equal(run("s.currentLevel=20;s=applyAction(s,'buyMoon',{id:'blood'},100200);s.ownedMoons.includes('blood')"),true);
 run("s=applyAction(s,'rollbackFive',{},100300);");assert.equal(run('s.currentLevel'),15);assert.equal(run("getMoonPurchaseAccess(s,'blood').unlocked"),true);
 run("delete s.runMaxLevel;s.currentLevel=1;s.maxLevel=1000;s=applyAction(s,'load',{},100400);");assert.equal(run('s.runMaxLevel'),1);assert.equal(run("getMoonPurchaseAccess(s,'ice').levelUnlocked"),false);
});
