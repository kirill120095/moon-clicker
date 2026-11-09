const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('sector multipliers determine expected payout regardless of past wins',()=>{
 const run=setup();
 for(const pressure of [0,25,50])for(const [choice,expected] of [['red',45/37],['black',45/37],['zero',50/37]]){
  const weights=JSON.parse(run('JSON.stringify(getWheelWeights({wheelEconomy:{pressure:'+pressure+'}}))'));
  const sectors=JSON.parse(run('JSON.stringify(CONSTANTS.WHEEL.SECTORS)'));
  const payouts=JSON.parse(run('JSON.stringify(CONSTANTS.WHEEL.MULTIPLIERS)'));
  const winnings=weights.reduce((sum,weight,index)=>sum+(sectors[index]===choice?weight*payouts[index]:0),0);
  assert.equal(winnings/weights.reduce((sum,n)=>sum+n,0),expected);
 }
});
test('roulette totals use server payouts and survive ascension',()=>{
 const run=setup();run("var s=freshState();s.playerData.shards=10000;s=applyAction(s,'spinWheel',{bet:100,choice:'red',payout:999999},100000,{canSpinWheel:true,wheelIndex:5})");
 assert.equal(run('s.wheelEconomy.wagered'),100);assert.equal(run('s.wheelEconomy.payouts'),200);assert.equal(run('s.wheelEconomy.houseNet'),-100);assert.equal(run('s.wheelEconomy.totalWon'),100);assert.equal(run('s.wheelEconomy.totalLost'),0);
 run("s=applyAction(s,'spinWheel',{bet:100,choice:'red'},106000,{canSpinWheel:true,wheelIndex:0})");assert.equal(run('s.wheelEconomy.houseNet'),0);assert.equal(run('s.wheelEconomy.totalWon'),100);assert.equal(run('s.wheelEconomy.totalLost'),100);
 run("s.currentLevel=20;s=applyAction(s,'ascend',{},112000)");assert.equal(run('s.wheelEconomy.totalWon'),100);assert.equal(run('s.wheelEconomy.totalLost'),100);
});
test('visible balance holds only the roulette delta and keeps normal game income visible',()=>{
 const c={};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/currency-display.js'),'utf8')),c);
 assert.equal(vm.runInContext('getVisibleShards(1000)',c),1000);
 vm.runInContext('beginWheelBalance();maskWheelDelta(900)',c);assert.equal(vm.runInContext('getVisibleShards(1900)',c),1000);assert.equal(vm.runInContext('getVisibleShards(1950)',c),1050);
 vm.runInContext('revealWheelBalance()',c);assert.equal(vm.runInContext('getVisibleShards(1950)',c),1950);
 vm.runInContext('beginWheelBalance();maskWheelDelta(-1950)',c);assert.equal(vm.runInContext('getVisibleShards(0)',c),1950);vm.runInContext('revealWheelBalance()',c);assert.equal(vm.runInContext('getVisibleShards(0)',c),0);
});
test('late results after logout cannot install a new balance mask',()=>{
 const c={};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/currency-display.js'),'utf8')),c);
 vm.runInContext('beginWheelBalance();revealWheelBalance();maskWheelDelta(-1000)',c);assert.equal(vm.runInContext('getVisibleShards(0)',c),0);
});

test('return to record uses only this run, refreshes combat and never pays for the jump',()=>{
 const run=setup();run("var s=freshState();s.currentLevel=40;s.runMaxLevel=100;s.maxLevel=9000;s.playerData.shards=777;s=applyAction(s,'load',{},100000);var clicks=s.clickCount,coins=JSON.stringify(s.prestige);s=applyAction(s,'returnToRecord',{level:9000,reward:9999},100100)");
 assert.equal(run('s.currentLevel'),100);assert.equal(run('s.playerData.shards'),777);assert.equal(run('s.clickCount===clicks'),true);assert.equal(run('JSON.stringify(s.prestige)===coins'),true);assert.equal(run('s.moonHP'),run('s.maxHP'));assert.ok(run('s.bossDeadline')>100100);assert.throws(()=>run("applyAction(s,'returnToRecord',{},100200)"));
 run("s=applyAction(s,'ascend',{},100300)");assert.equal(run('s.runMaxLevel'),1);assert.throws(()=>run("applyAction(s,'returnToRecord',{},100400)"));
});

test('zero against a red bet takes only the stake',()=>{const run=setup();run("var s=freshState();s.playerData.shards=1500;s=applyAction(s,'spinWheel',{bet:75,choice:'red'},100000,{canSpinWheel:true,wheelIndex:0})");assert.equal(run('s.playerData.shards'),1425);assert.equal(run('s.wheelEconomy.totalLost'),75);assert.equal(run('s.wheelEconomy.totalWon'),0);});

test('jump to unlocked level accepts earlier and cleared run levels, rejects locked or invalid targets',()=>{
 const run=setup();run("var s=freshState();s.currentLevel=25;s.runMaxLevel=25;s.maxLevel=1000;s=applyAction(s,'jumpToLevel',{level:5},100000)");
 assert.equal(run('s.currentLevel'),5);assert.equal(run('s.maxLevel'),1000);
 run("s=applyAction(s,'jumpToLevel',{level:25},100100)");assert.equal(run('s.currentLevel'),25);
 assert.throws(()=>run("applyAction(s,'jumpToLevel',{level:26},100200)"));
 assert.throws(()=>run("applyAction(s,'jumpToLevel',{level:1.5},100200)"));
 assert.throws(()=>run("applyAction(s,'jumpToLevel',{level:0},100200)"));
});

test('casino totals are synchronized into client state and rendered live in profile',()=>{
 const client=fs.readFileSync(path.join(__dirname,'../src/modules/game/secure-game.js'),'utf8');
 const renderer=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8');
 assert.match(client,/wheelEconomy:s\.wheelEconomy\|\|\{\}/);
 assert.match(renderer,/data-live-stat="casinoLost"/);
 assert.match(renderer,/data-live-stat="casinoWon"/);
 assert.match(renderer,/casinoLost:formatMoney\(getVisibleCasinoTotals\(state\.wheelEconomy\)\.totalLost/);
 assert.match(renderer,/casinoWon:formatMoney\(getVisibleCasinoTotals\(state\.wheelEconomy\)\.totalWon/);
});

test('casino win/loss counters are frozen until the wheel animation reveals its result',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/modules/ui/currency-display.js'),'utf8');
 const wheel=fs.readFileSync(path.join(__dirname,'../src/modules/ui/moon-wheel-v2.js'),'utf8');
 const renderer=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8');
 assert.match(source,/casinoSnapshot=\{totalWon:/);
 assert.match(source,/getVisibleCasinoTotals\(totals\)/);
 assert.match(source,/casinoSnapshot=null/);
 assert.match(wheel,/beginWheelBalance\(state\.wheelEconomy\)/);
 assert.match(wheel,/revealWheelBalance\(\);this\.onReveal\?\.\(\)/);
 assert.match(renderer,/getVisibleCasinoTotals\(state\.wheelEconomy\)\.totalWon/);
 assert.match(renderer,/getVisibleCasinoTotals\(state\.wheelEconomy\)\.totalLost/);
});
