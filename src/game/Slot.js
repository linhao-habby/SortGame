/**
 * Slot.js - 木槽数据模型
 * 管理单个木槽中的色块堆栈
 * 
 * 色块数据结构：{ color: number, type?: 'rainbow' }
 *   - 普通色块：{ color: 0~11 }（type 不存在或为 undefined）
 *   - 彩虹块：  { color: -1, type: 'rainbow' }
 *     彩虹块匹配任意颜色，可放入任何槽，参与任何连续同色判定
 */
(function() {
    'use strict';

    /**
     * 判断色块是否为彩虹块
     */
    function isRainbow(block) {
        return block && block.type === 'rainbow';
    }

    /**
     * 判断两个色块是否"颜色兼容"（考虑彩虹块）
     * 彩虹块与任何色块兼容，两个彩虹块也互相兼容
     */
    function colorsMatch(blockA, blockB) {
        if (!blockA || !blockB) return false;
        if (isRainbow(blockA) || isRainbow(blockB)) return true;
        return blockA.color === blockB.color;
    }

    class Slot {
        /**
         * @param {number} id - 木槽编号
         * @param {number} capacity - 木槽容量
         * @param {boolean} isSafe - 是否为安全槽
         */
        constructor(id, capacity, isSafe = false) {
            this.id = id;
            this.blocks = [];    // 从底部(index 0)到顶部(index last)的色块数组
            this.capacity = capacity;
            this.isSafe = isSafe;
        }

        /**
         * 获取最顶部色块
         * @returns {{ color: number, type?: string } | null}
         */
        topBlock() {
            if (this.blocks.length === 0) return null;
            return this.blocks[this.blocks.length - 1];
        }

        /**
         * 获取顶部连续同色块数量（彩虹块视为万能色）
         * 
         * 规则：
         * 1. 从顶部开始，确定连续段的"有效颜色"：
         *    - 如果顶部是普通色块，有效颜色 = 该颜色
         *    - 如果顶部是彩虹块，往下找第一个普通色块作为有效颜色
         *    - 如果全是彩虹块，有效颜色 = -1（彩虹组）
         * 2. 从顶部往下计数：彩虹块或与有效颜色相同的普通色块都算在内
         * 3. 遇到不匹配的普通色块时停止
         * 
         * 这确保 [Red, Rainbow, Blue] 不会被当作一个整体（有效色=Red，Blue不匹配会停止）
         * 
         * @returns {number}
         */
        topConsecutiveCount() {
            if (this.blocks.length === 0) return 0;

            // 先确定有效颜色（从顶部往下第一个非彩虹块）
            let effectiveColor = -1;
            for (let i = this.blocks.length - 1; i >= 0; i--) {
                if (!isRainbow(this.blocks[i])) {
                    effectiveColor = this.blocks[i].color;
                    break;
                }
            }

            let count = 0;
            for (let i = this.blocks.length - 1; i >= 0; i--) {
                const block = this.blocks[i];
                if (isRainbow(block)) {
                    // 彩虹块始终算在连续段内
                    count++;
                } else if (effectiveColor === -1) {
                    // 全彩虹段，遇到普通色块就停
                    break;
                } else if (block.color === effectiveColor) {
                    count++;
                } else {
                    break;
                }
            }
            return count;
        }

        /**
         * 获取顶部连续同色块的"有效颜色"
         * 在连续段范围内，找第一个非彩虹块的颜色。
         * 如果全是彩虹块，返回 -1。
         * 
         * @returns {number | null}  颜色编号，空槽返回 null，全彩虹返回 -1
         */
        topConsecutiveColor() {
            if (this.blocks.length === 0) return null;
            // 从顶部往下找第一个非彩虹块
            for (let i = this.blocks.length - 1; i >= 0; i--) {
                if (!isRainbow(this.blocks[i])) {
                    return this.blocks[i].color;
                }
            }
            // 全是彩虹块
            return -1;
        }

        /**
         * 是否为空
         */
        isEmpty() {
            return this.blocks.length === 0;
        }

        /**
         * 是否已满
         */
        isFull() {
            return this.blocks.length >= this.capacity;
        }

        /**
         * 剩余可用空间
         */
        availableSpace() {
            return Math.max(0, this.capacity - this.blocks.length);
        }

        /**
         * 能否接收指定颜色的色块（考虑彩虹块）
         * 条件：未满 且 (空槽 或 颜色兼容)
         * 
         * @param {number} color - 色块颜色编号（-1 表示彩虹块）
         * @param {boolean} [isRainbowBlock=false] - 待放入的是否是彩虹块
         * @returns {boolean}
         */
        canReceive(color, isRainbowBlock = false) {
            if (this.isFull()) return false;
            if (this.isEmpty()) return true;
            // 彩虹块可以放到任何非满槽上
            if (isRainbowBlock) return true;
            // 如果目标槽顶部是彩虹块，任何颜色都可以放上去
            const top = this.topBlock();
            if (isRainbow(top)) return true;
            return top.color === color;
        }

        /**
         * 检测是否为"整槽纯色满槽"（全部同色或含彩虹块且满槽）
         * 不含彩虹块时：所有色块颜色相同且满槽
         * 含彩虹块的情况不触发整槽消除（彩虹块不应被白白消耗）
         * 
         * @returns {{ isFull: boolean, color: number } | null}  满足条件返回颜色，否则 null
         */
        checkFullSameColor() {
            if (!this.isFull()) return null;
            if (this.blocks.length === 0) return null;

            // 找到第一个非彩虹块的颜色
            let baseColor = -1;
            for (const block of this.blocks) {
                if (isRainbow(block)) continue;
                if (baseColor === -1) {
                    baseColor = block.color;
                } else if (block.color !== baseColor) {
                    return null; // 有不同颜色的普通色块
                }
            }

            // 全是彩虹块 → 不触发（没有意义）
            if (baseColor === -1) return null;

            // 含有彩虹块 → 不触发（不应消耗彩虹块）
            for (const block of this.blocks) {
                if (isRainbow(block)) return null;
            }

            return { isFull: true, color: baseColor };
        }

        /**
         * 从顶部弹出 N 个色块
         * @param {number} count
         * @returns {{ color: number, type?: string }[]}
         */
        popBlocks(count) {
            const removed = [];
            const actualCount = Math.min(count, this.blocks.length);
            for (let i = 0; i < actualCount; i++) {
                removed.push(this.blocks.pop());
            }
            return removed;
        }

        /**
         * 向顶部压入色块
         * @param {{ color: number, type?: string }[]} blocks - 要压入的色块数组（按顺序压入）
         */
        pushBlocks(blocks) {
            for (const block of blocks) {
                this.blocks.push(block);
            }
        }

        /**
         * 从底部推入一个色块（补充机制），已有色块上顶
         * 如果已满，返回溢出的顶部色块
         * @param {{ color: number, type?: string }} block
         * @returns {{ color: number, type?: string } | null} 溢出的色块，无溢出返回 null
         */
        pushFromBottom(block) {
            this.blocks.unshift(block);
            if (this.blocks.length > this.capacity) {
                // 顶部溢出
                return this.blocks.pop();
            }
            return null;
        }

        /**
         * 深拷贝（保留 type 字段）
         * @returns {Slot}
         */
        clone() {
            const s = new Slot(this.id, this.capacity, this.isSafe);
            s.blocks = this.blocks.map(b => {
                const copy = { color: b.color };
                if (b.type) copy.type = b.type;
                return copy;
            });
            return s;
        }
    }

    // 导出工具函数供其他模块使用
    window.BlockUtils = { isRainbow, colorsMatch };
    window.Slot = Slot;
})();
