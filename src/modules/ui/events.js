// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================
import { handleLogin, handleRegister, handleLogout, handleResetProgress } from '../auth/auth.js';
import { gameEngine } from '../game/game.js';

export function initEvents() {
  console.log('[Events] Инициализация...');

  // ============================================================
  // КНОПКИ АВТОРИЗАЦИИ
  // ============================================================
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Events] Login button clicked');
      await handleLogin();
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Events] Register button clicked');
      await handleRegister();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Events] Logout button clicked');
      await handleLogout();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Events] Reset button clicked');
      await handleResetProgress();
    });
  }

  // ============================================================
  // КНОПКИ УПРАВЛЕНИЯ ИГРОЙ
  // ============================================================
  const lockToggle = document.getElementById('lockToggleMain');
  const rollbackBtn = document.getElementById('rollbackBtnMain');
  const moonWrapper = document.getElementById('moonWrapper');

  if (lockToggle) {
    lockToggle.addEventListener('click', () => {
      console.log('[Events] Lock toggle clicked');
      if (gameEngine && gameEngine.toggleLevelLock) {
        gameEngine.toggleLevelLock();
      }
    });
  }

  if (rollbackBtn) {
    rollbackBtn.addEventListener('click', async () => {
      console.log('[Events] Rollback button clicked');
      if (gameEngine && gameEngine.rollbackLevel) {
        await gameEngine.rollbackLevel();
      }
    });
  }

  if (moonWrapper) {
    // Обработчик клика по луне (десктоп)
    moonWrapper.addEventListener('click', (e) => {
      if (gameEngine && gameEngine.handleClick) {
        gameEngine.handleClick(e);
      }
    });

    // Обработчик для мобильных устройств
    moonWrapper.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameEngine && gameEngine.handleClick) {
        const touch = e.touches[0];
        const syntheticEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => {},
          stopPropagation: () => {}
        };
        gameEngine.handleClick(syntheticEvent);
      }
    }, { passive: false });
  }

  // ============================================================
  // ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ПАНЕЛЕЙ
  // ============================================================
  window.openPanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) {
      // Закрываем все другие панели
      document.querySelectorAll('.panel').forEach(p => {
        if (p.id !== panelId) {
          p.classList.add('hidden');
        }
      });
      panel.classList.remove('hidden');
    }
  };

  window.closePanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('hidden');
    }
  };

  window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  };

  // ============================================================
  // ОБРАБОТКА НАЖАТИЯ ENTER В ФОРМЕ АВТОРИЗАЦИИ
  // ============================================================
  const authPassword = document.getElementById('authPassword');
  if (authPassword) {
    authPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (loginBtn) loginBtn.click();
      }
    });
  }

  console.log('[Events] Инициализация завершена');
}
