// ============================================================
//  УПРАВЛЕНИЕ UI (ИСПРАВЛЕНО)
// ============================================================
import { showToast } from './utils.js';
import { handleLogin, handleRegister, logout } from './auth.js';
import { handleClick, initGame, rollbackLevel, resetProgress, updateUI, initGameElements } from './game.js';
import { updateProfileAndLeaders } from './profile.js';
import { currentUser, levelLocked, setLevelLocked, setTestMode } from './state.js';

export function initUI() {
    initGameElements({
        moonWrapper: document.getElementById('moonWrapper'),
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
        rollbackBtnMain: document.getElementById('rollbackBtnMain'),
        lockToggleMain: document.getElementById('lockToggleMain')
    });

    // Табы авторизации
    document.getElementById('tabLogin').addEventListener('click', () => setMode('login'));
    document.getElementById('tabRegister').addEventListener('click', () => setMode('register'));

    document.getElementById('actionBtn').addEventListener('click', () => {
        if (document.getElementById('loginFields').classList.contains('hidden')) {
            handleRegister();
        } else {
            handleLogin();
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Настройки
    document.getElementById('settingsBtn').addEventListener('click', () => {
        updateAccountInfo();
        document.getElementById('settingsModal').classList.add('active');
    });

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('active');
    });

    // Сброс прогресса
    document.getElementById('resetProgressBtn').addEventListener('click', () => {
        document.getElementById('confirmOverlay').classList.add('active');
    });
    document.getElementById('confirmYes').addEventListener('click', async () => {
        document.getElementById('confirmOverlay').classList.remove('active');
        await resetProgress();
    });
    document.getElementById('confirmNo').addEventListener('click', () => {
        document.getElementById('confirmOverlay').classList.remove('active');
    });

    document.getElementById('rollbackBtnMain').addEventListener('click', rollbackLevel);

    // Lock
    document.getElementById('lockToggleMain').addEventListener('click', () => {
        const newState = !levelLocked;
        setLevelLocked(newState);
        localStorage.setItem('levelLocked', newState);
        const btn = document.getElementById('lockToggleMain');
        btn.textContent = newState ? '🔒' : '🔓';
        btn.classList.toggle('locked', newState);
    });

    // Test mode
    document.getElementById('testModeCheckbox').addEventListener('change', function() {
        setTestMode(this.checked);
        localStorage.setItem('testMode', this.checked);
    });

    // Фоны
    document.getElementById('bgOptions').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) setMoonModeUI(btn.getAttribute('data-bg'));
    });

    // Панель
    document.getElementById('statsToggleBtn').addEventListener('click', togglePanel);
    document.getElementById('panelClose').addEventListener('click', () => togglePanel(false));

    // Клик по луне
    document.getElementById('moonWrapper').addEventListener('click', handleClick);

    // Закрытие модалки
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('settingsModal')) {
            document.getElementById('settingsModal').classList.remove('active');
        }
    });

    setMode('login');
}

function updateAccountInfo() {
    document.getElementById('accountNickname').textContent = 
        playerData?.username || currentUser?.user_metadata?.username || 'Гость';
    document.getElementById('accountEmail').textContent = currentUser?.email || '-';
}

export function setMode(mode) {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginFields = document.getElementById('loginFields');
    const registerFields = document.getElementById('registerFields');
    const actionBtn = document.getElementById('actionBtn');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginFields.classList.remove('hidden');
        registerFields.classList.add('hidden');
        actionBtn.textContent = 'Войти';
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerFields.classList.remove('hidden');
        loginFields.classList.add('hidden');
        actionBtn.textContent = 'Зарегистрироваться';
    }
}

function togglePanel(show) {
    const panel = document.getElementById('sidePanel');
    if (show === undefined) panel.classList.toggle('active');
    else if (show) panel.classList.add('active');
    else panel.classList.remove('active');

    if (panel.classList.contains('active') && currentUser) {
        updateProfileAndLeaders();
    }
}

function setMoonModeUI(mode) {
    const container = document.getElementById('app');
    const moonInner = document.getElementById('moonInner');
    if (mode === 'blood') {
        container.classList.add('blood-mode');
        moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #ff4444, #cc0000)';
    } else {
        container.classList.remove('blood-mode');
        moonInner.style.backgroundImage = 'radial-gradient(circle at 30% 30%, #f0e6d0, #d4af37)';
    }
    localStorage.setItem('moonMode', mode);
}
