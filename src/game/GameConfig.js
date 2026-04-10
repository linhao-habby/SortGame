/**
 * GameConfig.js - 游戏配置常量
 * 颜色定义、尺寸常量、难度曲线配置
 */
(function() {
    'use strict';

    const GameConfig = {
        // ===== 血量 =====
        INITIAL_HP: 3,

        // ===== 补充模式 =====
        // true: 每完成1个订单就补充（每槽推1个）
        // false: 所有订单都完成后才一次性补充
        REFILL_PER_ORDER: true,

        // ===== 分数系统 =====
        SCORE: {
            BASE_PER_BLOCK: 10,       // 基础分：每个订单要求色块 x 此值
            OVERFLOW_PER_BLOCK: 15,   // 超额分：超出订单要求的每个色块 x 此值
            COMBO_STEP: 0.5,          // combo 倍率递增步长（combo N 的倍率 = 1 + (N-1) * step）
            COMBO_WINDOW: 3,          // combo 窗口：N 次移动内触发交付就保持连击
        },

        // ===== 彩虹块（整槽纯色消除奖励）=====
        RAINBOW: {
            BLOCK_TYPE: 'rainbow',          // 彩虹块的 type 标识
            CLEAR_BASE_SCORE: 50,           // 整槽纯色消除基础分
            CLEAR_PER_BLOCK: 5,             // 消除的每个色块额外加分
        },

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
            { minOrders: 0,  maxOrders: 1,        colorCount: 2, slotCount: 3, capacity: 5, emptySlots: 1,                  initBlocks: 3, orderNum: 1, orderRange: [3, 3], label: '新手引导' },
            { minOrders: 2,  maxOrders: 7,         colorCount: 3, slotCount: 4, capacity: 5, emptySlots: 1,                  orderNum: 1, orderRange: [3, 4], label: '入门' },
            { minOrders: 8,  maxOrders: 15,        colorCount: 4, slotCount: 5, capacity: 5, emptySlotsRange: [1, 2],         orderNum: 1, orderRange: [3, 4], label: '中等' },
            { minOrders: 16, maxOrders: 29,        colorCount: 4, slotCount: 6, capacity: 5, emptySlotsRange: [1, 2],         orderNum: 2, orderRange: [4, 5], label: '进阶' },
            { minOrders: 30, maxOrders: 49,        colorCount: 4, slotCount: 6, capacity: 5, emptySlots: 1,                  orderNum: 2, orderRange: [4, 5], label: '困难' },
            { minOrders: 50, maxOrders: Infinity,  colorCount: 4, slotCount: 6, capacity: 5, emptySlots: 1,                  orderNum: 2, orderRange: [4, 5], label: '极限' },
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
            FULL_SLOT_CLEAR: 400,   // 整槽纯色消除动画时长
            RAINBOW_SPAWN:   300,   // 彩虹块生成动画时长
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

    // ===== 控制台调参工具 =====
    // 浏览器控制台输入 D.show() 查看当前难度曲线
    // 浏览器控制台输入 D.set(阶段序号, { 字段: 值 }) 修改某个阶段
    // 浏览器控制台输入 D.setAll(完整数组) 替换整个难度曲线
    // 浏览器控制台输入 D.reset() 恢复默认
    // 修改后点"重来"即可生效
    window.D = {
        _default: JSON.parse(JSON.stringify(GameConfig.DIFFICULTY_STAGES)),

        /** 打印当前难度曲线表格 */
        show() {
            const stages = GameConfig.DIFFICULTY_STAGES;
            console.log('\n===== 难度曲线 =====');
            console.log('序号 | 阶段     | 完成订单 | 颜色  | 槽数  | 容量  | 空槽  | 订单数 | 每单需求  ');
            console.log('-----|----------|---------|-------|-------|-------|-------|--------|----------');
            stages.forEach((s, i) => {
                const colors = s.colorCount || `${s.colorCountRange[0]}-${s.colorCountRange[1]}`;
                const slots = s.slotCount || `${s.slotCountRange[0]}-${s.slotCountRange[1]}`;
                const cap = s.capacity || `${s.capacityRange[0]}-${s.capacityRange[1]}`;
                const empty = s.emptySlots !== undefined ? s.emptySlots : `${s.emptySlotsRange[0]}-${s.emptySlotsRange[1]}`;
                console.log(`  ${i}  | ${s.label.padEnd(8)} | ${String(s.minOrders).padStart(3)}-${String(s.maxOrders === Infinity ? '∞' : s.maxOrders).padStart(3)} | ${String(colors).padStart(5)} | ${String(slots).padStart(5)} | ${String(cap).padStart(5)} | ${String(empty).padStart(5)} | ${String(s.orderNum).padStart(6)} | ${s.orderRange[0]}-${s.orderRange[1]}`);
            });
            console.log('\n字段说明:');
            console.log('  colorCount/colorCountRange  - 颜色种类(固定值或[min,max]范围)');
            console.log('  slotCount/slotCountRange    - 木槽数量');
            console.log('  capacity/capacityRange      - 每槽容量');
            console.log('  emptySlots/emptySlotsRange  - 初始空槽数');
            console.log('  orderNum                    - 同时活跃订单数(1/2/3)');
            console.log('  orderRange                  - 每个订单色块需求[min,max]');
            console.log('  minOrders/maxOrders          - 该阶段的完成订单数范围');
            console.log('\n用法: D.set(0, {colorCount:3, slotCount:4}) 修改第0阶段');
            return stages;
        },

        /**
         * 修改某个阶段的参数
         * @param {number} index - 阶段序号(0~5)
         * @param {object} overrides - 要修改的字段，如 {colorCount:4, slotCount:5, orderNum:2}
         */
        set(index, overrides) {
            const stages = GameConfig.DIFFICULTY_STAGES;
            if (index < 0 || index >= stages.length) {
                console.error(`无效阶段序号 ${index}，有效范围 0-${stages.length - 1}`);
                return;
            }
            Object.assign(stages[index], overrides);
            console.log(`阶段 ${index}(${stages[index].label}) 已更新:`, stages[index]);
            console.log('点击"重来"按钮生效');
        },

        /**
         * 替换整个难度曲线
         * @param {object[]} newStages - 新的难度阶段数组
         */
        setAll(newStages) {
            GameConfig.DIFFICULTY_STAGES = newStages;
            console.log(`难度曲线已替换，共 ${newStages.length} 个阶段`);
            console.log('点击"重来"按钮生效');
        },

        /** 恢复默认难度曲线 */
        reset() {
            GameConfig.DIFFICULTY_STAGES = JSON.parse(JSON.stringify(this._default));
            console.log('难度曲线已恢复默认');
            console.log('点击"重来"按钮生效');
        },

        /** 修改初始血量 */
        hp(value) {
            GameConfig.INITIAL_HP = value;
            console.log(`初始血量已改为 ${value}，点击"重来"生效`);
        },
    };
})();
