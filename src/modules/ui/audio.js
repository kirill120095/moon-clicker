const KEY='moon_audio_v1';
const defaults={muted:false,music:0.14,effects:0.45};
export class AudioEngine {
 constructor(){
  this.settings={...defaults};this.ctx=null;this.musicTimer=null;this.lastClick=0;
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');for(const k of ['music','effects'])if(Number.isFinite(saved[k]))this.settings[k]=Math.max(0,Math.min(1,saved[k]));if(typeof saved.muted==='boolean')this.settings.muted=saved.muted;}catch{}
 }
 unlock(){
  try{
   if(!this.ctx){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    this.ctx=new Context();this.master=this.ctx.createGain();this.musicBus=this.ctx.createGain();this.fxBus=this.ctx.createGain();
    this.master.connect(this.ctx.destination);this.musicBus.connect(this.master);this.fxBus.connect(this.master);this.apply();}
   if(this.radioElement?.src&&!document.hidden)this.radioElement.play().catch(()=>{});
   if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
   if(!this.musicTimer&&!document.hidden){this.music();this.musicTimer=setInterval(()=>this.music(),6000);}
  }catch{}
 }
 apply(){
  if(this.radioElement){this.radioElement.volume=this.settings.music;this.radioElement.muted=this.settings.muted;}
  if(this.ctx){const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(this.settings.muted?0:1,t,0.025);this.musicBus.gain.setTargetAtTime(this.radioActive?0:this.settings.music,t,0.04);this.fxBus.gain.setTargetAtTime(this.settings.effects,t,0.025);}
  document.querySelectorAll('[data-audio-volume]').forEach(el=>{el.value=Math.round(this.settings[el.dataset.audioVolume]*100);});
  document.querySelectorAll('[data-audio-output]').forEach(el=>{el.textContent=Math.round(this.settings[el.dataset.audioOutput]*100)+'%';});
  document.querySelectorAll('[data-audio-mute]').forEach(el=>{el.checked=this.settings.muted;});
  const summary=document.getElementById('audioSummary');if(summary)summary.textContent=this.settings.muted?'Звук выключен':'Звук';
 }
 set(name,value){if(name==='muted')this.settings.muted=!!value;else if(['music','effects'].includes(name))this.settings[name]=Math.max(0,Math.min(1,Number(value)||0));else return;
  try{localStorage.setItem(KEY,JSON.stringify(this.settings));}catch{}this.apply();}
 tone(frequency,duration,bus,volume=0.2,type='sine',delay=0){
  if(!this.ctx||this.ctx.state!=='running'||this.settings.muted)return;
  const t=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+Math.min(0.02,duration/4));gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);
  osc.connect(gain);gain.connect(bus);osc.start(t);osc.stop(t+duration+0.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 click(){this.shoot();}
 shoot(soft=false){
  this.unlock();if(!this.ctx||this.ctx.state!=='running'||this.settings.muted||this.settings.effects===0||this.ctx.currentTime-this.lastClick<0.045)return;
  this.lastClick=this.ctx.currentTime;
  const t=this.ctx.currentTime,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
  osc.type='sawtooth';osc.frequency.setValueAtTime(soft?1100:1600,t);osc.frequency.exponentialRampToValueAtTime(90,t+0.12);
  gain.gain.setValueAtTime(soft?0.055:0.11,t);gain.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
  osc.connect(gain);gain.connect(this.fxBus);osc.start(t);osc.stop(t+0.15);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 ui(){this.unlock();this.tone(680,0.045,this.fxBus,0.08,'sine');}
 purchase(){this.unlock();[523.25,659.25,783.99].forEach((f,i)=>this.tone(f,0.22,this.fxBus,0.15,'triangle',i*0.07));}
 music(){if(this.radioActive||!this.ctx||document.hidden||this.settings.music===0)return;
  const chords=[[130.81,196,261.63],[110,164.81,220],[146.83,220,293.66],[98,146.83,196]];
  const chord=chords[this.chordIndex||0];this.chordIndex=((this.chordIndex||0)+1)%chords.length;
  chord.forEach((f,i)=>this.tone(f,5.8,this.musicBus,0.11,'sine',i*0.12));
 }
 bind(){
  const unlock=()=>this.unlock();document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock,{passive:true});
  document.addEventListener('input',e=>{const el=e.target;if(el.matches?.('[data-audio-volume]'))this.set(el.dataset.audioVolume,Number(el.value)/100);});
  document.addEventListener('change',e=>{if(e.target.matches?.('[data-audio-mute]'))this.set('muted',e.target.checked);});
  document.addEventListener('click',e=>{if(e.target.closest?.('button'))this.ui();if(e.target.closest?.('[data-open-audio]')){const panel=document.getElementById('audioSettings');if(panel){panel.open=true;panel.querySelector('input')?.focus();}}});
  document.addEventListener('visibilitychange',()=>{clearInterval(this.musicTimer);this.musicTimer=null;if(document.hidden){this.ctx?.suspend().catch(()=>{});}else if(this.ctx)this.unlock();});
  const reduce=document.getElementById('reduceEffects');
  try{if(localStorage.getItem('moon_reduce_effects')==='true'){document.documentElement.classList.add('reduce-effects');if(reduce)reduce.checked=true;}}catch{}
  reduce?.addEventListener('change',()=>{document.documentElement.classList.toggle('reduce-effects',reduce.checked);try{localStorage.setItem('moon_reduce_effects',String(reduce.checked));}catch{}});
  this.apply();
 }
}
export const audio=new AudioEngine();
audio.bind();
