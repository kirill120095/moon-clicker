const test=require('node:test'),assert=require('node:assert/strict');
const mods=Promise.all([import('../src/modules/ui/slots.js'),import('../src/modules/game/temple-account-client.js'),import('../src/modules/game/temple-wallet.js'),import('../src/modules/game/temple-rules.js'),import('../src/modules/game/temple-candidate-geometry.js')]);
const OWNER='00000000-0000-4000-8000-000000000001',OTHER='00000000-0000-4000-8000-000000000002',REQ='00000000-0000-4000-8000-000000000010';
const release={enabled:true,ownerAuthUserId:OWNER,projectRef:'TEST-PROJECT',rulesVersion:'TEST-RULES',rewardMappingVersion:'TEST-MAPPING'};
const base={protocolVersion:1,subjectId:OWNER,stateVersion:0,inventoryVersion:0,shardsBalance:500,rulesVersion:'TEST-RULES',rewardMappingVersion:'TEST-MAPPING',inventoryItems:[]};
async function setup(){
 const [{DemoSlots},{TempleAccountClient},,r,g]=await mods;let resolve,binding={subjectId:OWNER,projectRef:'TEST-PROJECT'},calls=0;
 const client=new TempleAccountClient({release,binding:()=>binding,requestId:()=>REQ,transport:{spin:request=>{calls++;return new Promise(done=>{resolve=()=>done({...base,stateVersion:1,inventoryVersion:1,shardsBalance:490,requestId:request.requestId,mode:'paid',totalStake:10,shardsDebited:10,gridOrder:'column-major',grid:r.templeGridFromStops(g.TEMPLE_CANDIDATE_GEOMETRY,[15,16,12,23,3]),lineWins:[{lineId:1,symbol:'moon',count:5,score:77}],awardedItems:[{awardId:'TEST-AWARD',itemDefinitionId:'TEST-ITEM',quantity:1}],inventoryItems:undefined})})}}});
 client.acceptState(base);const s=new DemoSlots();s.root={};s.model=client;s.allowed=true;s.visible=true;
 s.view={render(v){this.current=v},begin(v){this.current=v},reveal(v){this.current=v;return Promise.resolve(true)},cancel(){},selectedFixture(){return undefined}};
 return {s,client,resolve:()=>resolve(),get calls(){return calls},other(){binding={subjectId:OTHER,projectRef:'TEST-PROJECT'}}};
}

test('default item UI has no fake1000 shards, no gross/net reward, and reset is unavailable',async()=>{
 const [{DemoSlots},{TempleAccountClient}]=await mods;const s=new DemoSlots();s.model=new TempleAccountClient();
 const v=s.snapshot();assert.equal(v.rewardMode,'items');assert.equal(v.balance,null);assert.equal(v.inventoryItems,null);assert.equal(v.inventoryVersion,null);assert.equal(v.spinAvailable,false);assert.equal(v.resetAvailable,false);
 assert.equal(s.reset(),false);assert.equal(await s.play(),false);
});

test('switching test adapter to account cannot transfer demo chips or bonuses',async()=>{
 const [{DemoSlots},{TempleAccountClient},{TempleWallet}]=await mods;const s=new DemoSlots();s.root={};s.view={render(v){this.current=v}};s.model=new TempleWallet({testMode:true});s.model.balance=123456;
 const account=new TempleAccountClient();assert.equal(s.configureAccount(account),true);assert.equal(account.shardsBalance,null);assert.deepEqual(account.lastDrops,[]);assert.equal(s.view.current.balance,null);
});

test('async account result survives view cancel without a second request or local debit',async()=>{
 const a=await setup();const p=a.s.play();assert.equal(a.s.view.current.balance,500);assert.equal(a.client.shardsBalance,500);
 a.s.close();a.s.open();assert.equal(a.s.view.current.busy,true);assert.equal(await a.s.play(),false);assert.equal(a.calls,1);
 a.resolve();await p;assert.equal(a.calls,1);assert.equal(a.client.shardsBalance,490);assert.equal(a.s.view.current.balance,490);assert.equal(a.s.view.current.awardedItems.length,1);assert.equal(a.s.view.current.inventoryItems,null);
 assert.equal(a.s.view.current.result.gross,undefined);assert.equal(a.s.view.current.result.net,undefined);
});

test('account projection hides all financial/inventory data after identity mismatch',async()=>{
 const a=await setup();const p=a.s.play();a.resolve();await p;a.other();
 const v=a.s.snapshot();assert.equal(v.balance,null);assert.equal(v.result,null);assert.equal(v.inventoryItems,null);assert.deepEqual(v.awardedItems,[]);assert.equal(v.spinAvailable,false);
});
