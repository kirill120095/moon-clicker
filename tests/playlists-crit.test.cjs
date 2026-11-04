const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(){const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);return code=>vm.runInContext(code,c);}
function radioSetup(extra={}){return vm.runInNewContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/radio.js'),'utf8'))+';({radioPlayback,GameRadio,trackLabel})',{TextEncoder,TextDecoder,Uint8Array,Date,crypto:webcrypto,setTimeout,clearTimeout,...extra});}
test('critical tiers work below, at and above every 100 percent boundary',()=>{
 const run=setup();
 for(const [chance,roll,tier] of [[.07,.06,2],[.07,.08,1],[1,.99,2],[1.07,.069,3],[1.07,.071,2],[2,.99,3],[2.07,.069,4],[2.07,.071,3],[3.5,.49,5],[3.5,.51,4],[10,.99,11]]){
  assert.equal(run('rollCritical('+chance+',2,()=>'+roll+').tier'),tier);
 }
 assert.equal(run('rollCritical(2.07,4,()=>0).multiplier'),8);
});
test('server uses prestige chance above 200 percent and reports it for the profile',()=>{
 const run=setup();assert.equal(run("Math.random=()=>0.01;var s=freshState();s.prestige.upgrades.critical=67;s=applyAction(s,'click',{count:1},100000);s.effects[0].damage"),44);
 assert.ok(Math.abs(run('s.finalCritChance')-2.06)<1e-10);
});
test('all eternal upgrades can be bought beyond previous caps with finite prices',()=>{
 const run=setup();
 for(const id of ['reactor','treasury','fleet','clock','critical']){
  assert.equal(run("var s=freshState();s.prestige.coins=Number.MAX_SAFE_INTEGER;s.prestige.upgrades."+id+"=10;applyAction(s,'buyPrestige',{id:'"+id+"'},100000).prestige.upgrades."+id),11);
 }
 assert.equal(run("Number.isSafeInteger(getPrestigeUpgradeCost('critical',2000))"),true);
 assert.equal(run("var s=freshState();s.prestige.upgrades.clock=1000;s.ufoLevel=1;s=applyAction(s,'load',{},100000);s=applyAction(s,'sync',{},100100);s.effects.length"),0);assert.equal(run("applyAction(s,'sync',{},100150).effects.length"),1);
});
test('quest and achievement rewards are reduced while difficulty still pays more',()=>{
 const run=setup();assert.equal(run("ACHIEVEMENTS.clickNovice.tiers[0].reward"),25);
 assert.equal(run("QUESTS.clickDaily100.reward+QUESTS.clickDaily100.bonusReward"),38);
 assert.ok(run("QUESTS.clickDaily100.reward<QUESTS.clickDaily500.reward&&QUESTS.clickDaily500.reward<QUESTS.clickDaily2000.reward"));
});
function row(extra={}){return {version:1,track_path:'a.mp3',track_index:0,started_at:new Date(100000).toISOString(),repeat_track:false,repeat_playlist:false,schedule:[{path:'a.mp3',title:'Первый',duration:10},{path:'b.mp3',title:'Второй',duration:20},{path:'c.mp3',title:'Третий',duration:30}],...extra};}
test('radio advances for every listener and stops at the end without repetition',()=>{
 const {radioPlayback:p}=radioSetup();assert.equal(p(row(),109000).path,'a.mp3');assert.equal(p(row(),110000).path,'b.mp3');assert.equal(p(row(),130000).path,'c.mp3');assert.equal(p(row(),160000),null);
});
test('track repeat, playlist repeat and a nonfirst starting track preserve the timeline',()=>{
 const {radioPlayback:p}=radioSetup();assert.equal(p(row({repeat_track:true}),135000).offset,5);
 assert.equal(p(row({repeat_playlist:true}),165000).path,'a.mp3');
 assert.equal(p(row({repeat_playlist:true,track_index:1}),151000).path,'a.mp3');
 assert.equal(p(row({track_index:1}),150000),null);
});
test('radio next and previous wrap at playlist ends',async()=>{
 const {GameRadio}=radioSetup();const radio=new GameRadio();radio.current=row();let params;radio.control=async(action,p)=>{params=p;};
 // A fixed clock avoids making this a wall-clock-dependent transport test.
 radio.current.started_at=new Date(Date.now()).toISOString();await radio.step(-1);assert.equal(params.p_index,2);await radio.step(1);assert.equal(params.p_index,1);
});
test('Unicode audio upload uses an ASCII key and raw bytes, preserving names and duration',async()=>{
 for(const name of ['Старый Витя черный дед.mp3','Музыка 🌙 #1.MP3','音楽 & 100%.wav']){
  let capture,stored,registered;const bytes=new Uint8Array([1,2,3]).buffer;
  const file={name,size:3,arrayBuffer:async()=>bytes},nodes={radioFile:{files:[file],value:'selected'}};
  class FakeAudio{constructor(){this.duration=123;}set src(value){queueMicrotask(()=>this.onloadedmetadata?.());}removeAttribute(){}load(){}}
  const {GameRadio,trackLabel}=radioSetup({document:{getElementById:id=>nodes[id]},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},Audio:FakeAudio,queueMicrotask});
  const radio=new GameRadio();radio.selected=()=>({id:'playlist',title:'Музыка',tracks:[]});radio.status=()=>{};radio.savePlaylist=async p=>{stored=p;};radio.listTracks=async()=>{};
  radio.client={rpc:async(name,args)=>{registered=args;return {error:null};},storage:{from:()=>({upload:async(key,body,options)=>{capture={key,body,options};return {error:null};}})}};
  await radio.upload();assert.match(capture.key,/^[a-zA-Z0-9._-]+$/);assert.equal(capture.body,bytes);assert.equal(registered.p_title,name.replace(/\.[^.]+$/,''));assert.equal(registered.p_path,capture.key);assert.equal(stored.tracks[0].title,name.replace(/\.[^.]+$/,''));assert.equal(stored.tracks[0].duration,123);
 }
});
test('radio upload failure never appends a missing file to the playlist',async()=>{
 class FakeAudio{constructor(){this.duration=123;}set src(value){queueMicrotask(()=>this.onloadedmetadata?.());}removeAttribute(){}load(){}}
 const {GameRadio}=radioSetup({document:{getElementById:()=>({files:[{name:'тест.mp3',size:3,arrayBuffer:async()=>new ArrayBuffer(1)}]})},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},Audio:FakeAudio,queueMicrotask});
 const radio=new GameRadio();radio.selected=()=>({id:'playlist',title:'test',tracks:[]});radio.status=()=>{};let saved=false;radio.savePlaylist=async()=>{saved=true;};radio.client={storage:{from:()=>({upload:async()=>({error:Error('Denied')})})}};
 await assert.rejects(()=>radio.upload(),/Denied/);assert.equal(saved,false);
});

test('old uploaded track names remain readable after the library migration',()=>{
 const {trackLabel}=radioSetup();const name='Музыка.mp3',encoded=Array.from(new TextEncoder().encode(name),b=>b.toString(16).padStart(2,'0')).join('');
 assert.equal(trackLabel('123-00000000-0000-4000-8000-000000000000-u'+encoded+'.mp3'),name);
 assert.equal(trackLabel('123-00000000-0000-4000-8000-000000000000-song.mp3'),'song.mp3');
});
