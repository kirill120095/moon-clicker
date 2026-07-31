// ============================================================
// ЛУННЫЙ КЛИКЕР - ОСНОВНОЙ ФАЙЛ
// ============================================================

// Простая инициализация без сложных импортов
console.log(' Moon Clicker Started');

// Создаем звезды на фоне
function createStars(count = 300) {
  const container = document.getElementById('stars');
  if (!container) return;
  
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
    star.style.animationDelay = Math.random() * 5 + 's';
    fragment.appendChild(star);
  }
  container.appendChild(fragment);
  console.log('✅ Stars created:', count);
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded');
  createStars(300);
  
  // Показываем экран авторизации
  const authScreen = document.getElementById('authScreen');
  const app = document.getElementById('app');
  
  if (authScreen) {
    authScreen.classList.remove('hidden');
    console.log('✅ Auth screen shown');
  }
  
  if (app) {
    app.classList.add('hidden');
  }
  
  // TODO: Здесь будет полная логика игры
  // Пока просто заглушка
  console.log('⚠️ Game logic not implemented yet');
});

// Экспорт для window (если нужно)
if (typeof window !== 'undefined') {
  window.createStars = createStars;
}
