// ============================================================
//  ТОЧКА ВХОДА – ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================
import { supabaseClient } from './supabase.js';
import { initToastContainer, createStars } from './utils.js';
import { initUI } from './ui.js';
import { initGame } from './game.js';
import { currentUser, setUser, setPlayerData, setClickCount, setTotalSecondsPlayed, setCurrentLevel, setMoonHP, setMaxHP } from './state.js';
import { loadPlayerData, initAuthElements } from './auth.js';
import { BASE_HP } from './config.js';
import { getMaxHPForLevel } from './utils.js';

// Инициализация toast-контейнера
const toastContainer = document.getElementById('toastContainer');
initToastContainer(toastContainer);

// Генерация звёзд
createStars();

// Инициализация элементов авторизации
initAuthElements();

// Инициализация UI (привязка обработчиков)
initUI();

// Проверка авторизации при загрузке
async function checkAuth() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (data?.session) {
        const user = data.session.user;
        setUser(user);
        const player = await loadPlayerData(user.id);
        if (player) {
            setPlayerData(player);
            setClickCount(player.total_clicks || 0);
            setTotalSecondsPlayed(player.total_seconds_played || 0);
            setCurrentLevel(player.level || 1);
            setMoonHP(player.moon_hp || BASE_HP);
            setMaxHP(getMaxHPForLevel(player.level || 1, BASE_HP, 10));
        } else {
            // если нет записи – создадим позже в initGame
            setPlayerData(null);
            setClickCount(0);
            setTotalSecondsPlayed(0);
            setCurrentLevel(1);
            setMoonHP(BASE_HP);
            setMaxHP(BASE_HP);
        }
        // Показываем игровые кнопки (добавляем класс visible)
        document.getElementById('statsToggleBtn').classList.add('visible');
        document.getElementById('settingsBtn').classList.add('visible');
        initGame();
    } else {
        // Скрываем кнопки (удаляем класс visible)
        document.getElementById('statsToggleBtn').classList.remove('visible');
        document.getElementById('settingsBtn').classList.remove('visible');
        // Показываем форму входа
        document.getElementById('authBlock').classList.remove('hidden');
        document.getElementById('gameArea').classList.remove('active');
        // По умолчанию режим "вход"
        document.getElementById('loginFields').classList.remove('hidden');
        document.getElementById('registerFields').classList.add('hidden');
        document.getElementById('tabLogin').classList.add('active');
        document.getElementById('tabRegister').classList.remove('active');
        document.getElementById('actionBtn').textContent = 'Войти';
    }
}

// Запускаем проверку
checkAuth();
