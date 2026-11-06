const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
function setup(admin=true,failPublic=false,failLibrary=false){
 const nodes=new Map(),timers=new Set(),listeners=new Map(),prefs=new Map();let channels=0,removed=0,roleCalls=0;
 function node(id){if(nodes.has(id))return nodes.get(id);const classes=new Set(['hidden']);const n={value:'',textContent:'',options:[],classList:{toggle(k,v){if(v===undefined)v=!classes.has(k);v?classes.add(k):classes.delete(k);},add:k=>classes.add(k),contains:k=>classes.has(k)},setAttribute(k,v){this[k]=v;},addEventListener(e,f){listeners.set(id+':'+e,f);},replaceChildren(...children){this.options=children;},appendChild(c){this.options.push(c);},cloneNode(){return {...this};}};nodes.set(id,n);return n;}
 const client={rpc:async()=>{roleCalls++;return {data:admin};},channel(){channels++;return {on(){return this;},subscribe(){return this;}};},removeChannel(){removed++;},from(table){return {select(){return {eq(){return {single:async()=>failPublic?{error:Error('offline')}:{data:{version:1,track_path:null}}};},order:async()=>({data:[]}),then(resolve){resolve(failLibrary?{error:Error('library offline')}:{data:[]});}};}};},storage:{from(){return {list:async()=>failLibrary?{error:Error('storage offline')}:{data:[]}};}}};
 class Audio{addEventListener(){}pause(){}load(){}getAttribute(){return null;}}
 const c={URL,initSupabase:async()=>client,Audio,audio:{apply(){}},document:{hidden:false,getElementById:node,createElement:()=>node('option'+Math.random()),querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v)},setInterval(fn){timers.add(fn);return fn;},clearInterval:id=>timers.delete(id),console};
 vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/modules/ui/radio.js'),'utf8')),c);
 return {run:s=>vm.runInContext(s,c),node,listeners,prefs,timers,counts:()=>({channels,removed,roleCalls}),client};
}
test('owner controls survive public radio failure, retry library errors, and clean up on logout',async()=>{
 const s=setup(true,true,true);await s.run("radio.connect({id:'owner'})");
 assert.equal(s.node('radioAdmin').classList.contains('hidden'),false);assert.equal(s.node('radioMini').classList.contains('hidden'),false);
 assert.equal(s.run('radio.ownerReady'),false);assert.equal(s.counts().channels,1);assert.equal(s.timers.size,2);
 s.client.storage.from=()=>({list:async()=>({data:[]})});s.client.from=()=>({select:()=>({order:async()=>({data:[]}),then:r=>r({data:[]})})});
 await s.run('radio.nextOwnerCheck=0;radio.refreshOwner()');assert.equal(s.run('radio.ownerReady'),true);
 s.run('radio.disconnect()');assert.equal(s.timers.size,0);assert.equal(s.counts().removed,1);assert.equal(s.node('radioMini').classList.contains('hidden'),true);
});
test('ordinary players never see owner radio panels',async()=>{const s=setup(false);await s.run("radio.connect({id:'player'})");assert.equal(s.node('radioMini').classList.contains('hidden'),true);assert.equal(s.node('radioAdmin').classList.contains('hidden'),true);s.run('radio.disconnect()');});
test('mini player uses shared transport and persists collapse separately per user',async()=>{
 const s=setup();await s.run("radio.connect({id:'owner'})");s.run("radio.control=async(action,extra)=>{globalThis.sent={action,extra};};radio.selectedId='playlist';");
 await s.listeners.get('radioMiniPlay:click')();await new Promise(r=>setImmediate(r));assert.equal(s.run('sent.extra.p_playlist'),'playlist');
 s.listeners.get('radioMiniCollapse:click')();assert.equal(s.run('radio.collapsed'),true);assert.equal(s.prefs.get('moon-radio-collapsed:owner'),'true');assert.equal(s.node('radioMiniCollapse')['aria-expanded'],'false');assert.equal(s.counts().channels,1);assert.equal(s.timers.size,2);s.run('radio.disconnect()');
});
test('money and price rounding never imply affordability and retain readable suffixes',()=>{
 const c={};vm.createContext(c);vm.runInContext(strip(fs.readFileSync(path.join(__dirname,'../src/utils/numbers.js'),'utf8')),c);
 for(const cost of [1200001,1249999,1299999,10001,1e9+1,1e12+1,1e15+1]){
  const money=vm.runInContext('formatMoney('+(cost-1)+')',c),price=vm.runInContext('formatPrice('+cost+')',c);assert.notEqual(money,price);
 }
 assert.equal(vm.runInContext('formatPrice(1200001)',c),'1.21M');assert.equal(vm.runInContext('formatMoney(1200000)',c),'1.2M');
 assert.equal(vm.runInContext('formatPrice(1200000)',c),'1.2M');assert.equal(vm.runInContext('formatExact(1200001)',c).replace(/\s/g,''),'1200001');
});

test('server charges the exact relay price and rejects one crystal short',()=>{
 const c={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(c);
 vm.runInContext(['constants.js','config.js','rules.js'].map(p=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',p),'utf8'))).join('\n'),c);
 const run=s=>vm.runInContext(s,c);
 run("var s=freshState();s.ownedMoons.push('electric');s.ufoLevel=1;s.playerData.shards=CONSTANTS.UFO.COMBO_RELAY_COST-1;");
 assert.throws(()=>run("applyAction(s,'buyUfoComboRelay',{},100000)"));
 assert.equal(run("s.playerData.shards=CONSTANTS.UFO.COMBO_RELAY_COST;applyAction(s,'buyUfoComboRelay',{},100000).playerData.shards"),0);
});
test('mini repeat toggles preserve track position and match settings buttons',async()=>{
 const s=setup();await s.run("radio.connect({id:'owner'})");
 s.run("radio.current={version:1,track_path:'a.mp3',started_at:new Date(Date.now()-5000).toISOString(),track_index:0,schedule:[{path:'a.mp3',title:'A',duration:60}],repeat_track:false,repeat_playlist:true};radio.control=async(action,extra)=>{globalThis.sent={action,extra};};radio.renderModes();");
 assert.equal(s.node('radioMiniRepeatPlaylist')['aria-pressed'],'true');
 await s.listeners.get('radioMiniRepeatTrack:click')();await new Promise(r=>setImmediate(r));
 assert.equal(s.run('sent.action'),'mode');assert.equal(s.run('sent.extra.p_repeat_track'),true);assert.equal(s.run('sent.extra.p_index'),0);
 assert.ok(s.run('sent.extra.p_offset')>=5);s.run('radio.disconnect()');
});

test('internet radio mode is local and does not modify the shared station',async()=>{
 const s=setup(true);await s.run("radio.connect({id:'owner'})");
 s.run("radio.setRadioMode('internet')");
 assert.equal(s.run('radio.mode'),'internet');
 assert.equal(s.prefs.get('moon-radio-mode'),'internet');
 assert.equal(s.node('radioAdmin').classList.contains('hidden'),true);
 assert.equal(s.node('radioMini').classList.contains('hidden'),true);
 s.run("radio.setRadioMode('own')");
 assert.equal(s.run('radio.mode'),'own');
 assert.equal(s.node('radioAdmin').classList.contains('hidden'),false);
 s.run('radio.disconnect()');
});
test('internet radio only accepts HTTPS station streams',()=>{
 const s=setup(false);
 assert.equal(s.run("safeRadioStream({url:'http://example.com/live'})"),null);
 assert.equal(s.run("safeRadioStream({url:'javascript:alert(1)'})"),null);
 assert.equal(s.run("safeRadioStream({url:'https://example.com/live'})"),'https://example.com/live');
});
