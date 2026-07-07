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
//  DEBOUNCE ДЛЯ UI ОБНОВЛЕНИЙ
// ============================================================
export class UIScheduler {
    constructor() {
        this._queue = [];
        this._isRunning = false;
        this._frameId = null;
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
            const batch = this._queue.splice(0, 10);
            for (const item of batch) {
                try {
                    item.callback();
                } catch (e) {
                    console.error('UI scheduler error:', e);
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
}

export const uiScheduler = new UIScheduler();

// ============================================================
//  МЕМОИЗАЦИЯ
// ============================================================
export function memoize(fn, options = {}) {
    const cache = new Map();
    const ttl = options.ttl || 0;
    
    return function memoized(...args) {
        const key = JSON.stringify(args);
        
        if (cache.has(key)) {
            const entry = cache.get(key);
            if (ttl === 0 || Date.now() - entry.timestamp < ttl) {
                return entry.value;
            }
        }
        
        const result = fn.apply(this, args);
        cache.set(key, {
            value: result,
            timestamp: Date.now()
        });
        
        return result;
    };
}

// ============================================================
//  ОПТИМИЗАЦИЯ DOM
// ============================================================
export function batchDOMUpdates(updates) {
    const fragment = document.createDocumentFragment();
    const root = document.createElement('div');
    
    for (const update of updates) {
        const { selector, html, append } = update;
        const elements = document.querySelectorAll(selector);
        
        for (const el of elements) {
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
//  ОБНАРУЖЕНИЕ SLOW FRAMES
// ============================================================
export class FrameMonitor {
    constructor() {
        this._lastFrame = performance.now();
        this._slowFrames = 0;
        this._threshold = 16; // 60 FPS
        this._listeners = [];
    }

    start() {
        this._checkFrame();
    }

    _checkFrame() {
        const now = performance.now();
        const delta = now - this._lastFrame;
        
        if (delta > this._threshold) {
            this._slowFrames++;
            this._notify(delta);
        }
        
        this._lastFrame = now;
        requestAnimationFrame(() => this._checkFrame());
    }

    _notify(delta) {
        for (const listener of this._listeners) {
            try {
                listener(delta);
            } catch (e) {
                console.error('Frame monitor error:', e);
            }
        }
    }

    onSlowFrame(callback) {
        this._listeners.push(callback);
    }

    getStats() {
        return {
            slowFrames: this._slowFrames,
            threshold: this._threshold
        };
    }
}

// ============================================================
//  ОПТИМИЗАЦИЯ ПЕРЕРИСОВКИ
// ============================================================
export function optimizeRendering() {
    // Используем transform вместо top/left
    // Используем will-change для анимируемых элементов
    // Используем contain для изоляции
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
    `;
    document.head.appendChild(style);
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
    FrameMonitor,
    optimizeRendering
};
