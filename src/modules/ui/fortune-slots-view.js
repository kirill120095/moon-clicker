/** Presentation adapter only. No RNG, rewards, storage, network or game state imports. */
export const FORTUNE_SLOT_SYMBOLS = Object.freeze([
  { id: 'moon', icon: '🌙', label: 'Луна' },
  { id: 'star', icon: '⭐', label: 'Звезда' },
  { id: 'comet', icon: '☄️', label: 'Комета' },
  { id: 'planet', icon: '🪐', label: 'Планета' },
  { id: 'rocket', icon: '🚀', label: 'Ракета' },
  { id: 'satellite', icon: '🛰️', label: 'Спутник' },
  { id: 'ufo', icon: '🛸', label: 'НЛО' },
  { id: 'galaxy', icon: '🌌', label: 'Галактика' },
].map(Object.freeze));

/**
 * Root must contain fortune-slots.html. Positions in groups are ZERO-based.
 * Snapshot: {state, balance, cost, result: string[7], groups: [{symbol,positions,payoutText}], title, detail}.
 * Explicit states: idle | spinning | win | loss | insufficient.
 * The model owns all numbers, eligibility, result and groups. This view never calculates them.
 */
export function createFortuneSlotsView(root, { symbols = FORTUNE_SLOT_SYMBOLS } = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const find = key => root.querySelector(`[data-mc-${key}]`);
  const reels = [...root.querySelectorAll('[data-mc-reel]')];
  const spin = find('spin'), reset = find('reset'), arena = find('reels');
  if (reels.length !== 7 || symbols.length !== 8 || !spin || !reset || !arena) throw new Error('Slots view needs 7 reels, 8 symbols and both buttons');
  const byId = new Map(symbols.map(s => [s.id, s]));
  if (byId.size !== 8) throw new Error('Slots symbol IDs must be unique');
  const labels = { idle: 'Готово', spinning: 'Вращение', win: 'Совпадение', loss: 'Без группы', insufficient: 'Нет фишек' };
  const number = value => value.toLocaleString('ru-RU');
  const pending = new Map(), animations = new Set();
  let epoch = 0, current = null, busy = false, restoreSpinFocus = false;
  const motion = () => root.dataset.motion !== 'reduced'
    && !root.closest('.reduce-effects, .low-power')
    && !win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function invalidate() {
    epoch++;
    for (const [timer, resolve] of pending) { win.clearTimeout(timer); resolve(false); }
    pending.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
  }
  function wait(ms, token) {
    if (!ms) return Promise.resolve(token === epoch);
    return new Promise(resolve => {
      const timer = win.setTimeout(() => { pending.delete(timer); resolve(token === epoch); }, ms);
      pending.set(timer, resolve);
    });
  }
  function validate(snapshot) {
    if (!labels[snapshot.state]) throw new Error('Unknown slots visual state');
    if (!Number.isSafeInteger(snapshot.balance) || snapshot.balance < 0 || !Number.isSafeInteger(snapshot.cost) || snapshot.cost < 1) throw new Error('Model must provide valid test balance and cost');
    if (!Array.isArray(snapshot.result) || snapshot.result.length !== 7 || snapshot.result.some(id => !byId.has(id))) throw new Error('Model must provide exactly 7 known result symbols');
    const groups = snapshot.groups || [];
    if (groups.length > 2) throw new Error('Seven positions can show at most 2 paying groups');
    const used = new Set();
    for (const group of groups) {
      if (!byId.has(group.symbol) || !Array.isArray(group.positions) || group.positions.length < 3) throw new Error('A visual group needs a symbol and at least 3 positions');
      for (const position of group.positions) {
        if (!Number.isInteger(position) || position < 0 || position > 6 || used.has(position) || snapshot.result[position] !== group.symbol) throw new Error('Visual group positions must match the model result');
        used.add(position);
      }
    }
    return { ...snapshot, result: [...snapshot.result], groups: groups.map(g => ({ ...g, positions: [...g.positions] })) };
  }
  function face(index, symbolId) {
    const reel = reels[index], symbol = byId.get(symbolId);
    reel.querySelector('.mc-slots__icon').textContent = symbol.icon;
    reel.setAttribute('aria-label', `Позиция ${index + 1}: ${symbol.label}`);
    reel.dataset.reelState = 'stopped';
  }
  function paint(snapshot) {
    current = snapshot;
    root.dataset.state = snapshot.state;
    busy = snapshot.state === 'spinning';
    arena.setAttribute('aria-busy', String(busy));
    spin.setAttribute('aria-busy', String(busy));
    find('state').textContent = labels[snapshot.state];
    find('balance').textContent = number(snapshot.balance);
    find('cost').textContent = `${number(snapshot.cost)} фишек`;
    find('title').textContent = snapshot.title || labels[snapshot.state];
    find('detail').textContent = snapshot.detail || '';
    spin.disabled = busy || snapshot.state === 'insufficient' || snapshot.balance < snapshot.cost;
    reset.disabled = busy;
    spin.textContent = busy ? 'Вращение…' : snapshot.state === 'insufficient' || snapshot.balance < snapshot.cost ? 'Нужны фишки' : `Вращать · ${number(snapshot.cost)}`;
    for (let i = 0; i < reels.length; i++) {
      delete reels[i].dataset.group;
      reels[i].querySelector('.mc-slots__match').textContent = '';
      face(i, snapshot.result[i]);
      if (busy) {
        reels[i].dataset.reelState = 'spinning';
        reels[i].setAttribute('aria-label', `Позиция ${i + 1}: вращается`);
      }
    }
    for (const cell of body.querySelectorAll('[data-mc-count]')) delete cell.dataset.group;
    const list = find('groups'); list.replaceChildren();
    if (!busy) snapshot.groups.forEach((group, index) => {
      const marker = index === 0 ? 'А' : 'Б', symbol = byId.get(group.symbol);
      const row = [...body.rows].find(row => row.dataset.mcPayrow === group.symbol);
      const cell = row?.querySelector(`[data-mc-count="${group.positions.length}"]`);
      if (cell) cell.dataset.group = String(index + 1);
      for (const position of group.positions) {
        const reel = reels[position]; reel.dataset.group = String(index + 1);
        reel.querySelector('.mc-slots__match').textContent = marker;
        reel.setAttribute('aria-label', `Позиция ${position + 1}: ${symbol.label}, группа ${marker}`);
      }
      const item = doc.createElement('li'); item.className = 'mc-slots__group'; item.dataset.group = String(index + 1);
      const badge = doc.createElement('span'); badge.className = 'mc-slots__group-badge'; badge.textContent = marker; badge.setAttribute('aria-hidden', 'true');
      const name = doc.createElement('span'); name.className = 'mc-slots__group-name'; name.textContent = `${symbol.icon} ${symbol.label} ×${group.positions.length}`;
      name.setAttribute('aria-label', `Группа ${marker}: ${symbol.label}, ${group.positions.length} одинаковых, позиции ${group.positions.map(p => p + 1).join(', ')}`);
      const value = doc.createElement('span'); value.className = 'mc-slots__group-value'; value.textContent = group.payoutText || '';
      item.append(badge, name, value); list.append(item);
    });
    list.hidden = !snapshot.groups.length || busy;
  }

  // Fixed decorative tapes, never random results. Only the 7 central faces count.
  reels.forEach((reel, index) => {
    const tape = reel.querySelector('.mc-slots__motion'); tape.replaceChildren();
    const sequence = [symbols[index % 8], symbols[(index + 3) % 8], symbols[(index + 5) % 8]];
    for (const symbol of [...sequence, ...sequence]) { const span = doc.createElement('span'); span.textContent = symbol.icon; tape.append(span); }
  });
  const body = find('payrows'); body.replaceChildren();
  for (const symbol of symbols) {
    const row = doc.createElement('tr'); row.dataset.mcPayrow = symbol.id;
    const heading = doc.createElement('th'); heading.scope = 'row';
    const icon = doc.createElement('span'); icon.className = 'mc-slots__table-icon'; icon.textContent = symbol.icon; icon.setAttribute('aria-hidden', 'true');
    heading.append(icon, doc.createTextNode(symbol.label)); row.append(heading);
    for (let count = 3; count <= 7; count++) { const cell = doc.createElement('td'); cell.dataset.mcCount = String(count); cell.textContent = '—'; row.append(cell); }
    body.append(row);
  }
  // Until the model renders a snapshot, the component cannot start a spin.
  spin.disabled = true;

  return {
    render(snapshot) { const next = validate(snapshot); invalidate(); restoreSpinFocus = false; paint(next); },
    begin(snapshot) {
      if (busy || (!snapshot && (!current || spin.disabled))) return false;
      const next = validate(snapshot || { ...current, state: 'spinning', groups: [], title: 'Барабаны в движении…', detail: 'Остановка слева направо. Считаются только 7 итоговых символов.' });
      if (next.state !== 'spinning') throw new Error('Begin needs a spinning snapshot');
      invalidate(); restoreSpinFocus = doc.activeElement === spin;
      paint({ ...next, groups: [] });
      return true;
    },
    async reveal(snapshot) {
      const next = validate(snapshot);
      if (!busy || next.state === 'spinning') return false;
      invalidate(); const token = epoch;
      for (let i = 0; i < 7; i++) {
        // Quiet mode still has a short reveal guard, not instantaneous multi-clicks.
        if (!await wait(motion() ? (i === 0 ? 280 : 90) : (i === 0 ? 300 : 0), token)) return false;
        face(i, next.result[i]);
        if (motion() && reels[i].querySelector('.mc-slots__icon').animate) {
          const animation = reels[i].querySelector('.mc-slots__icon').animate([{ transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 130, easing: 'ease-out' });
          animations.add(animation); animation.finished.catch(() => {}).finally(() => animations.delete(animation));
        }
      }
      if (token !== epoch) return false;
      paint(next);
      // Do not steal focus if the player moved to the table or away from this tab.
      if (restoreSpinFocus && doc.activeElement === doc.body && spin.isConnected && spin.getClientRects().length && !spin.disabled) spin.focus({ preventScroll: true });
      restoreSpinFocus = false;
      return true;
    },
    setPaytable(values, note = 'Значения выплат переданы моделью слотов.') {
      for (const row of body.rows) for (const cell of row.querySelectorAll('[data-mc-count]')) cell.textContent = String(values[row.dataset.mcPayrow]?.[cell.dataset.mcCount] ?? '—');
      find('paynote').textContent = note;
    },
    // The controller must render its CURRENT model snapshot next; do not resurrect
    // an old pre-spin balance here. Cancelling presentation never cancels money.
    cancel() {
      invalidate(); restoreSpinFocus = false; busy = false;
      arena.setAttribute('aria-busy', 'false'); spin.setAttribute('aria-busy', 'false');
      for (const reel of reels) reel.dataset.reelState = 'stopped';
      spin.disabled = true; reset.disabled = true;
    },
    destroy() { this.cancel(); },
  };
}
