// ============================================================
// ТОЧКА ВХОДА ПРИЛОЖЕНИЯ
// ============================================================
import { appState } from './core/state.js';
import { initEvents } from './modules/events/events.js';
import { checkAuth } from './modules/auth/auth.js';
import { createStars } from './modules/ui/renderer.js';

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
async function init() {
  console.log('[App] Инициализация...');

  try {
    // Инициализируем события (кнопки, клики)
    initEvents();

    // Создаём звёзды на фоне
    createStars(300);

    // Проверяем авторизацию
    // ВАЖНО: checkAuth() не возвращает { success }, она сама управляет UI
    await checkAuth();

    console.log('[App] Инициализация завершена');
  } catch (error) {
    console.error('[App] Критическая ошибка инициализации:', error);
    
    // Даже при ошибке показываем экран авторизации
    const authScreen = document.getElementById('authScreen');
    const app = document.getElementById('app');
    
    if (authScreen) {
      authScreen.classList.remove('hidden');
    }
    if (app) {
      app.classList.add('hidden');
    }
  }
}

// ============================================================
// ЗАПУСК
// ============================================================
// Ждём полной загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
