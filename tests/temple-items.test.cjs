const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modules=Promise.all([import('../src/modules/game/temple-rules.js'),import('../src/modules/game/temple-candidate-geometry.js'),import('../src/modules/game/temple-item-protocol.js'),import('../src/modules/game/temple-account-client.js')]);
// Synthetic identities, never Kirill's auth UUID or a real project.
const OWNER='00000000-0000-4000-8000-000000000001',OTHER='00000000-0000-4000-8000-000000000002';
const REQUEST='00000000-0000-4000-8000-000000000010',NEXT='00000000-0000-4000-8000-000000000011';
const release={enabled:true,ownerAuthUserId:OWNER,projectRef:'TEST-PROJECT-NOT-REAL',rulesVersion:'TEST-RULES',rewardMappingVersion:'TEST-ITEM-MAPPING'};
function state(overrides={}){return {protocolVersion:1,subjectId:OWNER,stateVersion:0,inventoryVersion:0,shardsBalance:500,rulesVersion:'TEST-RULES',rewardMappingVersion:'TEST-ITEM-MAPPING',bonus:{remaining:0,triggerStake:null},inventoryItems:[],...overrides};}
async function response(request,overrides={}){
 const [r,g]=await modules;const grid=r.templeGridFromStops(g.TEMPLE_CANDIDATE_GEOMETRY,[15,16,12,23,3]);
 return {...state({stateVersion:1,inventoryVersion:1,shardsBalance:490,inventoryItems:undefined}),requestId:request.requestId,mode:request.mode,totalStake:request.totalStake,shardsDebited:request.mode==='free'?0:request.totalStake,gridOrder:'column-major',grid,lineWins:[{lineId:1,symbol:'moon',count:5,score:77}],awardedItems:[{awardId:'TEST-GRANT-1',itemDefinitionId:'TEST-ITEM-NOT-APPROVED',quantity:1,displayName:'Тестовый receipt'}],...overrides};
}
async function client(options={}){
 const [,,,c]=await modules;const calls=[];const transport=options.transport||{spin:async request=>{calls.push(request);return response(request)}};
 const model=new c.TempleAccountClient({release,binding:()=>({subjectId:OWNER,projectRef:release.projectRef}),transport,requestId:()=>REQUEST,...options});
 return {model,calls};
}

test('candidate24 strips decode exact order as5columns and wrap correctly',async()=>{
 const [r,g]=await modules;assert.deepEqual(g.TEMPLE_CANDIDATE_INDICES.map(a=>a.length),[24,24,24,24,24]);assert.equal(24**5,7962624);
 const grid=r.templeGridFromStops(g.TEMPLE_CANDIDATE_GEOMETRY,[0,0,0,0,0]);
 assert.deepEqual(grid,[['guardian','queen','jack'],['ten','queen','ace'],['king','crystal','wild'],['moon','king','wild'],['queen','crystal','ten']]);
 assert.deepEqual(r.templeGridFromStops(g.TEMPLE_CANDIDATE_GEOMETRY,[23,23,23,23,23])[0],['jack','guardian','queen']);
 assert.throws(()=>r.validateTempleGrid(Array.from({length:3},()=>Array(5).fill('moon'))),/column-major/);
 assert.throws(()=>g.decodeTempleStrips(g.TEMPLE_CANDIDATE_INDICES,[...r.TEMPLE_SYMBOLS].reverse()));
});

test('geometry has no cash table; unitless line score requires explicit mapping',async()=>{
 const [r,g]=await modules;assert.equal(g.TEMPLE_CANDIDATE_GEOMETRY.paytable,undefined);
 assert.throws(()=>r.scoreTempleLine(['wild','wild','wild','moon','moon'],null));
 const score=r.scoreTempleLine(['wild','wild','wild','moon','moon'],{moon:{5:7},wild:{3:9}});
 assert.deepEqual(score,{symbol:'wild',count:3,score:9});assert.equal(score.gross,undefined);
 const grid=r.templeGridFromStops(g.TEMPLE_CANDIDATE_GEOMETRY,[15,16,12,23,3]);
 const scored=r.scoreTempleGrid(grid,{moon:{5:77}});assert.equal(scored.lineWins.length,1);assert.equal(scored.totalLineScore,77);assert.equal(scored.gross,undefined);assert.equal(scored.awardedItems,undefined);
});

test('default release fails closed with no guessed UUID, project or transport',async()=>{
 const [,,p,c]=await modules;assert.deepEqual(p.TEMPLE_ACCOUNT_RELEASE,{enabled:false,ownerAuthUserId:null,projectRef:null,rulesVersion:null,rewardMappingVersion:null});
 const m=new c.TempleAccountClient();assert.equal(m.blockReason,'RELEASE_DISABLED');assert.equal(await m.spin(),null);assert.equal(m.shardsBalance,null);assert.equal(m.inventoryItems,null);assert.equal(m.reset(),false);
});

test('nickname cannot authorize: wrong subject/project/missing mapping send zero requests',async()=>{
 for(const options of [
  {release:{...release,enabled:false}},
  {release:{...release,ownerAuthUserId:null}},
  {release:{...release,rewardMappingVersion:null}},
  {binding:()=>({subjectId:OTHER,username:'kirill120095',projectRef:release.projectRef})},
  {binding:()=>({subjectId:OWNER,projectRef:'WRONG-PROJECT'})}
 ]){const a=await client(options);assert.equal(a.model.acceptState(state()),false);assert.equal(await a.model.spin(),null);assert.equal(a.calls.length,0);assert.equal(a.model.shardsBalance,null);}
});

test('spin needs authoritative initial state; request whitelist contains no outcomes or subject',async()=>{
 const [,,p]=await modules,a=await client();assert.equal(await a.model.spin(),null);assert.equal(a.calls.length,0);
 assert.equal(a.model.acceptState(state()),true);await a.model.spin();const req=a.calls[0];
 assert.deepEqual(Object.keys(req).sort(),['expectedInventoryVersion','expectedStateVersion','mode','protocolVersion','requestId','totalStake','type'].sort());
 assert.equal(req.subjectId,undefined);assert.equal(req.grid,undefined);assert.equal(req.awardedItems,undefined);
 assert.throws(()=>p.buildTempleItemRequest({requestId:REQUEST,mode:'paid',totalStake:10,expectedStateVersion:0,expectedInventoryVersion:0,grid:[]}));
});

test('client never optimistically debits and never synthesizes inventory from drops',async()=>{
 let resolve;const a=await client({transport:{spin:request=>new Promise(r=>{resolve=()=>response(request).then(r)})}});a.model.acceptState(state());
 const pending=a.model.spin();assert.equal(a.model.shardsBalance,500);assert.deepEqual(a.model.inventoryItems,[]);assert.deepEqual(a.model.lastDrops,[]);
 resolve();await pending;assert.equal(a.model.shardsBalance,490);assert.equal(a.model.inventoryVersion,1);assert.equal(a.model.inventoryItems,null);assert.equal(a.model.lastDrops.length,1);
 assert.equal(a.model.acceptState(state({stateVersion:1,inventoryVersion:1,shardsBalance:490,inventoryItems:[{instanceId:'TEST-INSTANCE',itemDefinitionId:'TEST-ITEM-NOT-APPROVED',quantity:1}]})),true);
 assert.equal(a.model.inventoryItems.length,1);
});

test('busy requests and reentrant ID generation cannot send two spins',async()=>{
 let resolve,calls=0,model;const a=await client({requestId:()=>{model.spin();return REQUEST},transport:{spin:request=>{calls++;return new Promise(r=>{resolve=()=>response(request).then(r)})}}});model=a.model;model.acceptState(state());
 const pending=model.spin();for(let i=0;i<20;i++)assert.equal(await model.spin(),null);assert.equal(calls,1);resolve();await pending;assert.equal(model.shardsBalance,490);
 assert.equal(await model.spin({requestId:REQUEST}),null);assert.equal(calls,1);
});

test('timeout freezes new requests; explicit reconciliation reuses exact same requestId',async()=>{
 const calls=[];const a=await client({transport:{spin:async req=>{calls.push(req);if(calls.length===1)throw Error('simulated unknown outcome');return response(req)}}});a.model.acceptState(state());
 assert.equal(await a.model.spin(),null);assert.equal(a.model.shardsBalance,500);assert.equal(a.model.uncertain,true);
 assert.equal(await a.model.spin({requestId:NEXT}),null);assert.equal(calls.length,1);
 await a.model.retryPending();assert.equal(calls.length,2);assert.deepEqual(calls[1],calls[0]);assert.equal(a.model.shardsBalance,490);assert.equal(a.model.lastDrops.length,1);assert.equal(a.model.uncertain,false);
});

test('cash, row-major, duplicate line and duplicate item DTOs are rejected without local grants',async()=>{
 const variants=[r=>({...r,gross:1000}),r=>({...r,grid:Array.from({length:3},()=>Array(5).fill('moon'))}),r=>({...r,gridOrder:'row-major'}),r=>({...r,lineWins:[r.lineWins[0],r.lineWins[0]]}),r=>({...r,awardedItems:[r.awardedItems[0],r.awardedItems[0]]}),r=>({...r,subjectId:OTHER}),r=>({...r,requestId:NEXT})];
 for(const alter of variants){const a=await client({transport:{spin:async req=>alter(await response(req))}});a.model.acceptState(state());assert.equal(await a.model.spin(),null);assert.equal(a.model.shardsBalance,500);assert.deepEqual(a.model.lastDrops,[]);assert.equal(a.model.uncertain,true);}
});

test('invalid item-version advance, stale state and wrong grid-prefix cannot apply',async()=>{
 for(const alter of [r=>({...r,inventoryVersion:0}),r=>({...r,stateVersion:0}),r=>({...r,lineWins:[{lineId:1,symbol:'guardian',count:5,score:77}]})]){
  const a=await client({transport:{spin:async req=>alter(await response(req))}});a.model.acceptState(state());assert.equal(await a.model.spin(),null);assert.equal(a.model.shardsBalance,500);
 }
});

test('free mode uses server bonus state, fixed stake and zero authoritative debit',async()=>{
 const a=await client({transport:{spin:async req=>response(req,{shardsDebited:0,shardsBalance:500,totalStake:20,mode:'free',bonus:{remaining:2,triggerStake:20}})}});
 a.model.acceptState(state({bonus:{remaining:3,triggerStake:20}}));assert.equal(a.model.setStake(100),false);assert.equal(await a.model.spin({mode:'paid'}),null);
 const r=await a.model.spin({mode:'free'});assert.equal(r.shardsDebited,0);assert.equal(r.totalStake,20);assert.equal(a.model.shardsBalance,500);assert.equal(a.model.bonus.remaining,2);
});

test('response after account change cannot paint another subject or grant locally',async()=>{
 let binding={subjectId:OWNER,projectRef:release.projectRef},resolve;
 const a=await client({binding:()=>binding,transport:{spin:req=>new Promise(r=>{resolve=()=>response(req).then(r)})}});a.model.acceptState(state());const p=a.model.spin();
 binding={subjectId:OTHER,projectRef:release.projectRef};resolve();await p;
 assert.equal(a.model.shardsBalance,500);assert.equal(a.model.last,null);assert.equal(a.model.lastDrops.length,0);assert.equal(a.model.blockReason,'ACCOUNT_NOT_ALLOWED');
});

test('account adapter contains no real service transport, local wallet storage or main state mutation',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/modules/game/temple-account-client.js'),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|localStorage|\.functions\.invoke|\.rpc\(|\.playerData\b|TempleWallet/);
 assert.match(src,/transport\.spin/);assert.match(src,/No optimistic refund/);
});
