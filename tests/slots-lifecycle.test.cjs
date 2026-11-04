const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup({ motion = true, low = false, breakAnimation = false } = {}) {
  const data = new Map(), writes = [], timers = new Map();
  let timerId = 0;
  const classes = () => {
    const set = new Set();
    return { add: (...v) => v.forEach(x => set.add(x)), remove: (...v) => v.forEach(x => set.delete(x)), contains: x => set.has(x) };
  };
  const animations = [];
  const node = () => ({ classList: classes(), style: {}, children: [], setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; }, replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); }, textContent: '' });
  const c = { console, Math, Set, storage: { getItem: k => data.get(k) ?? null, setItem(k, v) { data.set(k, v); writes.push(k); } },
    document: { documentElement: { classList: { contains: x => low && x === 'low-power' } }, body: { classList: classes() }, createElement: node, removeEventListener() {} },
    window: { matchMedia: () => ({ matches: !motion }), removeEventListener() {} },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/modules/ui/slots.js'), 'utf8').replace(/\bexport\s+/g, ''), c);
  const run = code => vm.runInContext(code, c);
  const s = run('var s=new DemoSlots();s.model=new DemoSlotBalance(storage,()=>0);s.allowed=true;s');
  const nodes = {};
  s.root = { classList: classes(), querySelector: key => nodes[key] || (nodes[key] = node()), querySelectorAll: () => [...Object.values(nodes), ...s.reels].filter(n => n['data-demo-group'] !== undefined) };
  s.button = node(); s.resetButton = node();
  s.reels = Array.from({ length: 7 }, node);
  s.strips = s.reels.map(() => ({ ...node(), animate(frames, options) {
    if (breakAnimation) throw Error('Unsupported animation');
    let resolve, reject;
    const finished = new Promise((r, j) => { resolve = r; reject = j; });
    const animation = { finished, frames, options, resolve, cancelled: false, cancel() { this.cancelled = true; reject(Error('cancelled')); } };
    animations.push(animation); return animation;
  } }));
  return { s, run, writes, animations, timers, nodes };
}

test('rapid calls share one seven-reel spin; sequential completion cannot duplicate settlement', async () => {
  const { s, writes, animations, nodes, run } = setup();
  run('var rolls=0;s.model.random=()=>{rolls++;return 0;}');
  const pending = s.play();
  for (let i = 0; i < 20; i++) assert.equal(await s.play(), false);
  assert.equal(writes.length, 1); assert.equal(s.model.balance, 2490);
  assert.equal(run('rolls'), 7);
  assert.equal(nodes['[data-demo-balance]'].textContent, '990');
  assert.equal(s.button.disabled, true); assert.equal(s.resetButton.disabled, true);
  assert.deepEqual(animations.map(a => a.options.duration), [850,1050,1250,1450,1650,1850,2050]);
  for (const a of animations) { a.resolve(); await Promise.resolve(); }
  await pending;
  assert.equal(s.busy, false); assert.equal(s.button.disabled, false);
  assert.equal(s.animations.length, 0); assert.ok(animations.every(a => a.cancelled));
  s.finish(); s.finish(); assert.equal(writes.length, 1);
});

test('close/disconnect finish safely; cancelled callbacks cannot affect a new spin', async () => {
  const { s, animations, writes } = setup();
  const first = s.play(); assert.equal(s.reset(), false);
  s.close(); assert.equal(s.busy, false); assert.equal(s.model.balance, 2490);
  const second = s.play(); await first; assert.equal(s.busy, true);
  s.disconnect(); await second;
  assert.equal(s.busy, false); assert.equal(s.allowed, false); assert.equal(s.model.balance, 3980);
  assert.equal(writes.length, 2); assert.ok(animations.every(a => a.cancelled));
  assert.equal(await s.play(), false);
});

test('reduced motion keeps 300ms guard; closing clears its sole timer', async () => {
  const { s, writes, animations, timers } = setup({ motion: false });
  const first = s.play();
  for (let i = 0; i < 20; i++) assert.equal(await s.play(), false);
  assert.equal(writes.length, 1); assert.equal(animations.length, 0); assert.equal(timers.size, 1);
  s.close(); await first; assert.equal(timers.size, 0); assert.equal(s.busy, false);
  const second = s.play(); [...timers.values()][0](); await second;
  assert.equal(timers.size, 0); assert.equal(s.model.balance, 3980);
});

test('low-power mode rolls seven short transform-only strips', async () => {
  const { s, animations } = setup({ low: true });
  const pending = s.play();
  assert.deepEqual(animations.map(a => a.options.duration), [650,810,970,1130,1290,1450,1610]);
  assert.ok(animations.every(a => Object.keys(a.frames[0]).join(',') === 'transform'));
  s.close(); await pending;
});

test('missing/broken animation support reveals result and unlocks without rejection', async () => {
  const { s, writes } = setup({ breakAnimation: true });
  assert.equal(await s.play(), true); assert.equal(s.model.balance, 2490);
  assert.equal(s.busy, false); assert.equal(s.animations.length, 0); assert.equal(writes.length, 1);
});

test('two groups highlight separate reels/cells and show exact additive breakdown', async () => {
  const { s, nodes, run } = setup({ breakAnimation: true });
  run('var samples=[0,1,0,2,1,0,1];s.model.random=()=>((samples.shift()||0)+.5)/8');
  await s.play();
  assert.equal(s.model.balance, 1030);
  assert.equal(s.reels.filter(r => r['data-demo-group'] === 0).length, 3);
  assert.equal(s.reels.filter(r => r['data-demo-group'] === 1).length, 3);
  assert.equal(s.reels[3].classList.contains('demo-slot-hit'), false);
  assert.equal(nodes['[data-demo-rule="0-3"]']['data-demo-group'], 0);
  assert.equal(nodes['[data-demo-rule="1-3"]']['data-demo-group'], 1);
  assert.match(nodes['.demo-slots-result > span'].textContent, /20 \+ 20 = 40/);
  const lines = nodes['.demo-slots-groups'].children;
  assert.equal(lines.length, 2); assert.match(lines[0].textContent, /3 шт.: 10 × 2 = 20/);
  s.reset();
  assert.equal(nodes['.demo-slots-groups'].children.length, 0);
  assert.ok(s.reels.every(r => !r.classList.contains('demo-slot-hit')));
  assert.ok(s.reels.every(r => r['data-demo-group'] === undefined));
});

test('seven of one symbol highlights one cell, not nested count cells', async () => {
  const { s, nodes } = setup({ breakAnimation: true });
  await s.play();
  assert.equal(nodes['.demo-slots-groups'].children.length, 1);
  assert.ok(nodes['[data-demo-rule="0-7"]'].classList.contains('demo-rule-hit'));
  for (const count of [3,4,5,6]) assert.equal(nodes[`[data-demo-rule="0-${count}"]`], undefined);
  assert.equal(s.reels.filter(r => r.classList.contains('demo-slot-hit')).length, 7);
});
