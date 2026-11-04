const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return s=>vm.runInContext(s,c);}
test('ascension availability resets after collecting prestige, but respects the run record after rollback',()=>{
 const run=setup();for(const level of [1,19]){run('var s=freshState();s.currentLevel='+level);assert.equal(run('getPrestigeSummary(s).canAscend'),false);assert.throws(()=>run("applyAction(s,'ascend',{coins:999},100000)"));}
 run("s.currentLevel=20;s=applyAction(s,'sync',{},100000);s=applyAction(s,'rollbackFive',{},100100);");assert.equal(run('getPrestigeSummary(s).canAscend'),true);
 run("s=applyAction(s,'ascend',{},100200);");assert.equal(run('getPrestigeSummary(s).canAscend'),false);assert.throws(()=>run("applyAction(s,'ascend',{},100300)"));
});
test('all quests collect across categories, scale rewards and cannot be collected twice',()=>{
 const run=setup();run("var s=freshState();s.prestige.ascensions=2;s=applyAction(s,'load',{},100000);var ids=['clickDaily100','killBoss1','levelUp2'];s.quests={};for(var id of ids)s.quests[id]={completed:true,claimed:false,progress:QUESTS[id].target,target:QUESTS[id].target};s.quests.shardDaily200={completed:false,claimed:false,progress:0,target:200};var expected=ids.reduce((n,id)=>n+getQuestPayout(QUESTS[id],s).total,0);s=applyAction(s,'claimAllQuests',{reward:999999},100100);");
 assert.equal(run('s.playerData.shards'),run('expected'));assert.equal(run('s.claimSummary.count'),3);assert.equal(run('s.claimSummary.reward'),run('expected'));
 assert.equal(run('s.quests.shardDaily200.claimed'),false);assert.throws(()=>run("applyAction(s,'claimAllQuests',{},100200)"));
});
test('all achievement tiers collect once and include rewards they newly unlock',()=>{
 const run=setup();run("var s=freshState();s.prestige.ascensions=3;s.runClickCount=10000;s.clickCount=10000;s=applyAction(s,'load',{},100000);var before=s.playerData.shards;s=applyAction(s,'claimAllAchievements',{reward:999999},100100);");
 assert.ok(run('s.claimSummary.count')>=3);assert.equal(run('s.claimSummary.reward'),run('s.playerData.shards-before'));
 assert.equal(run("Object.values(s.achievements).some(tiers=>Object.values(tiers).includes('unclaimed'))"),false);
 assert.throws(()=>run("applyAction(s,'claimAllAchievements',{},100200)"));assert.equal(run("applyAction(s,'sync',{},100300).claimSummary"),null);
});
test('empty collection is refused and both buttons precede their lists',()=>{
 const run=setup();assert.throws(()=>run("applyAction(freshState(),'claimAllQuests',{},100000)"));assert.throws(()=>run("applyAction(freshState(),'claimAllAchievements',{},100000)"));
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(html.indexOf('id="claimAllQuestsBtn"')<html.indexOf('id="questsList"'));assert.ok(html.indexOf('id="claimAllAchievementsBtn"')<html.indexOf('id="achievementsList"'));
});
