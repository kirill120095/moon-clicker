import { gameEngine } from './game.js';
import { appState, state } from '../../core/state.js';
import { CONSTANTS } from '../../core/constants.js';
import { db } from '../network/supabase.js';
import { animations } from '../ui/animations.js';
import { audio } from '../ui/audio.js';
import { showToast, updateUI,updateShopUI,updateProfileAndLeaders,updateQuestAndAchievementUI,updateTimerBar,updateHPBar } from '../ui/renderer.js';
let previewHits=[];
function refreshPreview(){gameEngine._previewDamage=previewHits.reduce((sum,hit)=>sum+hit.damage,0);updateHPBar();}
function previewDamage(){
 const bonuses=gameEngine._calculateAllBonuses();let multiplier=1+bonuses.totalDamageBonus;
 for(const [id,counter] of [['normal','_comboClicks'],['fire','_fireStacks']]){
  const params=gameEngine._getMechanicParamsForActiveMoon(id);
  if(params)multiplier+=Math.min(params.maxStacks,Math.floor(((gameEngine[counter]||0)+previewHits.length+1)/params.clicksPerStack))*params.bonusPerStack;
 }
 return Math.max(1,Math.round(state.playerData.click_damage*multiplier));
}
let nextUfoSync=0;
let active=false,pendingClicks=0,flushTimer=null,ticker=null,ping=null,lastClick=0,offset=0,deadline=null,syncing=false,purchasing=false,clickFlight=null,nextBuffSync=0;
function apply(result,hits=[]){
 const s=result.state;if(!s)throw Error('Сервер не вернул прогресс');
 offset=result.serverNow-Date.now();deadline=s.bossDeadline;gameEngine.combat._totalDuration=s.bossDuration||CONSTANTS.BOSS_TIMER;
 appState.setMany({maxLevel:s.maxLevel,ufoLevel:s.ufoLevel||0,ufoDamage:s.ufoDamage,ufoInterval:s.ufoInterval,ufoNextShotAt:s.ufoNextShotAt,finalDamage:s.finalDamage,moonReward:s.moonReward,ufoMoonReward:s.ufoMoonReward,currentLevel:s.currentLevel,moonHP:s.moonHP,maxHP:s.maxHP,
 clickCount:s.clickCount,totalSecondsPlayed:s.totalSecondsPlayed,playerData:s.playerData,
 activeMoon:s.activeMoon,activeMoons:s.activeMoons,ownedMoons:s.ownedMoons,moonLevels:s.moonLevels,
 maxSlots:s.maxSlots,bossKills:s.bossKills,quests:s.quests,achievements:s.achievements,
 levelLocked:s.levelLocked,testMode:false,bossTimerRunning:!!deadline,
 bossTimer:deadline?Math.max(0,(deadline-result.serverNow)/1000):30});
 Object.assign(gameEngine,s.runtime||{});
 gameEngine._lastActivityTime=s.lastClickAt?s.lastClickAt-offset:Date.now();
 gameEngine.recalcMoonBonuses();gameEngine._updateBuffsDisplay();updateUI();updateShopUI();updateQuestAndAchievementUI();
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохранено на сервере';
 const orbit=document.getElementById('ufoOrbit');orbit?.classList.toggle('hidden',!s.ufoLevel);
 let index=0;
 for(const event of s.effects||[]){
  const rect=document.getElementById('moonWrapper')?.getBoundingClientRect();
  if(!rect)continue;
  const position=event.source==='manual'?hits[index++]:null;
  animations.showDamageNumber(position?.x??rect.x+rect.width/2,position?.y??rect.y+rect.height/2,event.damage,event.isCrit,event.isBoss);
  if(event.source==='ufo'){animations.playUfoShot();audio.shoot(true);}
  if(event.reward>0)animations.showMoonReward(event.reward);
 }

}
async function send(action,payload={}){
 const status=document.getElementById('saveStatus');if(status)status.textContent='Сохраняем…';
 try{const result=await db.action(action,payload);
  const hits=action==='click'?previewHits.splice(0,payload.count):[];
  gameEngine._previewDamage=previewHits.reduce((sum,hit)=>sum+hit.damage,0);
  if(active)apply(result,hits);return result;}
 catch(error){if(action==='click'){previewHits.splice(0,payload.count);refreshPreview();}if(status)status.textContent='Нет связи — действие не подтверждено';showToast(error.message,'warning');throw error;}
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
 if(purchase)purchasing=true;
 try{await flush();await send(action,payload);if(purchase)audio.purchase();updateProfileAndLeaders();}
 finally{purchasing=false;}
}
const oldDestroy=gameEngine.destroy.bind(gameEngine);
gameEngine.init=async()=>{
 active=true;gameEngine._isRunning=true;
 try{apply(await db.action('load'));}catch(error){active=false;gameEngine._isRunning=false;throw error;}
 if(ticker)clearInterval(ticker);if(ping)clearInterval(ping);
 ticker=setInterval(()=>{
  if(!active)return;
  gameEngine._updateBuffsDisplay();
  if(state.ufoLevel&&state.ufoNextShotAt<=Date.now()+offset&&!document.hidden&&!syncing&&!clickFlight&&Date.now()>=nextUfoSync){
   nextUfoSync=Date.now()+1000;syncing=true;
   send('sync').catch(()=>{}).finally(()=>{syncing=false;});
  }
  const expired=gameEngine._getActiveBuffs().some(buff=>buff.isTemporary&&buff.timeLeft===0);
  if(expired&&!syncing&&Date.now()>=nextBuffSync){
   nextBuffSync=Date.now()+2000;syncing=true;
   send('sync').catch(()=>{}).finally(()=>{syncing=false;});
  }
  if(deadline){appState.set('bossTimer',Math.max(0,(deadline-Date.now()-offset)/1000));updateTimerBar();
   if(deadline<=Date.now()+offset&&!syncing){syncing=true;send('sync').catch(()=>{}).finally(()=>{syncing=false;});}}
 },250);
 ping=setInterval(()=>{if(active&&!document.hidden)send('sync').catch(()=>{});},20000);
 updateProfileAndLeaders();
};
gameEngine.destroy=()=>{active=false;pendingClicks=0;previewHits=[];gameEngine._previewDamage=0;clearTimeout(flushTimer);clearInterval(ticker);clearInterval(ping);flushTimer=null;ticker=null;ping=null;oldDestroy();};
gameEngine.handleClick=e=>{
 if(!active||performance.now()-lastClick<1000/CONSTANTS.MAX_CLICKS_PER_SECOND+1)return;lastClick=performance.now();
 if(pendingClicks>=CONSTANTS.CLICK_BURST)return;
 pendingClicks++;previewHits.push({damage:previewDamage(),x:e.clientX,y:e.clientY});refreshPreview();audio.click();
 animations.playClickVisualFeedback(e,state.finalDamage||previewDamage(),false,state.currentLevel%CONSTANTS.BOSS_INTERVAL===0,false);
 if(!clickFlight)flush().catch(()=>{});
};
gameEngine._saveProgress=async()=>{do{await flush();}while(active&&pendingClicks>0);if(active)await send('sync');};
gameEngine.buyClickDamage=()=>command('buyDamage',{},true).catch(()=>{});
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
