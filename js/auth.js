// ============================================================
//  АВТОРИЗАЦИЯ, РЕГИСТРАЦИЯ, ВЫХОД
// ============================================================
import { supabaseClient } from './supabase.js';
import { currentUser, playerData, setUser, setPlayerData, setClickCount, setTotalSecondsPlayed, setCurrentLevel, setMoonHP, setMaxHP } from './state.js';
import { showToast, collectStaticDeviceData } from './utils.js';
import { initGame, updateUI } from './game.js';
import { setMode } from './ui.js';
import { BASE_HP } from './config.js';

// DOM-элементы (устанавливаются при инициализации)
let authMessageEl = null;

export function initAuthElements() {
    authMessageEl = document.getElementById('authMessage');
}

// --- Вспомогательные функции для работы с БД (создание/загрузка игрока) ---
export async function createOrUpdatePlayer(userId, email) {
    const staticData = collectStaticDeviceData();
    const { data: existing, error: selectError } = await supabaseClient
        .from('players')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
        console.error('Ошибка проверки игрока:', selectError);
        return null;
    }

    const username = currentUser?.user_metadata?.username || null;

    if (existing) {
        const { data, error } = await supabaseClient
            .from('players')
            .update({
                email: email || existing.email,
                username: username || existing.username,
                session_count: (existing.session_count || 0) + 1,
                current_session_start: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();
        if (error) console.error('Ошибка обновления игрока:', error);
        return data || existing;
    } else {
        const newPlayer = {
            id: userId,
            email: email,
            username: username,
            total_clicks: 0,
            first_click_at: new Date().toISOString(),
            last_click_at: null,
            session_count: 1,
            total_seconds_played: 0,
            current_session_start: new Date().toISOString(),
            level: 1,
            moon_hp: Math.round(BASE_HP),
            ...staticData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabaseClient
            .from('players')
            .insert(newPlayer)
            .select()
            .single();
        if (error) {
            console.error('Ошибка создания игрока:', error);
            return null;
        }
        return data;
    }
}

export async function loadPlayerData(userId) {
    const { data, error } = await supabaseClient
        .from('players')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) {
        console.error('Ошибка загрузки данных:', error);
        return null;
    }
    return data;
}

// --- Регистрация ---
export async function handleRegister() {
    const email = document.getElementById('regEmailInput').value.trim();
    const nickname = document.getElementById('regNicknameInput').value.trim();
    const password = document.getElementById('regPasswordInput').value.trim();

    if (!email || !nickname || !password) {
        if (authMessageEl) {
            authMessageEl.textContent = '❌ Заполните все поля';
            authMessageEl.className = 'error';
        }
        return;
    }

    if (password.length < 6) {
        if (authMessageEl) {
            authMessageEl.textContent = '❌ Пароль должен быть минимум 6 символов';
            authMessageEl.className = 'error';
        }
        return;
    }

    if (authMessageEl) {
        authMessageEl.textContent = '⏳ Регистрация...';
        authMessageEl.className = 'error';
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { username: nickname }
        }
    });

    if (error) {
        if (authMessageEl) {
            authMessageEl.textContent = `❌ ${error.message}`;
            authMessageEl.className = 'error';
        }
        console.error('Ошибка регистрации:', error);
        return;
    }

    if (data?.user) {
        setUser(data.user);
        const player = await createOrUpdatePlayer(data.user.id, data.user.email);
        setPlayerData(player);
        if (authMessageEl) {
            authMessageEl.textContent = '✅ Регистрация успешна!';
            authMessageEl.className = 'error';
        }
        setTimeout(initGame, 1500);
    }
}

// --- Вход ---
export async function handleLogin() {
    const loginTypeSelected = document.querySelector('input[name="loginType"]:checked').value;
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    let email = '';

    if (loginTypeSelected === 'email') {
        email = loginInput.value.trim();
        if (!email) {
            if (authMessageEl) {
                authMessageEl.textContent = '❌ Введите email';
                authMessageEl.className = 'error';
            }
            return;
        }
    } else {
        const nickname = loginInput.value.trim();
        if (!nickname) {
            if (authMessageEl) {
                authMessageEl.textContent = '❌ Введите логин';
                authMessageEl.className = 'error';
            }
            return;
        }
        const { data, error } = await supabaseClient
            .from('players')
            .select('email')
            .eq('username', nickname)
            .single();
        if (error || !data) {
            if (authMessageEl) {
                authMessageEl.textContent = '❌ Логин не найден';
                authMessageEl.className = 'error';
            }
            return;
        }
        email = data.email;
    }

    const password = passwordInput.value.trim();
    if (!password) {
        if (authMessageEl) {
            authMessageEl.textContent = '❌ Введите пароль';
            authMessageEl.className = 'error';
        }
        return;
    }

    if (authMessageEl) {
        authMessageEl.textContent = '⏳ Вход...';
        authMessageEl.className = 'error';
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        if (authMessageEl) {
            authMessageEl.textContent = `❌ ${error.message}`;
            authMessageEl.className = 'error';
        }
        console.error('Ошибка входа:', error);
        return;
    }

    if (data?.user) {
        setUser(data.user);
        const player = await loadPlayerData(data.user.id);
        if (player) {
            setPlayerData(player);
            setClickCount(player.total_clicks || 0);
            setTotalSecondsPlayed(player.total_seconds_played || 0);
            setCurrentLevel(player.level || 1);
            setMoonHP(player.moon_hp || BASE_HP);
            // maxHP будет рассчитан в game.js
        } else {
            // если нет записи – создадим
            const newPlayer = await createOrUpdatePlayer(data.user.id, data.user.email);
            setPlayerData(newPlayer);
            setClickCount(0);
            setTotalSecondsPlayed(0);
            setCurrentLevel(1);
            setMoonHP(BASE_HP);
        }
        if (authMessageEl) {
            authMessageEl.textContent = '✅ Вход успешен!';
            authMessageEl.className = 'error';
        }
        setTimeout(initGame, 1500);
    }
}

// --- Выход ---
export async function logout() {
    // Останавливаем таймеры и интервалы (они будут остановлены в game.js)
    await supabaseClient.auth.signOut();
    setUser(null);
    setPlayerData(null);
    setClickCount(0);
    setTotalSecondsPlayed(0);
    setCurrentLevel(1);
    setMoonHP(BASE_HP);
    // Закрываем панель
    const sidePanel = document.getElementById('sidePanel');
    if (sidePanel) sidePanel.classList.remove('active');
    // Переключаем на форму входа
    setMode('login');
    const authBlock = document.getElementById('authBlock');
    const gameArea = document.getElementById('gameArea');
    if (authBlock) authBlock.classList.remove('hidden');
    if (gameArea) gameArea.classList.remove('active');
    showToast('👋 Вы вышли из аккаунта', 'info');
    // Обновим UI
    updateUI();
}
