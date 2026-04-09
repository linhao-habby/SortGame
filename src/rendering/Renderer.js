/**
 * Renderer.js - WebGPU 渲染器
 * 初始化 WebGPU、管理渲染管线、2.5D 相机、统一 uniform buffer
 */
(function() {
    'use strict';

    class Renderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.device = null;
            this.context = null;
            this.format = null;
            this.depthTexture = null;

            // Uniform buffers
            this.cameraBuffer = null;
            this.lightBuffer = null;
            this.cameraBindGroup = null;

            // Pipelines
            this.blockPipeline = null;
            this.slotPipeline = null;
            this.bgPipeline = null;

            // Geometry buffers
            this.blockGeo = null;
            this.slotGeo = null;
            this.bgGeo = null;

            // Camera parameters
            this.viewMatrix = null;
            this.projMatrix = null;
            this.viewProjMatrix = null;
        }

        async init() {
            // 1. 获取 adapter 和 device
            if (!navigator.gpu) {
                console.error('WebGPU not supported');
                return false;
            }

            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                console.error('Failed to get GPU adapter');
                return false;
            }

            this.device = await adapter.requestDevice();

            // 2. 配置 canvas context
            this.context = this.canvas.getContext('webgpu');
            this.format = navigator.gpu.getPreferredCanvasFormat();
            this.context.configure({
                device: this.device,
                format: this.format,
                alphaMode: 'premultiplied',
            });

            // 3. 处理画布尺寸
            this._resizeCanvas();

            // 4. 创建深度纹理
            this._createDepthTexture();

            // 5. 设置相机
            this._setupCamera();

            // 6. 创建 uniform buffers
            this._createUniformBuffers();

            // 7. 创建几何体 buffers
            this._createGeometryBuffers();

            // 8. 创建渲染管线
            this._createPipelines();

            return true;
        }

        _resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const w = this.canvas.clientWidth;
            const h = this.canvas.clientHeight;
            this.canvas.width = w * dpr;
            this.canvas.height = h * dpr;
        }

        _createDepthTexture() {
            if (this.depthTexture) this.depthTexture.destroy();
            this.depthTexture = this.device.createTexture({
                size: [this.canvas.width, this.canvas.height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        }

        _setupCamera() {
            // 轻微俯视：能看到色块的顶面和正面（类似参考游戏）
            const aspect = this.canvas.width / this.canvas.height;
            const viewSize = 6.0;

            this.projMatrix = MathUtils.orthographic(
                -viewSize * aspect, viewSize * aspect,
                -viewSize, viewSize,
                0.1, 100.0
            );

            // 相机从正前方偏上看过去（约 10-12 度俯角）
            const eye = [0, 4.2, 20];
            const target = [0, 0, 0];
            const up = [0, 1, 0];
            this.viewMatrix = MathUtils.lookAt(eye, target, up);

            this.viewProjMatrix = MathUtils.multiply(this.projMatrix, this.viewMatrix);
        }

        _createUniformBuffers() {
            // Camera uniform: mat4x4 viewProj (64 bytes)
            this.cameraBuffer = this.device.createBuffer({
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            this.device.queue.writeBuffer(this.cameraBuffer, 0, this.viewProjMatrix);

            // Light uniform: direction (vec4) + ambient (vec4) = 32 bytes
            this.lightBuffer = this.device.createBuffer({
                size: 32,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            const lightData = new Float32Array([
                // direction: 从上方偏左前方打来（与 fragment shader 中 lightDir 一致）
                0.2, -0.6, -0.7, 0.0,
                // ambient color + intensity
                0.5, 0.45, 0.4, 0.5,
            ]);
            this.device.queue.writeBuffer(this.lightBuffer, 0, lightData);
        }

        _createGeometryBuffers() {
            // Block geometry
            const block = Geometry.createBlock();
            this.blockGeo = {
                vertexBuffer: this._createBufferWithData(block.vertices, GPUBufferUsage.VERTEX),
                normalBuffer: this._createBufferWithData(block.normals, GPUBufferUsage.VERTEX),
                indexBuffer: this._createBufferWithData(block.indices, GPUBufferUsage.INDEX),
                indexCount: block.indexCount,
            };

            // Slot geometry (default capacity 5)
            const slot = Geometry.createSlot(5);
            this.slotGeo = {
                vertexBuffer: this._createBufferWithData(slot.vertices, GPUBufferUsage.VERTEX),
                normalBuffer: this._createBufferWithData(slot.normals, GPUBufferUsage.VERTEX),
                indexBuffer: this._createBufferWithData(slot.indices, GPUBufferUsage.INDEX),
                indexCount: slot.indexCount,
            };

            // Background quad
            const bg = Geometry.createFullscreenQuad();
            this.bgGeo = {
                vertexBuffer: this._createBufferWithData(bg.vertices, GPUBufferUsage.VERTEX),
                vertexCount: bg.vertexCount,
            };
        }

        _createBufferWithData(data, usage) {
            const buffer = this.device.createBuffer({
                size: data.byteLength,
                usage: usage | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            if (data instanceof Uint16Array) {
                new Uint16Array(buffer.getMappedRange()).set(data);
            } else {
                new Float32Array(buffer.getMappedRange()).set(data);
            }
            buffer.unmap();
            return buffer;
        }

        _createPipelines() {
            // Bind group layout for camera + light
            const bindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
                    { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                ],
            });

            this.cameraBindGroup = this.device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.cameraBuffer } },
                    { binding: 1, resource: { buffer: this.lightBuffer } },
                ],
            });

            const pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout],
            });

            // Instance vertex layout (shared between block and slot)
            const instanceAttributes = [
                { shaderLocation: 3, offset: 0,  format: 'float32x4' },  // modelCol0
                { shaderLocation: 4, offset: 16, format: 'float32x4' },  // modelCol1
                { shaderLocation: 5, offset: 32, format: 'float32x4' },  // modelCol2
                { shaderLocation: 6, offset: 48, format: 'float32x4' },  // modelCol3
                { shaderLocation: 7, offset: 64, format: 'float32x4' },  // color
                { shaderLocation: 8, offset: 80, format: 'float32x4' },  // flags
            ];
            const instanceStride = 96; // 6 * vec4 = 24 floats = 96 bytes

            const depthStencil = {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            };

            // ----- Block Pipeline -----
            this.blockPipeline = this.device.createRenderPipeline({
                layout: pipelineLayout,
                vertex: {
                    module: this.device.createShaderModule({ code: Shaders.blockVertex }),
                    entryPoint: 'main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                        { arrayStride: instanceStride, stepMode: 'instance', attributes: instanceAttributes },
                    ],
                },
                fragment: {
                    module: this.device.createShaderModule({ code: Shaders.blockFragment }),
                    entryPoint: 'main',
                    targets: [{ format: this.format }],
                },
                primitive: { topology: 'triangle-list', cullMode: 'back' },
                depthStencil,
            });

            // ----- Slot Pipeline -----
            this.slotPipeline = this.device.createRenderPipeline({
                layout: pipelineLayout,
                vertex: {
                    module: this.device.createShaderModule({ code: Shaders.slotVertex }),
                    entryPoint: 'main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                        { arrayStride: instanceStride, stepMode: 'instance', attributes: instanceAttributes },
                    ],
                },
                fragment: {
                    module: this.device.createShaderModule({ code: Shaders.slotFragment }),
                    entryPoint: 'main',
                    targets: [{ format: this.format }],
                },
                primitive: { topology: 'triangle-list', cullMode: 'none' }, // 木槽内外都要看到
                depthStencil,
            });

            // ----- Background Pipeline -----
            const bgLayout = this.device.createPipelineLayout({ bindGroupLayouts: [] });
            this.bgPipeline = this.device.createRenderPipeline({
                layout: bgLayout,
                vertex: {
                    module: this.device.createShaderModule({ code: Shaders.bgVertex }),
                    entryPoint: 'main',
                    buffers: [
                        { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
                    ],
                },
                fragment: {
                    module: this.device.createShaderModule({ code: Shaders.bgFragment }),
                    entryPoint: 'main',
                    targets: [{ format: this.format }],
                },
                primitive: { topology: 'triangle-list' },
                depthStencil,
            });
        }

        /**
         * 开始一帧渲染，返回 commandEncoder 和 renderPass
         */
        beginFrame() {
            const commandEncoder = this.device.createCommandEncoder();
            const textureView = this.context.getCurrentTexture().createView();

            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 0.17, g: 0.10, b: 0.05, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
                depthStencilAttachment: {
                    view: this.depthTexture.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            });

            return { commandEncoder, renderPass };
        }

        /**
         * 渲染背景
         */
        drawBackground(renderPass) {
            renderPass.setPipeline(this.bgPipeline);
            renderPass.setVertexBuffer(0, this.bgGeo.vertexBuffer);
            renderPass.draw(this.bgGeo.vertexCount);
        }

        /**
         * 结束一帧渲染
         */
        endFrame(commandEncoder, renderPass) {
            renderPass.end();
            this.device.queue.submit([commandEncoder.finish()]);
        }

        /**
         * 处理窗口大小变化
         */
        resize() {
            this._resizeCanvas();
            this._createDepthTexture();
            this._setupCamera();
            this.device.queue.writeBuffer(this.cameraBuffer, 0, this.viewProjMatrix);
        }
    }

    window.Renderer = Renderer;
})();
