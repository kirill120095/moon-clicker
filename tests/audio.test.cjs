const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('audio waits for interaction, remembers settings and suspends in hidden tabs',()=>{
 const events={},store=new Map(),intervals=new Set();let next=1;
 class Param{setTargetAtTime(v){this.value=v;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}}
 class Node{constructor(){this.gain=new Param();this.frequency=new Param();}connect(){}disconnect(){}start(){}stop(){}}
 class Context{constructor(){this.state='running';this.currentTime=1;this.destination={};}createGain(){return new Node();}createOscillator(){return new Node();}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}}
 const classes=new Set();
 const hideUfo={checked:false,addEventListener:(_name,fn)=>{events.hideUfo=fn;}};
 store.set('moon_hide_ufo_visuals','true');
 const document={hidden:false,addEventListener:(name,fn)=>{events[name]=fn;},querySelectorAll:()=>[],getElementById:id=>id==='hideUfoVisuals'?hideUfo:null,documentElement:{classList:{add:name=>classes.add(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)}}};
 const c={document,window:{AudioContext:Context},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setInterval:()=>{const id=next++;intervals.add(id);return id;},clearInterval:id=>intervals.delete(id),console};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/modules/ui/audio.js'),'utf8').replace(/\bexport\s+/g,''),c);
 assert.equal(hideUfo.checked,true);
 assert.ok(classes.has('hide-ufo-visuals'));
 hideUfo.checked=false;events.hideUfo();
 assert.equal(classes.has('hide-ufo-visuals'),false);
 assert.equal(store.get('moon_hide_ufo_visuals'),'false');
 assert.equal(vm.runInContext('audio.ctx',c),null);events.pointerdown();assert.equal(vm.runInContext('audio.ctx.state',c),'running');
 vm.runInContext("audio.set('music',0.3);audio.set('muted',true);audio.purchase()",c);
 assert.equal(JSON.parse(store.get('moon_audio_v1')).music,0.3);assert.equal(vm.runInContext('audio.master.gain.value',c),0);
 document.hidden=true;events.visibilitychange();assert.equal(vm.runInContext('audio.ctx.state',c),'suspended');assert.equal(intervals.size,0);
 document.hidden=false;events.visibilitychange();assert.equal(vm.runInContext('audio.ctx.state',c),'running');
});

test('one percent volume is quiet for radio and sound effects',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/modules/ui/audio.js'),'utf8');
 const ctx={document:{addEventListener(){},querySelectorAll(){return []},getElementById(){return null}},localStorage:{getItem(){return null},setItem(){}},console};
 vm.createContext(ctx);vm.runInContext(source.replace(/export /g,''),ctx);
 assert.equal(vm.runInContext('audioGain(0)',ctx),0);
 assert.ok(vm.runInContext('audioGain(0.01)',ctx)<0.001);
 assert.ok(vm.runInContext('audioGain(0.5)',ctx)<vm.runInContext('audioGain(1)',ctx));
 assert.match(source,/radioElement.volume=audioGain/);
 assert.match(source,/fxBus.gain.setTargetAtTime\(audioGain/);
});
