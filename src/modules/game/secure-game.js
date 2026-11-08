import { maskWheelDelta } from '../ui/currency-display.js';
import { fortuneWheel } from '../ui/moon-wheel-v2.js';
import { gameAdmin } from '../ui/admin.js';
import { gameEngine } from './game.js';
import { appState, state } from '../../core/state.js';
import { CONSTANTS,QUESTS,ACHIEVEMENTS,getBaseDamage,getPrestigeSummary } from '../../core/constants.js';
import { db } from '../network/supabase.js';
import { animations } from '../ui/animations.js';
import { audio } from '../ui/audio.js';
import { radio } from '../ui/radio.js';
import { showToast, updateUI,updateShopUI,updateProfileAndLeaders,updateQuestAndAchievementUI,updateTimerBar,updateHPBar,updateLiveCombatProfile } from '../ui/renderer.js';
let previewHits=[];
function refreshPreview(){gameEngine._previewDamage=previewHits.reduce((sum,hit)=>sum+hit.damage,0);updateHPBar();}
function previewDamage(){
 // Only guaranteed passive damage is predicted. Random crits, heat resets and
 // temporary stacks are applied on confirmation, so same-moon HP cannot rebound.
 const bonus=gameEngine._calculateAllBonuses().totalDamageBonus;
 return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(getBaseDamage(state)*(1+bonus))));
}
let lastRevision=0,lastBuffKey='',ready=false,pendingWheelNotices=[];
function refreshBuffs(){
 const buffs=gameEngine._getActiveBuffs(),key=JSON.stringify(buffs);
 if(key!==lastBuffKey){lastBuffKey=key;gameEngine._updateBuffsDisplay(buffs);}
 return buffs;
}
function renderFleet(count){
 const orbit=document.getElementById('ufoOrbit');if(!orbit)return;
 orbit.classList.toggle('hidden',!count);
 if(orbit.dataset.count===String(count))return;
 const ship=orbit.querySelector('.ufo-ship')?.outerHTML||gameEngine._ufoSvg;
 if(!ship)return;gameEngine._ufoSvg=ship;
 orbit.innerHTML=Array.from({length:count},(_,i)=>'<div class="ufo-position" style="--orbit-angle:'+i*360/count+'deg;transform:rotate('+i*360/count+'deg)"><div class="ufo-satellite">'+ship+'</div></div>').join('');
 orbit.dataset.count=String(count);
}

let nextUfoSync=0,lastErrorToast=0,lastErrorMessage='';
let active=false,pendingClicks=0,flushTimer=null,ticker=null,ping=null,lastClick=0,offset=0,deadline=null,syncing=false,purchasing=false,clickFlight=null,nextBuffSync=0;
let autoClickUntil=0,autoClickTicker=null;
let damageVisualTimer=null;
const damageVisualQueue=[];
const MAX_DAMAGE_VISUAL_QUEUE=12;
function queueDamageVisual(x,y,damage,isCrit,isBoss){
 if(document.hidden)return;
 if(damageVisualQueue.length>=MAX_DAMAGE_VISUAL_QUEUE){
  const ordinary=damageVisualQueue.findIndex(hit=>!hit.isCrit);
  damageVisualQueue.splice(ordinary>=0?ordinary:0,1);
 }
 damageVisualQueue.push({x,y,damage,isCrit,isBoss});
 if(damageVisualTimer===null)damageVisualTimer=setInterval(()=>{
  if(document.hidden){clearDamageVisuals();return;}
  const hit=damageVisualQueue.shift();
  if(hit)animations.showDamageNumber(hit.x,hit.y,hit.damage,hit.isCrit,hit.isBoss);
  if(!damageVisualQueue.length)clearDamageVisuals();
 },135);
}
function clearDamageVisuals(){damageVisualQueue.length=0;if(damageVisualTimer!==null)clearInterval(damageVisualTimer);damageVisualTimer=null;}
const AUTO_CLICK_BATCH_MS=300; // Server requests stay batched; the same click handler runs immediately for each hit.
function autoClickDuration(){return 15000+15000*Math.max(0,Math.floor(state.prestige?.upgrades?.autoclick||0));}
function renderAutoClick(){
 const button=document.getElementById('autoClickBtn'),stopButton=document.getElementById('autoClickStopBtn'),label=document.getElementById('autoClickLabel'),timer=document.getElementById('autoClickTimer');
 const left=Math.max(0,autoClickUntil-Date.now()),running=active&&left>0;
 if(button){button.classList.toggle('active',running);button.setAttribute('aria-label',running?'Обновить время автокликов':'Запустить автоклики');button.title='Автоклики: '+Math.round(autoClickDuration()/1000)+' с. Повторное нажатие сбрасывает таймер.';}
 if(stopButton){stopButton.disabled=!running;stopButton.setAttribute('aria-disabled',String(!running));}
 if(label)label.textContent=running?'Продлить':'Автоклик';
 if(timer)timer.textContent=((running?left:autoClickDuration())/1000).toFixed(1)+'с';
}
function stopAutoClick(flushPending=true){autoClickUntil=0;if(autoClickTicker!==null){clearInterval(autoClickTicker);autoClickTicker=null;}renderAutoClick();if(flushPending&&active&&pendingClicks&&!clickFlight)flush().catch(()=>{});}
function autoClickStep(){
 if(!active||Date.now()>=autoClickUntil){stopAutoClick();return;}
 // Reuse the exact same click path as a held Space key; no synthetic DOM event or focus changes.
 const rect=document.getElementById('moonWrapper')?.getBoundingClientRect();
 if(!rect)return;
 gameEngine.handleClick({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2},true);
}
gameEngine.activateAutoClick=()=>{
 if(!active)return;
 autoClickUntil=Date.now()+autoClickDuration();
 if(autoClickTicker===null)autoClickTicker=setInterval(autoClickStep,19);
 renderAutoClick();
};
const autoButton=document.getElementById('autoClickBtn');
autoButton?.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault();});
autoButton?.addEventListener('click',()=>gameEngine.activateAutoClick());
const autoStopButton=document.getElementById('autoClickStopBtn');
autoStopButton?.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault();});
autoStopButton?.addEventListener('click',()=>{if(autoClickUntil>Date.now())stopAutoClick();});
// Suppress space-to-shoot while automatic clicks are running, but preserve typing in forms.
document.addEventListener?.('keydown',e=>{if(e.code==='Space'&&autoClickUntil>Date.now()&&!e.target?.closest?.('input,textarea,[contenteditable="true"]')){e.preventDefault();e.stopImmediatePropagation();}},true);
renderAutoClick();
function apply(result,hits=[],deferNotices=false){
 const s=result.state;if(!s)throw Error('Сервер не вернул прогресс');
 if(result.revision&&result.revision<=lastRevision)return;
 lastRevision=result.revision||lastRevision;
 if(s.resetId&&state.user?.id)try{
  const key='moon_progress_reset_'+state.user.id;
  if(localStorage.getItem(key)!==s.resetId){localStorage.removeItem('moon_completed_'+state.user.id);localStorage.setItem(key,s.resetId);}
 }catch{}
 const previousQuests=state.quests||{},previousAchievements=state.achievements||{};
 const rect=document.getElementById('moonWrapper')?.getBoundingClientRect();
 offset=result.serverNow-Date.now();deadline=s.bossDeadline;gameEngine.combat._totalDuration=s.bossDuration||CONSTANTS.BOSS_TIMER;
 appState.setMany({runtime:{...(s.runtime||{})},lastClickAt:s.lastClickAt,lastAutoClickAt:s.lastAutoClickAt||0,lastComboAt:s.lastComboAt,serverClockOffset:offset,prestige:s.prestige,prestigeSummary:s.prestigeSummary,inventory:s.inventory,lunarLuck:s.lunarLuck,wheelEconomy:s.wheelEconomy||{},runMaxLevel:s.runMaxLevel,moonSerial:s.moonSerial,ufoCount:s.ufoCount||0,ufoComboRelay:!!s.ufoComboRelay,gameCompleted:s.gameCompleted,maxLevel:s.maxLevel,ufoLevel:s.ufoLevel||0,ufoDamage:s.ufoDamage,ufoInterval:s.ufoInterval,ufoNextShotAt:s.ufoNextShotAt,finalDamage:s.finalDamage,finalCritChance:s.finalCritChance,moonReward:s.moonReward,ufoMoonReward:s.ufoMoonReward,currentLevel:s.currentLevel,moonHP:s.moonHP,maxHP:s.maxHP,
 clickCount:s.clickCount,runClickCount:s.runClickCount??s.clickCount,totalSecondsPlayed:s.totalSecondsPlayed,playerData:{...s.playerData,level:s.currentLevel,total_clicks:s.clickCount,total_seconds_played:s.totalSecondsPlayed},
 pendingEchoes:s.echoPending||0,cloneTargets:s.cloneTargets||[],clickCrystalLevel:s.clickCrystalLevel||0,activeMoon:s.activeMoon,activeMoons:s.activeMoons,ownedMoons:s.ownedMoons,moonLevels:s.moonLevels,
 maxSlots:s.maxSlots,moonKills:s.moonKills||0,bossKills:s.bossKills,quests:s.quests,achievements:s.achievements,
 levelLocked:s.levelLocked,testMode:false,bossTimerRunning:!!deadline,
 bossTimer:deadline?Math.max(0,(deadline-result.serverNow)/1000):30});
 Object.assign(gameEngine,s.runtime||{});
 gameEngine._lastActivityTime=Math.max(s.lastClickAt||0,s.lastAutoClickAt||0)?Math.max(s.lastClickAt||0,s.lastAutoClickAt||0)-offset:Date.now();
 gameEngine._lastComboTime=Math.max(s.lastClickAt||0,s.lastAutoClickAt||0,s.lastComboAt||0)-offset;
 gameEngine.recalcMoonBonuses(false);refreshBuffs();updateUI();updateShopUI();updateQuestAndAchievementUI();renderAutoClick();
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохранено на сервере';
 updateLiveCombatProfile();
 renderFleet(s.ufoCount||(s.ufoLevel?1:0));renderItemInventory();
 const announce=message=>{if(deferNotices)pendingWheelNotices=[...pendingWheelNotices,message].slice(-32);else showToast(message,'success',3500);};
 if(ready){
  for(const [id,q]of Object.entries(s.quests||{}))if(q.completed&&!previousQuests[id]?.completed)announce('🎯 Квест выполнен: '+(QUESTS[id]?.name||id));
  for(const [id,tiers]of Object.entries(s.achievements||{}))for(const [tier,status]of Object.entries(tiers))if(status==='unclaimed'&&!previousAchievements[id]?.[tier])announce('🏆 '+(ACHIEVEMENTS[id]?.tiers.find(t=>t.level===tier)?.name||id));
 }
 ready=true;

 let index=0,visibleDamage=0;
 const autoBatch=hits.some(hit=>hit.automatic);
 for(const event of s.effects||[]){
  if(!rect)continue;
  const position=event.source==='manual'?hits[index++]:null;
  // Avoid hundreds of animated DOM nodes per batch, but always retain critical hits.
  if(event.source==='manual'&&autoBatch){
    // The optimistic auto-click animation has no crit information. Show confirmed critical hits.
    if(event.isCrit){queueDamageVisual(position?.x??rect.x+rect.width/2,position?.y??rect.y+rect.height/2,event.damage,true,event.isBoss);visibleDamage++;}
   }else if(event.source==='manual'&&hits.length>1){
   if(visibleDamage<8||event.isCrit){queueDamageVisual(position?.x??rect.x+rect.width/2,position?.y??rect.y+rect.height/2,event.damage,event.isCrit,event.isBoss);visibleDamage++;}
  }else if(visibleDamage<12||event.isCrit){animations.showDamageNumber(position?.x??rect.x+rect.width/2,position?.y??rect.y+rect.height/2,event.damage,event.isCrit,event.isBoss);visibleDamage++;}
  if(event.source==='ufo'){animations.playUfoShot(event.ufoIndex||0);audio.shoot(true);}
  if(event.reward>0)animations.showMoonReward(event.reward);
 }

}
async function send(action,payload={}){
 const generation=initGeneration;
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохраняем…';
 try{const result=await db.action(action,payload);
  if(!active||generation!==initGeneration)return result;
  const hits=action==='click'?previewHits.splice(0,payload.count):[];
  gameEngine._previewDamage=previewHits.reduce((sum,hit)=>sum+hit.damage,0);
  if(action==='spinWheel')maskWheelDelta(result.state?.wheelResult?.delta||0);
  if(active)apply(result,hits,action==='spinWheel');return result;}
 catch(error){if(generation!==initGeneration||!active)throw error;if(action==='click'){previewHits.splice(0,payload.count);refreshPreview();}if(status)status.textContent='Нет связи — действие не подтверждено';if(error.message!==lastErrorMessage||Date.now()-lastErrorToast>5000){showToast(error.message,'warning');lastErrorMessage=error.message;lastErrorToast=Date.now();}throw error;}
}
async function flush(){
 if(flushTimer){clearTimeout(flushTimer);flushTimer=null;}
 if(clickFlight)return clickFlight;
 if(!active||pendingClicks===0)return;
 const count=Math.min(CONSTANTS.CLICK_BURST,pendingClicks);pendingClicks-=count;
 clickFlight=send('click',{count}).finally(()=>{
  clickFlight=null;
  if(active&&pendingClicks&&!flushTimer)flushTimer=setTimeout(()=>flush().catch(()=>{}),autoClickUntil>Date.now()?AUTO_CLICK_BATCH_MS:0);
 });
 return clickFlight;
}
async function command(action,payload={},purchase=false){
 if(!active||purchasing)return;
 if(fortuneWheel.busy&&action!=='spinWheel'){showToast('Дождитесь окончания вращения','info');return;}
 purchasing=true;
 try{do{await flush();}while(active&&pendingClicks>0);const result=await send(action,payload);if(action==='claimAllQuests'||action==='claimAllAchievements'){updateQuestAndAchievementUI(true);const summary=result?.state?.claimSummary;if(summary)showToast('Получено '+summary.count+' наград: +'+summary.reward.toLocaleString('ru-RU')+' 💎','success',3500);}if(action==='ascend'){updateQuestAndAchievementUI(true);try{localStorage.removeItem('moon_completed_'+state.user?.id);}catch{}}if(purchase)audio.purchase();updateProfileAndLeaders();return result;}
 finally{purchasing=false;}
}
let initializing=null,initGeneration=0;
const oldDestroy=gameEngine.destroy.bind(gameEngine);
gameEngine.init=()=>{
 if(initializing)return initializing;
 const generation=++initGeneration;
 const pending=(async()=>{
 active=true;ready=false;pendingWheelNotices=[];lastRevision=0;lastBuffKey='';gameEngine._isRunning=true;
 db.leaderboardPresence?.start(state.user?.id).catch(()=>{});
 try{const loaded=await db.action('load');if(generation!==initGeneration||!active)throw Object.assign(Error('Загрузка отменена'),{code:'LOAD_CANCELLED'});apply(loaded);}catch(error){if(generation===initGeneration){active=false;gameEngine._isRunning=false;}throw error;}
 radio.connect(state.user).catch(()=>{});
 fortuneWheel.bind(payload=>command('spinWheel',payload),()=>{for(const message of pendingWheelNotices)showToast(message,'success',3500);pendingWheelNotices=[];updateUI();updateShopUI();updateProfileAndLeaders();});fortuneWheel.connect(true);
 gameAdmin.connect(state.user).catch(()=>{});
 if(ticker)clearInterval(ticker);if(ping)clearInterval(ping);
 let lastPrestigeDay=Math.floor((Date.now()+offset+10800000)/86400000);
 ticker=setInterval(()=>{
  if(!active)return;
  const prestigeDay=Math.floor((Date.now()+offset+10800000)/86400000);
  if(prestigeDay!==lastPrestigeDay){lastPrestigeDay=prestigeDay;updateShopUI();updateProfileAndLeaders();}
  const activeBuffs=refreshBuffs();updateLiveCombatProfile();
  if(((state.ufoLevel&&state.ufoNextShotAt<=Date.now()+offset)||state.pendingEchoes>0)&&!document.hidden&&!syncing&&!clickFlight&&!pendingClicks&&Date.now()>=nextUfoSync){
   nextUfoSync=Date.now()+250;syncing=true;
   send('sync').catch(()=>{}).finally(()=>{syncing=false;});
  }
  const expired=activeBuffs.some(buff=>buff.isTemporary&&buff.timeLeft===0);
  if(expired&&!syncing&&!clickFlight&&!pendingClicks&&Date.now()>=nextBuffSync){
   nextBuffSync=Date.now()+2000;syncing=true;
   send('sync').catch(()=>{}).finally(()=>{syncing=false;});
  }
  if(deadline){appState.set('bossTimer',Math.max(0,(deadline-Date.now()-offset)/1000));updateTimerBar();
   if(deadline<=Date.now()+offset&&!syncing&&!clickFlight&&!pendingClicks){syncing=true;send('sync').catch(()=>{}).finally(()=>{syncing=false;});}}
 },250);
 ping=setInterval(()=>{if(active&&!document.hidden&&!clickFlight&&!pendingClicks&&!syncing)send('sync').catch(()=>{});},20000);
 updateProfileAndLeaders();
 })();
 const tracked=pending.finally(()=>{if(initializing===tracked)initializing=null;});initializing=tracked;return tracked;
};
gameEngine.destroy=()=>{db.leaderboardPresence?.stop();stopAutoClick(false);clearDamageVisuals();initGeneration++;initializing=null;gameAdmin.disconnect();fortuneWheel.disconnect();radio.disconnect();active=false;ready=false;pendingWheelNotices=[];lastRevision=0;pendingClicks=0;previewHits=[];gameEngine._previewDamage=0;clearTimeout(flushTimer);clearInterval(ticker);clearInterval(ping);flushTimer=null;ticker=null;ping=null;oldDestroy();};
gameEngine.handleClick=(e,automatic=false)=>{
 if(!active||purchasing||performance.now()-lastClick<1000/CONSTANTS.MAX_CLICKS_PER_SECOND+1)return;lastClick=performance.now();
 if(pendingClicks>=CONSTANTS.CLICK_BURST)return;
 pendingClicks++;previewHits.push({damage:previewDamage(),x:e.clientX,y:e.clientY,automatic});
 // Keep the HP bar in lockstep with each accepted hit, just like holding Space.
 // This only updates the local visual preview; the server still owns actual damage.
 refreshPreview();
 if(!automatic||!document.hidden)audio.click();
 animations.playClickVisualFeedback(e,state.finalDamage||previewDamage(),false,state.currentLevel%CONSTANTS.BOSS_INTERVAL===0,automatic);
 if(automatic){if(!clickFlight&&!flushTimer)flushTimer=setTimeout(()=>flush().catch(()=>{}),AUTO_CLICK_BATCH_MS);}
 else if(!clickFlight)flush().catch(()=>{});
};
gameEngine._saveProgress=async()=>{do{await flush();}while(active&&pendingClicks>0);if(active)await send('sync');};
gameEngine.buyClickCrystal=(max=false)=>command('buyClickCrystal',{max},true).catch(()=>{});
gameEngine.setCloneTargets=targets=>command('setCloneTargets',{targets}).catch(()=>{});
gameEngine.buyClickDamage=(max=false)=>command('buyDamage',{max},true).catch(()=>{});
gameEngine.ascend=()=>{const summary=getPrestigeSummary(state);if(summary.dailyAscensionsLeft===0){showToast('Лимит: 3 вознесения в день. Обновление в 00:00 МСК','info');return;}if(!summary.canAscend){showToast('Вознесение недоступно: достигните '+CONSTANTS.PRESTIGE.COIN_EVERY+' уровня в этом прохождении','info');return;}const modal=document.getElementById('ascensionModal');if(!modal)return;
 const coins=modal.querySelector('#ascensionModalCoins'),accept=modal.querySelector('#ascensionModalConfirm');
 if(coins)coins.textContent='🌟 '+summary.pendingCoins;
 const close=()=>{modal.classList.add('hidden');modal.removeEventListener('keydown',onKey);};
 const onKey=event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab'){const buttons=[...modal.querySelectorAll('button:not([disabled])')];const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
 modal.querySelectorAll('[data-ascension-cancel]').forEach(el=>el.onclick=close);
 if(accept){accept.disabled=false;accept.onclick=()=>{accept.disabled=true;close();command('ascend').catch(()=>{});};}
 modal.classList.remove('hidden');modal.addEventListener('keydown',onKey);modal.querySelector('button[data-ascension-cancel]')?.focus();};
gameEngine.buyPrestige=(id,max=false)=>command('buyPrestige',{id,max},true).catch(()=>{});
gameEngine.buyUfoComboRelay=()=>command('buyUfoComboRelay',{},true).catch(()=>{});
gameEngine.buyUfoUnit=(max=false)=>command('buyUfoUnit',{max},true).catch(()=>{});
gameEngine.buyUfo=(max=false)=>command('buyUfo',{max},true).catch(()=>{});
gameEngine.rollbackFive=()=>command('rollbackFive').catch(()=>{});
 const jumpForm=document.getElementById('jumpLevelForm'),jumpInput=document.getElementById('jumpLevelInput');
 if(jumpForm&&jumpInput)jumpForm.addEventListener('submit',event=>{
  event.preventDefault();
  const raw=jumpInput.value.trim(),level=Number(raw),limit=Math.max(1,state.runMaxLevel||state.currentLevel);
  if(!raw||!Number.isSafeInteger(level)||level<1||level>limit){showToast('Введите открытый уровень от 1 до '+limit,'info');return;}
  if(level===state.currentLevel){showToast('Вы уже на этом уровне','info');return;}
  command('jumpToLevel',{level}).then(()=>{jumpInput.value='';}).catch(()=>{});
 });
gameEngine.returnToRecord=()=>command('returnToRecord').catch(()=>{});
gameEngine.buySlot=(max=false)=>command('buySlot',{max},true).catch(()=>{});
gameEngine.buyMoon=id=>command('buyMoon',{id},true).catch(()=>{});
gameEngine.upgradeMoon=(id,max=false)=>command('upgradeMoon',{id,max},true).catch(()=>{});
gameEngine.toggleMoonActive=id=>command('toggleMoon',{id}).catch(()=>{});
gameEngine.rollbackLevel=()=>command('rollback').catch(()=>{});
gameEngine.toggleLevelLock=()=>command('lock').catch(()=>{});
function collectAll(action,id){
 const button=document.getElementById(id);if(button?.dataset.pending==='1')return;
 if(button){button.dataset.pending='1';button.disabled=true;}
 return command(action,{},true).catch(()=>{}).finally(()=>{if(button)delete button.dataset.pending;updateQuestAndAchievementUI(true);});
}
gameEngine.claimAllQuests=()=>collectAll('claimAllQuests','claimAllQuestsBtn');
gameEngine.claimAllAchievements=()=>collectAll('claimAllAchievements','claimAllAchievementsBtn');
gameEngine.claimQuestReward=id=>command('claimQuest',{id},true).catch(()=>{});
gameEngine.claimAchievementReward=(id,tier)=>command('claimAchievement',{id,tier},true).catch(()=>{});
gameEngine.resetProgress=()=>command('reset');
// Lunar Luck is earned through moon defeats, independently of casino bets.
window.claimLunarLuck=()=>command('claimLunarLuck');

const ITEM_NAMES={moonstone:'Лунный камень',orbit:'Кольцо орбиты',comet:'Осколок кометы',starlight:'Звёздный амулет'};
let selectedInventoryItemId=null;
const ITEM_ICONS={moonstone:'🌙',orbit:'🪐',comet:'☄️',starlight:'✨'};
function renderItemInventory(){
 const tab=document.getElementById('inventoryMount');if(!tab)return;
 let host=document.getElementById('moonInventory');
 if(!host){host=document.createElement('section');host.id='moonInventory';host.className='moon-inventory';tab.append(host);}
 const inv=state.inventory||{capacity:20,keepLimit:3,items:[]},items=inv.items||[];
 const kept=items.filter(i=>i.keep).length;
 if(!items.some(i=>i.id===selectedInventoryItemId))selectedInventoryItemId=null;
 host.replaceChildren();
 const title=document.createElement('h3');title.textContent='🎒 Лунный инвентарь';host.append(title);
 const status=document.createElement('p');status.className='moon-inventory-status';status.textContent=items.length+' / '+inv.capacity+' слотов занято · Сохранение: '+kept+' / '+inv.keepLimit;host.append(status);
 const selected=items.find(i=>i.id===selectedInventoryItemId);
 const info=document.createElement('section');info.className='moon-inventory-info';host.append(info);
 if(selected){
  const itemName=(ITEM_NAMES[selected.type]||selected.type);
  const heading=document.createElement('h4');heading.textContent=(ITEM_ICONS[selected.type]||'💠')+' '+itemName+' · редкость '+selected.rarity;info.append(heading);
  const descriptions={moonstone:'Кристалл, впитавший свет древних лун.',orbit:'Артефакт, удерживающий энергию лунной орбиты.',comet:'Осколок странствующей кометы с космической энергией.',starlight:'Амулет, наполненный сиянием далёких звёзд.'};
  const description=document.createElement('p');description.textContent=descriptions[selected.type]||'Загадочный лунный артефакт.';info.append(description);
  const effect=document.createElement('p');effect.className='moon-inventory-effect';effect.textContent='Эффект: пока не активен. Бонусы предметов появятся вместе с экипировкой на луны.';info.append(effect);
  const flags=document.createElement('p');flags.textContent='Осколки при разборе: '+(2**(selected.rarity-1))+' · '+(selected.locked?'🔒 Защищён':'Без защиты')+' · '+(selected.keep?'★ Сохранится при перерождении':'Не выбран для сохранения');info.append(flags);
 }else{
  const heading=document.createElement('h4');heading.textContent='✧ Выбери предмет';info.append(heading);
  const description=document.createElement('p');description.textContent='Нажми на занятый слот, чтобы увидеть описание, редкость и доступные действия.';info.append(description);
 }
 const grid=document.createElement('div');grid.className='moon-inventory-grid';grid.setAttribute('aria-label','Слоты инвентаря');host.append(grid);
 for(let index=0;index<inv.capacity;index++){
  const item=items[index];
  const slot=document.createElement('button');slot.type='button';slot.className='moon-inventory-slot'+(item?' occupied':' empty')+(item?.id===selectedInventoryItemId?' selected':'');
  if(item){
   const icon=document.createElement('span');icon.className='moon-slot-icon';icon.textContent=ITEM_ICONS[item.type]||'💠';slot.append(icon);
   const level=document.createElement('span');level.className='moon-slot-rarity';level.textContent='+'+item.rarity;slot.append(level);
   if(item.locked){const lock=document.createElement('span');lock.className='moon-slot-lock';lock.textContent='🔒';slot.append(lock);}
   if(item.keep){const keep=document.createElement('span');keep.className='moon-slot-keep';keep.textContent='★';slot.append(keep);}
   slot.title=(ITEM_NAMES[item.type]||item.type)+' · редкость '+item.rarity;
   slot.setAttribute('aria-label',slot.title);
   slot.setAttribute('aria-pressed',String(item.id===selectedInventoryItemId));
   slot.onclick=()=>{selectedInventoryItemId=selectedInventoryItemId===item.id?null:item.id;renderItemInventory();};
  }else{slot.disabled=true;slot.setAttribute('aria-label','Пустой слот '+(index+1));}
  grid.append(slot);
 }
 if(!selected){const hint=document.createElement('p');hint.className='moon-inventory-hint';hint.textContent=items.length?'Нажми на предмет, чтобы открыть действия.':'Пусто. Предмет выдаётся за каждый третий сбор Лунной удачи.';host.append(hint);return;}
 const details=document.createElement('section');details.className='moon-inventory-details';host.append(details);
 const name=document.createElement('strong');name.textContent=(ITEM_ICONS[selected.type]||'💠')+' '+(ITEM_NAMES[selected.type]||selected.type)+' · редкость '+selected.rarity;details.append(name);
 const buttons=document.createElement('div');buttons.className='moon-inventory-actions';details.append(buttons);
 const act=(action,payload)=>command(action,payload).catch(()=>{});
 function add(label,action,payload,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=()=>act(action,payload);buttons.append(b);}
 add(selected.locked?'🔒 Снять защиту':'🔓 Защитить','lockItem',{id:selected.id});
 add(selected.keep?'★ Не сохранять':'☆ Сохранить','keepItem',{id:selected.id},!selected.keep&&kept>=inv.keepLimit);
 const partner=items.find(i=>i.id!==selected.id&&i.type===selected.type&&i.rarity===selected.rarity&&!i.locked);
 add('✦ Объединить','mergeItems',{id:selected.id,otherId:partner?.id},selected.locked||!partner);
 const salvage=document.createElement('button');salvage.type='button';salvage.textContent='Разобрать · +'+(2**(selected.rarity-1))+' оск.';salvage.disabled=!!selected.locked;salvage.onclick=()=>openInventorySalvage(selected);buttons.append(salvage);
}

function openInventorySalvage(item){
 const modal=document.getElementById('inventorySalvageModal');if(!modal)return;
 const name=ITEM_NAMES[item.type]||item.type;
 modal.querySelector('#inventorySalvageMessage').textContent='«'+name+'» (редкость '+item.rarity+') исчезнет навсегда. Ты получишь '+(2**(item.rarity-1))+' лунных осколков. Отменить разбор нельзя.';
 const confirmButton=modal.querySelector('#inventorySalvageConfirm');
 const cancel=()=>{modal.classList.add('hidden');modal.removeEventListener('keydown',onKey);};
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
 modal.querySelectorAll('[data-inventory-salvage-cancel]').forEach(b=>b.onclick=cancel);
 confirmButton.disabled=false;
 confirmButton.onclick=()=>{confirmButton.disabled=true;cancel();command('salvageItem',{id:item.id}).catch(()=>{});};
 modal.classList.remove('hidden');modal.addEventListener('keydown',onKey);confirmButton.focus();
}

function updateLunarLuckWidget(){
 const host=document.querySelector('#shopPanel .panel-content');if(!host)return;
 let el=document.getElementById('lunarLuckWidget');
 if(!el){el=document.createElement('section');el.id='lunarLuckWidget';el.style.cssText='padding:14px;margin:12px 0;border:1px solid #7565a8;border-radius:12px;background:#17182b;color:#f4ecff';host.prepend(el);}
 const luck=state.lunarLuck||{},progress=Math.max(0,Math.min(100,luck.progress||0));
 el.innerHTML='<strong>🌙 Лунная удача — '+progress.toFixed(2)+'%</strong><div style="height:10px;border-radius:9px;background:#34334b;margin:10px 0;overflow:hidden"><div style="width:'+progress+'%;height:100%;background:#aa8cf4"></div></div><small>Лунный резонанс: награда зависит от времени победы, сложности луны и частоты уничтожений. Слабые луны дают меньше. Награда: 1 Лунная пыль.</small><p style="margin:8px 0">Лунная пыль: '+(luck.dust||0)+'</p><button type="button" id="claimLunarLuckButton" '+(progress<100?'disabled':'')+'>Забрать награду</button>';
 el.querySelector('button').onclick=()=>window.claimLunarLuck?.();
}
state.subscribe?.('lunarLuck',updateLunarLuckWidget);
setInterval(updateLunarLuckWidget,2000);

gameEngine.toggleTestMode=()=>showToast('Тестовый режим отключён в защищённом сезоне','info');

const moonButton=document.getElementById('moonWrapper');moonButton?.addEventListener('keydown',e=>{if(e.code==='Space'&&autoClickUntil>Date.now()){e.preventDefault();return;}if(e.code==='Space'||e.code==='Enter'){e.preventDefault();const r=moonButton.getBoundingClientRect();gameEngine.handleClick({clientX:r.x+r.width/2,clientY:r.y+r.height/2});}});
