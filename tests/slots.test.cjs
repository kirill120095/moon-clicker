const test=require('node:test'),assert=require('node:assert/strict');
const rules=import('../src/modules/game/temple-rules.js');
const wallet=import('../src/modules/game/temple-wallet.js');
const fixtures=import('../tools/slots/temple-fixtures.js');
async function setup(options={}){
 const {TempleWallet,TEMPLE_SAVE_KEY}=await wallet,{TEMPLE_FIXTURE_CONFIG,TEMPLE_FIXTURE_STOPS}=await fixtures;
 const data=new Map([['main-game-save','KEEP']]),writes=[],storage={getItem:k=>data.get(k)??null,setItem(k,v){data.set(k,v);writes.push(k)}};
 const model=new TempleWallet({config:TEMPLE_FIXTURE_CONFIG,storage,testMode:true,fixtures:TEMPLE_FIXTURE_STOPS,...options});
 return {model,data,writes,storage,key:TEMPLE_SAVE_KEY,TempleWallet,config:TEMPLE_FIXTURE_CONFIG,fixtureStops:TEMPLE_FIXTURE_STOPS};
}

test('fixed column-major geometry, ten exact paylines and preset stakes',async()=>{
 const r=await rules;
 assert.equal(r.TEMPLE_COLUMNS,5);assert.equal(r.TEMPLE_ROWS,3);
 assert.deepEqual(r.TEMPLE_STAKES,[10,20,50,100]);
 assert.deepEqual(r.TEMPLE_PAYLINES,[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,0,0],[2,2,1,2,2],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0]]);
 assert.deepEqual(r.TEMPLE_SYMBOLS,['ten','jack','queen','king','ace','crystal','moon','guardian','wild','scatter']);
});

test('five circular stops produce three adjacent symbols and wrap from top index',async()=>{
 const r=await rules,a=await setup(),config=r.createTempleConfig({...a.config,id:'wrap',reelStrips:Array.from({length:5},()=>['ten','jack','queen','king'])});
 assert.deepEqual(r.templeGridFromStops(config,[0,1,2,3,0]),[['ten','jack','queen'],['jack','queen','king'],['queen','king','ten'],['king','ten','jack'],['ten','jack','queen']]);
 for(const bad of [[0,0,0,0],[-1,0,0,0,0],[4,0,0,0,0],[.1,0,0,0,0]])assert.throws(()=>r.templeGridFromStops(config,bad));
});

test('configuration rejects geometry/payline drift, scatter cash and silent fractional rounding',async()=>{
 const r=await rules,a=await setup();
 for(const input of [{...a.config,columns:7},{...a.config,rows:1},{...a.config,paylines:Array(10).fill([0,0,0,0,0])},{...a.config,reelStrips:[['ten']]},{...a.config,paytable:{...a.config.paytable,scatter:{3:1,4:2,5:3}}},{...a.config,paytable:{...a.config.paytable,moon:{3:1.5,4:2,5:3}}}])assert.throws(()=>r.createTempleConfig(input));
 const c=r.createTempleConfig(a.config);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.reelStrips[0])&&Object.isFrozen(c.paytable.moon));
});

test('three-to-five matching must begin at reel zero, not second reel or anywhere',async()=>{
 const r=await rules,a=await setup();
 assert.equal(r.evaluateTempleLine(a.config,['ten','moon','moon','moon','moon'],1),null);
 assert.equal(r.evaluateTempleLine(a.config,['moon','moon','ten','moon','moon'],1),null);
 assert.equal(r.evaluateTempleLine(a.config,['moon','moon','moon','ten','jack'],1).count,3);
 assert.equal(r.evaluateTempleLine(a.config,['moon','moon','moon','moon','moon'],1).gross,12);
});

test('WILD ambiguity chooses one highest payout candidate, not sum or longest-only',async()=>{
 const r=await rules,a=await setup();
 const config=r.createTempleConfig({...a.config,id:'wild-ambiguity',paytable:{...a.config.paytable,moon:{3:2,4:5,5:50},wild:{3:100,4:150,5:200}}});
 const result=r.evaluateTempleLine(config,['wild','wild','wild','moon','moon'],1);
 assert.deepEqual(result,{symbol:'wild',count:3,multiplier:100,gross:100});
 const noOwn={...a.config.paytable};delete noOwn.wild;
 const without=r.createTempleConfig({...a.config,id:'no-wild-own',paytable:{...noOwn,guardian:{3:3,4:10,5:80}}});
 assert.equal(r.evaluateTempleLine(without,Array(5).fill('wild'),1).symbol,'guardian');
 assert.equal(r.evaluateTempleLine(without,Array(5).fill('wild'),1).gross,80);
});

test('five WILD pay one candidate per line; SCATTER never substitutes or pays cash',async()=>{
 const r=await rules,a=await setup();
 assert.equal(r.evaluateTempleLine(a.config,Array(5).fill('wild'),1).gross,16);
 assert.equal(r.evaluateTempleLine(a.config,['wild','wild','scatter','moon','moon'],1),null);
 const result=r.evaluateTempleGrid(a.config,Array.from({length:5},()=>Array(3).fill('scatter')),10);
 assert.equal(result.gross,0);assert.equal(result.lineWins.length,0);assert.equal(result.scatterCount,15);assert.equal(result.triggersFreeSpins,true);
});

test('all ten lines pay independently once and gross scales by totalStake/10',async()=>{
 const r=await rules,a=await setup(),grid=Array.from({length:5},()=>Array(3).fill('moon'));
 for(const stake of [10,20,50,100]){const result=r.evaluateTempleGrid(a.config,grid,stake);assert.equal(result.lineBet,stake/10);assert.equal(result.lineWins.length,10);assert.deepEqual(result.lineWins.map(l=>l.lineId),[1,2,3,4,5,6,7,8,9,10]);assert.equal(result.gross,12*stake);}
});

test('normal RNG uses exactly five draws, never fifteen independent cells',async()=>{
 let calls=0;const samples=[0,.2,.4,.6,.999];const a=await setup({rng:()=>{calls++;return samples.shift();}}),r=await rules;
 const result=a.model.spin({mode:'paid'});assert.equal(calls,5);assert.equal(result.source.kind,'random');
 assert.deepEqual(result.grid,r.templeGridFromStops(a.config,result.stops));assert.equal(a.writes.length,1);
 assert.equal(result.debit,10);assert.equal(a.model.balance,990+result.creditedGross);
});

test('deterministic fixtures are explicit test-only strip stops, never hidden normal rerolls',async()=>{
 const a=await setup();const first=a.model.spin({fixtureId:'leftThree'});
 assert.equal(first.source.kind,'fixture');assert.equal(first.source.id,'leftThree');assert.deepEqual(first.stops,a.fixtureStops.leftThree);
 const b=await setup({testMode:false});assert.throws(()=>b.model.spin({fixtureId:'leftThree'}),/test mode/);assert.equal(b.writes.length,0);
 let draws=0;const c=await setup({rng:()=>{draws++;return 0}});assert.equal(c.model.spin().source.kind,'random');assert.equal(draws,5);
});

test('duplicate request ID never debits, pays or consumes RNG again',async()=>{
 let draws=0;const a=await setup({rng:()=>{draws++;return 0}});
 a.model.spin({requestId:'one'});const balance=a.model.balance;
 assert.equal(a.model.spin({requestId:'one'}),null);assert.equal(a.model.balance,balance);assert.equal(a.writes.length,1);assert.equal(draws,5);
});

test('insufficient chips block before RNG; permitted stakes only',async()=>{
 let draws=0;const a=await setup({rng:()=>{draws++;return 0}});a.model.setStake(100);a.model.balance=99;a.model.save();const writes=a.writes.length;
 assert.equal(a.model.spin(),null);assert.equal(draws,0);assert.equal(a.writes.length,writes);assert.equal(a.model.balance,99);
 for(const stake of [0,5,15,200,'10'])assert.throws(()=>a.model.setStake(stake));
});

test('paid scatter trigger credits no scatter cash and awards exactly ten manual free spins',async()=>{
 const a=await setup();a.model.setStake(20);a.writes.length=0;
 const trigger=a.model.spin({mode:'paid',fixtureId:'trigger'});
 assert.equal(trigger.scatterCount,3);assert.equal(trigger.gross,0);assert.equal(trigger.debit,20);assert.equal(trigger.net,-20);assert.equal(trigger.freeSpinsAwarded,10);
 assert.deepEqual(a.model.bonus,{remaining:10,triggerStake:20});assert.equal(a.model.balance,980);assert.equal(a.writes.length,1);
});

test('bonus locks stake and excludes paid mode; free debit0 and fixed trigger stake',async()=>{
 const a=await setup();a.model.setStake(50);a.model.spin({fixtureId:'trigger'});const balance=a.model.balance,writes=a.writes.length;
 assert.equal(a.model.setStake(100),false);assert.equal(a.model.stake,50);
 assert.equal(a.model.spin({mode:'paid',fixtureId:'fiveWild'}),null);assert.equal(a.writes.length,writes);
 const free=a.model.spin({mode:'free',fixtureId:'leftThree'});
 assert.equal(free.totalStake,50);assert.equal(free.lineBet,5);assert.equal(free.debit,0);assert.equal(free.net,free.creditedGross);
 assert.equal(a.model.balance,balance+free.creditedGross);assert.equal(a.model.bonus.remaining,9);assert.equal(a.writes.length,writes+1);
});

test('SCATTER in free mode cannot retrigger, expand or pay separate scatter cash',async()=>{
 const a=await setup();a.model.spin({fixtureId:'trigger'});const balance=a.model.balance;
 for(let remaining=9;remaining>=0;remaining--){const r=a.model.spin({mode:'free',fixtureId:'trigger'});assert.equal(r.freeSpinsAwarded,0);assert.equal(r.triggersFreeSpins,false);assert.equal(r.debit,0);assert.equal(r.gross,0);assert.equal(a.model.bonus.remaining,remaining);assert.equal(a.model.balance,balance);}
 assert.equal(a.model.bonus.triggerStake,null);assert.equal(a.model.spin({mode:'free'}),null);assert.equal(a.writes.length,11);
});

test('reload preserves free counter/stake without re-awarding or charging; last free consumes once',async()=>{
 const a=await setup();a.model.setStake(100);a.model.spin({fixtureId:'trigger'});a.model.spin({mode:'free',fixtureId:'leftThree'});const count=a.writes.length,balance=a.model.balance;
 const loaded=new a.TempleWallet({config:a.config,storage:a.storage,testMode:true,fixtures:a.fixtureStops});
 assert.deepEqual(loaded.bonus,{remaining:9,triggerStake:100});assert.equal(loaded.balance,balance);assert.equal(loaded.last.debit,0);assert.equal(a.writes.length,count);
 loaded.reload();assert.equal(a.writes.length,count);assert.equal(loaded.bonus.remaining,9);
});

test('reset clears only demo/free counter/last and sets exactly1000',async()=>{
 const a=await setup();a.model.spin({fixtureId:'trigger'});a.model.reset();
 assert.equal(a.model.balance,1000);assert.deepEqual(a.model.bonus,{remaining:0,triggerStake:null});assert.equal(a.model.stake,10);assert.equal(a.model.last,null);
 assert.equal(a.data.get('main-game-save'),'KEEP');assert.ok(a.writes.every(k=>k===a.key));
});

test('all legacy7x1 saves preserve valid balance but clear old last/bonus and flag rule change',async()=>{
 for(const version of [1,2,3]){const a=await setup();a.data.set(a.key,JSON.stringify({version,balance:1275,last:{before:1000,symbols:[0,0,0,0,0,0,0]},bonus:{remaining:99,triggerStake:999}}));a.model.reload();assert.equal(a.model.balance,1275);assert.equal(a.model.last,null);assert.deepEqual(a.model.bonus,{remaining:0,triggerStake:null});assert.equal(a.model.rulesChanged,true);assert.equal(a.writes.length,0);}
});

test('changing config ID clears bonus/old result while preserving balance',async()=>{
 const a=await setup();a.model.spin({fixtureId:'trigger'});const balance=a.model.balance;
 const loaded=new a.TempleWallet({config:{...a.config,id:'new-final-rules'},storage:a.storage});
 assert.equal(loaded.balance,balance);assert.equal(loaded.last,null);assert.equal(loaded.bonus.remaining,0);assert.equal(loaded.rulesChanged,true);
});

test('payout <= total stake is not celebrated; free net uses debit0 explicitly',async()=>{
 const a=await setup(),partial=a.model.spin({fixtureId:'leftThree'});
 assert.equal(partial.gross,2);assert.equal(partial.net,-8);assert.equal(partial.outcome,'partial-return');assert.equal(partial.celebrate,false);
 a.model.spin({fixtureId:'trigger'});const free=a.model.spin({mode:'free',fixtureId:'leftThree'});
 assert.equal(free.debit,0);assert.equal(free.net,2);assert.equal(free.celebrate,false);assert.equal(free.outcome,'free-result');
 const b=await setup(),big=b.model.spin({fixtureId:'fiveWild'});assert.equal(big.celebrate,true);
});

test('blocked storage remains session-only; invalid RNG never commits a transaction',async()=>{
 const {TempleWallet}=await wallet,{TEMPLE_FIXTURE_CONFIG:c}=await fixtures;
 const m=new TempleWallet({config:c,storage:{getItem(){throw Error('blocked')}},rng:()=>NaN});
 assert.equal(m.persistent,false);assert.throws(()=>m.spin());assert.equal(m.balance,1000);assert.equal(m.sequence,0);
});

test('ordinary line cash and scatter bonus commit together in one transaction',async()=>{
 const a=await setup(),r=a.model.spin({mode:'paid',fixtureId:'lineAndBonus'});
 assert.equal(r.gross,2);assert.equal(r.debit,10);assert.equal(r.net,-8);assert.equal(a.model.balance,992);
 assert.equal(r.scatterCount,3);assert.equal(r.freeSpinsAwarded,10);assert.equal(a.model.bonus.remaining,10);assert.equal(a.writes.length,1);
});

test('unconfigured real path preserves legacy balance and never starts unapproved math',async()=>{
 const a=await setup();a.data.set(a.key,JSON.stringify({version:3,balance:1275,last:{symbols:[0,0,0,0,0,0,0]}}));
 let draws=0;const m=new a.TempleWallet({storage:a.storage,rng:()=>{draws++;return 0}});
 assert.equal(m.balance,1275);assert.equal(m.last,null);assert.equal(m.rulesChanged,true);
 assert.equal(m.spin(),null);assert.equal(m.lastError,'CONFIG_PENDING');assert.equal(draws,0);assert.equal(a.writes.length,0);
});
