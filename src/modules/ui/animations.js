import { formatNumber } from '../../utils/numbers.js';
// ============================================================
// АНИМАЦИИ И ВИЗУАЛЬНЫЕ ЭФФЕКТЫ
// ============================================================

export class AnimationManager {
  constructor() {
    this._animations = new Map();
    this._rafId = null;
    this._isRunning = false;
    this._baseDamage = 10;this._particleCount=0;this._lastLightEffect=0;this._damageNodes=[];this._ufoGeometry=null;this._damageSequence=0;
  }

  setBaseDamage(damage) {
    this._baseDamage = damage || 10;
  }

  // ============================================================
  // ЦВЕТ УРОНА В ЗАВИСИМОСТИ ОТ ВЕЛИЧИНЫ
  // ============================================================
  getDamageColor(damage, isCrit = false) {
    const base = this._baseDamage || 10;
    const ratio = damage / Math.max(1, base);
    
    if (ratio <= 1.5) return isCrit ? '#fff9c4' : '#f0e6d0';
    if (ratio <= 3) return isCrit ? '#fff176' : '#ffeb3b';
    if (ratio <= 6) return isCrit ? '#ffb74d' : '#ff9800';
    if (ratio <= 10) return isCrit ? '#ff8a65' : '#ff5722';
    return isCrit ? '#ef5350' : '#d32f2f';
  }

  getDamageGlow(damage, isCrit = false) {
    const base = this._baseDamage || 10;
    const ratio = damage / Math.max(1, base);
    
    if (ratio <= 1.5) return isCrit ? 'rgba(255,249,196,0.9)' : 'rgba(240,230,208,0.8)';
    if (ratio <= 3) return isCrit ? 'rgba(255,241,118,0.9)' : 'rgba(255,235,59,0.8)';
    if (ratio <= 6) return isCrit ? 'rgba(255,183,77,0.9)' : 'rgba(255,152,0,0.8)';
    if (ratio <= 10) return isCrit ? 'rgba(255,138,101,0.9)' : 'rgba(255,87,34,0.8)';
    return isCrit ? 'rgba(239,83,80,0.9)' : 'rgba(211,47,47,0.8)';
  }

  // ============================================================
  // ЗВЁЗДЫ НА ФОНЕ
  // ============================================================
  createStars(count = 300) {
    const container = document.getElementById('stars');
    if (!container) return;
    
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const size = Math.random() * 2.5 + 0.5;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
      star.style.animationDelay = Math.random() * 5 + 's';
      fragment.appendChild(star);
    }
    container.appendChild(fragment);
  }

  // ============================================================
  // ВСПЛЫВАЮЩИЙ УРОН
  // ============================================================
  showDamageNumber(x, y, damage, isCrit = false, isBoss = false) {
    if(document.hidden)return;

    const lowPower=document.documentElement?.classList.contains('low-power');
    const maxVisible=lowPower?12:20;
    while(this._damageNodes.length>=maxVisible)this._damageNodes.shift()?.remove();
    const damageEl = document.createElement('div');this._damageNodes.push(damageEl);
    damageEl.className = 'damage-number';
    
    const color = this.getDamageColor(damage, isCrit);
    const glow = this.getDamageGlow(damage, isCrit);
    
    damageEl.textContent = `-${formatNumber(damage)}`;
    
    if (isCrit) damageEl.classList.add('crit');
    if (isBoss) damageEl.classList.add('boss-damage');
    
    damageEl.style.color = color;
    damageEl.style.textShadow = `0 0 10px ${glow}, 0 2px 4px rgba(0,0,0,0.8)`;
    
    // Spread consecutive hits across a wide, rotating pattern instead of stacking at the moon centre.
    const index=this._damageSequence++;
    const angle=(index*2.399963229728653)%(Math.PI*2);
    const radius=65+(index%4)*34;
    const offsetX=Math.cos(angle)*radius+(Math.random()-.5)*16;
    const offsetY=Math.sin(angle)*radius*.68+(Math.random()-.5)*14;
    const viewWidth=document.documentElement.clientWidth||window.innerWidth;
    const viewHeight=document.documentElement.clientHeight||window.innerHeight;
    damageEl.style.left = `${Math.max(42,Math.min(viewWidth-42,x+offsetX))}px`;
    damageEl.style.top = `${Math.max(38,Math.min(viewHeight-38,y+offsetY))}px`;
    
    document.body.appendChild(damageEl);
    
    requestAnimationFrame(() => {
      damageEl.classList.add('animate');
    });
    
    setTimeout(() => {
      if (damageEl.parentNode) damageEl.remove();const i=this._damageNodes.indexOf(damageEl);if(i>=0)this._damageNodes.splice(i,1);
    }, lowPower?460:860);
  }

  // ============================================================
  // УДАРНАЯ ВОЛНА
  // ============================================================
  createShockwave(x, y, intensity = 'normal', color = null) {
    if(document.hidden||document.documentElement?.classList.contains('low-power'))return;
    const shockwave = document.createElement('div');
    shockwave.className = 'shockwave';
    
    if (intensity === 'crit') shockwave.classList.add('crit-shockwave');
    else if (intensity === 'boss') shockwave.classList.add('boss-shockwave');
    
    if (color) {
      shockwave.style.borderColor = color;
      shockwave.style.boxShadow = `0 0 20px ${color}`;
    }
    
    shockwave.style.left = `${x}px`;
    shockwave.style.top = `${y}px`;
    
    document.body.appendChild(shockwave);
    
    setTimeout(() => {
      if (shockwave.parentNode) shockwave.remove();
    }, 600);
  }

  // ============================================================
  // ЭФФЕКТ ПОВЫШЕНИЯ УРОВНЯ
  // ============================================================
  playLevelUpEffect(element) {
    if (!element) return;
    element.classList.remove('level-up');
    void element.offsetWidth;
    element.classList.add('level-up');
    setTimeout(() => element.classList.remove('level-up'), 800);
  }

  // ============================================================
  // ЭФФЕКТ УБИЙСТВА БОССА
  // ============================================================
  playBossDeathEffect(x, y) {
    // Тряска экрана
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 400);
    
    // Белая вспышка
    const flash = document.createElement('div');
    flash.className = 'death-flash';
    document.body.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.remove(); }, 300);
    
    // Золотые частицы
    this.createParticles(null, {
      count: 40,
      color: '#ffd700',
      size: 6,
      duration: 1500,
      spread: 200,
      x, y
    });
    
    // Несколько ударных волн
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.createShockwave(x, y, 'boss'), i * 150);
    }
  }

  // ============================================================
  // ЧАСТИЦЫ
  // ============================================================
  createParticles(container, options = {}) {
    const {
      count = 20,
      color = '#ffd700',
      size = 4,
      duration = 1000,
      spread = 100,
      x = null,
      y = null
    } = options;

    let centerX, centerY;
    
    if (x !== null && y !== null) {
      centerX = x;
      centerY = y;
    } else if (container) {
      const rect = container.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    } else {
      return;
    }

    if(document.body.classList.contains('reduce-effects')||document.documentElement?.classList.contains('reduce-effects')||document.documentElement?.classList.contains('low-power')||document.hidden)return;
    const available=Math.max(0,64-this._particleCount);
    for (let i = 0; i < Math.min(count,available); i++) {
      this._particleCount++;
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        width: ${size * (0.5 + Math.random())}px;
        height: ${size * (0.5 + Math.random())}px;
        background: ${color};
        border-radius: 50%;
        pointer-events: none;
        left: ${centerX}px;
        top: ${centerY}px;
        z-index: 1000;
        opacity: 1;
        box-shadow: 0 0 10px ${color};
      `;

      document.body.appendChild(particle);

      const angle = Math.random() * Math.PI * 2;
      const distance = spread * (0.5 + Math.random() * 0.5);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - spread * 0.3;

      particle.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
      ], {
        duration: duration * (0.5 + Math.random() * 0.5),
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      }).onfinish = () => {particle.remove();this._particleCount=Math.max(0,this._particleCount-1);};
    }
  }

  // ============================================================
  // КОМПЛЕКСНЫЙ ЭФФЕКТ КЛИКА
  // ============================================================
  playClickVisualFeedback(event, damage, isCrit, isBoss = false, showNumber = true) {
    const x = event.clientX || event.pageX;
    const y = event.clientY || event.pageY;
    
    const color = this.getDamageColor(damage, isCrit);
    
    // 1. Всплывающий урон
    if (showNumber) this.showDamageNumber(x, y, damage, isCrit, isBoss);
    
    if(!isCrit&&performance.now()-this._lastLightEffect<90)return;this._lastLightEffect=performance.now();
    // 2. Ударная волна
    const shockwaveIntensity = isCrit ? 'crit' : 'normal';
    this.createShockwave(x, y, shockwaveIntensity, color);
    
    // 3. Частицы
    const particleCount = isCrit ? 8 : 3;
    this.createParticles(null, {
      count: particleCount,
      color: color,
      size: isCrit ? 5 : 3,
      duration: isCrit ? 400 : 280,
      spread: isCrit ? 120 : 80,
      x, y
    });
  }

  // ============================================================
  // НОВОЕ: ЭФФЕКТ ПРОКАЧКИ ЛУНЫ (ВИЗУАЛЬНЫЙ)
  // ============================================================
  playMoonUpgradeEffect(moonId, newLevel, isMilestone = false) {
    const moonWrapper = document.getElementById('moonWrapper');
    if (!moonWrapper) return;
    
    const rect = moonWrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Базовые частицы при любой прокачке
    const color = isMilestone ? '#ffd700' : '#4caf50';
    const count = isMilestone ? 50 : 25;
    const size = isMilestone ? 7 : 5;
    
    this.createParticles(null, {
      count,
      color,
      size,
      duration: isMilestone ? 1800 : 1200,
      spread: isMilestone ? 250 : 150,
      x: centerX,
      y: centerY
    });
    
    // Ударная волна для милестоунов
    if (isMilestone) {
      this.createShockwave(centerX, centerY, 'boss', color);
      
      // Вспышка
      const flash = document.createElement('div');
      flash.className = 'death-flash';
      flash.style.background = `radial-gradient(circle, ${color}80, transparent)`;
      document.body.appendChild(flash);
      setTimeout(() => { if (flash.parentNode) flash.remove(); }, 400);
    }
    
    // Пульсация луны
    moonWrapper.style.transition = 'transform 0.3s ease';
    moonWrapper.style.transform = 'scale(1.15)';
    setTimeout(() => {
      moonWrapper.style.transform = 'scale(1)';
    }, 300);
  }

  // ============================================================
  // НОВОЕ: ЭФФЕКТ ПОКУПКИ ЛУНЫ
  // ============================================================
  playMoonPurchaseEffect(moonId) {
    const moonWrapper = document.getElementById('moonWrapper');
    if (!moonWrapper) return;
    
    const rect = moonWrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Золотые частицы (покупка = праздник)
    this.createParticles(null, {
      count: 35,
      color: '#ffd700',
      size: 6,
      duration: 1500,
      spread: 200,
      x: centerX,
      y: centerY
    });
    
    // Ударная волна
    this.createShockwave(centerX, centerY, 'crit', '#ffd700');
    
    // Появление с эффектом
    moonWrapper.style.animation = 'none';
    void moonWrapper.offsetWidth;
    moonWrapper.style.animation = 'moonPurchaseAppear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    setTimeout(() => {
      moonWrapper.style.animation = '';
    }, 800);
  }

  // ============================================================
  // НОВОЕ: ЭФФЕКТ АКТИВАЦИИ СИНЕРГИИ
  // ============================================================
  playSynergyActivationEffect(synergyTier) {
    const moonWrapper = document.getElementById('moonWrapper');
    if (!moonWrapper) return;
    
    const rect = moonWrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Цвет зависит от тира синергии
    const colors = {
      1: '#8bc34a',  // Начальная - зелёный
      2: '#03a9f4',  // Средняя - синий
      3: '#ff9800',  // Продвинутая - оранжевый
      4: '#e91e63',  // Легендарная - розовый
      5: '#9c27b0'   // Мифическая - фиолетовый
    };
    
    const color = colors[synergyTier] || '#ffd700';
    const count = 20 + synergyTier * 10;
    
    this.createParticles(null, {
      count,
      color,
      size: 5,
      duration: 1200,
      spread: 180,
      x: centerX,
      y: centerY
    });
    
    // Кольцо энергии
    this.createShockwave(centerX, centerY, 'normal', color);
  }

  // ============================================================
  // НОВОЕ: ЭФФЕКТ ЗОЛОТОГО КЛИКА (от Золотой луны)
  // ============================================================
  showMoonReward(amount,rect) {
    if(document.hidden||!rect)return;
    this._moonRewardPopup?.remove();
    clearTimeout(this._moonRewardTimer);
    const label=document.createElement('div');
    label.className='moon-reward-popup';label.textContent='+'+amount.toLocaleString('ru-RU')+' 💎';
    label.style.left=(rect.left+rect.width/2)+'px';
    label.style.top=(rect.bottom-18)+'px';
    this._moonRewardPopup=label;
    document.body.appendChild(label);
    this._moonRewardTimer=setTimeout(()=>{
      label.remove();
      this._moonRewardPopup=null;
    },900);
  }

  playUfoShot(index=0) {
    if(document.hidden||document.documentElement?.classList.contains('low-power'))return;
    if(document.documentElement?.classList.contains('hide-ufo-visuals'))return;
    if(!this._ufoGeometry){
      const ships=[...document.querySelectorAll('.ufo-ship')],moon=document.getElementById('moonWrapper');if(!ships.length||!moon)return;
      this._ufoGeometry={ships:ships.map(ship=>ship.getBoundingClientRect()),moon:moon.getBoundingClientRect()};
      requestAnimationFrame(()=>{this._ufoGeometry=null;});
    }
    const geometry=this._ufoGeometry,a=geometry.ships[index%geometry.ships.length],b=geometry.moon;
    const x=a.x+a.width/2,y=a.y+a.height/2,dx=b.x+b.width/2-x,dy=b.y+b.height/2-y;
    const beam=document.createElement('div');beam.className='ufo-laser';beam.style.left=x+'px';beam.style.top=y+'px';beam.style.width=Math.hypot(dx,dy)+'px';beam.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
    document.body.appendChild(beam);setTimeout(()=>beam.remove(),220);
  }

  playGoldenClickEffect(x, y) {
    this.createParticles(null, {
      count: 20,
      color: '#ffd700',
      size: 5,
      duration: 1000,
      spread: 100,
      x, y
    });
    
    // Показать текст "+💎"
    const textEl = document.createElement('div');
    textEl.className = 'damage-number';
    textEl.textContent = '+💎';
    textEl.style.color = '#ffd700';
    textEl.style.textShadow = '0 0 15px rgba(255, 215, 0, 0.9), 0 2px 4px rgba(0,0,0,0.8)';
    textEl.style.left = `${x}px`;
    textEl.style.top = `${y - 20}px`;
    textEl.style.fontSize = '2.5rem';
    document.body.appendChild(textEl);
    
    requestAnimationFrame(() => textEl.classList.add('animate'));
    
    setTimeout(() => {
      if (textEl.parentNode) textEl.remove();
    }, 1200);
  }

  // ============================================================
  // НОВОЕ: ЭФФЕКТ ЦЕПНОЙ МОЛНИИ (Электрическая луна)
  // ============================================================
  playChainLightningEffect(x, y, multiplier) {
    const colors = {
      2: '#fff176',
      5: '#ffb74d',
      10: '#ef5350'
    };
    const color = colors[multiplier] || '#fff176';
    
    // Яркие частицы молнии
    this.createParticles(null, {
      count: 30,
      color,
      size: 6,
      duration: 1000,
      spread: 180,
      x, y
    });
    
    // Несколько ударных волн
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        this.createShockwave(x, y, 'crit', color);
      }, i * 100);
    }
    
    // Вспышка для x10
    if (multiplier === 10) {
      const flash = document.createElement('div');
      flash.className = 'death-flash';
      flash.style.background = `radial-gradient(circle, ${color}aa, transparent)`;
      document.body.appendChild(flash);
      setTimeout(() => { if (flash.parentNode) flash.remove(); }, 300);
      
      // Тряска
      document.body.classList.add('screen-shake');
      setTimeout(() => document.body.classList.remove('screen-shake'), 300);
    }
  }

  // ============================================================
  // НОВОЕ: ЭФФЕКТ КРОВАВОЙ ЖАТВЫ (мгновенное убийство)
  // ============================================================
  playBloodExecuteEffect(x, y) {
    // Красные частицы крови
    this.createParticles(null, {
      count: 50,
      color: '#cc0000',
      size: 7,
      duration: 1500,
      spread: 250,
      x, y
    });
    
    // Красная ударная волна
    this.createShockwave(x, y, 'boss', '#cc0000');
    
    // Красная вспышка
    const flash = document.createElement('div');
    flash.className = 'death-flash';
    flash.style.background = 'radial-gradient(circle, rgba(204, 0, 0, 0.7), transparent)';
    document.body.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.remove(); }, 400);
    
    // Тряска экрана
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 400);
  }

  // ============================================================
  // НОВОЕ: ЭФФЕКТ СВЕРХНОВОЙ (Космическая луна ур. 10)
  // ============================================================
  playSupernovaEffect() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Белая вспышка
    const flash = document.createElement('div');
    flash.className = 'death-flash';
    flash.style.background = 'radial-gradient(circle, white, rgba(233, 30, 99, 0.8), transparent)';
    flash.style.animationDuration = '1s';
    document.body.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.remove(); }, 1000);
    
    // Множество разноцветных частиц
    const colors = ['#ffd700', '#ff9800', '#e91e63', '#9c27b0', '#673ab7', '#fff176'];
    colors.forEach((color, i) => {
      setTimeout(() => {
        this.createParticles(null, {
          count: 30,
          color,
          size: 8,
          duration: 2000,
          spread: 400,
          x: centerX,
          y: centerY
        });
      }, i * 100);
    });
    
    // Множество ударных волн
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.createShockwave(centerX, centerY, 'boss', colors[i % colors.length]);
      }, i * 150);
    }
    
    // Тряска
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 600);
  }

  // ============================================================
  // УПРАВЛЕНИЕ АНИМАЦИЯМИ
  // ============================================================
  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._tick();
  }

  stop() {
    this._isRunning = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick() {
    if (!this._isRunning) return;
    for (const [id, animation] of this._animations) {
      if (animation.update) animation.update();
    }
    this._rafId = requestAnimationFrame(() => this._tick());
  }

  add(id, animation) { this._animations.set(id, animation); }
  remove(id) { this._animations.delete(id); }
  clear() { this._animations.clear(); }
}

export const animations = new AnimationManager();
