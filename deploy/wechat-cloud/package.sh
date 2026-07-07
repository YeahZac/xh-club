#!/bin/bash
# ============================================
# 微信云托管打包脚本
# 使用方法：在项目根目录运行 bash deploy/wechat-cloud/package.sh
# ============================================

echo "📦 开始打包微信云托管部署文件..."

# 创建临时目录
TEMP_DIR="/tmp/wechat-cloud-deploy"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 复制 server 目录内容
echo "📁 复制后端代码..."
cp -r server/src "$TEMP_DIR/"
cp server/package.json "$TEMP_DIR/"
cp server/tsconfig.json "$TEMP_DIR/"
cp server/nest-cli.json "$TEMP_DIR/"

# 复制根目录的 pnpm-lock.yaml（monorepo 结构）
if [ -f "pnpm-lock.yaml" ]; then
  cp pnpm-lock.yaml "$TEMP_DIR/"
fi
if [ -f "server/pnpm-lock.yaml" ]; then
  cp server/pnpm-lock.yaml "$TEMP_DIR/"
fi

# 复制 Dockerfile 和配置
echo "📁 复制部署配置..."
cp deploy/wechat-cloud/Dockerfile "$TEMP_DIR/"
cp deploy/wechat-cloud/.dockerignore "$TEMP_DIR/"
cp deploy/wechat-cloud/container.config.json "$TEMP_DIR/"

# 打包
OUTPUT="wechat-cloud-deploy.tar.gz"
echo "📦 打包为 $OUTPUT ..."
cd "$TEMP_DIR"
tar -czf "/workspace/projects/$OUTPUT" .

echo ""
echo "✅ 打包完成！"
echo "📄 文件：/workspace/projects/$OUTPUT"
echo ""
echo "📋 下一步："
echo "1. 登录微信公众平台 → 云托管控制台"
echo "2. 创建新版本 → 上传 $OUTPUT 文件"
echo "3. 配置环境变量（SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY）"
echo "4. 点击部署"
echo ""
echo "详细说明请查看：deploy/wechat-cloud/README.md"
