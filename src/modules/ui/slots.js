import { createFortuneSlotsView } from './fortune-slots-view.js';
import { FORTUNE_SLOTS_HTML } from './fortune-slots-template.js';
// Device-local toy balance. Deliberately no game state, network, or economy imports.
export const DEMO_SLOTS_KEY = 'moonclicker.fortunaDemo.v1';
export const DEMO_START = 1000;
export const DEMO_COST = 10;
export const SLOT_REELS = 7;
export const MATCH_COUNTS = Object.freeze([3, 4, 5, 6, 7]);
const SAVE_VERSION = 3;
const MAX_BALANCE = 1_000_000_000;
const INITIAL_SYMBOLS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
// Uniform temporary GROSS multipliers by EXACT count 3–7, not main-game balance.
// Gross is the whole return after the single deduction; never add the stake again.
export const SLOT_GROSS_MULTIPLIERS = Object.freeze([2, 5, 12, 40, 150]);
export const SLOT_SYMBOLS = Object.freeze([
  { icon: '🌙', name: 'Луна' },
  { icon: '⭐', name: 'Звезда' },
  { icon: '💎', name: 'Кристалл' },
  { icon: '☄️', name: 'Комета' },
  { icon: '🪐', name: 'Планета' },
  { icon: '🚀', name: 'Ракета' },
  { icon: '🛸', name: 'НЛО' },
  { icon: '👽', name: 'Пришелец' }
].map(s => Object.freeze({ ...s, multipliers: SLOT_GROSS_MULTIPLIERS })));

export function slotOutcome(symbols) {
  if (!Array.isArray(symbols) || symbols.length !== SLOT_REELS ||
      !symbols.every(id => Number.isInteger(id) && id >= 0 && id < SLOT_SYMBOLS.length)) {
    throw new Error('Некорректные символы слотов');
  }
  const positions = SLOT_SYMBOLS.map(() => []);
  symbols.forEach((id, index) => positions[id].push(index));
  const groups = positions.flatMap((places, symbol) => {
    if (places.length < 3) return [];
    // One group per symbol: pay only its actual count, never nested subsets.
    const multiplier = SLOT_SYMBOLS[symbol].multipliers[places.length - 3];
    return [{ symbol, count: places.length, positions: places, multiplier, payout: DEMO_COST * multiplier }];
  });
  const multiplier = groups.reduce((sum, group) => sum + group.multiplier, 0);
  return { symbols: [...symbols], groups, multiplier, payout: DEMO_COST * multiplier,
    kind: groups.length ? 'win' : 'loss' };
}

function validBalance(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_BALANCE;
}
function transaction(before, symbols) {
  const result = slotOutcome(symbols);
  const after = Math.min(MAX_BALANCE, before - DEMO_COST + result.payout);
  const payout = after - before + DEMO_COST;
  return { ...result, before, after, payout, nominalPayout: result.payout, capped: payout < result.payout };
}

export class DemoSlotBalance {
  constructor(storage, random = () => Math.random()) {
    this.storage = storage;
    this.random = random;
    this.persistent = Boolean(storage);
    this.balance = DEMO_START;
    this.last = null;
    this.reload();
  }
  reload() {
    if (!this.persistent) return;
    let raw;
    try { raw = this.storage.getItem(DEMO_SLOTS_KEY); }
    catch { this.persistent = false; return; }
    try {
      if (raw === null) { this.balance = DEMO_START; this.last = null; return; }
      const saved = JSON.parse(raw);
      if (![1, 2, SAVE_VERSION].includes(saved.version) || !validBalance(saved.balance)) throw new Error('Invalid demo save');
      this.balance = saved.balance;
      this.last = null;
      // Keep old demo balances, but never revalue a saved result under a new table/stake.
      if (saved.version === SAVE_VERSION && saved.last && validBalance(saved.last.before) && saved.last.before >= DEMO_COST) {
        try {
          const last = transaction(saved.last.before, saved.last.symbols);
          if (last.after === saved.balance) this.last = last;
        } catch { /* A malformed last result does not erase an otherwise valid demo balance. */ }
      }
    } catch {
      // A corrupt demo save must never touch the real game or prevent login.
      this.balance = DEMO_START;
      this.last = null;
    }
  }
  save() {
    if (!this.persistent) return;
    try {
      this.storage.setItem(DEMO_SLOTS_KEY, JSON.stringify({ version: SAVE_VERSION, balance: this.balance,
        last: this.last ? { before: this.last.before, symbols: this.last.symbols } : null }));
    } catch { this.persistent = false; }
  }
  spin() {
    this.reload();
    if (this.balance < DEMO_COST) return null;
    const symbols = Array.from({ length: SLOT_REELS }, () => {
      const value = this.random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid demo random');
      return Math.floor(value * SLOT_SYMBOLS.length);
    });
    this.last = transaction(this.balance, symbols);
    this.balance = this.last.after;
    // One atomic write commits cost AND all groups before visuals. Reload cannot pay twice.
    // The UI shows the deducted balance until the last reel stops; it never settles money.
    this.save();
    return this.last;
  }
  reset() {
    this.balance = DEMO_START;
    this.last = null;
    this.save();
  }
}

// The only controller/transaction owner. The view receives immutable-shaped snapshots,
// never a wallet, RNG or a callback which can credit a reward.
export class DemoSlots {
  constructor() {
    this.busy = false;
    this.allowed = false;
    this.generation = 0;
    this.onHidden = () => { if (document.hidden) this.finish(); };
    this.onPageHide = () => this.finish();
  }
  connect(parent) {
    if (!this.root) {
      let storage;
      try { storage = window.localStorage; } catch { /* session-only demo */ }
      this.model = new DemoSlotBalance(storage);
      const fragment = document.createElement('div');
      fragment.innerHTML = FORTUNE_SLOTS_HTML;
      this.root = fragment.firstElementChild;
      parent.prepend(this.root);
      // Stable numeric model IDs and existing saves do not change for decorative icons.
      const symbols = SLOT_SYMBOLS.map((symbol, id) => ({ id: String(id), icon: symbol.icon, label: symbol.name }));
      this.view = createFortuneSlotsView(this.root, { symbols });
      this.button = this.root.querySelector('[data-mc-spin]');
      this.resetButton = this.root.querySelector('[data-mc-reset]');
      this.reels = [...this.root.querySelectorAll('[data-mc-reel]')];
      this.button.addEventListener('click', () => this.play());
      this.resetButton.addEventListener('click', () => this.reset());
      this.resetButton.setAttribute('aria-label', 'Восстановить ровно 1 000 тестовых фишек, не меняя прогресс игры');
      const paytable = Object.fromEntries(SLOT_SYMBOLS.map((symbol, id) => [String(id),
        Object.fromEntries(MATCH_COUNTS.map((count, i) => [count, '×' + symbol.multipliers[i]]))]));
      this.view.setPaytable(paytable,
        'Временные gross-множители × 10 фишек, не баланс основной игры. Gross — весь возврат после одного списания 10. Итог = gross − 10; ставку второй раз не возвращаем. Для одного вида — только фактическое количество.');
    }
    this.allowed = true;
    this.model.reload();
    this.renderCurrent();
    document.addEventListener('visibilitychange', this.onHidden);
    window.addEventListener('pagehide', this.onPageHide);
  }
  snapshot({ result = this.model.last, balance = this.model.balance, state, title, detail } = {}) {
    const groups = (result?.groups || []).map(group => ({ symbol: String(group.symbol),
      positions: [...group.positions], payoutText: `${DEMO_COST} × ${group.multiplier} = ${group.payout}` }));
    const net = result ? result.payout - DEMO_COST : 0;
    const sum = result?.groups.map(group => group.payout).join(' + ');
    const insufficient = balance < DEMO_COST;
    return {
      state: state || (insufficient ? 'insufficient' : result ? result.kind : 'idle'),
      balance, cost: DEMO_COST,
      result: (result?.symbols || INITIAL_SYMBOLS).map(String), groups,
      title: title || (insufficient ? 'Не хватает тестовых фишек' : result
        ? result.groups.length ? `${groups.length > 1 ? 'Две группы! ' : ''}+${net} тестовых фишек`
          : 'Нет группы от трёх'
        : 'Семь барабанов. Больше совпадений.'),
      detail: detail || (result
        ? (result.capped ? `По таблице gross ${sum} = ${result.nominalPayout}; лимит демо-баланса. ` : '') +
          `Выплата (gross) ${groups.length > 1 && !result.capped ? sum + ' = ' : ''}${result.payout} · потрачено ${DEMO_COST}.` +
          (insufficient ? ' Восстанови только тестовый баланс кнопкой ниже.' : '')
        : insufficient ? `Нужно ${DEMO_COST} тестовых фишек. Восстанови ровно 1 000, не меняя прогресс игры.`
          : 'Собери от 3 одинаковых в любых позициях. Разные группы складываются.')
    };
  }
  storageNote() {
    const note = this.root?.querySelector('[data-mc-storage]');
    if (note) note.textContent = this.model.persistent
      ? 'Тестовый баланс только в этом браузере, отдельно от аккаунта. Восстановление бесплатно и устанавливает ровно 1 000.'
      : 'Хранилище недоступно: тестовые фишки только на эту сессию. Прогресс игры не затронут.';
  }
  renderCurrent(overrides) {
    if (!this.root) return;
    this.view.render(this.snapshot(overrides));
    this.storageNote();
  }
  open() {
    if (!this.allowed || this.busy) return;
    this.model.reload();
    this.renderCurrent();
  }
  close() { this.finish(); }
  disconnect() {
    this.finish();
    this.allowed = false;
    this.view?.destroy();
    document.removeEventListener('visibilitychange', this.onHidden);
    window.removeEventListener('pagehide', this.onPageHide);
  }
  async play() {
    // Synchronous controller lock is authoritative, even if someone removes disabled.
    if (!this.allowed || this.busy) return false;
    this.busy = true;
    const generation = ++this.generation;
    const previous = this.model.last;
    let result;
    try {
      result = this.model.spin();
      if (!result) { this.busy = false; this.renderCurrent(); return false; }
      // Single model transaction is already committed. Begin displays only its debit,
      // using old faces; reveal later shows its gross outcome without any settlement.
      const spinning = this.snapshot({ result: previous, balance: result.before - DEMO_COST,
        state: 'spinning', title: 'Барабаны в движении…',
        detail: `Потрачено ${DEMO_COST} тестовых фишек. Считаются только 7 итоговых символов.` });
      this.view.begin(spinning);
      this.storageNote();
      await this.view.reveal(this.snapshot());
    } catch {
      // A view-only failure never rolls back or repeats the committed transaction.
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.renderCurrent();
      }
    }
    return Boolean(result);
  }
  finish() {
    if (!this.root) return;
    this.generation++;
    this.view.cancel();
    this.busy = false;
    // No stale settled snapshot: always read the current model, including a spin
    // already committed before cancel, or a balance updated from another tab.
    this.renderCurrent();
  }
  reset() {
    if (!this.allowed || this.busy) return false;
    this.model.reset();
    this.renderCurrent({ title: 'Тестовый баланс восстановлен',
      detail: 'Ровно 1 000 тестовых фишек. Сохранение и ресурсы игры не изменились.' });
    return true;
  }
}

export const demoSlots = new DemoSlots();
