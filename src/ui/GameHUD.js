/**
 * GameHUD.js - 游戏内 HUD
 * 血量显示 + 订单栏 + 底部工具栏
 */
(function() {
    'use strict';

    class GameHUD {
        /**
         * @param {function} onRestart - 重来按钮回调
         */
        constructor(onRestart) {
            this.onRestart = onRestart;
            this.el = null;
            this._hpEl = null;
            this._orderEl = null;
            this._scoreEl = null;
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'game-hud';
            this.el.style.display = 'none';
            this.el.innerHTML = `
                <div class="hud-top">
                    <div class="hud-hp">
                        <span class="hp-label">HP</span>
                        <span class="hp-hearts" id="ui-hp-hearts"></span>
                    </div>
                    <div class="hud-orders-wrap" id="ui-orders-wrap">
                        <div class="hud-order" id="ui-order-0">
                            <span class="order-detail" id="ui-order-detail-0">-</span>
                        </div>
                        <div class="hud-order" id="ui-order-1">
                            <span class="order-detail" id="ui-order-detail-1">-</span>
                        </div>
                    </div>
                    <div class="hud-score">完成: <span id="ui-completed-count">0</span></div>
                </div>
                <div class="hud-bottom">
                    <button class="btn-restart" id="ui-btn-restart">重来</button>
                </div>
            `;
            document.body.appendChild(this.el);

            this._hpEl = this.el.querySelector('#ui-hp-hearts');
            this._orderEls = [
                this.el.querySelector('#ui-order-detail-0'),
                this.el.querySelector('#ui-order-detail-1'),
            ];
            this._orderBoxEls = [
                this.el.querySelector('#ui-order-0'),
                this.el.querySelector('#ui-order-1'),
            ];
            this._scoreEl = this.el.querySelector('#ui-completed-count');

            this.el.querySelector('#ui-btn-restart').addEventListener('click', () => {
                if (this.onRestart) this.onRestart();
            });
        }

        /**
         * 更新 HUD 显示
         * @param {GameState} gs
         */
        update(gs) {
            if (!this.el) return;

            // HP 红心
            let hp = '';
            for (let i = 0; i < GameConfig.INITIAL_HP; i++) {
                hp += i < gs.hp ? '\u2764' : '\u2661';
            }
            this._hpEl.textContent = hp;
            this._hpEl.className = gs.hp <= 3 ? 'hp-hearts hp-low' : 'hp-hearts';

            // 2 个订单
            for (let i = 0; i < 2; i++) {
                const order = gs.orders[i];
                const el = this._orderEls[i];
                const box = this._orderBoxEls[i];
                if (!el) continue;

                if (order && order.status === 'active') {
                    const c = GameConfig.COLORS[order.color];
                    el.innerHTML = `<span class="order-color" style="background:${c.hex}"></span> x${order.count}`;
                    box.classList.remove('order-done');
                } else if (order && order.status === 'completed') {
                    el.innerHTML = '<span class="order-check">\u2713</span>';
                    box.classList.add('order-done');
                } else {
                    el.textContent = '-';
                    box.classList.remove('order-done');
                }
            }

            // 分数
            this._scoreEl.textContent = gs.completedOrders;
        }

        /**
         * HP 扣血闪红动画
         */
        flashHP() {
            if (!this._hpEl) return;
            this._hpEl.classList.add('hp-flash');
            setTimeout(() => this._hpEl.classList.remove('hp-flash'), 400);
        }

        /**
         * 订单完成闪光
         */
        flashOrderComplete() {
            // 闪光最近完成的订单框
            for (const box of this._orderBoxEls) {
                if (box && box.classList.contains('order-done')) {
                    box.classList.add('order-complete-flash');
                    setTimeout(() => box.classList.remove('order-complete-flash'), 500);
                }
            }
        }

        show() {
            if (this.el) this.el.style.display = 'flex';
        }

        hide() {
            if (this.el) this.el.style.display = 'none';
        }
    }

    window.GameHUD = GameHUD;
})();
