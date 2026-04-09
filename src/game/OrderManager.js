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
         * @param {Slot[]} slots
         * @param {number} completedOrders
         * @param {DifficultyManager} difficultyManager
         * @param {number} normalSlotCount - 普通木槽数量
         * @returns {{ color: number, count: number, status: string }[]}
         */
        generateOrders(slots, completedOrders, difficultyManager, normalSlotCount) {
            const totalCount = normalSlotCount; // 2 个订单总数 = 普通槽数

            // 直接扫描棋盘上所有实际存在的颜色（不依赖 colorCount 参数）
            const colorStats = this._analyzeBoard(slots);

            // 找出所有可行的颜色对及其数量分配
            const pair = this._pickColorPair(colorStats, totalCount);

            this._lastColors = [pair.color1, pair.color2];

            // 最终安全校验：确保 count 不超过实际数量
            const statsMap = {};
            for (const s of colorStats) statsMap[s.color] = s.totalCount;
            const actual1 = statsMap[pair.color1] || 0;
            const actual2 = statsMap[pair.color2] || 0;
            if (pair.count1 > actual1 || pair.count2 > actual2) {
                console.warn(`[OrderManager] 安全校验触发: 订单1=${pair.count1}(实际${actual1}), 订单2=${pair.count2}(实际${actual2}), 执行修正`);
                pair.count1 = Math.min(pair.count1, actual1);
                pair.count2 = Math.min(pair.count2, actual2);
                // 尝试补足总数
                const deficit = totalCount - pair.count1 - pair.count2;
                if (deficit > 0) {
                    const slack1 = actual1 - pair.count1;
                    const slack2 = actual2 - pair.count2;
                    const add1 = Math.min(deficit, slack1);
                    pair.count1 += add1;
                    pair.count2 += Math.min(deficit - add1, slack2);
                }
            }

            console.log(`[OrderManager] 生成订单: C${pair.color1}x${pair.count1}(棋盘${actual1}), C${pair.color2}x${pair.count2}(棋盘${actual2}), 总需=${pair.count1+pair.count2}, 目标=${totalCount}`);

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
            // 只考虑棋盘上实际存在的颜色（totalCount >= 1）
            const available = colorStats.filter(s => s.totalCount >= 1);

            // 收集所有可行的颜色对 (i, j)，满足：
            // si.totalCount + sj.totalCount >= totalCount
            const feasiblePairs = [];
            for (let i = 0; i < available.length; i++) {
                for (let j = i + 1; j < available.length; j++) {
                    const si = available[i];
                    const sj = available[j];
                    if (si.totalCount + sj.totalCount >= totalCount) {
                        feasiblePairs.push({ si, sj });
                    }
                }
            }

            if (feasiblePairs.length > 0) {
                return this._weightedPickPair(feasiblePairs, totalCount);
            }

            // 没有可行颜色对，走兜底
            return this._fallbackPick(available, totalCount);
        }

        /**
         * 带权重地从可行颜色对中选择一对，并分配数量
         */
        _weightedPickPair(feasiblePairs, totalCount) {
            const scored = [];

            for (const { si, sj } of feasiblePairs) {
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
         * 前置条件：s1.totalCount + s2.totalCount >= totalCount（由调用者保证）
         */
        _allocateCounts(s1, s2, totalCount) {
            // count1 的合法范围：
            // count1 >= max(1, totalCount - s2.totalCount)  因为 count2 <= s2.totalCount
            // count1 <= min(s1.totalCount, totalCount - 1)  因为 count1 <= s1实际 且 count2 >= 1
            const minCount1 = Math.max(1, totalCount - s2.totalCount);
            const maxCount1 = Math.min(s1.totalCount, totalCount - 1);

            // 防御：如果范围无效（不应该发生，但以防万一）
            if (minCount1 > maxCount1) {
                console.warn(`[OrderManager] _allocateCounts 范围无效: min=${minCount1}, max=${maxCount1}, s1=${s1.totalCount}, s2=${s2.totalCount}, total=${totalCount}`);
                const c1 = Math.min(s1.totalCount, totalCount - 1);
                const c2 = totalCount - c1;
                return this._makeResult(s1.color, Math.max(1, c1), s2.color, Math.max(1, c2));
            }

            // 在合法范围内偏向均匀分配
            const idealMin = Math.max(minCount1, Math.floor(totalCount * 0.25));
            const idealMax = Math.min(maxCount1, Math.ceil(totalCount * 0.75));

            let count1;
            if (idealMin <= idealMax) {
                count1 = idealMin + Math.floor(Math.random() * (idealMax - idealMin + 1));
            } else {
                count1 = minCount1 + Math.floor(Math.random() * (maxCount1 - minCount1 + 1));
            }

            const count2 = totalCount - count1;
            return this._makeResult(s1.color, count1, s2.color, count2);
        }

        /**
         * 构造结果，随机交换订单1和订单2的位置
         */
        _makeResult(colorA, countA, colorB, countB) {
            if (Math.random() < 0.5) {
                return { color1: colorA, count1: countA, color2: colorB, count2: countB };
            } else {
                return { color1: colorB, count1: countB, color2: colorA, count2: countA };
            }
        }

        /**
         * 兜底选择：没有任何颜色对的总数 >= totalCount 时
         * 选数量最多的两种颜色，各自 count 不超过实际数量
         */
        _fallbackPick(available, totalCount) {
            // 按数量降序排列
            const sorted = [...available].sort((a, b) => b.totalCount - a.totalCount);

            if (sorted.length === 0) {
                // 棋盘完全空（理论上不应发生）
                console.warn('[OrderManager] 棋盘完全空，无法生成有效订单');
                return { color1: 0, count1: 1, color2: 1, count2: Math.max(1, totalCount - 1) };
            }

            if (sorted.length === 1) {
                // 只有一种颜色
                const s = sorted[0];
                const c1 = Math.max(1, Math.min(s.totalCount, totalCount - 1));
                const c2Color = (s.color + 1) % 12;
                return { color1: s.color, count1: c1, color2: c2Color, count2: Math.max(1, totalCount - c1) };
            }

            const s1 = sorted[0];
            const s2 = sorted[1];
            const maxAvailable = s1.totalCount + s2.totalCount;

            if (maxAvailable >= totalCount) {
                // 两种颜色加起来够了，正常分配
                return this._allocateCounts(s1, s2, totalCount);
            }

            // 两种颜色加起来都不够 totalCount（非常极端）
            // 每个订单的 count 严格限制在实际数量内
            console.warn(`[OrderManager] 兜底: 两种最多的颜色总数(${maxAvailable}) < 需求(${totalCount})`);
            return this._makeResult(s1.color, s1.totalCount, s2.color, s2.totalCount);
        }

        /**
         * 扫描棋盘上所有实际存在的颜色及其统计信息
         * 不依赖 colorCount 参数，直接遍历所有色块
         */
        _analyzeBoard(slots) {
            const colorMap = {}; // color -> { totalCount, maxConsecutiveTop, slotsWithColor, topPresence }

            for (const slot of slots) {
                if (slot.isEmpty()) continue;

                // 统计这个槽中每种颜色的出现情况
                const colorsInSlot = new Set();
                for (const b of slot.blocks) {
                    if (!colorMap[b.color]) {
                        colorMap[b.color] = { color: b.color, totalCount: 0, maxConsecutiveTop: 0, slotsWithColor: 0, topPresence: 0 };
                    }
                    colorMap[b.color].totalCount++;
                    colorsInSlot.add(b.color);
                }

                // 更新 slotsWithColor
                for (const c of colorsInSlot) {
                    colorMap[c].slotsWithColor++;
                }

                // 更新栈顶信息
                const topColor = slot.topConsecutiveColor();
                if (topColor !== null && topColor !== undefined && colorMap[topColor]) {
                    const topCount = slot.topConsecutiveCount();
                    colorMap[topColor].maxConsecutiveTop = Math.max(colorMap[topColor].maxConsecutiveTop, topCount);
                    colorMap[topColor].topPresence++;
                }
            }

            return Object.values(colorMap);
        }

        reset() {
            this._lastColors = [];
        }
    }

    window.OrderManager = OrderManager;
})();
