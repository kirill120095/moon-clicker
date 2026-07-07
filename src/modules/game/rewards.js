// ============================================================
//  СИСТЕМА НАГРАД
// ============================================================
import { appState, state } from '../../core/state.js';
import { CONSTANTS, ACHIEVEMENTS, QUESTS } from '../../core/constants.js';

export class RewardSystem {
    constructor() {
        this._shardMultiplier = 1;
        this._xpMultiplier = 1;
    }

    // ============================================================
    //  РАСЧЕТ НАГРАД
    // ============================================================
    
    calculateShardReward(level, isBoss, shardBonus = 0) {
        let baseReward;
        
        if (isBoss) {
            baseReward = Math.floor(level / CONSTANTS.BOSS_INTERVAL) * 3 + 5;
        } else {
            baseReward = Math.floor(level / 5) + 1;
        }
        
        const bonusMultiplier = 1 + shardBonus + this._shardMultiplier - 1;
        return Math.floor(baseReward * bonusMultiplier);
    }

    calculateXP(level, isBoss) {
        let baseXP = level * 10;
        if (isBoss) {
            baseXP *= 3;
        }
        return Math.floor(baseXP * this._xpMultiplier);
    }

    // ============================================================
    //  ВЫДАЧА НАГРАД
    // ============================================================
    
    async grantShards(amount) {
        if (!state.playerData) return false;
        
        const newShards = (state.playerData.shards || 0) + amount;
        appState.set('playerData', { ...state.playerData, shards: newShards });
        
        // Обновляем квесты
        appState.updateQuestProgress('shard', amount);
        
        return true;
    }

    async grantAchievement(id) {
        const ach = ACHIEVEMENTS[id];
        if (!ach) return false;
        
        if (state.achievements[id]) {
            return false; // Уже получено
        }
        
        appState.unlockAchievement(id);
        
        // Награда за достижение
        if (ach.reward) {
            await this.grantShards(ach.reward);
        }
        
        return true;
    }

    async grantQuestReward(questId) {
        const quest = QUESTS[questId];
        if (!quest) return false;
        
        if (state.quests[questId]?.completed) {
            return false;
        }
        
        appState.updateQuestProgress(quest.type, quest.target);
        return true;
    }

    // ============================================================
    //  БОНУСЫ
    // ============================================================
    
    setShardMultiplier(multiplier) {
        this._shardMultiplier = Math.max(1, multiplier);
    }

    setXPMultiplier(multiplier) {
        this._xpMultiplier = Math.max(1, multiplier);
    }

    // ============================================================
    //  ПРОВЕРКА ДОСТИЖЕНИЙ
    // ============================================================
    
    checkAllAchievements() {
        const currentState = {
            ownedMoons: state.ownedMoons,
            currentLevel: state.currentLevel,
            bossKills: state.bossKills,
            clickCount: state.clickCount,
            moonLevels: state.moonLevels,
            maxSlots: state.maxSlots
        };
        
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            if (!state.achievements[id] && ach.check(currentState)) {
                this.grantAchievement(id);
            }
        }
    }

    // ============================================================
    //  ЕЖЕЧАСОВОЙ СБРОС КВЕСТОВ
    // ============================================================
    
    resetDailyQuests() {
        appState.resetQuests();
        return Object.keys(QUESTS).length;
    }
}
