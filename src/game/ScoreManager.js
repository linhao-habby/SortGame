/**
 * ScoreManager.js - 分数系统
 * 
 * 计算规则：
 *   基础分 = 订单要求数量 x BASE_PER_BLOCK
 *   超额分 = 超出数量 x OVERFLOW_PER_BLOCK
 *   combo倍率 = 1 + (combo - 1) x COMBO_STEP
 *   单次得分 = (基础分 + 超额分) x combo倍率
 * 
 * combo 规则（窗口机制）：
 *   每次交付 → combo++，移动计数器归零
 *   每次移动未交付 → 移动计数器+1
 *   移动计数器 >= COMBO_WINDOW → combo 重置
 */
(function() {
    'use strict';

    class ScoreManager {
        constructor() {
            this.score = 0;             // 总分
            this.combo = 0;             // 当前 combo 连击数
            this.maxCombo = 0;          // 历史最大 combo
            this.lastScoreGain = 0;     // 上一次得分（供 UI 显示）
            this.movesSinceDeliver = 0; // 上次交付后的移动次数
        }

        /**
         * 移动触发了交付 → 计算得分，combo++，重置移动计数
         */
        onDeliver(orderCount, deliveredCount) {
            const cfg = GameConfig.SCORE;

            this.movesSinceDeliver = 0;
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
         * 移动未触发交付 → 移动计数+1，超过窗口则 combo 重置
         */
        onNoDeliver() {
            this.movesSinceDeliver++;
            const window = (GameConfig.SCORE && GameConfig.SCORE.COMBO_WINDOW) || 3;
            if (this.movesSinceDeliver >= window && this.combo > 0) {
                console.log(`[Score] combo 重置: ${this.combo} (${this.movesSinceDeliver}次无交付)`);
                this.combo = 0;
                this.movesSinceDeliver = 0;
            }
        }

        /**
         * 获取 combo 进度条剩余比例 (0~1)
         * 1 = 刚交付，0 = 即将断连
         */
        getComboProgress() {
            if (this.combo === 0) return 0;
            const window = (GameConfig.SCORE && GameConfig.SCORE.COMBO_WINDOW) || 3;
            return Math.max(0, 1 - this.movesSinceDeliver / window);
        }

        reset() {
            this.score = 0;
            this.combo = 0;
            this.maxCombo = 0;
            this.lastScoreGain = 0;
            this.movesSinceDeliver = 0;
        }
    }

    window.ScoreManager = ScoreManager;
})();
