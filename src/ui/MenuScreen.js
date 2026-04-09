/**
 * MenuScreen.js - 主菜单
 */
(function() {
    'use strict';

    class MenuScreen {
        /**
         * @param {function} onStart - 开始游戏回调
         */
        constructor(onStart) {
            this.onStart = onStart;
            this.el = null;
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'menu-screen';
            this.el.innerHTML = `
                <div class="menu-content">
                    <h1 class="menu-title">SortGame</h1>
                    <p class="menu-subtitle">色块排序交付</p>
                    <button class="menu-btn-start">开始游戏</button>
                </div>
            `;
            document.body.appendChild(this.el);

            this.el.querySelector('.menu-btn-start').addEventListener('click', () => {
                if (this.onStart) this.onStart();
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
