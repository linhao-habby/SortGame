/**
 * shaders.js - WGSL 着色器
 * 卡通渲染 (Cel Shading) 色块 + 木槽 + 背景
 */
(function() {
    'use strict';

    const Shaders = {

        // ===== 色块着色器（GPU Instancing）=====
        blockVertex: /* wgsl */`
            struct Camera {
                viewProj: mat4x4<f32>,
            };

            @group(0) @binding(0) var<uniform> camera: Camera;

            struct InstanceData {
                @location(3) modelCol0: vec4<f32>,
                @location(4) modelCol1: vec4<f32>,
                @location(5) modelCol2: vec4<f32>,
                @location(6) modelCol3: vec4<f32>,
                @location(7) color: vec4<f32>,
                @location(8) flags: vec4<f32>,  // x: selected, y: reserved, z: reserved, w: reserved
            };

            struct VertexInput {
                @location(0) position: vec3<f32>,
                @location(1) normal: vec3<f32>,
            };

            struct VertexOutput {
                @builtin(position) clipPos: vec4<f32>,
                @location(0) worldNormal: vec3<f32>,
                @location(1) worldPos: vec3<f32>,
                @location(2) baseColor: vec4<f32>,
                @location(3) flags: vec4<f32>,
            };

            @vertex
            fn main(vert: VertexInput, inst: InstanceData) -> VertexOutput {
                let model = mat4x4<f32>(
                    inst.modelCol0,
                    inst.modelCol1,
                    inst.modelCol2,
                    inst.modelCol3,
                );

                let worldPos = model * vec4<f32>(vert.position, 1.0);
                let worldNormal = normalize((model * vec4<f32>(vert.normal, 0.0)).xyz);

                var out: VertexOutput;
                out.clipPos = camera.viewProj * worldPos;
                out.worldNormal = worldNormal;
                out.worldPos = worldPos.xyz;
                out.baseColor = inst.color;
                out.flags = inst.flags;
                return out;
            }
        `,

        blockFragment: /* wgsl */`
            struct LightParams {
                direction: vec4<f32>,    // xyz: light dir, w: unused
                ambient: vec4<f32>,      // xyz: ambient color, w: intensity
            };

            @group(0) @binding(1) var<uniform> light: LightParams;

            struct FragInput {
                @location(0) worldNormal: vec3<f32>,
                @location(1) worldPos: vec3<f32>,
                @location(2) baseColor: vec4<f32>,
                @location(3) flags: vec4<f32>,
            };

            @fragment
            fn main(frag: FragInput) -> @location(0) vec4<f32> {
                let normal = normalize(frag.worldNormal);
                let baseColor = frag.baseColor.rgb;
                let viewDir = normalize(vec3<f32>(0.0, 3.0, 20.0) - frag.worldPos);

                // === 参考游戏风格光影 ===

                // 主光源：从上方偏左前方打来
                let lightDir = normalize(vec3<f32>(0.2, -0.6, -0.7));
                let NdotL = dot(normal, -lightDir);

                // 柔和 cel shading（3 级色阶 + 平滑过渡）
                let shade = smoothstep(-0.1, 0.15, NdotL) * 0.3 + smoothstep(0.15, 0.5, NdotL) * 0.35 + smoothstep(0.5, 0.8, NdotL) * 0.15 + 0.25;

                var color = baseColor * shade;

                // 顶面高光：法线朝上的面更亮（参考图顶面明显比正面亮）
                let topFace = max(0.0, normal.y);
                color = color + baseColor * topFace * 0.35;
                // 顶面加一层白色高光
                color = color + vec3<f32>(1.0, 1.0, 1.0) * pow(topFace, 3.0) * 0.15;

                // 正面柔和高光区（上半部分亮，下半部分暗）
                let frontFace = max(0.0, normal.z);
                let vertGrad = smoothstep(-0.3, 0.6, normal.y); // 上亮下暗
                color = color + baseColor * frontFace * vertGrad * 0.12;

                // 软高光点（左上区域）
                let highlightDir = normalize(vec3<f32>(-0.3, 0.6, 0.7));
                let specAngle = max(0.0, dot(normal, highlightDir));
                let spec = pow(specAngle, 8.0);
                color = color + vec3<f32>(1.0, 1.0, 0.95) * spec * 0.25;

                // 底面和背面压暗
                let bottomDark = max(0.0, -normal.y) * 0.2;
                color = color * (1.0 - bottomDark);

                // 边缘微暗（圆角过渡感，但不要太强）
                let edgeFactor = 1.0 - abs(dot(normal, viewDir));
                let edgeDarken = smoothstep(0.55, 1.0, edgeFactor);
                color = mix(color, color * 0.55, edgeDarken * 0.4);

                // 环境光补偿（避免太暗）
                color = color + baseColor * 0.08;

                // 选中发光
                if (frag.flags.x > 0.5) {
                    color = color * 1.25 + vec3<f32>(0.08, 0.08, 0.05);
                    let glow = pow(edgeFactor, 2.5) * 0.4;
                    color = color + vec3<f32>(1.0, 0.9, 0.5) * glow;
                }

                return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
            }
        `,

        // ===== 木槽着色器（GPU Instancing）=====
        slotVertex: /* wgsl */`
            struct Camera {
                viewProj: mat4x4<f32>,
            };

            @group(0) @binding(0) var<uniform> camera: Camera;

            struct InstanceData {
                @location(3) modelCol0: vec4<f32>,
                @location(4) modelCol1: vec4<f32>,
                @location(5) modelCol2: vec4<f32>,
                @location(6) modelCol3: vec4<f32>,
                @location(7) color: vec4<f32>,      // 木槽颜色 (棕色/安全槽金色)
                @location(8) flags: vec4<f32>,       // x: selected, y: isSafe
            };

            struct VertexInput {
                @location(0) position: vec3<f32>,
                @location(1) normal: vec3<f32>,
            };

            struct VertexOutput {
                @builtin(position) clipPos: vec4<f32>,
                @location(0) worldNormal: vec3<f32>,
                @location(1) worldPos: vec3<f32>,
                @location(2) baseColor: vec4<f32>,
                @location(3) flags: vec4<f32>,
            };

            @vertex
            fn main(vert: VertexInput, inst: InstanceData) -> VertexOutput {
                let model = mat4x4<f32>(
                    inst.modelCol0,
                    inst.modelCol1,
                    inst.modelCol2,
                    inst.modelCol3,
                );

                let worldPos = model * vec4<f32>(vert.position, 1.0);
                let worldNormal = normalize((model * vec4<f32>(vert.normal, 0.0)).xyz);

                var out: VertexOutput;
                out.clipPos = camera.viewProj * worldPos;
                out.worldNormal = worldNormal;
                out.worldPos = worldPos.xyz;
                out.baseColor = inst.color;
                out.flags = inst.flags;
                return out;
            }
        `,

        slotFragment: /* wgsl */`
            struct LightParams {
                direction: vec4<f32>,
                ambient: vec4<f32>,
            };

            @group(0) @binding(1) var<uniform> light: LightParams;

            struct FragInput {
                @location(0) worldNormal: vec3<f32>,
                @location(1) worldPos: vec3<f32>,
                @location(2) baseColor: vec4<f32>,
                @location(3) flags: vec4<f32>,
            };

            @fragment
            fn main(frag: FragInput) -> @location(0) vec4<f32> {
                let normal = normalize(frag.worldNormal);
                let baseColor = frag.baseColor.rgb;

                // Light shading
                let NdotL = dot(normal, -light.direction.xyz);
                var shade: f32;
                if (NdotL > 0.3) {
                    shade = 1.0;
                } else if (NdotL > -0.1) {
                    shade = 0.75;
                } else {
                    shade = 0.55;
                }

                let ambient = light.ambient.xyz * light.ambient.w;
                var color = baseColor * (shade * 0.7 + ambient);

                // 内凹面（背板，法线朝 -Z）更暗
                if (normal.z < -0.5) {
                    color = color * 0.45;
                }

                // 分隔线（背板上略亮于背板的细条）
                // 分隔线在背板前方一点，法线朝 +Z，但基色和背板一样 → 用法线判断
                // 分隔线区域特征：法线朝 +Z 且 worldPos.z 接近 -depth
                if (normal.z > 0.5 && frag.worldPos.z < -0.1) {
                    color = baseColor * 0.6;
                }

                // Wood grain on frame
                if (normal.z > 0.5 && frag.worldPos.z > 0.0) {
                    let grain = sin(frag.worldPos.y * 20.0 + frag.worldPos.x * 3.0) * 0.02;
                    color = color + vec3<f32>(grain, grain * 0.5, grain * 0.2);
                }

                // Selected highlight
                if (frag.flags.x > 0.5) {
                    color = color * 1.3 + vec3<f32>(0.1, 0.08, 0.03);
                }

                // Safe slot: golden tint
                if (frag.flags.y > 0.5) {
                    color = mix(color, vec3<f32>(0.85, 0.7, 0.3), 0.2);
                }

                return vec4<f32>(color, 1.0);
            }
        `,

        // ===== 背景着色器 =====
        bgVertex: /* wgsl */`
            struct VertexOutput {
                @builtin(position) pos: vec4<f32>,
                @location(0) uv: vec2<f32>,
            };

            @vertex
            fn main(@location(0) position: vec2<f32>) -> VertexOutput {
                var out: VertexOutput;
                out.pos = vec4<f32>(position, 0.999, 1.0);
                out.uv = position * 0.5 + 0.5;
                return out;
            }
        `,

        bgFragment: /* wgsl */`
            @fragment
            fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
                // Deep wood background (like reference game)
                let topColor = vec3<f32>(0.35, 0.22, 0.13);
                let bottomColor = vec3<f32>(0.28, 0.16, 0.09);
                var color = mix(bottomColor, topColor, uv.y * 0.6 + 0.2);

                // Wood grain texture - vertical streaks
                let grain1 = sin(uv.x * 18.0 + sin(uv.y * 3.0) * 2.0) * 0.025;
                let grain2 = sin(uv.x * 45.0 + uv.y * 2.0) * 0.012;
                let grain3 = sin(uv.y * 80.0 + uv.x * 10.0) * 0.008;
                color = color + vec3<f32>(grain1 + grain2 + grain3);

                // Subtle vignette
                let center = uv - vec2<f32>(0.5, 0.5);
                let vignette = 1.0 - dot(center, center) * 0.5;
                color = color * vignette;

                return vec4<f32>(color, 1.0);
            }
        `,
    };

    window.Shaders = Shaders;
})();
