// ============================================================
// ТОЧКА ВХОДА ПРИЛОЖЕНИЯ (С ДИАГНОСТИКОЙ)
// ============================================================

console.log('═══════════════════════════════════════════');
console.log('🚀 [App] ЗАПУСК ПРИЛОЖЕНИЯ');
console.log('═══════════════════════════════════════════');
console.log('[App] URL:', window.location.href);
console.log('[App] User Agent:', navigator.userAgent);
console.log('[App] Document readyState:', document.readyState);

// ============================================================
// ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ДОСТУПНОСТИ ФАЙЛОВ
// ============================================================
async function checkFileExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (e) {
    return false;
  }
}

// ============================================================
// ДИАГНОСТИКА СТРУКТУРЫ ФАЙЛОВ
// ============================================================
async function diagnoseProjectStructure() {
  console.log('═══════════════════════════════════════════');
  console.log('🔍 [Diagnose] Проверка структуры проекта');
  console.log('═══════════════════════════════════════════');
  
  const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  console.log('[Diagnose] Base URL:', baseUrl);
  
  const filesToCheck = [
    'src/index.js',
    'src/core/state.js',
    'src/core/constants.js',
    'src/modules/ui/events.js',
    'src/modules/ui/renderer.js',
    'src/modules/ui/animations.js',
    'src/modules/events/events.js',  // ← старый путь
    'src/modules/auth/auth.js',
    'src/modules/game/game.js',
    'src/modules/game/combat.js',
    'src/modules/network/supabase.js',
    'index.html',
    'css/galaxy.css',
    'css/game.css'
  ];
  
  for (const file of filesToCheck) {
    const url = baseUrl + file;
    const exists = await checkFileExists(url);
    const icon = exists ? '✅' : '❌';
    console.log(`${icon} ${file} - ${exists ? 'НАЙДЕН' : 'НЕ НАЙДЕН (404)'}`);
  }
  
  console.log('═══════════════════════════════════════════');
}

// ============================================================
// ОТЛОВ ВСЕХ ОШИБОК ЗАГРУЗКИ МОДУЛЕЙ
// ============================================================
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Failed to fetch dynamically imported module')) {
    console.error('═══════════════════════════════════════════');
    console.error('❌ [Module Error] ОШИБКА ЗАГРУЗКИ МОДУЛЯ');
    console.error('═══════════════════════════════════════════');
    console.error('Файл:', event.filename);
    console.error('Строка:', event.lineno);
    console.error('Сообщение:', event.message);
    console.error('═══════════════════════════════════════════');
  }
});

// Отлов ошибок промисов (dynamic imports)
window.addEventListener('unhandledrejection', (event) => {
  console.error('═══════════════════════════════════════════');
  console.error('❌ [Promise Error] НЕОБРАБОТАННАЯ ОШИБКА ПРОМИСА');
  console.error('═══════════════════════════════════════════');
  console.error('Причина:', event.reason);
  console.error('Стек:', event.reason?.stack);
  console.error('═══════════════════════════════════════════');
});

// ============================================================
// ДИНАМИЧЕСКАЯ ЗАГРУЗКА С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
// ============================================================
async function safeImport(modulePath, moduleName) {
  console.log(`[Import] Попытка загрузить: ${moduleName} из ${modulePath}`);
  const startTime = performance.now();
  
  try {
    const module = await import(modulePath);
    const loadTime = (performance.now() - startTime).toFixed(2);
    console.log(`✅ [Import] ${moduleName} загружен за ${loadTime}ms`);
    return module;
  } catch (error) {
    const loadTime = (performance.now() - startTime).toFixed(2);
    console.error(`═══════════════════════════════════════════`);
    console.error(`❌ [Import] ОШИБКА ЗАГРУЗКИ ${moduleName}`);
    console.error(`═══════════════════════════════════════════`);
    console.error(`Путь: ${modulePath}`);
    console.error(`Время: ${loadTime}ms`);
    console.error(`Ошибка:`, error);
    console.error(`Тип: ${error.name}`);
    console.error(`Сообщение: ${error.message}`);
    console.error(`═══════════════════════════════════════════`);
    throw error;
  }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
async function init() {
  console.log('═══════════════════════════════════════════');
  console.log('⚙️  [App] НАЧАЛО ИНИЦИАЛИЗАЦИИ');
  console.log('═══════════════════════════════════════════');

  try {
    // 1. Диагностика структуры
    await diagnoseProjectStructure();
    
    // 2. Загрузка state
    console.log('[App] Шаг 1/4: Загрузка state.js...');
    const stateModule = await safeImport('./core/state.js', 'State Manager');
    const { appState } = stateModule;
    
    // 3. Загрузка UI модулей
    console.log('[App] Шаг 2/4: Загрузка UI модулей...');
    const rendererModule = await safeImport('./modules/ui/renderer.js', 'Renderer');
    const { createStars } = rendererModule;
    
    // 4. Загрузка events (с fallback на старый путь)
    console.log('[App] Шаг 3/4: Загрузка events...');
    let eventsModule;
    try {
      eventsModule = await safeImport('./modules/ui/events.js', 'Events (новый путь)');
    } catch (error) {
      console.warn('[App] ⚠️  Новый путь не сработал, пробуем старый...');
      eventsModule = await safeImport('./modules/events/events.js', 'Events (старый путь)');
    }
    const { initEvents } = eventsModule;
    
    // 5. Загрузка auth
    console.log('[App] Шаг 4/4: Загрузка auth...');
    const authModule = await safeImport('./modules/auth/auth.js', 'Auth');
    const { checkAuth } = authModule;

    // ============================================================
    // ЗАПУСК ПРИЛОЖЕНИЯ
    // ============================================================
    console.log('═══════════════════════════════════════════');
    console.log('🎮 [App] ЗАПУСК ИГРЫ');
    console.log('═══════════════════════════════════════════');

    // Инициализируем события
    initEvents();

    // Создаём звёзды
    createStars(300);

    // Проверяем авторизацию
    await checkAuth();

    console.log('═══════════════════════════════════════════');
    console.log('✅ [App] ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА УСПЕШНО');
    console.log('═══════════════════════════════════════════');
    
  } catch (error) {
    console.error('═══════════════════════════════════════════');
    console.error('❌ [App] КРИТИЧЕСКАЯ ОШИБКА ИНИЦИАЛИЗАЦИИ');
    console.error('═══════════════════════════════════════════');
    console.error('Ошибка:', error);
    console.error('Имя:', error.name);
    console.error('Сообщение:', error.message);
    console.error('Стек:', error.stack);
    console.error('═══════════════════════════════════════════');
    
    // Показываем экран авторизации как fallback
    const authScreen = document.getElementById('authScreen');
    const app = document.getElementById('app');
    
    if (authScreen) authScreen.classList.remove('hidden');
    if (app) app.classList.add('hidden');
    
    // Показываем понятное сообщение пользователю
    alert(
      '❌ Ошибка загрузки приложения!\n\n' +
      'Откройте консоль (F12) и пришлите мне логи.\n\n' +
      'Ошибка: ' + error.message
    );
  }
}

// ============================================================
// ЗАПУСК
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
