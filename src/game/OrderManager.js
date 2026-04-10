/**
 * OrderManager.js - 订单管理器
 * 生成 1~3 个订单，每个订单需求 <= 该颜色在棋盘上的实际总数
 * 取走总数 = 普通槽数 S - (orderNum - 1)
 */
(function() {
    'use strict';

    class OrderManager {
        constructor() {
            this._lastColors = []; // 上一轮订单的颜色，避免重复
        }

        /**
         * 生成 orderNum 个订单
         * 取走总数 = normalSlotCount - (orderNum - 1)
         * 核心约束：每个订单的 count <= 该颜色在棋盘上的实际数量
         *           每个订单的 count 在 orderRange[min, max] 范围内
         *
         * @param {Slot[]} slots
         * @param {number} completedOrders
         * @param {DifficultyManager} difficultyManager
         * @param {number} normalSlotCount - 普通木槽数量
         * @param {number} orderNum - 订单数量（1~3）
         * @param {number[]} [orderRange] - 每单需求范围 [min, max]，如 [3, 4]
         * @returns {{ color: number, count: number, status: string }[]}
         */
        generateOrders(slots, completedOrders, difficultyManager, normalSlotCount, orderNum, orderRange) {
            orderNum = Math.max(1, Math.min(3, orderNum || 1));
            const totalCount = Math.max(orderNum, normalSlotCount - (orderNum - 1));

            // 每单需求上下限
            const minPerOrder = (orderRange && orderRange[0]) || 1;
            const maxPerOrder = (orderRange && orderRange[1]) || 99;

            // 获取槽容量上限（单个订单的 count 不能超过容量，否则不可能在一个槽里凑齐）
            const maxCapacity = slots.length > 0 ? Math.max(...slots.map(s => s.capacity)) : 5;

            // 每单实际上限 = min(maxPerOrder, maxCapacity)
            const effectiveMax = Math.min(maxPerOrder, maxCapacity);

            // 扫描棋盘上所有实际存在的颜色
            const colorStats = this._analyzeBoard(slots);

            // 选择 orderNum 种不同颜色并分配数量
            const assignments = this._pickColors(colorStats, totalCount, orderNum, effectiveMax, minPerOrder);

            // 安全校验
            const statsMap = {};
            for (const s of colorStats) statsMap[s.color] = s.totalCount;
            let logParts = [];
            for (const a of assignments) {
                const actual = statsMap[a.color] || 0;
                if (a.count > actual) {
                    console.warn(`[OrderManager] 安全校验(数量): C${a.color} 需${a.count} 实际${actual}, 修正`);
                    a.count = actual;
                }
                if (a.count > effectiveMax) {
                    console.warn(`[OrderManager] 安全校验(上限): C${a.color} 需${a.count} 上限${effectiveMax}, 修正`);
                    a.count = effectiveMax;
                }
                if (a.count < minPerOrder && actual >= minPerOrder) {
                    a.count = minPerOrder;
                }
                logParts.push(`C${a.color}x${a.count}(棋盘${actual})`);
            }

            const totalAssigned = assignments.reduce((s, a) => s + a.count, 0);
            console.log(`[OrderManager] 生成${orderNum}个订单: ${logParts.join(', ')}, 总需=${totalAssigned}, 目标=${totalCount}`);

            this._lastColors = assignments.map(a => a.color);

            return assignments.map(a => ({
                color: a.color,
                count: a.count,
                status: 'active',
            }));
        }

        /**
         * 选择 orderNum 种颜色并分配数量
         * @param {object[]} colorStats - 棋盘颜色统计
         * @param {number} totalCount - 取走总数
         * @param {number} orderNum - 订单数量
         * @param {number} maxPerOrder - 每单最大需求
         * @param {number} minPerOrder - 每单最小需求
         * @returns {{ color: number, count: number }[]}
         */
        _pickColors(colorStats, totalCount, orderNum, maxPerOrder, minPerOrder) {
            const available = colorStats.filter(s => s.totalCount >= Math.max(1, minPerOrder));

            // 如果没有满足 minPerOrder 的颜色，降级到所有可用颜色
            const fallbackAvailable = available.length >= orderNum ? available : colorStats.filter(s => s.totalCount >= 1);

            if (orderNum === 1) {
                return this._pickSingleOrder(fallbackAvailable, totalCount, maxPerOrder, minPerOrder);
            }

            // 多订单：贪心选颜色，然后分配数量
            const weighted = fallbackAvailable.map(s => ({
                stat: s,
                weight: this._colorWeight(s) * (this._lastColors.includes(s.color) ? 0.4 : 1),
            })).sort((a, b) => b.weight - a.weight);

            // 选 orderNum 种不同颜色
            const chosen = [];
            for (const w of weighted) {
                if (chosen.length >= orderNum) break;
                chosen.push(w.stat);
            }

            // 不够 orderNum 种颜色，用所有可用的
            while (chosen.length < orderNum && chosen.length < fallbackAvailable.length) {
                const next = fallbackAvailable.find(s => !chosen.includes(s));
                if (next) chosen.push(next);
                else break;
            }

            // 极端：可用颜色不足 orderNum 种
            if (chosen.length < orderNum) {
                return this._fallbackMulti(fallbackAvailable, totalCount, orderNum, maxPerOrder, minPerOrder);
            }

            // 分配数量
            return this._allocateMulti(chosen, totalCount, orderNum, maxPerOrder, minPerOrder);
        }

        /**
         * 单订单：选一种颜色
         * count 在 [minPerOrder, maxPerOrder] 范围内，且不超过棋盘实际数量
         */
        _pickSingleOrder(available, totalCount, maxPerOrder, minPerOrder) {
            const targetCount = Math.min(totalCount, maxPerOrder);
            let candidates = available.filter(s => s.totalCount >= targetCount);
            if (candidates.length === 0) {
                // 没有颜色能满足目标数量，选数量最多的
                candidates = [...available].sort((a, b) => b.totalCount - a.totalCount);
            }

            const chosen = this._weightedPickOne(candidates);
            let count = Math.min(chosen.totalCount, targetCount);
            count = Math.max(count, Math.min(minPerOrder, chosen.totalCount)); // 不低于 min（但不超过实际数量）
            return [{ color: chosen.color, count }];
        }

        /**
         * 多订单数量分配
         * 约束：每个 count 在 [minPerOrder, min(颜色实际数量, maxPerOrder)] 范围内
         *       总和尽量 = totalCount
         */
        _allocateMulti(chosen, totalCount, orderNum, maxPerOrder, minPerOrder) {
            const result = chosen.map(s => ({
                color: s.color,
                count: Math.min(minPerOrder, s.totalCount), // 从 min 开始
                max: Math.min(s.totalCount, maxPerOrder),
            }));
            let remaining = totalCount - result.reduce((s, r) => s + r.count, 0);

            // 随机打乱分配顺序增加变化
            const indices = Array.from({ length: result.length }, (_, i) => i);
            this._shuffleArray(indices);

            // 轮流分配剩余数量
            let rounds = 0;
            while (remaining > 0 && rounds < 100) {
                rounds++;
                let distributed = false;
                for (const i of indices) {
                    if (remaining <= 0) break;
                    if (result[i].count < result[i].max) {
                        result[i].count++;
                        remaining--;
                        distributed = true;
                    }
                }
                if (!distributed) break;
            }

            return result.map(r => ({ color: r.color, count: r.count }));
        }

        /**
         * 兜底：可用颜色不足 orderNum 种
         */
        _fallbackMulti(available, totalCount, orderNum, maxPerOrder, minPerOrder) {
            const sorted = [...available].sort((a, b) => b.totalCount - a.totalCount);
            const actualNum = Math.min(sorted.length, orderNum);

            if (actualNum === 0) {
                const result = [];
                for (let i = 0; i < orderNum; i++) {
                    const count = Math.min(Math.max(minPerOrder, Math.floor(totalCount / orderNum)), maxPerOrder);
                    result.push({ color: i, count });
                }
                return result;
            }

            const chosen = sorted.slice(0, actualNum);
            const result = this._allocateMulti(chosen, Math.min(totalCount, chosen.reduce((s, c) => s + c.totalCount, 0)), actualNum, maxPerOrder, minPerOrder);

            // 如果实际选出的颜色 < orderNum，补足空订单
            while (result.length < orderNum) {
                const usedColors = result.map(r => r.color);
                const nextColor = (usedColors[usedColors.length - 1] + 1) % 12;
                result.push({ color: nextColor, count: minPerOrder });
            }

            return result;
        }

        /**
         * 带权重随机选一个颜色
         */
        _weightedPickOne(candidates) {
            if (candidates.length === 0) return { color: 0, totalCount: 0 };
            if (candidates.length === 1) return candidates[0];

            let totalWeight = 0;
            const weights = candidates.map(c => {
                let w = this._colorWeight(c);
                if (this._lastColors.includes(c.color)) w *= 0.4;
                w = Math.max(0.1, w);
                totalWeight += w;
                return w;
            });

            let rand = Math.random() * totalWeight;
            for (let i = 0; i < candidates.length; i++) {
                rand -= weights[i];
                if (rand <= 0) return candidates[i];
            }
            return candidates[candidates.length - 1];
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

        _shuffleArray(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        }

        /**
         * 扫描棋盘上所有实际存在的颜色及其统计信息
         * 彩虹块（color: -1, type: 'rainbow'）不计入颜色统计
         */
        _analyzeBoard(slots) {
            const colorMap = {}; // color -> { totalCount, maxConsecutiveTop, slotsWithColor, topPresence }

            for (const slot of slots) {
                if (slot.isEmpty()) continue;

                // 统计这个槽中每种颜色的出现情况（跳过彩虹块）
                const colorsInSlot = new Set();
                for (const b of slot.blocks) {
                    if (b.type === 'rainbow' || b.color < 0) continue; // 跳过彩虹块
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

                // 更新栈顶信息（topConsecutiveColor 返回 -1 表示全彩虹，跳过）
                const topColor = slot.topConsecutiveColor();
                if (topColor !== null && topColor !== undefined && topColor >= 0 && colorMap[topColor]) {
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
