// ============================================================
//  ПРОФИЛЬ И ЛИДЕРЫ
// ============================================================
import { supabaseClient } from './supabase.js';
import { currentUser, playerData, activeMoon, ownedMoons } from './state.js';
import { formatTime, getTitle, showToast } from './utils.js';
import { MOON_TYPES } from './config.js';
import { selectMoon } from './game.js';

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
        const shards = data.shards || 0;
        
        let avgTime = '—';
        if (data.total_clicks > 0 && data.total_seconds_played > 0) {
            const avgSec = data.total_seconds_played / data.total_clicks;
            avgTime = formatTime(avgSec);
        }

        // Генерируем список лун
        let moonsHtml = '';
        const moonList = ownedMoons || ['normal'];
        moonList.forEach(moonId => {
            const moon = MOON_TYPES[moonId];
            if (!moon) return;
            const isActive = (activeMoon === moonId);
            // Формируем описание бонусов
            let bonusDesc = [];
            if (moon.damageBonus > 0) bonusDesc.push(`урон +${Math.round(moon.damageBonus*100)}%`);
            if (moon.shardBonus > 0) bonusDesc.push(`осколки +${Math.round(moon.shardBonus*100)}%`);
            const bonusText = bonusDesc.length ? ` (${bonusDesc.join(', ')})` : '';
            moonsHtml += `
                <button class="profile-moon-btn ${isActive ? 'active' : ''}" data-moon-id="${moonId}">
                    ${moon.emoji} ${moon.name}${bonusText}
                    ${isActive ? ' <span style="color:#4ecdc4; font-weight:normal;">Активна</span>' : ''}
                </button>
            `;
        });

        profileContent.innerHTML = `
            <div class="profile-account">
                <p>👤 <strong>${currentUser.user_metadata?.username || 'Игрок'}</strong></p>
                <p>📧 <strong>${currentUser.email || '-'}</strong></p>
            </div>
            <div class="profile-section-title">📊 Статистика</div>
            <div class="profile-row"><span class="label">Звание</span><span class="value" style="color:#d4af37; font-weight:bold;">${title}</span></div>
            <div class="profile-row"><span class="label">Текущий уровень</span><span class="value">${data.level || 1}</span></div>
            <div class="profile-row"><span class="label">Всего кликов</span><span class="value">${data.total_clicks || 0}</span></div>
            <div class="profile-row"><span class="label">Лунных осколков</span><span class="value" style="color:#ffd700;">${shards} 💎</span></div>
            <div class="profile-row"><span class="label">Общее время</span><span class="value">${formatTime(timePlayed)}</span></div>
            <div class="profile-row"><span class="label">Убито боссов</span><span class="value">${totalBosses}</span></div>
            <div class="profile-row"><span class="label">Ср. время между кликами</span><span class="value">${avgTime}</span></div>
            <div class="profile-section-title">🌙 Мои луны</div>
            <div class="profile-moons">
                ${moonsHtml}
            </div>
        `;

        // Добавляем обработчики для кнопок выбора луны
        document.querySelectorAll('.profile-moon-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const moonId = btn.dataset.moonId;
                if (moonId === activeMoon) {
                    showToast('⚠️ Эта луна уже активна', 'info');
                    return;
                }
                await selectMoon(moonId);
                // Обновим профиль после выбора
                updateProfileAndLeaders(true);
            });
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
