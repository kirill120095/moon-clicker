// ============================================================
//  ПРОФИЛЬ И ЛИДЕРЫ (ОПТИМИЗИРОВАННОЕ ОБНОВЛЕНИЕ)
// ============================================================
import { supabaseClient } from './supabase.js';
import { currentUser, playerData } from './state.js';
import { formatTime, getTitle } from './utils.js';

let lastUpdate = 0;

export async function updateProfileAndLeaders(force = false) {
    if (!currentUser) return;
    if (!force && Date.now() - lastUpdate < 3000) return;
    lastUpdate = Date.now();

    const profileContent = document.getElementById('profileContent');
    const leadersList = document.getElementById('leadersList');

    // --- Профиль ---
    if (playerData && profileContent) {
        const data = playerData;
        const totalBosses = Math.floor((data.level || 1) / 10);
        const timePlayed = data.total_seconds_played || 0;
        const title = getTitle(data.level || 1);
        let avgTime = '—';
        if (data.total_clicks > 1 && data.last_click_at && data.first_click_at) {
            const first = new Date(data.first_click_at).getTime();
            const last = new Date(data.last_click_at).getTime();
            if (last > first) {
                const avgSec = (last - first) / (data.total_clicks - 1) / 1000;
                avgTime = formatTime(avgSec);
            }
        }
        const savedMode = localStorage.getItem('moonMode') || 'normal';
        profileContent.innerHTML = `
            <div class="profile-account">
                <p>👤 <strong>${currentUser.user_metadata?.username || 'Игрок'}</strong></p>
                <p>📧 <strong>${currentUser.email || '-'}</strong></p>
            </div>
            <div class="profile-section-title">🎨 Фон луны</div>
            <div class="profile-bg-options">
                <button data-bg="normal" class="${savedMode === 'normal' ? 'active' : ''}">⚪ Обычная</button>
                <button data-bg="blood" class="${savedMode === 'blood' ? 'active' : ''}">🩸 Кровавая</button>
            </div>
            <div class="profile-section-title">📊 Статистика</div>
            <div class="profile-row"><span class="label">Звание</span><span class="value" style="color:#d4af37; font-weight:bold;">${title}</span></div>
            <div class="profile-row"><span class="label">Текущий уровень</span><span class="value">${data.level || 1}</span></div>
            <div class="profile-row"><span class="label">Всего кликов</span><span class="value">${data.total_clicks || 0}</span></div>
            <div class="profile-row"><span class="label">Общее время</span><span class="value">${formatTime(timePlayed)}</span></div>
            <div class="profile-row"><span class="label">Убито боссов</span><span class="value">${totalBosses}</span></div>
            <div class="profile-row"><span class="label">Ср. время между кликами</span><span class="value">${avgTime}</span></div>
        `;
        document.querySelectorAll('.profile-bg-options button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.bg === savedMode);
        });
    }

    // --- Лидеры ---
    if (leadersList) {
        const { data: leaders, error } = await supabaseClient
            .from('players')
            .select('username, level, total_clicks, total_seconds_played')
            .order('level', { ascending: false })
            .order('total_clicks', { ascending: false })
            .limit(10);

        if (error || !leaders) {
            leadersList.innerHTML = '<div class="no-data">Ошибка загрузки</div>';
            return;
        }

        let html = '';
        leaders.forEach((p, i) => {
            const isMe = p.username === playerData?.username;
            html += `
                <div class="leader-item ${isMe ? 'me' : ''}">
                    <span class="pos">#${i+1}</span>
                    <span class="name">${p.username || 'Аноним'}</span>
                    <span class="stats">
                        <span>Ур. ${p.level || 0}</span>
                        <span style="font-size:0.7rem;">кликов: ${p.total_clicks || 0}</span>
                    </span>
                </div>
            `;
        });
        leadersList.innerHTML = html;
    }
}
