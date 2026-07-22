// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ - С TOGGLE ПАНЕЛЯМИ
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
      await handleLogin();
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleRegister();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleLogout();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleResetProgress();
    });
  }

  // ============================================================
  // КЛИК ПО ЛУНЕ
  // ============================================================
  const moonWrapper = document.getElementById('moonWrapper');

  if (moonWrapper) {
    moonWrapper.addEventListener('click', (e) => {
      if (gameEngine && gameEngine.handleClick) {
        gameEngine.handleClick(e);
      }
    });

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
  
  /**
   * TOGGLE - открыть/закрыть панель одной кнопкой
   */
  window.togglePanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const isOpen = !panel.classList.contains('hidden');
    
    if (isOpen) {
      // Закрыть панель
      panel.classList.add('hidden');
      updateToggleButton(panelId, false);
    } else {
      // Закрыть все другие панели сначала
      document.querySelectorAll('.panel').forEach(p => {
        if (p.id !== panelId) {
          p.classList.add('hidden');
          updateToggleButton(p.id, false);
        }
      });
      
      // Открыть эту панель
      panel.classList.remove('hidden');
      updateToggleButton(panelId, true);
    }
  };

  /**
   * Обновить визуальное состояние toggle кнопки
   */
  function updateToggleButton(panelId, isOpen) {
    if (panelId === 'profilePanel') {
      const btn = document.getElementById('profileToggleBtn');
      if (btn) btn.classList.toggle('panel-open', isOpen);
    } else if (panelId === 'shopPanel') {
      const btn = document.getElementById('shopToggleBtn');
      if (btn) btn.classList.toggle('panel-open', isOpen);
    }
  }

  /**
   * Закрыть все панели
   */
  window.closeAllPanels = () => {
    document.querySelectorAll('.panel').forEach(p => {
      p.classList.add('hidden');
    });
    document.querySelectorAll('.side-toggle-btn').forEach(btn => {
      btn.classList.remove('panel-open');
    });
  };

  /**
   * Закрыть конкретную панель (для совместимости)
   */
  window.closePanel = (panelId) => {
    window.togglePanel(panelId);
  };

  /**
   * Закрыть модалку
   */
  window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  };

  // ============================================================
  // ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК В ПРОФИЛЕ
  // ============================================================
  window.switchProfileTab = (tabName) => {
    // Обновляем табы
    document.querySelectorAll('#profilePanel .panel-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Обновляем контент
    document.querySelectorAll('#profilePanel .tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(`${tabName}TabContent`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
  };

  // ============================================================
  // ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК В МАГАЗИНЕ
  // ============================================================
  window.switchShopTab = (tabName) => {
    // Обновляем табы
    document.querySelectorAll('#shopPanel .panel-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Обновляем контент
    document.querySelectorAll('#shopPanel .tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(`${tabName}TabContent`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
  };

  // ============================================================
  // ENTER В ФОРМЕ АВТОРИЗАЦИИ
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
