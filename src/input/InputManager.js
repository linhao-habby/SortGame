/**
 * InputManager.js - 输入管理器
 * 触摸/点击 → 木槽 2D hitTest
 */
(function() {
    'use strict';

    class InputManager {
        /**
         * @param {HTMLCanvasElement} canvas
         * @param {function} onSlotTap - 回调 (slotIndex: number) => void
         */
        constructor(canvas, onSlotTap) {
            this.canvas = canvas;
            this.onSlotTap = onSlotTap;
            this.enabled = true;

            // 木槽的屏幕投影区域（由 recalcHitAreas 计算）
            this.hitAreas = []; // [{ slotIndex, left, top, right, bottom }]

            this._bindEvents();
        }

        _bindEvents() {
            // 统一用 pointerup 处理点击和触摸
            this.canvas.addEventListener('pointerup', (e) => {
                if (!this.enabled) return;
                e.preventDefault();

                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const slotIndex = this._hitTest(x, y);
                if (slotIndex >= 0 && this.onSlotTap) {
                    this.onSlotTap(slotIndex);
                }
            });
        }

        /**
         * 2D 矩形 hitTest
         * @returns {number} 命中的 slotIndex，-1 表示未命中
         */
        _hitTest(screenX, screenY) {
            for (const area of this.hitAreas) {
                if (screenX >= area.left && screenX <= area.right &&
                    screenY >= area.top && screenY <= area.bottom) {
                    return area.slotIndex;
                }
            }
            return -1;
        }

        /**
         * 根据布局数据重新计算每个木槽的屏幕投影矩形
         * 在 layout 变化或 resize 时调用
         * @param {object} layout - { slotPositions: [{x, z}] }
         * @param {Float32Array} viewProjMatrix - 相机的 view*proj 矩阵
         * @param {number} canvasW - canvas CSS 宽度
         * @param {number} canvasH - canvas CSS 高度
         */
        recalcHitAreas(layout, viewProjMatrix, canvasW, canvasH) {
            this.hitAreas = [];

            const slotHalfW = (GameConfig.RENDER.SLOT_INNER_WIDTH + GameConfig.RENDER.SLOT_WALL_THICKNESS * 2) / 2;
            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            // 取第一个槽的容量估算高度（实际所有槽容量可能不同，但大部分相同）
            const defaultCapacity = 5;

            for (let i = 0; i < layout.slotPositions.length; i++) {
                const pos = layout.slotPositions[i];
                const slotH = cellH * defaultCapacity;

                // 正面视角：木槽在 XY 平面，Z=0
                // 投影 4 个角到屏幕
                const corners = [
                    [pos.x - slotHalfW, pos.y, 0],
                    [pos.x + slotHalfW, pos.y, 0],
                    [pos.x - slotHalfW, pos.y + slotH, 0],
                    [pos.x + slotHalfW, pos.y + slotH, 0],
                ];

                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;

                for (const c of corners) {
                    const screen = this._worldToScreen(c[0], c[1], c[2], viewProjMatrix, canvasW, canvasH);
                    if (screen) {
                        minX = Math.min(minX, screen.x);
                        maxX = Math.max(maxX, screen.x);
                        minY = Math.min(minY, screen.y);
                        maxY = Math.max(maxY, screen.y);
                    }
                }

                if (minX < Infinity) {
                    const pad = 6;
                    this.hitAreas.push({
                        slotIndex: i,
                        left: minX - pad,
                        top: minY - pad,
                        right: maxX + pad,
                        bottom: maxY + pad,
                    });
                }
            }
        }

        /**
         * 3D 世界坐标 → 2D 屏幕坐标
         */
        _worldToScreen(wx, wy, wz, viewProjMatrix, canvasW, canvasH) {
            const vp = viewProjMatrix;
            // 手动 矩阵 * 向量
            const x = vp[0]*wx + vp[4]*wy + vp[8]*wz + vp[12];
            const y = vp[1]*wx + vp[5]*wy + vp[9]*wz + vp[13];
            const w = vp[3]*wx + vp[7]*wy + vp[11]*wz + vp[15];

            if (Math.abs(w) < 0.001) return null;

            // NDC → screen
            const ndcX = x / w;
            const ndcY = y / w;

            return {
                x: (ndcX * 0.5 + 0.5) * canvasW,
                y: (1 - (ndcY * 0.5 + 0.5)) * canvasH,
            };
        }

        /**
         * 锁定/解锁输入
         */
        lock() { this.enabled = false; }
        unlock() { this.enabled = true; }
    }

    window.InputManager = InputManager;
})();
