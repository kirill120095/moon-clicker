// ============================================================
//  ПРОФИЛЬ И ЛИДЕРЫ
// ============================================================
import { supabaseClient } from './supabase.js';
import { currentUser, playerData, activeMoon, activeMoons, ownedMoons, bossKills, maxSlots, getMoonLevel } from './state.js';
import { formatTime, getTitle, showToast } from './utils.js';
import { MOON_TYPES } from './config.js';
import { selectMoon, toggleMoon } from './game.js';

let lastUpdate = 0;

export async function updateProfileAndLeaders(force = false) {
    if (!currentUser) return;
    if (!force && Date.now() - lastUpdate < 3000) return;
    lastUpdate = Date.now();

    const profileContent = document.getElementById('profileContent');
    const leadersList = document.getElementById('leadersList');

    if (!profileContent || !leadersList) {
        console.warn('Profile elements not found');
        return;
    }

    // --- Профиль ---
    if (playerData) {
        const data = playerData;
        const totalBosses = Math.floor((data.level || 1) / 10);
        const timePlayed = data.total_seconds_played || 0;
        const title = getTitle(data.level || 1);
        const shards = data.shards || 0;
        const level = data.level || 1;

        let avgTime = '—';
        if (data.total_clicks > 0 && data.total_seconds_played > 0) {
            const avgSec = data.total_seconds_played / data.total_clicks;
            avgTime = formatTime(avgSec);
        }

        // --- Список лун с переключателями (можно выбирать несколько) ---
        let moonsHtml = '';
        const moonList = ownedMoons || ['normal'];
        moonList.forEach(moonId => {
            const moon = MOON_TYPES[moonId];
            if (!moon) return;
            const moonLevel = getMoonLevel(moonId);
            const isActive = activeMoon === moonId;
            const isInActiveSlots = activeMoons.includes(moonId);
            const canToggle = isInActiveSlots ? activeMoons.length > 1 : activeMoons.length < maxSlots;

            // Расчёт бонусов с учётом уровня
            let bonusDesc = [];
            let damageBonus = (moon.damageBonus || 0) * (1 + (moonLevel - 1) * 0.05);
            let shardBonus = (moon.shardBonus || 0) * (1 + (moonLevel - 1) * 0.05);
            if (moonId === 'normal' && moonLevel > 1) {
                damageBonus += (moonLevel - 1) * 0.05;
            }
            if (damageBonus > 0) bonusDesc.push(`урон +${Math.round(damageBonus*100)}%`);
            if (shardBonus > 0) bonusDesc.push(`осколки +${Math.round(shardBonus*100)}%`);
            const bonusText = bonusDesc.length ? `(${bonusDesc.join(', ')})` : '(Без бонусов)';

            moonsHtml += `
                <div class="profile-moon-item ${isActive ? 'active' : ''}">
                    <div class="profile-moon-info">
                        <span class="profile-moon-name ${isActive ? 'active' : ''}">
                            ${moon.emoji} ${moon.name} ${bonusText}
                            ${isActive ? ' ⭐ Активна' : ''}
                        </span>
                        <span class="profile-moon-level">Ур. ${moonLevel}</span>
                        <div class="profile-moon-actions">
                            ${maxSlots > 1 ? `
                                <button class="profile-toggle-btn ${isInActiveSlots ? 'active' : ''}" data-moon="${moonId}" ${!canToggle ? 'disabled' : ''}>
                                    ${isInActiveSlots ? 'Деактивировать' : 'Активировать'}
                                </button>
                            ` : ''}
                            <button class="profile-select-btn ${isActive ? 'active' : ''}" data-moon="${moonId}" ${isActive ? 'disabled' : ''}>
                                ${isActive ? 'Главная' : 'Сделать главной'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        // --- Активные синергии ---
        let synergiesHtml = '';
        const activeSynergies = window._activeSynergies || [];
        if (activeSynergies.length > 0) {
            synergiesHtml = activeSynergies.map(s => `
                <div class="synergy-item">
                    <span class="synergy-name">🔥 ${s.name}</span>
                    <span class="synergy-desc">${s.description}</span>
                </div>
            `).join('');
        } else if (activeMoons.length > 1) {
            synergiesHtml = '<div class="no-data">Нет активных синергий</div>';
        } else {
            synergiesHtml = '<div class="no-data">Активируйте несколько лун для синергии</div>';
        }

        profileContent.innerHTML = `
            <div class="profile-account">
                <p>👤 <strong>${currentUser.user_metadata?.username || 'Игрок'}</strong></p>
                <p>📧 <strong>${currentUser.email || '-'}</strong></p>
            </div>
            <div class="profile-section-title">📊 Статистика</div>
            <div class="profile-row"><span class="label">Звание</span><span class="value" style="color:#d4af37; font-weight:bold;">${title}</span></div>
            <div class="profile-row"><span class="label">Текущий уровень</span><span class="value">${level}</span></div>
            <div class="profile-row"><span class="label">Всего кликов</span><span class="value">${data.total_clicks || 0}</span></div>
            <div class="profile-row"><span class="label">Лунных осколков</span><span class="value" style="color:#ffd700;">${shards} 💎</span></div>
            <div class="profile-row"><span class="label">Общее время</span><span class="value">${formatTime(timePlayed)}</span></div>
            <div class="profile-row"><span class="label">Убито боссов</span><span class="value">${bossKills || 0}</span></div>
            <div class="profile-row"><span class="label">Ср. время между кликами</span><span class="value">${avgTime}</span></div>
            <div class="profile-row"><span class="label">Активных слотов</span><span class="value">${activeMoons.length} / ${maxSlots}</span></div>

            <div class="profile-section-title">🌙 Мои луны</div>
            <div class="profile-moons">
                ${moonsHtml}
            </div>

            <div class="profile-section-title">🔥 Активные синергии</div>
            <div class="synergies-list">
                ${synergiesHtml}
            </div>
        `;

        // Обработчики для кнопок
        document.querySelectorAll('.profile-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moonId = btn.dataset.moon;
                toggleMoon(moonId);
                updateProfileAndLeaders(true);
            });
        });

        document.querySelectorAll('.profile-select-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const moonId = btn.dataset.moon;
                await selectMoon(moonId);
                updateProfileAndLeaders(true);
            });
        });
    }

    // --- Лидеры ---
    try {
        const { data: leaders, error } = await supabaseClient
            .from('players')
            .select('username, level, total_clicks, total_seconds_played')
            .order('level', { ascending: false })
            .order('total_clicks', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Leaders error:', error);
            leadersList.innerHTML = '<div class="no-data">Ошибка загрузки</div>';
            return;
        }

        if (!leaders || leaders.length === 0) {
            leadersList.innerHTML = '<div class="no-data">Нет данных</div>';
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
    } catch (err) {
        console.error('Leaders fetch error:', err);
        leadersList.innerHTML = '<div class="no-data">Ошибка загрузки</div>';
    }
}
