// ============================================================
//  ИНТЕРФЕЙС И ОБРАБОТЧИКИ СОБЫТИЙ (С ИКОНКАМИ SVG)
// ============================================================
import { handleLogin, handleRegister, logout } from './auth.js';
import { 
    initGameElements, 
    handleClick, 
    rollbackLevel, 
    resetProgress 
} from './game.js';
import { levelLocked, setLevelLocked, setTestMode, currentUser } from './state.js';
import { updateProfileAndLeaders } from './profile.js';

// SVG для замка (открытый / закрытый)
const lockOpenSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const lockClosedSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>`;

function setLockIcon(btn, locked) {
    btn.innerHTML = locked ? lockClosedSVG : lockOpenSVG;
    btn.classList.toggle('locked', locked);
}

// DOM-элементы
let tabLogin, tabRegister, loginFields, registerFields, actionBtn, authMessageEl;
let sidePanel, statsToggleBtn, settingsBtn, panelClose, panelTabs, panelContents, refreshDataBtn;
let settingsModal, closeSettingsBtn, testModeCheckbox, resetProgressBtn;
let confirmOverlay, confirmYes, confirmNo;
let moonWrapper;

export function initUI() {
    // Авторизация
    tabLogin = document.getElementById('tabLogin');
    tabRegister = document.getElementById('tabRegister');
    loginFields = document.getElementById('loginFields');
    registerFields = document.getElementById('registerFields');
    actionBtn = document.getElementById('actionBtn');
    authMessageEl = document.getElementById('authMessage');

    // Панели управления
    sidePanel = document.getElementById('sidePanel');
    statsToggleBtn = document.getElementById('statsToggleBtn');
    settingsBtn = document.getElementById('settingsBtn');
    panelClose = document.getElementById('panelClose');
    panelTabs = document.querySelectorAll('.side-panel .panel-tabs button');
    panelContents = document.querySelectorAll('.side-panel .panel-content');
    refreshDataBtn = document.getElementById('refreshDataBtn');

    // Настройки
    settingsModal = document.getElementById('settingsModal');
    closeSettingsBtn = document.getElementById('closeSettingsBtn');
    testModeCheckbox = document.getElementById('testModeCheckbox');
    resetProgressBtn = document.getElementById('resetProgressBtn');

    // Модалка подтверждения
    confirmOverlay = document.getElementById('confirmOverlay');
    confirmYes = document.getElementById('confirmYes');
    confirmNo = document.getElementById('confirmNo');

    // Игровые элементы
    moonWrapper = document.getElementById('moonWrapper');
    const rollbackBtnMain = document.getElementById('rollbackBtnMain');
    const lockToggleMain = document.getElementById('lockToggleMain');

    // Передаем элементы в game.js
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

    // Навешивание событий
    initEvents();
    
    // Восстанавливаем сохраненный режим луны из памяти
    const savedMode = localStorage.getItem('moonMode') || 'normal';
    applyMoonStyle(savedMode);
}

export function setMode(mode) {
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

function initEvents() {
    // Вкладки авторизации
    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));

    // Кнопка действия авторизации
    actionBtn.addEventListener('click', () => {
        if (tabLogin.classList.contains('active')) {
            handleLogin();
        } else {
            handleRegister();
        }
    });

    // Радиокнопки типа входа
    document.querySelectorAll('input[name="loginType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const input = document.getElementById('loginInput');
            if (e.target.value === 'email') {
                input.placeholder = 'Email вашего аккаунта';
            } else {
                input.placeholder = 'Ваш игровой логин';
            }
        });
    });

    // Клик по луне
    if (moonWrapper) {
        moonWrapper.addEventListener('click', handleClick);
    }

    // Кнопки боковой панели (Статистика/Лидеры)
    statsToggleBtn.addEventListener('click', () => {
        sidePanel.classList.toggle('active');
        if (sidePanel.classList.contains('active')) {
            updateProfileAndLeaders(true);
        }
    });
    panelClose.addEventListener('click', () => sidePanel.classList.remove('active'));

    // Кнопка ручного обновления данных 🔄
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', () => {
            refreshDataBtn.classList.add('spinning');
            setTimeout(() => { refreshDataBtn.classList.remove('spinning'); }, 400);
            updateProfileAndLeaders(true);
        });
    }

    // Переключение вкладок внутри боковой панели (Лидеры / Профиль)
    panelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            panelTabs.forEach(t => t.classList.remove('active'));
            panelContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            
            const tabType = tab.getAttribute('data-tab');
            if (tabType === 'leaders' || tab.textContent.includes('🏆')) {
                document.getElementById('panelLeaders').classList.add('active');
            } else {
                document.getElementById('panelProfile').classList.add('active');
            }

            // Мягкое обновление данных при клике на вкладку без лагов UI
            updateProfileAndLeaders(true);
        });
    });

    // Открытие/закрытие настроек
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        const savedMode = localStorage.getItem('moonMode') || 'normal';
        applyMoonStyle(savedMode);
    });
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    // Тестовый режим
    testModeCheckbox.addEventListener('change', (e) => {
        setTestMode(e.target.checked);
        localStorage.setItem('testMode', e.target.checked);
    });

    // Сброс прогресса
    resetProgressBtn.addEventListener('click', () => {
        confirmOverlay.classList.add('active');
    });
    confirmNo.addEventListener('click', () => confirmOverlay.classList.remove('active'));
    confirmYes.addEventListener('click', () => {
        confirmOverlay.classList.remove('active');
        resetProgress();
    });

    // Игровой контроль
    const rollbackBtnMain = document.getElementById('rollbackBtnMain');
    if (rollbackBtnMain) {
        rollbackBtnMain.addEventListener('click', rollbackLevel);
    }

    const lockToggleMain = document.getElementById('lockToggleMain');
    if (lockToggleMain) {
        // Устанавливаем начальное состояние
        setLockIcon(lockToggleMain, levelLocked);
        lockToggleMain.addEventListener('click', () => {
            const newState = !levelLocked;
            setLevelLocked(newState);
            localStorage.setItem('levelLocked', newState);
            setLockIcon(lockToggleMain, newState);
        });
    }

    // Выход из аккаунта
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Выбор фона луны в профиле (обработчики добавляются через делегирование)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.profile-bg-options button');
        if (target) {
            const mode = target.getAttribute('data-bg');
            localStorage.setItem('moonMode', mode);
            applyMoonStyle(mode);
            // Обновляем профиль, чтобы активная кнопка подсветилась
            updateProfileAndLeaders(true);
        }
    });
}

export function applyMoonStyle(mode) {
    const container = document.getElementById('app');
    const moonInner = document.getElementById('moonInner');
    
    if (mode === 'blood') {
        if (container) container.classList.add('blood-mode');
        if (moonInner) moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #ff4444, #cc0000)';
    } else {
        if (container) container.classList.remove('blood-mode');
        if (moonInner) moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #f0e6d0, #d4af37)';
    }
}
