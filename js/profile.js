// ============================================================
//  ПРОФИЛЬ И ЛИДЕРЫ
// ============================================================
import { supabaseClient } from './supabase.js';
import { currentUser, playerData, activeMoon, activeMoons, ownedMoons, bossKills, quests, achievements, maxSlots, getMoonLevel, currentLevel } from './state.js';
import { formatTime, getTitle, showToast } from './utils.js';
import { MOON_TYPES, getMoonUpgradeCost, ACHIEVEMENTS, QUESTS } from './config.js';
import { selectMoon, upgradeMoon, toggleMoon } from './game.js';

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
        const level = currentLevel || data.level || 1;

        let avgTime = '—';
        if (data.total_clicks > 0 && data.total_seconds_played > 0) {
            const avgSec = data.total_seconds_played / data.total_clicks;
            avgTime = formatTime(avgSec);
        }

        // --- Список лун с переключателями и прокачкой ---
        let moonsHtml = '';
        const moonList = ownedMoons || ['normal'];
        moonList.forEach(moonId => {
            const moon = MOON_TYPES[moonId];
            if (!moon) return;
            const moonLevel = getMoonLevel(moonId);
            const isActive = (activeMoon === moonId);
            const isInActiveSlots = activeMoons.includes(moonId);
            const canToggle = isInActiveSlots ? activeMoons.length > 1 : activeMoons.length < maxSlots;

            let bonusDesc = [];
            if (moon.damageBonus > 0) bonusDesc.push(`урон +${Math.round(moon.damageBonus*100)}%`);
            if (moon.shardBonus > 0) bonusDesc.push(`осколки +${Math.round(moon.shardBonus*100)}%`);
            const bonusText = bonusDesc.length ? `(${bonusDesc.join(', ')})` : '';

            const canUpgrade = level >= 10 && moonLevel < 10;
            const upgradeCost = canUpgrade ? getMoonUpgradeCost(moonId, moonLevel) : 0;

            moonsHtml += `
                <div class="profile-moon-item">
                    <div class="profile-moon-info">
                        <span class="profile-moon-name ${isActive ? 'active' : ''}">
                            ${moon.emoji} ${moon.name} ${bonusText}
                            ${isActive ? ' ⭐' : ''}
                        </span>
                        <span class="profile-moon-level">Ур. ${moonLevel}</span>
                        <div class="profile-moon-actions">
                            <button class="profile-toggle-btn ${isInActiveSlots ? 'active' : ''}" data-moon="${moonId}" ${!canToggle ? 'disabled' : ''}>
                                ${isInActiveSlots ? '✅' : '⬜'}
                            </button>
                            <button class="profile-select-btn ${isActive ? 'active' : ''}" data-moon="${moonId}" ${isActive ? 'disabled' : ''}>
                                ${isActive ? 'Активна' : 'Выбрать'}
                            </button>
                            ${canUpgrade ? `<button class="profile-upgrade-btn" data-moon="${moonId}" data-cost="${upgradeCost}">Улучшить (${upgradeCost} 💎)</button>` : ''}
                            ${moonLevel >= 10 ? '<span style="color:#ffd700;">MAX</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        // --- Квесты ---
        let questsHtml = '';
        if (quests) {
            for (const [id, q] of Object.entries(quests)) {
                const progress = q.progress || 0;
                const target = q.target || 100;
                const percent = Math.min(100, Math.round((progress / target) * 100));
                questsHtml += `
                    <div class="quest-item ${q.completed ? 'completed' : ''}">
                        <span class="quest-name">${q.name}</span>
                        <span class="quest-desc">${q.description}</span>
                        <div class="quest-bar">
                            <div class="quest-fill" style="width: ${percent}%;"></div>
                        </div>
                        <span class="quest-progress">${progress}/${target}</span>
                        ${q.completed ? '<span class="quest-done">✅ Выполнено</span>' : ''}
                        <span class="quest-reward">+${q.reward} 💎</span>
                    </div>
                `;
            }
        }

        // --- Ачивки ---
        let achievementsHtml = '';
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            const achieved = achievements[id] || false;
            achievementsHtml += `
                <div class="achievement-item ${achieved ? 'achieved' : ''}">
                    <span class="ach-name">${ach.name}</span>
                    <span class="ach-desc">${ach.description}</span>
                    <span class="ach-status">${achieved ? '✅' : '🔒'}</span>
                    <span class="ach-reward">+${ach.reward} 💎</span>
                </div>
            `;
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

            <div class="profile-section-title">📋 Квесты</div>
            <div class="quests-list">
                ${questsHtml || 'Нет активных квестов'}
            </div>

            <div class="profile-section-title">🏆 Достижения</div>
            <div class="achievements-list">
                ${achievementsHtml || 'Нет достижений'}
            </div>
        `;

        document.querySelectorAll('.profile-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moonId = btn.dataset.moon;
                toggleMoon(moonId);
            });
        });
        document.querySelectorAll('.profile-select-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const moonId = btn.dataset.moon;
                await selectMoon(moonId);
                updateProfileAndLeaders(true);
            });
        });
        document.querySelectorAll('.profile-upgrade-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const moonId = btn.dataset.moon;
                await upgradeMoon(moonId);
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
