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

    // Инициализируем Toast
    const toastContainer = document.getElementById('toastContainer');
    if (toastContainer) {
        initToastContainer(toastContainer);
    }

    // Создаем звезды
    createStars();

    // Инициализируем события
    initEvents();

    // Проверяем авторизацию
    const authResult = await checkAuth();
    
    if (authResult.success) {
        // Пользователь авторизован
        document.getElementById('authBlock')?.classList.add('hidden');
        document.getElementById('gameArea')?.classList.add('active');
        
        // Показываем кнопки панелей
        document.querySelectorAll('.panel-trigger').forEach(el => {
            el.classList.add('visible');
        });

        // Инициализируем игру
        gameEngine.init();
        
        // Обновляем квесты и достижения
        updateQuestAndAchievementUI();
        
        showToast('✅ Добро пожаловать!', 'success');
    } else {
        // Пользователь не авторизован
        document.getElementById('gameArea')?.classList.remove('active');
        document.getElementById('authBlock')?.classList.remove('hidden');
        
        // Скрываем кнопки панелей
        document.querySelectorAll('.panel-trigger').forEach(el => {
            el.classList.remove('visible', 'active');
        });
    }

    // Подписываемся на изменения состояния для обновления UI
    appState.subscribeMany(
        ['currentLevel', 'moonHP', 'maxHP', 'playerData', 'activeMoon'],
        () => {
            updateUI();
            updateShopUI();
            updateProfileAndLeaders();
        }
    );

    // Периодический сброс квестов (каждый час)
    setInterval(() => {
        if (state.user) {
            appState.resetQuests();
            updateQuestAndAchievementUI();
            showToast('🔄 Квесты обновлены!', 'info');
        }
    }, 3600000);

    console.log('[App] Инициализация завершена');
}

// ============================================================
//  ЗАПУСК
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================================
//  ОБРАБОТКА НЕОТЛОВЛЕННЫХ ОШИБОК
// ============================================================
window.addEventListener('unhandledrejection', (event) => {
    console.error('[App] Необработанная ошибка:', event.reason);
    showToast('⚠️ Произошла ошибка. Проверьте консоль.', 'warning');
});

window.addEventListener('error', (event) => {
    console.error('[App] Ошибка выполнения:', event.error);
    showToast('⚠️ Произошла ошибка. Проверьте консоль.', 'warning');
});

// ============================================================
//  ЭКСПОРТ ДЛЯ ОТЛАДКИ
// ============================================================
export { appState, state, gameEngine };
