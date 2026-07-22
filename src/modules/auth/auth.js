// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================
import { db, handleDatabaseError } from '../network/supabase.js';
import { appState, state } from '../../core/state.js';
import { showToast } from '../ui/renderer.js';
import { gameEngine } from '../game/game.js';

// ============================================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================================
export async function checkAuth() {
  try {
    const { session } = await db.getSession();
    
    if (session && session.user) {
      console.log('[Auth] User is logged in:', session.user.email);
      await handleSuccessfulLogin(session.user);
    } else {
      console.log('[Auth] No active session');
      showAuthScreen();
    }
  } catch (error) {
    console.error('[Auth] Check auth error:', error);
    showAuthScreen();
  }
}

// ============================================================
// ВХОД
// ============================================================
export async function handleLogin() {
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const errorDiv = document.getElementById('authError');

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    showError('Введите email и пароль');
    return;
  }

  try {
    console.log('[Auth] Attempting login for:', email);
    const { user, session } = await db.signInWithPassword(email, password);

    if (user) {
      await handleSuccessfulLogin(user);
      hideError();
    } else {
      showError('Не удалось войти');
    }
  } catch (error) {
    console.error('[Auth] Login error:', error);
    const errorMessage = handleDatabaseError(error);
    showError(errorMessage);
  }
}

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
export async function handleRegister() {
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const usernameInput = document.getElementById('authUsername');

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;
  const username = usernameInput?.value?.trim() || email.split('@')[0];

  if (!email || !password) {
    showError('Введите email и пароль');
    return;
  }

  if (password.length < 6) {
    showError('Пароль должен быть минимум 6 символов');
    return;
  }

  try {
    console.log('[Auth] Attempting registration for:', email);
    const { user } = await db.register(email, password, username);

    if (user) {
      // Показываем сообщение о необходимости подтверждения email
      showError('Проверьте email для подтверждения аккаунта');
      
      // Если email подтверждение выключено в Supabase, входим сразу
      if (user.confirmed_at || user.email_confirmed_at) {
        await handleSuccessfulLogin(user);
      }
    } else {
      showError('Не удалось зарегистрироваться');
    }
  } catch (error) {
    console.error('[Auth] Register error:', error);
    const errorMessage = handleDatabaseError(error);
    showError(errorMessage);
  }
}

// ============================================================
// УСПЕШНЫЙ ВХОД
// ============================================================
async function handleSuccessfulLogin(user) {
  console.log('[Auth] Successful login:', user.email);
  
  // Устанавливаем пользователя в state
  appState.setUser(user);

  // Загружаем данные игрока из БД
  try {
    const playerData = await db.getPlayer(user.id);
    if (playerData) {
      appState.loadPlayerData(playerData);
    }
  } catch (error) {
    console.error('[Auth] Load player data error:', error);
  }

  // Скрываем экран авторизации
  hideAuthScreen();
  
  // Показываем основной экран
  showApp();

  // Инициализируем игру
  if (gameEngine && gameEngine.init) {
    gameEngine.init();
  }

  showToast(`✅ Добро пожаловать, ${user.user_metadata?.username || 'Игрок'}!`, 'success');
}

// ============================================================
// ВЫХОД
// ============================================================
export async function handleLogout() {
  try {
    await db.signOut();
    
    // Очищаем state
    appState.clearUser();
    appState.reset();

    // Уничтожаем game engine
    if (gameEngine && gameEngine.destroy) {
      gameEngine.destroy();
    }

    // Показываем экран авторизации
    showAuthScreen();
    hideApp();

    showToast('👋 Вы вышли из аккаунта', 'info');
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    showToast('⚠️ Ошибка выхода', 'warning');
  }
}

// ============================================================
// СБРОС ПРОГРЕССА
// ============================================================
export async function handleResetProgress() {
  if (!state.user) {
    showToast('⚠️ Войдите в аккаунт', 'warning');
    return;
  }

  const confirmed = confirm('Вы уверены, что хотите сбросить весь прогресс? Это действие нельзя отменить!');
  
  if (!confirmed) return;

  try {
    if (gameEngine && gameEngine.resetProgress) {
      await gameEngine.resetProgress();
    }
  } catch (error) {
    console.error('[Auth] Reset progress error:', error);
    showToast('⚠️ Ошибка сброса прогресса', 'warning');
  }
}

// ============================================================
// UI HELPERS
// ============================================================
function showAuthScreen() {
  const authScreen = document.getElementById('authScreen');
  if (authScreen) {
    authScreen.classList.remove('hidden');
  }
}

function hideAuthScreen() {
  const authScreen = document.getElementById('authScreen');
  if (authScreen) {
    authScreen.classList.add('hidden');
  }
}

function showApp() {
  const app = document.getElementById('app');
  if (app) {
    app.classList.remove('hidden');
  }
}

function hideApp() {
  const app = document.getElementById('app');
  if (app) {
    app.classList.add('hidden');
  }
}

function showError(message) {
  const errorDiv = document.getElementById('authError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
  }
}

function hideError() {
  const errorDiv = document.getElementById('authError');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
  }
}
