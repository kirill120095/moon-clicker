// ============================================================
//  ТОЧКА ВХОДА
// ============================================================
import { appState, state } from './core/state.js';
import { checkAuth } from './modules/auth/auth.js';
import { gameEngine } from './modules/game/game.js';
import { initEvents, updateQuestAndAchievementUI } from './modules/ui/events.js';
import { initToastContainer, showToast, updateUI, updateShopUI, updateProfileAndLeaders } from './modules/ui/renderer.js';
import { createStars } from './utils/performance.js';

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================
async function init() {
    console.log('[App] Инициализация...');

    try {
        const toastContainer = document.getElementById('toastContainer');
        if (toastContainer) {
            initToastContainer(toastContainer);
        }

        createStars();
        initEvents();

        const authResult = await checkAuth();
        
        if (authResult.success) {
            document.getElementById('authBlock')?.classList.add('hidden');
            document.getElementById('gameArea')?.classList.add('active');
            
            document.querySelectorAll('.panel-trigger').forEach(el => {
                el.classList.add('visible');
            });

            gameEngine.init();
            updateQuestAndAchievementUI();
            
            showToast('✅ Добро пожаловать!', 'success');
        } else {
            document.getElementById('gameArea')?.classList.remove('active');
            document.getElementById('authBlock')?.classList.remove('hidden');
            
            document.querySelectorAll('.panel-trigger').forEach(el => {
                el.classList.remove('visible', 'active');
            });
        }

        appState.subscribeMany(
            ['currentLevel', 'moonHP', 'maxHP', 'playerData', 'activeMoon'],
            () => {
                updateUI();
                updateShopUI();
                updateProfileAndLeaders();
            }
        );

        setInterval(() => {
            if (state.user) {
                appState.resetQuests();
                updateQuestAndAchievementUI();
                showToast('🔄 Квесты обновлены!', 'info');
            }
        }, 3600000);

        console.log('[App] Инициализация завершена');
    } catch (error) {
        console.error('[App] Критическая ошибка инициализации:', error);
        showToast('⚠️ Ошибка запуска приложения', 'warning');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('unhandledrejection', (event) => {
    console.error('[App] Необработанная ошибка:', event.reason);
    showToast('⚠️ Произошла ошибка. Проверьте консоль.', 'warning');
});

window.addEventListener('error', (event) => {
    console.error('[App] Ошибка выполнения:', event.error);
    showToast('⚠️ Произошла ошибка. Проверьте консоль.', 'warning');
});

export { appState, state, gameEngine };
