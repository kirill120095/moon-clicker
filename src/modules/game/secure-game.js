import { gameAdmin } from '../ui/admin.js';
import { gameEngine } from './game.js';
import { appState, state } from '../../core/state.js';
import { CONSTANTS,QUESTS,ACHIEVEMENTS,getBaseDamage } from '../../core/constants.js';
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
 const bonus=gameEngine._calculateAllBonuses().totalDamageBonus+(state.prestigeSummary?.damageBonus||0);
 return Math.min(CONSTANTS.SAFE_NUMBER_CAP,Math.max(1,Math.round(getBaseDamage(state)*(1+bonus))));
}
let lastRevision=0,lastBuffKey='',ready=false;
function refreshBuffs(){
 const key=JSON.stringify(gameEngine._getActiveBuffs());
 if(key!==lastBuffKey){lastBuffKey=key;gameEngine._updateBuffsDisplay();}
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
function apply(result,hits=[]){
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
 appState.setMany({runtime:{...(s.runtime||{})},lastClickAt:s.lastClickAt,lastComboAt:s.lastComboAt,serverClockOffset:offset,prestige:s.prestige,prestigeSummary:s.prestigeSummary,runMaxLevel:s.runMaxLevel,moonSerial:s.moonSerial,ufoCount:s.ufoCount||0,ufoComboRelay:!!s.ufoComboRelay,gameCompleted:s.gameCompleted,maxLevel:s.maxLevel,ufoLevel:s.ufoLevel||0,ufoDamage:s.ufoDamage,ufoInterval:s.ufoInterval,ufoNextShotAt:s.ufoNextShotAt,finalDamage:s.finalDamage,finalCritChance:s.finalCritChance,moonReward:s.moonReward,ufoMoonReward:s.ufoMoonReward,currentLevel:s.currentLevel,moonHP:s.moonHP,maxHP:s.maxHP,
 clickCount:s.clickCount,totalSecondsPlayed:s.totalSecondsPlayed,playerData:{...s.playerData,level:s.currentLevel,total_clicks:s.clickCount,total_seconds_played:s.totalSecondsPlayed},
 activeMoon:s.activeMoon,activeMoons:s.activeMoons,ownedMoons:s.ownedMoons,moonLevels:s.moonLevels,
 maxSlots:s.maxSlots,bossKills:s.bossKills,quests:s.quests,achievements:s.achievements,
 levelLocked:s.levelLocked,testMode:false,bossTimerRunning:!!deadline,
 bossTimer:deadline?Math.max(0,(deadline-result.serverNow)/1000):30});
 Object.assign(gameEngine,s.runtime||{});
 gameEngine._lastActivityTime=s.lastClickAt?s.lastClickAt-offset:Date.now();
 gameEngine._lastComboTime=Math.max(s.lastClickAt||0,s.lastComboAt||0)-offset;
 gameEngine.recalcMoonBonuses();refreshBuffs();updateUI();updateShopUI();updateQuestAndAchievementUI();
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохранено на сервере';
 updateLiveCombatProfile();
 renderFleet(s.ufoCount||(s.ufoLevel?1:0));
 if(ready){
  for(const [id,q]of Object.entries(s.quests||{}))if(q.completed&&!previousQuests[id]?.completed)showToast('🎯 Квест выполнен: '+(QUESTS[id]?.name||id),'success',3500);
  for(const [id,tiers]of Object.entries(s.achievements||{}))for(const [tier,status]of Object.entries(tiers))if(status==='unclaimed'&&!previousAchievements[id]?.[tier])showToast('🏆 '+(ACHIEVEMENTS[id]?.tiers.find(t=>t.level===tier)?.name||id),'success',3500);
 }
 ready=true;
 if(s.gameCompleted){
  const key='moon_completed_'+state.user?.id;
  try{if(!localStorage.getItem(key)){localStorage.setItem(key,'1');window.showSupernovaModal?.();}}catch{}
 }
 let index=0;
 for(const event of s.effects||[]){
  if(!rect)continue;
  const position=event.source==='manual'?hits[index++]:null;
  animations.showDamageNumber(position?.x??rect.x+rect.width/2,position?.y??rect.y+rect.height/2,event.damage,event.isCrit,event.isBoss);
  if(event.source==='ufo'){animations.playUfoShot(event.ufoIndex||0);audio.shoot(true);}
  if(event.reward>0)animations.showMoonReward(event.reward);
 }

}
async function send(action,payload={}){
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохраняем…';
 try{const result=await db.action(action,payload);
  const hits=action==='click'?previewHits.splice(0,payload.count):[];
  gameEngine._previewDamage=previewHits.reduce((sum,hit)=>sum+hit.damage,0);
  if(active)apply(result,hits);return result;}
 catch(error){if(action==='click'){previewHits.splice(0,payload.count);refreshPreview();}if(status)status.textContent='Нет связи — действие не подтверждено';if(error.message!==lastErrorMessage||Date.now()-lastErrorToast>5000){showToast(error.message,'warning');lastErrorMessage=error.message;lastErrorToast=Date.now();}throw error;}
}
async function flush(){
 if(flushTimer){clearTimeout(flushTimer);flushTimer=null;}
 if(clickFlight)return clickFlight;
 if(!active||pendingClicks===0)return;
 const count=Math.min(CONSTANTS.CLICK_BURST,pendingClicks);pendingClicks-=count;
 clickFlight=send('click',{count}).finally(()=>{
  clickFlight=null;
  if(active&&pendingClicks&&!flushTimer)flushTimer=setTimeout(()=>flush().catch(()=>{}),0);
 });
 return clickFlight;
}
async function command(action,payload={},purchase=false){
 if(!active||purchasing)return;
 purchasing=true;
 try{do{await flush();}while(active&&pendingClicks>0);await send(action,payload);if(action==='ascend'){updateQuestAndAchievementUI(true);try{localStorage.removeItem('moon_completed_'+state.user?.id);}catch{}}if(purchase)audio.purchase();updateProfileAndLeaders();}
 finally{purchasing=false;}
}
let initializing=null,initGeneration=0;
const oldDestroy=gameEngine.destroy.bind(gameEngine);
gameEngine.init=()=>{
 if(initializing)return initializing;
 const generation=++initGeneration;
 const pending=(async()=>{
 active=true;ready=false;lastRevision=0;lastBuffKey='';gameEngine._isRunning=true;
 try{const loaded=await db.action('load');if(generation!==initGeneration||!active)throw Object.assign(Error('Загрузка отменена'),{code:'LOAD_CANCELLED'});apply(loaded);}catch(error){if(generation===initGeneration){active=false;gameEngine._isRunning=false;}throw error;}
 radio.connect(state.user).catch(()=>{});
 gameAdmin.connect(state.user).catch(()=>{});
 if(ticker)clearInterval(ticker);if(ping)clearInterval(ping);
 ticker=setInterval(()=>{
  if(!active)return;
  refreshBuffs();updateLiveCombatProfile();
  if(state.ufoLevel&&state.ufoNextShotAt<=Date.now()+offset&&!document.hidden&&!syncing&&!clickFlight&&!pendingClicks&&Date.now()>=nextUfoSync){
   nextUfoSync=Date.now()+250;syncing=true;
   send('sync').catch(()=>{}).finally(()=>{syncing=false;});
  }
  const expired=gameEngine._getActiveBuffs().some(buff=>buff.isTemporary&&buff.timeLeft===0);
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
gameEngine.destroy=()=>{initGeneration++;initializing=null;gameAdmin.disconnect();radio.disconnect();active=false;ready=false;lastRevision=0;pendingClicks=0;previewHits=[];gameEngine._previewDamage=0;clearTimeout(flushTimer);clearInterval(ticker);clearInterval(ping);flushTimer=null;ticker=null;ping=null;oldDestroy();};
gameEngine.handleClick=e=>{
 if(!active||purchasing||performance.now()-lastClick<1000/CONSTANTS.MAX_CLICKS_PER_SECOND+1)return;lastClick=performance.now();
 if(pendingClicks>=CONSTANTS.CLICK_BURST)return;
 pendingClicks++;previewHits.push({damage:previewDamage(),x:e.clientX,y:e.clientY});refreshPreview();audio.click();
 animations.playClickVisualFeedback(e,state.finalDamage||previewDamage(),false,state.currentLevel%CONSTANTS.BOSS_INTERVAL===0,false);
 if(!clickFlight)flush().catch(()=>{});
};
gameEngine._saveProgress=async()=>{do{await flush();}while(active&&pendingClicks>0);if(active)await send('sync');};
gameEngine.buyClickDamage=()=>command('buyDamage',{},true).catch(()=>{});
gameEngine.ascend=()=>{const count=state.prestigeSummary?.pendingCoins||0;if(confirm('Вознестись за '+count+' монет престижа? Весь обычный прогресс будет сброшен. Вечные бонусы, монеты и покупки сохранятся.'))command('ascend').catch(()=>{});};
gameEngine.buyPrestige=id=>command('buyPrestige',{id},true).catch(()=>{});
gameEngine.buyUfoComboRelay=()=>command('buyUfoComboRelay',{},true).catch(()=>{});
gameEngine.buyUfoUnit=()=>command('buyUfoUnit',{},true).catch(()=>{});
gameEngine.buyUfo=()=>command('buyUfo',{},true).catch(()=>{});
gameEngine.rollbackFive=()=>command('rollbackFive').catch(()=>{});
gameEngine.buySlot=()=>command('buySlot',{},true).catch(()=>{});
gameEngine.buyMoon=id=>command('buyMoon',{id},true).catch(()=>{});
gameEngine.upgradeMoon=id=>command('upgradeMoon',{id},true).catch(()=>{});
gameEngine.toggleMoonActive=id=>command('toggleMoon',{id}).catch(()=>{});
gameEngine.rollbackLevel=()=>command('rollback').catch(()=>{});
gameEngine.toggleLevelLock=()=>command('lock').catch(()=>{});
gameEngine.claimQuestReward=id=>command('claimQuest',{id},true).catch(()=>{});
gameEngine.claimAchievementReward=(id,tier)=>command('claimAchievement',{id,tier},true).catch(()=>{});
gameEngine.resetProgress=()=>command('reset').catch(()=>{});
gameEngine.toggleTestMode=()=>showToast('Тестовый режим отключён в защищённом сезоне','info');

const moonButton=document.getElementById('moonWrapper');moonButton?.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();const r=moonButton.getBoundingClientRect();gameEngine.handleClick({clientX:r.x+r.width/2,clientY:r.y+r.height/2});}});
