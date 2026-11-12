import { maskWheelDelta } from '../ui/currency-display.js';
import { fortuneWheel } from '../ui/moon-wheel-v2.js';
import { gameAdmin } from '../ui/admin.js';
import { gameEngine } from './game.js';
import { appState, state } from '../../core/state.js';
import { CONSTANTS,MOON_TYPES,QUESTS,ACHIEVEMENTS,getBaseDamage,getPrestigeSummary } from '../../core/constants.js';
import { ITEM_TYPES,ITEM_SHOP_COST,ITEM_MAX_LEVEL,getItemProperties,formatItemProperty,getItemSalvageDust,getEquippedItems } from '../../core/constants.js';
import { db } from '../network/supabase.js';
import { animations } from '../ui/animations.js';
import { audio } from '../ui/audio.js';
import { radio } from '../ui/radio.js';
import { showToast, updateUI,updateShopUI,updateProfileAndLeaders,updateQuestAndAchievementUI,updateTimerBar,updateHPBar,updateLiveCombatProfile } from '../ui/renderer.js';
let previewHits=[];
function refreshPreview(){gameEngine._previewDamage=previewHits.reduce((sum,hit)=>sum+hit.damage,0);updateHPBar();}
let equipmentPreviewFactor=1;
function previewDamage(){
 // Only guaranteed passive damage is predicted. Random crits, heat resets and
 // temporary stacks are applied on confirmation, so same-moon HP cannot rebound.
 const bonus=gameEngine._calculateAllBonuses().totalDamageBonus;
 const damage=Math.round(getBaseDamage(state)*(1+bonus));
 return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(damage*equipmentPreviewFactor)));
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
function queueDamageVisual(x,y,damage,isCrit,isBoss,fromClick){
 if(document.hidden)return;
 if(damageVisualQueue.length>=MAX_DAMAGE_VISUAL_QUEUE){
  const ordinary=damageVisualQueue.findIndex(hit=>!hit.fromClick&&!hit.isCrit);
  const secondary=ordinary>=0?ordinary:damageVisualQueue.findIndex(hit=>!hit.fromClick);
  if(secondary>=0)damageVisualQueue.splice(secondary,1);
  else if(!fromClick)return;
 }
 damageVisualQueue.push({x,y,damage,isCrit,isBoss,fromClick});
 if(damageVisualTimer===null)damageVisualTimer=setInterval(()=>{
  if(document.hidden){clearDamageVisuals();return;}
  const hit=damageVisualQueue.shift();
  if(hit)animations.showDamageNumber(hit.x,hit.y,hit.damage,hit.isCrit,hit.isBoss);
  if(!damageVisualQueue.length)clearDamageVisuals();
 },40);
}
function clearDamageVisuals(){damageVisualQueue.length=0;if(damageVisualTimer!==null)clearInterval(damageVisualTimer);damageVisualTimer=null;}
const AUTO_CLICK_BATCH_MS=300;
const MANUAL_CLICK_BATCH_MS=120;
const BACKGROUND_SYNC_INTERVAL_MS=500;
const MIN_CLICK_INTERVAL=1000/CONSTANTS.MAX_CLICKS_PER_SECOND+1;
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
 if(purchasing||pendingClicks>=CONSTANTS.CLICK_BURST||performance.now()-lastClick<MIN_CLICK_INTERVAL)return;
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
 offset=result.serverNow-Date.now();deadline=s.bossDeadline;gameEngine.combat._totalDuration=s.bossDuration||CONSTANTS.BOSS_TIMER;
 appState.setMany({runtime:{...(s.runtime||{})},lastClickAt:s.lastClickAt,lastAutoClickAt:s.lastAutoClickAt||0,lastComboAt:s.lastComboAt,serverClockOffset:offset,prestige:s.prestige,prestigeSummary:s.prestigeSummary,inventory:s.inventory,equipment:s.equipment,lunarLuck:s.lunarLuck,wheelEconomy:s.wheelEconomy||{},runMaxLevel:s.runMaxLevel,moonSerial:s.moonSerial,ufoCount:s.ufoCount||0,ufoComboRelay:!!s.ufoComboRelay,gameCompleted:s.gameCompleted,maxLevel:s.maxLevel,ufoLevel:s.ufoLevel||0,ufoDamage:s.ufoDamage,ufoInterval:s.ufoInterval,ufoNextShotAt:s.ufoNextShotAt,finalDamage:s.finalDamage,finalCritChance:s.finalCritChance,moonReward:s.moonReward,ufoMoonReward:s.ufoMoonReward,currentLevel:s.currentLevel,moonHP:s.moonHP,maxHP:s.maxHP,
 clickCount:s.clickCount,runClickCount:s.runClickCount??s.clickCount,totalSecondsPlayed:s.totalSecondsPlayed,playerData:{...s.playerData,level:s.currentLevel,total_clicks:s.clickCount,total_seconds_played:s.totalSecondsPlayed},
 pendingEchoes:s.echoPending||0,cloneTargets:s.cloneTargets||[],clickCrystalLevel:s.clickCrystalLevel||0,activeMoon:s.activeMoon,activeMoons:s.activeMoons,ownedMoons:s.ownedMoons,moonLevels:s.moonLevels,
 maxSlots:s.maxSlots,moonKills:s.moonKills||0,bossKills:s.bossKills,quests:s.quests,achievements:s.achievements,
 levelLocked:s.levelLocked,testMode:false,bossTimerRunning:!!deadline,
 bossTimer:deadline?Math.max(0,(deadline-result.serverNow)/1000):30});
 const penalties=getEquippedItems(state).flatMap(getItemProperties)
  .filter(property=>property.stat==='damage'&&property.value<0&&!/\b(ufo|echo)\b/.test(property.condition));
 equipmentPreviewFactor=Math.max(.1,1+penalties.reduce((sum,property)=>sum+property.value,0)/100);
 Object.assign(gameEngine,s.runtime||{});
 gameEngine._lastActivityTime=Math.max(s.lastClickAt||0,s.lastAutoClickAt||0)?Math.max(s.lastClickAt||0,s.lastAutoClickAt||0)-offset:Date.now();
 gameEngine._lastComboTime=Math.max(s.lastClickAt||0,s.lastAutoClickAt||0,s.lastComboAt||0)-offset;
 if(!ready)updateHPBar(true);
 gameEngine.recalcMoonBonuses(false);refreshBuffs();updateUI();updateShopUI();updateQuestAndAchievementUI();renderAutoClick();
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохранено на сервере';
 updateLiveCombatProfile();
 renderFleet(s.ufoCount||(s.ufoLevel?1:0));
 gameEngine.refreshInventory();
 updateLunarLuckWidget();
 const announce=message=>{if(deferNotices)pendingWheelNotices=[...pendingWheelNotices,message].slice(-32);else showToast(message,'success',3500);};
 if(ready){
  for(const [id,q]of Object.entries(s.quests||{}))if(q.completed&&!previousQuests[id]?.completed)announce('🎯 Квест выполнен: '+(QUESTS[id]?.name||id));
  for(const [id,tiers]of Object.entries(s.achievements||{}))for(const [tier,status]of Object.entries(tiers))if(status==='unclaimed'&&!previousAchievements[id]?.[tier])announce('🏆 '+(ACHIEVEMENTS[id]?.tiers.find(t=>t.level===tier)?.name||id));
 }
 ready=true;

 if(document.hidden||!s.effects?.length)return;
 const rect=document.getElementById('moonWrapper')?.getBoundingClientRect();
 if(!rect)return;
 let index=0,ufoShot=null,lastReward=0;
 for(const event of s.effects){
  const position=event.source==='manual'?hits[index++]:null;
  const x=position?.x??rect.x+rect.width/2,y=position?.y??rect.y+rect.height/2;
  queueDamageVisual(x,y,event.damage,event.isCrit,event.isBoss,event.source==='manual');
  if(event.source==='ufo')ufoShot=event.ufoIndex||0;
  if(event.reward>0)lastReward=event.reward;
 }
 if(lastReward>0)animations.showMoonReward(lastReward,rect);
 if(ufoShot!==null){animations.playUfoShot(ufoShot);audio.shoot(true);}

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
 const flight=send('click',{count}).finally(()=>{
  if(clickFlight!==flight)return;
  clickFlight=null;
  if(active&&pendingClicks&&!flushTimer)flushTimer=setTimeout(()=>flush().catch(()=>{}),autoClickUntil>Date.now()?AUTO_CLICK_BATCH_MS:MANUAL_CLICK_BATCH_MS);
 });
 clickFlight=flight;
 return flight;
}
async function command(action,payload={},purchase=false){
 if(!active||purchasing)return;
 if(fortuneWheel.busy&&action!=='spinWheel'){showToast('Дождитесь окончания вращения','info');return;}
 purchasing=true;
 try{do{await flush();}while(active&&pendingClicks>0);const result=await send(action,payload);if(action==='claimAllQuests'||action==='claimAllAchievements'){updateQuestAndAchievementUI(true);const summary=result?.state?.claimSummary;if(summary)showToast('Получено '+summary.count+' наград: +'+summary.reward.toLocaleString('ru-RU')+' 💎','success',3500);}if(action==='ascend'){updateQuestAndAchievementUI(true);try{localStorage.removeItem('moon_completed_'+state.user?.id);}catch{}}if(purchase)audio.purchase();updateProfileAndLeaders();return result;}
 finally{purchasing=false;}
}
let initializing=null,initGeneration=0;
function syncInBackground(){
 if(!active||document.hidden||syncing||purchasing||clickFlight||pendingClicks)return false;
 const generation=initGeneration;
 syncing=true;
 send('sync').catch(()=>{}).finally(()=>{if(generation===initGeneration)syncing=false;});
 return true;
}
const oldDestroy=gameEngine.destroy.bind(gameEngine);
gameEngine.init=()=>{
 if(initializing)return initializing;
 const generation=++initGeneration;
 const pending=(async()=>{
 active=true;ready=false;syncing=false;clickFlight=null;nextUfoSync=0;nextBuffSync=0;pendingWheelNotices=[];lastRevision=0;lastBuffKey='';gameEngine._isRunning=true;
 db.leaderboardPresence?.start(state.user?.id).catch(()=>{});
 try{const loaded=await db.action('load');if(generation!==initGeneration||!active)throw Object.assign(Error('Загрузка отменена'),{code:'LOAD_CANCELLED'});apply(loaded);}catch(error){if(generation===initGeneration){active=false;gameEngine._isRunning=false;}throw error;}
 radio.connect(state.user).catch(()=>{});
 fortuneWheel.bind(payload=>command('spinWheel',payload),()=>{for(const message of pendingWheelNotices)showToast(message,'success',3500);pendingWheelNotices=[];updateUI();updateShopUI();updateProfileAndLeaders();});fortuneWheel.connect(true);
 gameAdmin.connect(state.user).catch(()=>{});
 if(ticker)clearInterval(ticker);if(ping)clearInterval(ping);
 let lastPrestigeDay=Math.floor((Date.now()+offset+10800000)/86400000);
 ticker=setInterval(()=>{
  if(!active||document.hidden)return;
  const prestigeDay=Math.floor((Date.now()+offset+10800000)/86400000);
  if(prestigeDay!==lastPrestigeDay){lastPrestigeDay=prestigeDay;updateShopUI();updateProfileAndLeaders();}
  const activeBuffs=refreshBuffs();updateLiveCombatProfile();
  const now=Date.now();
  if(((state.ufoLevel&&state.ufoNextShotAt<=now+offset)||state.pendingEchoes>0)&&now>=nextUfoSync&&syncInBackground()){
   nextUfoSync=now+BACKGROUND_SYNC_INTERVAL_MS;
  }
  const expired=activeBuffs.some(buff=>buff.isTemporary&&buff.timeLeft===0);
  if(expired&&now>=nextBuffSync&&syncInBackground()){
   nextBuffSync=now+2000;
  }
  if(deadline){appState.set('bossTimer',Math.max(0,(deadline-Date.now()-offset)/1000));updateTimerBar();
   if(deadline<=now+offset)syncInBackground();}
 },250);
 ping=setInterval(syncInBackground,20000);
 updateProfileAndLeaders();
 })();
 const tracked=pending.finally(()=>{if(initializing===tracked)initializing=null;});initializing=tracked;return tracked;
};
gameEngine.destroy=()=>{db.leaderboardPresence?.stop();stopAutoClick(false);clearDamageVisuals();initGeneration++;initializing=null;gameAdmin.disconnect();fortuneWheel.disconnect();radio.disconnect();active=false;ready=false;pendingWheelNotices=[];lastRevision=0;pendingClicks=0;previewHits=[];gameEngine._previewDamage=0;clearTimeout(flushTimer);clearInterval(ticker);clearInterval(ping);flushTimer=null;ticker=null;ping=null;resetInventory();oldDestroy();};
gameEngine.handleClick=(e,automatic=false)=>{
 const now=performance.now();
 if(!active||purchasing||now-lastClick<MIN_CLICK_INTERVAL)return;lastClick=now;
 if(pendingClicks>=CONSTANTS.CLICK_BURST)return;
 const damage=previewDamage();
 pendingClicks++;previewHits.push({damage,x:e.clientX,y:e.clientY});
 // Keep the HP bar in lockstep with each accepted hit, just like holding Space.
 // This only updates the local visual preview; the server still owns actual damage.
 refreshPreview();
 if(!automatic||!document.hidden)audio.click();
 animations.playClickVisualFeedback(e,damage,false,state.currentLevel%CONSTANTS.BOSS_INTERVAL===0,false);
 if(!clickFlight&&!flushTimer)flushTimer=setTimeout(()=>flush().catch(()=>{}),automatic?AUTO_CLICK_BATCH_MS:MANUAL_CLICK_BATCH_MS);
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

const ITEM_NAMES=Object.fromEntries(Object.entries(ITEM_TYPES).map(([id,item])=>[id,item.name]));
let selectedInventoryItemId=null;
let chosenEquipSlot=null;
let inventoryKey=null;

gameEngine.refreshInventory=()=>{
 const tab=document.getElementById('inventoryTabContent');
 if(!active||!tab?.classList.contains('active')||document.getElementById('profilePanel')?.classList.contains('hidden'))return;
 const key=JSON.stringify([state.inventory,state.equipment,state.ownedMoons,state.lunarLuck?.dust]);
 if(key===inventoryKey)return;
 inventoryKey=key;
 renderItemInventory();
 renderMoonEquipment();
};

gameEngine.closeEquipmentPicker=()=>{
 if(!chosenEquipSlot)return;
 chosenEquipSlot=null;
 document.getElementById('moonEquipFloatingInventory')?.remove();
 inventoryKey=null;
};

function resetInventory(){
 gameEngine.closeEquipmentPicker();
 selectedInventoryItemId=null;
 inventoryKey=null;
 for(const id of ['inventoryMount','moonEquipmentMount'])document.getElementById(id)?.replaceChildren();
 document.getElementById('lunarLuckWidget')?.remove();
}

function renderMoonEquipment(){
 const host=document.getElementById('moonEquipmentMount');if(!host)return;
 host.replaceChildren();
 const heading=document.createElement('h3');heading.textContent='🌙 Экипировка лун';host.append(heading);
 const note=document.createElement('p');note.textContent='Выбери открытый слот, затем перетащи предмет из инвентаря справа или нажми на него. Улучшения сохраняются навсегда.';host.append(note);
 const moons=document.createElement('div');moons.className='moon-equip-moons';host.append(moons);
 const equipped=new Set(Object.values(state.equipment||{}).flat().map(x=>x.itemId).filter(x=>x!=null));
 const items=state.inventory?.items||[],itemsById=new Map(items.map(item=>[item.id,item]));
 const ownedMoons=state.ownedMoons||[];
 const validSelection=chosenEquipSlot&&ownedMoons.includes(chosenEquipSlot.moonId)&&state.equipment?.[chosenEquipSlot.moonId]?.[chosenEquipSlot.slotIndex]?.level;
 if(chosenEquipSlot&&!validSelection)chosenEquipSlot=null;
 for(const [moonOrder,[moonId,moon]] of Object.entries(MOON_TYPES).entries()){
  if(moonId==='clone')continue;
  const owned=ownedMoons.includes(moonId);
  const block=document.createElement('section');block.className='moon-equip-moon';moons.append(block);
  const label=document.createElement('h4');label.textContent=(moon.emoji||'🌙')+' '+moon.name+(owned?'':' 🔒');block.append(label);
  const row=document.createElement('div');row.className='moon-equip-slots';block.append(row);
  for(let i=0;i<3;i++){
   const slot=state.equipment?.[moonId]?.[i]||{level:0,itemId:null};
   const item=itemsById.get(slot.itemId);
   const cell=document.createElement('div');cell.className='moon-equip-slot';row.append(cell);
   const selected=chosenEquipSlot?.moonId===moonId&&chosenEquipSlot?.slotIndex===i;
   cell.classList.toggle('is-selected',selected);
   const caption=document.createElement('strong');caption.textContent='Слот '+(i+1)+' · '+(slot.level?'ур. '+slot.level:'закрыт');cell.append(caption);
   const content=document.createElement('p');content.textContent=item?(ITEM_ICONS[item.type]||'💠')+' '+(ITEM_NAMES[item.type]||item.type)+' +'+item.rarity:slot.level?'◇ Пусто':'🔒';cell.append(content);
   const btn=(label,action,payload,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled||!owned;b.onclick=e=>{e.stopPropagation();command(action,{moonId,slotIndex:i,...payload}).catch(()=>{});};cell.append(b);};
   if(!slot.level){const cost=Math.ceil([5,15,35][i]*Math.pow(1.5,moonOrder));btn('Открыть · '+cost+' ✧','unlockEquipSlot',{},(state.lunarLuck?.dust||0)<cost);}
   else{
    if(owned){
     if(!item){
      const choose=document.createElement('button');
      choose.type='button';choose.className='moon-equip-choose';choose.textContent=selected?'Инвентарь открыт':'Выбрать предмет';
      choose.setAttribute('aria-expanded',String(selected));choose.setAttribute('aria-label','Выбрать предмет для слота '+(i+1)+' луны '+moon.name);
      choose.onclick=()=>{chosenEquipSlot={moonId,slotIndex:i};renderMoonEquipment();document.getElementById('moonEquipFloatingInventory')?.querySelector('button')?.focus();};
      cell.append(choose);
     }
     cell.ondragover=e=>{if(!item){e.preventDefault();cell.classList.add('drag-over');}};
     cell.ondragleave=()=>cell.classList.remove('drag-over');
     cell.ondrop=e=>{e.preventDefault();cell.classList.remove('drag-over');if(item)return;const id=Number(e.dataTransfer.getData('text/plain'));if(id)command('equipItem',{moonId,slotIndex:i,id}).catch(()=>{});};
    }
    const cost=Math.ceil(15*Math.pow(2.5,slot.level-1)*Math.pow(1.8,moonOrder));
    if(item)btn('Снять','unequipItem',{});
    if(slot.level<30)btn('Улучшить · '+cost+' ✧','upgradeEquipSlot',{},(state.lunarLuck?.dust||0)<cost);
   }
  }
 }
 let panel=document.getElementById('moonEquipFloatingInventory');
 if(!chosenEquipSlot){panel?.remove();return;}
 if(!panel){panel=document.createElement('aside');panel.id='moonEquipFloatingInventory';panel.className='moon-equip-floating';panel.setAttribute('aria-label','Лунный инвентарь');document.body.append(panel);}
 panel.replaceChildren();
 const titleBar=document.createElement('div');titleBar.className='moon-equip-floating-title';panel.append(titleBar);
 const title=document.createElement('h3');title.textContent='🌙 Лунный инвентарь';titleBar.append(title);
 const close=document.createElement('button');close.type='button';close.textContent='✕';close.setAttribute('aria-label','Закрыть инвентарь');
 close.onclick=()=>{
  const index=Array.from(host.querySelectorAll('.moon-equip-choose')).findIndex(button=>button.getAttribute('aria-expanded')==='true');
  gameEngine.closeEquipmentPicker();gameEngine.refreshInventory();
  host.querySelectorAll('.moon-equip-choose')[index]?.focus();
 };
 panel.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();close.click();}};
 titleBar.append(close);
 const target=state.equipment?.[chosenEquipSlot.moonId]?.[chosenEquipSlot.slotIndex];
 const moon=MOON_TYPES[chosenEquipSlot.moonId];
 const help=document.createElement('p');help.textContent='Выбран: '+(moon?.name||'Луна')+' · слот '+(chosenEquipSlot.slotIndex+1)+' · редкость до '+target.level+'. Перетащи предмет на слот слева или нажми на предмет.';panel.append(help);
 const grid=document.createElement('div');grid.className='moon-equip-floating-grid';panel.append(grid);
 const capacity=state.inventory?.capacity||20;
 for(let i=0;i<capacity;i++){
  const item=items[i],tile=document.createElement('button');tile.type='button';tile.className='moon-equip-floating-item';grid.append(tile);
  if(!item){tile.disabled=true;tile.classList.add('empty');tile.textContent='+';continue;}
  const available=!equipped.has(item.id);
  const fits=available&&target?.level>=item.rarity&&target?.itemId==null;
  tile.textContent=(ITEM_ICONS[item.type]||'💠')+' +'+item.rarity;
  tile.title=(ITEM_NAMES[item.type]||item.type)+' · редкость '+item.rarity+(available?'':' · уже установлен');
  tile.disabled=!fits;tile.draggable=!!fits;
  tile.ondragstart=e=>{if(fits)e.dataTransfer.setData('text/plain',String(item.id));};
  tile.onclick=()=>{if(fits)command('equipItem',{moonId:chosenEquipSlot.moonId,slotIndex:chosenEquipSlot.slotIndex,id:item.id}).catch(()=>{});};
 }

}
const ITEM_ICONS=Object.fromEntries(Object.entries(ITEM_TYPES).map(([id,item])=>[id,item.icon]));
function renderItemInventory(){
 const tab=document.getElementById('inventoryMount');if(!tab)return;
 let host=document.getElementById('moonInventory');
 if(!host){host=document.createElement('section');host.id='moonInventory';host.className='moon-inventory';tab.append(host);}
 const inv=state.inventory||{capacity:20,keepLimit:3,items:[]},items=inv.items||[];
 const kept=items.filter(i=>i.keep).length;
 if(!items.some(i=>i.id===selectedInventoryItemId))selectedInventoryItemId=null;
 host.replaceChildren();
 const title=document.createElement('h3');title.textContent='🌙 Лунный инвентарь';host.append(title);
 const status=document.createElement('p');status.className='moon-inventory-status';status.textContent=items.length+' / '+inv.capacity+' слотов занято · Сохранение: '+kept+' / '+inv.keepLimit;host.append(status);
 const selected=items.find(i=>i.id===selectedInventoryItemId);
 const info=document.createElement('section');info.className='moon-inventory-info';host.append(info);
 if(selected){
  const itemName=(ITEM_NAMES[selected.type]||selected.type);
  const heading=document.createElement('h4');heading.textContent=(ITEM_ICONS[selected.type]||'💠')+' '+itemName+' · редкость '+selected.rarity;info.append(heading);
  for(const property of getItemProperties(selected)){
   const effect=document.createElement('p');effect.className='moon-inventory-effect';
   effect.classList.toggle('item-penalty',property.value<0);
   effect.textContent=formatItemProperty(property);info.append(effect);
  }
  const flags=document.createElement('p');flags.textContent='Лунная пыль при разборе: '+getItemSalvageDust(selected.rarity)+' · '+(selected.locked?'🔒 Защищён':'Без защиты')+' · '+(selected.keep?'★ Сохранится при перерождении':'Не выбран для сохранения');info.append(flags);
 }else{
  const heading=document.createElement('h4');heading.textContent='✧ Выбери предмет';info.append(heading);
  const description=document.createElement('p');description.textContent='Нажми на занятый слот, чтобы увидеть описание, редкость и доступные действия.';info.append(description);
 }
 const grid=document.createElement('div');grid.className='moon-inventory-grid';grid.setAttribute('aria-label','Слоты инвентаря');host.append(grid);
 for(let index=0;index<inv.capacity;index++){
  const item=items[index];
  const slot=document.createElement('button');slot.type='button';slot.className='moon-inventory-slot'+(item?' occupied':' empty')+(item?.id===selectedInventoryItemId?' selected':'');
  if(item){
   const icon=document.createElement('span');icon.className='moon-slot-icon';icon.textContent=(ITEM_ICONS[item.type]||'💠')+(item.mods?.some(mod=>mod.star)?' ★':'');slot.append(icon);
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
 if(!selected){const hint=document.createElement('p');hint.className='moon-inventory-hint';hint.textContent=items.length?'Нажми на предмет, чтобы открыть действия.':'Пусто. Предмет выдаётся за каждый третий сбор Лунной пыли.';host.append(hint);return;}
 const details=document.createElement('section');details.className='moon-inventory-details';host.append(details);
 const name=document.createElement('strong');name.textContent=(ITEM_ICONS[selected.type]||'💠')+' '+(ITEM_NAMES[selected.type]||selected.type)+' · редкость '+selected.rarity;details.append(name);
 const buttons=document.createElement('div');buttons.className='moon-inventory-actions';details.append(buttons);
 const act=(action,payload)=>command(action,payload).catch(()=>{});
 function add(label,action,payload,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=()=>act(action,payload);buttons.append(b);}
 add(selected.locked?'🔒 Снять защиту':'🔓 Защитить','lockItem',{id:selected.id});
 add(selected.keep?'★ Не сохранять':'☆ Сохранить','keepItem',{id:selected.id},!selected.keep&&kept>=inv.keepLimit);
 renderItemUpgrades(details,selected,items,act);
 const salvage=document.createElement('button');salvage.type='button';salvage.textContent='Разобрать · +'+getItemSalvageDust(selected.rarity)+' пыли';salvage.disabled=!!selected.locked;salvage.onclick=()=>openInventorySalvage(selected);buttons.append(salvage);
}

function renderItemUpgrades(host,item,items,act){
 const upgrades=document.createElement('div');
 upgrades.className='moon-item-upgrades';
 host.append(upgrades);
 if(item.rarity>=ITEM_MAX_LEVEL){
  if(item.rarity!==ITEM_MAX_LEVEL||item.masterwork!=null)return;
  for(const roll of item.mods||[]){
   if(roll.star)continue;
   const property=getItemProperties({...item,mods:[roll],penalty:null})[1];
   const button=document.createElement('button');button.type='button';button.className='btn-action';
   button.textContent='Усилить на 25% · '+property.name;
   button.onclick=()=>{if(window.confirm('Усилить «'+property.name+'»? Выбор делается один раз.'))act('masterworkItem',{id:item.id,mod:roll.id});};
   upgrades.append(button);
  }
  return;
 }
 const equipped=new Set(Object.values(state.equipment||{}).flat().map(slot=>slot.itemId));
 const donorLevel=item.rarity<3?item.rarity:1;
 const donors=items.filter(candidate=>candidate.id!==item.id&&candidate.type===item.type&&candidate.rarity===donorLevel&&!candidate.locked&&!equipped.has(candidate.id));
 const label=document.createElement('p');
 label.textContent='Уровень '+(item.rarity+1)+' · нужен свободный дубликат уровня '+donorLevel;
 upgrades.append(label);
 if(!donors.length||item.locked||equipped.has(item.id))return;
 const select=document.createElement('select');select.setAttribute('aria-label','Предмет-донор');
 for(const donor of donors){
  const option=document.createElement('option');option.value=String(donor.id);
  option.textContent='#'+donor.id+' · '+getItemProperties(donor).slice(1).map(formatItemProperty).join(' / ');
  select.append(option);
 }
 const milestone=(item.rarity+1)%2===0;
 const offer=item.mergeOffer;
 if(donors.some(donor=>donor.id===offer?.donorId))select.value=String(offer.donorId);
 upgrades.append(select);
 const prepare=document.createElement('button');prepare.type='button';prepare.className='btn-action';
 prepare.textContent=milestone?'Показать варианты бафа':'Объединить';
 prepare.onclick=()=>{
  const payload={id:item.id,otherId:Number(select.value)};
  if(milestone)act('prepareItemMerge',payload);
  else if(window.confirm('Предмет #'+payload.otherId+' будет израсходован. Продолжить?'))act('mergeItems',payload);
 };
 upgrades.append(prepare);
 if(offer&&donors.some(donor=>donor.id===offer.donorId)){
  const choices=document.createElement('div');choices.className='moon-item-upgrades';upgrades.append(choices);
  select.onchange=()=>{choices.hidden=Number(select.value)!==offer.donorId;};
  offer.choices.forEach((roll,choice)=>{
   const property=getItemProperties({...item,mods:[roll],penalty:null})[1];
   const button=document.createElement('button');button.type='button';button.className='btn-action';
   button.textContent='Выбрать '+formatItemProperty(property);
   button.onclick=()=>{if(window.confirm('Предмет #'+offer.donorId+' будет израсходован. Продолжить?'))act('mergeItems',{id:item.id,otherId:offer.donorId,choice});};
   choices.append(button);
  });
 }
}

function openInventorySalvage(item){
 const modal=document.getElementById('inventorySalvageModal');if(!modal)return;
 const name=ITEM_NAMES[item.type]||item.type;
 modal.querySelector('#inventorySalvageMessage').textContent='«'+name+'» (редкость '+item.rarity+') исчезнет навсегда. Ты получишь '+getItemSalvageDust(item.rarity)+' Лунной пыли. Отменить разбор нельзя.';
 const confirmButton=modal.querySelector('#inventorySalvageConfirm');
 const cancel=()=>{modal.classList.add('hidden');modal.removeEventListener('keydown',onKey);};
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
 modal.querySelectorAll('[data-inventory-salvage-cancel]').forEach(b=>b.onclick=cancel);
 confirmButton.disabled=false;
 confirmButton.onclick=()=>{confirmButton.disabled=true;cancel();command('salvageItem',{id:item.id}).catch(()=>{});};
 modal.classList.remove('hidden');modal.addEventListener('keydown',onKey);confirmButton.focus();
}

function updateLunarLuckWidget(){
 if(!active)return;
 const purchase=document.getElementById('buyMoonItem');
 if(purchase){
  const inventory=state.inventory,dust=state.lunarLuck?.dust||0;
  const full=inventory?.items?.length>=inventory?.capacity;
  purchase.disabled=dust<ITEM_SHOP_COST||full;
  const label=full?'Инвентарь заполнен':'Случайный предмет · '+ITEM_SHOP_COST+' пыли (в запасе '+dust+')';
  if(purchase.textContent!==label)purchase.textContent=label;
  if(!purchase.onclick)purchase.onclick=()=>command('buyMoonItem',{},true).then(result=>{
   const item=result?.state?.inventory?.items?.at(-1);
   if(item)showToast('Получен предмет: '+ITEM_NAMES[item.type],'success',3500);
  }).catch(()=>{});
 }
 const shop=document.getElementById('shopPanel');
 if(!shop||shop.classList.contains('hidden'))return;
 const host=shop.querySelector('.panel-content');if(!host)return;
 let el=document.getElementById('lunarLuckWidget');
 if(!el){
  el=document.createElement('section');el.id='lunarLuckWidget';
  el.innerHTML='<header><h3>🌙 Лунная пыль</h3><strong data-luck-progress></strong></header><div class="moon-luck-meter" role="progressbar" aria-label="До следующей порции лунной пыли"><span></span></div><p>Каждая побеждённая луна заполняет шкалу. Чем выше её уровень, тем больше прирост. Каждые 100% добавляют 1 пыль к награде.</p><div class="moon-luck-resources"><div class="moon-luck-resource"><span>✦ Готово к сбору</span><strong data-luck-ready></strong></div><div class="moon-luck-resource"><span>✧ Пыль в запасе</span><strong data-luck-dust></strong></div></div><button type="button" class="moon-luck-claim" id="claimLunarLuckButton" disabled>✦ Забрать всё</button>';
  el.querySelector('button').onclick=()=>command('claimLunarLuck').catch(()=>{});
  host.prepend(el);
 }
 const luck=state.lunarLuck||{},total=Math.max(0,luck.progress||0);
 const ready=Math.floor(total/100),progress=total%100;
 const meter=el.querySelector('.moon-luck-meter'),value=String(progress);
 if(meter.getAttribute('aria-valuenow')!==value){
  meter.setAttribute('aria-valuenow',value);
  meter.firstElementChild.style.transform='scaleX('+progress/100+')';
  el.querySelector('[data-luck-progress]').textContent=progress.toLocaleString('ru-RU',{maximumFractionDigits:6})+'%';
 }
 const pending=el.querySelector('[data-luck-ready]'),readyValue=String(ready);
 if(pending.textContent!==readyValue){
  pending.textContent=readyValue;
  el.querySelector('button').disabled=ready===0;
 }
 const dust=el.querySelector('[data-luck-dust]'),dustValue=String(luck.dust||0);
 if(dust.textContent!==dustValue)dust.textContent=dustValue;
}
gameEngine.refreshLunarLuck=updateLunarLuckWidget;

gameEngine.toggleTestMode=()=>showToast('Тестовый режим отключён в защищённом сезоне','info');

const moonButton=document.getElementById('moonWrapper');moonButton?.addEventListener('keydown',e=>{if(e.code==='Space'&&autoClickUntil>Date.now()){e.preventDefault();return;}if(e.code==='Space'||e.code==='Enter'){e.preventDefault();const r=moonButton.getBoundingClientRect();gameEngine.handleClick({clientX:r.x+r.width/2,clientY:r.y+r.height/2});}});
