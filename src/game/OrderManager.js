/**
 * OrderManager.js - 订单管理器
 * 生成 2 个订单，总色块数 = 普通木槽数量（守恒）
 */
(function() {
    'use strict';

    class OrderManager {
        constructor() {
            this._lastColors = []; // 上一轮订单的颜色，避免重复
        }

        /**
         * 生成 2 个订单，总数 = normalSlotCount
         * @param {Slot[]} slots
         * @param {number} completedOrders
         * @param {DifficultyManager} difficultyManager
         * @param {number} normalSlotCount - 普通木槽数量
         * @returns {{ color: number, count: number, status: string }[]}
         */
        generateOrders(slots, completedOrders, difficultyManager, normalSlotCount) {
            const params = difficultyManager.getParams(completedOrders);
            const availableColorCount = params.colorCount;
            const totalCount = normalSlotCount; // 2 个订单总数 = 普通槽数

            // 分析棋盘
            const colorStats = this._analyzeBoard(slots, availableColorCount);

            // 拆分 totalCount 为 2 部分（每个至少 1）
            const count1 = this._randomSplit(totalCount);
            const count2 = totalCount - count1;

            // 选 2 种不同的颜色（尽量可达性高）
            const color1 = this._pickColor(colorStats, count1, []);
            const color2 = this._pickColor(colorStats, count2, [color1]);

            this._lastColors = [color1, color2];

            return [
                { color: color1, count: count1, status: 'active' },
                { color: color2, count: count2, status: 'active' },
            ];
        }

        /**
         * 将 total 随机分成 2 部分，每部分至少 1，且不要太极端
         */
        _randomSplit(total) {
            if (total <= 2) return 1;
            // 范围：[1, total-1]，偏向均匀
            const min = Math.max(1, Math.floor(total * 0.25));
            const max = Math.min(total - 1, Math.ceil(total * 0.75));
            return min + Math.floor(Math.random() * (max - min + 1));
        }

        /**
         * 从候选颜色中选一个（带权重，避免 excludeColors 中的颜色）
         */
        _pickColor(colorStats, requiredCount, excludeColors) {
            // 筛选：总数 >= requiredCount 且不在排除列表
            let candidates = colorStats.filter(s =>
                s.totalCount >= requiredCount && !excludeColors.includes(s.color)
            );

            // 放宽：如果没有候选，降低数量要求
            if (candidates.length === 0) {
                candidates = colorStats.filter(s =>
                    s.totalCount >= 1 && !excludeColors.includes(s.color)
                );
            }

            // 兜底：任意颜色
            if (candidates.length === 0) {
                candidates = colorStats.filter(s => !excludeColors.includes(s.color));
            }
            if (candidates.length === 0) {
                candidates = colorStats;
            }

            // 带权重随机
            let totalWeight = 0;
            const weights = [];
            for (const c of candidates) {
                let w = 1;
                if (c.maxConsecutiveTop >= requiredCount) w += 8;
                else if (c.maxConsecutiveTop >= 2) w += 4;
                else if (c.maxConsecutiveTop >= 1) w += 2;
                if (c.totalCount >= requiredCount * 1.5) w += 3;
                if (c.topPresence >= 2) w += 2;
                // 避免上一轮颜色
                if (this._lastColors.includes(c.color)) w = Math.max(1, Math.floor(w * 0.3));
                weights.push(w);
                totalWeight += w;
            }

            let rand = Math.random() * totalWeight;
            for (let i = 0; i < candidates.length; i++) {
                rand -= weights[i];
                if (rand <= 0) return candidates[i].color;
            }
            return candidates[candidates.length - 1].color;
        }

        _analyzeBoard(slots, availableColorCount) {
            const stats = [];
            for (let c = 0; c < availableColorCount; c++) {
                let totalCount = 0, maxConsecutiveTop = 0, slotsWithColor = 0, topPresence = 0;
                for (const slot of slots) {
                    if (slot.isEmpty()) continue;
                    let has = false;
                    for (const b of slot.blocks) {
                        if (b.color === c) { totalCount++; has = true; }
                    }
                    if (has) slotsWithColor++;
                    if (slot.topConsecutiveColor() === c) {
                        maxConsecutiveTop = Math.max(maxConsecutiveTop, slot.topConsecutiveCount());
                        topPresence++;
                    }
                }
                stats.push({ color: c, totalCount, maxConsecutiveTop, slotsWithColor, topPresence });
            }
            return stats;
        }

        reset() {
            this._lastColors = [];
        }
    }

    window.OrderManager = OrderManager;
})();
