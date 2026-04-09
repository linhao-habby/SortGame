@echo off
:: SortGame 一键启动（Windows）
cd /d "%~dp0"
echo SortGame 启动中...
echo 浏览器打开: http://localhost:8080
start http://localhost:8080
python -m http.server 8080
pause
