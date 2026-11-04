const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const data=new Map(),writes=[],listeners=new Map(),notes={};let resolveReveal,rejectReveal;
 const view={renders:[],begins:[],cancels:0,destroys:0,render(s){this.current=s;this.renders.push(s);},begin(s){this.current=s;this.begins.push(s);return true;},reveal(s){this.target=s;return new Promise((r,j)=>{resolveReveal=r;rejectReveal=j;});},cancel(){this.cancels++;resolveReveal?.(false);},destroy(){this.destroys++;this.cancel();}};
 const document={hidden:false,addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}};
 const c={console,Math:Object.create(Math),Set,document,window:{addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}},storage:{getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,v);writes.push(k);}}};
 vm.createContext(c);const source=fs.readFileSync(path.join(__dirname,'../src/modules/ui/slots.js'),'utf8').replace(/^import .*;$/gm,'').replace(/\bexport\s+/g,'');vm.runInContext(source,c);
 const run=code=>vm.runInContext(code,c),s=run('var s=new DemoSlots();s.model=new DemoSlotBalance(storage,()=>0);s.allowed=true;s');
 s.root={querySelector:k=>notes[k]||(notes[k]={textContent:''})};s.view=view;s.button={disabled:false};s.resetButton={disabled:false};
 return {s,run,view,data,writes,listeners,notes,resolve(){resolveReveal(true);},reject(){rejectReveal(Error('visual fail'));}};
}

test('controller lock permits one spin even if disabled UI is removed or controller called directly',async()=>{
 const a=setup(),{s,run,writes,view}=a;
 run('var draws=0;s.model.random=()=>{draws++;return 0;}');
 const pending=s.play();
 for(let i=0;i<20;i++){s.button.disabled=false;assert.equal(await s.play(),false);}
 assert.equal(run('draws'),7);assert.equal(writes.length,1);assert.equal(s.model.balance,2490);
 assert.equal(view.begins.length,1);assert.equal(view.begins[0].balance,990);assert.equal(view.begins[0].state,'spinning');
 assert.equal(view.target.balance,2490);assert.equal(view.target.groups.length,1);
 assert.equal(s.reset(),false);a.resolve();await pending;
 assert.equal(s.busy,false);assert.equal(writes.length,1);assert.equal(view.current.balance,2490);
});

test('synchronous reentrant play from RNG is blocked before the model draws',async()=>{
 const a=setup();a.run('var draws=0;s.model.random=()=>{draws++;s.play();return 0;}');
 const pending=a.s.play();assert.equal(a.run('draws'),7);assert.equal(a.writes.length,1);
 a.resolve();await pending;assert.equal(a.s.model.balance,2490);
});

test('cancel reveal renders current committed balance, never old settled state, without new payment',async()=>{
 const a=setup(),{s,view,writes}=a;s.renderCurrent();assert.equal(view.current.balance,1000);
 const pending=s.play();assert.equal(view.current.balance,990);
 s.close();assert.equal(s.busy,false);assert.equal(view.current.balance,2490);
 assert.equal(view.current.groups[0].positions.length,7);assert.equal(writes.length,1);
 s.open();assert.equal(view.current.balance,2490);await pending;
 assert.equal(view.current.balance,2490);assert.equal(writes.length,1);
 s.finish();s.finish();assert.equal(writes.length,1);
});

test('late old reveal callback cannot unlock a newer spin or restore its snapshot',async()=>{
 const a=setup(),{s,view}=a;const old=s.play();s.close();
 const next=s.play();await old;assert.equal(s.busy,true);assert.equal(view.current.balance,2480);
 a.resolve();await next;assert.equal(s.busy,false);assert.equal(s.model.balance,3980);assert.equal(view.current.balance,3980);
 assert.equal(a.writes.length,2);
});

test('disconnect destroys only view and reconnect reads current model exactly once',async()=>{
 const a=setup(),{s,view}=a;const pending=s.play();s.disconnect();await pending;
 assert.equal(s.allowed,false);assert.equal(s.busy,false);assert.equal(view.destroys,1);assert.equal(s.model.balance,2490);
 assert.equal(await s.play(),false);assert.equal(a.writes.length,1);
 s.connect({prepend(){throw Error('must reuse existing root');}});
 assert.equal(s.allowed,true);assert.equal(view.current.balance,2490);assert.equal(a.writes.length,1);
});

test('view failure cannot rollback or repeat the atomic transaction',async()=>{
 const a=setup(),pending=a.s.play();a.reject();await pending;
 assert.equal(a.s.busy,false);assert.equal(a.s.model.balance,2490);assert.equal(a.view.current.balance,2490);assert.equal(a.writes.length,1);
});

test('last ten can begin presentation at zero; insufficient later calls do not draw',async()=>{
 const a=setup();a.data.set('moonclicker.fortunaDemo.v1',JSON.stringify({version:3,balance:10}));
 a.run('var q=[0,1,2,3,4,5,6],draws=0;s.model.random=()=>{draws++;return(q.shift()+.5)/8;}');
 const p=a.s.play();assert.equal(a.view.current.balance,0);assert.equal(a.view.current.state,'spinning');
 a.resolve();await p;assert.equal(a.s.model.balance,0);assert.equal(a.view.current.state,'insufficient');
 assert.equal(await a.s.play(),false);assert.equal(a.run('draws'),7);assert.equal(a.writes.length,1);
});

test('snapshot adapter preserves numeric IDs, two exact groups and explicit gross formulas',async()=>{
 const a=setup();a.run('var q=[0,1,0,2,1,0,1];s.model.random=()=>((q.shift()??0)+.5)/8');
 const p=a.s.play();a.resolve();await p;
 const snapshot=a.view.current;
 assert.equal(snapshot.balance,1030);assert.equal(snapshot.cost,10);assert.equal(JSON.stringify(snapshot.result),'["0","1","0","2","1","0","1"]');
 assert.equal(snapshot.groups.length,2);assert.equal(snapshot.groups[0].symbol,'0');assert.equal(snapshot.groups[0].payoutText,'10 × 2 = 20');
 assert.match(snapshot.detail,/20 \+ 20 = 40/);assert.match(snapshot.title,/\+30/);
 assert.equal(a.s.reset(),true);assert.equal(a.view.current.balance,1000);assert.equal(a.view.current.groups.length,0);assert.equal(a.s.model.balance,1000);
});

test('storage mode warning and pagehide listener do not touch the real game',async()=>{
 const a=setup();a.s.connect({});assert.ok(a.listeners.has('pagehide'));a.s.model.persistent=false;a.s.storageNote();
 assert.match(a.notes['[data-mc-storage]'].textContent,/только на эту сессию/);
 const p=a.s.play();a.listeners.get('pagehide')();await p;assert.equal(a.s.busy,false);assert.equal(a.view.current.balance,2490);
 a.s.disconnect();assert.equal(a.listeners.has('pagehide'),false);assert.equal(a.listeners.has('visibilitychange'),false);
});
