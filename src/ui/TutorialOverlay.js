/**
 * TutorialOverlay.js - 新手引导
 * 首次游戏时展示简单操作说明，点击逐步推进，完成后不再显示
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'sortgame_tutorial_done';
    const TUTORIAL_VERSION = '2'; // 改版本号可强制重新展示教程

    const STEPS = [
        {
            text: '点击木槽，选中顶部色块',
            icon: '👆',
        },
        {
            text: '再点击另一个木槽\n将色块移动过去',
            icon: '👉',
        },
        {
            text: '把同色块排在一起\n满足订单即可交付得分',
            icon: '✨',
        },
    ];

    class TutorialOverlay {
        constructor() {
            this.el = null;
            this._currentStep = 0;
            this._onComplete = null;
        }

        /**
         * 是否需要展示教程（首次游戏）
         */
        shouldShow() {
            return localStorage.getItem(STORAGE_KEY) !== TUTORIAL_VERSION;
        }

        /**
         * 标记教程已完成
         */
        markDone() {
            localStorage.setItem(STORAGE_KEY, TUTORIAL_VERSION);
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'tutorial-overlay';
            this.el.style.display = 'none';

            this.el.innerHTML = `
                <div class="tutorial-card">
                    <div class="tutorial-icon"></div>
                    <div class="tutorial-text"></div>
                    <div class="tutorial-hint">点击任意位置继续</div>
                    <div class="tutorial-dots"></div>
                </div>
            `;

            document.body.appendChild(this.el);

            this.el.addEventListener('click', () => {
                this._nextStep();
            });
        }

        /**
         * 展示教程
         * @param {function} onComplete - 教程完成后的回调
         */
        show(onComplete) {
            if (!this.el) return;
            this._onComplete = onComplete;
            this._currentStep = 0;
            this._renderStep();
            this.el.style.display = 'flex';
            this.el.style.opacity = '0';
            // 双 rAF 确保浏览器先渲染 opacity:0，再触发 transition 到 1
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.el.style.opacity = '1';
                });
            });
        }

        hide() {
            if (!this.el) return;
            this.el.style.opacity = '0';
            setTimeout(() => {
                this.el.style.display = 'none';
            }, 300);
        }

        _renderStep() {
            const step = STEPS[this._currentStep];
            if (!step) return;

            this.el.querySelector('.tutorial-icon').textContent = step.icon;
            this.el.querySelector('.tutorial-text').textContent = step.text;

            // 进度点
            const dotsEl = this.el.querySelector('.tutorial-dots');
            dotsEl.innerHTML = STEPS.map((_, i) =>
                `<span class="tutorial-dot${i === this._currentStep ? ' active' : ''}"></span>`
            ).join('');

            // 卡片入场动画
            const card = this.el.querySelector('.tutorial-card');
            card.classList.remove('tutorial-card-enter');
            void card.offsetWidth; // force reflow
            card.classList.add('tutorial-card-enter');
        }

        _nextStep() {
            this._currentStep++;
            if (this._currentStep >= STEPS.length) {
                this.markDone();
                this.hide();
                if (this._onComplete) this._onComplete();
            } else {
                this._renderStep();
            }
        }
    }

    window.TutorialOverlay = TutorialOverlay;
})();
