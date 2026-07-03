# 阶段1：构建
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 阶段2：运行
FROM node:18-alpine AS runner
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm pm2

# 只复制生产依赖
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# 启动
CMD ["node", "dist/main.js"]
