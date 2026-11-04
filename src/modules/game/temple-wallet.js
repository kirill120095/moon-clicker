import { createTempleConfig, TEMPLE_STAKES, TEMPLE_FREE_SPINS, templeGridFromStops, evaluateTempleGrid, validateTempleStake } from './temple-rules.js';

export const TEMPLE_SAVE_KEY = 'moonclicker.fortunaDemo.v1';
export const TEMPLE_SAVE_VERSION = 4;
export const TEMPLE_START_BALANCE = 1000;
const MAX_BALANCE = 1_000_000_000;
const emptyBonus = () => ({ remaining: 0, triggerStake: null });
const validBalance = n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_BALANCE;
function validBonus(b) {
  return b && Number.isInteger(b.remaining) && b.remaining >= 0 && b.remaining <= 10 &&
    (b.remaining === 0 ? b.triggerStake === null : TEMPLE_STAKES.includes(b.triggerStake));
}
const sameBonus = (a, b) => a.remaining === b.remaining && a.triggerStake === b.triggerStake;

function settle(config, { before, bonusBefore, mode, stake, stops, requestId, sequence, source }) {
  if (!validBalance(before) || !validBonus(bonusBefore)) throw Error('Invalid transaction base');
  validateTempleStake(stake);
  if (mode !== 'paid' && mode !== 'free') throw Error('Mode must be paid or free');
  if (mode === 'paid' && (bonusBefore.remaining || before < stake)) throw Error('Paid spin unavailable');
  if (mode === 'free' && (!bonusBefore.remaining || stake !== bonusBefore.triggerStake)) throw Error('Free spin must keep trigger stake');
  const grid = templeGridFromStops(config, stops), evaluated = evaluateTempleGrid(config, grid, stake);
  const debit = mode === 'free' ? 0 : stake;
  const awarded = mode === 'paid' && evaluated.triggersFreeSpins ? TEMPLE_FREE_SPINS : 0;
  let bonusAfter;
  if (mode === 'free') bonusAfter = bonusBefore.remaining > 1
    ? { remaining: bonusBefore.remaining - 1, triggerStake: bonusBefore.triggerStake } : emptyBonus();
  else bonusAfter = awarded ? { remaining: awarded, triggerStake: stake } : emptyBonus();
  const creditedGross = Math.min(evaluated.gross, MAX_BALANCE - before + debit);
  const after = before - debit + creditedGross;
  return { ...evaluated, requestId, sequence, mode, source, stops: [...stops], rulesId: config.id,
    before, after, debit, creditedGross, net: creditedGross - debit,
    capped: creditedGross !== evaluated.gross,
    bonusBefore: { ...bonusBefore }, bonusAfter, freeSpinsAwarded: awarded,
    triggersFreeSpins: awarded > 0, // Actual feature award, never a free-mode retrigger.
    // Returning less than/equal to the total reference stake is never a clean-win celebration.
    celebrate: creditedGross > stake,
    outcome: mode === 'free' ? (creditedGross > stake ? 'win' : 'free-result')
      : creditedGross > stake ? 'win' : creditedGross === stake ? 'return' : creditedGross > 0 ? 'partial-return' : 'loss' };
}

/** Only this class commits chips and bonus state. All presentation is downstream. */
export class TempleWallet {
  constructor({ config = null, storage, rng = () => Math.random(), testMode = false, fixtures = {} } = {}) {
    if (testMode !== true) throw Error('TempleWallet is a test-only adapter, never an account wallet');
    this.kind = 'demo-test';
    this.config = config ? createTempleConfig(config) : null;
    this.storage = storage; this.persistent = Boolean(storage); this.rng = rng;
    this.testMode = testMode === true;
    this.fixtures = Object.freeze(Object.fromEntries(Object.entries(fixtures).map(([id, value]) => [id, Object.freeze([...value])])));
    this.balance = TEMPLE_START_BALANCE; this.stake = TEMPLE_STAKES[0]; this.bonus = emptyBonus();
    this.last = null; this.sequence = 0; this.rulesChanged = false; this.lastError = null;
    this.reload();
  }
  reload() {
    if (!this.persistent) return;
    let raw;
    try { raw = this.storage.getItem(TEMPLE_SAVE_KEY); }
    catch { this.persistent = false; return; }
    if (raw === null) { this.balance = TEMPLE_START_BALANCE; this.stake = 10; this.bonus = emptyBonus(); this.last = null; this.sequence = 0; this.rulesChanged = false; return; }
    try {
      const saved = JSON.parse(raw);
      if (!saved || ![1,2,3,4].includes(saved.version) || !validBalance(saved.balance)) throw Error('Invalid demo save');
      this.balance = saved.balance; this.stake = TEMPLE_STAKES.includes(saved.stake) ? saved.stake : 10;
      this.last = null; this.bonus = emptyBonus(); this.sequence = 0;
      this.rulesChanged = saved.version !== 4 || saved.rulesId !== (this.config?.id || null) || saved.rulesChanged === true;
      // Never revalue legacy 7×1 outcomes or carry a bonus across rule-set changes.
      if (saved.version !== 4 || saved.rulesId !== this.config?.id || !this.config) return;
      if (validBonus(saved.bonus)) this.bonus = { ...saved.bonus };
      this.sequence = Number.isSafeInteger(saved.sequence) && saved.sequence >= 0 ? saved.sequence : 0;
      if (saved.last) {
        try {
          const prior = saved.last;
          if (typeof prior.requestId !== 'string' || prior.requestId.length > 120 || !Number.isSafeInteger(prior.sequence) || prior.sequence < 1) throw Error('Invalid transaction identity');
          const result = settle(this.config, prior);
          if (result.after === this.balance && sameBonus(result.bonusAfter, this.bonus) && result.sequence === this.sequence) this.last = result;
        } catch { /* Corrupt last outcome never credits or debits the preserved demo balance. */ }
      }
      if (this.bonus.remaining && !this.last) { this.bonus = emptyBonus(); this.rulesChanged = true; }
    } catch {
      this.balance = TEMPLE_START_BALANCE; this.stake = 10; this.bonus = emptyBonus(); this.last = null; this.sequence = 0; this.rulesChanged = true;
    }
  }
  save() {
    if (!this.persistent) return;
    try {
      const last = this.last;
      this.storage.setItem(TEMPLE_SAVE_KEY, JSON.stringify({ version: 4, rulesId: this.config?.id || null,
        balance: this.balance, stake: this.stake, bonus: this.bonus, sequence: this.sequence, rulesChanged: this.rulesChanged,
        last: last ? { before: last.before, bonusBefore: last.bonusBefore, mode: last.mode, stake: last.totalStake,
          stops: last.stops, requestId: last.requestId, sequence: last.sequence, source: last.source } : null }));
    } catch { this.persistent = false; }
  }
  setStake(stake) {
    validateTempleStake(stake); this.reload();
    if (this.bonus.remaining) { this.lastError = 'BONUS_STAKE_LOCKED'; return false; }
    this.stake = stake; this.lastError = null; this.save(); return true;
  }
  spin({ mode, requestId, fixtureId } = {}) {
    this.lastError = null; this.reload();
    mode ??= this.bonus.remaining ? 'free' : 'paid';
    if (!this.config) { this.lastError = 'CONFIG_PENDING'; return null; }
    if (mode !== 'paid' && mode !== 'free') throw Error('Explicit paid/free mode required');
    if ((this.bonus.remaining > 0) !== (mode === 'free')) { this.lastError = 'WRONG_SPIN_MODE'; return null; }
    if (requestId !== undefined && (typeof requestId !== 'string' || !requestId.length || requestId.length > 120)) throw Error('Invalid requestId');
    if (requestId !== undefined && requestId === this.last?.requestId) { this.lastError = 'DUPLICATE_SPIN'; return null; }
    const stake = mode === 'free' ? this.bonus.triggerStake : this.stake;
    if (mode === 'paid' && this.balance < stake) { this.lastError = 'INSUFFICIENT_CHIPS'; return null; }
    let stops, source = { kind: 'random' };
    if (fixtureId !== undefined) {
      if (!this.testMode) throw Error('Fixtures are only available in explicit test mode');
      if (typeof fixtureId !== 'string' || !Object.hasOwn(this.fixtures, fixtureId)) throw Error('Unknown deterministic fixture');
      stops = [...this.fixtures[fixtureId]]; source = { kind: 'fixture', id: fixtureId };
      templeGridFromStops(this.config, stops); // Fixtures are REAL strip stops, never arbitrary grids.
    } else {
      stops = this.config.reelStrips.map(strip => {
        const u = this.rng();
        if (!Number.isFinite(u) || u < 0 || u >= 1) throw Error('Invalid demo RNG sample');
        return Math.floor(u * strip.length);
      });
    }
    const sequence = this.sequence + 1;
    if (!Number.isSafeInteger(sequence)) throw Error('Demo sequence exhausted');
    const result = settle(this.config, { before: this.balance, bonusBefore: this.bonus, mode, stake, stops,
      requestId: requestId || 'spin-' + sequence, sequence, source });
    // Exactly ONE write contains cost, all line credits and the new free-spin counter.
    this.balance = result.after; this.bonus = { ...result.bonusAfter }; this.last = result; this.sequence = sequence;
    this.save(); return result;
  }
  reset() {
    this.balance = TEMPLE_START_BALANCE; this.stake = 10; this.bonus = emptyBonus();
    this.last = null; this.sequence = 0; this.lastError = null; this.rulesChanged = false; this.save();
  }
}
