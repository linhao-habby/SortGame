/**
 * LeaderboardPanel.js - 排行榜面板
 * 可在菜单和结算页面中展示
 */
(function() {
    'use strict';

    class LeaderboardPanel {
        constructor(leaderboardService) {
            this.service = leaderboardService;
            this.el = null;
        }

        create() {
            this.el = document.createElement('div');
            this.el.className = 'leaderboard-panel';
            this.el.style.display = 'none';
            this.el.innerHTML = `
                <div class="leaderboard-card">
                    <div class="leaderboard-header">排行榜</div>
                    <div class="leaderboard-list"></div>
                    <div class="leaderboard-loading">加载中...</div>
                    <button class="leaderboard-close">关闭</button>
                </div>
            `;
            document.body.appendChild(this.el);

            this.el.querySelector('.leaderboard-close').addEventListener('click', () => {
                this.hide();
            });
            this.el.addEventListener('click', (e) => {
                if (e.target === this.el) this.hide();
            });
        }

        async show(highlightScore) {
            if (!this.el) return;
            this.el.style.display = 'flex';
            this.el.style.opacity = '0';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.el.style.opacity = '1';
                });
            });

            // 显示 loading
            this.el.querySelector('.leaderboard-loading').style.display = 'block';
            this.el.querySelector('.leaderboard-list').innerHTML = '';

            const data = await this.service.fetchLeaderboard();
            this._renderList(data, highlightScore);
        }

        hide() {
            if (!this.el) return;
            this.el.style.opacity = '0';
            setTimeout(() => {
                this.el.style.display = 'none';
            }, 300);
        }

        _renderList(data, highlightScore) {
            const listEl = this.el.querySelector('.leaderboard-list');
            const loadingEl = this.el.querySelector('.leaderboard-loading');
            loadingEl.style.display = 'none';

            if (!data || data.length === 0) {
                listEl.innerHTML = '<div class="leaderboard-empty">暂无记录</div>';
                return;
            }

            let html = '';
            for (let i = 0; i < data.length; i++) {
                const entry = data[i];
                const isHighlight = (highlightScore !== undefined && entry.score === highlightScore);
                const rankClass = i < 3 ? ` rank-${i + 1}` : '';
                const highlightClass = isHighlight ? ' highlight' : '';
                const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

                html += `
                    <div class="leaderboard-row${rankClass}${highlightClass}">
                        <span class="lb-rank">${rankIcon}</span>
                        <span class="lb-name">${this._escapeHtml(entry.name || 'Player')}</span>
                        <span class="lb-score">${entry.score}</span>
                        <span class="lb-info">${entry.orders || 0}单 x${entry.combo || 0}</span>
                    </div>
                `;
            }
            listEl.innerHTML = html;
        }

        _escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    }

    window.LeaderboardPanel = LeaderboardPanel;
})();
