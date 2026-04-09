/**
 * GameTest.js - 游戏逻辑测试
 * 在 console 中验证所有核心逻辑
 */
(function() {
    'use strict';

    const GameTest = {
        passed: 0,
        failed: 0,

        assert(condition, msg) {
            if (condition) {
                this.passed++;
            } else {
                this.failed++;
                console.error(`  FAIL: ${msg}`);
            }
        },

        runAll() {
            console.log('========== 游戏逻辑测试 ==========');
            this.passed = 0;
            this.failed = 0;

            this.testSlot();
            this.testGameStateInit();
            this.testMoveRules();
            this.testConsecutiveMove();
            this.testDeliveryDetection();
            this.testRefillAndOverflow();
            this.testDeadlock();
            this.testOrderGeneration();
            this.testDifficultyManager();
            this.testRestart();
            this.testSafeSlotNoRefill();
            this.testFullGameLoop();

            console.log(`\n========== 结果: ${this.passed} 通过, ${this.failed} 失败 ==========`);
            return this.failed === 0;
        },

        // ----- 测试 Slot -----
        testSlot() {
            console.log('\n--- 测试 Slot ---');

            const slot = new Slot(0, 5, false);
            this.assert(slot.isEmpty(), 'Slot should be empty initially');
            this.assert(!slot.isFull(), 'Slot should not be full');
            this.assert(slot.availableSpace() === 5, 'Available space should be 5');
            this.assert(slot.topBlock() === null, 'Top block should be null');
            this.assert(slot.topConsecutiveCount() === 0, 'Consecutive count should be 0');

            // 压入色块
            slot.pushBlocks([{ color: 0 }, { color: 0 }, { color: 1 }]);
            this.assert(slot.blocks.length === 3, 'Should have 3 blocks');
            this.assert(slot.topBlock().color === 1, 'Top should be color 1');
            this.assert(slot.topConsecutiveCount() === 1, 'Consecutive count should be 1');
            this.assert(slot.topConsecutiveColor() === 1, 'Consecutive color should be 1');

            // canReceive
            this.assert(slot.canReceive(1), 'Should accept color 1');
            this.assert(!slot.canReceive(0), 'Should not accept color 0');

            // 压入更多同色
            slot.pushBlocks([{ color: 1 }, { color: 1 }]);
            this.assert(slot.topConsecutiveCount() === 3, 'Consecutive count should be 3');
            this.assert(slot.isFull(), 'Slot should be full');
            this.assert(!slot.canReceive(1), 'Full slot should not accept');

            // popBlocks
            const popped = slot.popBlocks(2);
            this.assert(popped.length === 2, 'Should pop 2');
            this.assert(popped[0].color === 1, 'Popped should be color 1');
            this.assert(slot.blocks.length === 3, 'Should have 3 blocks left');

            // pushFromBottom
            const slot2 = new Slot(1, 3, false);
            slot2.pushBlocks([{ color: 0 }, { color: 0 }, { color: 1 }]);
            const overflow = slot2.pushFromBottom({ color: 2 });
            this.assert(overflow !== null, 'Should have overflow');
            this.assert(overflow.color === 1, 'Overflow should be top block (color 1)');
            this.assert(slot2.blocks[0].color === 2, 'Bottom should be new block');
            this.assert(slot2.blocks.length === 3, 'Length should remain 3');

            // clone
            const clone = slot2.clone();
            this.assert(clone.id === slot2.id, 'Clone id matches');
            this.assert(clone.blocks.length === slot2.blocks.length, 'Clone blocks length matches');
            clone.blocks[0].color = 99;
            this.assert(slot2.blocks[0].color !== 99, 'Clone should be independent');

            console.log('  Slot tests done');
        },

        // ----- 测试 GameState 初始化 -----
        testGameStateInit() {
            console.log('\n--- 测试 GameState 初始化 ---');

            const gs = new GameState();
            gs.initBoard({ colorCount: 3, slotCount: 5, capacity: 5, emptySlots: 2 });

            // 总槽数 = 5 普通 + 1 安全 = 6
            this.assert(gs.slots.length === 6, `Total slots should be 6, got ${gs.slots.length}`);

            // 安全槽检查
            const safeSlots = gs.slots.filter(s => s.isSafe);
            this.assert(safeSlots.length === 1, 'Should have 1 safe slot');
            this.assert(safeSlots[0].isEmpty(), 'Safe slot should be empty');

            // 普通槽检查
            const normalSlots = gs.slots.filter(s => !s.isSafe);
            this.assert(normalSlots.length === 5, 'Should have 5 normal slots');

            // 填充的普通槽 = 5 - 2 = 3
            const filledSlots = normalSlots.filter(s => !s.isEmpty());
            const emptyNormalSlots = normalSlots.filter(s => s.isEmpty());
            this.assert(filledSlots.length === 3, `Filled slots should be 3, got ${filledSlots.length}`);
            this.assert(emptyNormalSlots.length === 2, `Empty normal slots should be 2, got ${emptyNormalSlots.length}`);

            // 每个填充的槽应满
            for (const s of filledSlots) {
                this.assert(s.blocks.length === 5, `Filled slot should have 5 blocks, got ${s.blocks.length}`);
            }

            // 总色块数 = 3 * 5 = 15
            let totalBlocks = 0;
            for (const s of gs.slots) totalBlocks += s.blocks.length;
            this.assert(totalBlocks === 15, `Total blocks should be 15, got ${totalBlocks}`);

            // 血量
            this.assert(gs.hp === 10, 'HP should be 10');

            // 初始快照
            this.assert(gs.initialState !== null, 'Initial state should be saved');

            console.log('  GameState init tests done');
        },

        // ----- 测试移动规则 -----
        testMoveRules() {
            console.log('\n--- 测试移动规则 ---');

            const gs = new GameState();
            gs.slots = [
                this._makeSlot(0, 5, false, [0, 0, 1]),    // slot 0: [红 红 蓝]
                this._makeSlot(1, 5, false, [1, 1]),        // slot 1: [蓝 蓝]
                this._makeSlot(2, 5, false, []),             // slot 2: 空
                this._makeSlot(3, 5, true, []),              // slot 3: 安全槽，空
            ];
            gs.status = 'playing';

            // 选中空槽 → 不能选
            let r = gs.selectSlot(2);
            this.assert(r.action === 'empty_slot', 'Cannot select empty slot');

            // 选中 slot 0
            r = gs.selectSlot(0);
            this.assert(r.action === 'selected', 'Should select slot 0');
            this.assert(gs.selectedSlotIndex === 0, 'Selected index should be 0');

            // 取消选中
            r = gs.selectSlot(0);
            this.assert(r.action === 'deselected', 'Should deselect');
            this.assert(gs.selectedSlotIndex === null, 'Selected should be null');

            // 移动：slot 0 顶部是蓝(1) → slot 1 顶部也是蓝(1) → 合法
            gs.selectSlot(0);
            r = gs.selectSlot(1);
            this.assert(r.action === 'moved', 'Should move');
            this.assert(r.data.moveCount === 1, 'Should move 1 block');
            this.assert(gs.slots[0].blocks.length === 2, 'Source should have 2');
            this.assert(gs.slots[1].blocks.length === 3, 'Target should have 3');

            // 移动到空槽 → 合法
            gs.selectSlot(0); // 顶部是红(0)
            r = gs.selectSlot(2);
            this.assert(r.action === 'moved', 'Should move to empty');

            // 非法移动：slot 1 顶部蓝(1) → slot 0 空，应该可以
            // slot 0 现在是空的
            gs.selectSlot(1);
            r = gs.selectSlot(0);
            this.assert(r.action === 'moved', 'Should move to empty slot 0');

            // 移动到安全槽
            gs.selectSlot(0); // 有色块
            r = gs.selectSlot(3); // 安全槽空
            this.assert(r.action === 'moved', 'Should move to safe slot');

            console.log('  Move rules tests done');
        },

        // ----- 测试连续同色块移动 -----
        testConsecutiveMove() {
            console.log('\n--- 测试连续同色块移动 ---');

            const gs = new GameState();
            gs.slots = [
                this._makeSlot(0, 5, false, [1, 0, 0, 0]),  // [蓝 红 红 红] 顶部3个红
                this._makeSlot(1, 5, false, [0]),             // [红] 有1空位... 实际4空位
                this._makeSlot(2, 5, false, []),              // 空
            ];
            gs.status = 'playing';

            // slot 0 顶部 3 个红 → slot 1 顶部是红且有 4 空位 → 应该移动 3 个
            gs.selectSlot(0);
            let r = gs.selectSlot(1);
            this.assert(r.action === 'moved', 'Should move consecutive');
            this.assert(r.data.moveCount === 3, `Should move 3, got ${r.data.moveCount}`);
            this.assert(gs.slots[0].blocks.length === 1, 'Source should have 1');
            this.assert(gs.slots[1].blocks.length === 4, 'Target should have 4');

            // 测试空间不足时只移动能放下的数量
            const gs2 = new GameState();
            gs2.slots = [
                this._makeSlot(0, 5, false, [1, 0, 0, 0]),  // [蓝 红 红 红] 顶部3个红
                this._makeSlot(1, 5, false, [2, 2, 2, 0]),   // [绿 绿 绿 红] 1空位
            ];
            gs2.status = 'playing';

            gs2.selectSlot(0);
            r = gs2.selectSlot(1);
            this.assert(r.action === 'moved', 'Should partial move');
            this.assert(r.data.moveCount === 1, `Should move 1 (space limit), got ${r.data.moveCount}`);

            console.log('  Consecutive move tests done');
        },

        // ----- 测试交付检测 -----
        testDeliveryDetection() {
            console.log('\n--- 测试交付检测 ---');

            const gs = new GameState();
            gs.slots = [
                this._makeSlot(0, 5, false, [1, 0, 0, 0]),  // 顶部3个红
                this._makeSlot(1, 5, false, [0, 0, 0, 0]),  // 顶部4个红
            ];
            gs.currentOrder = { color: 0, count: 3, status: 'active' };

            let check = gs.checkDelivery();
            this.assert(check.canDeliver, 'Should be able to deliver');
            this.assert(check.slotIndex === 0, 'Should find slot 0 first');

            // 交付
            const result = gs.executeDelivery(0);
            this.assert(result.deliveredBlocks.length === 3, 'Should deliver 3 blocks');
            this.assert(gs.slots[0].blocks.length === 1, 'Slot 0 should have 1 left');
            this.assert(gs.completedOrders === 1, 'Completed orders should be 1');
            this.assert(gs.currentOrder.status === 'completed', 'Order should be completed');

            // 不满足条件
            gs.currentOrder = { color: 2, count: 3, status: 'active' };
            check = gs.checkDelivery();
            this.assert(!check.canDeliver, 'Should not deliver (no green)');

            console.log('  Delivery detection tests done');
        },

        // ----- 测试补充和溢出 -----
        testRefillAndOverflow() {
            console.log('\n--- 测试补充和溢出 ---');

            const gs = new GameState();
            gs.slots = [
                this._makeSlot(0, 3, false, [0, 0, 0]),  // 满
                this._makeSlot(1, 3, false, [1]),          // 有2空位
                this._makeSlot(2, 3, true, []),             // 安全槽
            ];
            gs.hp = 10;

            const result = gs.executeRefill(3);

            // 安全槽不参与补充
            this.assert(gs.slots[2].isEmpty(), 'Safe slot should remain empty');

            // slot 0 已满 → 溢出1个
            this.assert(result.overflowData.length >= 1, 'Should have overflow');
            const slot0Overflow = result.overflowData.filter(o => o.slotIndex === 0);
            this.assert(slot0Overflow.length === 1, 'Slot 0 should overflow 1');

            // slot 1 不溢出
            const slot1Overflow = result.overflowData.filter(o => o.slotIndex === 1);
            this.assert(slot1Overflow.length === 0, 'Slot 1 should not overflow');

            // 扣血
            this.assert(gs.hp === 10 - result.totalOverflow, `HP should be ${10 - result.totalOverflow}`);

            // 补充数据
            this.assert(result.refillData.length === 2, 'Should refill 2 normal slots');

            console.log('  Refill and overflow tests done');
        },

        // ----- 测试死局检测 -----
        testDeadlock() {
            console.log('\n--- 测试死局检测 ---');

            // 所有槽满，颜色各不相同 → 死局
            const gs = new GameState();
            gs.slots = [
                this._makeSlot(0, 2, false, [0, 1]),
                this._makeSlot(1, 2, false, [2, 3]),
                this._makeSlot(2, 2, true, [4, 5]),
            ];
            this.assert(gs.isDeadlock(), 'Should be deadlock (all full, no same tops)');

            // 有空槽 → 不是死局
            const gs2 = new GameState();
            gs2.slots = [
                this._makeSlot(0, 3, false, [0, 0, 0]),
                this._makeSlot(1, 3, false, []),
            ];
            this.assert(!gs2.isDeadlock(), 'Should not be deadlock (has empty slot)');

            // HP = 0 → game over
            const gs3 = new GameState();
            gs3.hp = 0;
            gs3.slots = [this._makeSlot(0, 3, false, [0])];
            const goResult = gs3.checkGameOver();
            this.assert(goResult.gameOver, 'Should be game over (hp 0)');
            this.assert(goResult.reason === 'hp_zero', 'Reason should be hp_zero');

            console.log('  Deadlock tests done');
        },

        // ----- 测试订单生成 -----
        testOrderGeneration() {
            console.log('\n--- 测试订单生成 ---');

            const om = new OrderManager();
            const dm = new DifficultyManager();

            const slots = [
                this._makeSlot(0, 5, false, [0, 0, 1, 1, 1]),  // 顶部3个蓝
                this._makeSlot(1, 5, false, [2, 2, 0, 0]),
                this._makeSlot(2, 5, false, [1, 2, 2]),
                this._makeSlot(3, 5, true, []),
            ];

            const order = om.generateOrder(slots, 0, dm);
            this.assert(order.color >= 0 && order.color < 3, `Order color should be 0-2, got ${order.color}`);
            this.assert(order.count >= 1, 'Order count should be >= 1');
            this.assert(order.status === 'active', 'Order status should be active');

            // 多次生成，确保不崩溃
            for (let i = 0; i < 20; i++) {
                const o = om.generateOrder(slots, i, dm);
                this.assert(o.color !== undefined && o.count > 0, `Order ${i} should be valid`);
            }

            console.log('  Order generation tests done');
        },

        // ----- 测试难度管理器 -----
        testDifficultyManager() {
            console.log('\n--- 测试 DifficultyManager ---');

            const dm = new DifficultyManager();

            // 初始参数
            const init = dm.getInitialParams();
            this.assert(init.colorCount === 3, 'Initial colors should be 3');
            this.assert(init.slotCount === 5, 'Initial slots should be 5');
            this.assert(init.capacity === 5, 'Initial capacity should be 5');
            this.assert(init.emptySlots === 2, 'Initial empty slots should be 2');

            // 阶段切换检测
            dm.reset();
            let t = dm.checkStageTransition(0);
            this.assert(!t.needsAdjust, 'First check should not need adjust');

            t = dm.checkStageTransition(6);
            this.assert(t.needsAdjust, 'Should need adjust at stage 2');
            this.assert(t.params !== null, 'Should have params');

            t = dm.checkStageTransition(7);
            this.assert(!t.needsAdjust, 'Same stage should not need adjust');

            // 难度参数获取
            const p = dm.getParams(50);
            this.assert(p.colorCount >= 7 && p.colorCount <= 8, `Colors at 50 should be 7-8, got ${p.colorCount}`);
            this.assert(p.label === '进阶', `Label should be 进阶, got ${p.label}`);

            console.log('  DifficultyManager tests done');
        },

        // ----- 测试重新开始 -----
        testRestart() {
            console.log('\n--- 测试重新开始 ---');

            const gs = new GameState();
            gs.initBoard({ colorCount: 3, slotCount: 5, capacity: 5, emptySlots: 2 });

            // 记录初始状态
            const initialBlockCount = gs.slots.reduce((sum, s) => sum + s.blocks.length, 0);
            const initialHp = gs.hp;

            // 进行一些操作
            gs.hp = 5;
            gs.completedOrders = 3;
            gs.slots[0].popBlocks(2);

            // 重新开始
            gs.restart();

            const afterBlockCount = gs.slots.reduce((sum, s) => sum + s.blocks.length, 0);
            this.assert(afterBlockCount === initialBlockCount, 'Block count should be restored');
            this.assert(gs.hp === initialHp, 'HP should be restored');
            this.assert(gs.completedOrders === 0, 'Completed orders should be 0');
            this.assert(gs.status === 'playing', 'Status should be playing');

            console.log('  Restart tests done');
        },

        // ----- 测试安全槽不补充 -----
        testSafeSlotNoRefill() {
            console.log('\n--- 测试安全槽不补充 ---');

            const gs = new GameState();
            gs.slots = [
                this._makeSlot(0, 5, false, [0]),
                this._makeSlot(1, 5, true, [1, 1]),  // 安全槽有2个色块
            ];
            gs.hp = 10;

            const before = gs.slots[1].blocks.length;
            gs.executeRefill(3);
            const after = gs.slots[1].blocks.length;

            this.assert(after === before, `Safe slot should not change: before=${before}, after=${after}`);
            this.assert(gs.slots[0].blocks.length === 2, 'Normal slot should get refill');

            console.log('  Safe slot no refill tests done');
        },

        // ----- 完整游戏循环测试 -----
        testFullGameLoop() {
            console.log('\n--- 测试完整游戏循环 ---');

            const gs = new GameState();
            const dm = new DifficultyManager();
            const om = new OrderManager();

            // 初始化
            const params = dm.getInitialParams();
            gs.initBoard(params);

            // 生成第一个订单
            dm.checkStageTransition(0);
            gs.currentOrder = om.generateOrder(gs.slots, gs.completedOrders, dm);
            this.assert(gs.currentOrder !== null, 'First order should be generated');
            this.assert(gs.currentOrder.status === 'active', 'Order should be active');

            // 打印初始状态
            gs.debugPrint();

            // 模拟几轮：尝试随机合法移动
            let moves = 0;
            const maxMoves = 50;
            while (gs.status === 'playing' && moves < maxMoves) {
                // 找一个合法移动
                let moved = false;
                for (let i = 0; i < gs.slots.length && !moved; i++) {
                    if (gs.slots[i].isEmpty()) continue;
                    for (let j = 0; j < gs.slots.length && !moved; j++) {
                        if (i === j) continue;
                        const color = gs.slots[i].topConsecutiveColor();
                        if (gs.slots[j].canReceive(color)) {
                            gs.selectSlot(i);
                            const r = gs.selectSlot(j);
                            if (r.action === 'moved') {
                                moved = true;
                                moves++;

                                // 检测交付
                                const delivery = gs.checkDelivery();
                                if (delivery.canDeliver) {
                                    gs.executeDelivery(delivery.slotIndex);
                                    const colorCount = dm.getAvailableColorCount(gs.completedOrders);
                                    gs.executeRefill(colorCount);

                                    // 检查游戏结束
                                    const go = gs.checkGameOver();
                                    if (go.gameOver) break;

                                    // 检查难度调整
                                    dm.checkStageTransition(gs.completedOrders);

                                    // 生成新订单
                                    gs.currentOrder = om.generateOrder(gs.slots, gs.completedOrders, dm);
                                }

                                // 检查死局
                                const go = gs.checkGameOver();
                                if (go.gameOver) break;
                            }
                        }
                    }
                }
                if (!moved) break; // 无合法移动
            }

            console.log(`  Full loop: ${moves} moves, ${gs.completedOrders} orders completed, HP: ${gs.hp}, Status: ${gs.status}`);
            gs.debugPrint();

            this.assert(moves > 0, 'Should have made at least 1 move');

            console.log('  Full game loop test done');
        },

        // ----- 辅助方法 -----
        _makeSlot(id, capacity, isSafe, colors) {
            const slot = new Slot(id, capacity, isSafe);
            for (const c of colors) {
                slot.blocks.push({ color: c });
            }
            return slot;
        },
    };

    window.GameTest = GameTest;
})();
