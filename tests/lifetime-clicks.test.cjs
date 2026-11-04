const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('ascension preserves the leaderboard count while resetting run clicks, quests and click achievements',()=>{
 const run=setup();run("var s=freshState();s.clickCount=100;s.runClickCount=100;s.currentLevel=20;s=applyAction(s,'load',{},100000);");
 assert.equal(run("s.achievements.clickNovice.bronze"),'unclaimed');
 run("s=applyAction(s,'ascend',{},100100);");assert.equal(run('s.clickCount'),100);assert.equal(run('s.runClickCount'),0);assert.equal(run('s.achievements.clickNovice?.bronze'),undefined);
 assert.equal(run('Object.values(s.quests).every(q=>!q.progress&&!q.claimed)'),true);
 run("s=applyAction(s,'click',{count:1,clickCount:999999,runClickCount:999999},100200);");assert.equal(run('s.clickCount'),101);assert.equal(run('s.runClickCount'),1);
 run("s.currentLevel=20;s=applyAction(s,'ascend',{},100300);");assert.equal(run('s.clickCount'),101);assert.equal(run('s.runClickCount'),0);
});
test('legacy saves initialize run count once and preserve totals through load and ascension',()=>{
 const run=setup();run("var s=freshState();delete s.runClickCount;s.clickCount=37;s=applyAction(s,'load',{},100000);");
 assert.equal(run('s.runClickCount'),37);assert.equal(run('s.clickCount'),37);
 run("s.currentLevel=20;s=applyAction(s,'ascend',{},100100);s=applyAction(JSON.parse(JSON.stringify(s)),'load',{},100200);");
 assert.equal(run('s.clickCount'),37);assert.equal(run('s.runClickCount'),0);
});
test('UFO shots increment lifetime and run counts once while echoes do not add clicks',()=>{
 const run=setup();run("Math.random=()=>0;var s=freshState();s.clickCount=1000;s.runClickCount=2;s.ufoLevel=1;s.prestige.upgrades.echo=10;s.moonHP=1e12;s.maxHP=1e12;s=applyAction(s,'load',{},100000);s=applyAction(s,'sync',{},103000);");
 assert.equal(run('s.clickCount'),1001);assert.equal(run('s.runClickCount'),3);
 run("s=applyAction(s,'sync',{},103000);");assert.equal(run('s.clickCount'),1001);
 run("s=applyAction(s,'click',{count:1},103100);");assert.equal(run('s.clickCount'),1002);assert.equal(run('s.runClickCount'),4);assert.ok(run("s.effects.some(e=>e.source==='echo')"));
});
test('the profile and leaderboard payload use lifetime clicks, and achievements use run clicks',()=>{
 const run=setup();run('var s=freshState();s.clickCount=1000000;s.runClickCount=0;');
 assert.equal(run("ACHIEVEMENTS.clickNovice.check(s,ACHIEVEMENTS.clickNovice.tiers[0])"),false);
 run('s.runClickCount=100;');assert.equal(run("ACHIEVEMENTS.clickNovice.check(s,ACHIEVEMENTS.clickNovice.tiers[0])"),true);
 const secure=fs.readFileSync(path.join(__dirname,'../src/modules/game/secure-game.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8');
 assert.match(secure,/total_clicks:s.clickCount/);assert.match(secure,/runClickCount:s.runClickCount/);assert.match(ui,/data-live-stat="lifetimeClicks"/);assert.match(ui,/data-live-stat="runClicks"/);
});
