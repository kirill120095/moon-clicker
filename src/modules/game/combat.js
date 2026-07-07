// ============================================================
//  БОЕВАЯ СИСТЕМА
// ============================================================
import { appState, state } from '../../core/state.js';
import { CONSTANTS } from '../../core/constants.js';
import { updateUI } from '../ui/renderer.js';

export class CombatSystem {
    constructor() {
        this._bossTimerId = null;
    }

    // ============================================================
    //  БОСС-ТАЙМЕР
    // ============================================================
    
    startBossTimer() {
        if (state.bossTimerRunning) return;
        if (this._bossTimerId) {
            clearInterval(this._bossTimerId);
        }

        appState.set('bossTimer', CONSTANTS.BOSS_TIMER);
        appState.set('bossTimerRunning', true);
        this._updateTimerUI();

        this._bossTimerId = setInterval(() => {
            const newTimer = state.bossTimer - 1;
            appState.set('bossTimer', newTimer);
            this._updateTimerUI();

            if (newTimer <= 0) {
                this.clearBossTimer();
                // Восстанавливаем HP луны
                appState.set('moonHP', state.maxHP);
                updateUI();
            }
        }, CONSTANTS.INTERVALS.BOSS_TICK);

        appState.set('bossTimerInterval', this._bossTimerId);
    }

    clearBossTimer() {
        if (this._bossTimerId) {
            clearInterval(this._bossTimerId);
            this._bossTimerId = null;
        }
        appState.set('bossTimerRunning', false);
        appState.set('bossTimerInterval', null);
        
        // Скрываем UI таймера
        const container = document.getElementById('timerBarContainer');
        if (container) {
            container.classList.remove('active');
        }
        
        const bar = document.getElementById('timerBar');
        if (bar) {
            bar.style.width = '100%';
        }
        
        const percent = document.getElementById('timerPercent');
        if (percent) {
            percent.textContent = '0с';
        }
    }

    _updateTimerUI() {
        const percent = Math.max(0, (state.bossTimer / CONSTANTS.BOSS_TIMER) * 100);
        
        const bar = document.getElementById('timerBar');
        if (bar) {
            bar.style.width = percent + '%';
        }
        
        const percentEl = document.getElementById('timerPercent');
        if (percentEl) {
            percentEl.textContent = `${Math.ceil(state.bossTimer)}с`;
        }
        
        const container = document.getElementById('timerBarContainer');
        if (container) {
            container.classList.add('active');
        }
    }

    // ============================================================
    //  РАСЧЕТ УРОНА
    // ============================================================
    
    calculateDamage(baseDamage, bonuses = {}) {
        let damage = baseDamage;
        
        // Бонусы от лун
        if (bonuses.moonDamageBonus) {
            damage *= (1 + bonuses.moonDamageBonus);
        }
        
        // Бонусы от синергий
        if (bonuses.synergyBonus) {
            damage *= (1 + bonuses.synergyBonus);
        }
        
        // Критический удар
        const critChance = bonuses.critChance || 0.05;
        if (Math.random() < critChance) {
            damage *= 2;
            return { damage, isCrit: true };
        }
        
        return { damage, isCrit: false };
    }

    // ============================================================
    //  ПРОВЕРКА НА БОССА
    // ============================================================
    
    isBossLevel(level) {
        return level % CONSTANTS.BOSS_INTERVAL === 0;
    }

    getBossHP(level) {
        if (!this.isBossLevel(level)) return 0;
        return CONSTANTS.BASE_HP * level;
    }

    // ============================================================
    //  ОЧИСТКА
    // ============================================================
    
    destroy() {
        this.clearBossTimer();
    }
}
