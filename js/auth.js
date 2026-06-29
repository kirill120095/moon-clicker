// ============================================================
//  АВТОРИЗАЦИЯ, РЕГИСТРАЦИЯ, ВЫХОД (ИСПРАВЛЕНО)
// ============================================================
import { supabaseClient } from './supabase.js';
import { currentUser, playerData, setUser, setPlayerData, setClickCount, setTotalSecondsPlayed, setCurrentLevel, setMoonHP, setMaxHP } from './state.js';
import { showToast, collectStaticDeviceData } from './utils.js';
import { initGame, updateUI, timeUpdateIntervalRef, autoSaveIntervalRef } from './game.js';
import { setMode } from './ui.js';
import { BASE_HP } from './config.js';

let authMessageEl = null;
let actionBtn = null;

export function initAuthElements() {
    authMessageEl = document.getElementById('authMessage');
    actionBtn = document.getElementById('actionBtn');
}

// Создание/обновление игрока
export async function createOrUpdatePlayer(userId, email) {
    const staticData = collectStaticDeviceData();
    const { data: existing } = await supabaseClient
        .from('players')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    const username = currentUser?.user_metadata?.username || null;

    if (existing) {
        const { data } = await supabaseClient
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
        const { data } = await supabaseClient
            .from('players')
            .insert(newPlayer)
            .select()
            .single();
        return data;
    }
}

export async function loadPlayerData(userId) {
    const { data } = await supabaseClient
        .from('players')
        .select('*')
        .eq('id', userId)
        .single();
    return data;
}

// Регистрация
export async function handleRegister() {
    const email = document.getElementById('regEmailInput').value.trim();
    const nickname = document.getElementById('regNicknameInput').value.trim();
    const password = document.getElementById('regPasswordInput').value.trim();

    if (!email || !nickname || !password) {
        authMessageEl.textContent = '❌ Заполните все поля';
        return;
    }
    if (password.length < 6) {
        authMessageEl.textContent = '❌ Пароль минимум 6 символов';
        return;
    }

    authMessageEl.textContent = '⏳ Регистрация...';
    actionBtn.disabled = true;

    const { data, error } = await supabaseClient.auth.signUp({
        email, password, options: { data: { username: nickname } }
    });

    actionBtn.disabled = false;

    if (error) {
        authMessageEl.textContent = `❌ ${error.message}`;
        return;
    }

    if (data?.user) {
        setUser(data.user);
        const player = await createOrUpdatePlayer(data.user.id, data.user.email);
        setPlayerData(player);
        authMessageEl.textContent = '✅ Регистрация успешна! Войдите.';
        setMode('login');
        showToast('✅ Регистрация успешна!', 'success');
    }
}

// Вход
export async function handleLogin() {
    const loginType = document.querySelector('input[name="loginType"]:checked').value;
    let email = '';

    if (loginType === 'email') {
        email = document.getElementById('loginInput').value.trim();
    } else {
        const nickname = document.getElementById('loginInput').value.trim();
        const { data } = await supabaseClient.from('players').select('email').eq('username', nickname).single();
        email = data?.email;
    }

    const password = document.getElementById('passwordInput').value.trim();

    authMessageEl.textContent = '⏳ Вход...';
    actionBtn.disabled = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    actionBtn.disabled = false;

    if (error) {
        authMessageEl.textContent = `❌ ${error.message}`;
        return;
    }

    if (data?.user) {
        setUser(data.user);
        let player = await loadPlayerData(data.user.id);
        if (!player) player = await createOrUpdatePlayer(data.user.id, data.user.email);

        setPlayerData(player);
        setClickCount(player.total_clicks || 0);
        setTotalSecondsPlayed(player.total_seconds_played || 0);
        setCurrentLevel(player.level || 1);
        setMoonHP(player.moon_hp || BASE_HP);

        authMessageEl.textContent = '✅ Вход успешен!';
        document.getElementById('statsToggleBtn').classList.add('visible');
        document.getElementById('settingsBtn').classList.add('visible');
        setTimeout(initGame, 300);
    }
}

// Выход (исправлено)
export async function logout() {
    showToast('⏳ Выход...', 'info', 1000);

    if (timeUpdateIntervalRef) clearInterval(timeUpdateIntervalRef);
    if (autoSaveIntervalRef) clearInterval(autoSaveIntervalRef);
    if (window.bossTimerInterval) clearInterval(window.bossTimerInterval);

    await supabaseClient.auth.signOut();

    setUser(null);
    setPlayerData(null);
    setClickCount(0);
    setTotalSecondsPlayed(0);
    setCurrentLevel(1);
    setMoonHP(BASE_HP);

    document.getElementById('sidePanel').classList.remove('active');
    document.getElementById('gameArea').classList.remove('active');
    document.getElementById('authBlock').classList.remove('hidden');

    document.getElementById('statsToggleBtn').classList.remove('visible');
    document.getElementById('settingsBtn').classList.remove('visible');

    setMode('login');
    updateUI();
    showToast('👋 Вы вышли из аккаунта', 'success');
}
