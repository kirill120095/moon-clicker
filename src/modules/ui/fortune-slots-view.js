import { TEMPLE_PAYLINES, TEMPLE_SYMBOLS, TEMPLE_STAKES } from '../game/temple-rules.js';
// Technical wireframe, NOT Prism's final Moon Temple art. No money/RNG/storage.
const SHORT = { ten:'10', jack:'J', queen:'Q', king:'K', ace:'A', crystal:'CR', moon:'MO', guardian:'GD', wild:'W', scatter:'SC' };
export function createTempleWireframeView(root) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const find = name => root.querySelector(`[data-mt-${name}]`), gridNode = find('grid');
  const cells = Array.from({ length: 5 }, (_, reel) => {
    const col = doc.createElement('div'); col.className = 'mt-column'; col.dataset.reel = reel;
    const column = Array.from({ length: 3 }, (_, row) => {
      const cell = doc.createElement('div'); cell.className = 'mt-cell'; cell.dataset.reel = reel; cell.dataset.row = row;
      cell.setAttribute('role','img'); cell.textContent = '—'; col.append(cell); return cell;
    }); gridNode.append(col); return column;
  });
  const pending = new Map(); let epoch = 0, current = null, lineTimer = null, rulesId, fixturesKey = '';
  function invalidate() { epoch++; for (const [id, resolve] of pending) { win.clearTimeout(id); resolve(false); } pending.clear(); win.clearTimeout(lineTimer); lineTimer = null; }
  function wait(ms, token) { return new Promise(resolve => { const id = win.setTimeout(() => { pending.delete(id); resolve(token === epoch); },ms); pending.set(id,resolve); }); }
  function face(reel, column) {
    cells[reel].forEach((cell, row) => { const id = column?.[row]; cell.textContent = SHORT[id] || '—'; cell.dataset.symbol = id || '';
      cell.setAttribute('aria-label', `Барабан ${reel + 1}, строка ${row + 1}: ${id || 'ожидание'}`); });
    gridNode.children[reel].classList.remove('mt-rolling');
  }
  function highlight(index) {
    find('lines').replaceChildren(); cells.flat().forEach(cell => cell.classList.remove('mt-hit'));
    const wins = current?.result?.lineWins || [];
    if (!wins.length) { find('line-info').textContent = '10 фиксированных линий · слева направо'; return; }
    const line = wins[index % wins.length], poly = doc.createElementNS('http://www.w3.org/2000/svg','polyline');
    poly.setAttribute('points',line.rows.map((row,reel)=>`${50+100*reel},${50+100*row}`).join(' ')); find('lines').append(poly);
    line.positions.forEach(({reel,row})=>cells[reel][row].classList.add('mt-hit'));
    find('line-info').textContent = `Линия ${line.lineId}: ${line.symbol} ×${line.count}, gross ${line.gross} (${index % wins.length + 1}/${wins.length})`;
    if (wins.length > 1 && current.visible && !current.busy) lineTimer = win.setTimeout(()=>highlight((index+1)%wins.length),1000);
  }
  function rules(snapshot) {
    const config = snapshot.config;
    if (rulesId === (config?.id || 'pending')) return;
    rulesId = config?.id || 'pending';
    find('paytable').replaceChildren(); find('paylines').replaceChildren();
    for (const rows of TEMPLE_PAYLINES) { const item=doc.createElement('li');item.textContent=rows.join(' – ');find('paylines').append(item); }
    if (!config) { find('paytable').textContent='Финальная таблица выплат ещё не передана. Старые коэффициенты 7×1 здесь не используются.';return; }
    const table=doc.createElement('table'),head=doc.createElement('tr');
    ['ID','3','4','5'].forEach(text=>{const cell=doc.createElement('th');cell.textContent=text;head.append(cell)});table.append(head);
    for (const id of TEMPLE_SYMBOLS.filter(id=>id!=='scatter')) {const row=doc.createElement('tr');[id,...[3,4,5].map(n=>'×'+config.paytable[id][n])].forEach(text=>{const cell=doc.createElement('td');cell.textContent=text;row.append(cell)});table.append(row)}
    find('paytable').append(table);
  }
  function paint(snapshot) {
    current = snapshot; root.dataset.phase = snapshot.phase; root.dataset.testMode = String(snapshot.testMode);
    root.dataset.outcome = snapshot.result?.outcome || 'none';
    root.dataset.celebrate = String(snapshot.result?.celebrate === true); // Presentation may use this; never infer from gross > 0.
    find('warning').textContent = snapshot.testMode
      ? 'ОТЛАДОЧНЫЙ WIREFRAME: искусственные QA-ленты/выплаты, не финальная математика и не арт. Обычный RNG не подменяется fixture без явного выбора.'
      : 'WIREFRAME: окончательные reel strips, paytable и иллюстрированный кабинет ожидаются. Не готово к художественной приёмке.';
    find('migration').hidden = !snapshot.rulesChanged;
    find('migration').textContent = 'Правила изменены: теперь 5×3 и линии. Допустимый старый демо-баланс сохранён, прежние результат и bonus очищены без переоценки.';
    find('balance').textContent=String(snapshot.balance);find('stake').textContent=String(snapshot.stake);
    find('gross').textContent=snapshot.result?String(snapshot.result.creditedGross):'—';
    find('net').textContent=snapshot.result?String(snapshot.result.net):'—';
    find('bonus').textContent=snapshot.mode==='free'
      ? `Бесплатных: ${snapshot.bonus.remaining}. Debit 0; сохранённая ставка ${snapshot.stake}. Каждый spin вручную.`
      : `Бесплатных: ${snapshot.bonus.remaining}. Обычное списание — общая ставка.`;
    find('title').textContent=snapshot.title;find('detail').textContent=snapshot.detail;
    find('spin').disabled=!snapshot.spinAvailable || snapshot.busy;
    find('spin').textContent=!snapshot.ready?'ОЖИДАЕТ CONFIG':snapshot.phase==='spinning'?'ВРАЩЕНИЕ…':snapshot.mode==='free'?'FREE SPIN · 0':'SPIN';
    find('spin').setAttribute('aria-busy',String(snapshot.busy));find('reset').disabled=snapshot.busy;
    const locked=snapshot.busy||snapshot.bonus.remaining>0||!snapshot.ready;
    find('minus').disabled=locked||snapshot.selectedStake===TEMPLE_STAKES[0];find('plus').disabled=locked||snapshot.selectedStake===TEMPLE_STAKES.at(-1);
    cells.forEach((_,reel)=>face(reel,snapshot.grid?.[reel]));
    if(snapshot.phase==='spinning') for(const col of gridNode.children)col.classList.add('mt-rolling');
    const key=snapshot.fixtureIds.join('|');
    if(key!==fixturesKey){fixturesKey=key;find('fixture').replaceChildren();const opt=doc.createElement('option');opt.value='';opt.textContent='Обычный RNG по тестовым лентам';find('fixture').append(opt);for(const id of snapshot.fixtureIds){const o=doc.createElement('option');o.value=id;o.textContent='FIXTURE: '+id;find('fixture').append(o)}}
    find('fixture-wrap').hidden=!snapshot.testMode;find('fixture').disabled=snapshot.busy;
    find('storage').textContent=(snapshot.persistent?'Демо-сохранение в этом браузере.':'Storage недоступен: сессионный демо-режим.')+
      (snapshot.result?.source?.kind==='fixture'?' Результат явно задан FIXTURE: '+snapshot.result.source.id+'.':'');
    rules(snapshot);highlight(0);
  }
  return {
    render(snapshot){invalidate();paint(snapshot);},
    begin(snapshot){invalidate();paint(snapshot);},
    async reveal(snapshot){invalidate();const token=epoch;
      // A meaningful 2.5s base cycle in both full and reduced-motion modes.
      for(let reel=0;reel<5;reel++){if(!await wait(reel===0?1300:300,token))return false;face(reel,snapshot.grid[reel]);}
      if(token!==epoch)return false;paint(snapshot);return true;
    },
    selectedFixture(){return find('fixture').value || undefined;},
    highlightLine(index){win.clearTimeout(lineTimer);highlight(index);},
    cancel(){invalidate();for(const col of gridNode.children)col.classList.remove('mt-rolling');},
    destroy(){this.cancel();}
  };
}
