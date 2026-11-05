const test=require('node:test'),assert=require('node:assert/strict');
const mods=Promise.all([import('../src/modules/game/temple-test-items.js'),import('../src/modules/game/temple-rules.js'),import('../src/modules/ui/slots.js'),import('../src/modules/game/temple-account-client.js')]);
// QA CONTRACT FIXTURE ONLY. This is NOT the pending GD candidate mapping.
function qaMapping(onResolve=()=>{}){return {id:'QA-ONLY-receipt-v1',scoreTable:{moon:{3:1,4:2,5:3}},resolveItems(result){onResolve(result);return result.lineWins.length?[{itemDefinitionId:'QA-NOT-GD-ITEM',displayName:'QA предмет без эффекта',quantity:1}]:[]}};}
const fixtures={moon5:[15,16,12,23,3]};
async function setup(options={}){const [m]=await mods,data=new Map([['main-save','KEEP'],['moonclicker.fortunaDemo.v1','OLD-CASH-KEEP']]),writes=[];const storage={getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,v);writes.push(k)}};const wallet=new m.TempleTestItems({mapping:qaMapping(),storage,fixtures,allowFixtures:true,...options});return {wallet,data,writes,storage,Class:m.TempleTestItems,key:m.TEMPLE_TEST_ITEMS_KEY};}

test('pending mapping is explicit and consumes no balance/RNG/write',async()=>{let draws=0;const a=await setup({mapping:null,rng:()=>{draws++;return 0}});assert.equal(a.wallet.canSpin,false);assert.equal(a.wallet.spin(),null);assert.equal(a.wallet.balance,1000);assert.equal(draws,0);assert.equal(a.writes.length,0);});

test('spin → line → local item → reloaded inventory, no grant on load',async()=>{
 let mapped=0;const a=await setup({mapping:qaMapping(()=>mapped++)});const r=a.wallet.spin({fixtureId:'moon5'});
 assert.equal(r.grid.length,5);assert.equal(r.lineWins[0].lineId,1);assert.equal(r.lineWins[0].count,5);assert.equal(r.awardedItems.length,1);assert.equal(r.debit,10);assert.equal(a.wallet.balance,990);assert.equal(a.wallet.inventoryItems[0].quantity,1);assert.equal(a.writes.length,1);assert.equal(mapped,1);
 const restored=new a.Class({mapping:a.wallet.mapping,storage:a.storage,fixtures,allowFixtures:true});
 assert.equal(restored.balance,990);assert.equal(restored.inventoryItems[0].quantity,1);assert.equal(restored.last.awardedItems.length,1);assert.equal(mapped,1);assert.equal(a.writes.length,1);
 restored.reload();assert.equal(restored.inventoryItems[0].quantity,1);assert.equal(mapped,1);assert.equal(a.writes.length,1);
});

test('two spins stack items once each; duplicate request cannot charge or grant',async()=>{
 const a=await setup();a.wallet.spin({fixtureId:'moon5',requestId:'one'});assert.equal(a.wallet.spin({fixtureId:'moon5',requestId:'one'}),null);
 a.wallet.spin({fixtureId:'moon5',requestId:'two'});assert.equal(a.wallet.balance,980);assert.equal(a.wallet.inventoryItems.length,1);assert.equal(a.wallet.inventoryItems[0].quantity,2);assert.equal(a.wallet.inventoryVersion,2);assert.equal(a.writes.length,2);
});

test('one local write commits debit, receipt, inventory and free state',async()=>{
 const a=await setup();const r=a.wallet.spin({fixtureId:'moon5'}),saved=JSON.parse(a.data.get(a.key));assert.equal(saved.balance,r.after);assert.deepEqual(saved.inventoryItems,a.wallet.inventoryItems);assert.deepEqual(saved.bonus,a.wallet.bonus);assert.equal(saved.last.requestId,r.requestId);assert.equal(a.writes.length,1);
 assert.equal(r.gross,undefined);assert.equal(r.shardsBalance,undefined);assert.equal(a.data.get('main-save'),'KEEP');assert.equal(a.data.get('moonclicker.fortunaDemo.v1'),'OLD-CASH-KEEP');
});

test('reset restores only test1000, clears test bag/bonus, leaves other keys intact',async()=>{
 const a=await setup();a.wallet.spin({fixtureId:'moon5'});a.wallet.reset();assert.equal(a.wallet.balance,1000);assert.deepEqual(a.wallet.inventoryItems,[]);assert.equal(a.wallet.last,null);assert.equal(a.wallet.bonus.remaining,0);
 assert.equal(a.data.get('main-save'),'KEEP');assert.equal(a.data.get('moonclicker.fortunaDemo.v1'),'OLD-CASH-KEEP');assert.ok(a.writes.every(k=>k===a.key));
 const restored=new a.Class({mapping:a.wallet.mapping,storage:a.storage});assert.equal(restored.balance,1000);assert.deepEqual(restored.inventoryItems,[]);
});

test('mapping change preserves local collection but never reprices old drop or bonus',async()=>{
 const a=await setup();a.wallet.spin({fixtureId:'moon5'});let mapped=0;const replacement={...qaMapping(()=>mapped++),id:'QA-ONLY-v2'};const loaded=new a.Class({mapping:replacement,storage:a.storage});
 assert.equal(loaded.balance,990);assert.equal(loaded.inventoryItems[0].quantity,1);assert.equal(loaded.last,null);assert.equal(loaded.bonus.remaining,0);assert.equal(loaded.mappingChanged,true);assert.equal(mapped,0);
});

test('normal RNG has five stops; fixture requires explicit registered opt-in',async()=>{
 let draws=0;const a=await setup({allowFixtures:false,rng:()=>{draws++;return 0}});assert.throws(()=>a.wallet.spin({fixtureId:'moon5'}),/Explicit/);assert.equal(a.writes.length,0);
 const r=a.wallet.spin();assert.equal(draws,5);assert.equal(r.source.kind,'random');
 const [,rules]=await mods;assert.deepEqual(r.grid,rules.templeGridFromStops(a.wallet.geometry,r.stops));
});

test('insufficient balance and reentrant mapper cannot duplicate transaction',async()=>{
 let draws=0;const a=await setup({rng:()=>{draws++;return 0}});a.wallet.balance=9;a.wallet.save();const before=a.writes.length;assert.equal(a.wallet.spin(),null);assert.equal(draws,0);assert.equal(a.writes.length,before);
 a.wallet.reset();a.wallet.mapping=qaMapping(()=>a.wallet.spin({fixtureId:'moon5'}));a.writes.length=0;a.wallet.spin({fixtureId:'moon5'});assert.equal(a.wallet.balance,990);assert.equal(a.wallet.inventoryItems[0].quantity,1);assert.equal(a.writes.length,1);
});

test('mapper errors/cash/effect fields fail before debit or inventory grant',async()=>{
 for(const resolveItems of [()=>{throw Error('bad mapping')},()=>Promise.resolve([]),()=>[{itemDefinitionId:'QA',quantity:1,gross:500}],()=>[{itemDefinitionId:'QA',quantity:0}]]){
  const a=await setup({mapping:{...qaMapping(),resolveItems}});assert.throws(()=>a.wallet.spin({fixtureId:'moon5'}));assert.equal(a.wallet.balance,1000);assert.deepEqual(a.wallet.inventoryItems,[]);assert.equal(a.writes.length,0);assert.equal(a.wallet.busy,false);
 }
});

test('free state is manual/debit0/fixed stake and persists with local items',async()=>{
 const a=await setup();a.wallet.geometry=(await mods)[1].createTempleGeometry({id:'QA-SCATTER',columns:5,rows:3,reelStrips:Array.from({length:5},()=>['scatter','moon','moon'])});
 a.wallet.fixtures={trigger:[0,0,0,0,0]};a.wallet.setStake(20);const trigger=a.wallet.spin({fixtureId:'trigger'});assert.equal(trigger.freeSpinsAwarded,10);assert.equal(a.wallet.bonus.triggerStake,20);const balance=a.wallet.balance;
 const f=a.wallet.spin({mode:'free',fixtureId:'trigger'});assert.equal(f.debit,0);assert.equal(f.totalStake,20);assert.equal(f.freeSpinsAwarded,0);assert.equal(a.wallet.bonus.remaining,9);assert.equal(a.wallet.balance,balance);
 const loaded=new a.Class({geometry:a.wallet.geometry,mapping:a.wallet.mapping,storage:a.storage});assert.equal(loaded.bonus.remaining,9);assert.equal(loaded.bonus.triggerStake,20);
});

test('controller hides future bag until reveal and survives cancel/reload without duplicates',async()=>{
 const a=await setup(),[,,{DemoSlots}]=await mods;let resolve;const c=new DemoSlots();c.root={};c.model=a.wallet;c.allowed=true;c.visible=true;
 c.view={render(v){this.current=v},begin(v){this.current=v},reveal(v){this.target=v;return new Promise(r=>resolve=r)},cancel(){resolve?.(false)},selectedFixture(){return undefined}};
 const p=c.play({fixtureId:'moon5'});assert.equal(c.view.current.balance,990);assert.deepEqual(c.view.current.inventoryItems,[]);assert.deepEqual(c.view.current.awardedItems,[]);assert.equal(c.model.inventoryItems.length,1);
 for(let i=0;i<20;i++)assert.equal(await c.play({fixtureId:'moon5'}),false);c.close();await p;c.open();assert.equal(c.view.current.inventoryItems[0].quantity,1);assert.equal(c.view.current.awardedItems.length,1);assert.equal(a.writes.length,1);
});

test('test inventory cannot convert into real account projection',async()=>{
 const a=await setup(),[,,{DemoSlots},{TempleAccountClient}]=await mods;a.wallet.spin({fixtureId:'moon5'});const c=new DemoSlots();c.root={};c.view={render(v){this.current=v}};c.model=a.wallet;
 const live=new TempleAccountClient();assert.equal(c.configureAccount(live),true);assert.equal(live.shardsBalance,null);assert.equal(live.inventoryItems,null);assert.deepEqual(live.lastDrops,[]);assert.equal(live.canSpin,false);assert.equal(c.view.current.balance,null);
});

test('storage failure is explicit session-only, not a claim of reload persistence',async()=>{
 const a=await setup({storage:{getItem:()=>null,setItem(){throw Error('blocked')}}});a.wallet.spin({fixtureId:'moon5'});assert.equal(a.wallet.balance,990);assert.equal(a.wallet.inventoryItems.length,1);assert.equal(a.wallet.persistent,false);
});
