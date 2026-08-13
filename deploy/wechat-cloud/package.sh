#!/bin/bash
# ============================================
# 微信云托管打包脚本
# 使用方法：在项目根目录运行 bash deploy/wechat-cloud/package.sh
# ============================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
echo "📦 开始打包微信云托管部署文件..."
echo "📁 项目根目录: $ROOT_DIR"

# 创建临时目录
TEMP_DIR="/tmp/wechat-cloud-deploy-$$"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 复制 server 目录内容
echo "📁 复制后端代码..."
cp -r "$ROOT_DIR/server/src" "$TEMP_DIR/"
cp "$ROOT_DIR/server/package.json" "$TEMP_DIR/"
cp "$ROOT_DIR/server/tsconfig.json" "$TEMP_DIR/"
cp "$ROOT_DIR/server/nest-cli.json" "$TEMP_DIR/"

# 复制根目录的 pnpm-lock.yaml（monorepo 结构）
if [ -f "$ROOT_DIR/pnpm-lock.yaml" ]; then
  cp "$ROOT_DIR/pnpm-lock.yaml" "$TEMP_DIR/"
fi
if [ -f "$ROOT_DIR/server/pnpm-lock.yaml" ]; then
  cp "$ROOT_DIR/server/pnpm-lock.yaml" "$TEMP_DIR/"
fi

# 复制 Dockerfile 和配置
echo "📁 复制部署配置..."
cp "$ROOT_DIR/deploy/wechat-cloud/Dockerfile" "$TEMP_DIR/"
cp "$ROOT_DIR/deploy/wechat-cloud/.dockerignore" "$TEMP_DIR/"
cp "$ROOT_DIR/deploy/wechat-cloud/container.config.json" "$TEMP_DIR/"

# 打包到项目根目录
OUTPUT="$ROOT_DIR/wechat-cloud-deploy.tar.gz"
echo "📦 打包为 $OUTPUT ..."
tar -C "$TEMP_DIR" -czf "$OUTPUT" .
rm -rf "$TEMP_DIR"

echo ""
echo "✅ 打包完成！"
echo "📄 文件：$OUTPUT"
echo ""
echo "📋 下一步："
echo "1. 登录微信云托管控制台 → 服务 xh-server → 创建新版本"
echo "2. 上传 $OUTPUT"
echo "3. 部署并全量发布"
echo ""
echo "部署完成后访问示例："
echo "https://xinghegogo.cn/carlife/onlinemall.html"
echo ""
echo "详细说明请查看：deploy/wechat-cloud/README.md"
