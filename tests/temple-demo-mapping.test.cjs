const test=require('node:test'),assert=require('node:assert/strict');
const mods=Promise.all([import('../src/modules/game/temple-demo-mapping.js'),import('../src/modules/game/temple-test-items.js'),import('../src/modules/game/temple-rules.js'),import('../src/modules/game/temple-candidate-geometry.js'),import('../src/modules/ui/slots.js')]);
const fixtures={level1:[4,23,14,7,2],level2:[2,2,1,10,5],control:[2,2,1,1,9],scatter:[20,20,20,3,10]};
async function setup(){const [m,w]=await mods;const data=new Map([['main','KEEP']]),writes=[],storage={getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,v);writes.push(k)}};return {mapping:m.TEMPLE_DEMO_ITEM_MAPPING,model:new w.TempleTestItems({mapping:m.TEMPLE_DEMO_ITEM_MAPPING,storage,fixtures,allowFixtures:true}),data,writes,storage,Class:w.TempleTestItems,key:w.TEMPLE_TEST_ITEMS_KEY};}

test('WILD ranks by chain/item level, never old cash score',async()=>{
 const [m,,r]=await mods;const line=r.scoreTempleLine(['wild','wild','wild','ten','jack'],m.TEMPLE_DEMO_ITEM_MAPPING.scoreTable);
 assert.deepEqual(line,{symbol:'ten',count:4,score:2});
 assert.equal(r.scoreTempleLine(Array(5).fill('wild'),m.TEMPLE_DEMO_ITEM_MAPPING.scoreTable).count,5);
 assert.equal(m.bestTempleItemLine([{lineId:1,symbol:'guardian',count:3,score:60},{lineId:2,symbol:'ten',count:4,score:2}]).lineId,2);
});

test('whole-board ties are deterministic by lineId, not number of winning lines',async()=>{
 const [m]=await mods;const best=m.bestTempleItemLine([{lineId:7,symbol:'moon',count:5,score:3},{lineId:1,symbol:'ten',count:5,score:3},{lineId:2,symbol:'guardian',count:4,score:2}]);
 assert.equal(best.lineId,1);assert.equal(m.TEMPLE_DEMO_ITEM_MAPPING.itemTypeId,null);
});

test('provided stops match exact column-major numeric grid and one qty10 level3 batch',async()=>{
 const a=await setup(),[,,r]=await mods;a.model.setStake(100);a.writes.length=0;
 const result=a.model.spin({fixtureId:'control'});
 assert.deepEqual(result.grid.map(col=>col.map(id=>r.TEMPLE_SYMBOLS.indexOf(id))),[[1,8,5],[4,8,5],[5,8,3],[3,8,4],[0,8,9]]);
 assert.ok(result.lineWins.length>1);assert.deepEqual(result.rewardedLineIds,[1]);
 assert.equal(result.awardedItems.length,1);assert.equal(result.awardedItems[0].itemDefinitionId,'demo_lunar_relic');assert.equal(result.awardedItems[0].level,3);assert.equal(result.awardedItems[0].quantity,10);
 assert.equal(result.debit,100);assert.equal(result.freeSpinsAwarded,0);assert.equal(a.model.balance,900);assert.equal(a.writes.length,1);
});

for(const [stake,qty] of [[10,1],[20,2],[50,5],[100,10]])test(`candidate stake${stake} gives one batch qty${qty}, max10`,async()=>{
 const a=await setup();a.model.setStake(stake);const result=a.model.spin({fixtureId:'control'});
 assert.equal(result.awardedItems.length,1);assert.equal(result.awardedItems[0].quantity,qty);assert.ok(result.awardedItems.reduce((n,i)=>n+i.quantity,0)<=10);
});

test('chain3/4/5 map to level1/2/3 and level stacks never auto-fuse',async()=>{
 const a=await setup();for(const [fixture,level] of [['level1',1],['level2',2],['control',3]]){const r=a.model.spin({fixtureId:fixture});assert.equal(r.awardedItems[0].level,level);}
 assert.equal(a.model.inventoryItems.length,3);a.model.spin({fixtureId:'level1'});
 assert.equal(a.model.inventoryItems.find(i=>i.level===1).quantity,2);assert.equal(a.model.inventoryItems.find(i=>i.level===2).quantity,1);
 assert.equal(a.data.get('main'),'KEEP');
});

test('scatter has no item grant, free10 uses fixed trigger stake qty without retrigger',async()=>{
 const a=await setup();a.model.setStake(100);const trigger=a.model.spin({fixtureId:'scatter'});
 assert.equal(trigger.freeSpinsAwarded,10);assert.equal(trigger.awardedItems.length,0);assert.equal(a.model.balance,900);
 const free=a.model.spin({mode:'free',fixtureId:'control'});assert.equal(free.debit,0);assert.equal(free.totalStake,100);assert.equal(free.awardedItems[0].quantity,10);assert.equal(a.model.balance,900);assert.equal(a.model.bonus.remaining,9);
 const scattered=a.model.spin({mode:'free',fixtureId:'scatter'});assert.equal(scattered.awardedItems.length,0);assert.equal(scattered.freeSpinsAwarded,0);assert.equal(a.model.bonus.remaining,8);
});

test('levels, paid line and quantity survive reload exactly once; reset is test-only',async()=>{
 const a=await setup();a.model.setStake(100);a.model.spin({fixtureId:'control'});const count=a.writes.length;
 const loaded=new a.Class({mapping:a.mapping,storage:a.storage,fixtures,allowFixtures:true});
 assert.equal(loaded.balance,900);assert.equal(loaded.inventoryItems[0].level,3);assert.equal(loaded.inventoryItems[0].quantity,10);assert.deepEqual(loaded.last.rewardedLineIds,[1]);assert.equal(a.writes.length,count);
 loaded.reload();assert.equal(loaded.inventoryItems[0].quantity,10);assert.equal(a.writes.length,count);
 loaded.reset();assert.equal(loaded.balance,1000);assert.deepEqual(loaded.inventoryItems,[]);assert.equal(a.data.get('main'),'KEEP');
});

test('controller reveals only rewarded line while keeping matched-line diagnostics',async()=>{
 const a=await setup(),[,,,,{DemoSlots}]=await mods,c=new DemoSlots();c.model=a.model;c.allowed=true;c.visible=true;c.root={};
 c.view={render(v){this.current=v},begin(v){this.current=v},reveal(v){this.current=v;return Promise.resolve(true)},cancel(){},selectedFixture(){return undefined}};
 await c.play({fixtureId:'control'});const v=c.view.current;
 assert.equal(v.result.lineWins.length,1);assert.equal(v.result.lineWins[0].lineId,1);assert.ok(v.result.matchedLineWins.length>1);assert.equal(v.awardedItems[0].level,3);assert.equal(v.walletMode,'test-items');
});

test('null or reserved test type cannot enable a live registry gate',async()=>{
 const {TempleAccountClient}=await import('../src/modules/game/temple-account-client.js');
 for(const registeredItemDefinitionIds of [null,[],['demo_lunar_relic']]){
  let sent=0;const model=new TempleAccountClient({release:{enabled:true,ownerAuthUserId:'00000000-0000-4000-8000-000000000001',projectRef:'TEST',rulesVersion:'TEST',rewardMappingVersion:'TEST',registeredItemDefinitionIds},binding:()=>({subjectId:'00000000-0000-4000-8000-000000000001',projectRef:'TEST'}),transport:{spin:()=>{sent++;}}});
  assert.equal(model.blockReason,'REGISTERED_ITEM_TYPES_REQUIRED');assert.equal(await model.spin(),null);assert.equal(sent,0);
 }
});

test('canonical grid fixture at stake20 gives one level1 batch quantity2',async()=>{
 const [m,,r]=await mods;
 const grid=[[1,0,3],[2,0,4],[3,0,5],[4,1,6],[5,2,7]].map(col=>col.map(i=>r.TEMPLE_SYMBOLS[i]));
 const result=r.scoreTempleGrid(grid,m.TEMPLE_DEMO_ITEM_MAPPING.scoreTable);
 const items=m.TEMPLE_DEMO_ITEM_MAPPING.resolveItems({...result,totalStake:20,mode:'paid'});
 assert.equal(items.length,1);assert.equal(items[0].itemDefinitionId,'demo_lunar_relic');assert.equal(items[0].level,1);assert.equal(items[0].quantity,2);
 const a=await setup();a.model.setStake(20);const transaction=a.model.spin({fixtureId:'level1'});assert.equal(transaction.after,980);assert.equal(a.model.inventoryItems[0].quantity,2);
});

test('canonical save uses only new namespace/version1 and unknown version stays read-only',async()=>{
 const a=await setup();a.data.set('moonclicker.templeItemsTest.v1','OLD');a.model.spin({fixtureId:'control'});
 assert.equal(a.key,'moonclicker.lunarTempleItemsDemo.v1');assert.equal(JSON.parse(a.data.get(a.key)).version,1);assert.equal(a.data.get('moonclicker.templeItemsTest.v1'),'OLD');
 const foreign=JSON.stringify({version:99,balance:777,inventoryItems:[]});a.data.set(a.key,foreign);
 const loaded=new a.Class({mapping:a.mapping,storage:a.storage});const writes=a.writes.length;
 assert.equal(loaded.readOnly,true);assert.equal(loaded.spin(),null);assert.equal(loaded.setStake(20),false);assert.equal(loaded.reset(),false);loaded.save();
 assert.equal(a.data.get(a.key),foreign);assert.equal(a.writes.length,writes);
});

test('reset with active free bonus requires controller confirmation',async()=>{
 const a=await setup(),[,,,,{DemoSlots}]=await mods;a.model.spin({fixtureId:'scatter'});const c=new DemoSlots();let confirm;
 c.model=a.model;c.root={};c.allowed=true;c.view={render(){},confirmReset(fn){confirm=fn}};
 assert.equal(c.reset(),false);assert.equal(c.model.bonus.remaining,10);assert.equal(typeof confirm,'function');confirm();assert.equal(c.model.bonus.remaining,0);assert.equal(c.model.balance,1000);
});
