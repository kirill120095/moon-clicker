// ============================================================
//  ОБРАБОТЧИКИ СОБЫТИЙ UI
// ============================================================
import { gameEngine } from '../game/game.js';
import { handleLogin, handleRegister, handleLogout } from '../auth/auth.js';
import { appState, state } from '../../core/state.js';
import { showToast, setLockIcon, updateUI, updateShopUI, updateProfileAndLeaders, updateQuestAndAchievementUI } from './renderer.js';
import { escapeHTML } from '../../utils/security.js';
import { getMaxHPForLevel } from '../../core/config.js';
import { CONSTANTS } from '../../core/constants.js';

export function initEvents() {
    _initAuthEvents();
    _initGameEvents();
    _initPanelEvents();
    _initSettingsEvents();
    _initShopEvents();

    console.log('[Events] Инициализация завершена');
}

function _initAuthEvents() {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginFields = document.getElementById('loginFields');
    const registerFields = document.getElementById('registerFields');
    const actionBtn = document.getElementById('actionBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    tabLogin?.addEventListener('click', () => _setAuthMode('login'));
    tabRegister?.addEventListener('click', () => _setAuthMode('register'));

    actionBtn?.addEventListener('click', async () => {
        const isLogin = tabLogin?.classList.contains('active');

        if (isLogin) {
            const identifier = document.getElementById('loginInput')?.value;
            const password = document.getElementById('passwordInput')?.value;
            const result = await handleLogin(identifier, password);
            if (result.success) {
                _onAuthSuccess();
            }
        } else {
            const email = document.getElementById('regEmailInput')?.value;
            const nickname = document.getElementById('regNicknameInput')?.value;
            const password = document.getElementById('regPasswordInput')?.value;
            const result = await handleRegister(email, nickname, password);
            if (result.success) {
                _onAuthSuccess();
            }
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        await handleLogout();
        _onAuthLogout();
    });

    document.querySelectorAll('.auth-form input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                actionBtn?.click();
            }
        });
    });
}

function _setAuthMode(mode) {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginFields = document.getElementById('loginFields');
    const registerFields = document.getElementById('registerFields');
    const actionBtn = document.getElementById('actionBtn');
    const authMessage = document.getElementById('authMessage');

    if (mode === 'login') {
        tabLogin?.classList.add('active');
        tabRegister?.classList.remove('active');
        loginFields?.classList.remove('hidden');
        registerFields?.classList.add('hidden');
        if (actionBtn) actionBtn.textContent = 'Войти';
    } else {
        tabLogin?.classList.remove('active');
        tabRegister?.classList.add('active');
        loginFields?.classList.add('hidden');
        registerFields?.classList.remove('hidden');
        if (actionBtn) actionBtn.textContent = 'Зарегистрироваться';
    }
    if (authMessage) authMessage.textContent = '';
}

function _onAuthSuccess() {
    document.getElementById('authBlock')?.classList.add('hidden');
    document.getElementById('gameArea')?.classList.add('active');

    document.querySelectorAll('.panel-trigger').forEach(el => {
        el.classList.add('visible');
    });

    gameEngine.init();
    showToast('✅ Добро пожаловать!', 'success');
}

function _onAuthLogout() {
    document.getElementById('gameArea')?.classList.remove('active');
    document.getElementById('authBlock')?.classList.remove('hidden');

    document.querySelectorAll('.panel-trigger').forEach(el => {
        el.classList.remove('visible', 'active');
    });

    document.querySelectorAll('.side-panel').forEach(el => {
        el.classList.remove('active');
    });

    gameEngine.destroy();
    showToast('👋 Вы вышли из аккаунта', 'success');
}

function _initGameEvents() {
    const moonWrapper = document.getElementById('moonWrapper');
    const rollbackBtn = document.getElementById('rollbackBtnMain');
    const lockToggle = document.getElementById('lockToggleMain');

    moonWrapper?.addEventListener('click', (e) => {
        gameEngine.handleClick(e);
    });

    rollbackBtn?.addEventListener('click', async () => {
        await gameEngine.rollbackLevel();
    });

    lockToggle?.addEventListener('click', () => {
        const newState = !state.levelLocked;
        appState.set('levelLocked', newState);
        if (state.user) {
            localStorage.setItem(`levelLocked_${state.user.id}`, String(newState));
        }
        setLockIcon(lockToggle, newState);
    });
    
    if (lockToggle) {
        setLockIcon(lockToggle, state.levelLocked);
    }
}

function _initPanelEvents() {
    const leftTrigger = document.getElementById('panelTrigger');
    const leftPanel = document.getElementById('sidePanel');
    const rightTrigger = document.getElementById('shopTrigger');
    const rightPanel = document.getElementById('shopPanel');

    leftTrigger?.addEventListener('click', () => {
        leftPanel?.classList.toggle('active');
        leftTrigger?.classList.toggle('active');
        if (leftPanel?.classList.contains('active')) {
            updateProfileAndLeaders();
        }
    });

    rightTrigger?.addEventListener('click', () => {
        rightPanel?.classList.toggle('active');
        rightTrigger?.classList.toggle('active');
        if (rightPanel?.classList.contains('active')) {
            updateShopUI();
        }
    });

    document.querySelectorAll('.left-panel .panel-tabs button').forEach(tab => {
        tab?.addEventListener('click', () => {
            document.querySelectorAll('.left-panel .panel-tabs button').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.left-panel .panel-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const tabType = tab.dataset.tab;
            const panel = document.getElementById(`panel${tabType.charAt(0).toUpperCase() + tabType.slice(1)}`);
            if (panel) panel.classList.add('active');
            updateProfileAndLeaders();
        });
    });

    document.querySelectorAll('.shop-panel .panel-tabs button').forEach(tab => {
        tab?.addEventListener('click', () => {
            document.querySelectorAll('.shop-panel .panel-tabs button').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.shop-panel .panel-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const tabType = tab.dataset.shopTab;
            const content = document.getElementById(`${tabType}Content`);
            if (content) content.classList.add('active');
        });
    });
}

function _initSettingsEvents() {
    const testModeCheckbox = document.getElementById('testModeCheckbox');
    const resetBtn = document.getElementById('resetProgressBtn');
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    testModeCheckbox?.addEventListener('change', (e) => {
        appState.set('testMode', e.target.checked);
        if (state.user) {
            localStorage.setItem(`testMode_${state.user.id}`, String(e.target.checked));
        }
        showToast(e.target.checked ? '🧪 Тестовый режим включен' : '🧪 Тестовый режим выключен', 'info');
    });

    resetBtn?.addEventListener('click', () => {
        confirmOverlay?.classList.add('active');
    });

    confirmNo?.addEventListener('click', () => {
        confirmOverlay?.classList.remove('active');
    });

    confirmYes?.addEventListener('click', async () => {
        confirmOverlay?.classList.remove('active');
        await gameEngine.resetProgress();
    });
}

function _initShopEvents() {
    document.getElementById('buyClickDamageBtn')?.addEventListener('click', async () => {
        await gameEngine.buyClickDamage();
    });

    document.getElementById('buySlotBtn')?.addEventListener('click', async () => {
        await gameEngine.buySlot();
    });

    document.getElementById('moonShopItems')?.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const moonId = target.dataset.moonId;
        if (!moonId) return;

        if (target.classList.contains('buy-moon-btn')) {
            await gameEngine.buyMoon(moonId);
        } else if (target.classList.contains('select-moon-btn')) {
            await gameEngine.selectMoon(moonId);
        } else if (target.classList.contains('upgrade-moon-btn')) {
            await gameEngine.upgradeMoon(moonId);
        }
    });
}
