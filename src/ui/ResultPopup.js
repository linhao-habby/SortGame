/**
 * ResultPopup.js - 游戏结束/通关结算弹窗
 * 支持无尽模式（游戏结束）和关卡模式（通关/失败）
 */
(function() {
    'use strict';

    class ResultPopup {
        /**
         * @param {object} callbacks - { onRestart, onBackToMenu, onBackToLevelSelect, onNextLevel, onRetryLevel }
         */
        constructor(callbacks) {
            this.callbacks = callbacks || {};
            this.el = null;
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'gameover-popup';
            this.el.style.display = 'none';
            this.el.innerHTML = `
                <div class="gameover-content">
                    <h2 class="gameover-title" id="ui-go-title">游戏结束</h2>
                    <p class="gameover-reason" id="ui-go-reason"></p>
                    <div class="level-clear-stars" id="ui-go-stars" style="display:none"></div>
                    <div class="gameover-score-wrap">
                        <span class="gameover-score-label">得分</span>
                        <span class="gameover-score-num" id="ui-go-score">0</span>
                    </div>
                    <div class="gameover-stats" id="ui-go-stats"></div>
                    <p class="gameover-best" id="ui-go-best"></p>
                    <div class="gameover-buttons" id="ui-go-buttons"></div>
                </div>
            `;
            document.body.appendChild(this.el);
        }

        /**
         * 显示结算弹窗（游戏失败 / 无尽模式结束）
         */
        show(completedOrders, reason, score, maxCombo, gameMode, levelConfig) {
            if (!this.el) return;

            score = score || 0;
            maxCombo = maxCombo || 0;

            const titleEl = this.el.querySelector('#ui-go-title');
            const reasonEl = this.el.querySelector('#ui-go-reason');
            const scoreEl = this.el.querySelector('#ui-go-score');
            const statsEl = this.el.querySelector('#ui-go-stats');
            const bestEl = this.el.querySelector('#ui-go-best');
            const starsEl = this.el.querySelector('#ui-go-stars');
            const buttonsEl = this.el.querySelector('#ui-go-buttons');

            starsEl.style.display = 'none';
            starsEl.innerHTML = '';
            scoreEl.textContent = score;

            const reasonText = reason === 'hp_zero' ? '色块溢出过多，血量耗尽！'
                : reason === 'deadlock' ? '棋盘无可用操作！' : '';

            if (gameMode === 'level' && levelConfig) {
                // 关卡模式失败
                titleEl.textContent = '挑战失败';
                reasonEl.textContent = reasonText;
                statsEl.innerHTML = `进度: ${completedOrders}/${levelConfig.targetOrders}　最大连击: ${maxCombo}`;
                bestEl.textContent = '';
                bestEl.className = 'gameover-best';

                buttonsEl.innerHTML = `
                    <button class="btn-restart-big" id="ui-go-retry">重新挑战</button>
                    <button class="btn-back-menu" id="ui-go-level-select">关卡选择</button>
                `;
                buttonsEl.querySelector('#ui-go-retry').addEventListener('click', () => {
                    if (this.callbacks.onRetryLevel) this.callbacks.onRetryLevel();
                });
                buttonsEl.querySelector('#ui-go-level-select').addEventListener('click', () => {
                    if (this.callbacks.onBackToLevelSelect) this.callbacks.onBackToLevelSelect();
                });
            } else {
                // 无尽模式结束
                titleEl.textContent = '游戏结束';
                reasonEl.textContent = reasonText;
                statsEl.innerHTML = `完成订单: ${completedOrders}　最大连击: ${maxCombo}`;

                let best = parseInt(localStorage.getItem('sortgame_best_score') || '0', 10);
                const isNewBest = score > best;
                if (isNewBest) {
                    best = score;
                    localStorage.setItem('sortgame_best_score', String(best));
                }
                bestEl.textContent = isNewBest ? '新纪录！' : '最高纪录: ' + best;
                bestEl.className = isNewBest ? 'gameover-best gameover-new-best' : 'gameover-best';

                buttonsEl.innerHTML = `
                    <div class="name-input-row" id="ui-go-name-row">
                        <input type="text" id="ui-go-name" placeholder="输入昵称" maxlength="12" />
                    </div>
                    <div class="leaderboard-submit-status" id="ui-go-submit-status"></div>
                    <button class="result-btn-leaderboard" id="ui-go-lb" style="width:100%">查看排行榜</button>
                    <button class="btn-restart-big" id="ui-go-restart">重新开始</button>
                    <button class="btn-back-menu" id="ui-go-menu">主菜单</button>
                `;

                // 昵称输入（修改后自动保存）
                const nameInput = buttonsEl.querySelector('#ui-go-name');
                const svc = this._getLeaderboardService();
                if (svc) {
                    nameInput.value = svc.getPlayerName() || 'Player';
                    nameInput.addEventListener('change', () => {
                        svc.setPlayerName(nameInput.value.trim() || 'Player');
                    });
                }

                // 自动提交分数
                this._autoSubmitScore(score, completedOrders, maxCombo, buttonsEl);

                // 查看排行榜
                buttonsEl.querySelector('#ui-go-lb').addEventListener('click', () => {
                    if (this.callbacks.onShowLeaderboard) this.callbacks.onShowLeaderboard(score);
                });

                buttonsEl.querySelector('#ui-go-restart').addEventListener('click', () => {
                    if (this.callbacks.onRestart) this.callbacks.onRestart();
                });
                buttonsEl.querySelector('#ui-go-menu').addEventListener('click', () => {
                    if (this.callbacks.onBackToMenu) this.callbacks.onBackToMenu();
                });
            }

            this._showPopup();
        }

        /**
         * 显示关卡通关弹窗
         */
        showLevelClear(levelId, stars, score, completedOrders, maxCombo, isLastLevel) {
            if (!this.el) return;

            const titleEl = this.el.querySelector('#ui-go-title');
            const reasonEl = this.el.querySelector('#ui-go-reason');
            const scoreEl = this.el.querySelector('#ui-go-score');
            const statsEl = this.el.querySelector('#ui-go-stats');
            const bestEl = this.el.querySelector('#ui-go-best');
            const starsEl = this.el.querySelector('#ui-go-stars');
            const buttonsEl = this.el.querySelector('#ui-go-buttons');

            const config = GameConfig.LEVEL_DATA[levelId - 1];
            const chapterName = config ? config.chapter : '';

            titleEl.textContent = '通关！';
            reasonEl.textContent = `第 ${levelId} 关 \u00B7 ${chapterName}`;
            scoreEl.textContent = score || 0;
            statsEl.innerHTML = `完成订单: ${completedOrders}　最大连击: ${maxCombo || 0}`;
            bestEl.textContent = '';
            bestEl.className = 'gameover-best';

            // 星星
            starsEl.style.display = 'flex';
            starsEl.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                const starEl = document.createElement('span');
                starEl.className = i < stars ? 'level-clear-star earned' : 'level-clear-star empty';
                starEl.textContent = i < stars ? '\u2605' : '\u2606';
                starEl.style.animationDelay = `${i * 0.15}s`;
                starsEl.appendChild(starEl);
            }

            // 按钮
            let buttonsHtml = '';
            if (!isLastLevel) {
                buttonsHtml += `<button class="btn-restart-big" id="ui-go-next">下一关</button>`;
            } else {
                buttonsHtml += `<div class="level-all-clear">全部通关！</div>`;
            }
            buttonsHtml += `<button class="btn-back-menu" id="ui-go-retry-clear">重新挑战</button>`;
            buttonsHtml += `<button class="btn-back-menu" id="ui-go-level-select-clear">关卡选择</button>`;
            buttonsEl.innerHTML = buttonsHtml;

            if (!isLastLevel) {
                buttonsEl.querySelector('#ui-go-next').addEventListener('click', () => {
                    if (this.callbacks.onNextLevel) this.callbacks.onNextLevel();
                });
            }
            buttonsEl.querySelector('#ui-go-retry-clear').addEventListener('click', () => {
                if (this.callbacks.onRetryLevel) this.callbacks.onRetryLevel();
            });
            buttonsEl.querySelector('#ui-go-level-select-clear').addEventListener('click', () => {
                if (this.callbacks.onBackToLevelSelect) this.callbacks.onBackToLevelSelect();
            });

            this._showPopup();
        }

        /**
         * 自动提交分数到排行榜
         */
        async _autoSubmitScore(score, completedOrders, maxCombo, buttonsEl) {
            const svc = this._getLeaderboardService();
            if (!svc) return;

            const statusEl = buttonsEl.querySelector('#ui-go-submit-status');
            const nameInput = buttonsEl.querySelector('#ui-go-name');
            statusEl.textContent = '正在提交分数...';
            statusEl.style.color = 'rgba(255, 200, 100, 0.5)';

            const name = (nameInput ? nameInput.value.trim() : '') || svc.getPlayerName() || 'Player';
            svc.setPlayerName(name);

            const ok = await svc.submitScore({
                name, score, orders: completedOrders, combo: maxCombo,
            });

            if (ok) {
                statusEl.textContent = '分数已提交';
                statusEl.style.color = 'rgba(100, 255, 100, 0.7)';
            } else {
                statusEl.textContent = '提交失败，可稍后查看排行榜重试';
                statusEl.style.color = 'rgba(255, 100, 100, 0.7)';
            }
        }

        /**
         * 设置排行榜服务（由 UIManager 注入）
         */
        setLeaderboardService(svc) {
            this._leaderboardService = svc;
        }

        _getLeaderboardService() {
            if (!this._leaderboardService && window.LeaderboardService) {
                this._leaderboardService = new LeaderboardService();
            }
            return this._leaderboardService;
        }

        _showPopup() {
            this.el.style.display = 'flex';
            const content = this.el.querySelector('.gameover-content');
            content.style.animation = 'none';
            requestAnimationFrame(() => {
                content.style.animation = 'popup-in 0.35s ease-out';
            });
        }

        hide() {
            if (this.el) this.el.style.display = 'none';
        }
    }

    window.ResultPopup = ResultPopup;
})();
