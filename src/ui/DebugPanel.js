/**
 * DebugPanel.js - 调试面板
 * 屏幕角落的齿轮按钮，点击展开难度参数编辑面板
 * 修改后点"应用并重来"即可生效
 */
(function() {
    'use strict';

    class DebugPanel {
        constructor() {
            this.el = null;
            this._panel = null;
            this._visible = false;
            this._onApply = null; // 应用回调（重来）
        }

        /**
         * @param {function} onApply - 点击"应用并重来"时的回调
         */
        create(onApply) {
            this._onApply = onApply;

            // 齿轮按钮
            this.el = document.createElement('div');
            this.el.className = 'debug-toggle';
            this.el.textContent = '\u2699';
            this.el.addEventListener('click', () => this.toggle());
            document.body.appendChild(this.el);

            // 面板
            this._panel = document.createElement('div');
            this._panel.className = 'debug-panel';
            this._panel.style.display = 'none';
            document.body.appendChild(this._panel);
        }

        toggle() {
            this._visible = !this._visible;
            if (this._visible) {
                this._render();
                this._panel.style.display = 'block';
            } else {
                this._panel.style.display = 'none';
            }
        }

        hide() {
            this._visible = false;
            if (this._panel) this._panel.style.display = 'none';
        }

        _render() {
            const stages = GameConfig.DIFFICULTY_STAGES;
            const hp = GameConfig.INITIAL_HP;

            let html = '<div class="debug-header">难度调参<span class="debug-close">&times;</span></div>';

            // 血量
            html += `<div class="debug-row debug-hp-row">
                <label>初始血量</label>
                <input type="number" id="debug-hp" value="${hp}" min="1" max="99">
            </div>`;

            // 阶段表格
            html += '<div class="debug-stages">';
            stages.forEach((s, i) => {
                html += this._renderStage(s, i);
            });
            html += '</div>';

            // 按钮
            html += `<div class="debug-actions">
                <button class="debug-btn debug-btn-apply" id="debug-apply">应用并重来</button>
                <button class="debug-btn debug-btn-reset" id="debug-reset">恢复默认</button>
            </div>`;

            this._panel.innerHTML = html;

            // 事件
            this._panel.querySelector('.debug-close').addEventListener('click', () => this.hide());
            this._panel.querySelector('#debug-apply').addEventListener('click', () => this._apply());
            this._panel.querySelector('#debug-reset').addEventListener('click', () => this._reset());
        }

        _renderStage(s, i) {
            const colorVal = s.colorCount !== undefined ? s.colorCount : `${s.colorCountRange[0]},${s.colorCountRange[1]}`;
            const slotVal = s.slotCount !== undefined ? s.slotCount : `${s.slotCountRange[0]},${s.slotCountRange[1]}`;
            const capVal = s.capacity !== undefined ? s.capacity : `${s.capacityRange[0]},${s.capacityRange[1]}`;
            const emptyVal = s.emptySlots !== undefined ? s.emptySlots : `${s.emptySlotsRange[0]},${s.emptySlotsRange[1]}`;

            return `
            <div class="debug-stage">
                <div class="debug-stage-title">${i}: ${s.label} (${s.minOrders}-${s.maxOrders === Infinity ? '\u221e' : s.maxOrders}单)</div>
                <div class="debug-fields">
                    <label>颜色<input data-stage="${i}" data-field="colorCount" value="${colorVal}"></label>
                    <label>槽数<input data-stage="${i}" data-field="slotCount" value="${slotVal}"></label>
                    <label>容量<input data-stage="${i}" data-field="capacity" value="${capVal}"></label>
                    <label>空槽<input data-stage="${i}" data-field="emptySlots" value="${emptyVal}"></label>
                    <label>订单数<input type="number" data-stage="${i}" data-field="orderNum" value="${s.orderNum}" min="1" max="3"></label>
                    <label>需求<input data-stage="${i}" data-field="orderRange" value="${s.orderRange[0]},${s.orderRange[1]}"></label>
                    <label>起始单数<input type="number" data-stage="${i}" data-field="minOrders" value="${s.minOrders}" min="0"></label>
                </div>
            </div>`;
        }

        /**
         * 解析输入值：支持单数字或 "min,max" 范围格式
         * 返回 { fixed: number } 或 { range: [min, max] }
         */
        _parseValue(str) {
            str = str.trim();
            if (str.includes(',')) {
                const parts = str.split(',').map(s => parseInt(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    return { range: parts };
                }
            }
            const n = parseInt(str);
            if (!isNaN(n)) return { fixed: n };
            return null;
        }

        _apply() {
            const stages = GameConfig.DIFFICULTY_STAGES;

            // 读取血量
            const hpInput = this._panel.querySelector('#debug-hp');
            if (hpInput) {
                const hp = parseInt(hpInput.value);
                if (!isNaN(hp) && hp > 0) GameConfig.INITIAL_HP = hp;
            }

            // 读取每个阶段的输入
            const inputs = this._panel.querySelectorAll('[data-stage]');
            for (const input of inputs) {
                const idx = parseInt(input.dataset.stage);
                const field = input.dataset.field;
                const stage = stages[idx];
                if (!stage) continue;

                if (field === 'orderRange') {
                    const v = this._parseValue(input.value);
                    if (v && v.range) stage.orderRange = v.range;
                    else if (v && v.fixed !== undefined) stage.orderRange = [v.fixed, v.fixed];
                } else if (field === 'orderNum' || field === 'minOrders') {
                    const n = parseInt(input.value);
                    if (!isNaN(n)) stage[field] = n;
                } else {
                    // colorCount/slotCount/capacity/emptySlots 支持固定值或范围
                    const v = this._parseValue(input.value);
                    if (!v) continue;
                    if (v.range) {
                        delete stage[field];
                        stage[field + 'Range'] = v.range;
                    } else {
                        delete stage[field + 'Range'];
                        stage[field] = v.fixed;
                    }
                }
            }

            // 更新 maxOrders（自动根据下一个阶段的 minOrders 推算）
            for (let i = 0; i < stages.length - 1; i++) {
                stages[i].maxOrders = stages[i + 1].minOrders - 1;
            }
            stages[stages.length - 1].maxOrders = Infinity;

            this.hide();
            if (this._onApply) this._onApply();
        }

        _reset() {
            if (window.D && window.D.reset) {
                window.D.reset();
            }
            this._render(); // 刷新面板
        }
    }

    window.DebugPanel = DebugPanel;
})();
