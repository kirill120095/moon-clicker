const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/modules/ui/slots.js'), 'utf8');
const EXPECTED = [2,5,12,40,150];
const CONTROLS = [
  [[0,0,0,1,2,3,4],20,10],
  [[0,0,0,1,1,1,2],40,30],
  [[0,0,0,0,1,1,1],70,60],
  [[0,0,0,0,1,2,3],50,40],
  [[0,0,0,0,0,0,0],1500,1490],
  [[0,0,1,1,2,2,3],0,-10]
];
function setup() {
  const data = new Map([['existing-game-save', '{"shards":4321,"moons":["fire"]}']]);
  const writes = [];
  const storage = { getItem: k => data.get(k) ?? null, setItem(k, v) { writes.push(k); data.set(k, v); } };
  const c = { console, storage, Math: Object.create(Math), Set };
  vm.createContext(c);
  vm.runInContext(source.replace(/\bexport\s+/g, ''), c);
  const run = code => vm.runInContext(code, c);
  run('var model = new DemoSlotBalance(storage);');
  const outcome = run('slotOutcome');
  return { data, writes, c, run, outcome };
}
function fixed(s, ids) {
  s.run(`var samples=${JSON.stringify(ids.map(id => (id + .5) / 8))};model.random=()=>samples.shift();`);
}

for (let id = 0; id < 8; id++) for (let count = 3; count <= 7; count++) {
  test(`demo gross type ${id + 1}/8 × ${count} matches uses uniform exact-count multiplier`, () => {
    const s = setup();
    const filler = Array.from({ length: 8 }, (_, i) => i).filter(i => i !== id).slice(0, 7 - count);
    const symbols = [...Array(count).fill(id), ...filler];
    const shuffled = [0,3,6,2,5,1,4].map(i => symbols[i]);
    const result = s.outcome(shuffled);
    assert.equal(result.groups.length, 1); assert.equal(result.groups[0].count, count);
    assert.equal(result.groups[0].symbol, id); assert.equal(result.groups[0].positions.length, count);
    assert.equal(result.multiplier, EXPECTED[count - 3]);
    assert.equal(result.payout, EXPECTED[count - 3] * 10);
    assert.equal(result.kind, 'win');
    fixed(s, shuffled); assert.equal(s.run('model.spin().payout'), result.payout);
    assert.equal(s.run('model.balance'), 990 + result.payout); assert.equal(s.writes.length, 1);
  });
}

for (const [ids, gross, net] of CONTROLS) {
  test(`coordinator control ${ids.join('')}: gross ${gross}, net ${net}, no extra stake return`, () => {
    const s = setup(); fixed(s, ids);
    assert.equal(s.run('model.spin().payout'), gross);
    assert.equal(s.run('model.last.after-model.last.before'), net);
    assert.equal(s.run('model.balance'), 1000 + net);
    assert.equal(s.writes.length, 1);
  });
}

test('3432 weighted count distributions retain exact table and supplied theoretical totals', () => {
  const { outcome } = setup(); let checked=0,total=0,winners=0,grossTotal=0;
  const factorial = [1,1,2,6,24,120,720,5040];
  function visit(counts, remaining) {
    if (counts.length === 7) {
      counts = [...counts, remaining];
      const result = outcome(counts.flatMap((n, id) => Array(n).fill(id)));
      assert.equal(result.groups.length, counts.filter(n => n >= 3).length);
      assert.equal(result.payout, counts.reduce((sum,n) => sum+(n>=3?EXPECTED[n-3]*10:0),0));
      assert.ok(result.groups.length <= 2);
      const weight=factorial[7]/counts.reduce((product,n)=>product*factorial[n],1);
      total+=weight; if(result.payout>0)winners+=weight; grossTotal+=weight*result.payout;
      checked++; return;
    }
    for (let n=0;n<=remaining;n++) visit([...counts,n],remaining-n);
  }
  visit([],7);
  assert.equal(checked,3432); assert.equal(total,2097152);
  assert.equal((winners/total*100).toFixed(6),'35.832977');
  assert.equal((grossTotal/total/10*100).toFixed(6),'92.526627');
});

test('RNG takes exactly seven fresh independent calls per spin; result does not reroll', () => {
  const s=setup(); let calls=0;
  const values=[0,1/8,2/8,3/8,4/8,5/8,6/8,7/8,7/8,7/8,1/8,2/8,3/8,4/8];
  s.c.Math.random=()=>{calls++;return values.shift();};
  s.run('model.spin()'); assert.equal(calls,7);
  assert.equal(s.run('JSON.stringify(model.last.symbols)'),JSON.stringify([0,1,2,3,4,5,6]));
  assert.equal(s.run('model.balance'),990);
  s.run('model.reload()'); assert.equal(calls,7);
  s.run('model.spin()'); assert.equal(calls,14);
  assert.equal(s.run('JSON.stringify(model.last.symbols)'),JSON.stringify([7,7,7,1,2,3,4]));
  assert.equal(s.run('model.balance'),1000); assert.equal(s.writes.length,2);
});

test('every symbol has the same one-eighth RNG interval including boundary values', () => {
  for(let id=0;id<8;id++) for(const value of [id/8,(id+.5)/8,(id+1)/8-Number.EPSILON]) {
    const s=setup();let calls=0;s.c.Math.random=()=>{calls++;return value;};
    s.run('model.spin()');assert.equal(calls,7);
    assert.equal(s.run('model.last.symbols.every(v=>v==='+id+')'),true);
    assert.equal(s.run('model.last.payout'),1500);
    assert.equal(s.run('model.balance'),2490);assert.equal(s.writes.length,1);
  }
});

test('two interleaved triples are both paid; four plus three is additive, not nested', () => {
  const s=setup();
  for(const [symbols,payout,counts] of [[[0,1,0,2,1,0,1],40,[3,3]],[[0,1,0,1,0,1,0],70,[4,3]]]) {
    const result=s.outcome(symbols);
    assert.equal(result.groups.length,2);assert.equal(JSON.stringify(result.groups.map(g=>g.count)),JSON.stringify(counts));
    assert.equal(result.payout,payout);
    s.run('model.reset()');s.writes.length=0;fixed(s,symbols);
    assert.equal(s.run('model.spin().after'),990+payout);assert.equal(s.writes.length,1);
  }
});

test('pairs never pay and old three-reel inputs are rejected', () => {
  const s=setup();
  for(const symbols of [[0,1,2,3,4,5,6],[0,0,1,1,2,2,3]]) {
    assert.equal(s.outcome(symbols).payout,0);assert.equal(s.outcome(symbols).groups.length,0);
  }
  for(const bad of [[],[0,0,0],[0,1,2,3,4,5,8],[0,1,2,3,4,5,-1],[0,1,2,3,4,5,.1],[0,1,2,3,4,5,'6'],null])assert.throws(()=>s.outcome(bad));
});

test('each spin writes once and touches only the isolated demo wallet', () => {
  for(const [ids,balance,payout] of [[[0,1,0,2,3,0,4],1010,20],[[0,1,0,2,1,0,1],1030,40],[[0,1,2,3,4,5,6],990,0]]) {
    const s=setup();fixed(s,ids);
    assert.equal(s.run('model.spin().payout'),payout);assert.equal(s.run('model.balance'),balance);
    assert.deepEqual(s.writes,['moonclicker.fortunaDemo.v1']);
    assert.equal(s.data.get('existing-game-save'),'{"shards":4321,"moons":["fire"]}');
  }
});

test('reload during animation restores gross total once without another stake return', () => {
  const s=setup();fixed(s,[0,1,0,2,1,0,1]);s.run('model.spin();var restored=new DemoSlotBalance(storage);');
  assert.equal(s.run('restored.balance'),1030);assert.equal(s.run('restored.last.payout'),40);
  assert.equal(s.run('restored.last.groups.length'),2);
  for(let i=0;i<10;i++)s.run('restored.reload()');
  assert.equal(s.run('restored.balance'),1030);assert.equal(s.writes.length,1);
});

test('both old save versions preserve balance without repricing previous results', () => {
  for(const [version,balance,symbols] of [[1,1275,[0,0,0]],[2,1125,[0,1,0,2,1,0,1]]]) {
    const s=setup();s.data.set('moonclicker.fortunaDemo.v1',JSON.stringify({version,balance,last:{before:1000,symbols}}));
    s.run('model.reload()');assert.equal(s.run('model.balance'),balance);assert.equal(s.run('model.last'),null);assert.equal(s.writes.length,0);
    fixed(s,[0,0,0,0,0,0,0]);s.run('model.spin()');
    assert.equal(s.run('model.balance'),balance+1490);
    assert.equal(JSON.parse(s.data.get('moonclicker.fortunaDemo.v1')).version,3);assert.equal(s.writes.length,1);
  }
});

test('exactly ten permits last spin; insufficient balance consumes no RNG and writes nothing', () => {
  const s=setup();s.run('storage.setItem(DEMO_SLOTS_KEY,JSON.stringify({version:3,balance:10,last:null}));model.reload()');
  fixed(s,[0,1,2,3,4,5,6]);assert.equal(s.run('model.spin().after'),0);
  const before=s.writes.length;s.run('model.random=()=>{throw Error("must not roll")}');
  assert.equal(s.run('model.spin()'),null);assert.equal(s.run('model.balance'),0);assert.equal(s.writes.length,before);
});

test('reset sets exactly 1000 from high and low balances, never adds 1000', () => {
  const s=setup();fixed(s,[0,0,0,0,0,0,0]);s.run('model.spin()');assert.equal(s.run('model.balance'),2490);
  s.run('model.reset()');assert.equal(s.run('model.balance'),1000);assert.equal(s.run('model.last'),null);
  fixed(s,[0,1,2,3,4,5,6]);s.run('model.spin();model.reset();model.reset()');assert.equal(s.run('model.balance'),1000);
  assert.equal(s.data.get('existing-game-save'),'{"shards":4321,"moons":["fire"]}');
  assert.ok(s.writes.every(k=>k==='moonclicker.fortunaDemo.v1'));
});

test('corrupt saves cannot block game loading and forged payout/groups are ignored', () => {
  for(const raw of ['broken','null','{"version":9,"balance":10}','{"version":3,"balance":-1}','{"version":3,"balance":1.1}','{"version":3,"balance":1e20}']) {
    const s=setup();s.data.set('moonclicker.fortunaDemo.v1',raw);s.run('model.reload()');assert.equal(s.run('model.balance'),1000);assert.equal(s.writes.length,0);
  }
  const s=setup();s.data.set('moonclicker.fortunaDemo.v1',JSON.stringify({version:3,balance:1030,last:{before:1000,symbols:[0,1,0,2,1,0,1],payout:999999999,groups:[]}}));
  s.run('model.reload()');assert.equal(s.run('model.last.payout'),40);assert.equal(s.run('model.last.groups.length'),2);
  s.data.set('moonclicker.fortunaDemo.v1',JSON.stringify({version:3,balance:405,last:{before:1000,symbols:[0,0,0]}}));
  s.run('model.reload()');assert.equal(s.run('model.balance'),405);assert.equal(s.run('model.last'),null);
});

test('unavailable storage keeps a usable session-only balance under the unified table', () => {
  const s=setup();s.run('var offline=new DemoSlotBalance({getItem(){throw Error("blocked")}},()=>0);offline.spin();offline.spin()');
  assert.equal(s.run('offline.balance'),3980);assert.equal(s.run('offline.persistent'),false);
  s.run('var quota=new DemoSlotBalance({getItem:()=>null,setItem(){throw Error("quota")}},()=>0);quota.spin();quota.spin()');
  assert.equal(s.run('quota.balance'),3980);assert.equal(s.run('quota.persistent'),false);
});

test('invalid randomness never deducts; cap explicitly reports nominal gross', () => {
  const s=setup();
  for(const value of ['NaN','Infinity','-1','1']){s.run(`model.random=()=>${value}`);assert.throws(()=>s.run('model.spin()'));assert.equal(s.run('model.balance'),1000);}
  assert.equal(s.writes.length,0);
  s.run('storage.setItem(DEMO_SLOTS_KEY,JSON.stringify({version:3,balance:1000000000}));model.random=()=>0;model.spin()');
  assert.equal(s.run('model.balance'),1000000000);assert.equal(s.run('model.last.payout'),10);
  assert.equal(s.run('model.last.nominalPayout'),1500);assert.equal(s.run('model.last.capped'),true);
});

test('slots have no main-game imports/network and never clear other storage keys', () => {
  assert.doesNotMatch(source,/\bimport\b|\bfetch\s*\(|\bXMLHttpRequest\b|\bstate\.|\bdb\.|localStorage\.clear|\.removeItem\s*\(/);
  const wheel=fs.readFileSync(path.join(__dirname,'../src/modules/ui/wheel.js'),'utf8');assert.match(wheel,/demoSlots\.connect\(this\.root\)/);
  for(const method of ['open','close','disconnect'])assert.ok(wheel.includes('demoSlots.'+method+'()'));
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/css\/slots\.css\?v=fortuna-slots-3/);assert.match(html,/slots\.js\?v=fortuna-slots-3/);
});
