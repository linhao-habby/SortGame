/**
 * SlotRenderer.js - 木槽批量渲染
 * GPU instancing 渲染所有木槽
 */
(function() {
    'use strict';

    const INSTANCE_FLOATS = 24;
    const MAX_SLOTS = 16;

    // 木槽基色
    const SLOT_COLOR = [0.55, 0.35, 0.18]; // 棕色

    class SlotRenderer {
        constructor(renderer) {
            this.renderer = renderer;
            this.instanceData = new Float32Array(MAX_SLOTS * INSTANCE_FLOATS);
            this.instanceCount = 0;
            this.instanceBuffer = null;
            this._createInstanceBuffer();
        }

        _createInstanceBuffer() {
            this.instanceBuffer = this.renderer.device.createBuffer({
                size: this.instanceData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }

        /**
         * 根据游戏状态更新所有木槽实例数据
         * @param {GameState} gameState
         * @param {object} layout - { slotPositions: [{x, z}] }
         */
        update(gameState, layout) {
            this.instanceCount = 0;

            for (let si = 0; si < gameState.slots.length; si++) {
                const slot = gameState.slots[si];
                const slotPos = layout.slotPositions[si];
                if (!slotPos) continue;
                if (this.instanceCount >= MAX_SLOTS) break;

                // 模型矩阵：平移到 slotPos (x, y)，Z=0
                const yOffset = (gameState.selectedSlotIndex === si) ? 0.08 : 0;
                const model = MathUtils.translation(slotPos.x, slotPos.y + yOffset, 0);

                // 颜色
                const color = SLOT_COLOR;

                // 标志
                const selected = (gameState.selectedSlotIndex === si) ? 1 : 0;
                const isSafe = 0;

                const offset = this.instanceCount * INSTANCE_FLOATS;
                this.instanceData.set(model, offset);
                this.instanceData[offset + 16] = color[0];
                this.instanceData[offset + 17] = color[1];
                this.instanceData[offset + 18] = color[2];
                this.instanceData[offset + 19] = 1.0;
                this.instanceData[offset + 20] = selected;
                this.instanceData[offset + 21] = isSafe;
                this.instanceData[offset + 22] = 0;
                this.instanceData[offset + 23] = 0;

                this.instanceCount++;
            }

            if (this.instanceCount > 0) {
                this.renderer.device.queue.writeBuffer(
                    this.instanceBuffer, 0,
                    this.instanceData, 0,
                    this.instanceCount * INSTANCE_FLOATS
                );
            }
        }

        /**
         * 绘制所有木槽
         */
        draw(renderPass) {
            if (this.instanceCount === 0) return;

            const geo = this.renderer.slotGeo;
            renderPass.setPipeline(this.renderer.slotPipeline);
            renderPass.setBindGroup(0, this.renderer.cameraBindGroup);
            renderPass.setVertexBuffer(0, geo.vertexBuffer);
            renderPass.setVertexBuffer(1, geo.normalBuffer);
            renderPass.setVertexBuffer(2, this.instanceBuffer);
            renderPass.setIndexBuffer(geo.indexBuffer, 'uint16');
            renderPass.drawIndexed(geo.indexCount, this.instanceCount);
        }
    }

    window.SlotRenderer = SlotRenderer;
})();
