const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('variant A bonuses and additive integer prices match the selected examples',()=>{
 const run=setup();assert.equal(run('PRESTIGE_UPGRADES.reactor.damage'),.25);assert.equal(run('PRESTIGE_UPGRADES.treasury.shards'),.25);assert.equal(run('PRESTIGE_UPGRADES.fleet.ufoDamage'),.15);
 assert.equal(run('PRESTIGE_UPGRADES.capital.shards'),2000);assert.equal(run('PRESTIGE_UPGRADES.hunter.damage'),.25);assert.equal(run('PRESTIGE_UPGRADES.hunter.time'),2);assert.equal(run('PRESTIGE_UPGRADES.archive.perKill'),1.5);assert.equal(run('PRESTIGE_UPGRADES.critical.crit'),.03);
 for(const [id,prices] of [['echo',[25,30,35,40,46]],['archive',[30,36,42,48,55]]])for(let level=0;level<prices.length;level++)assert.equal(run("getPrestigeUpgradeCost('"+id+"',"+level+")"),prices[level]);
 for(const id of ['reactor','treasury','fleet','echo','capital','hunter','archive','critical'])for(let level=1;level<100;level++){
  const price=run("getPrestigeUpgradeCost('"+id+"',"+level+")");assert.ok(Number.isInteger(price));assert.ok(price>run("getPrestigeUpgradeCost('"+id+"',"+(level-1)+")"));
 }
 assert.equal(run("getPrestigeUpgradeCost('orbit',0)"),1000);assert.equal(run("getPrestigeUpgradeCost('orbit',1)"),Infinity);
});
test('clock and all combined haste stay below 100 percent and respect minimum interval',()=>{
 const run=setup();run("var s=freshState();s.ufoLevel=5;s.maxSlots=2;s.activeMoons=['ice','clone'];s.ownedMoons=['normal','ice','clone'];s.moonLevels={ice:10,clone:10};s.cloneTargets=['ice'];s.prestige.upgrades.clock=1000000;");
 assert.equal(run('getPrestigeSummary(s).ufoHaste'),.95);assert.ok(run('getUfoBonuses(s).haste')<=.95);assert.ok(run("applyAction(s,'load',{},100000).ufoInterval")>=100);
 run('s.prestige.upgrades.clock=49;s.prestige.coins=100000;');assert.throws(()=>run("applyAction(s,'buyPrestige',{id:'clock'},100000)"));
});
test('echo over 100 percent gives guaranteed repeats and rolls only the fractional remainder',()=>{
 const run=setup();for(const [chance,random,expected] of [[0,0,0],[.1,.09,1],[.1,.11,0],[1,0,1],[1.07,.069,2],[1.07,.071,1],[2.5,.49,3],[2.5,.51,2],[3,.99,3]])assert.equal(run('rollEchoRepeats('+chance+',()=>'+random+')'),expected);
 run("Math.random=()=>.99;var s=freshState();s.prestige.upgrades.echo=25;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'click',{count:1},100000);");
 assert.equal(run("s.effects.filter(e=>e.source==='echo').length"),2);assert.equal(run('s.clickCount'),1);assert.equal(run("applyAction(s,'sync',{},100001).effects.length"),0);
});
test('large echo bursts have bounded work, persist and drain without generating more clicks or crystals',()=>{
 const run=setup();run("Math.random=()=>.99;var s=freshState();s.prestige.upgrades.echo=5000;s.clickCrystalLevel=1;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'click',{count:1},100000);var echoCount=s.effects.filter(e=>e.source==='echo').length;");
 assert.equal(run('echoCount'),128);assert.equal(run('s.echoPending'),372);assert.equal(run('s.playerData.shards'),1);
 run("for(var i=1;i<=3;i++){s=applyAction(JSON.parse(JSON.stringify(s)),'sync',{},100000+i);echoCount+=s.effects.filter(e=>e.source==='echo').length;}");
 assert.equal(run('echoCount'),500);assert.equal(run('s.echoPending'),0);assert.equal(run('s.echoQueue.length'),0);assert.equal(run('s.clickCount'),1);assert.equal(run('s.playerData.shards'),1);
});
test('quest and achievement rewards scale by 25 percent per ascension with exact preview rounding',()=>{
 const run=setup();
 for(const n of [0,1,2,10]){
  run('var s=freshState();s.prestige.ascensions='+n+';var q=QUESTS.clickDaily100;var payout=getQuestPayout(q,s);');
  assert.equal(run('payout.total'),Math.round(38*(1+.25*n)));assert.equal(run('payout.base+payout.bonus'),run('payout.total'));
  run("s=applyAction(s,'load',{},100000);s.quests[q.id]={progress:q.target,target:q.target,completed:true,claimed:false};s=applyAction(s,'claimQuest',{id:q.id},100100);");
  assert.equal(run('s.playerData.shards'),run('payout.total'));assert.throws(()=>run("applyAction(s,'claimQuest',{id:q.id},100200)"));
  run("var a=Object.values(ACHIEVEMENTS)[0],tier=a.tiers[0],before=s.playerData.shards;s.achievements[a.id]={[tier.level]:'unclaimed'};s=applyAction(s,'claimAchievement',{id:a.id,tier:tier.level},100300);");
  assert.equal(run('s.playerData.shards-before'),run('getProgressReward(tier.reward,s)'));
 }
 run("s=freshState();s.currentLevel=20;s=applyAction(s,'ascend',{},100000);");assert.equal(run('s.prestigeSummary.rewardMultiplier'),1.25);
 run("s.currentLevel=20;s=applyAction(s,'ascend',{},100100);");assert.equal(run('s.prestigeSummary.rewardMultiplier'),1.5);
});
