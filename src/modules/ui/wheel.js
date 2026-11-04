import { CONSTANTS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { audio } from './audio.js';

export function wheelStopAngle(index, count, from=0) {
 const offset=Array.isArray(count)?(count.slice(0,index).reduce((n,w)=>n+w,0)+count[index]/2)*360/count.reduce((n,w)=>n+w,0):index*360/count;
 const target=((360-offset)%360+360)%360;
 return from+360*7+((target-from%360+360)%360);
}
export class FortuneWheel {
 constructor(){this.allowed=false;this.busy=false;this.generation=0;this.animations=[];this.angle=0;this.timer=null;}
 bind(spin){this.spin=spin;}
 connect(allowed){
  this.disconnect();this.allowed=allowed;document.getElementById('fortuneTabButton')?.classList.toggle('hidden',!allowed);if(!allowed)return;
  if(!this.root){
   const root=document.createElement('div');root.id='fortuneTabContent';root.className='tab-content hidden';
   root.innerHTML=`
   <section class="fortune-dialog" aria-labelledby="fortuneTitle"><div class="fortune-header"><div><span class="fortune-eyebrow">КАЗИНО ФОРТУНЫ · КРИСТАЛЛЫ</span><h2 id="fortuneTitle">Колесо фортуны</h2></div><button type="button" class="fortune-close" aria-label="Закрыть">×</button></div>
   <div class="fortune-stage"><div class="fortune-halo"></div><div class="fortune-pointer" aria-hidden="true"></div><div class="fortune-rotor"></div><div class="fortune-hub" aria-hidden="true">✦</div><div class="fortune-particles" aria-hidden="true"></div></div>
   <div class="fortune-result" role="status" aria-live="polite"><strong>Испытай свою удачу</strong><span>☠ Банкротство: 3% · размеры секторов соответствуют шансам</span></div>
   <p class="fortune-balance"></p><form class="fortune-form"><label>Ставка · 💎<input name="bet" type="number" inputmode="numeric" min="1" step="1" required value="100"></label><div class="fortune-presets"><button type="button" data-part="0.1">10% баланса</button><button type="button" data-part="0.5">50%</button></div><label class="fortune-consent"><input name="risk" type="checkbox" required>Понимаю: сектор «Банкротство» обнулит весь текущий баланс.</label><button class="fortune-spin" type="submit">ВРАЩАТЬ <span>✦</span></button></form>
   <p class="fortune-odds">Красный ✕ — потеря ставки · ☠ — банкротство (3%) · ×2 / ×5 / ×10 — выплата со ставкой. Только игровые кристаллы.</p></section>`;
   this.root=root;document.querySelector('#shopPanel .panel-content').append(root);
   this.dialog=root.querySelector('.fortune-dialog');this.rotor=root.querySelector('.fortune-rotor');this.result=root.querySelector('.fortune-result');this.form=root.querySelector('form');this.button=root.querySelector('.fortune-spin');
   this.draw();
   root.querySelector('.fortune-close').addEventListener('click',()=>{this.close();window.switchShopTab?.('achievements');});
   this.form.addEventListener('submit',event=>{event.preventDefault();this.play();});
   for(const button of root.querySelectorAll('[data-part]'))button.addEventListener('click',()=>{if(!this.busy)this.form.elements.bet.value=Math.max(1,Math.floor((state.playerData?.shards||0)*Number(button.dataset.part)));});
  }
  this.root.classList.add('hidden');this.root.classList.remove('fortune-win','fortune-loss','fortune-bankrupt');this.message('Испытай свою удачу','☠ Банкротство: 3% · размеры секторов соответствуют шансам');
 }
 draw(){
  const sectors=CONSTANTS.WHEEL.SECTORS,weights=CONSTANTS.WHEEL.WEIGHTS,total=weights.reduce((n,w)=>n+w,0),colors=['#58214e','#096b76','#52408e','#83541c','#25637b','#642345','#9a6320','#4c3980','#13727b','#354a87','#341c35','#6b3a70'];
  const point=(r,a)=>[200+r*Math.cos(a*Math.PI/180),200+r*Math.sin(a*Math.PI/180)];
  this.rotor.innerHTML='<svg viewBox="0 0 400 400" aria-label="Секторы колеса">'+sectors.map((m,i)=>{
   const start=-90+weights.slice(0,i).reduce((n,w)=>n+w,0)*360/total,width=weights[i]*360/total,center=start+width/2,a=point(190,start),b=point(190,start+width),t=point(139,center);
   return '<path d="M200 200 L'+a.join(' ')+' A190 190 0 0 1 '+b.join(' ')+' Z" fill="'+(m===0?'#4c1b35':m==='bankrupt'?'#120b18':colors[i])+'" stroke="#ffdf9a" stroke-opacity=".45"/><text x="'+t[0]+'" y="'+t[1]+'" transform="rotate('+(center+90)+' '+t.join(' ')+')" text-anchor="middle" dominant-baseline="middle" fill="'+(m===0?'#ff728e':'#fff4d7')+'" font-size="'+(m==='bankrupt'?10:m===0?30:23)+'" font-weight="900">'+(m==='bankrupt'?'☠':m===0?'✕':'×'+String(m))+'</text>';
  }).join('')+'<circle cx="200" cy="200" r="195" fill="none" stroke="#ffdc89" stroke-width="8"/>'+Array.from({length:24},(_,i)=>{const p=point(194,i*15);return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3" fill="#fff5c4"/>';}).join('')+'</svg>';
 }
 close(){if(!this.root)return;this.root.classList.add('hidden');this.root.classList.remove('active');}
 open(){if(!this.allowed)return;this.root.classList.remove('hidden');this.root.classList.add('active');this.refreshBalance();}
 message(title,detail){this.result.replaceChildren();const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=title;span.textContent=detail;this.result.append(strong,span);}
 refreshBalance(){const node=this.root?.querySelector('.fortune-balance');if(node)node.textContent='Баланс: '+(state.playerData?.shards||0).toLocaleString('ru-RU')+' 💎';}
 motion(){return !document.documentElement?.classList.contains('reduce-effects')&&!document.body?.classList.contains('reduce-effects')&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
 track(animation){this.animations.push(animation);return animation.finished.catch(()=>{});}
 async play(){
  if(!this.allowed||this.busy||!this.spin||!this.form.reportValidity())return;
  const bet=Number(this.form.elements.bet.value);
  if(!Number.isSafeInteger(bet)||bet<1||bet>(state.playerData?.shards||0)){this.message('Проверь ставку','Нужно целое число в пределах твоего баланса');return;}
  for(const animation of this.animations)animation.cancel();this.animations=[];
  this.busy=true;const generation=this.generation;
  this.root.classList.remove('fortune-win','fortune-loss','fortune-bankrupt');this.root.classList.add('fortune-busy');
  this.button.disabled=true;for(const element of this.form.elements)element.disabled=true;
  this.root.querySelector('.fortune-close').disabled=true;
  this.message('Судьба уже в движении…','Ожидаем результат вращения');
  const moving=this.motion(),started=performance.now();
  const idle=moving?this.rotor.animate([{transform:'rotate('+this.angle+'deg)'},{transform:'rotate('+(this.angle+360)+'deg)'}],{duration:900,iterations:Infinity,easing:'linear'}):null;
  if(idle)this.animations.push(idle);
  try{
   const response=await this.spin({bet,acceptBankruptcy:true});
   if(generation!==this.generation)return;
   const result=response?.state?.wheelResult;
   if(!result||!Number.isInteger(result.index))throw Error('Нет подтверждённого результата. Баланс уточнится при обновлении.');
   const from=this.angle+(moving?(performance.now()-started)/900*360:0);
   idle?.cancel();
   const target=wheelStopAngle(result.index,CONSTANTS.WHEEL.WEIGHTS,from);
   if(moving)await this.track(this.rotor.animate([{transform:'rotate('+from+'deg)'},{transform:'rotate('+target+'deg)'}],{duration:CONSTANTS.WHEEL.SPIN_MS,easing:'cubic-bezier(.12,.65,.12,1)',fill:'forwards'}));
   if(generation!==this.generation)return;
   this.angle=target%360;this.rotor.style.transform='rotate('+this.angle+'deg)';
   for(const animation of this.animations)animation.cancel();this.animations=[];
   const bankrupt=result.multiplier==='bankrupt',win=result.delta>0;
   this.root.classList.add(bankrupt?'fortune-bankrupt':win?'fortune-win':'fortune-loss');
   const number=n=>n.toLocaleString('ru-RU');
   this.message(bankrupt?'БАНКРОТСТВО':win?'+'+number(result.delta)+' 💎':result.delta===0?'Без изменения баланса':'−'+number(-result.delta)+' 💎',
    bankrupt?'Баланс после вращения: 0 💎':'Выплата: '+number(result.payout)+' 💎 · '+(result.multiplier===1?'×1':'×'+String(result.multiplier).replace('.',',')));
   if(win){audio.purchase();if(moving)this.confetti();}
   else if(moving)await this.track(this.result.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(0)'}],{duration:350}));
  }catch(error){if(generation===this.generation)this.message('Вращение не подтверждено',error.message||'Проверь соединение и баланс перед новой ставкой.');}
  finally{if(generation===this.generation){idle?.cancel();this.refreshBalance();this.busy=false;this.root.classList.remove('fortune-busy');for(const element of this.form.elements)element.disabled=false;this.root.querySelector('.fortune-close').disabled=false;this.button.disabled=false;}}
 }
 confetti(){
  const holder=this.root.querySelector('.fortune-particles');holder.replaceChildren();
  for(let i=0;i<28;i++){const piece=document.createElement('i');piece.style.setProperty('--x',((i*137.5)%360-180)+'px');piece.style.setProperty('--y',(-90-(i%7)*22)+'px');piece.style.setProperty('--r',i*47+'deg');piece.style.setProperty('--delay',(i%5)*35+'ms');holder.append(piece);}
  clearTimeout(this.timer);this.timer=setTimeout(()=>{holder.replaceChildren();this.timer=null;},1800);
 }
 disconnect(){
  document.getElementById('fortuneTabButton')?.classList.add('hidden');this.generation++;this.allowed=false;this.busy=false;clearTimeout(this.timer);this.timer=null;
  for(const animation of this.animations)animation.cancel();this.animations=[];
  if(this.root){this.root.classList.add('hidden');this.root.classList.remove('fortune-busy');this.root.querySelector('.fortune-particles').replaceChildren();for(const element of this.form.elements)element.disabled=false;this.root.querySelector('.fortune-close').disabled=false;}
 }
}
export const fortuneWheel=new FortuneWheel();
