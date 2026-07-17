// ============================================================
//  БОЕВАЯ СИСТЕМА
// ============================================================
import { appState, state } from './state.js';
import { CONSTANTS } from './constants.js';
import { updateUI } from './renderer.js';

export class CombatSystem {
    constructor() {
        this._bossTimerId = null;
        this._onTimeout = null;
    }

    startBossTimer(onTimeout = null) {
        if (state.bossTimerRunning) return;
        if (this._bossTimerId) {
            clearInterval(this._bossTimerId);
        }

        this._onTimeout = onTimeout;
        appState.set('bossTimer', CONSTANTS.BOSS_TIMER);
        appState.set('bossTimerRunning', true);
        this._updateTimerUI();

        this._bossTimerId = setInterval(() => {
            const newTimer = state.bossTimer - 1;
            appState.set('bossTimer', newTimer);
            this._updateTimerUI();

            if (newTimer <= 0) {
                this.clearBossTimer();
                if (typeof this._onTimeout === 'function') {
                    this._onTimeout();
                }
            }
        }, CONSTANTS.INTERVALS.BOSS_TICK);

        appState.set('bossTimerInterval', this._bossTimerId);
    }

    clearBossTimer() {
        if (this._bossTimerId) {
            clearInterval(this._bossTimerId);
            this._bossTimerId = null;
        }
        this._onTimeout = null;
        appState.set('bossTimerRunning', false);
        appState.set('bossTimerInterval', null);
        
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
            percent.textContent = '30с';
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

    calculateDamage(baseDamage, bonuses = {}) {
        let damage = baseDamage;
        
        if (bonuses.moonDamageBonus) {
            damage *= (1 + bonuses.moonDamageBonus);
        }
        
        if (bonuses.synergyBonus) {
            damage *= (1 + bonuses.synergyBonus);
        }
        
        const critChance = bonuses.critChance || 0.05;
        if (Math.random() < critChance) {
            damage *= 2;
            return { damage: Math.floor(damage), isCrit: true };
        }
        
        return { damage: Math.floor(damage), isCrit: false };
    }

    isBossLevel(level) {
        return level % CONSTANTS.BOSS_INTERVAL === 0;
    }

    getBossHP(level) {
        if (!this.isBossLevel(level)) return 0;
        return CONSTANTS.BASE_HP * level;
    }

    destroy() {
        this.clearBossTimer();
    }
}
