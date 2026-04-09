/**
 * tween.js - 缓动动画工具
 * 管理多个并行/串行 tween 动画
 */
(function() {
    'use strict';

    // ===== 缓动函数 =====
    const Easing = {
        linear(t) { return t; },

        easeInQuad(t) { return t * t; },
        easeOutQuad(t) { return t * (2 - t); },
        easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },

        easeInCubic(t) { return t * t * t; },
        easeOutCubic(t) { return (--t) * t * t + 1; },
        easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },

        easeOutBack(t) {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        },

        easeOutBounce(t) {
            if (t < 1 / 2.75) return 7.5625 * t * t;
            if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
            if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        },

        easeOutElastic(t) {
            if (t === 0 || t === 1) return t;
            return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
        },
    };

    // ===== 单个 Tween =====
    class Tween {
        /**
         * @param {object} target - 要动画的对象
         * @param {object} from - 起始属性值 { x: 0, y: 0 }
         * @param {object} to - 目标属性值 { x: 100, y: 50 }
         * @param {number} duration - 持续时间 (ms)
         * @param {object} [options]
         * @param {function} [options.easing] - 缓动函数
         * @param {number} [options.delay] - 延迟 (ms)
         * @param {function} [options.onUpdate] - 每帧回调
         * @param {function} [options.onComplete] - 完成回调
         */
        constructor(target, from, to, duration, options = {}) {
            this.target = target;
            this.from = { ...from };
            this.to = { ...to };
            this.duration = duration;
            this.easing = options.easing || Easing.easeOutQuad;
            this.delay = options.delay || 0;
            this.onUpdate = options.onUpdate || null;
            this.onComplete = options.onComplete || null;

            this.elapsed = 0;
            this.started = false;
            this.completed = false;
            this.keys = Object.keys(from);
        }

        /**
         * 更新 tween
         * @param {number} dt - delta time (ms)
         * @returns {boolean} 是否完成
         */
        update(dt) {
            if (this.completed) return true;

            this.elapsed += dt;

            // 延迟阶段
            if (this.elapsed < this.delay) return false;

            this.started = true;
            const activeTime = this.elapsed - this.delay;
            const progress = Math.min(activeTime / this.duration, 1);
            const easedProgress = this.easing(progress);

            // 插值
            for (const key of this.keys) {
                this.target[key] = this.from[key] + (this.to[key] - this.from[key]) * easedProgress;
            }

            if (this.onUpdate) this.onUpdate(this.target, progress);

            if (progress >= 1) {
                this.completed = true;
                if (this.onComplete) this.onComplete(this.target);
                return true;
            }
            return false;
        }
    }

    // ===== Tween 管理器 =====
    class TweenManager {
        constructor() {
            this.tweens = [];
        }

        /**
         * 添加一个 tween
         * @returns {Tween}
         */
        add(target, from, to, duration, options) {
            const tween = new Tween(target, from, to, duration, options);
            this.tweens.push(tween);
            return tween;
        }

        /**
         * 创建一个序列（串行执行）
         * @param {Array<{target, from, to, duration, options}>} configs
         * @returns {Promise} 全部完成时 resolve
         */
        sequence(configs) {
            return new Promise((resolve) => {
                let index = 0;
                const runNext = () => {
                    if (index >= configs.length) {
                        resolve();
                        return;
                    }
                    const cfg = configs[index++];
                    this.add(cfg.target, cfg.from, cfg.to, cfg.duration, {
                        ...cfg.options,
                        onComplete: (t) => {
                            if (cfg.options?.onComplete) cfg.options.onComplete(t);
                            runNext();
                        },
                    });
                };
                runNext();
            });
        }

        /**
         * 更新所有活跃 tween
         * @param {number} dtMs - delta time (ms)
         * @returns {boolean} 是否还有活跃 tween
         */
        update(dtMs) {
            for (let i = this.tweens.length - 1; i >= 0; i--) {
                if (this.tweens[i].update(dtMs)) {
                    this.tweens.splice(i, 1);
                }
            }
            return this.tweens.length > 0;
        }

        /**
         * 是否有活跃动画
         */
        get active() {
            return this.tweens.length > 0;
        }

        /**
         * 清除所有 tween
         */
        clear() {
            this.tweens = [];
        }
    }

    window.Easing = Easing;
    window.Tween = Tween;
    window.TweenManager = TweenManager;
})();
