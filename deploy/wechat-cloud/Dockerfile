# ============================================
# 微信云托管 Dockerfile
# 使用方法：在微信云托管控制台上传此文件所在目录
# ============================================

# 阶段1：构建
FROM node:18-alpine AS builder
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件（lock 文件可能不存在，用通配符兼容）
COPY package.json ./
COPY pnpm-lock* ./

# 安装依赖
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

# 复制源码
COPY . .

# 构建 NestJS
RUN pnpm build

# 阶段2：生产运行
FROM node:18-alpine AS runner
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 只安装生产依赖
COPY package.json ./
COPY pnpm-lock* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --prod --frozen-lockfile; else pnpm install --prod; fi

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 微信云托管默认监听 80 端口
ENV PORT=80
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# 启动
CMD ["node", "dist/main.js"]
