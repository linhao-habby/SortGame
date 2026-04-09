/**
 * Node.js 测试运行器
 * 模拟浏览器环境运行 Day 1 逻辑测试
 */
const fs = require('fs');
const path = require('path');

// 模拟 window 对象
global.window = global;

// 按顺序加载模块
const srcDir = path.join(__dirname, 'src', 'game');
const files = [
    'GameConfig.js',
    'Slot.js',
    'DifficultyManager.js',
    'OrderManager.js',
    'GameState.js',
    'GameTest.js',
];

for (const file of files) {
    const code = fs.readFileSync(path.join(srcDir, file), 'utf-8');
    eval(code);
}

// 运行测试
const allPassed = GameTest.runAll();
process.exit(allPassed ? 0 : 1);
