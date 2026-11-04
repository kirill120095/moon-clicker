const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
test('late radio initialization cannot create subscriptions or timers after logout',async()=>{
 let resolve,channels=0,timers=0;
 const client={channel(){channels++;}},context={initSupabase:()=>new Promise(r=>{resolve=r;}),audio:{apply(){}},document:{getElementById:()=>null},setInterval(){timers++;},clearInterval(){},console};
 vm.createContext(context);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/radio.js'),'utf8')),context);
 const pending=vm.runInContext("radio.connect({id:'user'})",context);vm.runInContext('radio.disconnect()',context);resolve(client);await pending;
 assert.equal(channels,0);assert.equal(timers,0);
});
test('radio refresh completion after logout cannot reconnect the channel',async()=>{
 let resolve,channels=0,timers=0,roleRequests=0,removed=0,cleared=0;
 class Audio{addEventListener(){}pause(){}}
 const client={from:()=>({select:()=>({eq:()=>({single:()=>new Promise(r=>{resolve=r;})})})}),rpc(){roleRequests++;return Promise.resolve({data:false});},channel(){channels++;return {on(){return this;},subscribe(){return this;}};},removeChannel(){removed++;}};
 const context={initSupabase:async()=>client,Audio,audio:{apply(){}},document:{getElementById:()=>null,addEventListener(){}},setInterval(){timers++;return timers;},clearInterval(id){if(id)cleared++;},console};
 vm.createContext(context);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/radio.js'),'utf8')),context);
 const pending=vm.runInContext("radio.connect({id:'user'})",context);await new Promise(r=>setImmediate(r));vm.runInContext('radio.disconnect()',context);resolve({data:{version:1,track_path:null},error:null});await pending;
 assert.equal(channels,1);assert.equal(timers,2);assert.equal(roleRequests,1);assert.equal(removed,1);assert.equal(cleared,2);assert.equal(vm.runInContext('radio.current',context),null);
});
test('parallel game initialization shares one load and cancellation starts no timers',async()=>{
 let resolve,loads=0,timers=0;
 const context={gameEngine:{destroy(){}},fortuneWheel:{bind(){},connect(){},disconnect(){}},gameAdmin:{connect:async()=>{},disconnect(){}},radio:{connect:async()=>{},disconnect(){}},state:{},appState:{},db:{action(){loads++;return new Promise(r=>{resolve=r;});}},document:{getElementById:()=>null},setInterval(){timers++;},clearInterval(){},clearTimeout(){},console};
 vm.createContext(context);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/game/secure-game.js'),'utf8')),context);
 const p=vm.runInContext('gameEngine.init()',context),q=vm.runInContext('gameEngine.init()',context);assert.equal(p,q);assert.equal(loads,1);
 vm.runInContext('gameEngine.destroy()',context);resolve({state:{},revision:1});
 await assert.rejects(p,/Загрузка отменена/);assert.equal(timers,0);
});
test('a delayed UFO catch-up has bounded work per request',()=>{
 const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);
 const shots=vm.runInContext("var s=freshState();s.ufoLevel=5;s.ufoCount=8;s.ownedMoons=Object.keys(MOON_TYPES);s.prestige.upgrades.clock=1000;s=applyAction(s,'load',{},100000);s=applyAction(s,'sync',{},104999);s.effects.length",c);
 assert.ok(shots<=32);
});