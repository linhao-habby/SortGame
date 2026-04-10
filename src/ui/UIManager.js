/**
 * UIManager.js - DOM UI 管理 + 页面路由
 * 管理 菜单 / 游戏HUD / 结算弹窗 的切换
 */
(function() {
    'use strict';

    class UIManager {
        constructor() {
            this.menuScreen = null;
            this.gameHUD = null;
            this.resultPopup = null;
            this.tutorialOverlay = null;
            this.currentScreen = null; // 'menu' | 'game' | 'result'
        }

        /**
         * 初始化所有 UI 组件
         * @param {object} callbacks - { onStartGame, onRestart, onBackToMenu }
         */
        init(callbacks) {
            this.menuScreen = new MenuScreen(callbacks.onStartGame);
            this.gameHUD = new GameHUD(callbacks.onRestart);
            this.resultPopup = new ResultPopup(callbacks.onRestart, callbacks.onBackToMenu);
            this.tutorialOverlay = new TutorialOverlay();

            this.menuScreen.create();
            this.gameHUD.create();
            this.resultPopup.create();
            this.tutorialOverlay.create();
        }

        /**
         * 切换到主菜单
         */
        showMenu() {
            this.currentScreen = 'menu';
            this.menuScreen.show();
            this.gameHUD.hide();
            this.resultPopup.hide();
        }

        /**
         * 切换到游戏场景
         */
        showGame() {
            this.currentScreen = 'game';
            this.menuScreen.hide();
            this.gameHUD.show();
            this.resultPopup.hide();
        }

        /**
         * 显示结算弹窗（叠加在游戏 HUD 上）
         * @param {number} completedOrders
         * @param {string} reason
         */
        showResult(completedOrders, reason, score, maxCombo) {
            this.currentScreen = 'result';
            this.resultPopup.show(completedOrders, reason, score, maxCombo);
        }

        /**
         * 更新游戏 HUD
         * @param {GameState} gameState
         */
        updateHUD(gameState) {
            if (this.gameHUD) {
                this.gameHUD.update(gameState);
            }
        }
    }

    window.UIManager = UIManager;
})();
