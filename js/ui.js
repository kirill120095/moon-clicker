// ============================================================
//  ИНТЕРФЕЙС И ОБРАБОТЧИКИ СОБЫТИЙ (ИСПРАВЛЕНО)
// ============================================================
import { handleLogin, handleRegister, logout } from './auth.js';
import { 
    initGameElements, 
    handleClick, 
    rollbackLevel, 
    resetProgress 
} from './game.js';
import { levelLocked, setLevelLocked, testMode, setTestMode, currentUser } from './state.js';
import { updateProfileAndLeaders } from './profile.js';

// DOM-элементы
let tabLogin, tabRegister, loginFields, registerFields, actionBtn, authMessageEl;
let sidePanel, statsToggleBtn, settingsBtn, panelClose, panelTabs, panelContents;
let settingsModal, closeSettingsBtn, bgOptions, testModeCheckbox, resetProgressBtn;
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

    // Настройки
    settingsModal = document.getElementById('settingsModal');
    closeSettingsBtn = document.getElementById('closeSettingsBtn');
    bgOptions = document.querySelectorAll('#bgOptions button');
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
    
    // Синхронизируем подсветку активной луны при старте
    syncMoonBgHighlight();
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

    // Переключение вкладок внутри боковой панели (Лидеры 🏆 / Профиль 👤)
    panelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            panelTabs.forEach(t => t.classList.remove('active'));
            panelContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab') === 'leaders' ? 'panelLeaders' : 'panelProfile';
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Открытие/закрытие настроек
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        // Обновляем данные аккаунта в модалке
        if (currentUser) {
            document.getElementById('accountNickname').textContent = currentUser.user_metadata?.username || 'Игрок';
            document.getElementById('accountEmail').textContent = currentUser.email || '-';
        }
        syncMoonBgHighlight();
    });
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    // Выбор фона луны (Обычная / Кровавая) + Подсветка кнопок
    bgOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-bg');
            setMoonMode(mode);
            syncMoonBgHighlight();
        });
    });

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
        lockToggleMain.addEventListener('click', () => {
            const newState = !levelLocked;
            setLevelLocked(newState);
            localStorage.setItem('levelLocked', newState);
            lockToggleMain.textContent = newState ? '🔒' : '🔓';
            lockToggleMain.classList.toggle('locked', newState);
        });
    }

    // Выход из аккаунта
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Функция внутренней установки стилей луны
export function setMoonMode(mode) {
    const container = document.getElementById('app');
    const moonInner = document.getElementById('moonInner');
    if (mode === 'blood') {
        container.classList.add('blood-mode');
        if (moonInner) moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #ff4444, #cc0000)';
    } else {
        container.classList.remove('blood-mode');
        if (moonInner) moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #f0e6d0, #d4af37)';
    }
    localStorage.setItem('moonMode', mode);
}

// Функция синхронизации класса .active на кнопках выбора луны
export function syncMoonBgHighlight() {
    const currentMode = localStorage.getItem('moonMode') || 'normal';
    if (!bgOptions) return;
    bgOptions.forEach(btn => {
        if (btn.getAttribute('data-bg') === currentMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}
