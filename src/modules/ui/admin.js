import { ownerMonitor } from './monitor.js';
import { initSupabase } from '../network/supabase.js';

export const RESET_PHRASE='СБРОСИТЬ ВЕСЬ ПРОГРЕСС';
class GameAdmin{
 constructor(){this.userId=null;this.client=null;this.allowed=false;this.bound=false;this.step=1;this.busy=false;this.generation=0;this.requestId=null;}
 async connect(user){
  if(this.userId===user?.id&&this.client)return;
  const generation=++this.generation;this.userId=user?.id;this.allowed=false;this.hide();
  if(!this.userId)return;this.bind();const client=await initSupabase();
  const {data,error}=await client.rpc('is_game_admin');
  if(generation!==this.generation)return;
  if(error)throw error;this.client=client;this.allowed=data===true;
  document.getElementById('gameAdminSettings')?.classList.toggle('hidden',!this.allowed);
  if(this.allowed)ownerMonitor.connect(client);
 }
 disconnect(){ownerMonitor.disconnect();this.generation++;this.userId=null;this.allowed=false;this.client=null;this.requestId=null;this.hide();this.dialog()?.close();}
 hide(){document.getElementById('gameAdminSettings')?.classList.add('hidden');}
 dialog(){return document.getElementById('globalResetDialog');}
 bind(){
  if(this.bound)return;this.bound=true;
  document.getElementById('resetAllProgressBtn')?.addEventListener('click',()=>this.open());
  document.getElementById('globalResetNext')?.addEventListener('click',()=>this.advance());
  document.getElementById('globalResetCancel')?.addEventListener('click',()=>{if(!this.busy)this.dialog()?.close();});
  document.getElementById('globalResetPhrase')?.addEventListener('input',()=>this.render());
  this.dialog()?.addEventListener('cancel',event=>{if(this.busy)event.preventDefault();});
 }
 open(){
  if(!this.allowed||this.busy||this.dialog()?.open)return;
  this.step=1;document.getElementById('globalResetPhrase').value='';
  document.getElementById('globalResetError').textContent='';this.render();this.dialog().showModal();document.getElementById('globalResetCancel').focus();
 }
 render(){
  const titles=['Предупреждение 1 из 3','Предупреждение 2 из 3','Последнее предупреждение · 3 из 3'];
  const messages=[
   'Это сброс прогресса ВСЕХ игроков, включая ваш аккаунт. Действие нельзя отменить через игру.',
   'Будут обнулены уровни, рекорды, кристаллы, луны, тарелки, задания, достижения, престиж, монеты престижа и вечные улучшения. Для продолжения введите фразу ниже.',
   'Вы собираетесь обнулить прогресс всех игроков. Аккаунты, пароли, музыка и плейлисты сохранятся. Нажатие красной кнопки выполнит общий сброс.'
  ];
  document.getElementById('globalResetTitle').textContent=titles[this.step-1];
  document.getElementById('globalResetMessage').textContent=messages[this.step-1];
  document.getElementById('globalResetPhraseRow').classList.toggle('hidden',this.step!==2);
  const next=document.getElementById('globalResetNext'),phrase=document.getElementById('globalResetPhrase');
  next.textContent=this.busy?'Сбрасываем…':this.step===3?'Сбросить прогресс ВСЕХ игроков':'Продолжить';
  next.classList.toggle('reset-final',this.step===3);
  next.disabled=this.busy||this.step===2&&phrase.value!==RESET_PHRASE;
  phrase.disabled=this.busy;document.getElementById('globalResetCancel').disabled=this.busy;
 }
 async advance(){
  if(!this.allowed||this.busy||!this.dialog()?.open)return;
  if(this.step===1){this.step=2;this.render();document.getElementById('globalResetPhrase').focus();return;}
  if(document.getElementById('globalResetPhrase').value!==RESET_PHRASE)return;
  if(this.step===2){this.step=3;this.render();document.getElementById('globalResetCancel').focus();return;}
  const userId=this.userId,client=this.client,key='moon_global_reset_request_'+userId;
  this.busy=true;document.getElementById('globalResetError').textContent='';this.render();
  try{
   try{this.requestId=sessionStorage.getItem(key)||this.requestId;}catch{}
   this.requestId=this.requestId||crypto.randomUUID();
   try{sessionStorage.setItem(key,this.requestId);}catch{}
   const {error}=await client.rpc('admin_reset_all_progress',{p_request:this.requestId,p_confirmation:RESET_PHRASE});
   if(error)throw error;
   try{sessionStorage.removeItem(key);}catch{}
   this.requestId=null;
   if(this.userId===userId){this.dialog().close();window.location.reload();}
  }catch(error){
   if(this.userId===userId)document.getElementById('globalResetError').textContent='Не удалось подтвердить результат: '+error.message+'. Повтор запроса безопасен: тот же сброс не выполнится дважды.';
  }finally{this.busy=false;this.render();}
 }
}
export const gameAdmin=new GameAdmin();
