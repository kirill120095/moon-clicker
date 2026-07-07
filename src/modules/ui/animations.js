// ============================================================
//  АНИМАЦИИ
// ============================================================

// ============================================================
//  УПРАВЛЕНИЕ АНИМАЦИЯМИ
// ============================================================
export class AnimationManager {
    constructor() {
        this._animations = new Map();
        this._rafId = null;
        this._isRunning = false;
    }

    // ============================================================
    //  ЗВЕЗДЫ
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
    //  ЭФФЕКТ КЛИКА
    // ============================================================
    
    playClickEffect(element) {
        if (!element) return;
        
        element.classList.remove('active');
        // Триггер reflow для перезапуска анимации
        void element.offsetWidth;
        element.classList.add('active');
    }

    // ============================================================
    //  ЭФФЕКТ ПОВЫШЕНИЯ УРОВНЯ
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
    //  ЭФФЕКТ НАЖАТИЯ
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
    //  ПУЛЬСАЦИЯ
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
    //  ПЛАВНОЕ ПОЯВЛЕНИЕ
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
    //  СЧЕТЧИК
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
    //  ПРОГРЕСС-БАР
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
    //  ПАРТИКЛЫ
    // ============================================================
    
    createParticles(container, options = {}) {
        const {
            count = 20,
            color = '#ffd700',
            size = 4,
            duration = 1000,
            spread = 100
        } = options;

        if (!container) return;

        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

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
            `;

            document.body.appendChild(particle);

            const angle = Math.random() * Math.PI * 2;
            const distance = spread * (0.5 + Math.random() * 0.5);
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance - spread * 0.5;

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
                easing: 'ease-out',
                fill: 'forwards'
            }).onfinish = () => {
                particle.remove();
            };
        }
    }

    // ============================================================
    //  УПРАВЛЕНИЕ АНИМАЦИЯМИ
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
//  ЭКСПОРТ ЕДИНСТВЕННОГО ЭКЗЕМПЛЯРА
// ============================================================
export const animations = new AnimationManager();
