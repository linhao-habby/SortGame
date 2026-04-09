/**
 * ScoreManager.js - 分数系统
 * 
 * 计算规则：
 *   基础分 = 订单要求数量 x BASE_PER_BLOCK
 *   超额分 = 超出数量 x OVERFLOW_PER_BLOCK
 *   combo倍率 = 1 + (combo - 1) x COMBO_STEP
 *   单次得分 = (基础分 + 超额分) x combo倍率
 * 
 * combo 规则：
 *   每次移动触发交付 → combo++
 *   移动未触发交付 → combo 重置为 0
 */
(function() {
    'use strict';

    class ScoreManager {
        constructor() {
            this.score = 0;         // 总分
            this.combo = 0;         // 当前 combo 连击数
            this.maxCombo = 0;      // 历史最大 combo
            this.lastScoreGain = 0; // 上一次得分（供 UI 显示）
        }

        /**
         * 移动触发了交付 → 计算得分，combo++
         * @param {number} orderCount - 订单要求数量
         * @param {number} deliveredCount - 实际消除数量（>= orderCount）
         * @returns {{ gain: number, base: number, overflow: number, combo: number, multiplier: number }}
         */
        onDeliver(orderCount, deliveredCount) {
            const cfg = GameConfig.SCORE;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            const base = orderCount * cfg.BASE_PER_BLOCK;
            const overflowBlocks = Math.max(0, deliveredCount - orderCount);
            const overflow = overflowBlocks * cfg.OVERFLOW_PER_BLOCK;
            const multiplier = 1 + (this.combo - 1) * cfg.COMBO_STEP;
            const gain = Math.round((base + overflow) * multiplier);

            this.score += gain;
            this.lastScoreGain = gain;

            console.log(`[Score] +${gain} (基础${base} + 超额${overflow}) x${multiplier.toFixed(1)} combo=${this.combo}`);

            return { gain, base, overflow, combo: this.combo, multiplier };
        }

        /**
         * 移动未触发交付 → combo 重置
         */
        onNoDeliver() {
            if (this.combo > 0) {
                console.log(`[Score] combo 重置 (was ${this.combo})`);
            }
            this.combo = 0;
        }

        reset() {
            this.score = 0;
            this.combo = 0;
            this.maxCombo = 0;
            this.lastScoreGain = 0;
        }
    }

    window.ScoreManager = ScoreManager;
})();
