// ============================================================
// АНИМАЦИИ - С ВСПЛЫВАЮЩИМ УРОНОМ
// ============================================================

export class AnimationManager {
  constructor() {
    this._animations = new Map();
    this._rafId = null;
    this._isRunning = false;
    this._baseDamage = 1;
  }

  setBaseDamage(damage) {
    this._baseDamage = damage || 1;
  }

  // ============================================================
  // ЦВЕТ УРОНА В ЗАВИСИМОСТИ ОТ ВЕЛИЧИНЫ
  // ============================================================
  getDamageColor(damage, isCrit = false) {
    const base = this._baseDamage || 1;
    const ratio = damage / Math.max(1, base);
    
    if (ratio <= 1.5) return isCrit ? '#fff9c4' : '#f0e6d0';
    if (ratio <= 3) return isCrit ? '#fff176' : '#ffeb3b';
    if (ratio <= 6) return isCrit ? '#ffb74d' : '#ff9800';
    if (ratio <= 10) return isCrit ? '#ff8a65' : '#ff5722';
    return isCrit ? '#ef5350' : '#d32f2f';
  }

  getDamageGlow(damage, isCrit = false) {
    const base = this._baseDamage || 1;
    const ratio = damage / Math.max(1, base);
    
    if (ratio <= 1.5) return isCrit ? 'rgba(255,249,196,0.9)' : 'rgba(240,230,208,0.8)';
    if (ratio <= 3) return isCrit ? 'rgba(255,241,118,0.9)' : 'rgba(255,235,59,0.8)';
    if (ratio <= 6) return isCrit ? 'rgba(255,183,77,0.9)' : 'rgba(255,152,0,0.8)';
    if (ratio <= 10) return isCrit ? 'rgba(255,138,101,0.9)' : 'rgba(255,87,34,0.8)';
    return isCrit ? 'rgba(239,83,80,0.9)' : 'rgba(211,47,47,0.8)';
  }

  // ============================================================
  // ЗВЁЗДЫ
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
    const damageEl = document.createElement('div');
    damageEl.className = 'damage-number';
    
    const color = this.getDamageColor(damage, isCrit);
    const glow = this.getDamageGlow(damage, isCrit);
    
    damageEl.textContent = `-${damage}`;
    
    if (isCrit) damageEl.classList.add('crit');
    if (isBoss) damageEl.classList.add('boss-damage');
    
    damageEl.style.color = color;
    damageEl.style.textShadow = `0 0 10px ${glow}, 0 2px 4px rgba(0,0,0,0.8)`;
    
    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 30;
    
    damageEl.style.left = `${x + offsetX}px`;
    damageEl.style.top = `${y + offsetY}px`;
    
    document.body.appendChild(damageEl);
    
    requestAnimationFrame(() => {
      damageEl.classList.add('animate');
    });
    
    setTimeout(() => {
      if (damageEl.parentNode) damageEl.remove();
    }, 1200);
  }

  // ============================================================
  // УДАРНАЯ ВОЛНА
  // ============================================================
  createShockwave(x, y, intensity = 'normal', color = null) {
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
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 400);
    
    const flash = document.createElement('div');
    flash.className = 'death-flash';
    document.body.appendChild(flash);
    setTimeout(() => { if (flash.parentNode) flash.remove(); }, 300);
    
    this.createParticles(null, {
      count: 40,
      color: '#ffd700',
      size: 6,
      duration: 1500,
      spread: 200,
      x, y
    });
    
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.createShockwave(x, y, 'boss'), i * 150);
    }
  }

  // ============================================================
  // ПАРТИКЛЫ
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

    for (let i = 0; i < count; i++) {
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
      }).onfinish = () => particle.remove();
    }
  }

  // ============================================================
  // КОМПЛЕКСНЫЙ ЭФФЕКТ КЛИКА
  // ============================================================
  playClickVisualFeedback(event, damage, isCrit, isBoss = false) {
    const x = event.clientX || event.pageX;
    const y = event.clientY || event.pageY;
    
    const color = this.getDamageColor(damage, isCrit);
    
    // 1. Всплывающий урон
    this.showDamageNumber(x, y, damage, isCrit, isBoss);
    
    // 2. Ударная волна
    const shockwaveIntensity = isCrit ? 'crit' : 'normal';
    this.createShockwave(x, y, shockwaveIntensity, color);
    
    // 3. Частицы
    const particleCount = isCrit ? 15 : 8;
    this.createParticles(null, {
      count: particleCount,
      color: color,
      size: isCrit ? 5 : 3,
      duration: isCrit ? 800 : 600,
      spread: isCrit ? 120 : 80,
      x, y
    });
  }

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
