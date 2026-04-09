/**
 * math.js - 矩阵与向量运算工具
 * 4x4 矩阵（列主序 Float32Array[16]）、3D 向量运算
 */
(function() {
    'use strict';

    const MathUtils = {

        // ===== 矩阵创建 =====

        identity() {
            return new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ]);
        },

        // ===== 投影矩阵 =====

        /**
         * 透视投影
         */
        perspective(fovY, aspect, near, far) {
            const f = 1.0 / Math.tan(fovY / 2);
            const rangeInv = 1.0 / (near - far);
            return new Float32Array([
                f / aspect, 0, 0, 0,
                0, f, 0, 0,
                0, 0, far * rangeInv, -1,
                0, 0, near * far * rangeInv, 0,
            ]);
        },

        /**
         * 正交投影
         */
        orthographic(left, right, bottom, top, near, far) {
            const lr = 1 / (left - right);
            const bt = 1 / (bottom - top);
            const nf = 1 / (near - far);
            return new Float32Array([
                -2 * lr, 0, 0, 0,
                0, -2 * bt, 0, 0,
                0, 0, nf, 0,
                (left + right) * lr, (top + bottom) * bt, near * nf, 1,
            ]);
        },

        // ===== 视图矩阵 =====

        /**
         * lookAt 视图矩阵
         */
        lookAt(eye, target, up) {
            const zx = eye[0] - target[0];
            const zy = eye[1] - target[1];
            const zz = eye[2] - target[2];
            let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
            const fz = [zx / len, zy / len, zz / len];

            // cross(up, forward)
            let xx = up[1] * fz[2] - up[2] * fz[1];
            let xy = up[2] * fz[0] - up[0] * fz[2];
            let xz = up[0] * fz[1] - up[1] * fz[0];
            len = Math.sqrt(xx * xx + xy * xy + xz * xz);
            const fx = [xx / len, xy / len, xz / len];

            // cross(forward, right)
            const fy = [
                fz[1] * fx[2] - fz[2] * fx[1],
                fz[2] * fx[0] - fz[0] * fx[2],
                fz[0] * fx[1] - fz[1] * fx[0],
            ];

            return new Float32Array([
                fx[0], fy[0], fz[0], 0,
                fx[1], fy[1], fz[1], 0,
                fx[2], fy[2], fz[2], 0,
                -(fx[0] * eye[0] + fx[1] * eye[1] + fx[2] * eye[2]),
                -(fy[0] * eye[0] + fy[1] * eye[1] + fy[2] * eye[2]),
                -(fz[0] * eye[0] + fz[1] * eye[1] + fz[2] * eye[2]),
                1,
            ]);
        },

        // ===== 模型变换 =====

        translation(x, y, z) {
            return new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                x, y, z, 1,
            ]);
        },

        scaling(x, y, z) {
            return new Float32Array([
                x, 0, 0, 0,
                0, y, 0, 0,
                0, 0, z, 0,
                0, 0, 0, 1,
            ]);
        },

        rotationY(angle) {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return new Float32Array([
                c, 0, -s, 0,
                0, 1,  0, 0,
                s, 0,  c, 0,
                0, 0,  0, 1,
            ]);
        },

        // ===== 矩阵运算 =====

        /**
         * 4x4 矩阵乘法 a * b
         */
        multiply(a, b) {
            const out = new Float32Array(16);
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    out[j * 4 + i] =
                        a[0 * 4 + i] * b[j * 4 + 0] +
                        a[1 * 4 + i] * b[j * 4 + 1] +
                        a[2 * 4 + i] * b[j * 4 + 2] +
                        a[3 * 4 + i] * b[j * 4 + 3];
                }
            }
            return out;
        },

        /**
         * 链式乘法 multiply(a, b, c, ...)
         */
        multiplyAll(...matrices) {
            let result = matrices[0];
            for (let i = 1; i < matrices.length; i++) {
                result = this.multiply(result, matrices[i]);
            }
            return result;
        },

        // ===== 向量工具 =====

        vec3Normalize(v) {
            const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
            if (len === 0) return [0, 0, 0];
            return [v[0] / len, v[1] / len, v[2] / len];
        },

        vec3Cross(a, b) {
            return [
                a[1] * b[2] - a[2] * b[1],
                a[2] * b[0] - a[0] * b[2],
                a[0] * b[1] - a[1] * b[0],
            ];
        },

        vec3Dot(a, b) {
            return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        },

        degToRad(deg) {
            return deg * Math.PI / 180;
        },
    };

    window.MathUtils = MathUtils;
})();
