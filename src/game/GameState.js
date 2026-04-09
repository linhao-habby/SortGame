/**
 * GameState.js - 游戏状态管理
 * 棋盘初始化、移动规则、血量管理、色块补充、溢出扣血、死局检测
 * 支持同时 2 个订单，2 个都完成后才补充
 */
(function() {
    'use strict';

    class GameState {
        constructor() {
            this.slots = [];
            this.orders = [];                   // 当前订单数组（2个）
            this.completedOrders = 0;           // 已完成订单总数（累计）
            this.hp = GameConfig.INITIAL_HP;
            this.selectedSlotIndex = null;
            this.status = 'playing';
            this.initialState = null;
            this.score = 0;
            this.combo = 0;
            this.lastScoreGain = 0;
        }

        /**
         * 获取木槽数量
         */
        getNormalSlotCount() {
            return this.slots.length;
        }

        // ===== 棋盘初始化 =====

        initBoard(params) {
            const { colorCount, slotCount, capacity, emptySlots } = params;
            // initBlocks: 每个有色块的槽初始放几个，默认 = capacity（填满）
            const blocksPerSlot = params.initBlocks || capacity;
            this.slots = [];
            this.hp = GameConfig.INITIAL_HP;
            this.completedOrders = 0;
            this.orders = [];
            this.selectedSlotIndex = null;
            this.status = 'playing';

            for (let i = 0; i < slotCount; i++) {
                this.slots.push(new Slot(i, capacity, false));
            }

            const fillableSlotCount = slotCount - emptySlots;
            const totalBlocks = fillableSlotCount * blocksPerSlot;
            const blockPool = this._generateBlockPool(totalBlocks, colorCount);
            this._shuffleArray(blockPool);

            let poolIndex = 0;
            for (let i = 0; i < fillableSlotCount; i++) {
                for (let j = 0; j < blocksPerSlot; j++) {
                    this.slots[i].blocks.push(blockPool[poolIndex++]);
                }
            }

            this.initialState = this._createSnapshot();
        }

        _generateBlockPool(totalBlocks, colorCount) {
            const pool = [];
            const perColor = Math.floor(totalBlocks / colorCount);
            let remainder = totalBlocks - perColor * colorCount;
            for (let c = 0; c < colorCount; c++) {
                const count = perColor + (remainder > 0 ? 1 : 0);
                if (remainder > 0) remainder--;
                for (let i = 0; i < count; i++) {
                    pool.push({ color: c });
                }
            }
            return pool;
        }

        _shuffleArray(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        }

        // ===== 移动操作 =====

        selectSlot(slotIndex) {
            if (this.status !== 'playing') {
                return { action: 'blocked' };
            }
            const slot = this.slots[slotIndex];
            if (!slot) return { action: 'invalid' };

            if (this.selectedSlotIndex === null) {
                if (slot.isEmpty()) return { action: 'empty_slot' };
                this.selectedSlotIndex = slotIndex;
                return { action: 'selected', data: { slotIndex } };
            }

            if (this.selectedSlotIndex === slotIndex) {
                this.selectedSlotIndex = null;
                return { action: 'deselected', data: { slotIndex } };
            }

            const sourceIndex = this.selectedSlotIndex;
            this.selectedSlotIndex = null;
            return this.tryMove(sourceIndex, slotIndex);
        }

        tryMove(sourceIndex, targetIndex) {
            const source = this.slots[sourceIndex];
            const target = this.slots[targetIndex];
            if (!source || !target || source.isEmpty()) return { action: 'invalid' };

            const topColor = source.topConsecutiveColor();
            if (!target.canReceive(topColor)) {
                if (!target.isEmpty()) {
                    this.selectedSlotIndex = targetIndex;
                    return { action: 'reselected', data: { slotIndex: targetIndex } };
                }
                return { action: 'illegal' };
            }

            const consecutiveCount = source.topConsecutiveCount();
            const space = target.availableSpace();
            const moveCount = Math.min(consecutiveCount, space);

            const movedBlocks = source.popBlocks(moveCount);
            movedBlocks.reverse();
            target.pushBlocks(movedBlocks);

            return {
                action: 'moved',
                data: { sourceIndex, targetIndex, movedBlocks, moveCount, color: topColor },
            };
        }

        // ===== 交付检测（多订单）=====

        /**
         * 检测是否有木槽满足任一活跃订单的交付条件
         * 优先选择顶部连续同色数量最多的木槽
         * @returns {{ canDeliver: boolean, slotIndex?: number, orderIndex?: number }}
         */
        checkDelivery() {
            // 遍历每个活跃订单，找出所有满足条件的槽，选连续数量最多的
            for (let oi = 0; oi < this.orders.length; oi++) {
                const order = this.orders[oi];
                if (order.status !== 'active') continue;

                let bestSlot = -1;
                let bestCount = 0;

                for (let si = 0; si < this.slots.length; si++) {
                    const slot = this.slots[si];
                    if (slot.isEmpty()) continue;
                    if (slot.topConsecutiveColor() === order.color) {
                        const count = slot.topConsecutiveCount();
                        if (count >= order.count && count > bestCount) {
                            bestCount = count;
                            bestSlot = si;
                        }
                    }
                }

                if (bestSlot >= 0) {
                    return { canDeliver: true, slotIndex: bestSlot, orderIndex: oi };
                }
            }
            return { canDeliver: false };
        }

        /**
         * 执行交付：取走该槽顶部所有连续同色色块（可能大于订单要求数量）
         * @param {number} slotIndex
         * @param {number} orderIndex
         * @returns {{ deliveredBlocks: { color: number }[], order: object, deliveredCount: number }}
         */
        executeDelivery(slotIndex, orderIndex) {
            const order = this.orders[orderIndex];
            const slot = this.slots[slotIndex];
            // 取走整段连续同色，而非仅订单要求的数量
            const consecutiveCount = slot.topConsecutiveCount();
            const deliveredBlocks = slot.popBlocks(consecutiveCount);

            order.status = 'completed';
            this.completedOrders++;

            return { deliveredBlocks, order, deliveredCount: consecutiveCount };
        }

        /**
         * 检查是否所有订单都已完成
         */
        allOrdersCompleted() {
            return this.orders.length > 0 && this.orders.every(o => o.status === 'completed');
        }

        /**
         * 获取当前活跃订单数量
         */
        activeOrderCount() {
            return this.orders.filter(o => o.status === 'active').length;
        }

        // ===== 色块补充 =====

        executeRefill(availableColorCount) {
            const refillData = [];
            const overflowData = [];

            for (const slot of this.slots) {
                const newColor = Math.floor(Math.random() * availableColorCount);
                const newBlock = { color: newColor };
                const overflow = slot.pushFromBottom(newBlock);

                refillData.push({ slotIndex: slot.id, newBlock });
                if (overflow) {
                    overflowData.push({ slotIndex: slot.id, block: overflow });
                }
            }

            const totalOverflow = overflowData.length;
            this.hp = Math.max(0, this.hp - totalOverflow);

            return { refillData, overflowData, totalOverflow };
        }

        // ===== 死局检测 =====

        isDeadlock() {
            for (const slot of this.slots) {
                if (!slot.isFull()) return false;
            }
            return true;
        }

        checkGameOver() {
            if (this.hp <= 0) {
                this.status = 'gameover';
                return { gameOver: true, reason: 'hp_zero' };
            }
            if (this.isDeadlock()) {
                this.status = 'gameover';
                return { gameOver: true, reason: 'deadlock' };
            }
            return { gameOver: false };
        }

        // ===== 重新开始 =====

        restart() {
            if (!this.initialState) return;
            this._restoreSnapshot(this.initialState);
        }

        // ===== 状态快照 =====

        _createSnapshot() {
            return {
                slots: this.slots.map(s => s.clone()),
                hp: this.hp,
                completedOrders: this.completedOrders,
                orders: this.orders.map(o => ({ ...o })),
            };
        }

        _restoreSnapshot(snapshot) {
            this.slots = snapshot.slots.map(s => s.clone());
            this.hp = snapshot.hp;
            this.completedOrders = snapshot.completedOrders;
            this.orders = snapshot.orders.map(o => ({ ...o }));
            this.selectedSlotIndex = null;
            this.status = 'playing';
        }

        // ===== 调试 =====

        debugPrint() {
            console.log(`=== GameState | HP: ${this.hp} | Orders: ${this.completedOrders} | Status: ${this.status} ===`);
            for (let i = 0; i < this.orders.length; i++) {
                const o = this.orders[i];
                const name = GameConfig.COLORS[o.color]?.name || `C${o.color}`;
                console.log(`  Order${i}: ${name} x${o.count} [${o.status}]`);
            }
            for (const slot of this.slots) {
                const label = ' ';
                const blocks = slot.blocks.map(b => {
                    const c = GameConfig.COLORS[b.color];
                    return c ? c.name.charAt(0) : b.color;
                }).join(' ');
                const empty = slot.availableSpace();
                console.log(`  [${label}] Slot${slot.id}(${slot.capacity}): [${blocks}]${empty > 0 ? ' +' + empty + '空' : ' 满'}`);
            }
        }
    }

    window.GameState = GameState;
})();
