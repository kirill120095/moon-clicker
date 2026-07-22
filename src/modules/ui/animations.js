// ============================================================
// АНИМАЦИИ
// ============================================================

// ============================================================
// УПРАВЛЕНИЕ АНИМАЦИЯМИ
// ============================================================
export class AnimationManager {
  constructor() {
    this._animations = new Map();
    this._rafId = null;
    this._isRunning = false;
  }

  // ============================================================
  // ЗВЕЗДЫ
  // ============================================================

  createStars(count = 300) {
    const container = document.getElementById('stars');
    if (!container) return;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const size = Math.random() * 3 + 1;
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
  // ЭФФЕКТ КЛИКА
  // ============================================================

  playClickEffect(element) {
    if (!element) return;

    element.classList.remove('active');
    // Триггер reflow для перезапуска анимации
    void element.offsetWidth;
    element.classList.add('active');
  }

  // ============================================================
  // ВСПЛЫВАЮЩИЙ УРОН (FLOATING DAMAGE NUMBERS)
  // ============================================================

  showDamageNumber(x, y, damage, isCrit = false, isBoss = false) {
    const damageEl = document.createElement('div');
    damageEl.className = 'damage-number';
    
    // Стилизация в зависимости от типа удара
    if (isCrit) {
      damageEl.classList.add('crit');
      damageEl.textContent = `${damage}!`;
    } else {
      damageEl.textContent = `-${damage}`;
    }
    
    if (isBoss) {
      damageEl.classList.add('boss-damage');
    }
    
    // Позиционирование в точке клика с небольшим разбросом
    const offsetX = (Math.random() - 0.5) * 60;
    const offsetY = (Math.random() - 0.5) * 30;
    
    damageEl.style.left = `${x + offsetX}px`;
    damageEl.style.top = `${y + offsetY}px`;
    
    document.body.appendChild(damageEl);
    
    // Запускаем анимацию
    requestAnimationFrame(() => {
      damageEl.classList.add('animate');
    });
    
    // Удаляем элемент после анимации
    setTimeout(() => {
      if (damageEl.parentNode) {
        damageEl.remove();
      }
    }, 1200);
  }

  // ============================================================
  // УДАРНАЯ ВОЛНА (SHOCKWAVE)
  // ============================================================

  createShockwave(x, y, intensity = 'normal') {
    const shockwave = document.createElement('div');
    shockwave.className = 'shockwave';
    
    if (intensity === 'crit') {
      shockwave.classList.add('crit-shockwave');
    } else if (intensity === 'boss') {
      shockwave.classList.add('boss-shockwave');
    }
    
    shockwave.style.left = `${x}px`;
    shockwave.style.top = `${y}px`;
    
    document.body.appendChild(shockwave);
    
    // Удаляем после анимации
    setTimeout(() => {
      if (shockwave.parentNode) {
        shockwave.remove();
      }
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

    setTimeout(() => {
      element.classList.remove('level-up');
    }, 800);
  }

  // ============================================================
  // ЭФФЕКТ УБИЙСТВА БОССА
  // ============================================================

  playBossDeathEffect(x, y) {
    // Screen shake
    document.body.classList.add('screen-shake');
    setTimeout(() => {
      document.body.classList.remove('screen-shake');
    }, 400);
    
    // Flash effect
    const flash = document.createElement('div');
    flash.className = 'death-flash';
    document.body.appendChild(flash);
    
    setTimeout(() => {
      if (flash.parentNode) {
        flash.remove();
      }
    }, 200);
    
    // Много частиц
    this.createParticles(null, {
      count: 40,
      color: '#ffd700',
      size: 6,
      duration: 1500,
      spread: 200,
      x: x,
      y: y
    });
    
    // Несколько ударных волн
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.createShockwave(x, y, 'boss');
      }, i * 150);
    }
  }

  // ============================================================
  // ЭФФЕКТ НАЖАТИЯ
  // ============================================================

  playPressEffect(element, scale = 0.92, duration = 150) {
    if (!element) return;

    element.style.transform = `scale(${scale})`;
    element.style.transition = `transform ${duration}ms ease`;

    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, duration);
  }

  // ============================================================
  // ПУЛЬСАЦИЯ
  // ============================================================

  pulse(element, options = {}) {
    const {
      duration = 1000,
      scale = 1.1,
      iterations = Infinity,
      direction = 'alternate'
    } = options;

    if (!element) return;

    const animation = element.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${scale})` }
    ], {
      duration,
      iterations,
      direction,
      easing: 'ease-in-out'
    });

    return animation;
  }

  // ============================================================
  // ПЛАВНОЕ ПОЯВЛЕНИЕ
  // ============================================================

  fadeIn(element, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      element.style.opacity = '0';
      element.style.display = 'block';
      element.style.transition = `opacity ${duration}ms ease`;

      requestAnimationFrame(() => {
        element.style.opacity = '1';
      });

      setTimeout(resolve, duration);
    });
  }

  fadeOut(element, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      element.style.transition = `opacity ${duration}ms ease`;
      element.style.opacity = '0';

      setTimeout(() => {
        element.style.display = 'none';
        resolve();
      }, duration);
    });
  }

  // ============================================================
  // СЧЕТЧИК
  // ============================================================

  animateCounter(element, from, to, duration = 1000) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      const startTime = performance.now();
      const diff = to - from;

      const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(from + diff * eased);

        element.textContent = current;

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          element.textContent = to;
          resolve();
        }
      };

      requestAnimationFrame(update);
    });
  }

  // ============================================================
  // ПРОГРЕСС-БАР
  // ============================================================

  animateProgressBar(element, from, to, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      const startTime = performance.now();
      const diff = to - from;

      const update = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + diff * eased;

        element.style.width = Math.min(100, current) + '%';

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          element.style.width = Math.min(100, to) + '%';
          resolve();
        }
      };

      requestAnimationFrame(update);
    });
  }

  // ============================================================
  // ПАРТИКЛЫ (УЛУЧШЕННАЯ ВЕРСИЯ)
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

    // Определяем центр частиц
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
        {
          transform: 'translate(0, 0) scale(1)',
          opacity: 1
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(0)`,
          opacity: 0
        }
      ], {
        duration: duration * (0.5 + Math.random() * 0.5),
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      }).onfinish = () => {
        particle.remove();
      };
    }
  }

  // ============================================================
  // КОМПЛЕКСНЫЙ ЭФФЕКТ КЛИКА
  // ============================================================

  playClickVisualFeedback(event, damage, isCrit, isBoss = false) {
    const x = event.clientX || event.pageX;
    const y = event.clientY || event.pageY;
    
    // 1. Всплывающий урон
    this.showDamageNumber(x, y, damage, isCrit, isBoss);
    
    // 2. Ударная волна
    const shockwaveIntensity = isCrit ? 'crit' : 'normal';
    this.createShockwave(x, y, shockwaveIntensity);
    
    // 3. Частицы
    const particleColor = isCrit ? '#ffd700' : '#f0e6d0';
    const particleCount = isCrit ? 15 : 8;
    this.createParticles(null, {
      count: particleCount,
      color: particleColor,
      size: isCrit ? 5 : 3,
      duration: isCrit ? 800 : 600,
      spread: isCrit ? 120 : 80,
      x: x,
      y: y
    });
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

    // Обновляем все активные анимации
    for (const [id, animation] of this._animations) {
      if (animation.update) {
        animation.update();
      }
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }

  add(id, animation) {
    this._animations.set(id, animation);
  }

  remove(id) {
    this._animations.delete(id);
  }

  clear() {
    this._animations.clear();
  }
}

// ============================================================
// ЭКСПОРТ ЕДИНСТВЕННОГО ЭКЗЕМПЛЯРА
// ============================================================
export const animations = new AnimationManager();
