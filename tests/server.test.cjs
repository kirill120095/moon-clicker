const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(root,'supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
test('client supplied currency and damage are ignored',()=>{const run=setup();assert.equal(run("applyAction(freshState(),'load',{shards:999999,click_damage:999999},100000).playerData.shards"),0);});
test('clicks are counted by server and bursts rejected',()=>{const run=setup();assert.equal(run("applyAction(freshState(),'click',{count:3,total_clicks:9999},100000).clickCount"),3);assert.throws(()=>run("applyAction(freshState(),'click',{count:13},100000)"));});
test('rapid repeated batches exhaust the server token budget',()=>{const run=setup();assert.throws(()=>run("var s=applyAction(freshState(),'click',{count:12},100000);applyAction(s,'click',{count:1},100000)"));});
test('purchase uses server price and damage upgrade',()=>{const run=setup();assert.equal(run("var s=freshState();s.playerData.shards=100;applyAction(s,'buyDamage',{cost:0},100000).playerData.shards"),40);assert.equal(run("applyAction(s,'buyDamage',{cost:0},100000).playerData.click_damage"),30);});
test('unaffordable purchases and unearned rewards fail',()=>{const run=setup();assert.throws(()=>run("applyAction(freshState(),'buyDamage',{},100000)"));assert.throws(()=>run("applyAction(freshState(),'claimQuest',{id:'fake'},100000)"));});
test('unowned moons cannot be activated',()=>{assert.throws(()=>setup()("applyAction(freshState(),'toggleMoon',{id:'cosmic'},100000)"));});
test('state input is not modified by failed actions',()=>{const run=setup();assert.equal(run("var s=freshState();try{applyAction(s,'buyDamage',{},100000)}catch{};s.playerData.shards"),0);});
test('HP and level cap stay within safe integer range',()=>{const run=setup();assert.equal(run('Number.isSafeInteger(getMaxHPForLevel(CONSTANTS.MAX_PLAYER_LEVEL))'),true);});

test('browser and server balance definitions are identical',()=>{assert.equal(fs.readFileSync(path.join(root,'src/core/constants.js'),'utf8'),fs.readFileSync(path.join(root,'supabase/functions/game-actions/constants.js'),'utf8'));assert.equal(fs.readFileSync(path.join(root,'src/core/config.js'),'utf8'),fs.readFileSync(path.join(root,'supabase/functions/game-actions/config.js'),'utf8'));});
