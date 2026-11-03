const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
test('combo relay requires the electric moon and a UFO, uses server price and cannot be bought twice',()=>{
 const run=setup();assert.throws(()=>run("var s=freshState();s.playerData.shards=1e6;applyAction(s,'buyUfoComboRelay',{cost:0},100000)"));
 assert.throws(()=>run("s.ownedMoons.push('electric');applyAction(s,'buyUfoComboRelay',{},100000)"));
 assert.equal(run("s.ufoLevel=1;s=applyAction(s,'buyUfoComboRelay',{cost:0},100000);s.playerData.shards"),0);
 assert.equal(run("s.ufoComboRelay"),true);assert.throws(()=>run("applyAction(s,'buyUfoComboRelay',{},100001)"));
});
test('purchased relay keeps existing normal combo through repeated UFO shots without granting manual clicks',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.ufoLevel=1;s.ufoComboRelay=true;s=applyAction(s,'click',{count:10},100000);for(var t=103000;t<=121000;t+=3000)s=applyAction(s,'sync',{},t);s.runtime._comboClicks"),10);
 assert.equal(run('s.clickCount'),10);assert.equal(run('s.lastClickAt'),100000);assert.equal(run('s.lastComboAt'),121000);
});
test('without relay the UFO does not preserve combo, and idle gaps still expire upgraded combo',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.ufoLevel=1;s=applyAction(s,'click',{count:10},100000);for(var t=103000;t<=121000;t+=3000)s=applyAction(s,'sync',{},t);s.runtime._comboClicks"),0);
 assert.equal(run("s.ufoComboRelay=true;s=applyAction(s,'click',{count:10},124000);s=applyAction(s,'sync',{},145000);s.runtime._comboClicks"),0);
});
test('relay cannot create combo or preserve fire and shadow stacks',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.ufoLevel=1;s.ufoComboRelay=true;s=applyAction(s,'load',{},100000);s=applyAction(s,'sync',{},103000);s.runtime._comboClicks"),0);
 assert.equal(run("s=freshState();s.ufoLevel=1;s.ufoComboRelay=true;s.maxSlots=3;s.activeMoons=['normal','fire','shadow'];s.ownedMoons=[...s.activeMoons];s.moonLevels={normal:1,fire:1,shadow:1};s=applyAction(s,'click',{count:10},100000);for(var t=103000;t<=121000;t+=3000)s=applyAction(s,'sync',{},t);s.runtime._fireStacks+s.runtime._shadowCritStacks"),0);
 assert.equal(run('s.runtime._comboClicks'),10);
});
test('ascension clears the ordinary relay upgrade',()=>{const run=setup();assert.equal(run("var s=freshState();s.currentLevel=50;s.ufoComboRelay=true;applyAction(s,'ascend',{},100000).ufoComboRelay"),false);});
test('boss payout is halved and kill preview equals credited amount',()=>{
 const run=setup();assert.equal(run('CONSTANTS.MOON_REWARD.BOSS_MULTIPLIER'),2.5);
 assert.equal(run("Math.random=()=>0.99;var s=freshState();s.currentLevel=10;s=applyAction(s,'load',{},100000);var base=Math.floor(5+10*2+Math.pow(10,1.3)*.5);s.moonReward"),run('Math.round(base*2.5)'));
 assert.equal(run("var preview=s.moonReward;s.moonHP=1;s=applyAction(s,'click',{count:1},100100);s.effects[0].reward"),run('preview'));
});
test('click damage can still upgrade far beyond its former cap',()=>{const run=setup();assert.equal(run("var s=freshState();s.playerData.click_damage_level=1000;s.playerData.shards=Number.MAX_SAFE_INTEGER;applyAction(s,'buyDamage',{},100000).playerData.click_damage_level"),1001);});
test('one formatter handles currency, HP and damage up to safe numeric limits',()=>{
 const c={};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/utils/numbers.js'),'utf8')),c);
 for(const [n,label] of [[12345,'12.3K'],[1234567,'1.2M'],[1234567890,'1.2B'],[1234567890000,'1.2T'],[1234567890000000,'1.2Qa']])assert.equal(vm.runInContext('formatNumber('+n+')',c),label);
});
test('HP labels and damage popups use the shared formatter without changing their numeric calculations',()=>{
 const renderer=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8'),animations=fs.readFileSync(path.join(__dirname,'../src/modules/ui/animations.js'),'utf8');
 assert.match(renderer,/formatNumber\(displayHP\)/);assert.match(renderer,/formatNumber\(state.maxHP\)/);assert.match(animations,/formatNumber\(damage\)/);
});
