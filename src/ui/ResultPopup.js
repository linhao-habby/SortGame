/**
 * ResultPopup.js - 游戏结束结算弹窗
 */
(function() {
    'use strict';

    class ResultPopup {
        /**
         * @param {function} onRestart - 重新开始回调
         * @param {function} onBackToMenu - 返回主菜单回调
         */
        constructor(onRestart, onBackToMenu) {
            this.onRestart = onRestart;
            this.onBackToMenu = onBackToMenu;
            this.el = null;
            this._titleEl = null;
            this._scoreEl = null;
            this._reasonEl = null;
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'gameover-popup';
            this.el.style.display = 'none';
            this.el.innerHTML = `
                <div class="gameover-content">
                    <h2 class="gameover-title" id="ui-go-title">游戏结束</h2>
                    <p class="gameover-reason" id="ui-go-reason"></p>
                    <div class="gameover-score-wrap">
                        <span class="gameover-score-label">完成订单</span>
                        <span class="gameover-score-num" id="ui-go-score">0</span>
                    </div>
                    <p class="gameover-best" id="ui-go-best"></p>
                    <div class="gameover-buttons">
                        <button class="btn-restart-big" id="ui-go-restart">重新开始</button>
                        <button class="btn-back-menu" id="ui-go-menu">主菜单</button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.el);

            this._titleEl = this.el.querySelector('#ui-go-title');
            this._scoreEl = this.el.querySelector('#ui-go-score');
            this._reasonEl = this.el.querySelector('#ui-go-reason');
            this._bestEl = this.el.querySelector('#ui-go-best');

            this.el.querySelector('#ui-go-restart').addEventListener('click', () => {
                if (this.onRestart) this.onRestart();
            });
            this.el.querySelector('#ui-go-menu').addEventListener('click', () => {
                if (this.onBackToMenu) this.onBackToMenu();
            });
        }

        /**
         * 显示结算弹窗
         * @param {number} completedOrders
         * @param {string} reason - 'hp_zero' | 'deadlock'
         */
        show(completedOrders, reason) {
            if (!this.el) return;

            this._scoreEl.textContent = completedOrders;

            // 最高纪录
            let best = parseInt(localStorage.getItem('sortgame_best') || '0', 10);
            const isNewBest = completedOrders > best;
            if (isNewBest) {
                best = completedOrders;
                localStorage.setItem('sortgame_best', String(best));
            }
            this._bestEl.textContent = isNewBest ? '新纪录！' : '最高纪录: ' + best;
            this._bestEl.className = isNewBest ? 'gameover-best gameover-new-best' : 'gameover-best';

            if (reason === 'hp_zero') {
                this._titleEl.textContent = '游戏结束';
                this._reasonEl.textContent = '色块溢出过多，血量耗尽！';
            } else if (reason === 'deadlock') {
                this._titleEl.textContent = '游戏结束';
                this._reasonEl.textContent = '棋盘无可用操作！';
            } else {
                this._titleEl.textContent = '游戏结束';
                this._reasonEl.textContent = '';
            }

            this.el.style.display = 'flex';
            // 触发动画
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
