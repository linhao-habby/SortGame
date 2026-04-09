/**
 * OrderManager.js - 订单管理器
 * 生成 2 个订单，总色块数 = 普通木槽数量（守恒）
 * 严格保证每个订单的需求数量 <= 该颜色在棋盘上的实际总数
 */
(function() {
    'use strict';

    class OrderManager {
        constructor() {
            this._lastColors = []; // 上一轮订单的颜色，避免重复
        }

        /**
         * 生成 2 个订单，总数 = normalSlotCount
         * 核心约束：每个订单的 count <= 该颜色在棋盘上的实际数量
         *
         * 算法流程：
         * 1. 分析棋盘上每种颜色的实际数量和可达性
         * 2. 筛选出数量 >= 1 的可用颜色对 (C1, C2)
         * 3. 在满足"两个需求都不超过各自颜色实际数量"的前提下分配数量
         * 4. 同时满足守恒约束 count1 + count2 = normalSlotCount
         *
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

            // 找出所有可行的颜色对及其数量分配
            const pair = this._pickColorPair(colorStats, totalCount);

            this._lastColors = [pair.color1, pair.color2];

            return [
                { color: pair.color1, count: pair.count1, status: 'active' },
                { color: pair.color2, count: pair.count2, status: 'active' },
            ];
        }

        /**
         * 选择一对颜色并分配数量
         * 严格保证：count1 <= color1总数, count2 <= color2总数, count1+count2 = totalCount
         */
        _pickColorPair(colorStats, totalCount) {
            // 收集所有可行的颜色对 (i, j)，满足：
            // colorStats[i].totalCount + colorStats[j].totalCount >= totalCount
            // 且两者颜色不同
            const feasiblePairs = [];

            for (let i = 0; i < colorStats.length; i++) {
                for (let j = i + 1; j < colorStats.length; j++) {
                    const si = colorStats[i];
                    const sj = colorStats[j];
                    // 两种颜色的总数之和必须 >= totalCount，才能满足守恒
                    if (si.totalCount + sj.totalCount >= totalCount &&
                        si.totalCount >= 1 && sj.totalCount >= 1) {
                        feasiblePairs.push({ si, sj });
                    }
                }
            }

            if (feasiblePairs.length > 0) {
                // 对每对计算权重，选择一对
                const pair = this._weightedPickPair(feasiblePairs, totalCount);
                return pair;
            }

            // 兜底：如果没有任何可行颜色对（极端情况，如棋盘几乎为空）
            // 放宽约束，选数量最多的两种颜色，count 取 min(需求, 实际数量)
            return this._fallbackPick(colorStats, totalCount);
        }

        /**
         * 带权重地从可行颜色对中选择一对，并分配数量
         */
        _weightedPickPair(feasiblePairs, totalCount) {
            const scored = [];

            for (const { si, sj } of feasiblePairs) {
                // 计算可达性权重
                const w1 = this._colorWeight(si);
                const w2 = this._colorWeight(sj);
                let pairWeight = w1 + w2;

                // 惩罚上一轮使用过的颜色
                if (this._lastColors.includes(si.color)) pairWeight *= 0.4;
                if (this._lastColors.includes(sj.color)) pairWeight *= 0.4;

                scored.push({ si, sj, weight: Math.max(0.1, pairWeight) });
            }

            // 带权重随机选一对
            let totalWeight = 0;
            for (const s of scored) totalWeight += s.weight;

            let rand = Math.random() * totalWeight;
            let chosen = scored[scored.length - 1];
            for (const s of scored) {
                rand -= s.weight;
                if (rand <= 0) { chosen = s; break; }
            }

            // 为选中的颜色对分配数量
            return this._allocateCounts(chosen.si, chosen.sj, totalCount);
        }

        /**
         * 计算单个颜色的可达性权重
         */
        _colorWeight(stat) {
            let w = 1;
            if (stat.maxConsecutiveTop >= 3) w += 8;
            else if (stat.maxConsecutiveTop >= 2) w += 4;
            else if (stat.maxConsecutiveTop >= 1) w += 2;
            if (stat.totalCount >= 5) w += 3;
            else if (stat.totalCount >= 3) w += 1;
            if (stat.topPresence >= 2) w += 2;
            return w;
        }

        /**
         * 为两种颜色分配需求数量
         * 约束：count1 + count2 = totalCount, count1 <= s1.totalCount, count2 <= s2.totalCount
         * 在约束范围内偏向均匀分配（25%~75%）
         */
        _allocateCounts(s1, s2, totalCount) {
            // count1 的合法范围：
            // count1 >= totalCount - s2.totalCount （因为 count2 = totalCount - count1 <= s2.totalCount）
            // count1 <= s1.totalCount              （count1 不能超过 color1 的实际数量）
            // count1 >= 1, count2 >= 1 => count1 <= totalCount - 1
            const minCount1 = Math.max(1, totalCount - s2.totalCount);
            const maxCount1 = Math.min(s1.totalCount, totalCount - 1);

            // 在合法范围内偏向均匀分配
            const idealMin = Math.max(minCount1, Math.floor(totalCount * 0.25));
            const idealMax = Math.min(maxCount1, Math.ceil(totalCount * 0.75));

            let count1;
            if (idealMin <= idealMax) {
                // 理想范围可用，在其中随机
                count1 = idealMin + Math.floor(Math.random() * (idealMax - idealMin + 1));
            } else {
                // 理想范围不可用，用合法范围
                count1 = minCount1 + Math.floor(Math.random() * (maxCount1 - minCount1 + 1));
            }

            const count2 = totalCount - count1;

            // 随机决定哪种颜色作为订单1，增加变化
            if (Math.random() < 0.5) {
                return { color1: s1.color, count1, color2: s2.color, count2 };
            } else {
                return { color1: s2.color, count1: count2, color2: s1.color, count2: count1 };
            }
        }

        /**
         * 兜底选择：棋盘色块极少时的处理
         * 选数量最多的两种颜色，count 取 min(需求, 实际数量)
         */
        _fallbackPick(colorStats, totalCount) {
            // 按数量排序，取前2种
            const sorted = [...colorStats].sort((a, b) => b.totalCount - a.totalCount);

            let s1 = sorted[0];
            let s2 = sorted.length > 1 ? sorted[1] : null;

            // 只有一种颜色（或没有颜色），极端退化
            if (!s2 || s2.totalCount === 0) {
                const count = Math.min(totalCount - 1, s1 ? s1.totalCount : 1);
                const c1 = s1 ? s1.color : 0;
                const c2 = (c1 + 1) % Math.max(colorStats.length, 2);
                return {
                    color1: c1,
                    count1: Math.max(1, count),
                    color2: c2,
                    count2: Math.max(1, totalCount - Math.max(1, count)),
                };
            }

            // 尽量满足守恒，但不超过实际数量
            const maxAvailable = s1.totalCount + s2.totalCount;
            if (maxAvailable >= totalCount) {
                return this._allocateCounts(s1, s2, totalCount);
            }

            // 实在不够（棋盘上色块总数 < totalCount），按比例分配
            const ratio = s1.totalCount / maxAvailable;
            const count1 = Math.max(1, Math.min(s1.totalCount, Math.round(totalCount * ratio)));
            const count2 = Math.max(1, totalCount - count1);

            return {
                color1: s1.color,
                count1,
                color2: s2.color,
                count2,
            };
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
