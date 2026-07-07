// ============================================================
//  ОСНОВНАЯ ИГРОВАЯ ЛОГИКА
// ============================================================
import { appState, state } from '../../core/state.js';
import { CONSTANTS, MOON_TYPES, SYNERGY_BONUSES } from '../../core/constants.js';
import { getMaxHPForLevel, isBossLevel } from '../../core/config.js';
import { db } from '../../network/supabase.js';
import { showToast, updateUI } from '../ui/renderer.js';
import { updateShopUI } from '../ui/renderer.js';
import { updateProfileAndLeaders } from '../ui/renderer.js';
import { throttle } from '../../utils/security.js';
import { CombatSystem } from './combat.js';
import { RewardSystem } from './rewards.js';

// ============================================================
//  КЛАСС ИГРОВОГО ДВИЖКА
// ============================================================
export class GameEngine {
    constructor() {
        this.combat = new CombatSystem();
        this.rewards = new RewardSystem();
        this.isProcessing = false;
        this._lastSave = 0;
        this._saveInterval = CONSTANTS.INTERVALS.SAVE_TIME;
        
        // Подписка на изменения состояния
        this._unsubscribe = appState.subscribeMany(
            ['currentLevel', 'moonHP', 'maxHP', 'activeMoons', 'maxSlots'],
            () => this._onStateChange()
        );
    }

    // ============================================================
    //  ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    
    init() {
        const level = state.currentLevel;
        const newMax = getMaxHPForLevel(level, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
        appState.set('maxHP', newMax);
        
        if (state.moonHP > newMax) {
            appState.set('moonHP', newMax);
        }
        if (state.moonHP < 0) {
            appState.set('moonHP', 0);
        }

        // Запускаем таймеры
        this._startTimeTracking();
        this._startAutoSave();
        
        // Проверяем босса
        this._checkBoss();
        
        // Обновляем UI
        updateUI();
        updateShopUI();
        updateProfileAndLeaders();
        
        console.log('[Game] Инициализация завершена');
    }

    // ============================================================
    //  ОБРАБОТКА КЛИКА
    // ============================================================
    
    handleClick = throttle(async () => {
        if (this.isProcessing) return;
        if (!state.user) {
            showToast('⚠️ Войдите в аккаунт', 'warning');
            return;
        }
        if (state.moonHP <= 0) {
            return;
        }

        this.isProcessing = true;

        try {
            await this._processClick();
        } catch (error) {
            console.error('[Game] Ошибка клика:', error);
            showToast('⚠️ Ошибка обработки клика', 'warning');
        } finally {
            this.isProcessing = false;
        }
    }, CONSTANTS.UI.CLICK_COOLDOWN || 50);

    async _processClick() {
        // Расчет урона
        const baseDamage = state.playerData?.click_damage || 1;
        const bonus = window._totalDamageBonus || 0;
        const damage = baseDamage * (1 + bonus);

        // Обновление счетчиков
        appState.set('clickCount', state.clickCount + 1);
        appState.updateQuestProgress('click');

        // Нанесение урона
        if (state.testMode) {
            appState.set('moonHP', 0);
        } else {
            const newHP = Math.max(0, state.moonHP - damage);
            appState.set('moonHP', newHP);
        }

        // Визуальный эффект клика
        this._applyClickEffect();

        // Проверка на убийство
        if (state.moonHP === 0) {
            await this._onMoonDefeated();
            return;
        }

        // Сохранение прогресса
        await this._saveProgress();
        updateUI();
        updateProfileAndLeaders();
    }

    // ============================================================
    //  ОБРАБОТКА УБИЙСТВА ЛУНЫ
    // ============================================================
    
    async _onMoonDefeated() {
        if (state.levelLocked) {
            if (!state.testMode) {
                appState.set('moonHP', state.maxHP);
                updateUI();
            }
            return;
        }

        // Расчет награды
        const isBoss = isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL);
        const reward = this.rewards.calculateShardReward(
            state.currentLevel,
            isBoss,
            window._totalShardBonus || 0
        );

        // Начисление осколков
        const currentShards = (state.playerData?.shards || 0) + reward;
        appState.set('playerData', { ...state.playerData, shards: currentShards });
        
        // Обновление квестов
        appState.updateQuestProgress('shard', reward);
        
        if (isBoss) {
            appState.setBossKills(state.bossKills + 1);
            appState.updateQuestProgress('bossKill');
        }

        showToast(`💎 +${reward} лунных осколков!`, 'success', 2000);

        // Повышение уровня
        const newLevel = state.currentLevel + 1;
        appState.setCurrentLevel(newLevel);
        
        const newMax = getMaxHPForLevel(newLevel, CONSTANTS.BASE_HP, CONSTANTS.BOSS_INTERVAL);
        appState.set('maxHP', newMax);
        appState.set('moonHP', newMax);

        // Анимация повышения уровня
        this._applyLevelUpEffect();

        // Сохранение
        await this._saveProgress();
        updateUI();
        updateShopUI();
        updateProfileAndLeaders();
        
        // Проверка босса
        this._checkBoss();
    }

    // ============================================================
    //  БОСС-СИСТЕМА
    // ============================================================
    
    _checkBoss() {
        if (isBossLevel(state.currentLevel, CONSTANTS.BOSS_INTERVAL) && state.moonHP > 0) {
            this.combat.startBossTimer();
        } else {
            this.combat.clearBossTimer();
        }
    }

    // ============================================================
    //  РАСЧЕТ БОНУСОВ ЛУН
    // ============================================================
    
    recalcMoonBonuses() {
        let totalDamageBonus = 0;
        let totalShardBonus = 0;
        const activeSynergies = [];

        // Получаем активные луны с учетом слотов
        const effectiveActiveMoons = state.activeMoons.slice(0, state.maxSlots);
        const activeIds = effectiveActiveMoons;

        // Бонусы от каждой активной луны
        activeIds.forEach(id => {
            const moon = MOON_TYPES[id];
            if (moon) {
                const level = appState.getMoonLevel(id);
                const levelMultiplier = 1 + (level - 1) * 0.05;
                totalDamageBonus += (moon.damageBonus || 0) * levelMultiplier;
                totalShardBonus += (moon.shardBonus || 0) * levelMultiplier;
            }
        });

        // Синергии (только если > 1 активной луны и открыто > 1 слота)
        if (activeIds.length > 1 && state.maxSlots > 1) {
            const sortedActive = [...activeIds].sort();
            
            for (const [key, bonus] of Object.entries(SYNERGY_BONUSES)) {
                const moons = key.split('+').sort();
                if (moons.every(m => sortedActive.includes(m))) {
                    totalDamageBonus += bonus.damageBonus || 0;
                    totalShardBonus += bonus.shardBonus || 0;
                    activeSynergies.push({
                        name: bonus.name,
                        description: bonus.description,
                        key: key
                    });
                }
            }

            // Бонус для обычной луны
            if (sortedActive.includes('normal') && sortedActive.length > 1) {
                totalDamageBonus += 0.05;
                totalShardBonus += 0.05;
            }
        }

        // Сохраняем в глобальные переменные
        window._totalDamageBonus = totalDamageBonus;
        window._totalShardBonus = totalShardBonus;
        window._activeSynergies = activeSynergies;

        return { totalDamageBonus, totalShardBonus, activeSynergies };
    }

    // ============================================================
    //  СОХРАНЕНИЕ ПРОГРЕССА
    // ============================================================
    
    async _saveProgress() {
        const now = Date.now();
        if (now - this._lastSave < 1000) return; // Не чаще раза в секунду
        
        const user = state.user;
        if (!user) return;

        try {
            await db.updatePlayer(user.id, {
                total_clicks: state.clickCount,
                total_seconds_played: state.totalSecondsPlayed,
                level: state.currentLevel,
                moon_hp: Math.round(state.moonHP),
                shards: state.playerData?.shards || 0,
                updated_at: new Date().toISOString()
            });
            this._lastSave = now;
        } catch (error) {
            console.error('[Game] Ошибка сохранения:', error);
        }
    }

    // ============================================================
    //  ТАЙМЕРЫ
    // ============================================================
    
    _startTimeTracking() {
        if (state.timeUpdateInterval) {
            clearInterval(state.timeUpdateInterval);
        }
        
        const interval = setInterval(() => {
            appState.set('totalSecondsPlayed', state.totalSecondsPlayed + 1);
        }, 1000);
        
        appState.set('timeUpdateInterval', interval);
    }

    _startAutoSave() {
        if (state.autoSaveInterval) {
            clearInterval(state.autoSaveInterval);
        }
        
        const interval = setInterval(() => {
            this._saveProgress();
        }, this._saveInterval);
        
        appState.set('autoSaveInterval', interval);
    }

    // ============================================================
    //  ВИЗУАЛЬНЫЕ ЭФФЕКТЫ
    // ============================================================
    
    _applyClickEffect() {
        const effect = document.getElementById('clickEffect');
        if (effect) {
            effect.classList.remove('active');
            void effect.offsetWidth;
            effect.classList.add('active');
        }
        
        const wrapper = document.getElementById('moonWrapper');
        if (wrapper) {
            wrapper.style.transform = 'scale(0.92)';
            setTimeout(() => {
                wrapper.style.transform = 'scale(1)';
            }, 150);
        }
    }

    _applyLevelUpEffect() {
        const inner = document.getElementById('moonInner');
        if (inner) {
            inner.classList.add('level-up');
            setTimeout(() => {
                inner.classList.remove('level-up');
            }, 800);
        }
    }

    // ============================================================
    //  ОБРАБОТЧИКИ СОБЫТИЙ
    // ============================================================
    
    _onStateChange() {
        // Обновляем UI при изменении состояния
        updateUI();
    }

    // ============================================================
    //  ОЧИСТКА
    // ============================================================
    
    destroy() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        
        if (state.timeUpdateInterval) {
            clearInterval(state.timeUpdateInterval);
            appState.set('timeUpdateInterval', null);
        }
        
        if (state.autoSaveInterval) {
            clearInterval(state.autoSaveInterval);
            appState.set('autoSaveInterval', null);
        }
        
        this.combat.clearBossTimer();
        console.log('[Game] Движок уничтожен');
    }
}

// ============================================================
//  ЭКСПОРТ ЕДИНСТВЕННОГО ЭКЗЕМПЛЯРА
// ============================================================
export const gameEngine = new GameEngine();
