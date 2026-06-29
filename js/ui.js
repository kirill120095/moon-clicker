// ============================================================
//  ИНТЕРФЕЙС И ОБРАБОТЧИКИ СОБЫТИЙ (ИСПРАВЛЕННЫЙ ВИЗУАЛ)
// ============================================================
import { handleLogin, handleRegister, logout } from './auth.js';
import { 
    initGameElements, 
    handleClick, 
    rollbackLevel, 
    resetProgress 
} from './game.js';
import { levelLocked, setLevelLocked, testMode, setTestMode, currentUser, playerData, totalSecondsPlayed } from './state.js';
import { updateProfileAndLeaders } from './profile.js';
import { formatTime } from './utils.js';

// DOM-элементы
let tabLogin, tabRegister, loginFields, registerFields, actionBtn, authMessageEl;
let sidePanel, statsToggleBtn, settingsBtn, panelClose, panelTabs, panelContents, refreshDataBtn;
let settingsModal, closeSettingsBtn, testModeCheckbox, resetProgressBtn;
let confirmOverlay, confirmYes, confirmNo;
let moonWrapper;
let bgOptionsProfile;

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
        totalTimeDisplay: null, // больше не используется на главном экране
        rollbackBtnMain,
        lockToggleMain
    });

    // Фоны в профиле
    bgOptionsProfile = document.querySelectorAll('#bgOptionsProfile button');

    // Навешивание событий
    initEvents();
    
    // Восстанавливаем сохраненный режим луны
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
            updateProfileInfo(); // обновляем информацию в профиле
        }
    });
    panelClose.addEventListener('click', () => sidePanel.classList.remove('active'));

    // Кнопка ручного обновления данных 🔄
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', () => {
            refreshDataBtn.classList.add('spinning');
            setTimeout(() => { refreshDataBtn.classList.remove('spinning'); }, 400);
            updateProfileAndLeaders(true);
            updateProfileInfo();
        });
    }

    // Переключение вкладок внутри боковой панели
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
                updateProfileInfo(); // обновляем профиль при переключении
            }

            updateProfileAndLeaders(true);
        });
    });

    // Открытие/закрытие настроек
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
    });
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    // Выбор фона луны в профиле
    bgOptionsProfile.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-bg');
            localStorage.setItem('moonMode', mode);
            applyMoonStyle(mode);
        });
    });

    // Тестовый режим
    testModeCheckbox.addEventListener('change', (e) => {
        setTestMode(e.target.checked);
        localStorage.setItem('testMode', e.target.checked);
    });

    // Сброс прогресса (через кнопку в профиле)
    resetProgressBtn.addEventListener('click', () => {
        confirmOverlay.classList.add('active');
    });
    confirmNo.addEventListener('click', () => confirmOverlay.classList.remove('active'));
    confirmYes.addEventListener('click', () => {
        confirmOverlay.classList.remove('active');
        resetProgress();
        // после сброса обновляем профиль
        setTimeout(updateProfileInfo, 500);
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

    // Выход из аккаунта (через кнопку в профиле)
    const logoutBtnPanel = document.getElementById('logoutBtnPanel');
    if (logoutBtnPanel) {
        logoutBtnPanel.addEventListener('click', logout);
    }
}

// Функция для обновления информации в профиле (ник, email, время)
export function updateProfileInfo() {
    const nicknameEl = document.getElementById('accountNickname');
    const emailEl = document.getElementById('accountEmail');
    const timeEl = document.getElementById('profileTotalTime');

    if (currentUser) {
        nicknameEl.textContent = currentUser.user_metadata?.username || currentUser.email || 'Гость';
        emailEl.textContent = currentUser.email || '-';
        if (playerData) {
            timeEl.textContent = formatTime(playerData.total_seconds_played || 0);
        } else {
            timeEl.textContent = '0';
        }
    } else {
        nicknameEl.textContent = 'Гость';
        emailEl.textContent = '-';
        timeEl.textContent = '0';
    }
}

// Применение стиля луны
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

    // Обновляем активную кнопку в профиле
    document.querySelectorAll('#bgOptionsProfile button').forEach(btn => {
        if (btn.getAttribute('data-bg') === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}
