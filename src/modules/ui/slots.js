import { TempleWallet } from '../game/temple-wallet.js';
import { TempleAccountClient } from '../game/temple-account-client.js';
import { TempleTestItems } from '../game/temple-test-items.js';
import { templeReleaseBlockReason } from '../game/temple-item-protocol.js';
import { TEMPLE_STAKES } from '../game/temple-rules.js';
import { TEMPLE_CONFIG, TEMPLE_TEST_MODE, TEMPLE_FIXTURES, TEMPLE_TEST_ITEM_MAPPING, TEMPLE_DEFAULT_DEMO } from '../game/temple-config.js';
import { createTempleWireframeView } from './fortune-slots-view.js';
import { FORTUNE_SLOTS_HTML } from './fortune-slots-template.js';

// One controller and one isolated wallet. The real illustrated cabinet will use
// this snapshot contract; the current view is deliberately labelled WIREFRAME.
export class DemoSlots {
  constructor({ config = TEMPLE_CONFIG, testMode = TEMPLE_TEST_MODE, fixtures = TEMPLE_FIXTURES, accountClient = null, demoItems = TEMPLE_DEFAULT_DEMO, itemMapping } = {}) {
    this.options = { config, testMode, fixtures, accountClient, demoItems, itemMapping };
    this.allowed = false; this.visible = false; this.busy = false; this.generation = 0;
    this.onHidden = () => {
      if (document.hidden) this.close();
      else if (this.allowed && this.root?.getClientRects?.().length) this.open();
    };
    this.onPageHide = () => this.close();
  }
  connect(parent) {
    if (!this.root) {
      if (this.options.testMode) {
        let storage; try { storage = window.localStorage; } catch { /* session-only test adapter */ }
        this.model = new TempleWallet({ ...this.options, storage });
      } else if (this.options.accountClient || !this.options.demoItems) {
        // No test balance/inventory is ever copied into a real account.
        this.model = this.options.accountClient || new TempleAccountClient();
      } else {
        let storage;try { storage=window.localStorage; } catch { /* session-only test fallback */ }
        this.model=new TempleTestItems({mapping:this.options.itemMapping??TEMPLE_TEST_ITEM_MAPPING,storage});
      }
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
    if(this.view?.destroyed)this.view=createTempleWireframeView(this.root);
    this.allowed = true; this.model.reload(); this.renderCurrent();
    document.addEventListener('visibilitychange', this.onHidden); window.addEventListener('pagehide', this.onPageHide);
  }
  configure(config, { testMode = false, fixtures = {} } = {}) {
    if (this.busy || this.model?.busy || testMode !== true) return false;
    this.options = { config, testMode, fixtures };
    if (this.model) {
      const previous = this.model;
      this.model = new TempleWallet({ ...this.options, storage: previous.kind === 'demo-test' && previous.persistent ? previous.storage : undefined });
      if (previous.kind === 'demo-test' && !previous.persistent) { this.model.balance = previous.balance; this.model.stake = previous.stake; this.model.rulesChanged = true; }
      this.renderCurrent();
    }
    return true;
  }
  configureTestItems(mapping, {storage,fixtures={},allowFixtures=false}={}) {
    if(this.busy||this.model?.busy)return false;
    if(storage===undefined){try{storage=window.localStorage;}catch{}}
    this.model=new TempleTestItems({mapping,storage,fixtures,allowFixtures});
    this.options={demoItems:true,itemMapping:mapping,testMode:false};
    this.renderCurrent();return true;
  }
  configureAccount(client) {
    if (this.busy || this.model?.busy || !(client instanceof TempleAccountClient)) return false;
    this.options = { accountClient:client,testMode:false,config:null,fixtures:{} };
    this.model = client; this.renderCurrent(); return true;
  }
  testItemSnapshot({spinning=false,result=this.model.last,title,detail}={}) {
    const m=this.model,free=m.bonus.remaining>0,awards=spinning?[]:(result?.awardedItems||[]);
    const count=awards.reduce((sum,item)=>sum+item.quantity,0);
    const viewResult=spinning||!result?null:structuredClone(result);
    if(viewResult?.rewardedLineIds?.length){viewResult.matchedLineWins=viewResult.lineWins;viewResult.lineWins=viewResult.lineWins.filter(line=>viewResult.rewardedLineIds.includes(line.lineId));}
    return {rewardMode:'items',walletMode:'test-items',testMode:true,phase:spinning?'spinning':m.mapping?'settled':'mapping-pending',
      title:title||(m.readOnly?'Сохранение только для чтения':spinning?'Тестовое вращение…':!m.mapping?'Ожидается candidate item-mapping':result?(count?'Тестовые предметы: +'+count:'Предметы не выпали'):'Тестовый «Лунный храм»'),
      detail:detail||(m.readOnly?'Неизвестная или повреждённая версия: запись и сброс заблокированы, данные не перезаписаны.':spinning?'Списаны только тестовые фишки. Предметы будут показаны после остановки.':result?`Тестовое списание ${result.debit}; найдено предметов ${count}.`+(result.mode==='free'?` Free: debit0, ставка триггера ${result.totalStake}.`:'')+(result.freeSpinsAwarded?' Получено10бесплатных вращений, вручную.':''):'Локальный баланс и сумка не связаны с аккаунтом. Mapping временный; боевых эффектов и слияния нет.'),
      visible:this.visible,ready:Boolean(m.mapping),busy:this.busy||m.busy,
      grid:(spinning?this.previousGrid:result?.grid)?.map(c=>[...c])||null,result:viewResult,
      balance:m.readOnly?null:spinning&&result?result.before-result.debit:m.balance,selectedStake:m.stake,stake:spinning&&result?result.totalStake:free?m.bonus.triggerStake:m.stake,
      mode:spinning&&result?result.mode:free?'free':'paid',bonus:{...(spinning&&result?result.bonusBefore:m.bonus)},
      inventoryVersion:spinning?this.previousInventoryVersion:m.inventoryVersion,
      inventoryItems:structuredClone(spinning?(this.previousInventory||[]):m.inventoryItems),awardedItems:structuredClone(awards),
      debitAmount:spinning?null:result?.debit??null,blockReason:m.blockReason,rulesChanged:m.mappingChanged,persistent:m.persistent,
      readOnly:m.readOnly,mappingId:m.mapping?.id||null,fixtureIds:m.allowFixtures?Object.keys(m.fixtures):[],config:null,
      spinAvailable:m.canSpin&&!this.busy,resetAvailable:!m.readOnly};
  }
  accountSnapshot({spinning=false,result=this.model.last,title,detail}={}) {
    const m=this.model;
    spinning = spinning || m.busy;
    const contextBlocked=templeReleaseBlockReason(m.release,m.binding(),m.transport);
    const visibleResult=contextBlocked?null:result;
    const drops=spinning?[]:(visibleResult?.awardedItems || []);
    const count=drops.reduce((sum,item)=>sum+item.quantity,0);
    const free=!contextBlocked&&m.bonus.remaining>0;
    return {rewardMode:'items',phase:spinning?'requesting':m.blockReason?'release-blocked':'settled',
      title:title||(spinning?'Ожидаем подтверждения сервера':!contextBlocked&&m.uncertain?'Результат запроса уточняется':visibleResult?(count?'Предметы получены: '+count:'Новых предметов нет'):'Предметный выпуск ещё не активирован'),
      detail:detail||(spinning?'Локально ничего не списывается и не начисляется.':!contextBlocked&&m.uncertain?'Новый spin заблокирован. Нужна сверка того же requestId с сервером; локального возврата или повторного начисления нет.':visibleResult?`Сервер подтвердил списание ${visibleResult.shardsDebited} обычных осколков. Инвентарь версии ${visibleResult.inventoryVersion}.`:'Нужны подтверждённые target, auth UUID и item-mapping. Ник не заменяет UUID; реальных запросов сейчас нет.'),
      visible:this.visible,accountVisible:!contextBlocked&&m.stateVersion!==null,ready:!m.blockReason,busy:this.busy||m.busy,
      grid:spinning?this.previousGrid?.map(c=>[...c])||null:visibleResult?.grid.map(c=>[...c])||null,
      result:spinning||!visibleResult?null:structuredClone(visibleResult),
      balance:contextBlocked?null:m.shardsBalance,selectedStake:m.stake,stake:free?m.bonus.triggerStake:m.stake,
      mode:free?'free':'paid',bonus:contextBlocked?{remaining:0,triggerStake:null}:{...m.bonus},
      inventoryVersion:contextBlocked?null:m.inventoryVersion,
      inventoryItems:contextBlocked||m.inventoryItems===null?null:structuredClone(m.inventoryItems),
      awardedItems:structuredClone(drops),shardsDebited:visibleResult?.shardsDebited??null,debitAmount:visibleResult?.shardsDebited??null,
      blockReason:m.blockReason,rulesChanged:false,persistent:false,testMode:false,fixtureIds:[],config:null,
      spinAvailable:m.canSpin&&!this.busy,resetAvailable:false};
  }
  snapshot(options = {}) {
    if (this.model.kind === 'account-items') return this.accountSnapshot(options);
    if (this.model.kind === 'test-items') return this.testItemSnapshot(options);
    const {spinning=false,result=this.model.last,title,detail}=options;
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
    return { rewardMode:'test-cash', resetAvailable:true, phase: spinning ? 'spinning' : !m.config ? 'config-pending' : 'settled',
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
  renderCurrent(overrides) { if(this.root){const snapshot=this.snapshot(overrides);this.root.hidden=this.model.kind==='account-items'&&!snapshot.accountVisible;this.view.render(snapshot);this.setWide(this.visible&&!this.root.hidden);} }
  setWide(active){if(typeof document!=='undefined')document.getElementById?.('shopPanel')?.classList.toggle('lt-fortune-wide',active&&!this.root?.hidden);}
  open() { if (!this.allowed) return; this.visible = true; this.setWide(true); if (!this.busy) { this.model.reload(); this.renderCurrent(); } }
  close() { this.visible = false; this.setWide(false); this.finish(); }
  disconnect() {
    this.close(); this.allowed = false; this.view?.destroy();
    if (this.model?.kind === 'account-items') this.model.clearProjection();
    document.removeEventListener('visibilitychange', this.onHidden); window.removeEventListener('pagehide', this.onPageHide);
  }
  async play({ fixtureId, mode, requestId } = {}) {
    if (!this.allowed || this.busy || this.model.busy) return false;
    if (this.model.kind === 'account-items' && !this.model.canSpin) { this.renderCurrent(); return false; }
    this.busy = true; const generation = ++this.generation;
    let result;
    try {
      this.model.reload(); this.previousGrid = this.model.last?.grid || null;
      this.previousInventory=this.model.inventoryItems===undefined||this.model.inventoryItems===null?null:structuredClone(this.model.inventoryItems);
      this.previousInventoryVersion=this.model.inventoryVersion??null;
      const chosen = fixtureId ?? this.view.selectedFixture?.();
      if (this.model.kind === 'account-items') {
        this.view.begin(this.snapshot({spinning:true,result:null}));
        result = await this.model.spin({mode:mode??(this.model.bonus.remaining?'free':'paid'),requestId,fixtureId:chosen||undefined});
      } else {
        result = this.model.spin({mode:mode??(this.model.bonus.remaining?'free':'paid'),requestId,fixtureId:chosen||undefined});
        if (result) this.view.begin(this.snapshot({spinning:true,result}));
      }
      if (!result) return false;
      if (generation === this.generation) await this.view.reveal(this.snapshot({ result }));
    } catch {
      // Presentation/fixture errors never retry RNG or roll back a committed wallet.
    } finally {
      if (generation === this.generation) { this.busy = false; this.renderCurrent(); }
      else if (this.allowed && this.visible && !this.busy) this.renderCurrent();
    }
    return Boolean(result);
  }
  finish() {
    if (!this.root) return;
    this.generation++; this.view.cancel(); this.busy = false; this.renderCurrent();
  }
  changeStake(delta) {
    if (!this.allowed || this.busy || this.model.busy || this.model.bonus.remaining) return false;
    const index = TEMPLE_STAKES.indexOf(this.model.stake), next = TEMPLE_STAKES[Math.max(0, Math.min(TEMPLE_STAKES.length - 1, index + Math.sign(delta)))];
    const changed = this.model.setStake(next); this.renderCurrent(); return changed;
  }
  reset({confirmed=false}={}) {
    if (!this.allowed || this.busy || this.model.busy || this.model.kind === 'account-items') return false;
    if(this.model.readOnly){this.renderCurrent();return false;}
    if(this.model.bonus.remaining&&!confirmed){this.view.confirmReset?.(()=>this.reset({confirmed:true}));return false;}
    if(this.model.reset()===false)return false; this.renderCurrent({ title: 'Тестовый баланс восстановлен до 1 000', detail: 'Только тестовые инвентарь, free counter и прошлый результат очищены. Основная игра не изменена.' }); return true;
  }
}
export const demoSlots = new DemoSlots();
