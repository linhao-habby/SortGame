/**
 * Game.js - 游戏主类
 * 协调所有模块：游戏逻辑、渲染、布局、输入、动画、UI
 */
(function() {
    'use strict';

    class Game {
        constructor(canvas) {
            this.canvas = canvas;

            // 核心模块
            this.renderer = null;
            this.gameState = new GameState();
            this.difficultyManager = new DifficultyManager();
            this.orderManager = new OrderManager();
            this.gameLoop = null;

            // 渲染模块
            this.blockRenderer = null;
            this.slotRenderer = null;

            // 动画模块
            this.tweenManager = new TweenManager();
            this.animationManager = new AnimationManager(this.tweenManager);

            // 输入模块
            this.inputManager = null;

            // UI 模块
            this.uiManager = new UIManager();

            // 布局数据
            this.layout = { slotPositions: [] };

            // 状态
            this._gameStarted = false;
        }

        async init() {
            // 1. 渲染器
            this.renderer = new Renderer(this.canvas);
            const ok = await this.renderer.init();
            if (!ok) return false;

            // 2. 子渲染器
            this.blockRenderer = new BlockRenderer(this.renderer);
            this.slotRenderer = new SlotRenderer(this.renderer);

            // 3. 输入
            this.inputManager = new InputManager(this.canvas, (slotIndex) => {
                this._onSlotTap(slotIndex);
            });
            this.inputManager.lock(); // 菜单时锁定

            // 4. UI
            this.uiManager.init({
                onStartGame: () => this._startGame(),
                onRestart: () => this._restartGame(),
                onBackToMenu: () => this._backToMenu(),
            });

            // 5. 游戏循环
            this.gameLoop = new GameLoop((dt, now) => this._update(dt, now));

            // 6. resize
            window.addEventListener('resize', () => {
                this.renderer.resize();
                if (this._gameStarted) {
                    this._recalcLayout();
                    this._recalcHitAreas();
                }
            });

            // 7. 显示主菜单
            this.uiManager.showMenu();

            return true;
        }

        // ===== 游戏流程 =====

        _startGame() {
            this._gameStarted = true;
            this.uiManager.showGame();
            this._initGame();
            this.inputManager.unlock();
        }

        _restartGame() {
            this.canvas.classList.remove('gameover');
            this.uiManager.resultPopup.hide();
            this.uiManager.showGame();
            this._initGame();
            this.inputManager.unlock();
        }

        _backToMenu() {
            this.canvas.classList.remove('gameover');
            this._gameStarted = false;
            this.inputManager.lock();
            this.animationManager.clear();
            this.uiManager.showMenu();
        }

        _initGame() {
            this.difficultyManager.reset();
            this.orderManager.reset();
            this.animationManager.clear();

            const params = this.difficultyManager.getInitialParams();
            this.gameState.initBoard(params);
            this.difficultyManager.checkStageTransition(0);

            // 生成 2 个订单
            this._generateNewOrders();

            this._recalcLayout();
            this._recalcHitAreas();
            this.uiManager.updateHUD(this.gameState);
        }

        _generateNewOrders() {
            const normalCount = this.gameState.getNormalSlotCount();
            this.gameState.orders = this.orderManager.generateOrders(
                this.gameState.slots,
                this.gameState.completedOrders,
                this.difficultyManager,
                normalCount
            );
        }

        // ===== 布局 =====

        _recalcLayout() {
            const slots = this.gameState.slots;
            const count = slots.length;
            const capacity = slots[0] ? slots[0].capacity : 5;
            const cols = this._calcCols(count);
            const rows = Math.ceil(count / cols);

            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            const slotW = GameConfig.RENDER.SLOT_INNER_WIDTH + GameConfig.RENDER.SLOT_WALL_THICKNESS * 2;
            const slotH = cellH * capacity; // 每个木槽的渲染高度
            const gapX = GameConfig.RENDER.SLOT_GAP;
            const gapY = GameConfig.RENDER.ROW_GAP;
            const cellW = slotW + gapX;
            const cellTotalH = slotH + gapY;

            // 居中
            const totalW = cols * cellW - gapX;
            const totalH = rows * cellTotalH - gapY;
            const offsetX = -totalW / 2 + slotW / 2;
            const offsetY = -totalH / 2; // 木槽底部对齐

            this.layout.slotPositions = [];
            for (let i = 0; i < count; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                this.layout.slotPositions.push({
                    x: offsetX + col * cellW,
                    y: offsetY + (rows - 1 - row) * cellTotalH, // 第一行在上方
                });
            }
        }

        _calcCols(count) {
            if (count <= 3) return count;
            if (count <= 6) return 3;
            if (count <= 8) return 4;
            if (count <= 10) return 5;
            return 5;
        }

        _recalcHitAreas() {
            if (!this.inputManager || !this.renderer) return;
            const rect = this.canvas.getBoundingClientRect();
            this.inputManager.recalcHitAreas(
                this.layout,
                this.renderer.viewProjMatrix,
                rect.width,
                rect.height
            );
        }

        // ===== 游戏循环 =====

        start() {
            this.gameLoop.start();
        }

        _update(dt, now) {
            const dtMs = dt * 1000;

            // 更新动画
            this.animationManager.update(dtMs);

            if (!this._gameStarted) {
                // 菜单状态也要渲染背景
                const { commandEncoder, renderPass } = this.renderer.beginFrame();
                this.renderer.drawBackground(renderPass);
                this.renderer.endFrame(commandEncoder, renderPass);
                return;
            }

            // 更新渲染数据
            this.blockRenderer.update(this.gameState, this.layout, null);

            // 渲染飞行中的色块
            const flyingBlocks = this.animationManager.getFlyingBlocks();
            for (const fb of flyingBlocks) {
                this.blockRenderer.addFlyingBlock(fb.x, fb.y, fb.z, fb.color, false);
            }

            this.slotRenderer.update(this.gameState, this.layout);

            // 渲染
            const { commandEncoder, renderPass } = this.renderer.beginFrame();
            this.renderer.drawBackground(renderPass);
            this.slotRenderer.draw(renderPass);
            this.blockRenderer.draw(renderPass);
            this.renderer.endFrame(commandEncoder, renderPass);
        }

        // ===== 输入处理 =====

        _onSlotTap(slotIndex) {
            if (this.animationManager.isBusy) return;
            if (this.gameState.status !== 'playing') return;

            // 记录移动前的色块数量（供动画计算坐标）
            const srcSlot = this.gameState.slots[slotIndex];
            const srcCount = srcSlot ? srcSlot.blocks.length : 0;

            const result = this.gameState.selectSlot(slotIndex);
            this.uiManager.updateHUD(this.gameState);

            if (result.action === 'moved') {
                // 移动已在逻辑层完成，计算动画上下文
                const tgtSlot = this.gameState.slots[result.data.targetIndex];
                const moveContext = {
                    sourceBlockCount: srcCount, // 移动前源槽色块数
                    targetBlockCount: tgtSlot.blocks.length - result.data.moveCount, // 移动前目标槽色块数
                };

                this.inputManager.lock();
                this.gameState.status = 'animating';
                this._playMoveAndCheck(result.data, moveContext);
            }
        }

        async _playMoveAndCheck(moveData, moveContext) {
            await this.animationManager.playMoveAnimation(moveData, this.layout, moveContext);

            // 检测是否有订单可交付
            const delivery = this.gameState.checkDelivery();
            if (delivery.canDeliver) {
                await this._executeSingleDelivery(delivery.slotIndex, delivery.orderIndex);

                // 交付后检查是否所有订单都完成了
                if (this.gameState.allOrdersCompleted()) {
                    await this._executeRefillAndNewRound();
                }
            } else {
                const go = this.gameState.checkGameOver();
                if (go.gameOver) {
                    this._onGameOver(go.reason);
                    return;
                }
            }

            if (this.gameState.status !== 'gameover') {
                this.gameState.status = 'playing';
                this.inputManager.unlock();
            }
            this.uiManager.updateHUD(this.gameState);
        }

        /**
         * 执行单个订单的交付（只飞走色块，不补充）
         */
        async _executeSingleDelivery(slotIndex, orderIndex) {
            this.gameState.status = 'delivering';
            const order = this.gameState.orders[orderIndex];
            const slotBlocksBefore = this.gameState.slots[slotIndex].blocks.length;

            // 交付逻辑
            this.gameState.executeDelivery(slotIndex, orderIndex);
            this.uiManager.updateHUD(this.gameState);
            if (this.uiManager.gameHUD) {
                this.uiManager.gameHUD.flashOrderComplete();
            }

            // 交付飞出动画
            await this.animationManager.playDeliverAnimation(
                slotIndex, order.count, order.color, this.layout, slotBlocksBefore
            );

            this.uiManager.updateHUD(this.gameState);
        }

        /**
         * 两个订单都完成后：补充 + 生成新一轮订单
         */
        async _executeRefillAndNewRound() {
            // 1. 补充
            const colorCount = this.difficultyManager.getAvailableColorCount(this.gameState.completedOrders);
            const refillResult = this.gameState.executeRefill(colorCount);

            // 2. 补充动画
            await this.animationManager.playRefillAnimation(refillResult.refillData, this.layout);

            // 3. 溢出动画
            if (refillResult.overflowData.length > 0) {
                await this.animationManager.playOverflowAnimation(refillResult.overflowData, this.layout);
                if (this.uiManager.gameHUD) {
                    this.uiManager.gameHUD.flashHP();
                }
            }

            this.uiManager.updateHUD(this.gameState);

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
                this._recalcLayout();
                this._recalcHitAreas();
            }

            // 6. 生成全新 2 个订单
            this._generateNewOrders();
            this.uiManager.updateHUD(this.gameState);
        }

        _onGameOver(reason) {
            this.gameState.status = 'gameover';
            this.inputManager.lock();
            this.uiManager.updateHUD(this.gameState);
            // 灰度化画面
            this.canvas.classList.add('gameover');
            // 延迟弹出结算
            setTimeout(() => {
                this.uiManager.showResult(this.gameState.completedOrders, reason);
            }, 600);
        }
    }

    window.Game = Game;
})();
