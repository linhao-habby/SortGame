/**
 * LevelManager.js - 关卡进度管理
 * 解锁、星级、存读档
 */
(function() {
    'use strict';

    class LevelManager {
        constructor() {
            this._storageKey = 'sortgame_level_progress';
            this._progress = this._load();
        }

        /**
         * 获取某关信息
         * @param {number} levelId - 关卡编号（1-based）
         * @returns {{ unlocked: boolean, stars: number, bestScore: number }}
         */
        getLevelInfo(levelId) {
            return {
                unlocked: levelId <= this._progress.unlockedLevel,
                stars: this._progress.stars[String(levelId)] || 0,
                bestScore: this._progress.scores[String(levelId)] || 0,
            };
        }

        /**
         * 获取已解锁的最大关卡号
         */
        getMaxUnlocked() {
            return this._progress.unlockedLevel;
        }

        /**
         * 获取某关配置
         * @param {number} levelId
         * @returns {object|null}
         */
        getLevelConfig(levelId) {
            const data = GameConfig.LEVEL_DATA;
            if (!data || levelId < 1 || levelId > data.length) return null;
            return data[levelId - 1];
        }

        /**
         * 获取总关卡数
         */
        getTotalLevels() {
            return GameConfig.LEVEL_DATA ? GameConfig.LEVEL_DATA.length : 0;
        }

        /**
         * 通关后保存进度
         * @param {number} levelId
         * @param {number} stars - 1~3
         * @param {number} score
         */
        saveClear(levelId, stars, score) {
            const key = String(levelId);

            // 更新最佳星级（只升不降）
            const oldStars = this._progress.stars[key] || 0;
            if (stars > oldStars) {
                this._progress.stars[key] = stars;
            }

            // 更新最高分
            const oldScore = this._progress.scores[key] || 0;
            if (score > oldScore) {
                this._progress.scores[key] = score;
            }

            // 解锁下一关
            const totalLevels = this.getTotalLevels();
            if (levelId >= this._progress.unlockedLevel && levelId < totalLevels) {
                this._progress.unlockedLevel = levelId + 1;
            }

            this._save();
        }

        /**
         * 计算星级
         * @param {object} levelConfig - 关卡配置
         * @param {number} currentHP - 通关时剩余 HP
         * @returns {number} 1~3
         */
        calcStars(levelConfig, currentHP) {
            const maxHP = levelConfig.hp;
            const lostHP = maxHP - currentHP;
            if (lostHP === 0) return 3;
            if (lostHP <= Math.floor(maxHP / 2)) return 2;
            return 1;
        }

        /**
         * 获取某个章节的所有关卡 ID
         * @param {string} chapter
         * @returns {number[]}
         */
        getLevelsByChapter(chapter) {
            return GameConfig.LEVEL_DATA
                .filter(l => l.chapter === chapter)
                .map(l => l.id);
        }

        /**
         * 获取所有章节名（按关卡顺序去重）
         * @returns {string[]}
         */
        getChapters() {
            const seen = new Set();
            const chapters = [];
            for (const level of GameConfig.LEVEL_DATA) {
                if (!seen.has(level.chapter)) {
                    seen.add(level.chapter);
                    chapters.push(level.chapter);
                }
            }
            return chapters;
        }

        // ===== 私有：localStorage 存读 =====

        _load() {
            try {
                const raw = localStorage.getItem(this._storageKey);
                if (raw) {
                    const data = JSON.parse(raw);
                    return {
                        unlockedLevel: data.unlockedLevel || 1,
                        stars: data.stars || {},
                        scores: data.scores || {},
                    };
                }
            } catch (e) {
                console.warn('[LevelManager] Failed to load progress:', e);
            }
            return { unlockedLevel: 1, stars: {}, scores: {} };
        }

        _save() {
            try {
                localStorage.setItem(this._storageKey, JSON.stringify(this._progress));
            } catch (e) {
                console.warn('[LevelManager] Failed to save progress:', e);
            }
        }

        /**
         * 重置所有进度（调试用）
         */
        resetProgress() {
            this._progress = { unlockedLevel: 1, stars: {}, scores: {} };
            this._save();
            console.log('[LevelManager] Progress reset');
        }
    }

    window.LevelManager = LevelManager;
})();
