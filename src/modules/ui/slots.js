import { TempleWallet } from '../game/temple-wallet.js';
import { TEMPLE_STAKES } from '../game/temple-rules.js';
import { TEMPLE_CONFIG, TEMPLE_TEST_MODE, TEMPLE_FIXTURES } from '../game/temple-config.js';
import { createTempleWireframeView } from './fortune-slots-view.js';
import { FORTUNE_SLOTS_HTML } from './fortune-slots-template.js';

// One controller and one isolated wallet. The real illustrated cabinet will use
// this snapshot contract; the current view is deliberately labelled WIREFRAME.
export class DemoSlots {
  constructor({ config = TEMPLE_CONFIG, testMode = TEMPLE_TEST_MODE, fixtures = TEMPLE_FIXTURES } = {}) {
    this.options = { config, testMode, fixtures };
    this.allowed = false; this.visible = false; this.busy = false; this.generation = 0;
    this.onHidden = () => {
      if (document.hidden) this.close();
      else if (this.allowed && this.root?.getClientRects?.().length) this.open();
    };
    this.onPageHide = () => this.close();
  }
  connect(parent) {
    if (!this.root) {
      let storage; try { storage = window.localStorage; } catch { /* session-only demo */ }
      this.model = new TempleWallet({ ...this.options, storage });
      const fragment = document.createElement('div'); fragment.innerHTML = FORTUNE_SLOTS_HTML;
      this.root = fragment.firstElementChild; parent.prepend(this.root);
      this.view = createTempleWireframeView(this.root);
      this.button = this.root.querySelector('[data-mt-spin]');
      this.resetButton = this.root.querySelector('[data-mt-reset]');
      this.button.addEventListener('click', () => this.play());
      this.resetButton.addEventListener('click', () => this.reset());
      this.root.querySelector('[data-mt-minus]').addEventListener('click', () => this.changeStake(-1));
      this.root.querySelector('[data-mt-plus]').addEventListener('click', () => this.changeStake(1));
    }
    this.allowed = true; this.model.reload(); this.renderCurrent();
    document.addEventListener('visibilitychange', this.onHidden); window.addEventListener('pagehide', this.onPageHide);
  }
  configure(config, { testMode = false, fixtures = {} } = {}) {
    if (this.busy) return false;
    this.options = { config, testMode, fixtures };
    if (this.model) {
      const previous = this.model;
      this.model = new TempleWallet({ ...this.options, storage: previous.persistent ? previous.storage : undefined });
      if (!previous.persistent) { this.model.balance = previous.balance; this.model.stake = previous.stake; this.model.rulesChanged = true; }
      this.renderCurrent();
    }
    return true;
  }
  snapshot({ spinning = false, result = this.model.last, title, detail } = {}) {
    const m = this.model, free = m.bonus.remaining > 0, stake = free ? m.bonus.triggerStake : m.stake;
    const pending = spinning && result;
    const balance = pending ? result.before - result.debit : m.balance;
    const bonus = pending ? result.bonusBefore : m.bonus;
    const mode = pending ? result.mode : free ? 'free' : 'paid';
    let heading = 'Каркас 5×3 — не финальный автомат';
    let text = m.config ? 'Ожидаются финальные математика и иллюстрированный кабинет.' : 'SPIN недоступен: финальные reel strips и paytable ещё не подключены.';
    if (result && !spinning) {
      const credit = result.creditedGross;
      heading = result.mode === 'free' ? `Бесплатное вращение: +${credit}`
        : result.outcome === 'win' ? `Чистый выигрыш +${result.net}`
          : result.outcome === 'return' ? 'Возврат ставки · net 0'
            : result.outcome === 'partial-return' ? `Частичный возврат · net ${result.net}` : `Без выплаты · net ${result.net}`;
      text = `Общая ставка ${result.totalStake}, линия ${result.lineBet}. Gross ${credit}; списано ${result.debit}; net ${result.net}.`;
      if (result.mode === 'free') text += ` Бесплатное: debit 0, сохранена ставка триггера ${result.totalStake}.`;
      if (result.freeSpinsAwarded) text += ' Получено 10 бесплатных вращений — запускай вручную по одному.';
      if (result.capped) text += ` Технический лимит: номинальный gross ${result.gross}.`;
    }
    if (spinning) { heading = mode === 'free' ? 'Бесплатное вращение…' : 'Вращение…'; text = `Списано ${result.debit}. Результат определяется пятью stop-индексами реальных лент, не 15 независимыми ячейками.`; }
    return { phase: spinning ? 'spinning' : !m.config ? 'config-pending' : 'settled',
      title: title || heading, detail: detail || text, visible: this.visible, ready: Boolean(m.config),
      grid: (spinning ? this.previousGrid : result?.grid)?.map(column => [...column]) || null,
      result: spinning || !result ? null : structuredClone(result),
      balance, selectedStake: m.stake, stake: pending ? result.totalStake : stake,
      mode, bonus: { ...bonus }, debit: pending ? result.debit : result?.debit ?? null,
      rulesChanged: m.rulesChanged, persistent: m.persistent,
      testMode: m.testMode, fixtureIds: m.testMode ? Object.keys(m.fixtures) : [],
      config: m.config, busy: this.busy,
      spinAvailable: Boolean(m.config) && !this.busy && (free || m.balance >= m.stake) };
  }
  renderCurrent(overrides) { if (this.root) this.view.render(this.snapshot(overrides)); }
  open() { if (!this.allowed) return; this.visible = true; if (!this.busy) { this.model.reload(); this.renderCurrent(); } }
  close() { this.visible = false; this.finish(); }
  disconnect() {
    this.close(); this.allowed = false; this.view?.destroy();
    document.removeEventListener('visibilitychange', this.onHidden); window.removeEventListener('pagehide', this.onPageHide);
  }
  async play({ fixtureId, mode, requestId } = {}) {
    if (!this.allowed || this.busy) return false;
    this.busy = true; const generation = ++this.generation;
    let result;
    try {
      this.model.reload(); this.previousGrid = this.model.last?.grid || null;
      const chosen = fixtureId ?? this.view.selectedFixture?.();
      result = this.model.spin({ mode: mode ?? (this.model.bonus.remaining ? 'free' : 'paid'), requestId, fixtureId: chosen || undefined });
      if (!result) return false;
      this.view.begin(this.snapshot({ spinning: true, result }));
      await this.view.reveal(this.snapshot({ result }));
    } catch {
      // Presentation/fixture errors never retry RNG or roll back a committed wallet.
    } finally {
      if (generation === this.generation) { this.busy = false; this.renderCurrent(); }
    }
    return Boolean(result);
  }
  finish() {
    if (!this.root) return;
    this.generation++; this.view.cancel(); this.busy = false; this.renderCurrent();
  }
  changeStake(delta) {
    if (!this.allowed || this.busy || this.model.bonus.remaining) return false;
    const index = TEMPLE_STAKES.indexOf(this.model.stake), next = TEMPLE_STAKES[Math.max(0, Math.min(TEMPLE_STAKES.length - 1, index + Math.sign(delta)))];
    const changed = this.model.setStake(next); this.renderCurrent(); return changed;
  }
  reset() {
    if (!this.allowed || this.busy) return false;
    this.model.reset(); this.renderCurrent({ title: 'Демо сброшено до 1 000', detail: 'Free counter и прошлый результат очищены. Основные ресурсы игры не изменились.' }); return true;
  }
}
export const demoSlots = new DemoSlots();
