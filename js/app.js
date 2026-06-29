// ============================================================
//  ТОЧКА ВХОДА – ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================================
import { supabaseClient } from './supabase.js';
import { initToastContainer, createStars, showToast } from './utils.js';
import { initUI } from './ui.js';
import { initGame } from './game.js';
import { setUser, setPlayerData, setClickCount, setTotalSecondsPlayed, setCurrentLevel, setMoonHP, setMaxHP, setActiveMoon, setOwnedMoons } from './state.js';
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
                if (player.active_moon) setActiveMoon(player.active_moon);
                if (player.owned_moons) setOwnedMoons(JSON.parse(player.owned_moons));
            }

            // Скрываем авторизацию
            document.getElementById('authBlock').classList.add('hidden');
            document.getElementById('gameArea').classList.add('active');

            // Показываем кнопки боковых панелей
            const leftTrigger = document.getElementById('panelTrigger');
            const rightTrigger = document.getElementById('shopTrigger');
            if (leftTrigger) leftTrigger.classList.add('visible');
            if (rightTrigger) rightTrigger.classList.add('visible');

            // Закрываем панели и сбрасываем кнопки
            const sidePanel = document.getElementById('sidePanel');
            if (sidePanel) sidePanel.classList.remove('active');
            if (leftTrigger) leftTrigger.classList.remove('active');

            const shopPanel = document.getElementById('shopPanel');
            if (shopPanel) shopPanel.classList.remove('active');
            if (rightTrigger) rightTrigger.classList.remove('active');

            initGame();
        } else {
            // Гостевой режим – скрываем кнопки панелей
            document.getElementById('authBlock').classList.remove('hidden');
            document.getElementById('gameArea').classList.remove('active');

            const leftTrigger = document.getElementById('panelTrigger');
            const rightTrigger = document.getElementById('shopTrigger');
            if (leftTrigger) {
                leftTrigger.classList.remove('visible');
                leftTrigger.classList.remove('active');
            }
            if (rightTrigger) {
                rightTrigger.classList.remove('visible');
                rightTrigger.classList.remove('active');
            }

            const sidePanel = document.getElementById('sidePanel');
            if (sidePanel) sidePanel.classList.remove('active');

            const shopPanel = document.getElementById('shopPanel');
            if (shopPanel) shopPanel.classList.remove('active');
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        showToast('Проблема с подключением', 'warning');
    }
}
