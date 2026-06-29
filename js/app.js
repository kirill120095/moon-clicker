// ============================================================
//  ТОЧКА ВХОДА – ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ (ИСПРАВЛЕНО)
// ============================================================
import { supabaseClient } from './supabase.js';
import { initToastContainer, createStars, showToast } from './utils.js';
import { initUI } from './ui.js';
import { initGame } from './game.js';
import { setUser, setPlayerData, setClickCount, setTotalSecondsPlayed, setCurrentLevel, setMoonHP, setMaxHP } from './state.js';
import { loadPlayerData, initAuthElements, createOrUpdatePlayer } from './auth.js';
import { BASE_HP } from './config.js';
import { getMaxHPForLevel } from './utils.js';

const toastContainer = document.getElementById('toastContainer');
initToastContainer(toastContainer);
createStars();
initAuthElements();
initUI();

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

            // Скрываем auth и показываем игру сразу
            document.getElementById('authBlock').classList.add('hidden');
            document.getElementById('gameArea').classList.add('active');
            document.getElementById('statsToggleBtn').classList.add('visible');
            document.getElementById('settingsBtn').classList.add('visible');

            initGame();
        } else {
            // Guest mode
            document.getElementById('authBlock').classList.remove('hidden');
            document.getElementById('gameArea').classList.remove('active');
            document.getElementById('statsToggleBtn').classList.remove('visible');
            document.getElementById('settingsBtn').classList.remove('visible');
        }
    } catch (err) {
        console.error('Auth error:', err);
        showToast('Проблема с подключением к серверу', 'warning');
    }
}

checkAuth();
