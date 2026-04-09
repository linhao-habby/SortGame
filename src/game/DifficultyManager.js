/**
 * DifficultyManager.js - 难度管理器
 * 根据已完成订单数返回难度参数，管理动态调整
 */
(function() {
    'use strict';

    class DifficultyManager {
        constructor() {
            // 上一次应用的难度阶段 index，用于检测阶段切换
            this._lastStageIndex = -1;
        }

        /**
         * 获取当前难度阶段的 index
         * @param {number} completedOrders
         * @returns {number}
         */
        _getStageIndex(completedOrders) {
            const stages = GameConfig.DIFFICULTY_STAGES;
            for (let i = stages.length - 1; i >= 0; i--) {
                if (completedOrders >= stages[i].minOrders) {
                    return i;
                }
            }
            return 0;
        }

        /**
         * 获取当前难度参数
         * @param {number} completedOrders - 已完成订单数
         * @returns {{ colorCount: number, slotCount: number, capacity: number, emptySlots: number, orderCount: number, label: string }}
         */
        getParams(completedOrders) {
            const stage = GameConfig.getStageByOrders(completedOrders);
            return {
                colorCount: GameConfig.resolveValue(stage, 'colorCount'),
                slotCount:  GameConfig.resolveValue(stage, 'slotCount'),
                capacity:   GameConfig.resolveValue(stage, 'capacity'),
                emptySlots: GameConfig.resolveValue(stage, 'emptySlots'),
                initBlocks: GameConfig.resolveValue(stage, 'initBlocks'),
                orderNum:   stage.orderNum || 1,
                orderCount: stage.orderRange[0] + Math.floor(Math.random() * (stage.orderRange[1] - stage.orderRange[0] + 1)),
                label:      stage.label,
            };
        }

        /**
         * 获取初始棋盘参数（游戏开始时使用）
         * @returns {{ colorCount: number, slotCount: number, capacity: number, emptySlots: number, orderCount: number }}
         */
        getInitialParams() {
            // 初始使用第一阶段的固定值
            const stage = GameConfig.DIFFICULTY_STAGES[0];
            const _v = (field) => stage[field] !== undefined ? stage[field] : (stage[field + 'Range'] ? stage[field + 'Range'][0] : undefined);
            return {
                colorCount: _v('colorCount'),
                slotCount:  _v('slotCount'),
                capacity:   _v('capacity'),
                emptySlots: _v('emptySlots'),
                initBlocks: _v('initBlocks'),
                orderNum:   stage.orderNum || 1,
                orderCount: stage.orderRange[0],
            };
        }

        /**
         * 检查是否需要进行难度动态调整
         * @param {number} completedOrders
         * @returns {{ needsAdjust: boolean, newStageIndex: number, params: object }}
         */
        checkStageTransition(completedOrders) {
            const currentIndex = this._getStageIndex(completedOrders);
            if (currentIndex > this._lastStageIndex) {
                const oldIndex = this._lastStageIndex;
                this._lastStageIndex = currentIndex;
                return {
                    needsAdjust: oldIndex >= 0, // 首次不需要调整（初始化时）
                    newStageIndex: currentIndex,
                    params: this.getParams(completedOrders),
                };
            }
            return { needsAdjust: false, newStageIndex: currentIndex, params: null };
        }

        /**
         * 对现有棋盘执行难度动态调整
         * - 新增颜色：通过补充机制自然引入（不在这里处理）
         * - 新增木槽：在 slots 数组中添加新的空普通木槽
         * @param {Slot[]} slots - 当前木槽数组
         * @param {object} oldParams - 上一阶段参数
         * @param {object} newParams - 新阶段参数
         * @returns {{ addedSlots: Slot[] }} 新增的木槽
         */
        adjustBoard(slots, oldParams, newParams) {
            const addedSlots = [];

            // 计算需要新增的普通木槽数量
            const currentNormalSlots = slots.length;
            const targetSlotCount = newParams.slotCount;

            if (targetSlotCount > currentNormalSlots) {
                const toAdd = targetSlotCount - currentNormalSlots;
                for (let i = 0; i < toAdd; i++) {
                    const newSlot = new Slot(slots.length, newParams.capacity, false);
                    slots.push(newSlot);
                    addedSlots.push(newSlot);
                }
            }

            // 如果容量增加了，更新所有木槽的容量
            if (newParams.capacity > oldParams.capacity) {
                for (const slot of slots) {
                    slot.capacity = newParams.capacity;
                }
            }

            return { addedSlots };
        }

        /**
         * 获取当前难度阶段可用的颜色数量
         * @param {number} completedOrders
         * @returns {number}
         */
        getAvailableColorCount(completedOrders) {
            const stage = GameConfig.getStageByOrders(completedOrders);
            return GameConfig.resolveValue(stage, 'colorCount');
        }

        /**
         * 重置状态
         */
        reset() {
            this._lastStageIndex = -1;
        }
    }

    window.DifficultyManager = DifficultyManager;
})();
