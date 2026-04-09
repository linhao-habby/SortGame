#!/bin/bash
# SortGame 一键启动（macOS）
cd "$(dirname "$0")"
echo "SortGame 启动中..."
echo "浏览器打开: http://localhost:8080"
echo "按 Ctrl+C 停止"
open http://localhost:8080
python3 -m http.server 8080
