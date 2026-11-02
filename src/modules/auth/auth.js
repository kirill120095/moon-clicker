// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================
import { db, handleDatabaseError } from '../network/supabase.js';
import { appState, state } from '../../core/state.js';
import { showToast } from '../ui/renderer.js';
import { gameEngine } from '../game/game.js';

let authBusy = false;
function setAuthBusy(busy) {
  authBusy = busy;
  for (const id of ['loginBtn', 'registerBtn']) {
    const button = document.getElementById(id);
    if (button) button.disabled = busy;
  }
}

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
    hideApp();
    showError('Не удалось загрузить сохранение. Попробуйте войти ещё раз.');
  }
}

// ============================================================
// ВХОД
// ============================================================
export async function handleLogin() {
  if (authBusy) return;
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const errorDiv = document.getElementById('authError');

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    showError('Введите логин и пароль');
    return;
  }

  setAuthBusy(true);
  try {
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
  } finally {
    setAuthBusy(false);
  }
}

// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
export async function handleRegister() {
  if (authBusy) return;
  const username = document.getElementById('authEmail')?.value?.trim();
  const password = document.getElementById('authPassword')?.value;
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username || '')) {
    showError('Логин: 3–30 латинских букв, цифр, _ или -');
    return;
  }
  if (!password) {
    showError('Введите пароль');
    return;
  }

  if (password.length < 6) {
    showError('Пароль должен быть минимум 6 символов');
    return;
  }

  setAuthBusy(true);
  try {
    const { user } = await db.register(username, password);

    if (user) {
      await handleSuccessfulLogin(user);
      hideError();
    } else {
      showError('Не удалось зарегистрироваться');
    }
  } catch (error) {
    console.error('[Auth] Register error:', error);
    const errorMessage = handleDatabaseError(error);
    showError(errorMessage);
  } finally {
    setAuthBusy(false);
  }
}

// ============================================================
// УСПЕШНЫЙ ВХОД
// ============================================================
async function handleSuccessfulLogin(user) {
  console.log('[Auth] Successful login:', user.email);
  
  // Do not enable gameplay or autosave until the remote save is loaded.
  let playerData = await db.getPlayer(user.id);
  if (playerData && !playerData.username && user.user_metadata?.username) {
    playerData = await db.updatePlayer(user.id, { username: user.user_metadata.username });
  }
  if (!playerData) throw new Error('Не удалось загрузить сохранение. Попробуйте войти ещё раз.');
  appState.setUser(user);
  appState.loadPlayerData(playerData);

  // Скрываем экран авторизации
  // Wait for the authoritative game state before revealing the app.

  // Инициализируем игру
  if (gameEngine && gameEngine.init) {
    await gameEngine.init();
  }
  hideAuthScreen();
  showApp();

  showToast(`✅ Добро пожаловать, ${user.user_metadata?.username || 'Игрок'}!`, 'success');
}

// ============================================================
// ВЫХОД
// ============================================================
export async function handleLogout() {
  if (authBusy) return;
  setAuthBusy(true);
  try {
    await gameEngine._saveProgress();
    if (gameEngine._saveFailed) throw new Error('Сначала дождитесь сохранения прогресса');
    gameEngine.destroy();
    await db.signOut();
    
    // Очищаем state
    // Stop intervals before resetting the state that stores their handles.
    if (gameEngine && gameEngine.destroy) {
      gameEngine.destroy();
    }
    appState.clearUser();
    appState.reset();

    // Показываем экран авторизации
    showAuthScreen();
    hideApp();

    showToast('👋 Вы вышли из аккаунта', 'info');
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    if (state.user && !gameEngine._isRunning) gameEngine.init();
    showToast('⚠️ Ошибка выхода. Проверьте соединение и сохранение.', 'warning');
  } finally {
    setAuthBusy(false);
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
