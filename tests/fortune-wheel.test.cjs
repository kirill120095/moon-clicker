const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
test('wheel rejects forged owner, payout and outcome in client payload without mutating input',()=>{
 const run=setup();run('var s=freshState();s.playerData.shards=1000;var before=JSON.stringify(s)');
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true,canSpinWheel:true,wheelIndex:6,payout:999999},100000)"),/владельцу/);assert.equal(run('JSON.stringify(s)===before'),true);
});
test('every sector pays from server-selected outcome including losing stakes and full bankruptcy',()=>{
 const run=setup();
 for(let index=0;index<12;index++){
  run("var s=freshState();s.playerData.shards=1000;var next=applyAction(s,'spinWheel',{bet:101,acceptBankruptcy:true,wheelIndex:6,payout:999999},100000,{canSpinWheel:true,wheelIndex:"+index+"});");
  const m=run('CONSTANTS.WHEEL.SECTORS['+index+']'),expected=m==='bankrupt'?0:899+Math.floor(101*m);
  assert.equal(run('next.playerData.shards'),expected);assert.equal(run('next.wheelResult.index'),index);assert.equal(run('next.wheelResult.delta'),expected-1000);assert.equal(run('s.playerData.shards'),1000);
 }
});
test('invalid stakes, missing bankruptcy consent, bad outcomes and rapid spins cannot change funds',()=>{
 const run=setup();run('var s=freshState();s.playerData.shards=1000;var trusted={canSpinWheel:true,wheelIndex:1}');
 for(const bet of [0,-1,1.1,1001,NaN,Infinity,'100'])assert.throws(()=>run("applyAction(s,'spinWheel',{bet:"+JSON.stringify(bet)+",acceptBankruptcy:true},100000,trusted)"));
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:100},100000,trusted)"));
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true},100000,{canSpinWheel:true,wheelIndex:12})"));
 run("s=applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true},100000,trusted);var before=JSON.stringify(s)");
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true},105199,trusted)"),/окончания/);assert.equal(run('JSON.stringify(s)===before'),true);
 assert.equal(run("applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true},105200,trusted).playerData.shards"),1200);
});
test('wheel caps huge winnings and does not increment combat clicks or kill counters',()=>{
 const run=setup();run("var s=freshState();s.playerData.shards=CONSTANTS.SAFE_NUMBER_CAP;s=applyAction(s,'spinWheel',{bet:s.playerData.shards,acceptBankruptcy:true},100000,{canSpinWheel:true,wheelIndex:6})");
 assert.equal(run('s.playerData.shards'),Number.MAX_SAFE_INTEGER);assert.equal(run('s.clickCount'),0);assert.equal(run('s.moonKills'),0);assert.equal(run('s.bossKills'),0);
});
function uiSetup(){
 const nodes={},animations=[],particles=[];let spinCalls=0,resolveSpin,cleared=0;
 const classes=new Set(),form={elements:{bet:{value:'100'},risk:{}},reportValidity:()=>true};form.elements[Symbol.iterator]=function*(){yield this.bet;yield this.risk;};
 const result={replaceChildren(){},append(){}},rotor={style:{},animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;},finished:Promise.resolve()};animations.push(a);return a;}};
 const holder={replaceChildren(){particles.length=0;},append(p){particles.push(p);}};
 nodes['.fortune-rotor']=rotor;nodes['.fortune-result']=result;nodes['form']=form;nodes['.fortune-spin']={};nodes['.fortune-close']={};nodes['.fortune-particles']=holder;
 const c={CONSTANTS:{WHEEL:{SECTORS:[0,2,0,3,0,0,5,0,2,0,'bankrupt',0],WEIGHTS:[9,9,9,9,9,9,9,9,9,9,1,9],SPIN_MS:5200}},state:{playerData:{shards:1000}},audio:{purchase(){}},document:{getElementById:()=>null,createElement:()=>({style:{setProperty(){}},textContent:''})},window:{matchMedia:()=>({matches:false})},performance:{now:()=>100},setTimeout:()=>1,clearTimeout:()=>{cleared++;},console};
 vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/wheel.js'),'utf8')),c);
 const wheel=vm.runInContext('fortuneWheel',c);wheel.root={classList:{add:x=>classes.add(x),remove:(...xs)=>xs.forEach(x=>classes.delete(x))},querySelector:s=>nodes[s]};wheel.dialog={close(){},showModal(){}};wheel.rotor=rotor;wheel.result=result;wheel.form=form;wheel.button=nodes['.fortune-spin'];wheel.allowed=true;wheel.message=(...args)=>{wheel.lastMessage=args;};wheel.bind(()=>{spinCalls++;return new Promise(r=>{resolveSpin=r;});});
 return {wheel,animations,particles,classes,form,c,get calls(){return spinCalls;},get cleared(){return cleared;},resolve(result){resolveSpin({state:{wheelResult:result}});}};
}
test('every wheel sector lands at pointer after seven full revolutions even from fractional angles',()=>{
 const s=uiSetup();
 for(const start of [0,30,359,1423.25])for(let i=0;i<12;i++){
  const angle=vm.runInContext('wheelStopAngle('+i+',12,'+start+')',s.c);assert.ok(angle-start>=2520);assert.ok(Math.abs(((angle+i*30)%360))<1e-7);
 }
});
test('a slow result cannot start a second spin and confirmed reward stops on correct sector',async()=>{
 const s=uiSetup(),pending=s.wheel.play();await s.wheel.play();assert.equal(s.calls,1);assert.equal(s.form.elements.bet.disabled,true);
 s.resolve({index:6,multiplier:5,payout:500,delta:400});await pending;assert.ok(Math.abs(s.wheel.angle-149.4)<1e-7);assert.equal(s.wheel.busy,false);assert.equal(s.form.elements.bet.disabled,false);assert.ok(s.classes.has('fortune-win'));assert.equal(s.particles.length,28);assert.ok(s.animations.every(a=>a.cancelled));assert.match(s.wheel.lastMessage[0],/400/);
});
test('logout cancels animation and late server result cannot expose or restart wheel',async()=>{
 const s=uiSetup(),pending=s.wheel.play();s.wheel.disconnect();s.resolve({index:6,multiplier:5,payout:500,delta:400});await pending;
 assert.equal(s.wheel.allowed,false);assert.equal(s.wheel.busy,false);assert.equal(s.wheel.animations.length,0);assert.equal(s.particles.length,0);assert.ok(s.animations.every(a=>a.cancelled));assert.ok(s.classes.has('hidden'));assert.equal(s.form.elements.bet.disabled,false);
});
test('reduced motion lands without spinning or confetti',async()=>{
 const s=uiSetup();s.c.window.matchMedia=()=>({matches:true});const pending=s.wheel.play();s.resolve({index:1,multiplier:2,payout:200,delta:100});await pending;assert.equal(s.animations.length,0);assert.equal(s.particles.length,0);assert.ok(Math.abs(s.wheel.angle-311.4)<1e-7);
});

async function edgeSetup({admin=false,conflict=false,cached=false}={}){
 const {stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto');
 let handler,commits=0,loads=0,authHeader,randomCalls=0,contexts=[];
 const uid='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000002';
 const c={Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://example.test':'test-service'},serve:fn=>{handler=fn;}},crypto:{subtle:webcrypto.subtle,getRandomValues:a=>{randomCalls++;a[0]=7;return a;}},getWheelSectorIndex:()=>7,CONSTANTS:{WHEEL:{SECTORS:Array(12).fill(0),WEIGHTS:[9,9,9,9,9,9,9,9,9,9,1,9]}},TextEncoder,TextDecoder,Uint8Array,Uint32Array,Response,Request,AbortSignal,btoa,atob,setTimeout,console,structuredClone,
 freshState:()=>({balance:1000}),applyAction:(s,a,p,n,trust)=>{contexts.push(trust);return {balance:900};},fetch:async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:uid});
  if(url.endsWith('/rpc/is_game_admin')){authHeader=options.headers.Authorization;return Response.json(admin);}
  if(url.endsWith('/rpc/game_load')){loads++;return Response.json(cached?{cached:{state:{balance:900},revision:2}}:{state:{balance:1000},revision:1});}
  if(url.endsWith('/rpc/game_commit_safe')){commits++;const args=JSON.parse(options.body);if(conflict&&commits===1)return Response.json({conflict:true});return Response.json(args.p_response);}
  return Response.json(null);
 }};
 vm.createContext(c);const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions/index.ts'),'utf8').replace(/^import .*;$/gm,'');vm.runInContext(stripTypeScriptTypes(source,{mode:'strip'}),c);
 const token='a.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid})).toString('base64url')+'.c',authorization='Bearer '+token;
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization},body:JSON.stringify({action:'spinWheel',payload:{bet:100,canSpinWheel:true,wheelIndex:6},request_id:'00000000-0000-4000-8000-000000000003'})}));
 return {response,commits,loads,authHeader,authorization,randomCalls,contexts};
}
test('Edge gate refuses non-owner before loading or committing a save',async()=>{
 const s=await edgeSetup();assert.equal(s.response.status,403);assert.equal(s.loads,0);assert.equal(s.commits,0);assert.equal(s.randomCalls,0);assert.equal(s.authHeader,s.authorization);
});
test('authenticated role check uses user token and conflict retry cannot reroll sector',async()=>{
 const s=await edgeSetup({admin:true,conflict:true});assert.equal(s.response.status,200);assert.equal(s.commits,2);assert.equal(s.randomCalls,1);assert.equal(s.authHeader,s.authorization);assert.equal(s.contexts.length,2);
 for(const trust of s.contexts){assert.equal(trust.canSpinWheel,true);assert.equal(trust.wheelIndex,7);}
});
test('cached request never runs wheel payout again',async()=>{
 const s=await edgeSetup({admin:true,cached:true});assert.equal(s.response.status,200);assert.equal(s.contexts.length,0);assert.equal(s.commits,1);
});

test('100 integer tickets give exactly one bankruptcy and sector widths match winning probabilities',()=>{
 const run=setup(),counts=Array(12).fill(0);
 for(let ticket=0;ticket<100;ticket++)counts[run('getWheelSectorIndex('+ticket+')')]++;
 assert.deepEqual(counts,[9,9,9,9,9,9,9,9,9,9,1,9]);assert.equal(run("CONSTANTS.WHEEL.SECTORS.filter(m=>m===.5||m===1).length"),0);
 for(const ticket of [-1,100,.5])assert.throws(()=>run('getWheelSectorIndex('+ticket+')'));
});
test('weighted wheel stops in exact center of every visible sector including narrow bankruptcy',()=>{
 const s=uiSetup(),weights=[9,9,9,9,9,9,9,9,9,9,1,9];let start=0;
 for(let i=0;i<weights.length;i++){const center=(start+weights[i]/2)*3.6;const angle=vm.runInContext('wheelStopAngle('+i+','+JSON.stringify(weights)+',1391.25)',s.c);assert.ok(angle>=1391.25+2520);assert.ok(Math.abs((angle+center)%360)<1e-7);start+=weights[i];}
});
test('fortune tab follows achievements, switches centrally and closes with other tabs or shop panel',()=>{
 const active=new Set(),contentActive=new Set();let opened=0,closed=0;
 const classes=()=>({add:x=>active.add(x),remove:x=>active.delete(x),contains:x=>active.has(x),toggle(x,on){if(on)active.add(x);else active.delete(x);}});
 const fortune={allowed:true,open(){opened++;},close(){closed++;}},panel={classList:classes(),querySelectorAll:()=>[]},content={classList:{add:x=>contentActive.add(x)}};
 const c={window:{},fortuneWheel:fortune,document:{addEventListener(){},getElementById:id=>id==='shopPanel'?panel:id==='fortuneTabContent'?content:null},console};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/events.js'),'utf8')),c);
 c.window.switchShopTab('fortune');assert.equal(opened,1);assert.ok(contentActive.has('active'));c.window.switchShopTab('achievements');assert.equal(closed,2);
 fortune.allowed=false;c.window.switchShopTab('fortune');assert.equal(opened,1);c.window.closePanel('shopPanel');assert.equal(closed,3);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(html.indexOf('id="fortuneTabButton"')>html.indexOf('data-tab="achievements"'));assert.match(html,/id="fortuneTabButton" class="panel-tab hidden"/);
});
