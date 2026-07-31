// ============================================================
// ЛУННЫЙ КЛИКЕР - ОСНОВНОЙ ФАЙЛ
// ============================================================

console.log('🌙 Moon Clicker Started');

// ============================================================
// ЗВЕЗДЫ
// ============================================================
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
}

// ============================================================
// УПРАВЛЕНИЕ ПАНЕЛЯМИ
// ============================================================
window.togglePanel = (panelId) => {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const isOpen = !panel.classList.contains('hidden');
  
  if (isOpen) {
    panel.classList.add('hidden');
    updateToggleButton(panelId, false);
  } else {
    // Закрываем другие панели
    document.querySelectorAll('.panel').forEach(p => {
      if (p.id !== panelId) {
        p.classList.add('hidden');
        updateToggleButton(p.id, false);
      }
    });
    
    panel.classList.remove('hidden');
    updateToggleButton(panelId, true);
  }
};

function updateToggleButton(panelId, isOpen) {
  if (panelId === 'profilePanel') {
    const btn = document.getElementById('profileToggleBtn');
    if (btn) btn.classList.toggle('panel-open', isOpen);
  } else if (panelId === 'shopPanel') {
    const btn = document.getElementById('shopToggleBtn');
    if (btn) btn.classList.toggle('panel-open', isOpen);
  }
}

window.closePanel = (panelId) => {
  window.togglePanel(panelId);
};

window.closeAllPanels = () => {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.side-toggle-btn').forEach(btn => btn.classList.remove('panel-open'));
};

// ============================================================
// ВКЛАДКИ
// ============================================================
window.switchProfileTab = (tabName) => {
  const panel = document.getElementById('profilePanel');
  if (!panel) return;
  
  panel.querySelectorAll('.panel-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  panel.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const targetContent = document.getElementById(`${tabName}TabContent`);
  if (targetContent) targetContent.classList.add('active');
};

window.switchShopTab = (tabName) => {
  const panel = document.getElementById('shopPanel');
  if (!panel) return;
  
  panel.querySelectorAll('.panel-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  panel.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const targetContent = document.getElementById(`${tabName}TabContent`);
  if (targetContent) targetContent.classList.add('active');
};

// ============================================================
// МОДАЛКИ
// ============================================================
window.closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
};

window.showPasswordModal = () => {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.remove('hidden');
};

window.closePasswordModal = () => {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.add('hidden');
};

window.submitTestModePassword = () => {
  const input = document.getElementById('testModePassword');
  const errorEl = document.getElementById('passwordError');
  
  if (!input || !errorEl) return;
  
  const password = input.value.trim();
  
  if (password === '1488') {
    window.closePasswordModal();
    showToast('🧪 Тестовый режим ВКЛЮЧЁН', 'success');
  } else {
    errorEl.textContent = '❌ Неверный пароль';
    errorEl.classList.add('show');
    input.value = '';
    input.focus();
  }
};

window.showSupernovaModal = () => {
  const modal = document.getElementById('supernovaModal');
  if (modal) modal.classList.remove('hidden');
};

window.closeSupernovaModal = () => {
  const modal = document.getElementById('supernovaModal');
  if (modal) modal.classList.add('hidden');
};

// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================
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
  
  console.log('🔐 Login:', email);
  
  const authScreen = document.getElementById('authScreen');
  const app = document.getElementById('app');
  
  if (authScreen) authScreen.classList.add('hidden');
  if (app) {
    app.classList.remove('hidden');
    initGame();
  }
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

// ============================================================
// ИГРА
// ============================================================
let clickCount = 0;
let playerLevel = 1;
let playerShards = 0;

function initGame() {
  console.log('🎮 Game initialized');
  
  // Клик по луне
  const moonWrapper = document.getElementById('moonWrapper');
  if (moonWrapper) {
    moonWrapper.addEventListener('click', handleMoonClick);
  }
  
  // Обновляем UI
  updateUI();
}

function handleMoonClick(e) {
  clickCount++;
  
  const damage = 10 + Math.floor(clickCount / 10);
  
  showDamageNumber(e.clientX, e.clientY, damage);
  
  playerShards += damage;
  
  if (clickCount % 100 === 0) {
    playerLevel++;
    showToast(`🎉 Уровень ${playerLevel}!`, 'success');
  }
  
  updateUI();
  
  // Эффекты
  const clickEffect = document.getElementById('clickEffect');
  if (clickEffect) {
    clickEffect.classList.remove('active');
    void clickEffect.offsetWidth;
    clickEffect.classList.add('active');
  }
  
  const moonWrapper = document.getElementById('moonWrapper');
  if (moonWrapper) {
    moonWrapper.style.transform = 'scale(0.95)';
    setTimeout(() => {
      moonWrapper.style.transform = 'scale(1)';
    }, 100);
  }
}

function updateUI() {
  const counter = document.getElementById('counter');
  const levelTitle = document.getElementById('levelTitle');
  
  if (counter) counter.textContent = ` ${playerShards}`;
  if (levelTitle) levelTitle.textContent = `Уровень ${playerLevel}`;
}

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

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded');
  createStars(300);
  
  const authScreen = document.getElementById('authScreen');
  const app = document.getElementById('app');
  
  if (authScreen) authScreen.classList.remove('hidden');
  if (app) app.classList.add('hidden');
  
  // Кнопки
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (registerBtn) registerBtn.addEventListener('click', handleRegister);
  
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
  
  // Enter в пароле
  const passwordInput = document.getElementById('testModePassword');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.submitTestModePassword();
      }
    });
  }
});

// Экспорт
if (typeof window !== 'undefined') {
  window.createStars = createStars;
  window.showToast = showToast;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
}
