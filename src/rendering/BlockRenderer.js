/**
 * BlockRenderer.js - 色块批量渲染
 * GPU instancing 渲染所有色块
 */
(function() {
    'use strict';

    // 每个实例 = 24 floats = 96 bytes
    // [modelCol0(4), modelCol1(4), modelCol2(4), modelCol3(4), color(4), flags(4)]
    const INSTANCE_FLOATS = 24;
    const MAX_BLOCKS = 128; // 最大色块数量

    class BlockRenderer {
        constructor(renderer) {
            this.renderer = renderer;
            this.instanceData = new Float32Array(MAX_BLOCKS * INSTANCE_FLOATS);
            this.instanceCount = 0;
            this.instanceBuffer = null;
            this._time = 0; // 累积时间（秒），用于彩虹块动画
            this._createInstanceBuffer();
        }

        /**
         * 更新时间（由外部每帧调用）
         * @param {number} dtMs - 帧间隔（毫秒）
         */
        updateTime(dtMs) {
            this._time += dtMs / 1000;
        }

        _createInstanceBuffer() {
            this.instanceBuffer = this.renderer.device.createBuffer({
                size: this.instanceData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }

        /**
         * 根据游戏状态更新所有色块实例数据
         * @param {GameState} gameState
         * @param {object} layout - { slotPositions: [{x, z}], blockHeight }
         * @param {object} [animOverrides] - 动画覆盖的位置/状态
         */
        update(gameState, layout, animOverrides) {
            this.instanceCount = 0;
            const cellH = GameConfig.RENDER.CELL_HEIGHT;

            for (let si = 0; si < gameState.slots.length; si++) {
                const slot = gameState.slots[si];
                const slotPos = layout.slotPositions[si];
                if (!slotPos) continue;

                for (let bi = 0; bi < slot.blocks.length; bi++) {
                    const block = slot.blocks[bi];
                    if (this.instanceCount >= MAX_BLOCKS) break;

                    // 检查动画覆盖
                    const animKey = `${si}_${bi}`;
                    const anim = animOverrides && animOverrides[animKey];

                    let x, y, z, selected, visible;
                    if (anim) {
                        if (anim.hidden) continue;
                        x = anim.x !== undefined ? anim.x : slotPos.x;
                        y = anim.y !== undefined ? anim.y : slotPos.y + cellH * bi + cellH / 2;
                        z = anim.z !== undefined ? anim.z : 0;
                        selected = anim.selected || 0;
                        visible = anim.visible !== undefined ? anim.visible : 1;
                    } else {
                        x = slotPos.x;
                        // 正面视角：色块在 XY 平面，从 slotPos.y（槽底）往上堆叠
                        const selectedOffset = (gameState.selectedSlotIndex === si) ? 0.1 : 0;
                        y = slotPos.y + cellH * bi + cellH / 2 + selectedOffset;
                        z = 0.2; // 色块在槽前面凸出
                        selected = (gameState.selectedSlotIndex === si) ? 1 : 0;
                        visible = 1;
                    }

                    if (!visible) continue;

                    // 构建模型矩阵（平移）
                    const model = MathUtils.translation(x, y, z);

                    // 获取颜色（彩虹块使用占位色，shader 中动态计算）
                    const isRainbowBlock = block.type === 'rainbow';
                    let rgb;
                    if (isRainbowBlock) {
                        rgb = [1.0, 1.0, 1.0]; // 占位色，shader 中会覆盖
                    } else {
                        const colorDef = GameConfig.COLORS[block.color];
                        rgb = colorDef ? colorDef.rgb : [0.5, 0.5, 0.5];
                    }

                    // 写入实例数据
                    const offset = this.instanceCount * INSTANCE_FLOATS;
                    // model matrix (列主序)
                    this.instanceData.set(model, offset);
                    // color
                    this.instanceData[offset + 16] = rgb[0];
                    this.instanceData[offset + 17] = rgb[1];
                    this.instanceData[offset + 18] = rgb[2];
                    this.instanceData[offset + 19] = 1.0;
                    // flags: x=selected, y=isRainbow, z=time(for rainbow anim)
                    this.instanceData[offset + 20] = selected;
                    this.instanceData[offset + 21] = isRainbowBlock ? 1 : 0;
                    this.instanceData[offset + 22] = isRainbowBlock ? this._time : 0;
                    this.instanceData[offset + 23] = 0;

                    this.instanceCount++;
                }
            }

            // 写入 GPU
            if (this.instanceCount > 0) {
                this.renderer.device.queue.writeBuffer(
                    this.instanceBuffer, 0,
                    this.instanceData, 0,
                    this.instanceCount * INSTANCE_FLOATS
                );
            }
        }

        /**
         * 添加一个飞行中的色块实例（动画用）
         * @param {number} color - 颜色编号，-1 表示彩虹块
         */
        addFlyingBlock(x, y, z, color, selected) {
            if (this.instanceCount >= MAX_BLOCKS) return;

            const isRainbowBlock = (color === -1);
            const model = MathUtils.translation(x, y, z);
            let rgb;
            if (isRainbowBlock) {
                rgb = [1.0, 1.0, 1.0]; // 占位色，shader 中动态计算
            } else {
                const colorDef = GameConfig.COLORS[color];
                rgb = colorDef ? colorDef.rgb : [0.5, 0.5, 0.5];
            }

            const offset = this.instanceCount * INSTANCE_FLOATS;
            this.instanceData.set(model, offset);
            this.instanceData[offset + 16] = rgb[0];
            this.instanceData[offset + 17] = rgb[1];
            this.instanceData[offset + 18] = rgb[2];
            this.instanceData[offset + 19] = 1.0;
            this.instanceData[offset + 20] = selected ? 1 : 0;
            this.instanceData[offset + 21] = isRainbowBlock ? 1 : 0;
            this.instanceData[offset + 22] = isRainbowBlock ? this._time : 0;
            this.instanceData[offset + 23] = 0;

            this.instanceCount++;

            // 即时写入
            this.renderer.device.queue.writeBuffer(
                this.instanceBuffer, 0,
                this.instanceData, 0,
                this.instanceCount * INSTANCE_FLOATS
            );
        }

        /**
         * 绘制所有色块
         */
        draw(renderPass) {
            if (this.instanceCount === 0) return;

            const geo = this.renderer.blockGeo;
            renderPass.setPipeline(this.renderer.blockPipeline);
            renderPass.setBindGroup(0, this.renderer.cameraBindGroup);
            renderPass.setVertexBuffer(0, geo.vertexBuffer);
            renderPass.setVertexBuffer(1, geo.normalBuffer);
            renderPass.setVertexBuffer(2, this.instanceBuffer);
            renderPass.setIndexBuffer(geo.indexBuffer, 'uint16');
            renderPass.drawIndexed(geo.indexCount, this.instanceCount);
        }
    }

    window.BlockRenderer = BlockRenderer;
})();
