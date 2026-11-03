import { initSupabase } from '../network/supabase.js';
import { audio } from './audio.js';

function trackLabel(name){
 const encoded=name.match(/^\d+-[a-f0-9-]{36}-u([a-f0-9]+)\.[a-z0-9]+$/);
 if(encoded)try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(encoded[1].match(/../g)||[],byte=>parseInt(byte,16)));}catch{}
 return name.replace(/^\d+-[a-f0-9-]{36}-/,'');
}
/** All listeners derive the same track and position, even while the owner is offline. */
export function radioPlayback(row,now=Date.now()){
 if(!row?.track_path)return null;
 const tracks=row.schedule||[];
 if(!tracks.length)return {path:row.track_path,title:row.title,index:0,offset:null,legacy:true};
 const anchor=Math.min(tracks.length-1,Math.max(0,row.track_index||0));
 let elapsed=Math.max(0,(now-Date.parse(row.started_at))/1000);
 if(row.repeat_track){const t=tracks[anchor];return {...t,index:anchor,offset:elapsed/t.duration>=0?elapsed%t.duration:0};}
 const indices=row.repeat_playlist?tracks.map((_,i)=>(anchor+i)%tracks.length):tracks.map((_,i)=>i).slice(anchor);
 const total=indices.reduce((n,i)=>n+tracks[i].duration,0);
 if(!(total>0)||!Number.isFinite(elapsed))return null;
 if(row.repeat_playlist)elapsed%=total;else if(elapsed>=total)return null;
 for(const index of indices){const t=tracks[index];if(elapsed<t.duration)return {...t,index,offset:elapsed};elapsed-=t.duration;}
 return null;
}
function readDuration(source){
 return new Promise((resolve,reject)=>{
  const media=new Audio();media.preload='metadata';
  const timer=setTimeout(()=>finish(Error('Не удалось прочитать длительность трека.')),20000);
  function finish(error){clearTimeout(timer);media.onloadedmetadata=null;media.onerror=null;media.removeAttribute('src');media.load();if(error)reject(error);else resolve(media.duration);}
  media.onloadedmetadata=()=>{const duration=media.duration;if(!(duration>0)||!Number.isFinite(duration)){finish(Error('У аудиофайла нет конечной длительности.'));return;}
   clearTimeout(timer);media.onloadedmetadata=null;media.onerror=null;media.removeAttribute('src');media.load();resolve(duration);};
  media.onerror=()=>finish(Error('Браузер не смог прочитать аудиофайл.'));media.src=source;
 });
}
class GameRadio{
 constructor(){this.client=null;this.channel=null;this.timer=null;this.tickTimer=null;this.userId=null;this.current=null;this.player=null;this.bound=false;this.admin=false;this.playlists=[];this.selectedId=null;this.library=[];this.playingKey=null;this.busy=false;}
 async connect(user){
  if(this.userId===user?.id)return;
  this.disconnect();this.userId=user?.id;if(!this.userId)return;
  this.client=await initSupabase();
  if(!this.player){this.player=new Audio();this.player.preload='metadata';this.player.addEventListener('loadedmetadata',()=>this.tick());this.player.addEventListener('ended',()=>this.tick());this.player.addEventListener('error',()=>{audio.radioActive=false;audio.apply();this.status('Не удалось воспроизвести трек.');});}
  audio.radioElement=this.player;this.bind();
  await this.refresh();
  const {data,error}=await this.client.rpc('is_radio_admin');if(error)throw error;
  this.admin=data===true;document.getElementById('radioAdmin')?.classList.toggle('hidden',!this.admin);
  if(this.admin){await this.listPlaylists();await this.listTracks();}
  this.channel=this.client.channel('moon-radio').on('postgres_changes',{event:'UPDATE',schema:'public',table:'game_radio',filter:'id=eq.1'},event=>this.accept(event.new)).subscribe(status=>{if(status==='SUBSCRIBED')this.refresh().catch(()=>{});});
  this.timer=setInterval(()=>{if(!document.hidden)this.refresh().catch(()=>{});},15000);
  this.tickTimer=setInterval(()=>{if(!document.hidden)this.tick();},500);
 }
 async refresh(){const {data,error}=await this.client.from('game_radio').select('*').eq('id',1).single();if(error)throw error;this.accept(data);}
 accept(row){if(!row||this.current?.version===row.version)return;this.current=row;this.playingKey=null;this.tick();this.renderModes();}
 tick(){
  if(!this.player)return;
  const track=radioPlayback(this.current);
  const label=document.getElementById('radioNowPlaying');if(label)label.textContent=track?'В эфире: '+track.title:'Космический фон';
  if(!track){if(this.playingKey!==null||this.player.getAttribute('src')){this.player.pause();this.player.removeAttribute('src');this.player.load();}this.playingKey=null;audio.radioActive=false;audio.apply();return;}
  audio.radioActive=true;audio.apply();
  const key=this.current.version+':'+track.index+':'+track.path;
  if(this.playingKey!==key){
   this.playingKey=key;this.player.loop=track.legacy||this.current.repeat_track;
   this.player.src=this.client.storage.from('game-radio').getPublicUrl(track.path).data.publicUrl;this.player.load();
  }
  if(this.player.readyState>=1){
   const offset=track.legacy?Math.max(0,(Date.now()-Date.parse(this.current.started_at))/1000)%this.player.duration:track.offset;
   if(Number.isFinite(offset)&&Math.abs(this.player.currentTime-offset)>1.5)this.player.currentTime=offset;
  }
  if(!document.hidden&&this.player.paused)this.player.play().catch(()=>{});
 }
 play(){this.tick();}
 disconnect(){clearInterval(this.timer);clearInterval(this.tickTimer);this.timer=null;this.tickTimer=null;if(this.channel)this.client?.removeChannel(this.channel);this.channel=null;this.player?.pause();this.current=null;this.playingKey=null;this.userId=null;this.admin=false;this.playlists=[];this.selectedId=null;audio.radioActive=false;audio.radioElement=null;audio.apply();document.getElementById('radioAdmin')?.classList.add('hidden');}
 status(text){const el=document.getElementById('radioStatus');if(el)el.textContent=text;}
 async run(task){
  if(this.busy)return;this.busy=true;
  const buttons=[...document.querySelectorAll('#radioAdmin button')];buttons.forEach(b=>b.disabled=true);
  try{await task();}catch(error){this.status(error.message||'Не удалось изменить радио.');}finally{this.busy=false;buttons.forEach(b=>b.disabled=false);this.renderPlaylist();this.renderModes();}
 }
 selected(){return this.playlists.find(p=>p.id===this.selectedId);}
 async listPlaylists(){
  const {data,error}=await this.client.from('radio_playlists').select('*').order('updated_at',{ascending:false});if(error)throw error;
  this.playlists=data||[];if(!this.selected())this.selectedId=this.playlists[0]?.id||null;this.renderPlaylist();
 }
 renderPlaylist(){
  const select=document.getElementById('radioPlaylists');if(!select)return;select.replaceChildren();
  if(!this.playlists.length){const option=document.createElement('option');option.textContent='Создайте первый плейлист';option.value='';select.appendChild(option);}
  for(const p of this.playlists){const option=document.createElement('option');option.value=p.id;option.textContent=p.title+' · '+p.tracks.length+' треков';select.appendChild(option);}
  select.value=this.selectedId||'';
  const playlist=this.selected(),list=document.getElementById('radioPlaylistItems');if(!list)return;list.replaceChildren();
  for(const [index,track] of (playlist?.tracks||[]).entries()){
   const row=document.createElement('li'),title=document.createElement('span');title.textContent=(index+1)+'. '+track.title;row.appendChild(title);
   for(const [action,label] of [['up','↑'],['down','↓'],['remove','×']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.radioEdit=action;button.dataset.index=String(index);button.setAttribute('aria-label',(action==='up'?'Выше: ':action==='down'?'Ниже: ':'Убрать: ')+track.title);button.disabled=this.busy||action==='up'&&index===0||action==='down'&&index===playlist.tracks.length-1;row.appendChild(button);}
   list.appendChild(row);
  }
  if(!playlist?.tracks.length){const li=document.createElement('li');li.textContent='Добавьте аудиофайлы или выберите треки из библиотеки.';list.appendChild(li);}
 }
 renderModes(){
  for(const [id,active] of [['radioRepeatTrack',this.current?.repeat_track],['radioRepeatPlaylist',this.current?.repeat_playlist]]){const b=document.getElementById(id);if(b){b.setAttribute('aria-pressed',String(!!active));b.classList.toggle('active',!!active);}}
 }
 async savePlaylist(playlist){
  const {data,error}=await this.client.rpc('radio_playlist_save',{p_id:playlist.id||null,p_title:playlist.title,p_tracks:playlist.tracks});if(error)throw error;
  const saved=Array.isArray(data)?data[0]:data;this.selectedId=saved.id;await this.listPlaylists();return saved;
 }
 async createPlaylist(){
  const name=document.getElementById('radioPlaylistName').value.trim();if(!name)throw Error('Введите название нового плейлиста.');
  await this.savePlaylist({title:name,tracks:[]});document.getElementById('radioPlaylistName').value='';this.status('Плейлист создан. Добавьте в него треки.');
 }
 async deletePlaylist(){
  if(!this.selected())throw Error('Сначала выберите плейлист.');
  const {error}=await this.client.rpc('radio_playlist_delete',{p_id:this.selectedId});if(error)throw error;
  this.selectedId=null;await this.listPlaylists();await this.refresh();this.status('Плейлист удалён. Аудиофайлы остались в библиотеке.');
 }
 async editPlaylist(index,action){
  const p=this.selected();if(!p)return;const tracks=[...p.tracks];
  if(action==='remove')tracks.splice(index,1);else {const next=index+(action==='up'?-1:1);if(next<0||next>=tracks.length)return;[tracks[index],tracks[next]]=[tracks[next],tracks[index]];}
  await this.savePlaylist({...p,tracks});this.status('Плейлист сохранён. Изменения вступят в эфир после нажатия «Воспроизвести».');
 }
 async listTracks(){
  let all=[],offset=0;
  for(;;){const {data,error}=await this.client.storage.from('game-radio').list('',{limit:100,offset,sortBy:{column:'created_at',order:'desc'}});if(error)throw error;all.push(...(data||[]).filter(i=>i.id));if((data||[]).length<100)break;offset+=100;}
  const {data:metadata,error:metadataError}=await this.client.from('radio_library').select('path,title,duration');if(metadataError)throw metadataError;
  const byPath=new Map((metadata||[]).map(t=>[t.path,t]));this.library=all.map(item=>({...item,...byPath.get(item.name)}));const select=document.getElementById('radioTracks');if(!select)return;select.replaceChildren();
  for(const item of this.library){const option=document.createElement('option');option.value=item.name;option.textContent=item.title||trackLabel(item.name);select.appendChild(option);}
 }
 async addLibrary(){
  const playlist=this.selected();if(!playlist)throw Error('Сначала создайте или выберите плейлист.');
  const paths=[...document.getElementById('radioTracks').selectedOptions].map(o=>o.value);if(!paths.length)throw Error('Выберите треки в библиотеке.');
  const tracks=[...playlist.tracks];
  for(const path of paths){const saved=this.library.find(t=>t.name===path),url=this.client.storage.from('game-radio').getPublicUrl(path).data.publicUrl;const duration=saved?.duration||await readDuration(url);tracks.push({path,title:saved?.title||trackLabel(path).replace(/\.[^.]+$/,''),duration});}
  await this.savePlaylist({...playlist,tracks});this.status('Треки добавлены в плейлист.');
 }
 async upload(){
  const input=document.getElementById('radioFile'),files=[...(input?.files||[])],playlist=this.selected();
  if(!playlist)throw Error('Сначала создайте или выберите плейлист.');if(!files.length)throw Error('Выберите аудиофайлы.');
  const extensions={mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',webm:'audio/webm'};
  let tracks=[...playlist.tracks],count=0;
  for(const file of files){
   if(file.size>20*1024*1024)throw Error(file.name+': максимальный размер — 20 МБ.');
   const ext=file.name.split('.').pop()?.toLowerCase();if(!Object.hasOwn(extensions,ext))throw Error('Выберите MP3, OGG, WAV, M4A, AAC, FLAC или WEBM.');
   this.status('Загрузка '+(count+1)+'/'+files.length+': '+file.name);
   const localUrl=URL.createObjectURL(file);let duration;try{duration=await readDuration(localUrl);}finally{URL.revokeObjectURL(localUrl);}
   // ASCII key AND raw bytes: no original Unicode name in URL or multipart headers.
   const name=Date.now()+'-'+crypto.randomUUID()+'.'+ext;
   const bytes=await file.arrayBuffer();
   const {error}=await this.client.storage.from('game-radio').upload(name,bytes,{contentType:extensions[ext],upsert:false,cacheControl:'31536000'});if(error)throw error;
   const title=file.name.replace(/\.[^.]+$/,'');
   const {error:metadataError}=await this.client.rpc('radio_track_save',{p_path:name,p_title:title,p_duration:duration});if(metadataError)throw metadataError;
   tracks.push({path:name,title,duration});await this.savePlaylist({...playlist,tracks});count++;
  }
  input.value='';await this.listTracks();this.status('Загружено '+count+' треков. Нажмите «Воспроизвести плейлист».');
 }
 async control(action,extra={}){
  const {data,error}=await this.client.rpc('radio_control',{p_action:action,p_expected:this.current?.version??null,...extra});
  if(error){await this.refresh();throw error;}this.accept(Array.isArray(data)?data[0]:data);this.status('Эфир обновлён для всех игроков.');
 }
 async step(direction){
  const tracks=this.current?.schedule||[];if(!tracks.length)throw Error('Сначала включите плейлист.');
  const active=radioPlayback(this.current),index=active?.index??this.current.track_index;
  const next=(index+direction+tracks.length)%tracks.length;await this.control('seek',{p_index:next});
 }
 async repeat(kind){
  const track=radioPlayback(this.current);if(!track||track.legacy)throw Error('Сначала включите плейлист.');
  await this.control('mode',{p_index:track.index,p_offset:track.offset,[kind==='track'?'p_repeat_track':'p_repeat_playlist']:!this.current[kind==='track'?'repeat_track':'repeat_playlist']});
 }
 bind(){
  if(this.bound)return;this.bound=true;
  const bind=(id,fn)=>document.getElementById(id)?.addEventListener('click',()=>this.run(fn));
  bind('radioCreate',()=>this.createPlaylist());bind('radioDelete',()=>this.deletePlaylist());bind('radioAddTracks',()=>this.addLibrary());bind('radioUpload',()=>this.upload());
  bind('radioSwitch',()=>this.control('play',{p_playlist:this.selectedId}));bind('radioStop',()=>this.control('stop'));
  bind('radioPrev',()=>this.step(-1));bind('radioNext',()=>this.step(1));bind('radioRepeatTrack',()=>this.repeat('track'));bind('radioRepeatPlaylist',()=>this.repeat('playlist'));
  document.getElementById('radioPlaylists')?.addEventListener('change',event=>{if(this.busy){this.renderPlaylist();return;}this.selectedId=event.target.value;this.renderPlaylist();});
  document.getElementById('radioPlaylistItems')?.addEventListener('click',event=>{const b=event.target.closest('[data-radio-edit]');if(b)this.run(()=>this.editPlaylist(Number(b.dataset.index),b.dataset.radioEdit));});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.player?.pause();else if(this.userId){this.refresh().catch(()=>{});this.play();}});
 }
}
export const radio=new GameRadio();
