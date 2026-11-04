const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/modules/ui/slots.js'), 'utf8');
const EXPECTED = [[3,6,12,25,60],[3,5,10,20,50],[4,8,16,32,80],[2,4,8,16,40],[4,7,14,28,70],[5,10,20,40,100],[5,9,18,36,90],[6,12,24,48,120]];
function setup() {
  const data = new Map([['existing-game-save', '{"shards":4321,"moons":["fire"]}']]);
  const writes = [];
  const storage = { getItem: k => data.get(k) ?? null, setItem(k, v) { writes.push(k); data.set(k, v); } };
  const c = { console, storage, Math, Set };
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
  test(`demo payout type ${id + 1}/8 × ${count} matches pays only exact maximum count`, () => {
    const s = setup();
    const filler = Array.from({ length: 8 }, (_, i) => i).filter(i => i !== id).slice(0, 7 - count);
    const symbols = [...Array(count).fill(id), ...filler];
    // Scatter through nonadjacent positions; there are no left-to-right paylines.
    const shuffled = [0, 3, 6, 2, 5, 1, 4].map(i => symbols[i]);
    const result = s.outcome(shuffled);
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].count, count);
    assert.equal(result.groups[0].symbol, id);
    assert.equal(result.groups[0].positions.length, count);
    assert.equal(result.multiplier, EXPECTED[id][count - 3]);
    assert.equal(result.payout, EXPECTED[id][count - 3] * 25);
    assert.equal(result.kind, 'win');
    fixed(s, shuffled);
    assert.equal(s.run('model.spin().payout'), result.payout);
    assert.equal(s.run('model.balance'), 975 + result.payout);
    assert.equal(s.writes.length, 1);
  });
}

test('all 3432 count distributions sum independent groups without nested payouts', () => {
  const { outcome } = setup(); let checked = 0;
  function visit(counts, remaining) {
    if (counts.length === 7) {
      counts = [...counts, remaining];
      const result = outcome(counts.flatMap((n, id) => Array(n).fill(id)));
      assert.equal(result.groups.length, counts.filter(n => n >= 3).length);
      assert.equal(result.payout, counts.reduce((sum, n, id) => sum + (n >= 3 ? EXPECTED[id][n - 3] * 25 : 0), 0));
      assert.ok(result.groups.length <= 2);
      checked++; return;
    }
    for (let n = 0; n <= remaining; n++) visit([...counts, n], remaining - n);
  }
  visit([], 7); assert.equal(checked, 3432);
});

test('two interleaved triples are both paid; a four plus a triple is also additive', () => {
  const s = setup();
  for (const [symbols, payout, counts] of [
    [[0,1,0,2,1,0,1],150,[3,3]],
    [[0,1,0,1,0,1,0],225,[4,3]]
  ]) {
    const result = s.outcome(symbols);
    assert.equal(result.groups.length, 2);
    assert.equal(JSON.stringify(result.groups.map(g => g.count)), JSON.stringify(counts));
    assert.equal(result.payout, payout);
    s.run('model.reset()'); s.writes.length = 0; fixed(s, symbols);
    assert.equal(s.run('model.spin().after'), 975 + payout);
    assert.equal(s.writes.length, 1);
  }
});

test('one or several pairs never pay, and old three-reel inputs are rejected', () => {
  const s = setup();
  for (const symbols of [[0,1,2,3,4,5,6], [0,0,1,1,2,2,3]]) {
    assert.equal(s.outcome(symbols).payout, 0);
    assert.equal(s.outcome(symbols).groups.length, 0);
  }
  for (const bad of [[], [0,0,0], [0,1,2,3,4,5,8], [0,1,2,3,4,5,-1], [0,1,2,3,4,5,.1], [0,1,2,3,4,5,'6'], null]) assert.throws(() => s.outcome(bad));
});

test('each spin commits exactly one cost and aggregate payout in one isolated write', () => {
  for (const [ids, balance, payout] of [
    [[0,1,0,2,3,0,4],1050,75], [[0,1,0,2,1,0,1],1125,150], [[0,1,2,3,4,5,6],975,0]
  ]) {
    const s = setup(); fixed(s, ids);
    assert.equal(s.run('model.spin().payout'), payout);
    assert.equal(s.run('model.balance'), balance);
    assert.deepEqual(s.writes, ['moonclicker.fortunaDemo.v1']);
    assert.equal(s.data.get('existing-game-save'), '{"shards":4321,"moons":["fire"]}');
  }
});

test('reload during animation restores all groups without second payout or deduction', () => {
  const s = setup(); fixed(s, [0,1,0,2,1,0,1]);
  s.run('model.spin();var restored=new DemoSlotBalance(storage);');
  assert.equal(s.run('restored.balance'), 1125);
  assert.equal(s.run('restored.last.payout'), 150);
  assert.equal(s.run('restored.last.groups.length'), 2);
  for (let i = 0; i < 10; i++) s.run('restored.reload()');
  assert.equal(s.run('restored.balance'), 1125); assert.equal(s.writes.length, 1);
});

test('old prototype migrates balance only, never reevaluates its three-reel reward', () => {
  const s = setup();
  s.data.set('moonclicker.fortunaDemo.v1', JSON.stringify({version:1,balance:1275,last:{before:1000,symbols:[0,0,0]}}));
  s.run('model.reload()');
  assert.equal(s.run('model.balance'), 1275); assert.equal(s.run('model.last'), null); assert.equal(s.writes.length, 0);
  fixed(s, [0,0,0,0,0,0,0]); s.run('model.spin()');
  assert.equal(s.run('model.balance'), 2750);
  assert.equal(JSON.parse(s.data.get('moonclicker.fortunaDemo.v1')).version, 2);
  assert.equal(s.writes.length, 1);
});

test('insufficient funds never roll or write; exact cost permits one last spin', () => {
  const s = setup();
  s.run('storage.setItem(DEMO_SLOTS_KEY,JSON.stringify({version:2,balance:25,last:null}));model.reload();');
  fixed(s, [0,1,2,3,4,5,6]); assert.equal(s.run('model.spin().after'), 0);
  const before = s.writes.length;
  assert.equal(s.run('model.spin()'), null); assert.equal(s.run('model.balance'), 0); assert.equal(s.writes.length, before);
});

test('reset restores only demo balance and removes previous demo outcome', () => {
  const s = setup(); fixed(s, [0,1,2,3,4,5,6]); s.run('model.spin();model.reset()');
  assert.equal(s.run('model.balance'), 1000); assert.equal(s.run('model.last'), null);
  assert.equal(s.data.get('existing-game-save'), '{"shards":4321,"moons":["fire"]}');
  assert.ok(s.writes.every(key => key === 'moonclicker.fortunaDemo.v1'));
});

test('corrupt demo saves cannot block game loading; forged groups/payouts are ignored', () => {
  for (const raw of ['broken', 'null', '{"version":9,"balance":10}', '{"version":2,"balance":-1}', '{"version":2,"balance":1.1}', '{"version":2,"balance":1e20}']) {
    const s = setup(); s.data.set('moonclicker.fortunaDemo.v1', raw); s.run('model.reload()');
    assert.equal(s.run('model.balance'), 1000); assert.equal(s.writes.length, 0);
  }
  const s = setup();
  s.data.set('moonclicker.fortunaDemo.v1', JSON.stringify({version:2,balance:1125,last:{before:1000,symbols:[0,1,0,2,1,0,1],payout:999999999,groups:[]}}));
  s.run('model.reload()'); assert.equal(s.run('model.last.payout'), 150); assert.equal(s.run('model.last.groups.length'), 2);
  s.data.set('moonclicker.fortunaDemo.v1', JSON.stringify({version:2,balance:405,last:{before:1000,symbols:[0,0,0]}}));
  s.run('model.reload()'); assert.equal(s.run('model.balance'), 405); assert.equal(s.run('model.last'), null);
});

test('unavailable storage falls back to usable session-only seven-reel balance', () => {
  const s = setup();
  s.run('var offline=new DemoSlotBalance({getItem(){throw Error("blocked")}},()=>0);offline.spin();offline.spin();');
  assert.equal(s.run('offline.balance'), 3950); assert.equal(s.run('offline.persistent'), false);
  s.run('var quota=new DemoSlotBalance({getItem:()=>null,setItem(){throw Error("quota")}},()=>0);quota.spin();quota.spin()');
  assert.equal(s.run('quota.balance'), 3950); assert.equal(s.run('quota.persistent'), false);
});

test('invalid randomness never deducts; cap retains explicit nominal group totals', () => {
  const s = setup();
  for (const value of ['NaN','Infinity','-1','1']) {
    s.run(`model.random=()=>${value}`); assert.throws(() => s.run('model.spin()')); assert.equal(s.run('model.balance'), 1000);
  }
  assert.equal(s.writes.length, 0);
  s.run('storage.setItem(DEMO_SLOTS_KEY,JSON.stringify({version:2,balance:1000000000}));model.random=()=>0;model.spin()');
  assert.equal(s.run('model.balance'), 1000000000); assert.equal(s.run('model.last.payout'), 25);
  assert.equal(s.run('model.last.nominalPayout'), 1500); assert.equal(s.run('model.last.capped'), true);
});

test('slots have no main-game imports/network and never clear other storage keys', () => {
  assert.doesNotMatch(source, /\bimport\b|\bfetch\s*\(|\bXMLHttpRequest\b|\bstate\.|\bdb\.|localStorage\.clear|\.removeItem\s*\(/);
  const wheel = fs.readFileSync(path.join(__dirname, '../src/modules/ui/wheel.js'), 'utf8');
  assert.match(wheel, /demoSlots\.connect\(this\.root\)/);
  for (const method of ['open','close','disconnect']) assert.ok(wheel.includes('demoSlots.' + method + '()'));
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /css\/slots\.css\?v=fortuna-slots-2/); assert.match(html, /slots\.js\?v=fortuna-slots-2/);
});
