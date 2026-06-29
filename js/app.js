// ============================================================
//  ТОЧКА ВХОДА – ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================
import { supabaseClient } from './supabase.js';
import { initToastContainer, createStars, showToast } from './utils.js';
import { initUI } from './ui.js';
import { initGame } from './game.js';
import { setUser, setPlayerData, setClickCount, setTotalSecondsPlayed, setCurrentLevel, setMoonHP, setMaxHP } from './state.js';
import { loadPlayerData, initAuthElements, createOrUpdatePlayer } from './auth.js';
import { BASE_HP } from './config.js';
import { getMaxHPForLevel } from './utils.js';

// Инициализация
const toastContainer = document.getElementById('toastContainer');
initToastContainer(toastContainer);
createStars();
initAuthElements();

// Ждём загрузки DOM перед инициализацией UI
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initUI();
        checkAuth();
    });
} else {
    initUI();
    checkAuth();
}

// Проверка авторизации
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        if (session?.user) {
            const user = session.user;
            setUser(user);

            let player = await loadPlayerData(user.id);
            if (!player) {
                player = await createOrUpdatePlayer(user.id, user.email);
            }

            if (player) {
                setPlayerData(player);
                setClickCount(player.total_clicks || 0);
                setTotalSecondsPlayed(player.total_seconds_played || 0);
                setCurrentLevel(player.level || 1);
                setMoonHP(player.moon_hp || BASE_HP);
                setMaxHP(getMaxHPForLevel(player.level || 1, BASE_HP, 10));
            }

            // Скрываем авторизацию
            document.getElementById('authBlock').classList.add('hidden');
            document.getElementById('gameArea').classList.add('active');
            
            // Закрываем панель и сбрасываем кнопку ПРИ ВХОДЕ
            const sidePanel = document.getElementById('sidePanel');
            const panelTrigger = document.getElementById('panelTrigger');
            if (sidePanel) sidePanel.classList.remove('active');
            if (panelTrigger) panelTrigger.classList.remove('active');

            initGame();
        } else {
            // Гостевой режим – закрываем панель
            document.getElementById('authBlock').classList.remove('hidden');
            document.getElementById('gameArea').classList.remove('active');
            
            const sidePanel = document.getElementById('sidePanel');
            const panelTrigger = document.getElementById('panelTrigger');
            if (sidePanel) sidePanel.classList.remove('active');
            if (panelTrigger) panelTrigger.classList.remove('active');
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        showToast('Проблема с подключением', 'warning');
    }
}
