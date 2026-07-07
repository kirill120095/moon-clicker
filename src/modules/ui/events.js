// ============================================================
//  ОБРАБОТЧИКИ СОБЫТИЙ UI
// ============================================================
import { gameEngine } from '../game/game.js';
import { handleLogin, handleRegister, handleLogout, checkAuth } from '../auth/auth.js';
import { appState, state } from '../../core/state.js';
import { showToast } from './renderer.js';
import { setLockIcon } from './renderer.js';
import { CONSTANTS } from '../../core/constants.js';

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ
// ============================================================
export function initEvents() {
    // Авторизация
    _initAuthEvents();
    
    // Игра
    _initGameEvents();
    
    // Панели
    _initPanelEvents();
    
    // Настройки
    _initSettingsEvents();
    
    // Магазин
    _initShopEvents();
    
    console.log('[Events] Инициализация завершена');
}

// ============================================================
//  АВТОРИЗАЦИЯ
// ============================================================
function _initAuthEvents() {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginFields = document.getElementById('loginFields');
    const registerFields = document.getElementById('registerFields');
    const actionBtn = document.getElementById('actionBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Переключение вкладок
    tabLogin?.addEventListener('click', () => _setAuthMode('login'));
    tabRegister?.addEventListener('click', () => _setAuthMode('register'));

    // Кнопка действия
    actionBtn?.addEventListener('click', async () => {
        const isLogin = tabLogin?.classList.contains('active');
        
        if (isLogin) {
            const email = document.getElementById('loginInput')?.value;
            const password = document.getElementById('passwordInput')?.value;
            const result = await handleLogin(email, password);
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

    // Выход
    logoutBtn?.addEventListener('click', async () => {
        await handleLogout();
        _onAuthLogout();
    });

    // Enter для полей ввода
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
    
    // Показываем кнопки панелей
    document.querySelectorAll('.panel-trigger').forEach(el => {
        el.classList.add('visible');
    });
    
    // Инициализируем игру
    gameEngine.init();
    showToast('✅ Добро пожаловать!', 'success');
}

function _onAuthLogout() {
    document.getElementById('gameArea')?.classList.remove('active');
    document.getElementById('authBlock')?.classList.remove('hidden');
    
    // Скрываем кнопки панелей
    document.querySelectorAll('.panel-trigger').forEach(el => {
        el.classList.remove('visible', 'active');
    });
    
    // Закрываем панели
    document.querySelectorAll('.side-panel').forEach(el => {
        el.classList.remove('active');
    });
    
    gameEngine.destroy();
    showToast('👋 Вы вышли из аккаунта', 'success');
}

// ============================================================
//  ИГРА
// ============================================================
function _initGameEvents() {
    const moonWrapper = document.getElementById('moonWrapper');
    const rollbackBtn = document.getElementById('rollbackBtnMain');
    const lockToggle = document.getElementById('lockToggleMain');

    // Клик по луне
    moonWrapper?.addEventListener('click', (e) => {
        gameEngine.handleClick(e);
    });

    // Откат уровня
    rollbackBtn?.addEventListener('click', async () => {
        if (state.currentLevel <= 1) return;
        
        const newLevel = state.currentLevel - 1;
        appState.setCurrentLevel(newLevel);
        const newMax = getMaxHPForLevel(newLevel, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
        appState.set('maxHP', newMax);
        appState.set('moonHP', newMax);
        
        await gameEngine._saveProgress();
        updateUI();
        updateProfileAndLeaders();
        showToast(`↩️ Откат до ${newLevel} уровня`, 'info');
    });

    // Замок уровня
    lockToggle?.addEventListener('click', () => {
        const newState = !state.levelLocked;
        appState.set('levelLocked', newState);
        if (state.user) {
            localStorage.setItem(`levelLocked_${state.user.id}`, String(newState));
        }
        setLockIcon(lockToggle, newState);
    });
}

// ============================================================
//  ПАНЕЛИ
// ============================================================
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

    // Вкладки левой панели
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

    // Вкладки правой панели
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

// ============================================================
//  НАСТРОЙКИ
// ============================================================
function _initSettingsEvents() {
    const testModeCheckbox = document.getElementById('testModeCheckbox');
    const resetBtn = document.getElementById('resetProgressBtn');
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    // Тестовый режим
    testModeCheckbox?.addEventListener('change', (e) => {
        appState.set('testMode', e.target.checked);
        if (state.user) {
            localStorage.setItem(`testMode_${state.user.id}`, String(e.target.checked));
        }
        showToast(e.target.checked ? '🧪 Тестовый режим включен' : '🧪 Тестовый режим выключен', 'info');
    });

    // Сброс прогресса
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

// ============================================================
//  МАГАЗИН
// ============================================================
function _initShopEvents() {
    // Покупка улучшения клика
    document.getElementById('buyClickDamageBtn')?.addEventListener('click', async () => {
        await gameEngine.buyClickDamage();
    });

    // Покупка слота
    document.getElementById('buySlotBtn')?.addEventListener('click', async () => {
        await gameEngine.buySlot();
    });

    // Делегирование для динамических кнопок в магазине лун
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

// ============================================================
//  ОБНОВЛЕНИЕ КВЕСТОВ И ДОСТИЖЕНИЙ
// ============================================================
export function updateQuestAndAchievementUI() {
    updateQuestUI();
    updateAchievementUI();
}

function updateQuestUI() {
    const container = document.getElementById('questsList');
    if (!container) return;

    const quests = state.quests || {};
    let html = '';

    for (const [id, q] of Object.entries(quests)) {
        const progress = q.progress || 0;
        const target = q.target || 100;
        const percent = Math.min(100, Math.round((progress / target) * 100));
        
        html += `
            <div class="quest-item ${q.completed ? 'completed' : ''}">
                <span class="quest-name">${escapeHTML(q.name)}</span>
                <span class="quest-desc">${escapeHTML(q.description)}</span>
                <div class="quest-bar">
                    <div class="quest-fill" style="width: ${percent}%;"></div>
                </div>
                <span class="quest-progress">${progress}/${target}</span>
                ${q.completed ? '<span class="quest-done">✅ Выполнено</span>' : ''}
                <span class="quest-reward">+${q.reward} 💎</span>
            </div>
        `;
    }

    container.innerHTML = html || 'Нет активных квестов';
}

function updateAchievementUI() {
    const container = document.getElementById('achievementsList');
    if (!container) return;

    const achievements = state.achievements || {};
    let html = '';

    for (const [id, ach] of Object.entries(CONSTANTS.ACHIEVEMENTS || {})) {
        const achieved = achievements[id] || false;
        html += `
            <div class="achievement-item ${achieved ? 'achieved' : ''}">
                <span class="ach-name">${escapeHTML(ach.name)}</span>
                <span class="ach-desc">${escapeHTML(ach.description)}</span>
                <span class="ach-status">${achieved ? '✅' : '🔒'}</span>
                <span class="ach-reward">+${ach.reward} 💎</span>
            </div>
        `;
    }

    container.innerHTML = html || 'Нет достижений';
}
