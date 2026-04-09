/**
 * AnimationManager.js - 动画状态机
 * 正面视角：色块在 XY 平面，Z 用于前后层次
 */
(function() {
    'use strict';

    class AnimationManager {
        constructor(tweenManager) {
            this.tweenManager = tweenManager;
            this.flyingBlocks = []; // [{ x, y, z, color, scale }]
            this.animOverrides = {};
            this._busy = false;
        }

        get isBusy() {
            return this._busy || this.tweenManager.active;
        }

        /**
         * 播放色块移动动画（弹出 → 飞行 → 落入）
         * 正面视角：XY 平面，slotPos 有 x 和 y
         */
        async playMoveAnimation(moveData, layout, context) {
            this._busy = true;
            const { sourceIndex, targetIndex, moveCount, color } = moveData;
            const srcPos = layout.slotPositions[sourceIndex];
            const tgtPos = layout.slotPositions[targetIndex];
            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            const ANIM = GameConfig.ANIM;

            const srcTopBefore = (context ? context.sourceBlockCount : 5);
            const tgtTopBefore = (context ? context.targetBlockCount : 0);

            // 飞行高度：在源和目标木槽上方
            const srcTopY = srcPos.y + srcTopBefore * cellH;
            const tgtTopY = tgtPos.y + (tgtTopBefore + moveCount) * cellH;
            const flyY = Math.max(srcTopY, tgtTopY) + cellH * 1.5;

            const promises = [];
            for (let i = 0; i < moveCount; i++) {
                const delay = i * ANIM.CONSECUTIVE_GAP;
                // 源位置（从顶往下第 i 个）
                const startX = srcPos.x;
                const startY = srcPos.y + (srcTopBefore - 1 - i) * cellH + cellH / 2;
                // 目标位置
                const endX = tgtPos.x;
                const endY = tgtPos.y + (tgtTopBefore + i) * cellH + cellH / 2;

                const promise = new Promise((resolve) => {
                    setTimeout(() => {
                        const fb = { x: startX, y: startY, z: 0.5, color, scale: 1 };
                        this.flyingBlocks.push(fb);

                        // 阶段1：弹出到飞行高度
                        this.tweenManager.add(fb,
                            { y: startY },
                            { y: flyY },
                            ANIM.BLOCK_POP_OUT,
                            {
                                easing: Easing.easeOutCubic,
                                onComplete: () => {
                                    // 阶段2：水平飞行（带弧线）
                                    this.tweenManager.add(fb,
                                        { x: startX },
                                        { x: endX },
                                        ANIM.BLOCK_FLY,
                                        {
                                            easing: Easing.easeInOutCubic,
                                            onUpdate: (obj, progress) => {
                                                // Y 方向弧线
                                                const arc = Math.sin(progress * Math.PI) * cellH * 0.6;
                                                obj.y = flyY + arc;
                                            },
                                            onComplete: () => {
                                                // 阶段3：落入
                                                this.tweenManager.add(fb,
                                                    { y: fb.y },
                                                    { y: endY },
                                                    ANIM.BLOCK_DROP_IN,
                                                    {
                                                        easing: Easing.easeOutBack,
                                                        onComplete: () => {
                                                            const idx = this.flyingBlocks.indexOf(fb);
                                                            if (idx >= 0) this.flyingBlocks.splice(idx, 1);
                                                            resolve();
                                                        },
                                                    }
                                                );
                                            },
                                        }
                                    );
                                },
                            }
                        );
                    }, delay);
                });
                promises.push(promise);
            }

            await Promise.all(promises);
            this._busy = false;
        }

        /**
         * 播放交付动画（色块从木槽飞向上方消失）
         */
        async playDeliverAnimation(slotIndex, count, color, layout, slotBlocksBefore) {
            this._busy = true;
            const pos = layout.slotPositions[slotIndex];
            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            const ANIM = GameConfig.ANIM;
            const stackH = slotBlocksBefore || 5;

            const promises = [];
            for (let i = 0; i < count; i++) {
                const delay = i * 70;
                const promise = new Promise((resolve) => {
                    setTimeout(() => {
                        const startY = pos.y + (stackH - 1 - i) * cellH + cellH / 2;
                        const fb = { x: pos.x, y: startY, z: 0.5, color, scale: 1 };
                        this.flyingBlocks.push(fb);

                        this.tweenManager.add(fb,
                            { y: startY, scale: 1 },
                            { y: startY + 5, scale: 0.15 },
                            ANIM.DELIVER_FLY,
                            {
                                easing: Easing.easeInCubic,
                                onUpdate: (obj, progress) => {
                                    obj.x = pos.x * (1 - progress * 0.7);
                                    obj.z = 0.5 + progress * 2;
                                },
                                onComplete: () => {
                                    const idx = this.flyingBlocks.indexOf(fb);
                                    if (idx >= 0) this.flyingBlocks.splice(idx, 1);
                                    resolve();
                                },
                            }
                        );
                    }, delay);
                });
                promises.push(promise);
            }

            await Promise.all(promises);
            await this._wait(150);
            this._busy = false;
        }

        /**
         * 播放补充推入动画（所有普通木槽同时从底部推入）
         */
        async playRefillAnimation(refillData, layout) {
            this._busy = true;
            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            const ANIM = GameConfig.ANIM;

            const promises = [];
            for (const item of refillData) {
                const pos = layout.slotPositions[item.slotIndex];
                if (!pos) continue;

                const fb = { x: pos.x, y: pos.y - cellH, z: 0.15, color: item.newBlock.color, scale: 1 };
                this.flyingBlocks.push(fb);

                const promise = new Promise((resolve) => {
                    this.tweenManager.add(fb,
                        { y: pos.y - cellH },
                        { y: pos.y + cellH * 0.2 },
                        ANIM.REFILL_PUSH,
                        {
                            easing: Easing.easeOutCubic,
                            onComplete: () => {
                                const idx = this.flyingBlocks.indexOf(fb);
                                if (idx >= 0) this.flyingBlocks.splice(idx, 1);
                                resolve();
                            },
                        }
                    );
                });
                promises.push(promise);
            }

            await Promise.all(promises);
            this._busy = false;
        }

        /**
         * 播放溢出动画（溢出色块向上飞出消失）
         */
        async playOverflowAnimation(overflowData, layout) {
            if (overflowData.length === 0) return;

            this._busy = true;
            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            const ANIM = GameConfig.ANIM;

            const promises = [];
            for (const item of overflowData) {
                const pos = layout.slotPositions[item.slotIndex];
                if (!pos) continue;

                const startY = pos.y + cellH * 5 + cellH / 2;
                const fb = { x: pos.x, y: startY, z: 0.5, color: item.block.color, scale: 1 };
                this.flyingBlocks.push(fb);

                const promise = new Promise((resolve) => {
                    this.tweenManager.add(fb,
                        { y: startY, scale: 1 },
                        { y: startY + 2.5, scale: 0 },
                        ANIM.OVERFLOW_OUT,
                        {
                            easing: Easing.easeInQuad,
                            onComplete: () => {
                                const idx = this.flyingBlocks.indexOf(fb);
                                if (idx >= 0) this.flyingBlocks.splice(idx, 1);
                                resolve();
                            },
                        }
                    );
                });
                promises.push(promise);
            }

            await Promise.all(promises);
            this._busy = false;
        }

        update(dtMs) {
            this.tweenManager.update(dtMs);
        }

        getFlyingBlocks() {
            return this.flyingBlocks;
        }

        _wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        clear() {
            this.flyingBlocks = [];
            this.animOverrides = {};
            this.tweenManager.clear();
            this._busy = false;
        }
    }

    window.AnimationManager = AnimationManager;
})();
