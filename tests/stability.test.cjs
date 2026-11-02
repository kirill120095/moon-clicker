const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const modules = ['src/core/constants.js', 'src/core/config.js', 'src/core/state.js',
  'src/modules/game/combat.js', 'src/modules/game/rewards.js',
  'src/modules/game/game.js', 'src/modules/auth/auth.js'];
function strip(source) {
  return source.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, '')
    .replace(/^export\s*\{[^}]*\};?\s*/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:class|const|let|function))/g, '');
}
function setup() {
  const intervals = new Map(), storage = new Map(), writes = [];
  let nextId = 1, leaders = 0;
  const context = {
    console: { log() {}, error() {}, warn() {} }, window: {},
    document: { getElementById() { return null; } },
    localStorage: { getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    setInterval(fn) { const id = nextId++; intervals.set(id, fn); return id; },
    clearInterval(id) { intervals.delete(id); }, setTimeout() {}, clearTimeout() {},
    performance: { now: () => 10000 }, animations: {},
    db: { async updatePlayer(id, values) { writes.push({ id, values }); return { id, ...values }; },
      async getPlayer() { throw new Error('Load failed'); } },
    showToast() {}, updateUI() {}, updateShopUI() {},
    updateProfileAndLeaders() { leaders++; }, updateQuestAndAchievementUI() {},
    updateQuestUI() {}, updateAchievementUI() {}, updateTimerBar() {}, setLockIcon() {}
  };
  vm.createContext(context);
  vm.runInContext(modules.map(p => strip(fs.readFileSync(path.join(root, p), 'utf8'))).join('\n'), context);
  return { context, intervals, writes, run: code => vm.runInContext(code, context), leaders: () => leaders };
}
test('boss timeout calls its handler exactly once', () => {
  const h = setup();
  h.run('var fired=0; var c=new CombatSystem(); c.startBossTimer(()=>fired++,1);');
  for (const tick of [...h.intervals.values()]) tick();
  assert.equal(h.context.fired, 1);
  assert.equal(h.intervals.size, 0);
});
test('saved damage is preserved and zero HP resumes as a playable moon', () => {
  const h = setup();
  h.run('appState.loadPlayerData({id:"A",level:1,click_damage:10,moon_hp:150}); globalThis.hp=state.moonHP;');
  assert.equal(h.context.hp, 150);
  h.run('appState.setUser({id:"A"}); appState.set("moonHP",0); gameEngine.init(); globalThis.hp=state.moonHP; gameEngine.destroy();');
  assert.equal(h.context.hp, 1000);
});
test('destroy stops timers after state reset and subscriptions can restart', () => {
  const h = setup();
  h.run('gameEngine._subscribe(); gameEngine._startTimeTracking(); gameEngine._startAutoSave(); appState.reset(); gameEngine.destroy();');
  assert.equal(h.intervals.size, 0);
  h.run('gameEngine._subscribe(); globalThis.active=!!gameEngine._unsubscribeMain; gameEngine.destroy();');
  assert.equal(h.context.active, true);
});
test('HP changes do not refresh the leaderboard', () => {
  const h = setup();
  h.run('gameEngine._subscribe(); appState.set("moonHP",900); gameEngine.destroy();');
  assert.equal(h.leaders(), 0);
});
test('a failed player load cannot enable gameplay', async () => {
  const h = setup();
  await assert.rejects(h.run('handleSuccessfulLogin({id:"A"})'));
  assert.equal(h.run('state.user'), null);
  assert.equal(h.intervals.size, 0);
});
test('overlapping saves coalesce and preserve the latest snapshot', async () => {
  const h = setup(), gates = [];
  h.context.db.updatePlayer = (id, values) => new Promise(resolve => {
    h.writes.push({id, values}); gates.push(() => resolve({id, ...values}));
  });
  h.run('appState.setUser({id:"A"}); gameEngine._isRunning=true; appState.set("moonHP",900); var first=gameEngine._saveProgress(); appState.set("moonHP",800); var latest=gameEngine._saveProgress();');
  assert.equal(h.writes.length, 1);
  gates.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[1].values.moon_hp, 800);
  gates.shift()();
  await h.run('latest');
  h.run('gameEngine.destroy()');
});
test('reset restarts timers and clears test mode without losing the user', async () => {
  const h = setup();
  h.run('appState.setUser({id:"A"}); appState.set("testMode",true); gameEngine.init();');
  await h.run('gameEngine.resetProgress()');
  assert.equal(h.run('state.testMode'), false);
  assert.equal(h.run('state.user.id'), 'A');
  assert.equal(h.run('gameEngine._isRunning'), true);
  assert.equal(h.intervals.size, 3);
  h.run('gameEngine.destroy()');
  assert.equal(h.intervals.size, 0);
});

test('leaderboard request failures reach the UI instead of becoming an empty list', async () => {
  const source = strip(fs.readFileSync(path.join(root, 'src/modules/network/supabase.js'), 'utf8'));
  const failure = new Error('Network unavailable');
  const query = { select() { return this; }, order() { return this; },
    async limit() { return { data: null, error: failure }; } };
  const context = { console: { log() {}, error() {} },
    window: { localStorage: {}, supabase: { createClient() {
      return { from() { return query; } };
    } } } };
  vm.createContext(context);
  vm.runInContext(source, context);
  await assert.rejects(vm.runInContext('db.getLeaders()', context), /Network unavailable/);
});
