/**
 * LevelSelectScreen.js - 关卡选择页面
 */
(function() {
    'use strict';

    class LevelSelectScreen {
        /**
         * @param {object} callbacks - { onSelectLevel(levelId), onBack() }
         * @param {LevelManager} levelManager
         */
        constructor(callbacks, levelManager) {
            this.callbacks = callbacks || {};
            this.levelManager = levelManager;
            this.el = null;
            this._contentEl = null;
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'level-select-screen';
            this.el.style.display = 'none';
            this.el.innerHTML = `
                <div class="level-select-header">
                    <button class="level-select-back">\u2190</button>
                    <span class="level-select-title">关卡选择</span>
                </div>
                <div class="level-select-content"></div>
            `;
            document.body.appendChild(this.el);

            this._contentEl = this.el.querySelector('.level-select-content');
            this.el.querySelector('.level-select-back').addEventListener('click', () => {
                if (this.callbacks.onBack) this.callbacks.onBack();
            });
        }

        /**
         * 刷新关卡列表并显示
         */
        show() {
            if (!this.el) return;
            this._renderLevels();
            this.el.style.display = 'flex';
            this.el.style.opacity = '0';
            requestAnimationFrame(() => {
                this.el.style.transition = 'opacity 0.3s ease';
                this.el.style.opacity = '1';
            });
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

        _renderLevels() {
            const lm = this.levelManager;
            const chapters = lm.getChapters();
            let html = '';

            for (const chapter of chapters) {
                html += `<div class="level-chapter">`;
                html += `<div class="level-chapter-title">\u2500\u2500 ${chapter} \u2500\u2500</div>`;
                html += `<div class="level-grid">`;

                const levelIds = lm.getLevelsByChapter(chapter);
                for (const id of levelIds) {
                    const info = lm.getLevelInfo(id);
                    const config = lm.getLevelConfig(id);
                    const isCurrent = info.unlocked && info.stars === 0;

                    if (!info.unlocked) {
                        html += `
                            <div class="level-btn level-btn-locked">
                                <span class="level-btn-lock">\ud83d\udd12</span>
                            </div>`;
                    } else {
                        const currentClass = isCurrent ? ' level-btn-current' : '';
                        const starsHtml = info.stars > 0
                            ? `<div class="level-btn-stars">${this._renderStars(info.stars)}</div>`
                            : '';
                        html += `
                            <div class="level-btn level-btn-unlocked${currentClass}" data-level="${id}">
                                <span class="level-btn-num">${id}</span>
                                ${starsHtml}
                            </div>`;
                    }
                }

                html += `</div></div>`;
            }

            this._contentEl.innerHTML = html;

            // 绑定点击事件
            this._contentEl.querySelectorAll('.level-btn-unlocked').forEach(btn => {
                btn.addEventListener('click', () => {
                    const levelId = parseInt(btn.dataset.level, 10);
                    if (this.callbacks.onSelectLevel) this.callbacks.onSelectLevel(levelId);
                });
            });
        }

        _renderStars(count) {
            let s = '';
            for (let i = 0; i < 3; i++) {
                s += i < count ? '<span class="star-earned">\u2605</span>' : '<span class="star-empty">\u2606</span>';
            }
            return s;
        }
    }

    window.LevelSelectScreen = LevelSelectScreen;
})();
