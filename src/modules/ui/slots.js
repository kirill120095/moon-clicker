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

export class DemoSlots {
  constructor() {
    this.busy = false;
    this.allowed = false;
    this.generation = 0;
    this.animations = [];
    this.pauseTimer = null;
    this.pauseResolve = null;
    this.visibleSymbols = [...INITIAL_SYMBOLS];
    this.onHidden = () => { if (document.hidden) this.finish(); };
    this.onPageHide = () => this.finish();
  }
  connect(parent) {
    if (!this.root) {
      let storage;
      try { storage = window.localStorage; } catch { /* sandbox/private mode: session only */ }
      this.model = new DemoSlotBalance(storage);
      const root = document.createElement('section');
      root.className = 'demo-slots';
      root.setAttribute('aria-labelledby', 'demoSlotsTitle');
      root.innerHTML = `
        <header class="demo-slots-header"><div><span class="demo-slots-eyebrow">ФОРТУНА · 7 БАРАБАНОВ</span><h2 id="demoSlotsTitle">Лунные слоты</h2></div><span class="demo-slots-badge">ТЕСТ</span></header>
        <p class="demo-slots-note">Только демо-фишки. Луны, кристаллы и прогресс игры не меняются.</p>
        <div class="demo-slots-wallet"><span>Демо-фишки <strong data-demo-balance></strong></span><span>Вращение <b>${DEMO_COST}</b></span></div>
        <div class="demo-slots-machine">
          <div class="demo-slots-reels" role="group" aria-label="Семь барабанов, один результат на каждом">${Array.from({ length: SLOT_REELS }, (_, i) => `<div class="demo-slot-unit"><span class="demo-slot-index" aria-hidden="true">0${i + 1}</span><div class="demo-slot-reel" role="img" aria-label="Барабан ${i + 1}"><div class="demo-slot-strip" aria-hidden="true"></div></div></div>`).join('')}</div>
          <div class="demo-slots-caption">3–7 ОДИНАКОВЫХ · В ЛЮБЫХ ПОЗИЦИЯХ</div>
        </div>
        <div class="demo-slots-result" role="status" aria-live="polite" aria-atomic="true"><strong></strong><span></span><ul class="demo-slots-groups" aria-label="Расчёт выигравших групп"></ul></div>
        <button type="button" class="demo-slots-spin">Вращать · ${DEMO_COST} демо-фишек <span aria-hidden="true">↻</span></button>
        <button type="button" class="demo-slots-reset">Восстановить ${DEMO_START.toLocaleString('ru-RU')} демо-фишек</button>
        <details class="demo-slots-paytable" open><summary>40 комбинаций · таблица выплат</summary><table><caption>Количество одинаковых → gross-множитель × ${DEMO_COST} фишек. Одна тестовая таблица для всех символов; не баланс игры.</caption><thead><tr><th scope="col">Символ</th>${MATCH_COUNTS.map(n => `<th scope="col">${n}<span class="demo-sr-only"> одинаковых символов</span></th>`).join('')}</tr></thead><tbody>
          ${SLOT_SYMBOLS.map((s, i) => `<tr><th scope="row" title="${s.name}"><span aria-hidden="true">${s.icon}</span><span class="demo-symbol-name">${s.name}</span></th>${s.multipliers.map((m, j) => `<td data-demo-rule="${i}-${j + 3}" title="${s.name}, ${j + 3} символов: ${DEMO_COST * m} демо-фишек">×${m}</td>`).join('')}</tr>`).join('')}
        </tbody></table><p>Разные группы складываются: две тройки оплачиваются обе. Для одного символа — только фактическое количество, без вложенных троек. Пары не оплачиваются. Gross — вся выплата после списания. Итог = выплата − ${DEMO_COST}; ставку второй раз не возвращаем. Все символы равновероятны.</p></details>
        <p class="demo-slots-storage"></p>`;
      parent.prepend(root);
      this.root = root;
      this.reels = [...root.querySelectorAll('.demo-slot-reel')];
      this.strips = [...root.querySelectorAll('.demo-slot-strip')];
      this.button = root.querySelector('.demo-slots-spin');
      this.resetButton = root.querySelector('.demo-slots-reset');
      this.button.addEventListener('click', () => this.play());
      this.resetButton.addEventListener('click', () => this.reset());
    }
    this.allowed = true;
    this.model.reload();
    this.renderSaved();
    document.addEventListener('visibilitychange', this.onHidden);
    window.addEventListener('pagehide', this.onPageHide);
  }
  disconnect() {
    this.finish();
    this.allowed = false;
    document.removeEventListener('visibilitychange', this.onHidden);
    window.removeEventListener('pagehide', this.onPageHide);
  }
  open() {
    if (!this.allowed || this.busy) return;
    this.model.reload();
    this.renderSaved();
  }
  close() { this.finish(); }
  motion() {
    return !document.documentElement.classList.contains('reduce-effects') &&
      !document.body.classList.contains('reduce-effects') &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  message(title, detail) {
    this.root.querySelector('.demo-slots-result strong').textContent = title;
    this.root.querySelector('.demo-slots-result > span').textContent = detail;
  }
  refreshBalance(visible = this.model.balance) {
    this.root.querySelector('[data-demo-balance]').textContent = visible.toLocaleString('ru-RU');
    this.button.disabled = this.busy || this.model.balance < DEMO_COST;
    this.button.setAttribute('aria-busy', String(this.busy));
    this.resetButton.disabled = this.busy;
    this.root.querySelector('.demo-slots-storage').textContent = this.model.persistent
      ? 'Демо-баланс хранится только в этом браузере, отдельно от аккаунта. Его можно восстановить бесплатно.'
      : 'Хранилище недоступно: демо-фишки только на эту сессию. Прогресс игры не затронут.';
  }
  showSymbol(index, symbol) {
    const span = document.createElement('span');
    span.textContent = SLOT_SYMBOLS[symbol].icon;
    this.strips[index].replaceChildren(span);
    this.strips[index].style.transform = '';
    this.reels[index].setAttribute('aria-label', `Барабан ${index + 1}: ${SLOT_SYMBOLS[symbol].name}`);
    this.reels[index].classList.remove('demo-slot-moving');
    this.visibleSymbols[index] = symbol;
  }
  clearResult() {
    this.root.classList.remove('demo-slots-win', 'demo-slots-loss');
    this.root.querySelector('.demo-slots-groups').replaceChildren();
    for (const node of this.root.querySelectorAll('[data-demo-group]')) {
      node.removeAttribute('data-demo-group');
      node.classList.remove('demo-slot-hit', 'demo-rule-hit');
    }
  }
  renderSaved() {
    this.clearResult();
    const result = this.model.last;
    (result?.symbols || INITIAL_SYMBOLS).forEach((symbol, i) => this.showSymbol(i, symbol));
    if (result) this.showResult(result);
    else this.message('Семь барабанов. Больше совпадений.', 'Собери от 3 одинаковых где угодно. Разные группы складываются.');
    if (this.model.balance < DEMO_COST) this.message('Не хватает демо-фишек', `Нужно ${DEMO_COST}. Восстанови тестовый баланс кнопкой ниже.`);
    this.refreshBalance();
  }
  showResult(result) {
    this.root.classList.add('demo-slots-' + result.kind);
    const net = result.payout - DEMO_COST;
    const title = result.groups.length ? `${result.groups.length > 1 ? 'Две группы! ' : ''}+${net} демо-фишек` : 'Нет группы от трёх';
    const sum = result.groups.map(group => group.payout).join(' + ');
    const detail = result.capped ? `По таблице ${sum} = ${result.nominalPayout}. Лимит демо-баланса: выплата ${result.payout} · потрачено ${DEMO_COST}.`
      : `Выплата (gross) ${result.groups.length > 1 ? sum + ' = ' : ''}${result.payout} · потрачено ${DEMO_COST}.`;
    this.message(title, detail);
    const list = this.root.querySelector('.demo-slots-groups');
    list.replaceChildren();
    result.groups.forEach((group, index) => {
      const symbol = SLOT_SYMBOLS[group.symbol];
      const line = document.createElement('li');
      line.setAttribute('data-demo-group', index);
      line.textContent = `${symbol.icon} ${symbol.name} · ${group.count} шт.: ${DEMO_COST} × ${group.multiplier} = ${group.payout}`;
      list.append(line);
      for (const position of group.positions) {
        this.reels[position].classList.add('demo-slot-hit');
        this.reels[position].setAttribute('data-demo-group', index);
        this.reels[position].setAttribute('aria-label', `Барабан ${position + 1}: ${symbol.name}, выигравшая группа ${group.count}`);
      }
      const cell = this.root.querySelector(`[data-demo-rule="${group.symbol}-${group.count}"]`);
      cell.classList.add('demo-rule-hit');
      cell.setAttribute('data-demo-group', index);
    });
  }
  async play() {
    if (!this.allowed || this.busy) return false;
    const result = this.model.spin();
    if (!result) { this.renderSaved(); return false; }
    this.busy = true;
    this.current = result;
    const generation = ++this.generation;
    this.clearResult();
    this.refreshBalance(result.before - DEMO_COST);
    this.message('Семь барабанов в движении…', `Потрачено ${DEMO_COST} демо-фишек. Ждём седьмой символ.`);
    try {
      if (this.motion()) {
        await Promise.all(this.strips.map(async (strip, i) => {
          if (!strip.animate) return;
          const lowPower = document.documentElement.classList.contains('low-power');
          const count = lowPower ? 8 + i : 12 + i * 2;
          const cells = [this.visibleSymbols[i], ...Array.from({ length: count - 2 }, (_, j) => (j + i) % SLOT_SYMBOLS.length), result.symbols[i]];
          strip.replaceChildren(...cells.map(id => { const span = document.createElement('span'); span.textContent = SLOT_SYMBOLS[id].icon; return span; }));
          this.reels[i].classList.add('demo-slot-moving');
          this.reels[i].setAttribute('aria-label', `Барабан ${i + 1}: вращается`);
          const animation = strip.animate([
            { transform: 'translateY(0)' },
            { transform: `translateY(calc(-100% + var(--demo-slot-cell)))` }
          ], { duration: lowPower ? 650 + i * 160 : 850 + i * 200, easing: 'cubic-bezier(.15,.55,.15,1)', fill: 'forwards' });
          this.animations.push(animation);
          await animation.finished.catch(() => {});
          if (generation !== this.generation) return;
          animation.cancel();
          this.showSymbol(i, result.symbols[i]);
        }));
      } else {
        // Keep a short click lock without motion, including reduced-effects mode.
        await new Promise(resolve => {
          this.pauseResolve = resolve;
          this.pauseTimer = setTimeout(resolve, 300);
        });
      }
    } catch {
      // A visual-only failure must not strand the button or reject a click handler.
    } finally {
      // Also reveal the committed outcome if a browser lacks/interrupts animation support.
      if (generation === this.generation) this.finish();
    }
    return true;
  }
  finish() {
    if (!this.busy) return;
    this.generation++;
    clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    this.pauseResolve?.();
    this.pauseResolve = null;
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    this.busy = false;
    this.current.symbols.forEach((symbol, i) => this.showSymbol(i, symbol));
    this.showResult(this.current);
    this.current = null;
    this.refreshBalance();
    if (this.model.balance < DEMO_COST) this.message('Не хватает демо-фишек', `Выплата 0 · потрачено ${DEMO_COST}. Восстанови только демо-баланс ниже.`);
  }
  reset() {
    if (!this.allowed || this.busy) return false;
    this.model.reset();
    this.renderSaved();
    this.message('Демо-баланс восстановлен', `${DEMO_START.toLocaleString('ru-RU')} тестовых фишек. Сохранение игры не изменилось.`);
    return true;
  }
}

export const demoSlots = new DemoSlots();
