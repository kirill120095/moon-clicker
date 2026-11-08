import { beginWheelBalance, revealWheelBalance, getVisibleShards } from './currency-display.js';
import { CONSTANTS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { audio } from './audio.js';

export function wheelStopAngle(index, count, from=0) {
 const offset=Array.isArray(count)?(count.slice(0,index).reduce((n,w)=>n+w,0)+count[index]/2)*360/count.reduce((n,w)=>n+w,0):index*360/count;
 const target=((360-offset)%360+360)%360;
 return from+360*7+((target-from%360+360)%360);
}
export const WHEEL_DARK_HUMOR_LINES = Object.freeze([
  "Твои кристаллы уже пишут завещание…",
  "Твои накопления заказали себе памятник…",
  "Кристаллы ушли на тот свет. Возможно, вернутся…",
  "Твой баланс готовится к похоронам…",
  "Финансовая подушка оказалась надгробной плитой…",
  "Кошелёк уже слышит траурную музыку…",
  "Казино уже выбирает цвет твоего гроба…",
  "Твоя ставка отправилась на вскрытие…",
  "Крупье — скелет. Совпадение? Не думаю…",
  "Колесо крутится, бухгалтер точит лопату…",
  "Твой выигрыш уже ищут с собаками…",
  "Даже лунные кратеры не такие глубокие, как твои убытки…",
  "НЛО предлагает эвакуировать хотя бы остатки баланса…",
  "Космос бесконечен. Твои кристаллы — нет…",
  "Судьба подбрасывает монетку. Монетка в ужасе…",
  "Твоя удача внесена в список пропавших без вести…",
  "Вскрытие покажет, куда делись кристаллы…",
  "Смерть в нищете"
]);

// The last phrase has four times the weight of each other line.
export function randomWheelHeadline(random=Math.random()) {
 const totalWeight=WHEEL_DARK_HUMOR_LINES.length+3;
 const pick=Math.min(totalWeight-1,Math.max(0,Math.floor(random*totalWeight)));
 return WHEEL_DARK_HUMOR_LINES[pick<WHEEL_DARK_HUMOR_LINES.length?pick:WHEEL_DARK_HUMOR_LINES.length-1];
}

export class FortuneWheel {
 constructor(){this.allowed=false;this.busy=false;this.generation=0;this.animations=[];this.angle=0;this.timer=null;}
 bind(spin,onReveal){this.spin=spin;this.onReveal=onReveal;}
 connect(allowed){
  this.disconnect();this.allowed=allowed;document.getElementById('fortuneTabButton')?.classList.toggle('hidden',!allowed);if(!allowed)return;
  if(!this.root){
   const root=document.createElement('div');root.id='fortuneTabContent';root.className='tab-content hidden';
   root.innerHTML=`
   <section class="fortune-dialog" aria-labelledby="fortuneTitle"><div class="fortune-header"><div><span class="fortune-eyebrow">КАЗИНО ФОРТУНЫ · КРИСТАЛЛЫ</span><h2 id="fortuneTitle">Лунная рулетка</h2></div><button type="button" class="fortune-close" aria-label="Закрыть">×</button></div>
   <div class="fortune-stage"><div class="fortune-halo"></div><div class="fortune-pointer" aria-hidden="true"></div><div class="fortune-rotor"></div><div class="fortune-hub" aria-hidden="true">✦</div><div class="fortune-particles" aria-hidden="true"></div></div>
   <div class="fortune-result" role="status" aria-live="polite"><strong>Лунная рулетка</strong><span>37 секторов · открытые вероятности</span></div>
   <p class="fortune-balance"></p><form class="fortune-form"><fieldset class="fortune-choice"><legend>Выбери сектор</legend><div class="fortune-choice-grid"><label class="fortune-choice-option fortune-choice-red"><input type="radio" name="choice" value="red" checked><span class="fortune-choice-face"><b>Аметист</b><small>48,65% · ×2</small></span></label><label class="fortune-choice-option fortune-choice-black"><input type="radio" name="choice" value="black"><span class="fortune-choice-face"><b>Лунная тень</b><small>48,65% · ×2</small></span></label><label class="fortune-choice-option fortune-choice-zero"><input type="radio" name="choice" value="zero"><span class="fortune-choice-face"><b>Лунный свет</b><small>2,70% · ×36</small></span></label></div></fieldset><label>Ставка · 💎<input name="bet" type="number" inputmode="numeric" min="1" step="1" required value="1"></label><div class="fortune-presets"><button type="button" data-part="0.01">1%</button><button type="button" data-part="0.025">2,5%</button><button type="button" data-part="0.05">5%</button></div><button class="fortune-spin" type="submit">ВРАЩАТЬ <span>✦</span></button></form>
   <p class="fortune-odds">Красное: 48,65% · Чёрное: 48,65% · Зеро: 2,70%. Максимальная ставка — 5% баланса. Выплаты включают ставку. Вероятности постоянны.</p></section>`;
   this.root=root;document.querySelector('#shopPanel .panel-content').append(root);
   this.dialog=root.querySelector('.fortune-dialog');this.rotor=root.querySelector('.fortune-rotor');this.result=root.querySelector('.fortune-result');this.form=root.querySelector('form');this.button=root.querySelector('.fortune-spin');
   this.draw();
   root.querySelector('.fortune-close').addEventListener('click',()=>{this.close();window.switchShopTab?.('achievements');});
   this.form.addEventListener('submit',event=>{event.preventDefault();this.play();});
   this.form.querySelectorAll('input[name="choice"]').forEach(input=>input.addEventListener('change',()=>this.root.dataset.choice=input.value));
   this.root.dataset.choice='red';
   for(const button of root.querySelectorAll('[data-part]'))button.addEventListener('click',()=>this.setBetFraction(Number(button.dataset.part)));
  }
  this.root.dataset.choice=this.form.querySelector('input[name="choice"]:checked')?.value||'red';this.root.classList.add('hidden');this.root.classList.remove('fortune-win','fortune-loss','fortune-bankrupt');this.message('Лунная рулетка','Выбери цвет или зеро · результат рассчитывается сервером');
 }
 setBetFraction(part){if(this.busy)return;const balance=Math.floor(getVisibleShards(state.playerData?.shards));this.form.elements.bet.value=Math.min(Math.floor(balance*.05),Math.max(1,Math.floor(balance*Math.max(0,Math.min(.05,part)))));}
 draw(){
  const sectors=CONSTANTS.WHEEL.SECTORS,count=sectors.length;
  const point=(r,a)=>[200+r*Math.cos(a*Math.PI/180),200+r*Math.sin(a*Math.PI/180)];
  this.rotor.innerHTML='<svg viewBox="0 0 400 400" aria-label="37 секторов европейской рулетки">'+sectors.map((sector,i)=>{
   const start=-90+i*360/count,width=360/count,center=start+width/2,a=point(190,start),b=point(190,start+width),t=point(157,center);
   return '<path d="M200 200 L'+a.join(' ')+' A190 190 0 0 1 '+b.join(' ')+' Z" fill="'+(sector==='zero'?'#8098b9':sector==='red'?'#b93670':'#1d2d59')+'" stroke="#a9c7ee" stroke-opacity=".8"/>';
  }).join('')+'<circle cx="200" cy="200" r="195" fill="none" stroke="#dcecff" stroke-width="8"/></svg>';
 }
 close(){if(!this.root)return;this.root.classList.add('hidden');this.root.classList.remove('active');}
 open(){if(!this.allowed)return;this.root.classList.remove('hidden');this.root.classList.add('active');this.refreshBalance();}
 message(title,detail){this.result.replaceChildren();const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=title;span.textContent=detail;this.result.append(strong,span);}
 refreshBalance(){const node=this.root?.querySelector('.fortune-balance');if(node)node.textContent='Баланс: '+getVisibleShards(state.playerData?.shards).toLocaleString('ru-RU')+' 💎';}
 motion(){return !document.documentElement?.classList.contains('reduce-effects')&&!document.body?.classList.contains('reduce-effects')&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
 track(animation){this.animations.push(animation);return animation.finished.catch(()=>{});}
 async play(){
  if(!this.allowed||this.busy||!this.spin||!this.form.reportValidity())return;
  const bet=Number(this.form.elements.bet.value);
  if(!Number.isSafeInteger(bet)||bet<1||bet>Math.floor(getVisibleShards(state.playerData?.shards)*.05)){this.message('Проверь ставку','Ставка должна быть целой и не превышать 5% баланса');return;}
  for(const animation of this.animations)animation.cancel();this.animations=[];
  this.busy=true;beginWheelBalance(state.wheelEconomy);let resultRevealed=false;const generation=this.generation;
  this.root.classList.remove('fortune-win','fortune-loss','fortune-bankrupt');this.root.classList.add('fortune-busy');
  this.button.disabled=true;for(const element of this.form.elements)element.disabled=true;
  this.root.querySelector('.fortune-close').disabled=true;
  this.message('Лунная рулетка','');
  const choice=this.form.querySelector('input[name="choice"]:checked')?.value||'red';
  const moving=this.motion(),started=performance.now();
  const idle=moving?this.rotor.animate([{transform:'rotate('+this.angle+'deg)'},{transform:'rotate('+(this.angle+360)+'deg)'}],{duration:900,iterations:Infinity,easing:'linear'}):null;
  if(idle)this.animations.push(idle);
  try{
   const response=await this.spin({bet,choice});
   if(generation!==this.generation)return;
   const result=response?.state?.wheelResult;
   if(!result||!Number.isInteger(result.index))throw Error('Нет подтверждённого результата. Баланс уточнится при обновлении.');
   const from=this.angle+(moving?(performance.now()-started)/900*360:0);
   this.rotor.style.transform='rotate('+from+'deg)';
   idle?.cancel();
   const target=wheelStopAngle(result.index,CONSTANTS.WHEEL.VISUAL_WEIGHTS,from);
   if(moving)await this.track(this.rotor.animate([{transform:'rotate('+from+'deg)'},{transform:'rotate('+target+'deg)'}],{duration:CONSTANTS.WHEEL.SPIN_MS,easing:'cubic-bezier(.12,.65,.12,1)',fill:'forwards'}));
   if(generation!==this.generation)return;
   this.angle=target%360;this.rotor.style.transform='rotate('+target+'deg)';
   for(const animation of this.animations)animation.cancel();this.animations=[];
   revealWheelBalance();this.onReveal?.();resultRevealed=true;
   const bankrupt=false,win=result.delta>0;
   this.root.classList.add(bankrupt?'fortune-bankrupt':win?'fortune-win':'fortune-loss');
   const number=n=>n.toLocaleString('ru-RU');
   this.message(win?'+'+number(result.delta)+' 💎':result.delta===0?'Без изменения баланса':'−'+number(-result.delta)+' 💎',
    'Выпало: '+(result.sector==='red'?'💜 Аметист':result.sector==='black'?'🌌 Лунная тень':'✨ Лунный свет')+' · выплата: '+number(result.payout)+' 💎');
   if(win){audio.purchase();if(moving&&!document.documentElement?.classList.contains('low-power'))this.confetti();}
   else if(moving)await this.track(this.result.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(0)'}],{duration:350}));
  }catch(error){if(generation===this.generation)this.message('Вращение не подтверждено',error.message||'Проверь соединение и баланс перед новой ставкой.');}
  finally{if(generation===this.generation){idle?.cancel();if(!resultRevealed){revealWheelBalance();this.onReveal?.();}this.refreshBalance();this.busy=false;this.root.classList.remove('fortune-busy');for(const element of this.form.elements)element.disabled=false;this.root.querySelector('.fortune-close').disabled=false;this.button.disabled=false;}}
 }
 confetti(){
  const holder=this.root.querySelector('.fortune-particles');holder.replaceChildren();
  for(let i=0;i<28;i++){const piece=document.createElement('i');piece.style.setProperty('--x',((i*137.5)%360-180)+'px');piece.style.setProperty('--y',(-90-(i%7)*22)+'px');piece.style.setProperty('--r',i*47+'deg');piece.style.setProperty('--delay',(i%5)*35+'ms');holder.append(piece);}
  clearTimeout(this.timer);this.timer=setTimeout(()=>{holder.replaceChildren();this.timer=null;},1800);
 }
 disconnect(){
  revealWheelBalance();document.getElementById('fortuneTabButton')?.classList.add('hidden');this.generation++;this.allowed=false;this.busy=false;clearTimeout(this.timer);this.timer=null;
  for(const animation of this.animations)animation.cancel();this.animations=[];
  if(this.root){this.root.classList.add('hidden');this.root.classList.remove('fortune-busy');this.root.querySelector('.fortune-particles').replaceChildren();for(const element of this.form.elements)element.disabled=false;this.root.querySelector('.fortune-close').disabled=false;}
 }
}
export const fortuneWheel=new FortuneWheel();
