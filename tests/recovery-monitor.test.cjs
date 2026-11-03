const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/^export\s*\{[^}]*\};?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
test('18 clicks per second permits bounded network jitter but rejects oversized batches',()=>{
 const run=setup();assert.equal(run("CONSTANTS.MAX_CLICKS_PER_SECOND"),18);
 assert.equal(run("var s=freshState();for(var t of [100000,101200,102050,103350])s=applyAction(s,'click',{count:18},t);s.clickCount"),72);
 assert.throws(()=>run("applyAction(s,'click',{count:19},104000)"));
});
test('live combat profile includes prestige, combo, heat and critical stacks without mutating state',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.maxSlots=3;s.activeMoons=['normal','fire','shadow'];s.moonLevels={normal:1,fire:1,shadow:10};s.prestige.upgrades={reactor:2,critical:202};s.runtime={_comboClicks:20,_fireStacks:50,_shadowCritStacks:100};s.lastClickAt=100000;var before=JSON.stringify(s);var live=getCombatStats(s,100100);JSON.stringify(s)===before"),true);
 assert.ok(run('live.damageBonus')>.3);assert.ok(run('live.critChance')>2);assert.ok(run('live.critMultiplier')>2);
 assert.ok(run("live.sources.some(s=>s.id==='prestige')&&live.sources.some(s=>s.id==='combo')&&live.sources.some(s=>s.id==='heat')"));
});
test('live expired buffs agree with server damage after sync',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.activeMoons=['fire'];s.moonLevels.fire=1;s.runtime={_fireStacks:50};s.lastClickAt=100000;var live=getCombatStats(s,116000);var saved=applyAction(s,'sync',{},116000);live.finalDamage===saved.finalDamage"),true);
 assert.equal(run("live.sources.some(s=>s.id==='heat')"),false);
});
test('displayed shard payout and UFO damage agree with the server under gold and prestige bonuses',()=>{
 const run=setup();assert.equal(run("var s=freshState();s.currentLevel=20;s.activeMoons=['gold'];s.moonLevels.gold=10;s.ufoLevel=1;s.prestige.upgrades={treasury:2,fleet:3};s=applyAction(s,'load',{},100000);var live=getCombatStats(s,100000);live.moonReward===s.moonReward&&live.ufoDamage===s.ufoDamage"),true);
});
test('diagnostics redact credentials and keep only a bounded local history',()=>{
 const c={console,Date,Set};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/utils/diagnostics.js'),'utf8')),c);
 const secret='Bearer '+ 'a'.repeat(16)+'.'+'b'.repeat(16)+'.'+'c'.repeat(16)+' password=private sb_secret_abc123 test@example.com';
 const safe=vm.runInContext('safeDiagnosticMessage('+JSON.stringify(secret)+')',c);assert.doesNotMatch(safe,/private|abc123|test@example|aaaaaaaa/);
 vm.runInContext("for(var i=0;i<150;i++)recordDiagnostic('game','load','ERR'+i,'Unavailable');",c);assert.equal(vm.runInContext('getDiagnostics().length',c),100);
});
test('Data API failures pause queued requests instead of immediately hammering the server',async()=>{
 let now=100000,calls=0;const client={functions:{invoke:async()=>{calls++;return{error:{context:{status:503,json:async()=>({error:'Unavailable',code:'PGRST003'})}}};}}};
 const c={window:{supabase:{createClient:()=>client},localStorage:{}},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},Date:{now:()=>now},recordDiagnostic(){},console,Promise,Error};
 vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/network/supabase.js'),'utf8')),c);
 await assert.rejects(vm.runInContext("db.action('load')",c));await assert.rejects(vm.runInContext("db.action('load')",c));assert.equal(calls,1);
 now+=2100;await assert.rejects(vm.runInContext("db.action('load')",c));assert.equal(calls,2);
});
test('API outages do not trigger a second game_load inside the action error handler',async()=>{
 const {stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto');
 const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions/index.ts'),'utf8').replace(/^import .*;$/gm,'');
 let handler,loads=0;const uid='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000002';
 const c={Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://example.test':'test-service'},serve:fn=>{handler=fn;}},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Response,Request,AbortSignal,btoa,atob,setTimeout,console,structuredClone,applyAction:s=>s,freshState:()=>({}),fetch:async url=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:uid});
  if(url.endsWith('/rpc/game_load')){loads++;return Response.json({code:'PGRST003',message:'Timed out acquiring connection from connection pool.'},{status:504});}
  return Response.json(null);
 }};
 vm.createContext(c);vm.runInContext(stripTypeScriptTypes(source,{mode:'strip'}),c);
 const token='a.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid})).toString('base64url')+'.c';
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({action:'load',request_id:'00000000-0000-4000-8000-000000000003'})}));
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PGRST003');assert.equal(loads,1);
});
test('click particle creation is bounded and reduced-effects mode skips particles',()=>{
 let created=0,finishes=[],reduced=false;const c={document:{hidden:false,body:{classList:{contains:()=>reduced},appendChild(){}},createElement:()=>{created++;return{style:{},remove(){},animate(){const animation={};finishes.push(animation);return animation;}}}},console};
 vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/animations.js'),'utf8')),c);
 vm.runInContext("animations.createParticles(null,{count:100,x:0,y:0});animations.createParticles(null,{count:100,x:0,y:0});",c);assert.equal(created,64);for(const a of finishes)a.onfinish();
 reduced=true;vm.runInContext("animations.createParticles(null,{count:100,x:0,y:0});",c);assert.equal(created,64);
});
