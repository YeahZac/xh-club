# ============================================
# 星河平台俱乐部 - 微信云托管 Dockerfile
# 后端服务 (NestJS)
# ============================================

# 阶段1：构建
FROM node:18-alpine AS builder
WORKDIR /app

# 固定 pnpm，避免 npm -g 拉取失败；开启宽松 peer，降低安装失败率
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV PNPM_STRICT_PEER_DEPENDENCIES=false

# 复制依赖文件（有 lock 则用，无则照常安装）
COPY server/package.json ./
COPY server/pnpm-lock.yaml* ./

RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install; \
    fi

# 复制后端源码并构建
COPY server/ ./
RUN pnpm build

# 去掉开发依赖，供 runner 直接复用（避免 runner 再拉一次 npm 失败）
RUN pnpm prune --prod

# 阶段2：生产运行
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# 复用 builder 已安装的生产依赖，不再二次 pnpm install
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 业务域名校验文件、文旅 Demo 等根路径静态资源
COPY --from=builder /app/public ./public

# 管理台静态页
RUN mkdir -p ./src/admin-panel
COPY --from=builder /app/src/admin-panel ./src/admin-panel
RUN if [ -d "/app/dist/admin-panel" ]; then cp -r /app/dist/admin-panel/* ./src/admin-panel/ 2>/dev/null || true; fi

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# nest-cli sourceRoot=src → 产物多为 dist/main.js；兼容 dist/src/main.js
CMD ["sh", "-c", "if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
