// ============================================================
//  ПРОФИЛИРОВАНИЕ И ОПТИМИЗАЦИЯ
// ============================================================

// ============================================================
//  ПРОФАЙЛЕР
// ============================================================
class Profiler {
    constructor() {
        this._marks = new Map();
        this._measures = new Map();
        this._enabled = false;
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
    }

    mark(name) {
        if (!this._enabled) return;
        this._marks.set(name, performance.now());
    }

    measure(name, markName) {
        if (!this._enabled) return;
        const start = this._marks.get(markName);
        if (!start) return;
        const duration = performance.now() - start;
        this._measures.set(name, duration);
        return duration;
    }

    getMeasure(name) {
        return this._measures.get(name);
    }

    clear() {
        this._marks.clear();
        this._measures.clear();
    }

    report() {
        const report = {};
        for (const [name, duration] of this._measures) {
            report[name] = `${duration.toFixed(2)}ms`;
        }
        return report;
    }
}

export const profiler = new Profiler();

// ============================================================
//  UI SCHEDULER (DEBOUNCE ДЛЯ UI ОБНОВЛЕНИЙ)
// ============================================================
export class UIScheduler {
    constructor() {
        this._queue = [];
        this._isRunning = false;
        this._frameId = null;
        this._maxBatchSize = 10;
    }

    schedule(callback, priority = 0) {
        this._queue.push({ callback, priority });
        this._queue.sort((a, b) => b.priority - a.priority);
        this._run();
    }

    _run() {
        if (this._isRunning) return;
        if (this._queue.length === 0) return;
        
        this._isRunning = true;
        this._frameId = requestAnimationFrame(() => {
            const batch = this._queue.splice(0, this._maxBatchSize);
            for (const item of batch) {
                try {
                    item.callback();
                } catch (e) {
                    console.error('[UIScheduler] Error:', e);
                }
            }
            this._isRunning = false;
            if (this._queue.length > 0) {
                this._run();
            }
        });
    }

    cancel() {
        if (this._frameId) {
            cancelAnimationFrame(this._frameId);
            this._frameId = null;
        }
        this._queue = [];
        this._isRunning = false;
    }

    setMaxBatchSize(size) {
        this._maxBatchSize = Math.max(1, size);
    }
}

export const uiScheduler = new UIScheduler();

// ============================================================
//  МЕМОИЗАЦИЯ
// ============================================================
export function memoize(fn, options = {}) {
    const cache = new Map();
    const ttl = options.ttl || 0;
    const maxSize = options.maxSize || 100;
    
    return function memoized(...args) {
        const key = JSON.stringify(args);
        
        if (cache.has(key)) {
            const entry = cache.get(key);
            if (ttl === 0 || Date.now() - entry.timestamp < ttl) {
                return entry.value;
            }
            cache.delete(key);
        }
        
        const result = fn.apply(this, args);
        
        // Проверяем размер кэша
        if (cache.size >= maxSize) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
        }
        
        cache.set(key, {
            value: result,
            timestamp: Date.now()
        });
        
        return result;
    };
}

// ============================================================
//  BATCH DOM ОБНОВЛЕНИЙ
// ============================================================
export function batchDOMUpdates(updates) {
    const fragment = document.createDocumentFragment();
    
    for (const update of updates) {
        const { selector, html, append, attribute } = update;
        const elements = document.querySelectorAll(selector);
        
        for (const el of elements) {
            if (attribute) {
                el.setAttribute(attribute.name, attribute.value);
                continue;
            }
            
            if (append) {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                while (temp.firstChild) {
                    el.appendChild(temp.firstChild);
                }
            } else {
                el.innerHTML = html;
            }
        }
    }
}

// ============================================================
//  ИЗМЕРЕНИЕ ПРОИЗВОДИТЕЛЬНОСТИ
// ============================================================
export function measurePerformance(label, fn) {
    profiler.mark(`start_${label}`);
    const result = fn();
    profiler.measure(label, `start_${label}`);
    return result;
}

export async function measurePerformanceAsync(label, fn) {
    profiler.mark(`start_${label}`);
    const result = await fn();
    profiler.measure(label, `start_${label}`);
    return result;
}

// ============================================================
//  СОЗДАНИЕ ЗВЕЗД (оптимизированная версия)
// ============================================================
export function createStars(count = 300) {
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
//  ОБНАРУЖЕНИЕ SLOW FRAMES
// ============================================================
export class FrameMonitor {
    constructor() {
        this._lastFrame = performance.now();
        this._slowFrames = 0;
        this._threshold = 16;
        this._listeners = [];
        this._isRunning = false;
        this._rafId = null;
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;
        this._checkFrame();
    }

    stop() {
        this._isRunning = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    _checkFrame() {
        if (!this._isRunning) return;
        
        const now = performance.now();
        const delta = now - this._lastFrame;
        
        if (delta > this._threshold) {
            this._slowFrames++;
            this._notify(delta);
        }
        
        this._lastFrame = now;
        this._rafId = requestAnimationFrame(() => this._checkFrame());
    }

    _notify(delta) {
        for (const listener of this._listeners) {
            try {
                listener(delta);
            } catch (e) {
                console.error('[FrameMonitor] Listener error:', e);
            }
        }
    }

    onSlowFrame(callback) {
        this._listeners.push(callback);
        return () => {
            const index = this._listeners.indexOf(callback);
            if (index !== -1) {
                this._listeners.splice(index, 1);
            }
        };
    }

    getStats() {
        return {
            slowFrames: this._slowFrames,
            threshold: this._threshold
        };
    }

    reset() {
        this._slowFrames = 0;
    }
}

// ============================================================
//  ОПТИМИЗАЦИЯ ПЕРЕРИСОВКИ
// ============================================================
export function optimizeRendering() {
    const style = document.createElement('style');
    style.textContent = `
        .optimize-render {
            will-change: transform;
            contain: layout style paint;
        }
        .optimize-animate {
            will-change: transform, opacity;
        }
        .optimize-background {
            will-change: transform;
            backface-visibility: hidden;
        }
        .gpu-accelerated {
            transform: translateZ(0);
            backface-visibility: hidden;
            perspective: 1000px;
        }
    `;
    document.head.appendChild(style);

    // Применяем оптимизации к элементам
    document.querySelectorAll('.moon-wrapper, .moon, .moon-inner').forEach(el => {
        el.classList.add('gpu-accelerated');
    });
}

// ============================================================
//  LAZY LOAD ИЗОБРАЖЕНИЙ
// ============================================================
export function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        }, {
            rootMargin: '50px 0px'
        });
        
        for (const img of images) {
            observer.observe(img);
        }
    } else {
        // Fallback
        for (const img of images) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        }
    }
}

// ============================================================
//  ПРЕДЗАГРУЗКА РЕСУРСОВ
// ============================================================
export function preloadResources(urls) {
    for (const url of urls) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        
        if (url.endsWith('.css')) {
            link.as = 'style';
        } else if (url.endsWith('.js')) {
            link.as = 'script';
        } else if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
            link.as = 'image';
        } else if (url.endsWith('.woff2')) {
            link.as = 'font';
            link.crossOrigin = 'anonymous';
        } else {
            link.as = 'fetch';
        }
        
        document.head.appendChild(link);
    }
}

// ============================================================
//  ОПТИМИЗАЦИЯ СКРОЛЛА
// ============================================================
export function optimizeScroll() {
    let ticking = false;
    let callbacks = [];
    
    const handleScroll = () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                for (const cb of callbacks) {
                    try {
                        cb();
                    } catch (e) {
                        console.error('[Scroll] Callback error:', e);
                    }
                }
                ticking = false;
            });
            ticking = true;
        }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return {
        addCallback: (callback) => {
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1) {
                    callbacks.splice(index, 1);
                }
            };
        },
        destroy: () => {
            window.removeEventListener('scroll', handleScroll);
            callbacks = [];
        }
    };
}

// ============================================================
//  ВИРТУАЛИЗАЦИЯ СПИСКОВ
// ============================================================
export class VirtualList {
    constructor(options) {
        this.container = options.container;
        this.itemHeight = options.itemHeight || 50;
        this.buffer = options.buffer || 5;
        this.items = options.items || [];
        this.renderItem = options.renderItem;
        this.onChange = options.onChange || null;
        
        this._visibleItems = [];
        this._scrollTop = 0;
        this._containerHeight = 0;
        this._isDirty = true;
        
        this._init();
    }

    _init() {
        this._containerHeight = this.container.clientHeight;
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        
        this._scrollContainer = document.createElement('div');
        this._scrollContainer.style.height = this.items.length * this.itemHeight + 'px';
        this._scrollContainer.style.position = 'relative';
        this.container.appendChild(this._scrollContainer);
        
        this._viewport = document.createElement('div');
        this._viewport.style.position = 'absolute';
        this._viewport.style.top = '0';
        this._viewport.style.left = '0';
        this._viewport.style.right = '0';
        this._scrollContainer.appendChild(this._viewport);
        
        this._handleScroll = this._handleScroll.bind(this);
        this.container.addEventListener('scroll', this._handleScroll);
        
        this._render();
    }

    _handleScroll() {
        this._scrollTop = this.container.scrollTop;
        this._isDirty = true;
        this._render();
    }

    _render() {
        if (!this._isDirty) return;
        
        const startIndex = Math.max(0, Math.floor(this._scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length,
            Math.ceil((this._scrollTop + this._containerHeight) / this.itemHeight) + this.buffer
        );

        const visibleItems = this.items.slice(startIndex, endIndex);
        
        // Проверяем, изменились ли видимые элементы
        if (this._visibleItems.length === visibleItems.length &&
            this._visibleItems.every((item, i) => item === visibleItems[i])) {
            this._isDirty = false;
            return;
        }
        
        this._visibleItems = visibleItems;
        this._viewport.innerHTML = '';
        this._viewport.style.top = (startIndex * this.itemHeight) + 'px';
        
        for (let i = 0; i < visibleItems.length; i++) {
            const item = visibleItems[i];
            const element = this.renderItem(item, startIndex + i);
            this._viewport.appendChild(element);
        }
        
        this._isDirty = false;
        
        if (this.onChange) {
            this.onChange(startIndex, endIndex, visibleItems);
        }
    }

    setItems(items) {
        this.items = items;
        this._scrollContainer.style.height = items.length * this.itemHeight + 'px';
        this._isDirty = true;
        this._render();
    }

    updateItem(index, item) {
        if (index < 0 || index >= this.items.length) return;
        this.items[index] = item;
        
        // Проверяем, видим ли этот элемент
        const startIndex = Math.max(0, Math.floor(this._scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length,
            Math.ceil((this._scrollTop + this._containerHeight) / this.itemHeight) + this.buffer
        );
        
        if (index >= startIndex && index < endIndex) {
            this._isDirty = true;
            this._render();
        }
    }

    scrollTo(index) {
        if (index < 0 || index >= this.items.length) return;
        this.container.scrollTop = index * this.itemHeight;
    }

    destroy() {
        this.container.removeEventListener('scroll', this._handleScroll);
        this.container.innerHTML = '';
        this.items = [];
        this._visibleItems = [];
    }

    resize() {
        this._containerHeight = this.container.clientHeight;
        this._isDirty = true;
        this._render();
    }
}

// ============================================================
//  ТРОТТЛИНГ И ДЕБАНС
// ============================================================
export function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId = null;
    let lastArgs = null;
    
    return function throttled(...args) {
        const now = Date.now();
        lastArgs = args;
        
        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn.apply(this, lastArgs);
                timeoutId = null;
            }, delay - (now - lastCall));
        }
    };
}

export function debounce(fn, delay) {
    let timeoutId = null;
    
    return function debounced(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

// ============================================================
//  ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
export default {
    profiler,
    uiScheduler,
    memoize,
    batchDOMUpdates,
    measurePerformance,
    measurePerformanceAsync,
    createStars,
    FrameMonitor,
    optimizeRendering,
    lazyLoadImages,
    preloadResources,
    optimizeScroll,
    VirtualList,
    throttle,
    debounce
};
