/**
 * DebugPanel.js - 调试面板
 * 右下角齿轮按钮，点击展开难度参数编辑面板
 * 支持：应用并重来 / 保存到本地 / 导出代码 / 恢复默认
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'SortGame_DifficultyConfig';

    class DebugPanel {
        constructor() {
            this.el = null;
            this._panel = null;
            this._visible = false;
            this._onApply = null;
        }

        /**
         * @param {function} onApply - 点击"应用并重来"时的回调
         */
        create(onApply) {
            this._onApply = onApply;

            // 启动时从 localStorage 加载已保存的参数
            this._loadFromStorage();

            // 齿轮按钮
            this.el = document.createElement('div');
            this.el.className = 'debug-toggle';
            this.el.textContent = '\u2699';
            this.el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
            document.body.appendChild(this.el);

            // 面板
            this._panel = document.createElement('div');
            this._panel.className = 'debug-panel';
            this._panel.style.display = 'none';
            this._panel.addEventListener('click', (e) => e.stopPropagation());
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

        // ===== 渲染面板 =====

        _render() {
            const stages = GameConfig.DIFFICULTY_STAGES;
            const hp = GameConfig.INITIAL_HP;

            let html = '<div class="debug-header">难度调参<span class="debug-close">&times;</span></div>';

            // 血量 + 每单补充 + 分数参数
            const scoreCfg = GameConfig.SCORE || { BASE_PER_BLOCK: 10, OVERFLOW_PER_BLOCK: 15, COMBO_STEP: 0.5 };
            const refillVal = GameConfig.REFILL_PER_ORDER ? 1 : 0;
            html += `<div class="debug-row debug-hp-row">
                <label>血量</label>
                <input type="number" id="debug-hp" value="${hp}" min="1" max="99">
                <label>每单补充</label>
                <input type="number" id="debug-refill-mode" value="${refillVal}" min="0" max="1">
                <label>基础分</label>
                <input type="number" id="debug-score-base" value="${scoreCfg.BASE_PER_BLOCK}" min="1">
                <label>超额分</label>
                <input type="number" id="debug-score-overflow" value="${scoreCfg.OVERFLOW_PER_BLOCK}" min="0">
                <label>combo</label>
                <input type="number" id="debug-score-combo" value="${scoreCfg.COMBO_STEP}" min="0" step="0.1">
                <label>combo窗口</label>
                <input type="number" id="debug-score-combo-window" value="${scoreCfg.COMBO_WINDOW || 3}" min="1" max="10">
            </div>`;

            // 阶段
            html += '<div class="debug-stages">';
            stages.forEach((s, i) => {
                html += this._renderStage(s, i);
            });
            html += '</div>';

            // 按钮组
            html += `<div class="debug-actions">
                <button class="debug-btn debug-btn-apply" id="debug-apply">应用并重来</button>
                <button class="debug-btn debug-btn-save" id="debug-save">保存到本地</button>
            </div>
            <div class="debug-actions">
                <button class="debug-btn debug-btn-export" id="debug-export">导出代码</button>
                <button class="debug-btn debug-btn-reset" id="debug-reset">恢复默认</button>
            </div>`;

            // 导出区域（默认隐藏）
            html += '<div class="debug-export-area" id="debug-export-area" style="display:none"><textarea id="debug-export-text" readonly></textarea><button class="debug-btn debug-btn-copy" id="debug-copy">复制</button></div>';

            this._panel.innerHTML = html;

            // 事件绑定
            this._panel.querySelector('.debug-close').addEventListener('click', () => this.hide());
            this._panel.querySelector('#debug-apply').addEventListener('click', () => { this._readInputs(); this.hide(); if (this._onApply) this._onApply(); });
            this._panel.querySelector('#debug-save').addEventListener('click', () => this._saveToStorage());
            this._panel.querySelector('#debug-export').addEventListener('click', () => this._exportCode());
            this._panel.querySelector('#debug-reset').addEventListener('click', () => this._resetAll());
            this._panel.querySelector('#debug-copy').addEventListener('click', () => this._copyExport());
        }

        _renderStage(s, i) {
            const _fv = (field) => {
                if (s[field] !== undefined) return s[field];
                const r = s[field + 'Range'];
                if (r) return `${r[0]},${r[1]}`;
                return '';
            };
            const colorVal = _fv('colorCount');
            const slotVal = _fv('slotCount');
            const capVal = _fv('capacity');
            const emptyVal = _fv('emptySlots');
            const initVal = _fv('initBlocks');

            return `
            <div class="debug-stage">
                <div class="debug-stage-title">${i}: ${s.label} (${s.minOrders}-${s.maxOrders === Infinity ? '\u221e' : s.maxOrders}单)</div>
                <div class="debug-fields">
                    <label>颜色<input data-stage="${i}" data-field="colorCount" value="${colorVal}"></label>
                    <label>槽数<input data-stage="${i}" data-field="slotCount" value="${slotVal}"></label>
                    <label>容量<input data-stage="${i}" data-field="capacity" value="${capVal}"></label>
                    <label>空槽<input data-stage="${i}" data-field="emptySlots" value="${emptyVal}"></label>
                    <label>初始块数<input data-stage="${i}" data-field="initBlocks" value="${initVal}"></label>
                    <label>订单数<input type="number" data-stage="${i}" data-field="orderNum" value="${s.orderNum}" min="1" max="3"></label>
                    <label>需求<input data-stage="${i}" data-field="orderRange" value="${s.orderRange[0]},${s.orderRange[1]}"></label>
                    <label>起始单数<input type="number" data-stage="${i}" data-field="minOrders" value="${s.minOrders}" min="0"></label>
                    <label>标签<input data-stage="${i}" data-field="label" value="${s.label}"></label>
                </div>
            </div>`;
        }

        // ===== 读取面板输入到 GameConfig =====

        _readInputs() {
            const stages = GameConfig.DIFFICULTY_STAGES;

            // 血量
            const hpInput = this._panel.querySelector('#debug-hp');
            if (hpInput) {
                const hp = parseInt(hpInput.value);
                if (!isNaN(hp) && hp > 0) GameConfig.INITIAL_HP = hp;
            }

            // 补充模式
            const refillInput = this._panel.querySelector('#debug-refill-mode');
            if (refillInput) GameConfig.REFILL_PER_ORDER = parseInt(refillInput.value) === 1;

            // 分数参数
            const baseInput = this._panel.querySelector('#debug-score-base');
            const overflowInput = this._panel.querySelector('#debug-score-overflow');
            const comboInput = this._panel.querySelector('#debug-score-combo');
            if (baseInput) { const v = parseInt(baseInput.value); if (!isNaN(v)) GameConfig.SCORE.BASE_PER_BLOCK = v; }
            if (overflowInput) { const v = parseInt(overflowInput.value); if (!isNaN(v)) GameConfig.SCORE.OVERFLOW_PER_BLOCK = v; }
            if (comboInput) { const v = parseFloat(comboInput.value); if (!isNaN(v)) GameConfig.SCORE.COMBO_STEP = v; }
            const comboWindowInput = this._panel.querySelector('#debug-score-combo-window');
            if (comboWindowInput) { const v = parseInt(comboWindowInput.value); if (!isNaN(v) && v >= 1) GameConfig.SCORE.COMBO_WINDOW = v; }

            // 各阶段参数
            const inputs = this._panel.querySelectorAll('[data-stage]');
            for (const input of inputs) {
                const idx = parseInt(input.dataset.stage);
                const field = input.dataset.field;
                const stage = stages[idx];
                if (!stage) continue;

                if (field === 'label') {
                    stage.label = input.value.trim() || stage.label;
                } else if (field === 'orderRange') {
                    const v = this._parseValue(input.value);
                    if (v && v.range) stage.orderRange = v.range;
                    else if (v && v.fixed !== undefined) stage.orderRange = [v.fixed, v.fixed];
                } else if (field === 'orderNum' || field === 'minOrders') {
                    const n = parseInt(input.value);
                    if (!isNaN(n)) stage[field] = n;
                } else {
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

            // 自动推算 maxOrders
            for (let i = 0; i < stages.length - 1; i++) {
                stages[i].maxOrders = stages[i + 1].minOrders - 1;
            }
            stages[stages.length - 1].maxOrders = Infinity;
        }

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

        // ===== 保存到 localStorage =====

        _saveToStorage() {
            this._readInputs();
            const data = {
                hp: GameConfig.INITIAL_HP,
                refillPerOrder: GameConfig.REFILL_PER_ORDER,
                score: { ...GameConfig.SCORE },
                stages: GameConfig.DIFFICULTY_STAGES.map(s => {
                    const copy = { ...s };
                    // Infinity 不能 JSON 序列化，用 -1 代替
                    if (copy.maxOrders === Infinity) copy.maxOrders = -1;
                    return copy;
                }),
            };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                this._showToast('已保存到本地，刷新页面自动加载');
            } catch (e) {
                this._showToast('保存失败: ' + e.message);
            }
        }

        _loadFromStorage() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const data = JSON.parse(raw);
                if (data.hp) GameConfig.INITIAL_HP = data.hp;
                if (data.refillPerOrder !== undefined) GameConfig.REFILL_PER_ORDER = data.refillPerOrder;
                if (data.score) Object.assign(GameConfig.SCORE, data.score);
                if (data.stages && Array.isArray(data.stages)) {
                    data.stages.forEach(s => {
                        if (s.maxOrders === -1) s.maxOrders = Infinity;
                    });
                    GameConfig.DIFFICULTY_STAGES = data.stages;
                    // 同步更新 D 工具的默认值引用
                    if (window.D) window.D._default = JSON.parse(JSON.stringify(data.stages));
                }
                console.log('[DebugPanel] 已从本地加载保存的难度参数');
            } catch (e) {
                console.warn('[DebugPanel] 加载本地参数失败:', e);
            }
        }

        // ===== 导出代码 =====

        _exportCode() {
            this._readInputs();
            const stages = GameConfig.DIFFICULTY_STAGES;
            const lines = [];
            lines.push('        DIFFICULTY_STAGES: [');
            for (const s of stages) {
                const parts = [];
                parts.push(`minOrders: ${s.minOrders}`);
                parts.push(`maxOrders: ${s.maxOrders === Infinity ? 'Infinity' : s.maxOrders}`);
                // colorCount
                if (s.colorCount !== undefined) parts.push(`colorCount: ${s.colorCount}`);
                else if (s.colorCountRange) parts.push(`colorCountRange: [${s.colorCountRange}]`);
                // slotCount
                if (s.slotCount !== undefined) parts.push(`slotCount: ${s.slotCount}`);
                else if (s.slotCountRange) parts.push(`slotCountRange: [${s.slotCountRange}]`);
                // capacity
                if (s.capacity !== undefined) parts.push(`capacity: ${s.capacity}`);
                else if (s.capacityRange) parts.push(`capacityRange: [${s.capacityRange}]`);
                // emptySlots
                if (s.emptySlots !== undefined) parts.push(`emptySlots: ${s.emptySlots}`);
                else if (s.emptySlotsRange) parts.push(`emptySlotsRange: [${s.emptySlotsRange}]`);
                // initBlocks
                if (s.initBlocks !== undefined) parts.push(`initBlocks: ${s.initBlocks}`);
                else if (s.initBlocksRange) parts.push(`initBlocksRange: [${s.initBlocksRange}]`);
                parts.push(`orderNum: ${s.orderNum}`);
                parts.push(`orderRange: [${s.orderRange}]`);
                parts.push(`label: '${s.label}'`);
                lines.push(`            { ${parts.join(', ')} },`);
            }
            lines.push('        ],');

            const scoreCfg = GameConfig.SCORE;
            const scoreCode = `        SCORE: {\n            BASE_PER_BLOCK: ${scoreCfg.BASE_PER_BLOCK},\n            OVERFLOW_PER_BLOCK: ${scoreCfg.OVERFLOW_PER_BLOCK},\n            COMBO_STEP: ${scoreCfg.COMBO_STEP},\n        },`;
            const code = `        INITIAL_HP: ${GameConfig.INITIAL_HP},\n\n${scoreCode}\n\n` + lines.join('\n');

            const area = this._panel.querySelector('#debug-export-area');
            const textarea = this._panel.querySelector('#debug-export-text');
            textarea.value = code;
            area.style.display = 'block';
        }

        _copyExport() {
            const textarea = this._panel.querySelector('#debug-export-text');
            textarea.select();
            try {
                navigator.clipboard.writeText(textarea.value).then(() => {
                    this._showToast('已复制到剪贴板');
                });
            } catch (e) {
                document.execCommand('copy');
                this._showToast('已复制');
            }
        }

        // ===== 恢复默认 =====

        _resetAll() {
            localStorage.removeItem(STORAGE_KEY);
            if (window.D && window.D.reset) window.D.reset();
            this._render();
            this._showToast('已恢复默认，本地缓存已清除');
        }

        // ===== Toast 提示 =====

        _showToast(msg) {
            let toast = document.querySelector('.debug-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'debug-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('debug-toast-show');
            setTimeout(() => toast.classList.remove('debug-toast-show'), 2000);
        }
    }

    window.DebugPanel = DebugPanel;
})();
