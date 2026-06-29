// ============================================================
//  ИНТЕРФЕЙС И ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================
import { handleLogin, handleRegister, logout } from './auth.js';
import { 
    initGameElements, 
    handleClick, 
    rollbackLevel, 
    resetProgress,
    updateShopUI,
    buyMoon,
    selectMoon,
    buyClickDamage
} from './game.js';
import { levelLocked, setLevelLocked, setTestMode, currentUser, activeMoon } from './state.js';
import { updateProfileAndLeaders } from './profile.js';
import { showToast } from './utils.js';
import { MOON_TYPES } from './config.js';

const lockOpenSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const lockClosedSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>`;

export function setLockIcon(btn, locked) {
    if (!btn) return;
    btn.innerHTML = locked ? lockClosedSVG : lockOpenSVG;
    btn.classList.toggle('locked', locked);
}

let leftPanel, leftTrigger, rightPanel, rightTrigger;

export function initUI() {
    // Авторизация
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginFields = document.getElementById('loginFields');
    const registerFields = document.getElementById('registerFields');
    const actionBtn = document.getElementById('actionBtn');
    const authMessageEl = document.getElementById('authMessage');

    // Панели
    leftPanel = document.getElementById('sidePanel');
    leftTrigger = document.getElementById('panelTrigger');
    rightPanel = document.getElementById('shopPanel');
    rightTrigger = document.getElementById('shopTrigger');
    
    const panelTabs = document.querySelectorAll('.left-panel .panel-tabs button');
    const panelContents = document.querySelectorAll('.left-panel .panel-content');
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    const testModeCheckbox = document.getElementById('testModeCheckbox');
    const resetProgressBtn = document.getElementById('resetProgressBtn');
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');
    const moonWrapper = document.getElementById('moonWrapper');
    const rollbackBtnMain = document.getElementById('rollbackBtnMain');
    const lockToggleMain = document.getElementById('lockToggleMain');

    // Инициализация игровых элементов
    initGameElements({
        moonWrapper,
        moonInner: document.getElementById('moonInner'),
        clickEffect: document.getElementById('clickEffect'),
        counterEl: document.getElementById('counter'),
        levelTitle: document.getElementById('levelTitle'),
        hpBar: document.getElementById('hpBar'),
        hpPercent: document.getElementById('hpPercent'),
        timerBarContainer: document.getElementById('timerBarContainer'),
        timerBar: document.getElementById('timerBar'),
        timerPercent: document.getElementById('timerPercent'),
        totalTimeDisplay: document.getElementById('totalTimeDisplay'),
        rollbackBtnMain,
        lockToggleMain
    });

    // --- Вкладки авторизации ---
    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));

    actionBtn.addEventListener('click', () => {
        if (tabLogin.classList.contains('active')) handleLogin();
        else handleRegister();
    });

    // Радиокнопки
    document.querySelectorAll('input[name="loginType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const input = document.getElementById('loginInput');
            input.placeholder = e.target.value === 'email' ? 'Email вашего аккаунта' : 'Ваш игровой логин';
        });
    });

    // Клик по луне
    if (moonWrapper) moonWrapper.addEventListener('click', handleClick);

    // Триггеры панелей
    if (leftTrigger) {
        leftTrigger.addEventListener('click', toggleLeftPanel);
        console.log('[UI] leftTrigger найден');
    } else console.error('[UI] leftTrigger не найден!');

    if (rightTrigger) {
        rightTrigger.addEventListener('click', toggleRightPanel);
        console.log('[UI] rightTrigger найден');
    } else console.error('[UI] rightTrigger не найден!');

    // Обновление данных
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', () => {
            refreshDataBtn.classList.add('spinning');
            setTimeout(() => refreshDataBtn.classList.remove('spinning'), 400);
            updateProfileAndLeaders(true);
        });
    }

    // Вкладки панели
    panelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            panelTabs.forEach(t => t.classList.remove('active'));
            panelContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const tabType = tab.getAttribute('data-tab');
            const panelId = `panel${tabType.charAt(0).toUpperCase() + tabType.slice(1)}`;
            const panel = document.getElementById(panelId);
            if (panel) panel.classList.add('active');
            if (tabType === 'settings') {
                const savedTest = localStorage.getItem('testMode') === 'true';
                if (testModeCheckbox) testModeCheckbox.checked = savedTest;
            }
            updateProfileAndLeaders(true);
        });
    });

    // Тестовый режим
    if (testModeCheckbox) {
        testModeCheckbox.addEventListener('change', (e) => {
            setTestMode(e.target.checked);
            localStorage.setItem('testMode', e.target.checked);
        });
    }

    // Сброс прогресса
    if (resetProgressBtn) {
        resetProgressBtn.addEventListener('click', () => confirmOverlay.classList.add('active'));
    }
    if (confirmNo) {
        confirmNo.addEventListener('click', () => confirmOverlay.classList.remove('active'));
    }
    if (confirmYes) {
        confirmYes.addEventListener('click', () => {
            confirmOverlay.classList.remove('active');
            resetProgress();
        });
    }

    // Откат уровня
    if (rollbackBtnMain) rollbackBtnMain.addEventListener('click', rollbackLevel);

    // Замок
    if (lockToggleMain) {
        setLockIcon(lockToggleMain, levelLocked);
        lockToggleMain.addEventListener('click', () => {
            const newState = !levelLocked;
            setLevelLocked(newState);
            localStorage.setItem('levelLocked', newState);
            setLockIcon(lockToggleMain, newState);
        });
    }

    // Выход
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Кнопка покупки улучшения клика
    const buyBtn = document.getElementById('buyClickDamageBtn');
    if (buyBtn) {
        buyBtn.addEventListener('click', () => {
            buyClickDamage();
        });
    }

    // Применить стиль начальной луны
    applyMoonStyle(activeMoon || 'normal');

    // Синхронизация состояния триггеров при загрузке
    if (leftPanel && leftTrigger) {
        if (leftPanel.classList.contains('active')) leftTrigger.classList.add('active');
        else leftTrigger.classList.remove('active');
    }
    if (rightPanel && rightTrigger) {
        if (rightPanel.classList.contains('active')) rightTrigger.classList.add('active');
        else rightTrigger.classList.remove('active');
    }

    console.log('[UI] Инициализация завершена');
}

export function setMode(mode) {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginFields = document.getElementById('loginFields');
    const registerFields = document.getElementById('registerFields');
    const actionBtn = document.getElementById('actionBtn');
    const authMessageEl = document.getElementById('authMessage');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginFields.classList.remove('hidden');
        registerFields.classList.add('hidden');
        actionBtn.textContent = 'Войти';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        loginFields.classList.add('hidden');
        registerFields.classList.remove('hidden');
        actionBtn.textContent = 'Зарегистрироваться';
    }
    if (authMessageEl) authMessageEl.textContent = '';
}

// Переключение левой панели
export function toggleLeftPanel() {
    if (!leftPanel || !leftTrigger) {
        console.error('[UI] toggleLeftPanel: элементы не найдены');
        return;
    }
    const isOpen = leftPanel.classList.contains('active');
    if (isOpen) {
        leftPanel.classList.remove('active');
        leftTrigger.classList.remove('active');
    } else {
        leftPanel.classList.add('active');
        leftTrigger.classList.add('active');
        if (currentUser) updateProfileAndLeaders(true);
    }
    console.log('[UI] Левая панель:', isOpen ? 'закрыта' : 'открыта');
}

// Переключение правой панели
export function toggleRightPanel() {
    if (!rightPanel || !rightTrigger) {
        console.error('[UI] toggleRightPanel: элементы не найдены');
        return;
    }
    const isOpen = rightPanel.classList.contains('active');
    if (isOpen) {
        rightPanel.classList.remove('active');
        rightTrigger.classList.remove('active');
    } else {
        rightPanel.classList.add('active');
        rightTrigger.classList.add('active');
        if (currentUser) updateShopUI();
    }
    console.log('[UI] Правая панель:', isOpen ? 'закрыта' : 'открыта');
}

// Применение стиля луны
export function applyMoonStyle(moonId) {
    const moonInner = document.getElementById('moonInner');
    if (!moonInner) return;
    const moon = MOON_TYPES[moonId];
    if (!moon) return;
    // Устанавливаем градиент и тень
    moonInner.style.backgroundImage = moon.gradient;
    moonInner.style.boxShadow = moon.shadow;
    // Добавляем/убираем класс blood-mode для контейнера (для старых стилей)
    const container = document.getElementById('app');
    if (container) {
        if (moonId === 'blood') {
            container.classList.add('blood-mode');
        } else {
            container.classList.remove('blood-mode');
        }
    }
}
