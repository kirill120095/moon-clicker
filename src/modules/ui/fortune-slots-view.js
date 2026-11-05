import { LUNAR_CSS, createLunarTempleView } from './lunar-temple-runtime.mjs';
import { TEMPLE_CANDIDATE_GEOMETRY } from '../game/temple-candidate-geometry.js';
import { templeGridFromStops, TEMPLE_STAKES } from '../game/temple-rules.js';

// Adapter only: the runtime has no RNG, wallet, inventory grant or server authority.
export function createTempleWireframeView(root) {
  const doc=root.ownerDocument,find=name=>root.querySelector(`[data-mt-${name}]`);
  if(!doc.getElementById('lunar-temple-runtime-style')){const style=doc.createElement('style');style.id='lunar-temple-runtime-style';style.textContent=LUNAR_CSS;doc.head.append(style);}
  let current=null,disposed=false,fixtureKey='',confirmCallback=null;
  const panel=find('bag-panel'),inventoryButton=root.querySelector('[data-lt-inventory]');
  const runtime=createLunarTempleView(root,{onSpin:()=>{},onInventory:()=>{panel.open=!panel.open;inventoryButton.setAttribute('aria-expanded',String(panel.open));if(panel.open)panel.scrollIntoView({block:'nearest',behavior:'auto'});}});
  const closeConfirm=()=>{confirmCallback=null;find('reset-dialog').close();};
  const acceptConfirm=()=>{const callback=confirmCallback;closeConfirm();callback?.();};
  find('reset-cancel').addEventListener('click',closeConfirm);find('reset-accept').addEventListener('click',acceptConfirm);
  function adapt(snapshot) {
    const local=snapshot.walletMode==='test-items'||snapshot.testMode===true;
    const result=snapshot.result;
    const grid=snapshot.grid || templeGridFromStops(TEMPLE_CANDIDATE_GEOMETRY,[0,0,0,0,0]);
    const busy=snapshot.busy||snapshot.phase==='spinning'||snapshot.phase==='requesting';
    const awards=snapshot.awardedItems || [];
    return {grid,mode:local?'demo':'live',phase:busy?'spinning':!snapshot.spinAvailable&&!result?'insufficient':awards.length?'win':result?'loss':'idle',
      canSpin:snapshot.spinAvailable&&!busy,balance:snapshot.balance,stake:snapshot.stake,freeSpins:snapshot.bonus?.remaining||0,
      inventoryCount:snapshot.inventoryItems?.reduce((sum,item)=>sum+item.quantity,0),visible:snapshot.visible,
      lineWins:(result?.lineWins||[]).map(line=>({lineId:line.lineId,rows:[...line.rows],length:line.count})),
      awardedItems:awards.map(item=>({id:item.itemDefinitionId,name:item.displayName||item.itemDefinitionId,level:item.level||1,quantity:item.quantity,symbolId:'moon'})),
      message:[snapshot.title,snapshot.detail].filter(Boolean).join(' · ')};
  }
  function extras(snapshot) {
    current=snapshot;root.dataset.mode=snapshot.walletMode==='test-items'||snapshot.testMode===true?'demo':'live';
    const local=snapshot.walletMode==='test-items'||snapshot.testMode===true;
    find('inventory-title').textContent=local?'Тестовый инвентарь':'Инвентарь аккаунта · подтверждён сервером';
    find('bag-status').textContent=snapshot.inventoryItems===null?'Инвентарь ещё не подтверждён.':`Версия ${snapshot.inventoryVersion??0} · партий ${(snapshot.inventoryItems||[]).length}`;
    find('bag').replaceChildren();
    for(const item of (snapshot.inventoryItems||[]).slice(0,100)){const li=doc.createElement('li');li.textContent=`${item.displayName||item.itemDefinitionId} · ур. ${item.level||1} · ×${item.quantity}`;find('bag').append(li);}
    const locked=snapshot.busy||snapshot.bonus.remaining>0||!snapshot.ready;
    find('minus').disabled=locked||snapshot.selectedStake===TEMPLE_STAKES[0];find('plus').disabled=locked||snapshot.selectedStake===TEMPLE_STAKES.at(-1);
    find('reset').hidden=!local;find('reset').disabled=snapshot.busy||snapshot.resetAvailable===false;
    find('stake-label').textContent=`${local?'Тестовая':'Общая'} ставка ${snapshot.stake}`;
    find('storage').textContent=local?(snapshot.readOnly?'Сохранение неизвестной версии: только чтение, запись и reset запрещены.':snapshot.persistent?'Тестовые фишки и предметы сохранены отдельно на этом устройстве.':'В этом просмотре хранилище недоступно: сессионный режим, reload не сохраняет прогресс. Для сохранения используйте обычный HTTP-origin.'): 'Реальные данные — только от проверенного сервера. Демо не конвертируется в аккаунт.';
    find('rules-copy').textContent=local?'ТЕСТОВЫЙ РЕЖИМ. Временный candidate mapping; не живой реестр экипировки. Reset очищает только фишки, предметы и free counter этого демо.':'Аккаунтный режим требует server-only allowlist, зарегистрированный item policy и отдельный release. Demo-тип запрещён.';
    const key=(snapshot.fixtureIds||[]).join('|');
    if(key!==fixtureKey){fixtureKey=key;const select=find('fixture');select.replaceChildren();const normal=doc.createElement('option');normal.value='';normal.textContent='Обычный RNG';select.append(normal);for(const id of snapshot.fixtureIds){const option=doc.createElement('option');option.value=id;option.textContent='FIXTURE: '+id;select.append(option);}}
    find('fixture-wrap').hidden=!local||!(snapshot.fixtureIds||[]).length;find('fixture').disabled=snapshot.busy;
  }
  return {
    get destroyed(){return disposed;},
    render(snapshot){if(disposed)return;runtime.render(adapt(snapshot));extras(snapshot);},
    begin(snapshot){if(disposed)return false;const accepted=runtime.begin({...adapt(snapshot),phase:'spinning'});extras(snapshot);return accepted;},
    async reveal(snapshot){if(disposed)return false;const shown=await runtime.reveal(adapt({...snapshot,busy:false}));if(shown&&!disposed)extras(snapshot);return shown;},
    selectedFixture(){return find('fixture').value||undefined;},
    highlightLine(index){runtime.highlightLine(index);},
    confirmReset(callback){confirmCallback=callback;find('reset-warning').textContent=`Будут удалены все тестовые предметы и ${current?.bonus?.remaining||0} бесплатных вращений. Баланс этого демо станет1000. Основная игра не изменится.`;find('reset-dialog').showModal();},
    cancel(){if(!disposed)runtime.cancel();},
    destroy(){if(disposed)return;runtime.destroy();disposed=true;closeConfirm();find('reset-cancel').removeEventListener('click',closeConfirm);find('reset-accept').removeEventListener('click',acceptConfirm);}
  };
}
