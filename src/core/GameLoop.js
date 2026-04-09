/**
 * GameLoop.js - 游戏循环
 * 60fps 渲染循环 + deltaTime
 */
(function() {
    'use strict';

    class GameLoop {
        constructor(updateFn, targetFPS = 60) {
            this._updateFn = updateFn;
            this._targetFPS = targetFPS;
            this._frameInterval = 1000 / targetFPS;
            this._lastTime = 0;
            this._rafId = null;
            this._running = false;
        }

        start() {
            if (this._running) return;
            this._running = true;
            this._lastTime = performance.now();
            this._tick(this._lastTime);
        }

        stop() {
            this._running = false;
            if (this._rafId !== null) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }
        }

        _tick(now) {
            if (!this._running) return;
            this._rafId = requestAnimationFrame((t) => this._tick(t));

            const delta = now - this._lastTime;
            if (delta >= this._frameInterval) {
                this._lastTime = now - (delta % this._frameInterval);
                const dt = Math.min(delta / 1000, 0.05); // 上限 50ms，防止大跳
                this._updateFn(dt, now);
            }
        }
    }

    window.GameLoop = GameLoop;
})();
