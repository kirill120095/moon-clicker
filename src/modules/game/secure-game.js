import { maskWheelDelta } from '../ui/currency-display.js';
import { fortuneWheel } from '../ui/wheel.js';
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
const AUTO_CLICK_BATCH_MS=800; // Group four ticks into one request.
function autoClickDuration(){return 15000+15000*Math.max(0,Math.floor(state.prestige?.upgrades?.autoclick||0));}
function renderAutoClick(){
 const button=document.getElementById('autoClickBtn'),label=document.getElementById('autoClickLabel'),timer=document.getElementById('autoClickTimer');
 const left=Math.max(0,autoClickUntil-Date.now()),running=active&&left>0;
 if(button){button.classList.toggle('active',running);button.setAttribute('aria-label',running?'Обновить время автокликов':'Запустить автоклики');button.title='Автоклики: '+Math.round(autoClickDuration()/1000)+' с. Повторное нажатие сбрасывает таймер.';}
 if(label)label.textContent=running?'Продлить':'Автоклик';
 if(timer)timer.textContent=((running?left:autoClickDuration())/1000).toFixed(1)+'с';
}
function stopAutoClick(){autoClickUntil=0;if(autoClickTicker!==null){clearInterval(autoClickTicker);autoClickTicker=null;}renderAutoClick();if(active&&pendingClicks&&!clickFlight)flush().catch(()=>{});}
function autoClickStep(){
 if(!active||Date.now()>=autoClickUntil){stopAutoClick();return;}
 renderAutoClick();
 // Do not use DOM clicks or keyboard events: panels, scroll and mouse focus remain untouched.
 if(purchasing||pendingClicks>CONSTANTS.CLICK_BURST-2)return;
 const rect=document.getElementById('moonWrapper')?.getBoundingClientRect();
 const x=rect?rect.left+rect.width/2:0,y=rect?rect.top+rect.height/2:0;
 const damage=previewDamage();
 for(let i=0;i<2;i++){pendingClicks++;previewHits.push({damage,x,y});}
 // Play the familiar click sound without moving the cursor or focus.
 if(!document.hidden)audio.click();
 refreshPreview();
 if(!clickFlight&&!flushTimer)flushTimer=setTimeout(()=>flush().catch(()=>{}),AUTO_CLICK_BATCH_MS);
}
gameEngine.activateAutoClick=()=>{
 if(!active)return;
 autoClickUntil=Date.now()+autoClickDuration();
 if(autoClickTicker===null)autoClickTicker=setInterval(autoClickStep,200);
 renderAutoClick();
};
const autoButton=document.getElementById('autoClickBtn');
autoButton?.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault();});
autoButton?.addEventListener('click',()=>gameEngine.activateAutoClick());
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
 appState.setMany({runtime:{...(s.runtime||{})},lastClickAt:s.lastClickAt,lastAutoClickAt:s.lastAutoClickAt||0,lastComboAt:s.lastComboAt,serverClockOffset:offset,prestige:s.prestige,prestigeSummary:s.prestigeSummary,runMaxLevel:s.runMaxLevel,moonSerial:s.moonSerial,ufoCount:s.ufoCount||0,ufoComboRelay:!!s.ufoComboRelay,gameCompleted:s.gameCompleted,maxLevel:s.maxLevel,ufoLevel:s.ufoLevel||0,ufoDamage:s.ufoDamage,ufoInterval:s.ufoInterval,ufoNextShotAt:s.ufoNextShotAt,finalDamage:s.finalDamage,finalCritChance:s.finalCritChance,moonReward:s.moonReward,ufoMoonReward:s.ufoMoonReward,currentLevel:s.currentLevel,moonHP:s.moonHP,maxHP:s.maxHP,
 clickCount:s.clickCount,runClickCount:s.runClickCount??s.clickCount,totalSecondsPlayed:s.totalSecondsPlayed,playerData:{...s.playerData,level:s.currentLevel,total_clicks:s.clickCount,total_seconds_played:s.totalSecondsPlayed},
 pendingEchoes:s.echoPending||0,cloneTargets:s.cloneTargets||[],clickCrystalLevel:s.clickCrystalLevel||0,activeMoon:s.activeMoon,activeMoons:s.activeMoons,ownedMoons:s.ownedMoons,moonLevels:s.moonLevels,
 maxSlots:s.maxSlots,moonKills:s.moonKills||0,bossKills:s.bossKills,quests:s.quests,achievements:s.achievements,
 levelLocked:s.levelLocked,testMode:false,bossTimerRunning:!!deadline,
 bossTimer:deadline?Math.max(0,(deadline-result.serverNow)/1000):30});
 Object.assign(gameEngine,s.runtime||{});
 gameEngine._lastActivityTime=Math.max(s.lastClickAt||0,s.lastAutoClickAt||0)?Math.max(s.lastClickAt||0,s.lastAutoClickAt||0)-offset:Date.now();
 gameEngine._lastComboTime=Math.max(s.lastClickAt||0,s.lastAutoClickAt||0,s.lastComboAt||0)-offset;
 gameEngine.recalcMoonBonuses(false);refreshBuffs();updateUI();updateShopUI();updateQuestAndAchievementUI();
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохранено на сервере';
 updateLiveCombatProfile();
 renderFleet(s.ufoCount||(s.ufoLevel?1:0));
 const announce=message=>{if(deferNotices)pendingWheelNotices=[...pendingWheelNotices,message].slice(-32);else showToast(message,'success',3500);};
 if(ready){
  for(const [id,q]of Object.entries(s.quests||{}))if(q.completed&&!previousQuests[id]?.completed)announce('🎯 Квест выполнен: '+(QUESTS[id]?.name||id));
  for(const [id,tiers]of Object.entries(s.achievements||{}))for(const [tier,status]of Object.entries(tiers))if(status==='unclaimed'&&!previousAchievements[id]?.[tier])announce('🏆 '+(ACHIEVEMENTS[id]?.tiers.find(t=>t.level===tier)?.name||id));
 }
 ready=true;

 let index=0,visibleDamage=0;
 for(const event of s.effects||[]){
  if(!rect)continue;
  const position=event.source==='manual'?hits[index++]:null;
  // Avoid hundreds of animated DOM nodes per batch, but always retain critical hits.
  if(visibleDamage<12||event.isCrit){animations.showDamageNumber(position?.x??rect.x+rect.width/2,position?.y??rect.y+rect.height/2,event.damage,event.isCrit,event.isBoss);visibleDamage++;}
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
 try{const loaded=await db.action('load');if(generation!==initGeneration||!active)throw Object.assign(Error('Загрузка отменена'),{code:'LOAD_CANCELLED'});apply(loaded);}catch(error){if(generation===initGeneration){active=false;gameEngine._isRunning=false;}throw error;}
 radio.connect(state.user).catch(()=>{});
 fortuneWheel.bind(payload=>command('spinWheel',payload),()=>{for(const message of pendingWheelNotices)showToast(message,'success',3500);pendingWheelNotices=[];updateUI();updateShopUI();updateProfileAndLeaders();});fortuneWheel.connect(true);
 gameAdmin.connect(state.user).catch(()=>{});
 if(ticker)clearInterval(ticker);if(ping)clearInterval(ping);
 ticker=setInterval(()=>{
  if(!active)return;
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
gameEngine.destroy=()=>{stopAutoClick();initGeneration++;initializing=null;gameAdmin.disconnect();fortuneWheel.disconnect();radio.disconnect();active=false;ready=false;pendingWheelNotices=[];lastRevision=0;pendingClicks=0;previewHits=[];gameEngine._previewDamage=0;clearTimeout(flushTimer);clearInterval(ticker);clearInterval(ping);flushTimer=null;ticker=null;ping=null;oldDestroy();};
gameEngine.handleClick=e=>{
 if(!active||purchasing||performance.now()-lastClick<1000/CONSTANTS.MAX_CLICKS_PER_SECOND+1)return;lastClick=performance.now();
 if(pendingClicks>=CONSTANTS.CLICK_BURST)return;
 pendingClicks++;previewHits.push({damage:previewDamage(),x:e.clientX,y:e.clientY});refreshPreview();audio.click();
 animations.playClickVisualFeedback(e,state.finalDamage||previewDamage(),false,state.currentLevel%CONSTANTS.BOSS_INTERVAL===0,false);
 if(!clickFlight)flush().catch(()=>{});
};
gameEngine._saveProgress=async()=>{do{await flush();}while(active&&pendingClicks>0);if(active)await send('sync');};
gameEngine.buyClickCrystal=(max=false)=>command('buyClickCrystal',{max},true).catch(()=>{});
gameEngine.setCloneTargets=targets=>command('setCloneTargets',{targets}).catch(()=>{});
gameEngine.buyClickDamage=(max=false)=>command('buyDamage',{max},true).catch(()=>{});
gameEngine.ascend=()=>{const summary=getPrestigeSummary(state);if(!summary.canAscend){showToast('Вознесение недоступно: достигните '+CONSTANTS.PRESTIGE.COIN_EVERY+' уровня в этом прохождении','info');return;}const count=summary.pendingCoins;if(confirm('Вознестись за '+count+' монет престижа? Весь обычный прогресс будет сброшен. Вечные бонусы, монеты и покупки сохранятся.'))command('ascend').catch(()=>{});};
gameEngine.buyPrestige=(id,max=false)=>command('buyPrestige',{id,max},true).catch(()=>{});
gameEngine.buyUfoComboRelay=()=>command('buyUfoComboRelay',{},true).catch(()=>{});
gameEngine.buyUfoUnit=(max=false)=>command('buyUfoUnit',{max},true).catch(()=>{});
gameEngine.buyUfo=(max=false)=>command('buyUfo',{max},true).catch(()=>{});
gameEngine.rollbackFive=()=>command('rollbackFive').catch(()=>{});
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
gameEngine.resetProgress=()=>command('reset').catch(()=>{});
gameEngine.toggleTestMode=()=>showToast('Тестовый режим отключён в защищённом сезоне','info');

const moonButton=document.getElementById('moonWrapper');moonButton?.addEventListener('keydown',e=>{if(e.code==='Space'&&autoClickUntil>Date.now()){e.preventDefault();return;}if(e.code==='Space'||e.code==='Enter'){e.preventDefault();const r=moonButton.getBoundingClientRect();gameEngine.handleClick({clientX:r.x+r.width/2,clientY:r.y+r.height/2});}});
