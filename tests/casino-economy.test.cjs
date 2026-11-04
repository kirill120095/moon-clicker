const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('house expected payout never exceeds 79 percent and bankruptcy stays exactly 3 percent',()=>{
 const run=setup();let last=Infinity;
 for(let pressure=0;pressure<=50;pressure++){const result=JSON.parse(run("JSON.stringify((()=>{const s={wheelEconomy:{pressure:"+pressure+"}},w=getWheelWeights(s);return {total:w.reduce((a,b)=>a+b),bank:w[10],rtp:w.reduce((sum,p,i)=>sum+p*(typeof CONSTANTS.WHEEL.SECTORS[i]==='number'?CONSTANTS.WHEEL.SECTORS[i]:0),0)/10000};})())"));assert.equal(result.total,10000);assert.equal(result.bank,300);assert.ok(result.rtp<=.79+1e-12);assert.ok(result.rtp<=last);last=result.rtp;}
});
test('wins increase house pressure proportionally and losses reduce it without trusting payload',()=>{
 const run=setup();run("var s=freshState();s.playerData.shards=10000;s=applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true,pressure:0},100000,{canSpinWheel:true,wheelIndex:5})");
 assert.equal(run('s.wheelEconomy.pressure'),9);assert.equal(run('s.wheelEconomy.wagered'),100);assert.equal(run('s.wheelEconomy.payouts'),1000);assert.equal(run('s.wheelEconomy.houseNet'),-900);
 run("s=applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true,pressure:-100},106000,{canSpinWheel:true,wheelIndex:0})");assert.equal(run('s.wheelEconomy.pressure'),8);assert.equal(run('s.wheelEconomy.houseNet'),-800);
 run("s.currentLevel=20;s=applyAction(s,'ascend',{},112000)");assert.equal(run('s.wheelEconomy.pressure'),8);
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
