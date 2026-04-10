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
         *
         * @param {Slot[]} slots
         * @param {number} completedOrders
         * @param {DifficultyManager} difficultyManager
         * @param {number} normalSlotCount - 普通木槽数量
         * @param {number} orderNum - 订单数量（1~3）
         * @returns {{ color: number, count: number, status: string }[]}
         */
        generateOrders(slots, completedOrders, difficultyManager, normalSlotCount, orderNum) {
            orderNum = Math.max(1, Math.min(3, orderNum || 1));
            const totalCount = Math.max(orderNum, normalSlotCount - (orderNum - 1));

            // 获取槽容量上限（单个订单的 count 不能超过容量，否则不可能在一个槽里凑齐）
            const maxCapacity = slots.length > 0 ? Math.max(...slots.map(s => s.capacity)) : 5;

            // 扫描棋盘上所有实际存在的颜色
            const colorStats = this._analyzeBoard(slots);

            // 选择 orderNum 种不同颜色并分配数量
            const assignments = this._pickColors(colorStats, totalCount, orderNum, maxCapacity);

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
                if (a.count > maxCapacity) {
                    console.warn(`[OrderManager] 安全校验(容量): C${a.color} 需${a.count} 容量${maxCapacity}, 修正`);
                    a.count = maxCapacity;
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
         * @returns {{ color: number, count: number }[]}
         */
        _pickColors(colorStats, totalCount, orderNum, maxCapacity) {
            const available = colorStats.filter(s => s.totalCount >= 1);

            if (orderNum === 1) {
                return this._pickSingleOrder(available, totalCount, maxCapacity);
            }

            // 多订单：贪心选颜色，然后分配数量
            const weighted = available.map(s => ({
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
            while (chosen.length < orderNum && chosen.length < available.length) {
                const next = available.find(s => !chosen.includes(s));
                if (next) chosen.push(next);
                else break;
            }

            // 极端：可用颜色不足 orderNum 种
            if (chosen.length < orderNum) {
                return this._fallbackMulti(available, totalCount, orderNum, maxCapacity);
            }

            // 分配数量
            return this._allocateMulti(chosen, totalCount, orderNum, maxCapacity);
        }

        /**
         * 单订单：选一种颜色
         * count 不能超过 maxCapacity（否则一个槽装不下，无法交付）
         */
        _pickSingleOrder(available, totalCount, maxCapacity) {
            const capCount = Math.min(totalCount, maxCapacity);
            let candidates = available.filter(s => s.totalCount >= capCount);
            if (candidates.length === 0) {
                candidates = available.sort((a, b) => b.totalCount - a.totalCount);
            }

            const chosen = this._weightedPickOne(candidates);
            const count = Math.min(chosen.totalCount, capCount);
            return [{ color: chosen.color, count }];
        }

        /**
         * 多订单数量分配
         * 约束：每个 count >= 1，每个 count <= min(颜色实际数量, maxCapacity)，总和尽量 = totalCount
         */
        _allocateMulti(chosen, totalCount, orderNum, maxCapacity) {
            // max 取颜色实际数量和槽容量的较小值
            const result = chosen.map(s => ({
                color: s.color,
                count: 1,
                max: Math.min(s.totalCount, maxCapacity),
            }));
            let remaining = totalCount - orderNum;

            // 随机打乱分配顺序增加变化
            const indices = Array.from({ length: orderNum }, (_, i) => i);
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
        _fallbackMulti(available, totalCount, orderNum, maxCapacity) {
            const sorted = [...available].sort((a, b) => b.totalCount - a.totalCount);
            const actualNum = Math.min(sorted.length, orderNum);

            if (actualNum === 0) {
                const result = [];
                for (let i = 0; i < orderNum; i++) {
                    result.push({ color: i, count: Math.min(Math.max(1, Math.floor(totalCount / orderNum)), maxCapacity) });
                }
                return result;
            }

            const chosen = sorted.slice(0, actualNum);
            const result = this._allocateMulti(chosen, Math.min(totalCount, chosen.reduce((s, c) => s + c.totalCount, 0)), actualNum, maxCapacity);

            // 如果实际选出的颜色 < orderNum，补足空订单
            while (result.length < orderNum) {
                const usedColors = result.map(r => r.color);
                const nextColor = (usedColors[usedColors.length - 1] + 1) % 12;
                result.push({ color: nextColor, count: 1 });
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
