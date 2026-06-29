// ============================================================
//  УПРАВЛЕНИЕ UI (модалки, панели, кнопки)
// ============================================================
import { showToast } from './utils.js';
import { handleLogin, handleRegister, logout } from './auth.js';
import { handleClick, initGame, rollbackLevel, resetProgress, updateUI, initGameElements } from './game.js';
import { updateProfileAndLeaders } from './profile.js';
import { currentUser, levelLocked, setLevelLocked, setTestMode, testMode } from './state.js';

// --- Инициализация DOM-элементов и обработчиков ---
export function initUI() {
    // Передаём элементы в game.js
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

    // --- Вкладки авторизации ---
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));

    // --- Кнопка действия (Войти / Зарегистрироваться) ---
    document.getElementById('actionBtn').addEventListener('click', () => {
        if (document.getElementById('loginFields').classList.contains('hidden')) {
            handleRegister();
        } else {
            handleLogin();
        }
    });

    // --- Выход ---
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // --- Кнопки настроек ---
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('active');
        updateUI();
    });
    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('active');
    });

    // --- Сброс прогресса ---
    document.getElementById('resetProgressBtn').addEventListener('click', () => {
        document.getElementById('confirmOverlay').classList.add('active');
        document.getElementById('confirmMessage').textContent = 'Вы уверены, что хотите сбросить весь прогресс? Это действие необратимо.';
    });
    document.getElementById('confirmYes').addEventListener('click', async () => {
        document.getElementById('confirmOverlay').classList.remove('active');
        await resetProgress();
    });
    document.getElementById('confirmNo').addEventListener('click', () => {
        document.getElementById('confirmOverlay').classList.remove('active');
    });

    // --- Откат уровня ---
    document.getElementById('rollbackBtnMain').addEventListener('click', rollbackLevel);

    // --- Фиксация уровня ---
    document.getElementById('lockToggleMain').addEventListener('click', () => {
        const newState = !levelLocked;
        setLevelLocked(newState);
        localStorage.setItem('levelLocked', newState);
        const btn = document.getElementById('lockToggleMain');
        btn.textContent = newState ? '🔒' : '🔓';
        if (newState) btn.classList.add('locked');
        else btn.classList.remove('locked');
    });

    // --- Тестовый режим ---
    document.getElementById('testModeCheckbox').addEventListener('change', function() {
        setTestMode(this.checked);
        localStorage.setItem('testMode', this.checked);
    });

    // --- Фоны луны ---
    document.getElementById('bgOptions').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const mode = btn.getAttribute('data-bg');
        setMoonModeUI(mode);
    });

    // --- Статистика (панель) ---
    document.getElementById('statsToggleBtn').addEventListener('click', togglePanel);
    document.getElementById('panelClose').addEventListener('click', () => togglePanel(false));

    // --- Вкладки панели ---
    document.querySelectorAll('.panel-tabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.panel-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`panel${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
        });
    });

    // --- Клик по луне ---
    document.getElementById('moonWrapper').addEventListener('click', handleClick);

    // --- Закрытие модалки настроек по клику на оверлей ---
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('settingsModal')) {
            document.getElementById('settingsModal').classList.remove('active');
        }
    });

    // --- Обработка Enter в полях ввода ---
    document.querySelectorAll('.auth-form input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('actionBtn').click();
            }
        });
    });

    // Инициализируем режим по умолчанию
    setMode('login');
}

// --- Переключение режима авторизации ---
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
        // Очищаем поля регистрации
        document.getElementById('regEmailInput').value = '';
        document.getElementById('regNicknameInput').value = '';
        document.getElementById('regPasswordInput').value = '';
        document.getElementById('authMessage').textContent = '';
        document.getElementById('authMessage').className = 'error';
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerFields.classList.remove('hidden');
        loginFields.classList.add('hidden');
        actionBtn.textContent = 'Зарегистрироваться';
        document.getElementById('loginInput').value = '';
        document.getElementById('passwordInput').value = '';
        document.getElementById('authMessage').textContent = '';
        document.getElementById('authMessage').className = 'error';
    }
}

// --- Панель (открыть/закрыть) ---
function togglePanel(show) {
    const panel = document.getElementById('sidePanel');
    if (show === undefined) {
        panel.classList.toggle('active');
    } else if (show) {
        panel.classList.add('active');
    } else {
        panel.classList.remove('active');
    }
    if (panel.classList.contains('active')) {
        if (currentUser) {
            updateProfileAndLeaders();
        } else {
            document.getElementById('leadersList').innerHTML = '<div class="no-data">Войдите, чтобы увидеть лидеров</div>';
            document.getElementById('profileContent').innerHTML = '<div class="no-data">Войдите, чтобы увидеть статистику</div>';
        }
    }
}

// --- Установка фона луны из UI ---
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
    document.querySelectorAll('.bg-options button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-bg') === mode) {
            btn.classList.add('active');
        }
    });
}
