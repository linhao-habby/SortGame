/**
 * Slot.js - 木槽数据模型
 * 管理单个木槽中的色块堆栈
 */
(function() {
    'use strict';

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
         * @returns {{ color: number } | null}
         */
        topBlock() {
            if (this.blocks.length === 0) return null;
            return this.blocks[this.blocks.length - 1];
        }

        /**
         * 获取顶部连续同色块数量
         * @returns {number}
         */
        topConsecutiveCount() {
            if (this.blocks.length === 0) return 0;
            const topColor = this.blocks[this.blocks.length - 1].color;
            let count = 0;
            for (let i = this.blocks.length - 1; i >= 0; i--) {
                if (this.blocks[i].color === topColor) {
                    count++;
                } else {
                    break;
                }
            }
            return count;
        }

        /**
         * 获取顶部连续同色块的颜色
         * @returns {number | null}
         */
        topConsecutiveColor() {
            const top = this.topBlock();
            return top ? top.color : null;
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
         * 能否接收指定颜色的色块
         * 条件：未满 且 (空槽 或 顶部颜色相同)
         * @param {number} color - 色块颜色编号
         * @returns {boolean}
         */
        canReceive(color) {
            if (this.isFull()) return false;
            if (this.isEmpty()) return true;
            return this.topBlock().color === color;
        }

        /**
         * 从顶部弹出 N 个色块
         * @param {number} count
         * @returns {{ color: number }[]}
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
         * @param {{ color: number }[]} blocks - 要压入的色块数组（按顺序压入）
         */
        pushBlocks(blocks) {
            for (const block of blocks) {
                this.blocks.push(block);
            }
        }

        /**
         * 从底部推入一个色块（补充机制），已有色块上顶
         * 如果已满，返回溢出的顶部色块
         * @param {{ color: number }} block
         * @returns {{ color: number } | null} 溢出的色块，无溢出返回 null
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
         * 深拷贝
         * @returns {Slot}
         */
        clone() {
            const s = new Slot(this.id, this.capacity, this.isSafe);
            s.blocks = this.blocks.map(b => ({ color: b.color }));
            return s;
        }
    }

    window.Slot = Slot;
})();
