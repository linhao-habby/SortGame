/**
 * Geometry.js - 几何体生成
 * 圆角色块、正面凹槽木槽、全屏四边形
 */
(function() {
    'use strict';

    const Geometry = {

        /**
         * 生成圆角方块 (rounded box)
         * 在 XY 平面正面朝向 +Z，圆角在 4 条竖直边和 4 条水平边
         */
        createBlock() {
            const hw = GameConfig.RENDER.BLOCK_WIDTH / 2;   // half width (X)
            const hh = GameConfig.RENDER.BLOCK_HEIGHT / 2;  // half height (Y)
            const hd = GameConfig.RENDER.BLOCK_DEPTH / 2;   // half depth (Z)
            const r = Math.min(hw, hh, hd) * 0.38;          // 大圆角半径
            const segs = 7; // 圆角细分数（更平滑）

            const positions = [];
            const normals = [];
            const indices = [];

            // 辅助：添加一个 quad
            let vi = 0;
            const addQuad = (v0, v1, v2, v3, n) => {
                positions.push(...v0, ...v1, ...v2, ...v3);
                normals.push(...n, ...n, ...n, ...n);
                indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
                vi += 4;
            };

            // 辅助：添加一个三角形
            const addTri = (v0, v1, v2, n0, n1, n2) => {
                positions.push(...v0, ...v1, ...v2);
                normals.push(...n0, ...n1, ...n2);
                indices.push(vi, vi+1, vi+2);
                vi += 3;
            };

            // 内部尺寸（去掉圆角后的平面区域）
            const iw = hw - r;
            const ih = hh - r;
            const id = hd - r;

            // ===== 6 个平面中心区域 =====
            // 前面 (+Z)
            addQuad([-iw, -ih, hd], [iw, -ih, hd], [iw, ih, hd], [-iw, ih, hd], [0,0,1]);
            // 前面 上下延伸条
            addQuad([-iw, ih, hd], [iw, ih, hd], [iw, hh, hd-r], [-iw, hh, hd-r], [0,0,1]); // 上
            addQuad([-iw, -hh, hd-r], [iw, -hh, hd-r], [iw, -ih, hd], [-iw, -ih, hd], [0,0,1]); // 下
            // 前面 左右延伸条
            addQuad([-hw, -ih, hd-r], [-iw, -ih, hd], [-iw, ih, hd], [-hw, ih, hd-r], [0,0,1]); // 左
            addQuad([iw, -ih, hd], [hw, -ih, hd-r], [hw, ih, hd-r], [iw, ih, hd], [0,0,1]); // 右

            // 后面 (-Z)
            addQuad([iw, -ih, -hd], [-iw, -ih, -hd], [-iw, ih, -hd], [iw, ih, -hd], [0,0,-1]);

            // 上面 (+Y)
            addQuad([-iw, hh, id], [iw, hh, id], [iw, hh, -id], [-iw, hh, -id], [0,1,0]);

            // 下面 (-Y)
            addQuad([-iw, -hh, -id], [iw, -hh, -id], [iw, -hh, id], [-iw, -hh, id], [0,-1,0]);

            // 右面 (+X)
            addQuad([hw, -ih, id], [hw, -ih, -id], [hw, ih, -id], [hw, ih, id], [1,0,0]);

            // 左面 (-X)
            addQuad([-hw, -ih, -id], [-hw, -ih, id], [-hw, ih, id], [-hw, ih, -id], [-1,0,0]);

            // ===== 12 条圆角边缘 =====
            // 用柱面 strip 实现圆角
            const buildEdge = (center, axis1, axis2, len, halfLen) => {
                // axis1: 圆角弯曲方向1, axis2: 圆角弯曲方向2
                // 沿 len 方向挤出
                for (let i = 0; i < segs; i++) {
                    const a0 = (i / segs) * Math.PI / 2;
                    const a1 = ((i + 1) / segs) * Math.PI / 2;
                    const c0 = Math.cos(a0), s0 = Math.sin(a0);
                    const c1 = Math.cos(a1), s1 = Math.sin(a1);

                    const n0 = [axis1[0]*c0+axis2[0]*s0, axis1[1]*c0+axis2[1]*s0, axis1[2]*c0+axis2[2]*s0];
                    const n1 = [axis1[0]*c1+axis2[0]*s1, axis1[1]*c1+axis2[1]*s1, axis1[2]*c1+axis2[2]*s1];

                    const p00 = [center[0]+n0[0]*r - len[0]*halfLen, center[1]+n0[1]*r - len[1]*halfLen, center[2]+n0[2]*r - len[2]*halfLen];
                    const p01 = [center[0]+n0[0]*r + len[0]*halfLen, center[1]+n0[1]*r + len[1]*halfLen, center[2]+n0[2]*r + len[2]*halfLen];
                    const p10 = [center[0]+n1[0]*r - len[0]*halfLen, center[1]+n1[1]*r - len[1]*halfLen, center[2]+n1[2]*r - len[2]*halfLen];
                    const p11 = [center[0]+n1[0]*r + len[0]*halfLen, center[1]+n1[1]*r + len[1]*halfLen, center[2]+n1[2]*r + len[2]*halfLen];

                    // quad
                    positions.push(...p00, ...p01, ...p11, ...p10);
                    normals.push(...n0, ...n0, ...n1, ...n1);
                    indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
                    vi += 4;
                }
            };

            // 4 条垂直边缘 (沿Y轴, 在XZ平面弯曲)
            buildEdge([iw, 0, id],   [1,0,0], [0,0,1], [0,1,0], ih);  // 右前
            buildEdge([-iw, 0, id],  [0,0,1], [-1,0,0], [0,1,0], ih); // 左前
            buildEdge([iw, 0, -id],  [0,0,-1], [1,0,0], [0,1,0], ih); // 右后
            buildEdge([-iw, 0, -id], [-1,0,0], [0,0,-1], [0,1,0], ih); // 左后

            // 4 条水平上边缘 (沿X/Z轴, 在YZ/YX平面弯曲)
            buildEdge([0, ih, id],   [0,1,0], [0,0,1], [1,0,0], iw);  // 上前
            buildEdge([0, ih, -id],  [0,0,-1], [0,1,0], [1,0,0], iw); // 上后
            buildEdge([iw, ih, 0],   [1,0,0], [0,1,0], [0,0,1], id);  // 上右
            buildEdge([-iw, ih, 0],  [0,1,0], [-1,0,0], [0,0,1], id); // 上左

            // 4 条水平下边缘
            buildEdge([0, -ih, id],  [0,0,1], [0,-1,0], [1,0,0], iw);  // 下前
            buildEdge([0, -ih, -id], [0,-1,0], [0,0,-1], [1,0,0], iw); // 下后
            buildEdge([iw, -ih, 0],  [0,-1,0], [1,0,0], [0,0,1], id);  // 下右
            buildEdge([-iw, -ih, 0], [-1,0,0], [0,-1,0], [0,0,1], id); // 下左

            return {
                vertices: new Float32Array(positions),
                normals: new Float32Array(normals),
                indices: new Uint16Array(indices),
                vertexCount: vi,
                indexCount: indices.length,
            };
        },

        /**
         * 生成木槽容器（正面视角）
         * 竖长凹槽：外框 + 内凹深色背板 + 每个格子有分隔线
         * 在 XY 平面，中心为 (0, slotH/2, 0)
         * @param {number} capacity
         */
        createSlot(capacity) {
            const cellH = GameConfig.RENDER.CELL_HEIGHT;
            const innerW = GameConfig.RENDER.SLOT_INNER_WIDTH / 2;
            const wall = GameConfig.RENDER.SLOT_WALL_THICKNESS;
            const outerW = innerW + wall;
            const slotH = cellH * capacity;
            const depth = 0.25;
            const dividerH = 0.03; // 分隔线高度

            const positions = [];
            const normals = [];
            const indices = [];
            let vi = 0;

            const addQuad = (v0, v1, v2, v3, n) => {
                positions.push(...v0, ...v1, ...v2, ...v3);
                normals.push(...n, ...n, ...n, ...n);
                indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
                vi += 4;
            };

            // ----- 外框（正面面板）-----
            const fw = outerW;
            const border = wall;

            // 底部横条
            addQuad([-fw, -border, depth], [fw, -border, depth], [fw, 0, depth], [-fw, 0, depth], [0,0,1]);
            // 顶部横条
            addQuad([-fw, slotH, depth], [fw, slotH, depth], [fw, slotH+border, depth], [-fw, slotH+border, depth], [0,0,1]);
            // 左竖条
            addQuad([-fw, -border, depth], [-innerW, -border, depth], [-innerW, slotH+border, depth], [-fw, slotH+border, depth], [0,0,1]);
            // 右竖条
            addQuad([innerW, -border, depth], [fw, -border, depth], [fw, slotH+border, depth], [innerW, slotH+border, depth], [0,0,1]);

            // ----- 内凹背板 -----
            addQuad([-innerW, 0, -depth], [innerW, 0, -depth], [innerW, slotH, -depth], [-innerW, slotH, -depth], [0,0,-1]);

            // ----- 内凹侧壁 -----
            addQuad([-innerW, 0, -depth], [-innerW, 0, depth], [-innerW, slotH, depth], [-innerW, slotH, -depth], [-1,0,0]);
            addQuad([innerW, 0, depth], [innerW, 0, -depth], [innerW, slotH, -depth], [innerW, slotH, depth], [1,0,0]);
            addQuad([-innerW, 0, -depth], [innerW, 0, -depth], [innerW, 0, depth], [-innerW, 0, depth], [0,-1,0]);

            // ----- 格子分隔线（每个格子底部一条浅色横线）-----
            for (let i = 1; i < capacity; i++) {
                const y = cellH * i;
                // 分隔线是一个扁平 quad，略高于背板
                addQuad(
                    [-innerW + 0.02, y - dividerH/2, -depth + 0.01],
                    [innerW - 0.02, y - dividerH/2, -depth + 0.01],
                    [innerW - 0.02, y + dividerH/2, -depth + 0.01],
                    [-innerW + 0.02, y + dividerH/2, -depth + 0.01],
                    [0, 0, 1]
                );
            }

            // ----- 外框侧面（厚度感）-----
            addQuad([-fw, -border, -depth], [-fw, -border, depth], [-fw, slotH+border, depth], [-fw, slotH+border, -depth], [-1,0,0]);
            addQuad([fw, -border, depth], [fw, -border, -depth], [fw, slotH+border, -depth], [fw, slotH+border, depth], [1,0,0]);
            // 顶面
            addQuad([-fw, slotH+border, depth], [fw, slotH+border, depth], [fw, slotH+border, -depth], [-fw, slotH+border, -depth], [0,1,0]);
            // 底面
            addQuad([-fw, -border, -depth], [fw, -border, -depth], [fw, -border, depth], [-fw, -border, depth], [0,-1,0]);

            return {
                vertices: new Float32Array(positions),
                normals: new Float32Array(normals),
                indices: new Uint16Array(indices),
                vertexCount: vi,
                indexCount: indices.length,
            };
        },

        /**
         * 全屏四边形
         */
        createFullscreenQuad() {
            const vertices = new Float32Array([
                -1, -1,  1, -1,  -1, 1,
                -1,  1,  1, -1,   1, 1,
            ]);
            return { vertices, vertexCount: 6 };
        },
    };

    window.Geometry = Geometry;
})();
