/**
 * UIManager.js - DOM UI 管理 + 页面路由
 * 管理 菜单 / 关卡选择 / 游戏HUD / 结算弹窗 的切换
 */
(function() {
    'use strict';

    class UIManager {
        constructor() {
            this.menuScreen = null;
            this.levelSelectScreen = null;
            this.gameHUD = null;
            this.resultPopup = null;
            this.tutorialOverlay = null;
            this.leaderboardPanel = null;
            this.leaderboardService = null;
            this.currentScreen = null; // 'menu' | 'level-select' | 'game' | 'result'
        }

        /**
         * 初始化所有 UI 组件
         * @param {object} callbacks
         * @param {LevelManager} levelManager
         */
        init(callbacks, levelManager) {
            // 排行榜服务
            this.leaderboardService = new LeaderboardService();

            this.menuScreen = new MenuScreen({
                onEndless: callbacks.onStartEndless,
                onLevel: callbacks.onShowLevelSelect,
                onLeaderboard: () => this.showLeaderboard(),
            });
            this.levelSelectScreen = new LevelSelectScreen({
                onSelectLevel: callbacks.onSelectLevel,
                onBack: callbacks.onBackToMenu,
            }, levelManager);
            this.gameHUD = new GameHUD(callbacks.onRestart);
            this.resultPopup = new ResultPopup({
                onRestart: callbacks.onRestart,
                onBackToMenu: callbacks.onBackToMenu,
                onBackToLevelSelect: callbacks.onBackToLevelSelect,
                onNextLevel: callbacks.onNextLevel,
                onRetryLevel: callbacks.onRetryLevel,
                onShowLeaderboard: (score) => this.showLeaderboard(score),
            });
            this.tutorialOverlay = new TutorialOverlay();
            this.leaderboardPanel = new LeaderboardPanel(this.leaderboardService);

            this.menuScreen.create();
            this.levelSelectScreen.create();
            this.gameHUD.create();
            this.resultPopup.create();
            this.resultPopup.setLeaderboardService(this.leaderboardService);
            this.tutorialOverlay.create();
            this.leaderboardPanel.create();
        }

        /**
         * 显示排行榜
         * @param {number} [highlightScore] - 高亮当前分数
         */
        showLeaderboard(highlightScore) {
            if (this.leaderboardPanel) {
                this.leaderboardPanel.show(highlightScore);
            }
        }

        /**
         * 切换到主菜单
         */
        showMenu() {
            this.currentScreen = 'menu';
            this.menuScreen.show();
            this.levelSelectScreen.hide();
            this.gameHUD.hide();
            this.resultPopup.hide();
        }

        /**
         * 切换到关卡选择
         */
        showLevelSelect() {
            this.currentScreen = 'level-select';
            this.menuScreen.hide();
            this.levelSelectScreen.show();
            this.gameHUD.hide();
            this.resultPopup.hide();
        }

        /**
         * 切换到游戏场景
         * @param {object|null} levelConfig - 关卡配置（无尽模式传 null）
         */
        showGame(levelConfig) {
            this.currentScreen = 'game';
            this.menuScreen.hide();
            this.levelSelectScreen.hide();
            this.gameHUD.show();
            this.gameHUD.setLevelInfo(levelConfig);
            this.resultPopup.hide();
        }

        /**
         * 显示结算弹窗（游戏失败，叠加在游戏 HUD 上）
         */
        showResult(completedOrders, reason, score, maxCombo, gameMode, levelConfig) {
            this.currentScreen = 'result';
            this.resultPopup.show(completedOrders, reason, score, maxCombo, gameMode, levelConfig);
        }

        /**
         * 显示关卡通关弹窗
         */
        showLevelClear(levelId, stars, score, completedOrders, maxCombo, isLastLevel) {
            this.currentScreen = 'result';
            this.resultPopup.showLevelClear(levelId, stars, score, completedOrders, maxCombo, isLastLevel);
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
