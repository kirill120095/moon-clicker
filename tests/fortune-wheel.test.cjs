const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
test('wheel rejects forged session, payout and outcome in client payload without mutating input',()=>{
 const run=setup();run('var s=freshState();s.playerData.shards=1000;var before=JSON.stringify(s)');
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:100,acceptBankruptcy:true,canSpinWheel:true,wheelIndex:6,payout:999999},100000)"),/сессия/);assert.equal(run('JSON.stringify(s)===before'),true);
});
test('every sector pays from the server outcome and ignores forged payload winnings',()=>{
 const run=setup();
 const payouts=[50,2,2,2,2,2,2,5,5,2,2,3,3,2,2,2,2];
 for(let index=0;index<payouts.length;index++){
  const sector=run('CONSTANTS.WHEEL.SECTORS['+index+']');
  for(const choice of ['red','black','zero']){
   run("var s=freshState();s.playerData.shards=1000;var next=applyAction(s,'spinWheel',{bet:50,choice:"+JSON.stringify(choice)+",wheelIndex:6,payout:999999},100000,{canSpinWheel:true,wheelIndex:"+index+"});");
   const expected=950+(sector===choice?50*payouts[index]:0);
   assert.equal(run('next.wheelResult.sectorMultiplier'),payouts[index]);
   assert.equal(run('next.playerData.shards'),expected);assert.equal(run('next.wheelResult.index'),index);assert.equal(run('next.wheelResult.delta'),expected-1000);assert.equal(run('s.playerData.shards'),1000);
  }
 }
});
test('invalid stakes, choices, bad outcomes and rapid spins cannot change funds',()=>{
 const run=setup();run('var s=freshState();s.playerData.shards=1000;var trusted={canSpinWheel:true,wheelIndex:1}');
 for(const bet of [0,-1,1.1,1001,NaN,Infinity,'50'])assert.throws(()=>run("applyAction(s,'spinWheel',{bet:"+JSON.stringify(bet)+",choice:'red'},100000,trusted)"),/ставка/);
 assert.equal(run("applyAction(s,'spinWheel',{bet:500,choice:'red'},100000,trusted).playerData.shards"),1500);
 assert.equal(run("applyAction(s,'spinWheel',{bet:1000,choice:'red'},100000,trusted).playerData.shards"),2000);
 assert.equal(run("applyAction(s,'spinWheel',{bet:1000,choice:'black'},100000,trusted).playerData.shards"),0);
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:50},100000,trusted)"),/Выберите/);
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:50,choice:'red'},100000,{canSpinWheel:true,wheelIndex:17})"),/сектор/);
 run("s=applyAction(s,'spinWheel',{bet:50,choice:'red'},100000,trusted);var before=JSON.stringify(s),nextAt=100000+CONSTANTS.WHEEL.COOLDOWN_MS");
 assert.throws(()=>run("applyAction(s,'spinWheel',{bet:50,choice:'red'},nextAt-1,trusted)"),/окончания/);assert.equal(run('JSON.stringify(s)===before'),true);
 assert.equal(run("applyAction(s,'spinWheel',{bet:50,choice:'red'},nextAt,trusted).playerData.shards"),1100);
});
test('wheel caps huge winnings and does not increment combat clicks or kill counters',()=>{
 const run=setup();run("var s=freshState();s.playerData.shards=CONSTANTS.SAFE_NUMBER_CAP;s=applyAction(s,'spinWheel',{bet:Math.floor(s.playerData.shards*.05),choice:'zero'},100000,{canSpinWheel:true,wheelIndex:0})");
 assert.equal(run('s.playerData.shards'),Number.MAX_SAFE_INTEGER);assert.equal(run('s.clickCount'),0);assert.equal(run('s.moonKills'),0);assert.equal(run('s.bossKills'),0);
});
function uiSetup(){
 const nodes={},animations=[],particles=[];let spinCalls=0,resolveSpin,cleared=0;
 const classes=new Set(),form={elements:{bet:{value:'50'}},reportValidity:()=>true,querySelector:()=>({value:'red'})};form.elements[Symbol.iterator]=function*(){yield this.bet;};
 const result={replaceChildren(){},append(){},animate(){return {finished:Promise.resolve(),cancel(){}};}},rotor={style:{},animate(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;},finished:Promise.resolve()};animations.push(a);return a;}};
 const holder={replaceChildren(){particles.length=0;},append(p){particles.push(p);}};
 nodes['.fortune-rotor']=rotor;nodes['.fortune-result']=result;nodes['form']=form;nodes['.fortune-spin']={};nodes['.fortune-close']={};nodes['.fortune-particles']=holder;nodes['.fortune-outcome']={hidden:true,textContent:''};
 const c={state:{playerData:{shards:1000}},audio:{purchase(){}},document:{getElementById:()=>null,createElement:()=>({style:{setProperty(){}},textContent:''})},window:{matchMedia:()=>({matches:false})},performance:{now:()=>100},setTimeout:()=>1,clearTimeout:()=>{cleared++;},console};
 vm.createContext(c);vm.runInContext(['core/constants.js','modules/ui/currency-display.js','modules/ui/moon-wheel-v2.js'].map(file=>strip(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'))).join('\n'),c);
 const wheel=vm.runInContext('fortuneWheel',c);wheel.root={dataset:{},classList:{add:x=>classes.add(x),remove:(...xs)=>xs.forEach(x=>classes.delete(x))},querySelector:s=>nodes[s]};wheel.rotor=rotor;wheel.result=result;wheel.form=form;wheel.button=nodes['.fortune-spin'];wheel.allowed=true;wheel.message=(...args)=>{wheel.lastMessage=args;};wheel.bind(()=>{spinCalls++;return new Promise(r=>{resolveSpin=r;});});
 return {wheel,animations,particles,classes,form,c,get calls(){return spinCalls;},get cleared(){return cleared;},resolve(result){resolveSpin({state:{wheelResult:result}});}};
}
test('every wheel sector lands at pointer after seven full revolutions even from fractional angles',()=>{
 const s=uiSetup();
 for(const start of [0,30,359,1423.25])for(let i=0;i<17;i++){
  const center=(i+.5)*360/17,angle=vm.runInContext('wheelStopAngle('+(i+.5)+',17,'+start+')',s.c);assert.ok(angle-start>=2520);assert.ok(Math.abs((angle+center)/360-Math.round((angle+center)/360))<1e-10);
 }
});
test('a slow result cannot start a second spin and confirmed reward stops on correct sector',async()=>{
 const s=uiSetup(),pending=s.wheel.play();await s.wheel.play();assert.equal(s.calls,1);assert.equal(s.form.elements.bet.disabled,true);
 s.resolve({index:7,sector:'red',sectorMultiplier:5,multiplier:5,payout:250,delta:200});await pending;
 const visualIndex=Math.round((360-s.wheel.angle)*17/360-.5);
 assert.equal(visualIndex,7);
 assert.ok(Math.abs(s.wheel.angle-(360-(visualIndex+.5)*360/17))<1e-7);
 assert.equal(s.wheel.busy,false);assert.equal(s.form.elements.bet.disabled,false);assert.ok(s.classes.has('fortune-win'));assert.equal(s.particles.length,28);assert.ok(s.animations.every(a=>a.cancelled));assert.match(s.wheel.lastMessage[0],/200/);assert.match(s.wheel.lastMessage[1],/×5/);
});
test('logout cancels animation and late server result cannot expose or restart wheel',async()=>{
 const s=uiSetup(),pending=s.wheel.play();s.wheel.disconnect();s.resolve({index:1,sector:'red',multiplier:2,payout:100,delta:50});await pending;
 assert.equal(s.wheel.allowed,false);assert.equal(s.wheel.busy,false);assert.equal(s.wheel.animations.length,0);assert.equal(s.particles.length,0);assert.ok(s.animations.every(a=>a.cancelled));assert.ok(s.classes.has('hidden'));assert.equal(s.form.elements.bet.disabled,false);
});
test('the wheel reveals the result before the server cooldown ends, then re-enables the button',async()=>{
 const s=uiSetup();
 let now=100000;
 const timers=[];
 s.c.Date={now:()=>now};
 s.c.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
 const pending=s.wheel.play();
 s.resolve({index:1,sector:'red',payout:100,delta:50,at:now});
 await pending;
 assert.ok(s.classes.has('fortune-win'));
 assert.equal(s.wheel.button.disabled,true);
 await s.wheel.play();
 assert.equal(s.calls,1);
 const cooldown=timers.find(timer=>timer.ms===5200);
 assert.ok(cooldown);
 now+=5200;
 cooldown.fn();
 assert.equal(s.wheel.button.disabled,false);
 s.wheel.disconnect();
 assert.equal(s.wheel.root.dataset.outcome,undefined);
 assert.equal(s.wheel.root.querySelector('.fortune-outcome').hidden,true);
});
test('reduced motion lands without spinning or confetti',async()=>{
 const s=uiSetup();s.c.window.matchMedia=()=>({matches:true});const pending=s.wheel.play();s.resolve({index:0,sector:'zero',multiplier:0,payout:0,delta:-50});await pending;assert.equal(s.animations.length,0);assert.equal(s.particles.length,0);assert.ok(Math.abs(s.wheel.angle-(360-180/17))<1e-7);
});

async function edgeSetup({authorized=true,conflict=false,cached=false,missingToken=false}={}){
 const {stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto');
 let handler,commits=0,loads=0,authHeader,roleCalls=0,randomCalls=0,contexts=[];
 const uid='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000002';
 const c={Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://example.test':'test-service'},serve:fn=>{handler=fn;}},crypto:{subtle:webcrypto.subtle,getRandomValues:a=>{randomCalls++;a[0]=7;return a;}},getWheelSectorIndex:()=>7,CONSTANTS:{WHEEL:{SECTORS:Array(12).fill(0),WEIGHTS:[97,97,97,97,97,97,97,97,97,97,33,97]}},TextEncoder,TextDecoder,Uint8Array,Uint32Array,Response,Request,AbortSignal,btoa,atob,setTimeout,console,structuredClone,
 freshState:()=>({balance:1000}),applyAction:(s,a,p,n,trust)=>{contexts.push(trust);return {balance:900};},fetch:async(url,options)=>{
  if(url.endsWith('/auth/v1/user')){authHeader=options.headers.Authorization;return authorized?Response.json({id:uid}):Response.json({error:'Invalid session'},{status:401});}
  if(url.endsWith('/rpc/is_game_admin')){roleCalls++;throw Error('Fortune must not require admin access');}
  if(url.endsWith('/rpc/game_load')){loads++;return Response.json(cached?{cached:{state:{balance:900},revision:2}}:{state:{balance:1000},revision:1});}
  if(url.endsWith('/rpc/game_commit_safe')){commits++;const args=JSON.parse(options.body);if(conflict&&commits===1)return Response.json({conflict:true});return Response.json(args.p_response);}
  return Response.json(null);
 }};
 vm.createContext(c);const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions/index.ts'),'utf8').replace(/^import .*;$/gm,'');vm.runInContext(stripTypeScriptTypes(source,{mode:'strip'}),c);
 const token='a.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid})).toString('base64url')+'.c',authorization='Bearer '+token;
 const response=await handler(new Request('https://example.test',{method:'POST',headers:missingToken?{}:{authorization},body:JSON.stringify({action:'spinWheel',payload:{bet:100,canSpinWheel:true,wheelIndex:6},request_id:'00000000-0000-4000-8000-000000000003'})}));
 return {response,commits,loads,authHeader,authorization,roleCalls,randomCalls,contexts};
}
test('Edge rejects an expired session before loading or committing a save',async()=>{
 const s=await edgeSetup({authorized:false});assert.equal(s.response.status,401);assert.equal(s.loads,0);assert.equal(s.commits,0);assert.equal(s.randomCalls,0);assert.equal(s.authHeader,s.authorization);
});
test('ordinary player can spin without admin lookup and conflict retry cannot reroll sector',async()=>{
 const s=await edgeSetup({conflict:true});assert.equal(s.response.status,200);assert.equal(s.commits,2);assert.equal(s.randomCalls,1);assert.equal(s.authHeader,s.authorization);assert.equal(s.contexts.length,2);assert.equal(s.roleCalls,0);
 for(const trust of s.contexts){assert.equal(trust.canSpinWheel,true);assert.equal(trust.wheelIndex,7);}
});
test('cached request never runs wheel payout again',async()=>{
 const s=await edgeSetup({cached:true});assert.equal(s.response.status,200);assert.equal(s.contexts.length,0);assert.equal(s.commits,1);
});

test('17 sectors keep the color odds at 18/37 each and Moonlight at 1/37',()=>{
 const run=setup(),counts=Array(17).fill(0);
 for(let ticket=0;ticket<148;ticket++)counts[run('getWheelSectorIndex('+ticket+')')]++;
 assert.deepEqual(counts,[4,...Array(16).fill(9)]);
 for(const [sector,n] of [['red',8],['black',8],['zero',1]])assert.equal(run("CONSTANTS.WHEEL.SECTORS.filter(s=>s==='"+sector+"').length"),n);
 for(const ticket of [-1,148,.5])assert.throws(()=>run('getWheelSectorIndex('+ticket+')'));
});
test('weighted wheel angle helper still stops in the center of nonuniform sectors',()=>{
 const s=uiSetup(),weights=[97,97,97,97,97,97,97,97,97,97,33,97];let start=0;
 for(let i=0;i<weights.length;i++){const center=(start+weights[i]/2)*360/1100;const angle=vm.runInContext('wheelStopAngle('+i+','+JSON.stringify(weights)+',1391.25)',s.c);assert.ok(angle>=1391.25+2520);assert.ok(Math.abs((angle+center)%360)<1e-7);start+=weights[i];}
});
test('fortune tab follows achievements, switches within panel and closes with other tabs or shop panel',()=>{
 const active=new Set(),contentActive=new Set();let opened=0,closed=0;
 const classes=()=>({add:x=>active.add(x),remove:x=>active.delete(x),contains:x=>active.has(x),toggle(x,on){if(on)active.add(x);else active.delete(x);}});
 const fortune={allowed:true,open(){opened++;},close(){closed++;}},panel={classList:classes(),querySelectorAll:()=>[]},content={classList:{add:x=>contentActive.add(x)}};
 const c={window:{},state:{},gameEngine:{},showToast(){},fortuneWheel:fortune,document:{addEventListener(){},getElementById:id=>id==='shopPanel'?panel:id==='fortuneTabContent'?content:null},console};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/events.js'),'utf8')),c);
 c.window.switchShopTab('fortune');assert.equal(opened,1);assert.ok(contentActive.has('active'));c.window.switchShopTab('achievements');assert.equal(closed,2);
 fortune.allowed=false;c.window.switchShopTab('fortune');assert.equal(opened,1);c.window.closePanel('shopPanel');assert.equal(closed,3);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(html.indexOf('id="fortuneTabButton"')>html.indexOf('data-tab="achievements"'));assert.match(html,/id="fortuneTabButton" class="panel-tab hidden"/);
});

test('every authenticated regular account receives public fortune without owner role',async()=>{
 const s=await edgeSetup();assert.equal(s.response.status,200);assert.equal(s.roleCalls,0);assert.equal(s.loads,1);assert.equal(s.commits,1);assert.equal(s.contexts[0].canSpinWheel,true);
});

test('public fortune still refuses requests with no authentication token',async()=>{
 const s=await edgeSetup({missingToken:true});assert.equal(s.response.status,401);assert.equal(s.loads,0);assert.equal(s.commits,0);assert.equal(s.roleCalls,0);assert.equal(s.randomCalls,0);
});

test('maximum preset fills the entire visible balance without starting a spin',()=>{
 const s=uiSetup();s.wheel.setBetFraction(1);assert.equal(Number(s.form.elements.bet.value),1000);assert.equal(s.calls,0);s.wheel.busy=true;s.c.state.playerData.shards=1500;s.wheel.setBetFraction(1);assert.equal(Number(s.form.elements.bet.value),1000);
 s.wheel.busy=false;s.c.state.playerData.shards=0;s.wheel.setBetFraction(1);assert.equal(Number(s.form.elements.bet.value),0);assert.equal(s.calls,0);
});

test('a lost stake shows the lost amount and the actual sector',async()=>{
 const s=uiSetup(),pending=s.wheel.play();s.resolve({index:0,sector:'zero',multiplier:0,payout:0,delta:-50});await pending;assert.match(s.wheel.lastMessage[0],/−50/);assert.match(s.wheel.lastMessage[1],/Лунный свет/);assert.doesNotMatch(s.wheel.lastMessage[1],/×0/);
});
