/**
 * Game.js - 游戏主类
 * 
 * 职责：模块组装、渲染循环驱动、回调接线
 *   - 创建并连接所有模块（玩法、渲染、输入、UI）
 *   - 将 GameFlowController 的玩法事件连接到动画/UI
 *   - 驱动 60fps 渲染循环
 * 
 * 玩法逻辑全部在 GameFlowController 中，本文件不含任何玩法判定。
 * 渲染/动画细节在 rendering/ 中，本文件只做调度。
 */
(function() {
    'use strict';

    class Game {
        constructor(canvas) {
            this.canvas = canvas;

            // 玩法流程控制器（纯逻辑，在 game/ 目录）
            this.flowController = new GameFlowController();

            // 渲染模块
            this.renderer = null;
            this.blockRenderer = null;
            this.slotRenderer = null;

            // 动画模块
            this.tweenManager = new TweenManager();
            this.animationManager = new AnimationManager(this.tweenManager);

            // 输入模块
            this.inputManager = null;

            // UI 模块
            this.uiManager = new UIManager();

            // 游戏循环
            this.gameLoop = null;

            // 布局数据（渲染层使用）
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

            // 7. 注册玩法流程回调（连接玩法事件 → 动画/UI）
            this._bindFlowCallbacks();

            // 8. 显示主菜单
            this.uiManager.showMenu();

            return true;
        }

        // ===== 玩法流程回调注册 =====

        _bindFlowCallbacks() {
            const gs = () => this.flowController.gameState;

            this.flowController.setCallbacks({
                onHUDUpdate: (gameState) => {
                    this.uiManager.updateHUD(gameState);
                },

                onMoveExecuted: async (moveData, moveContext) => {
                    await this.animationManager.playMoveAnimation(moveData, this.layout, moveContext);
                },

                onDelivery: async (slotIndex, order, slotBlocksBefore) => {
                    await this.animationManager.playDeliverAnimation(
                        slotIndex, order.count, order.color, this.layout, slotBlocksBefore
                    );
                },

                onOrderComplete: () => {
                    if (this.uiManager.gameHUD) {
                        this.uiManager.gameHUD.flashOrderComplete();
                    }
                },

                onRefill: async (refillData) => {
                    await this.animationManager.playRefillAnimation(refillData, this.layout);
                },

                onOverflow: async (overflowData) => {
                    await this.animationManager.playOverflowAnimation(overflowData, this.layout);
                },

                onHPDamage: () => {
                    if (this.uiManager.gameHUD) {
                        this.uiManager.gameHUD.flashHP();
                    }
                },

                onBoardChanged: () => {
                    this._recalcLayout();
                    this._recalcHitAreas();
                },

                onGameOver: (completedOrders, reason) => {
                    this.inputManager.lock();
                    this.canvas.classList.add('gameover');
                    setTimeout(() => {
                        this.uiManager.showResult(completedOrders, reason);
                    }, 600);
                },

                onNewOrders: (orders) => {
                    // 预留：可用于订单生成动画
                },
            });
        }

        // ===== 游戏流程（仅启动/重启/菜单切换） =====

        _startGame() {
            this._gameStarted = true;
            this.uiManager.showGame();
            this.animationManager.clear();
            this.flowController.initGame();
            this.inputManager.unlock();
        }

        _restartGame() {
            this.canvas.classList.remove('gameover');
            this.uiManager.resultPopup.hide();
            this.uiManager.showGame();
            this.animationManager.clear();
            this.flowController.restartGame();
            this.inputManager.unlock();
        }

        _backToMenu() {
            this.canvas.classList.remove('gameover');
            this._gameStarted = false;
            this.inputManager.lock();
            this.animationManager.clear();
            this.uiManager.showMenu();
        }

        // ===== 输入处理 =====

        async _onSlotTap(slotIndex) {
            if (this.animationManager.isBusy) return;

            this.inputManager.lock();
            const wasAsync = await this.flowController.handleSlotTap(slotIndex);

            if (this.flowController.gameState.status !== 'gameover') {
                this.inputManager.unlock();
            }
        }

        // ===== 布局计算（渲染层数据） =====

        _recalcLayout() {
            const slots = this.flowController.gameState.slots;
            const count = slots.length;
            const capacity = slots[0] ? slots[0].capacity : 5;
            const cols = this._calcCols(count);
            const rows = Math.ceil(count / cols);

            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            const slotW = GameConfig.RENDER.SLOT_INNER_WIDTH + GameConfig.RENDER.SLOT_WALL_THICKNESS * 2;
            const slotH = cellH * capacity;
            const gapX = GameConfig.RENDER.SLOT_GAP;
            const gapY = GameConfig.RENDER.ROW_GAP;
            const cellW = slotW + gapX;
            const cellTotalH = slotH + gapY;

            const totalW = cols * cellW - gapX;
            const totalH = rows * cellTotalH - gapY;
            const offsetX = -totalW / 2 + slotW / 2;
            const offsetY = -totalH / 2;

            this.layout.slotPositions = [];
            for (let i = 0; i < count; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                this.layout.slotPositions.push({
                    x: offsetX + col * cellW,
                    y: offsetY + (rows - 1 - row) * cellTotalH,
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

        // ===== 渲染循环 =====

        start() {
            this.gameLoop.start();
        }

        _update(dt, now) {
            const dtMs = dt * 1000;
            this.animationManager.update(dtMs);

            if (!this._gameStarted) {
                const { commandEncoder, renderPass } = this.renderer.beginFrame();
                this.renderer.drawBackground(renderPass);
                this.renderer.endFrame(commandEncoder, renderPass);
                return;
            }

            // 更新渲染数据
            this.blockRenderer.update(this.flowController.gameState, this.layout, null);

            // 飞行中的色块
            const flyingBlocks = this.animationManager.getFlyingBlocks();
            for (const fb of flyingBlocks) {
                this.blockRenderer.addFlyingBlock(fb.x, fb.y, fb.z, fb.color, false);
            }

            this.slotRenderer.update(this.flowController.gameState, this.layout);

            // 渲染
            const { commandEncoder, renderPass } = this.renderer.beginFrame();
            this.renderer.drawBackground(renderPass);
            this.slotRenderer.draw(renderPass);
            this.blockRenderer.draw(renderPass);
            this.renderer.endFrame(commandEncoder, renderPass);
        }
    }

    window.Game = Game;
})();
