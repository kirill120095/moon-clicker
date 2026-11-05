const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
async function setup(){
 const {TempleWallet}=await import('../src/modules/game/temple-wallet.js'),{TEMPLE_STAKES}=await import('../src/modules/game/temple-rules.js'),{TEMPLE_FIXTURE_CONFIG,TEMPLE_FIXTURE_STOPS}=await import('../tools/slots/temple-fixtures.js');
 const data=new Map(),writes=[],listeners=new Map();let resolveReveal,rejectReveal;
 const view={current:null,begins:0,render(s){this.current=s},begin(s){this.begins++;this.current=s},reveal(s){this.target=s;return new Promise((r,j)=>{resolveReveal=r;rejectReveal=j})},selectedFixture(){return undefined},cancel(){resolveReveal?.(false)},destroy(){this.cancel()}};
 const c={console,TempleWallet,TEMPLE_STAKES,TEMPLE_CONFIG:null,TEMPLE_TEST_MODE:false,TEMPLE_DEFAULT_DEMO:false,TEMPLE_FIXTURES:{},structuredClone,
 document:{hidden:false,addEventListener(k,v){listeners.set(k,v)},removeEventListener(k){listeners.delete(k)}},window:{addEventListener(k,v){listeners.set(k,v)},removeEventListener(k){listeners.delete(k)}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/modules/ui/slots.js'),'utf8').replace(/^import .*;$/gm,'').replace(/\bexport\s+/g,''),c);
 const run=code=>vm.runInContext(code,c),s=run('new DemoSlots()');s.model=new TempleWallet({config:TEMPLE_FIXTURE_CONFIG,storage:{getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,v);writes.push(k)}},testMode:true,fixtures:TEMPLE_FIXTURE_STOPS});
 s.view=view;s.root={};s.allowed=true;s.visible=true;s.button={disabled:false};
 return {s,view,data,writes,listeners,resolve(){resolveReveal(true)},reject(){rejectReveal(Error('view failure'))}};
}

test('shadow starts with disabled removed or direct/reentrant calls cannot debit twice',async()=>{
 const a=await setup();let draws=0;a.s.model.rng=()=>{draws++;a.s.play();return 0};const p=a.s.play();
 for(let i=0;i<20;i++){a.s.button.disabled=false;assert.equal(await a.s.play(),false)}
 assert.equal(draws,5);assert.equal(a.writes.length,1);assert.equal(a.view.begins,1);assert.equal(a.view.current.balance,990);
 a.resolve();await p;assert.equal(a.s.busy,false);assert.equal(a.s.model.balance,990);
});

test('stake and reset are locked while spinning and model bonuses lock paid mode',async()=>{
 const a=await setup(),p=a.s.play({fixtureId:'trigger'});
 assert.equal(a.s.changeStake(1),false);assert.equal(a.s.reset(),false);a.resolve();await p;
 assert.equal(a.s.model.bonus.remaining,10);assert.equal(a.s.changeStake(1),false);
 assert.equal(await a.s.play({mode:'paid'}),false);assert.equal(a.writes.length,1);
});

test('cancel/hide finishes presentation only; return shows current wallet and bonus',async()=>{
 const a=await setup(),p=a.s.play({fixtureId:'trigger'});assert.equal(a.s.model.balance,990);
 a.s.close();await p;assert.equal(a.s.busy,false);assert.equal(a.view.current.balance,990);assert.equal(a.view.current.bonus.remaining,10);assert.equal(a.view.current.visible,false);
 a.s.open();assert.equal(a.view.current.bonus.remaining,10);assert.equal(a.view.current.mode,'free');assert.equal(a.writes.length,1);
});

test('late reveal cannot unlock a new free spin or double-consume free counter',async()=>{
 const a=await setup(),old=a.s.play({fixtureId:'trigger'});a.s.close();a.s.open();
 const next=a.s.play({fixtureId:'leftThree'});await old;assert.equal(a.s.busy,true);assert.equal(a.s.model.bonus.remaining,9);
 a.resolve();await next;assert.equal(a.s.busy,false);assert.equal(a.s.model.bonus.remaining,9);assert.equal(a.writes.length,2);
});

test('free snapshot explicitly shows debit0/fixed trigger stake and actual net',async()=>{
 const a=await setup();a.s.model.setStake(50);const trigger=a.s.play({fixtureId:'trigger'});a.resolve();await trigger;
 const p=a.s.play({fixtureId:'leftThree'});assert.equal(a.view.current.debit,0);assert.equal(a.view.current.stake,50);
 a.resolve();await p;assert.equal(a.view.current.result.debit,0);assert.equal(a.view.current.result.totalStake,50);
 assert.match(a.view.current.detail,/debit 0/);assert.match(a.view.current.detail,/ставка триггера 50/);
 assert.equal(a.view.current.result.net,a.view.current.result.creditedGross);
});

test('partial return is not a clean-win title or celebration',async()=>{
 const a=await setup(),p=a.s.play({fixtureId:'leftThree'});a.resolve();await p;
 assert.match(a.view.current.title,/Частичный возврат/);assert.doesNotMatch(a.view.current.title,/Чистый выигрыш/);assert.equal(a.view.current.result.celebrate,false);
 assert.equal(a.view.current.result.net,-8);
});

test('presentation error never retries financial settlement',async()=>{
 const a=await setup(),p=a.s.play({fixtureId:'fiveWild'});a.reject();await p;
 assert.equal(a.s.busy,false);assert.equal(a.writes.length,1);assert.equal(a.s.model.balance,1150);
});

test('snapshot detaches matrix/result from authoritative wallet',async()=>{
 const a=await setup(),p=a.s.play({fixtureId:'fiveWild'});a.resolve();await p;
 a.view.current.grid[0][0]='scatter';a.view.current.result.net=9999;a.view.current.result.bonusAfter.remaining=99;
 assert.equal(a.s.model.last.grid[0][0],'wild');assert.equal(a.s.model.last.net,150);assert.equal(a.s.model.bonus.remaining,0);
});

test('reset clears only own state; no automatic chaining of free spins',async()=>{
 const a=await setup(),p=a.s.play({fixtureId:'trigger'});a.resolve();await p;
 assert.equal(a.s.model.bonus.remaining,10);assert.equal(a.writes.length,1);
 await Promise.resolve();await Promise.resolve();assert.equal(a.writes.length,1);
 assert.equal(a.s.reset({confirmed:true}),true);assert.equal(a.s.model.balance,1000);assert.equal(a.s.model.bonus.remaining,0);assert.equal(a.s.model.last,null);
});

test('disconnect/reconnect preserves committed state with a single reused view',async()=>{
 const a=await setup(),p=a.s.play({fixtureId:'trigger'});a.s.disconnect();await p;assert.equal(await a.s.play(),false);
 a.s.connect({prepend(){throw Error('should reuse root')}});a.s.open();assert.equal(a.s.allowed,true);assert.equal(a.view.current.bonus.remaining,10);assert.equal(a.writes.length,1);
});
