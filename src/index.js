// ============================================================
// ЛУННЫЙ КЛИКЕР - ОСНОВНОЙ ФАЙЛ
// ============================================================

console.log('🌙 Moon Clicker Started');

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

// Простая авторизация (заглушка для теста)
function handleLogin() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const errorDiv = document.getElementById('authError');
  
  if (!email || !password) {
    if (errorDiv) {
      errorDiv.textContent = '⚠️ Введите email и пароль';
      errorDiv.classList.add('show');
    }
    return;
  }
  
  // Имитация входа
  console.log('🔐 Login attempt:', email);
  
  // Показываем игру
  const authScreen = document.getElementById('authScreen');
  const app = document.getElementById('app');
  
  if (authScreen) authScreen.classList.add('hidden');
  if (app) {
    app.classList.remove('hidden');
    console.log('✅ Game shown');
  }
  
  // Инициализация игры
  initGame();
}

function handleRegister() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const username = document.getElementById('authUsername').value;
  const errorDiv = document.getElementById('authError');
  
  if (!email || !password || !username) {
    if (errorDiv) {
      errorDiv.textContent = '⚠️ Заполните все поля';
      errorDiv.classList.add('show');
    }
    return;
  }
  
  console.log('📝 Register:', email, username);
  handleLogin();
}

// Инициализация игры
function initGame() {
  console.log(' Game initialized');
  
  // Добавляем обработчик клика по луне
  const moonWrapper = document.getElementById('moonWrapper');
  if (moonWrapper) {
    moonWrapper.addEventListener('click', handleMoonClick);
    console.log('✅ Moon click handler added');
  }
  
  // Добавляем обработчики кнопок магазина
  const buyDamageBtn = document.getElementById('buyClickDamageBtn');
  if (buyDamageBtn) {
    buyDamageBtn.addEventListener('click', () => {
      showToast('⚠️ Функция в разработке', 'warning');
    });
  }
  
  const buySlotBtn = document.getElementById('buySlotBtn');
  if (buySlotBtn) {
    buySlotBtn.addEventListener('click', () => {
      showToast('⚠️ Функция в разработке', 'warning');
    });
  }
}

// Обработка клика по луне
let clickCount = 0;
let playerLevel = 1;
let playerShards = 0;

function handleMoonClick(e) {
  clickCount++;
  
  // Простой подсчет урона
  const damage = 10 + Math.floor(clickCount / 10);
  
  // Показываем всплывающий урон
  showDamageNumber(e.clientX, e.clientY, damage);
  
  // Обновляем счетчик (если есть)
  const counter = document.getElementById('counter');
  if (counter) {
    playerShards += damage;
    counter.textContent = `💎 ${playerShards}`;
  }
  
  // Проверяем уровень
  const levelTitle = document.getElementById('levelTitle');
  if (levelTitle && clickCount % 100 === 0) {
    playerLevel++;
    levelTitle.textContent = `Уровень ${playerLevel}`;
    showToast(`🎉 Уровень ${playerLevel}!`, 'success');
  }
  
  // Эффект клика
  const clickEffect = document.getElementById('clickEffect');
  if (clickEffect) {
    clickEffect.classList.remove('active');
    void clickEffect.offsetWidth; // Trigger reflow
    clickEffect.classList.add('active');
  }
  
  // Анимация луны
  const moonWrapper = document.getElementById('moonWrapper');
  if (moonWrapper) {
    moonWrapper.style.transform = 'scale(0.95)';
    setTimeout(() => {
      moonWrapper.style.transform = 'scale(1)';
    }, 100);
  }
}

// Показ всплывающего урона
function showDamageNumber(x, y, damage) {
  const damageEl = document.createElement('div');
  damageEl.className = 'damage-number';
  damageEl.textContent = `-${damage}`;
  damageEl.style.left = `${x}px`;
  damageEl.style.top = `${y - 50}px`;
  document.body.appendChild(damageEl);
  
  requestAnimationFrame(() => {
    damageEl.classList.add('animate');
  });
  
  setTimeout(() => {
    if (damageEl.parentNode) damageEl.remove();
  }, 1200);
}

// Toast уведомления
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.log('Toast:', message);
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 300);
  }, 2000);
}

// Инициализация при загрузке DOM
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
  
  // Добавляем обработчики кнопок входа
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
    console.log('✅ Login button handler added');
  }
  
  if (registerBtn) {
    registerBtn.addEventListener('click', handleRegister);
    console.log('✅ Register button handler added');
  }
  
  // Enter в форме
  const authPassword = document.getElementById('authPassword');
  if (authPassword) {
    authPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });
  }
});

// Экспорт для window
if (typeof window !== 'undefined') {
  window.createStars = createStars;
  window.showToast = showToast;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
}
