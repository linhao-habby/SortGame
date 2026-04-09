/**
 * GameConfig.js - 游戏配置常量
 * 颜色定义、尺寸常量、难度曲线配置
 */
(function() {
    'use strict';

    const GameConfig = {
        // ===== 血量 =====
        INITIAL_HP: 10,

        // ===== 颜色定义 =====
        COLORS: [
            { id: 0,  name: '红色', hex: '#FF4444', rgb: [1.0, 0.267, 0.267], stage: 'basic' },
            { id: 1,  name: '蓝色', hex: '#4488FF', rgb: [0.267, 0.533, 1.0], stage: 'basic' },
            { id: 2,  name: '绿色', hex: '#44CC44', rgb: [0.267, 0.8, 0.267],  stage: 'basic' },
            { id: 3,  name: '黄色', hex: '#FFCC00', rgb: [1.0, 0.8, 0.0],      stage: 'basic' },
            { id: 4,  name: '紫色', hex: '#AA44FF', rgb: [0.667, 0.267, 1.0],  stage: 'basic' },
            { id: 5,  name: '橙色', hex: '#FF8800', rgb: [1.0, 0.533, 0.0],    stage: 'basic' },
            { id: 6,  name: '粉色', hex: '#FF66AA', rgb: [1.0, 0.4, 0.667],    stage: 'advanced' },
            { id: 7,  name: '青色', hex: '#00CCCC', rgb: [0.0, 0.8, 0.8],      stage: 'advanced' },
            { id: 8,  name: '棕色', hex: '#AA6633', rgb: [0.667, 0.4, 0.2],    stage: 'advanced' },
            { id: 9,  name: '灰色', hex: '#888888', rgb: [0.533, 0.533, 0.533], stage: 'hard' },
            { id: 10, name: '白色', hex: '#EEEEEE', rgb: [0.933, 0.933, 0.933], stage: 'hard' },
            { id: 11, name: '深绿', hex: '#228844', rgb: [0.133, 0.533, 0.267], stage: 'hard' },
        ],

        // ===== 难度曲线 =====
        // orderNum: 同时活跃的订单数量（1→2→3 渐进）
        // 取走总数 = 普通槽数 S - (orderNum - 1)，补充总数始终 = S
        // orderNum=1 时守恒，orderNum>=2 时棋盘色块逐渐堆积，压力递增
        DIFFICULTY_STAGES: [
            { minOrders: 0,  maxOrders: 5,   colorCount: 2,        slotCount: 3,         capacity: 5,       emptySlots: 1,       orderNum: 1, orderRange: [3, 3],    label: '新手引导' },
            { minOrders: 6,  maxOrders: 15,  colorCount: 4,        slotCount: 4,         capacity: 5,       emptySlots: 1,       orderNum: 1, orderRange: [3, 4],    label: '入门' },
            { minOrders: 16, maxOrders: 30,  colorCountRange: [5, 6], slotCountRange: [5, 6], capacity: 5,  emptySlotsRange: [1, 2], orderNum: 2, orderRange: [3, 4], label: '中等' },
            { minOrders: 31, maxOrders: 50,  colorCountRange: [7, 8], slotCountRange: [6, 7], capacityRange: [5, 6], emptySlotsRange: [1, 2], orderNum: 2, orderRange: [4, 5], label: '进阶' },
            { minOrders: 51, maxOrders: 80,  colorCountRange: [8, 10], slotCountRange: [7, 8], capacity: 6,  emptySlots: 1,       orderNum: 3, orderRange: [4, 5],    label: '困难' },
            { minOrders: 81, maxOrders: Infinity, colorCountRange: [10, 12], slotCountRange: [8, 9], capacityRange: [6, 7], emptySlots: 1, orderNum: 3, orderRange: [5, 6], label: '极限' },
        ],

        // ===== 动画时长 (ms) =====
        ANIM: {
            BLOCK_POP_OUT:   150,
            BLOCK_FLY:       300,
            BLOCK_DROP_IN:   200,
            SLOT_SELECT:     150,
            CONSECUTIVE_GAP: 80,
            DELIVER_FLY:     400,
            DELIVER_DONE:    500,
            REFILL_PUSH:     300,
            OVERFLOW_OUT:    250,
            HP_FEEDBACK:     300,
            NEW_ORDER:       300,
            GAME_OVER:       500,
        },

        // ===== 渲染尺寸（3D 世界坐标）=====
        RENDER: {
            BLOCK_WIDTH:  0.72,   // 色块渲染宽度
            BLOCK_HEIGHT: 0.65,   // 色块渲染高度
            BLOCK_DEPTH:  0.65,   // 色块厚度（厚实饱满，类3D感）
            CELL_HEIGHT:  0.82,   // 格子高度（色块+间距）
            SLOT_INNER_WIDTH: 0.88, // 槽内宽
            SLOT_WALL_THICKNESS: 0.1,
            SLOT_GAP: 0.35,       // 木槽水平间距
            ROW_GAP: 0.6,         // 木槽行间距
        },

        /**
         * 根据范围配置获取实际值
         * 如果字段是固定值直接返回，如果是 Range 则随机取
         */
        resolveValue(stage, field) {
            if (stage[field] !== undefined) {
                return stage[field];
            }
            const range = stage[field + 'Range'];
            if (range) {
                return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
            }
            return 0;
        },

        /**
         * 根据已完成订单数获取当前难度阶段配置
         */
        getStageByOrders(completedOrders) {
            for (let i = this.DIFFICULTY_STAGES.length - 1; i >= 0; i--) {
                if (completedOrders >= this.DIFFICULTY_STAGES[i].minOrders) {
                    return this.DIFFICULTY_STAGES[i];
                }
            }
            return this.DIFFICULTY_STAGES[0];
        },

        /**
         * 获取指定颜色数量范围内的颜色 ID 数组
         */
        getAvailableColors(count) {
            return this.COLORS.slice(0, count).map(c => c.id);
        },
    };

    window.GameConfig = GameConfig;
})();
