// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ - С НОВЫМИ ФУНКЦИЯМИ
// ============================================================
import { handleLogin, handleRegister, handleLogout, handleResetProgress } from '../auth/auth.js';
import { gameEngine } from '../game/game.js';
import { CONSTANTS } from '../../core/constants.js';
import { appState, state } from '../../core/state.js';
import { showToast } from './renderer.js';

// ============================================================
// 🌍 ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ onclick В HTML
// ============================================================

if (typeof window !== 'undefined') {
  /**
   * TOGGLE панели
   */
  window.togglePanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const isOpen = !panel.classList.contains('hidden');
    
    if (isOpen) {
      panel.classList.add('hidden');
      updateToggleButton(panelId, false);
    } else {
      panel.classList.remove('hidden');
      updateToggleButton(panelId, true);
      refreshPanelOnOpen(panelId);
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

  function refreshPanelOnOpen(panelId) {
    if (panelId === 'profilePanel') {
      if (window.updateProfileAndLeaders) window.updateProfileAndLeaders();
    } else if (panelId === 'shopPanel') {
      if (window.updateShopUI) window.updateShopUI();
      if (window.updateQuestUI) window.updateQuestUI();
      if (window.updateAchievementUI) window.updateAchievementUI();
    }
  }

  window.closeAllPanels = () => {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.side-toggle-btn').forEach(btn => btn.classList.remove('panel-open'));
  };

  window.closePanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('hidden');
      updateToggleButton(panelId, false);
    }
  };

  window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  };

  /**
   * Переключение вкладок
   */
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
    
    if (tabName === 'leaders' || tabName === 'profile') {
      if (window.updateProfileAndLeaders) window.updateProfileAndLeaders();
    }
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
    }
  };

  window.claimQuestReward = async (questId) => {
    if (window.gameEngine && window.gameEngine.claimQuestReward) {
      await window.gameEngine.claimQuestReward(questId);
    }
  };

  window.claimAchievementReward = async (achId, tierLevel) => {
    if (window.gameEngine && window.gameEngine.claimAchievementReward) {
      await window.gameEngine.claimAchievementReward(achId, tierLevel);
    }
  };

  window.setQuestCategory = (category) => {
    if (window._setQuestCategory) window._setQuestCategory(category);
  };

  window.setAchievementCategory = (category) => {
    if (window._setAchievementCategory) window._setAchievementCategory(category);
  };

  // ============================================================
  // НОВОЕ: Управление уровнем (фиксация и откат)
  // ============================================================
  window.toggleLevelLock = () => {
    const isLocked = !state.levelLocked;
    appState.set('levelLocked', isLocked);
    
    if (window.updateUI) window.updateUI();
    
    showToast(
      isLocked ? '🔒 Уровень закреплён (фарм режим)' : '🔓 Уровень откреплен', 
      'info'
    );
  };

  window.rollbackLevel = async () => {
    if (window.gameEngine && window.gameEngine.rollbackLevel) {
      await window.gameEngine.rollbackLevel();
    }
  };

  // ============================================================
  // НОВОЕ: Тестовый режим с паролем
  // ============================================================
  window.showPasswordModal = () => {
    if (state.testMode) {
      // Если уже включён - просто выключаем
      window.gameEngine.toggleTestMode();
      return;
    }
    
    const modal = document.getElementById('passwordModal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = document.getElementById('testModePassword');
      if (input) {
        input.value = '';
        input.focus();
      }
      const errorEl = document.getElementById('passwordError');
      if (errorEl) errorEl.classList.remove('show');
    }
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
    
    if (password === CONSTANTS.TEST_MODE_PASSWORD) {
      window.closePasswordModal();
      if (window.gameEngine && window.gameEngine.toggleTestMode) {
        window.gameEngine.toggleTestMode();
      }
    } else {
      errorEl.textContent = '❌ Неверный пароль';
      errorEl.classList.add('show');
      input.value = '';
      input.focus();
    }
  };

  // Обработка Enter в поле пароля
  document.addEventListener('DOMContentLoaded', () => {
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

  // ============================================================
  // НОВОЕ: Модалка Сверхновой
  // ============================================================
  window.showSupernovaModal = () => {
    const modal = document.getElementById('supernovaModal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeSupernovaModal = () => {
    const modal = document.getElementById('supernovaModal');
    if (modal) modal.classList.add('hidden');
  };

  console.log('[Events] Global functions registered');
}

// ============================================================
// 🎯 ИНИЦИАЛИЗАЦИЯ ADD EVENT LISTENER
// ============================================================
export function initEvents() {
  console.log('[Events] Инициализация...');

  // Кнопки авторизации
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

  // Клик по луне
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

  // Enter в форме авторизации
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
