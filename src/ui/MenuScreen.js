/**
 * MenuScreen.js - 主菜单
 * 双按钮：无尽模式 / 关卡模式
 */
(function() {
    'use strict';

    class MenuScreen {
        /**
         * @param {object} callbacks - { onEndless, onLevel }
         */
        constructor(callbacks) {
            this.callbacks = callbacks || {};
            this.el = null;
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'menu-screen';
            this.el.innerHTML = `
                <div class="menu-content">
                    <h1 class="menu-title">SortGame</h1>
                    <p class="menu-subtitle">色块排序交付</p>
                    <div class="menu-buttons">
                        <button class="menu-btn-endless">无尽模式</button>
                        <button class="menu-btn-level">关卡模式</button>
                        <button class="menu-btn-leaderboard">排行榜</button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.el);

            this.el.querySelector('.menu-btn-endless').addEventListener('click', () => {
                if (this.callbacks.onEndless) this.callbacks.onEndless();
            });
            this.el.querySelector('.menu-btn-level').addEventListener('click', () => {
                if (this.callbacks.onLevel) this.callbacks.onLevel();
            });
            this.el.querySelector('.menu-btn-leaderboard').addEventListener('click', () => {
                if (this.callbacks.onLeaderboard) this.callbacks.onLeaderboard();
            });
        }

        show() {
            if (this.el) {
                this.el.style.display = 'flex';
                this.el.style.opacity = '0';
                requestAnimationFrame(() => {
                    this.el.style.transition = 'opacity 0.3s ease';
                    this.el.style.opacity = '1';
                });
            }
        }

        hide() {
            if (this.el) {
                this.el.style.transition = 'opacity 0.25s ease';
                this.el.style.opacity = '0';
                setTimeout(() => {
                    this.el.style.display = 'none';
                }, 250);
            }
        }
    }

    window.MenuScreen = MenuScreen;
})();
