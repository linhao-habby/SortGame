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
                    <div class="hud-orders-wrap" id="ui-orders-wrap"></div>
                    <div class="hud-score-area">
                        <div class="hud-score-num" id="ui-score">0</div>
                        <div class="hud-combo" id="ui-combo"></div>
                    </div>
                </div>
                <div class="hud-bottom">
                    <button class="btn-restart" id="ui-btn-restart">重来</button>
                </div>
            `;
            document.body.appendChild(this.el);

            this._hpEl = this.el.querySelector('#ui-hp-hearts');
            this._ordersWrap = this.el.querySelector('#ui-orders-wrap');
            this._orderEls = [];
            this._orderBoxEls = [];
            this._scoreEl = this.el.querySelector('#ui-score');
            this._comboEl = this.el.querySelector('#ui-combo');
            this._currentOrderCount = 0;

            this.el.querySelector('#ui-btn-restart').addEventListener('click', () => {
                if (this.onRestart) this.onRestart();
            });
        }

        /**
         * 动态创建订单 DOM 元素（当订单数量变化时调用）
         */
        _ensureOrderSlots(count) {
            if (count === this._currentOrderCount) return;
            this._ordersWrap.innerHTML = '';
            this._orderEls = [];
            this._orderBoxEls = [];
            for (let i = 0; i < count; i++) {
                const box = document.createElement('div');
                box.className = 'hud-order';
                box.id = `ui-order-${i}`;
                const detail = document.createElement('span');
                detail.className = 'order-detail';
                detail.id = `ui-order-detail-${i}`;
                detail.textContent = '-';
                box.appendChild(detail);
                this._ordersWrap.appendChild(box);
                this._orderEls.push(detail);
                this._orderBoxEls.push(box);
            }
            this._currentOrderCount = count;
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

            // 动态订单（1~3 个）
            const orderCount = gs.orders.length;
            this._ensureOrderSlots(orderCount);

            for (let i = 0; i < orderCount; i++) {
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
            this._scoreEl.textContent = gs.score || 0;

            // combo + 进度条
            if (gs.combo >= 1) {
                const progress = gs.comboProgress !== undefined ? gs.comboProgress : 1;
                if (gs.combo >= 2) {
                    this._comboEl.innerHTML = `COMBO x${gs.combo} <div class="combo-bar"><div class="combo-bar-fill" style="width:${Math.round(progress * 100)}%"></div></div>`;
                    this._comboEl.className = 'hud-combo hud-combo-active';
                } else {
                    this._comboEl.innerHTML = `<div class="combo-bar"><div class="combo-bar-fill" style="width:${Math.round(progress * 100)}%"></div></div>`;
                    this._comboEl.className = 'hud-combo hud-combo-pending';
                }
            } else {
                this._comboEl.innerHTML = '';
                this._comboEl.className = 'hud-combo';
            }
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
         * 显示浮动得分
         */
        showScoreGain(scoreResult) {
            if (!this.el || !scoreResult || scoreResult.gain <= 0) return;
            const float = document.createElement('div');
            float.className = 'hud-score-float';
            let text = `+${scoreResult.gain}`;
            if (scoreResult.combo >= 2) text += ` combo x${scoreResult.combo}`;
            float.textContent = text;
            this.el.appendChild(float);
            setTimeout(() => float.remove(), 1200);
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
