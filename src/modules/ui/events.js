// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================
import { handleLogin, handleRegister, handleLogout, handleResetProgress } from '../auth/auth.js';
import { gameEngine } from '../game/game.js';

// ============================================================
// 🌍 ГЛОБАЛЬНЫЕ ФУНКЦИИ (ОБЪЯВЛЕНЫ СРАЗУ ДЛЯ onclick В HTML)
// ============================================================

/**
 * TOGGLE - открыть/закрыть панель одной кнопкой
 */
if (typeof window !== 'undefined') {
  window.togglePanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) {
      console.error('[Events] Panel not found:', panelId);
      return;
    }

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
      
      // Обновляем контент при открытии
      refreshPanelOnOpen(panelId);
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
   * Обновить контент панели при открытии
   */
  function refreshPanelOnOpen(panelId) {
    if (panelId === 'profilePanel') {
      // Обновляем профиль, лидеров
      if (window.updateProfileAndLeaders) {
        window.updateProfileAndLeaders();
      }
    } else if (panelId === 'shopPanel') {
      // Обновляем магазин, квесты, ачивки
      if (window.updateShopUI) window.updateShopUI();
      if (window.updateQuestUI) window.updateQuestUI();
      if (window.updateAchievementUI) window.updateAchievementUI();
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
   * Закрыть конкретную панель
   */
  window.closePanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('hidden');
      updateToggleButton(panelId, false);
    }
  };

  /**
   * Закрыть модалку
   */
  window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  };

  /**
   * Переключение вкладок в профиле
   */
  window.switchProfileTab = (tabName) => {
    const panel = document.getElementById('profilePanel');
    if (!panel) return;
    
    // Обновляем табы
    panel.querySelectorAll('.panel-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Обновляем контент
    panel.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(`${tabName}TabContent`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
    
    // Обновляем контент вкладки при переключении
    if (tabName === 'leaders') {
      if (window.updateProfileAndLeaders) window.updateProfileAndLeaders();
    } else if (tabName === 'profile') {
      if (window.updateProfileAndLeaders) window.updateProfileAndLeaders();
    }
  };

  /**
   * Переключение вкладок в магазине
   */
  window.switchShopTab = (tabName) => {
    const panel = document.getElementById('shopPanel');
    if (!panel) return;
    
    // Обновляем табы
    panel.querySelectorAll('.panel-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Обновляем контент
    panel.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(`${tabName}TabContent`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
    
    // Обновляем контент вкладки при переключении
    if (tabName === 'shop') {
      if (window.updateShopUI) window.updateShopUI();
    } else if (tabName === 'quests') {
      if (window.updateQuestUI) window.updateQuestUI();
    } else if (tabName === 'achievements') {
      if (window.updateAchievementUI) window.updateAchievementUI();
    }
  };

  /**
   * Активация/деактивация луны
   */
  window.toggleMoonActive = (moonId) => {
    if (window.gameEngine && window.gameEngine.toggleMoonActive) {
      window.gameEngine.toggleMoonActive(moonId);
    } else {
      console.warn('[Events] gameEngine not ready yet');
    }
  };

  /**
   * Получение награды за квест
   */
  window.claimQuestReward = async (questId) => {
    if (window.gameEngine && window.gameEngine.claimQuestReward) {
      await window.gameEngine.claimQuestReward(questId);
    }
  };

  /**
   * Получение награды за достижение
   */
  window.claimAchievementReward = async (achId, tierLevel) => {
    if (window.gameEngine && window.gameEngine.claimAchievementReward) {
      await window.gameEngine.claimAchievementReward(achId, tierLevel);
    }
  };

  /**
   * Установить категорию квестов
   */
  window.setQuestCategory = (category) => {
    if (window._setQuestCategory) {
      window._setQuestCategory(category);
    }
  };

  /**
   * Установить категорию достижений
   */
  window.setAchievementCategory = (category) => {
    if (window._setAchievementCategory) {
      window._setAchievementCategory(category);
    }
  };

  console.log('[Events] Global functions registered');
}

// ============================================================
// 🎯 ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ (ADD EVENT LISTENER)
// ============================================================
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
      console.log('[Events] Login clicked');
      await handleLogin();
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Events] Register clicked');
      await handleRegister();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Events] Logout clicked');
      await handleLogout();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[Events] Reset clicked');
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
