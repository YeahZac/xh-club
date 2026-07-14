# ============================================
# 星河平台俱乐部 - 微信云托管 Dockerfile
# 后端服务 (NestJS)
# ============================================

# 阶段1：构建
FROM node:18-alpine AS builder
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制后端依赖文件
COPY server/package.json ./

# 安装所有依赖（包括开发依赖用于构建）
RUN pnpm install

# 复制后端源码
COPY server/ ./

# 构建 NestJS
RUN pnpm build

# 阶段2：生产运行
FROM node:18-alpine AS runner
WORKDIR /app

# 复制 package.json 用于生产依赖
COPY server/package.json ./

# 安装 pnpm 并只安装生产依赖
RUN npm install -g pnpm && pnpm install --prod

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 创建 admin-panel 目录并复制（如果存在）
RUN mkdir -p ./src/admin-panel
RUN if [ -d "/app/dist/admin-panel" ]; then cp -r /app/dist/admin-panel/* ./src/admin-panel/; fi

# 微信云托管默认监听 80 端口
ENV PORT=80
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# 启动命令
CMD ["node", "dist/src/main.js"]
