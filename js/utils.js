// ============================================================
//  УТИЛИТЫ
// ============================================================

// Форматирование времени (секунды -> "X дн X ч X мин X сек")
export function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const totalSec = Math.round(seconds);

    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    let parts = [];

    if (days > 0) {
        parts.push(`${days} дн`);
        if (hours > 0) parts.push(`${hours} ч`);
    } else if (hours > 0) {
        parts.push(`${hours} ч`);
        if (minutes > 0) parts.push(`${minutes} мин`);
    } else if (minutes > 0) {
        parts.push(`${minutes} мин`);
        if (secs > 0) parts.push(`${secs} сек`);
    } else {
        parts.push(`${secs} сек`);
    }

    return parts.join(' ');
}

// HP для уровня
export function getMaxHPForLevel(level, baseHP, bossInterval) {
    if (level % bossInterval === 0) {
        return baseHP * level;
    }
    return baseHP * (1 + (level - 1) * 0.1);
}

export function isBossLevel(level, bossInterval) {
    return level % bossInterval === 0;
}

// Титул по уровню
export function getTitle(level) {
    if (level < 10) return '🌱 Новичок';
    if (level < 20) return '🚀 Исследователь';
    if (level < 50) return '⚡ Мастер';
    if (level < 100) return '🌟 Легенда';
    if (level < 200) return '👑 Герой';
    if (level < 500) return '🔥 Мифический';
    return '💎 Бессмертный';
}

// --- Сбор данных об устройстве ---
export function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(ua)) return 'mobile';
    return 'desktop';
}

export function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown', version = 'Unknown';
    if (ua.indexOf('Chrome') > -1) { browser = 'Chrome'; version = ua.match(/Chrome\/(\d+)/)?.[1] || ''; }
    else if (ua.indexOf('Firefox') > -1) { browser = 'Firefox'; version = ua.match(/Firefox\/(\d+)/)?.[1] || ''; }
    else if (ua.indexOf('Safari') > -1) { browser = 'Safari'; version = ua.match(/Version\/(\d+)/)?.[1] || ''; }
    else if (ua.indexOf('Edge') > -1) { browser = 'Edge'; version = ua.match(/Edge\/(\d+)/)?.[1] || ''; }
    else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) { browser = 'Opera'; version = ua.match(/(Opera|OPR)\/(\d+)/)?.[2] || ''; }
    return { browser, version };
}

export function getOSInfo() {
    const ua = navigator.userAgent;
    let os = 'Unknown', version = '';
    if (ua.indexOf('Windows') > -1) { os = 'Windows'; version = ua.match(/Windows NT (\d+\.\d+)/)?.[1] || ''; }
    else if (ua.indexOf('Mac OS') > -1) { os = 'macOS'; version = ua.match(/Mac OS X (\d+[._\d]+)/)?.[1]?.replace(/_/g, '.') || ''; }
    else if (ua.indexOf('Android') > -1) { os = 'Android'; version = ua.match(/Android (\d+\.\d+)/)?.[1] || ''; }
    else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) { os = 'iOS'; version = ua.match(/OS (\d+[._\d]+)/)?.[1]?.replace(/_/g, '.') || ''; }
    else if (ua.indexOf('Linux') > -1) { os = 'Linux'; }
    return { os, version };
}

export function getScreenInfo() {
    return { width: window.screen.width, height: window.screen.height, colorDepth: window.screen.colorDepth };
}

export function getLanguage() { return navigator.language || navigator.userLanguage || 'en'; }

export function getTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone; }

export function collectStaticDeviceData() {
    const browser = getBrowserInfo();
    const os = getOSInfo();
    const screen = getScreenInfo();
    return {
        device_type: getDeviceType(),
        browser: browser.browser,
        browser_version: browser.version,
        os: os.os,
        os_version: os.version,
        screen_width: screen.width,
        screen_height: screen.height,
        color_depth: screen.colorDepth,
        language: getLanguage(),
        timezone: getTimezone(),
        user_agent: navigator.userAgent,
        referrer: document.referrer || ''
    };
}

// --- Toast-уведомления (исправлено: очищает контейнер перед добавлением) ---
let toastContainer = null;

export function initToastContainer(container) {
    toastContainer = container;
}

export function showToast(message, type = 'info', duration = 2000) {
    if (!toastContainer) {
        console.warn('Toast container not initialized');
        return;
    }
    // Очищаем контейнер от старых тостов
    toastContainer.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, duration);
}

// --- Звёзды ---
export function createStars() {
    const container = document.getElementById('stars');
    if (!container) return;
    for (let i = 0; i < 300; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 3 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
        star.style.animationDelay = Math.random() * 5 + 's';
        container.appendChild(star);
    }
}
