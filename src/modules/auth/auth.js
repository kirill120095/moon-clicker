// ============================================================
//  АВТОРИЗАЦИЯ
// ============================================================
import { appState, state } from '../../core/state.js';
import { db, handleDatabaseError } from '../network/supabase.js';
import { authSchemas, validateForm, isEmail } from './validation.js';
import { escapeHTML, throttle, RateLimiter } from '../../utils/security.js';
import { showToast } from '../ui/renderer.js';

const loginLimiter = new RateLimiter({ limit: 5, window: 60000 });
const registerLimiter = new RateLimiter({ limit: 3, window: 60000 });

export async function handleLogin(identifier, password) {
    const ip = 'client';
    const loginCheck = loginLimiter.check(ip);
    if (!loginCheck.allowed) {
        showToast('⚠️ Слишком много попыток входа. Подождите.', 'warning');
        return { success: false, error: 'Rate limit exceeded' };
    }

    const formData = { identifier, password };
    const validation = validateForm(formData, authSchemas.login);
    if (!validation.valid) {
        const error = Object.values(validation.errors)[0];
        showToast(`⚠️ ${error}`, 'warning');
        return { success: false, error };
    }

    try {
        let email = validation.data.identifier;

        // Если ввели логин, ищем email в базе
        if (!isEmail(email)) {
            const player = await db.getPlayerByUsername(validation.data.identifier);
            if (!player) {
                showToast('⚠️ Пользователь не найден', 'warning');
                return { success: false, error: 'User not found' };
            }
            email = player.email;
        }

        const { user, session } = await db.signIn(
            email,
            validation.data.password
        );
        
        appState.setUser(user);
        
        const player = await db.getPlayer(user.id);
        appState.loadPlayerData(player);
        
        showToast('✅ Добро пожаловать!', 'success');
        return { success: true, user, player };
        
    } catch (error) {
        const dbError = handleDatabaseError(error);
        showToast(`⚠️ ${dbError.message}`, 'warning');
        return { success: false, error: dbError.message };
    }
}

export async function handleRegister(email, nickname, password) {
    const ip = 'client';
    const registerCheck = registerLimiter.check(ip);
    if (!registerCheck.allowed) {
        showToast('⚠️ Слишком много попыток регистрации. Подождите.', 'warning');
        return { success: false, error: 'Rate limit exceeded' };
    }

    const formData = { email, nickname, password };
    const validation = validateForm(formData, authSchemas.register);
    if (!validation.valid) {
        const error = Object.values(validation.errors)[0];
        showToast(`⚠️ ${error}`, 'warning');
        return { success: false, error };
    }

    try {
        const { user, session } = await db.signUp(
            validation.data.email,
            validation.data.password,
            { username: validation.data.nickname }
        );
        
        if (!user) {
            showToast('⚠️ Ошибка регистрации', 'warning');
            return { success: false, error: 'Registration failed' };
        }
        
        const playerData = {
            id: user.id,
            email: user.email,
            username: validation.data.nickname,
            total_clicks: 0,
            level: 1,
            moon_hp: 100,
            shards: 0,
            total_seconds_played: 0,
            session_count: 1,
            current_session_start: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const player = await db.createPlayer(playerData);
        
        appState.setUser(user);
        appState.loadPlayerData(player);
        
        showToast('✅ Регистрация успешна!', 'success');
        return { success: true, user, player };
        
    } catch (error) {
        const dbError = handleDatabaseError(error);
        showToast(`⚠️ ${dbError.message}`, 'warning');
        return { success: false, error: dbError.message };
    }
}

export async function handleLogout() {
    try {
        await db.signOut();
        appState.clearAll();
        showToast('👋 Вы вышли из аккаунта', 'success');
        return { success: true };
    } catch (error) {
        const dbError = handleDatabaseError(error);
        showToast(`⚠️ ${dbError.message}`, 'warning');
        return { success: false, error: dbError.message };
    }
}

export async function checkAuth() {
    try {
        const { session } = await db.getSession();
        if (session?.user) {
            const user = session.user;
            appState.setUser(user);
            
            const player = await db.getPlayer(user.id);
            if (player) {
                appState.loadPlayerData(player);
            }
            
            return { success: true, user, player };
        }
        return { success: false };
    } catch (error) {
        console.error('Auth check error:', error);
        return { success: false, error: error.message };
    }
}

export async function updateProfile(updates) {
    const user = state.user;
    if (!user) {
        showToast('⚠️ Войдите в аккаунт', 'warning');
        return { success: false, error: 'Not authenticated' };
    }

    try {
        const player = await db.updatePlayer(user.id, updates);
        appState.loadPlayerData(player);
        showToast('✅ Профиль обновлен', 'success');
        return { success: true, player };
    } catch (error) {
        const dbError = handleDatabaseError(error);
        showToast(`⚠️ ${dbError.message}`, 'warning');
        return { success: false, error: dbError.message };
    }
}

export async function getLeaders(limit = 10) {
    try {
        const leaders = await db.getLeaders(limit);
        return { success: true, leaders };
    } catch (error) {
        const dbError = handleDatabaseError(error);
        return { success: false, error: dbError.message };
    }
}
