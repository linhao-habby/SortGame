/**
 * GameFlowController.js - 玩法流程控制器
 * 
 * 职责：管理游戏的完整玩法流程推进
 *   - 初始化棋盘
 *   - 处理槽位点击 → 移动判定
 *   - 移动后 → 交付检测 → 补充 → 新订单 → 难度调整
 *   - 游戏结束判定
 * 
 * 不直接操作动画、渲染、UI，而是通过回调通知外部。
 * 外部（Game.js）负责在回调中触发动画和 UI 更新。
 * 
 * 回调约定：
 *   onHUDUpdate(gameState)                                 - 需要刷新 HUD
 *   onMoveExecuted(moveData, moveContext) → Promise         - 移动动画，需等待完成
 *   onDelivery(slotIndex, order, slotBlocksBefore) → Promise - 交付动画，需等待完成
 *   onOrderComplete()                                       - 单个订单完成（闪光等）
 *   onRefill(refillData) → Promise                          - 补充动画，需等待完成
 *   onOverflow(overflowData) → Promise                      - 溢出动画，需等待完成
 *   onHPDamage()                                            - 扣血反馈
 *   onBoardChanged()                                        - 棋盘结构变化（新增木槽等），需重算布局
 *   onGameOver(completedOrders, reason)                     - 游戏结束
 *   onNewOrders(orders)                                     - 新订单生成
 */
(function() {
    'use strict';

    class GameFlowController {
        constructor() {
            this.gameState = new GameState();
            this.difficultyManager = new DifficultyManager();
            this.orderManager = new OrderManager();

            // 回调，由外部（Game.js）注册
            this.callbacks = {};
        }

        /**
         * 注册回调
         * @param {object} callbacks - 回调函数集合
         */
        setCallbacks(callbacks) {
            this.callbacks = callbacks;
        }

        // ===== 辅助：触发回调 =====

        _emit(name, ...args) {
            if (this.callbacks[name]) {
                return this.callbacks[name](...args);
            }
        }

        async _emitAsync(name, ...args) {
            if (this.callbacks[name]) {
                return await this.callbacks[name](...args);
            }
        }

        // ===== 游戏初始化 =====

        initGame() {
            this.difficultyManager.reset();
            this.orderManager.reset();

            const params = this.difficultyManager.getInitialParams();
            this.gameState.initBoard(params);
            this.difficultyManager.checkStageTransition(0);

            // 生成初始订单
            this._generateNewOrders();

            this._emit('onBoardChanged');
            this._emit('onHUDUpdate', this.gameState);
        }

        /**
         * 重新开始（完全重置）
         */
        restartGame() {
            this.initGame();
        }

        // ===== 订单生成 =====

        _generateNewOrders() {
            const normalCount = this.gameState.getNormalSlotCount();
            const params = this.difficultyManager.getParams(this.gameState.completedOrders);
            const orderNum = params.orderNum || 1;
            this.gameState.orders = this.orderManager.generateOrders(
                this.gameState.slots,
                this.gameState.completedOrders,
                this.difficultyManager,
                normalCount,
                orderNum
            );
            this._emit('onNewOrders', this.gameState.orders);
        }

        // ===== 槽位点击处理 =====

        /**
         * 处理玩家点击槽位
         * @param {number} slotIndex
         * @returns {boolean} 是否开始了异步流程（调用方需据此锁定输入）
         */
        async handleSlotTap(slotIndex) {
            if (this.gameState.status !== 'playing') return false;

            // 记录移动前状态（供动画计算）
            const srcSlot = this.gameState.slots[slotIndex];
            const srcCount = srcSlot ? srcSlot.blocks.length : 0;

            const result = this.gameState.selectSlot(slotIndex);
            this._emit('onHUDUpdate', this.gameState);

            if (result.action !== 'moved') {
                // 选中、取消选中、重选等非移动操作，不需要异步流程
                return false;
            }

            // 移动已在逻辑层完成，开始异步流程
            const tgtSlot = this.gameState.slots[result.data.targetIndex];
            const moveContext = {
                sourceBlockCount: srcCount,
                targetBlockCount: tgtSlot.blocks.length - result.data.moveCount,
            };

            this.gameState.status = 'animating';

            // 1. 等待移动动画
            await this._emitAsync('onMoveExecuted', result.data, moveContext);

            // 2. 检测交付
            const delivery = this.gameState.checkDelivery();
            if (delivery.canDeliver) {
                await this._executeSingleDelivery(delivery.slotIndex, delivery.orderIndex);

                // 两个订单都完成 → 补充 + 新一轮
                if (this.gameState.allOrdersCompleted()) {
                    await this._executeRefillAndNewRound();
                }
            } else {
                // 没有交付，检查死局
                const go = this.gameState.checkGameOver();
                if (go.gameOver) {
                    this._onGameOver(go.reason);
                    return true;
                }
            }

            // 恢复可操作状态
            if (this.gameState.status !== 'gameover') {
                this.gameState.status = 'playing';
            }
            this._emit('onHUDUpdate', this.gameState);

            return true;
        }

        // ===== 交付流程 =====

        async _executeSingleDelivery(slotIndex, orderIndex) {
            this.gameState.status = 'delivering';
            const order = this.gameState.orders[orderIndex];
            const slotBlocksBefore = this.gameState.slots[slotIndex].blocks.length;

            // 逻辑层执行交付
            this.gameState.executeDelivery(slotIndex, orderIndex);
            this._emit('onHUDUpdate', this.gameState);
            this._emit('onOrderComplete');

            // 等待交付动画
            await this._emitAsync('onDelivery', slotIndex, order, slotBlocksBefore);

            this._emit('onHUDUpdate', this.gameState);
        }

        // ===== 补充 + 新一轮 =====

        async _executeRefillAndNewRound() {
            // 1. 逻辑层执行补充
            const colorCount = this.difficultyManager.getAvailableColorCount(this.gameState.completedOrders);
            const refillResult = this.gameState.executeRefill(colorCount);

            // 2. 等待补充动画
            await this._emitAsync('onRefill', refillResult.refillData);

            // 3. 溢出处理
            if (refillResult.overflowData.length > 0) {
                await this._emitAsync('onOverflow', refillResult.overflowData);
                this._emit('onHPDamage');
            }

            this._emit('onHUDUpdate', this.gameState);

            // 4. 游戏结束检查
            const go = this.gameState.checkGameOver();
            if (go.gameOver) {
                this._onGameOver(go.reason);
                return;
            }

            // 5. 难度调整
            const transition = this.difficultyManager.checkStageTransition(this.gameState.completedOrders);
            if (transition.needsAdjust) {
                const oldParams = this.difficultyManager.getParams(this.gameState.completedOrders - 1);
                this.difficultyManager.adjustBoard(this.gameState.slots, oldParams, transition.params);
                this._emit('onBoardChanged');
            }

            // 6. 生成新订单
            this._generateNewOrders();
            this._emit('onHUDUpdate', this.gameState);
        }

        // ===== 游戏结束 =====

        _onGameOver(reason) {
            this.gameState.status = 'gameover';
            this._emit('onHUDUpdate', this.gameState);
            this._emit('onGameOver', this.gameState.completedOrders, reason);
        }
    }

    window.GameFlowController = GameFlowController;
})();
