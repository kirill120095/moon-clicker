import { getDiagnostics, subscribeDiagnostics, clearDiagnostics, recordDiagnostic, safeDiagnosticMessage } from '../../utils/diagnostics.js';
class OwnerMonitor{
 constructor(){this.client=null;this.timer=null;this.bound=false;this.pending=false;this.nextAt=0;this.unsubscribe=null;this.generation=0;}
 connect(client){
  if(this.client===client)return;
  this.disconnect();this.client=client;
  for(const id of ['gameMonitorSettings','authMonitorSettings'])document.getElementById(id)?.classList.remove('hidden');
  if(!this.bound){this.bound=true;for(const id of ['refreshGameMonitor','refreshAuthMonitor'])document.getElementById(id)?.addEventListener('click',()=>this.refresh(true));document.getElementById('clearLocalMonitor')?.addEventListener('click',()=>clearDiagnostics());}
  if(!this.downloadBound){
   this.downloadBound=true;
   document.getElementById('downloadLocalMonitor')?.addEventListener('click',()=>this.download());
  }
  this.unsubscribe=subscribeDiagnostics(()=>{if(this.visible())this.renderLocal();});this.renderLocal();this.refresh();
  this.timer=setInterval(()=>{if(this.visible()){this.renderLocal();this.refresh();}},15000);
 }
 visible(){
  const settings=document.getElementById('settingsTabContent'),auth=document.getElementById('authScreen');
  return !document.hidden&&(settings?.classList.contains('active')||auth&&!auth.classList.contains('hidden'));
 }
 disconnect(){this.generation++;clearInterval(this.timer);this.timer=null;this.client=null;this.unsubscribe?.();this.unsubscribe=null;for(const id of ['serverGameMonitor','serverAuthMonitor','localGameMonitor','localAuthMonitor']){const el=document.getElementById(id);if(el)el.textContent='';}for(const id of ['gameMonitorSettings','authMonitorSettings'])document.getElementById(id)?.classList.add('hidden');}
 renderLocal(){const text=getDiagnostics().slice().reverse().map(e=>new Date(e.at).toLocaleTimeString('ru-RU')+' ['+e.source+'/'+e.action+'] '+e.code+' '+e.message+(e.count>1?' ×'+e.count:'')).join('\n')||'Ошибок на этом устройстве пока нет.';for(const id of ['localGameMonitor','localAuthMonitor']){const el=document.getElementById(id);if(el)el.textContent=text;}}
 download(){
  if(!this.client)return;
  const now=new Date().toISOString();
  const lines=getDiagnostics().map(entry=>JSON.stringify({...entry,at:new Date(entry.at).toISOString()}));
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='moon-clicker-'+now.replace(/[:.]/g,'-')+'.log';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async refresh(force=false){
  if(!this.client||this.pending||!force&&Date.now()<this.nextAt)return;
  this.pending=true;const generation=this.generation,client=this.client;
  try{
   const {data,error}=await client.rpc('get_game_monitor',{p_limit:100});if(error)throw error;if(generation!==this.generation)return;
   const summary='Ошибок за 24 ч: '+data.stats.errors_24h+' · успешных загрузок: '+data.stats.successful_loads_24h+' · обновлено '+new Date().toLocaleTimeString('ru-RU');
   const text=(data.events||[]).map(e=>new Date(e.created_at).toLocaleTimeString('ru-RU')+' ['+e.action+'] '+e.code+' '+safeDiagnosticMessage(e.message)+(e.request_id?' · '+e.request_id:'')).join('\n')||'Серверных событий пока нет.';
   for(const id of ['serverGameMonitor','serverAuthMonitor']){const el=document.getElementById(id);if(el)el.textContent=summary+'\n'+text;}this.nextAt=Date.now()+15000;
  }catch(error){if(generation!==this.generation)return;this.nextAt=Date.now()+60000;recordDiagnostic('monitor','refresh',error.code||'UNAVAILABLE',error);for(const id of ['serverGameMonitor','serverAuthMonitor']){const el=document.getElementById(id);if(el)el.textContent='Серверный журнал временно недоступен: '+safeDiagnosticMessage(error);}}
  finally{this.pending=false;}
 }
}
export const ownerMonitor=new OwnerMonitor();
