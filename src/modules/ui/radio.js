import { initSupabase } from '../network/supabase.js';
import { audio } from './audio.js';
import { showToast } from './renderer.js';

function trackLabel(name){
 const encoded=name.match(/^\d+-[a-f0-9-]{36}-u([a-f0-9]+)\.[a-z0-9]+$/);
 if(encoded)try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(encoded[1].match(/../g)||[],byte=>parseInt(byte,16)));}catch{}
 return name.replace(/^\d+-[a-f0-9-]{36}-/,'');
}
class GameRadio {
 constructor(){this.client=null;this.channel=null;this.timer=null;this.userId=null;this.current=null;this.player=null;this.bound=false;this.admin=false;}
 async connect(user){
  if(this.userId===user?.id)return;
  this.disconnect();this.userId=user?.id;if(!this.userId)return;
  this.client=await initSupabase();
  if(!this.player){this.player=new Audio();this.player.loop=true;this.player.preload='metadata';this.player.addEventListener('loadedmetadata',()=>this.seek());this.player.addEventListener('error',()=>{audio.radioActive=false;this.status('Не удалось воспроизвести трек.');});}
  audio.radioElement=this.player;
  this.bind();
  await this.refresh();
  const {data}=await this.client.rpc('is_radio_admin');
  this.admin=data===true;
  document.getElementById('radioAdmin')?.classList.toggle('hidden',!this.admin);
  if(this.admin)await this.listTracks();
  this.channel=this.client.channel('moon-radio').on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_radio',filter:'id=eq.1'},event=>this.accept(event.new)).subscribe(status=>{if(status==='SUBSCRIBED')this.refresh().catch(()=>{});});
  this.timer=setInterval(()=>{if(!document.hidden)this.refresh().catch(()=>{});},15000);
 }
 async refresh(){const {data,error}=await this.client.from('game_radio').select('id,track_path,title,started_at,version').eq('id',1).single();if(error)throw error;this.accept(data);}
 accept(row){
  if(!row||this.current?.version===row.version)return;this.current=row;
  const title=document.getElementById('radioNowPlaying');if(title)title.textContent=row.track_path?'В эфире: '+row.title:'Космический фон';
  if(!row.track_path){this.player.pause();this.player.removeAttribute('src');audio.radioActive=false;audio.apply();return;}
  audio.radioActive=true;this.player.src=this.client.storage.from('game-radio').getPublicUrl(row.track_path).data.publicUrl;
  audio.apply();this.player.load();this.play();
 }
 seek(){if(!this.current?.track_path||!Number.isFinite(this.player.duration)||!this.player.duration)return;this.player.currentTime=Math.max(0,(Date.now()-Date.parse(this.current.started_at))/1000)%this.player.duration;}
 play(){if(!this.player?.src||document.hidden)return;this.seek();this.player.play().catch(()=>{});}
 disconnect(){clearInterval(this.timer);this.timer=null;if(this.channel)this.client?.removeChannel(this.channel);this.channel=null;this.player?.pause();this.current=null;this.userId=null;this.admin=false;audio.radioActive=false;audio.radioElement=null;audio.apply();document.getElementById('radioAdmin')?.classList.add('hidden');}
 status(text){const el=document.getElementById('radioStatus');if(el)el.textContent=text;}
 async listTracks(){
  const {data,error}=await this.client.storage.from('game-radio').list('',{limit:100,sortBy:{column:'created_at',order:'desc'}});if(error)throw error;
  const select=document.getElementById('radioTracks');if(!select)return;
  select.replaceChildren();for(const item of data||[]){if(!item.id)continue;const option=document.createElement('option');option.value=item.name;option.textContent=trackLabel(item.name);select.appendChild(option);}
 }
 async publish(path,title){const {data,error}=await this.client.rpc('radio_publish',{p_path:path,p_title:title});if(error)throw error;this.accept(Array.isArray(data)?data[0]:data);this.status(path?'Трек включён для всех игроков.':'Общий трек остановлен.');}
 async upload(){
  const input=document.getElementById('radioFile'),file=input?.files?.[0];if(!file){this.status('Выберите аудиофайл.');return;}
  if(file.size>20*1024*1024){this.status('Максимальный размер — 20 МБ.');return;}
  const extensions={mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',webm:'audio/webm'};
  const ext=file.name.split('.').pop()?.toLowerCase();if(!extensions[ext]){this.status('Выберите MP3, OGG, WAV, M4A, AAC или FLAC.');return;}
  const button=document.getElementById('radioUpload');button.disabled=true;this.status('Загружаем трек…');
  try{const name=Date.now()+'-'+crypto.randomUUID()+'-u'+Array.from(new TextEncoder().encode(file.name),byte=>byte.toString(16).padStart(2,'0')).join('')+'.'+ext;
   const {error}=await this.client.storage.from('game-radio').upload(name,file,{contentType:extensions[ext],upsert:false,cacheControl:'31536000'});if(error)throw error;
   await this.publish(name,file.name.replace(/\.[^.]+$/,''));await this.listTracks();input.value='';
  }catch(error){this.status('Не удалось загрузить трек. '+error.message);}finally{button.disabled=false;}
 }
 bind(){
  if(this.bound)return;this.bound=true;
  document.getElementById('radioUpload')?.addEventListener('click',()=>this.upload());
  document.getElementById('radioSwitch')?.addEventListener('click',async()=>{const select=document.getElementById('radioTracks');if(!select?.value)return;try{await this.publish(select.value,select.selectedOptions[0].textContent.replace(/\.[^.]+$/,''));}catch(error){this.status(error.message);}});
  document.getElementById('radioStop')?.addEventListener('click',()=>this.publish(null,'').catch(error=>this.status(error.message)));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.player?.pause();else if(this.userId){this.refresh().catch(()=>{});this.play();}});
 }
}
export const radio=new GameRadio();
