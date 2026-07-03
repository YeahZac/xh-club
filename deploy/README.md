# 星河百谷商会平台 - 云服务器部署指南

## 架构概览

```
用户浏览器/小程序 ──→ Nginx(443) ──→ NestJS(3000)
                       │                  ├── /api/*     后端API
                       │                  ├── /admin/*   管理后台
                       │                  └── /health    健康检查
                       │
                       └── SSL终止（Let's Encrypt）
                               │
NestJS(3000) ──────→ Supabase PostgreSQL（已托管，无需部署）
```

## 前置条件

| 资源 | 要求 | 说明 |
|------|------|------|
| 云服务器 | 2核4G+，Ubuntu 20.04+ | 阿里云/腾讯云/华为云 |
| 域名 | 已ICP备案 | 微信小程序强制要求备案域名 |
| SSL证书 | Let's Encrypt免费 | 小程序强制HTTPS |

## 一、获取 Supabase 凭证

在 Coze 平台沙箱中执行：

```bash
env | grep COZE_SUPABASE
```

记录以下三个值，部署时需要填入 `.env`：
- `COZE_SUPABASE_URL`
- `COZE_SUPABASE_ANON_KEY`
- `COZE_SUPABASE_SERVICE_ROLE_KEY`

## 二、服务器初始化

### 1. 登录服务器

```bash
ssh root@your-server-ip
```

### 2. 创建项目目录

```bash
mkdir -p /opt/xinghe-chamber
cd /opt/xinghe-chamber
```

### 3. 上传代码

**方式A：从沙箱打包下载**
```bash
# 在沙箱中执行
cd /workspace/projects
tar -czf xinghe-chamber.tar.gz \
  server/ \
  deploy/ \
  --exclude='node_modules' \
  --exclude='.git'

# 下载后上传到服务器
scp xinghe-chamber.tar.gz root@your-server-ip:/opt/xinghe-chamber/

# 在服务器上解压
cd /opt/xinghe-chamber
tar -xzf xinghe-chamber.tar.gz
```

**方式B：从Git仓库拉取**
```bash
cd /opt/xinghe-chamber
git clone your-repo-url .
```

### 4. 配置环境变量

```bash
cd /opt/xinghe-chamber/deploy
cp .env.example .env
vi .env
```

填入实际值：
```env
COZE_SUPABASE_URL=https://xxxxx.supabase.co
COZE_SUPABASE_ANON_KEY=eyJhbGciOi...
COZE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
PROJECT_DOMAIN=https://api.your-domain.com
JWT_SECRET=随机生成一个64位字符串
```

生成 JWT_SECRET：
```bash
openssl rand -hex 32
```

## 三、一键部署

```bash
cd /opt/xinghe-chamber/deploy
bash deploy.sh
```

选择 `1) 首次部署`，脚本会自动：
1. 安装 Docker 和 Docker Compose
2. 构建 NestJS 后端
3. 启动 Nginx + NestJS 容器
4. 进行健康检查

## 四、配置域名和SSL

### 1. 域名解析

在你的域名管理面板添加 A 记录：
```
类型: A
主机记录: api (或 @)
记录值: 你的服务器IP
```

### 2. 申请SSL证书

```bash
cd /opt/xinghe-chamber/deploy
bash deploy.sh
# 选择 3) 配置 SSL 证书
```

### 3. 启用HTTPS

编辑 `deploy/nginx.conf`，取消 HTTPS 部分的注释：
```bash
vi nginx.conf
```

然后重启 Nginx：
```bash
cd /opt/xinghe-chamber/deploy
docker compose restart nginx
```

## 五、微信小程序配置

### 1. 登录微信公众平台

https://mp.weixin.qq.com

### 2. 配置服务器域名

开发 → 开发管理 → 开发设置 → 服务器域名

```
request合法域名: https://api.your-domain.com
uploadFile合法域名: https://api.your-domain.com
downloadFile合法域名: https://api.your-domain.com
```

### 3. 构建小程序

```bash
# 在沙箱中构建
cd /workspace/projects
pnpm build:weapp
```

产物在 `dist/` 目录下，用微信开发者工具打开即可预览和上传。

## 六、日常运维

### 查看日志
```bash
cd /opt/xinghe-chamber/deploy
docker compose logs -f --tail=100
```

### 重启服务
```bash
cd /opt/xinghe-chamber/deploy
docker compose restart
```

### 更新部署
```bash
# 1. 上传新代码到服务器
# 2. 执行更新
cd /opt/xinghe-chamber/deploy
bash deploy.sh
# 选择 2) 更新部署
```

### 数据库备份

Supabase 提供自动每日备份（Pro计划），免费计划需手动导出：

```bash
# 导出数据库
pg_dump "$COZE_SUPABASE_URL" > backup_$(date +%Y%m%d).sql
```

## 七、访问地址

| 服务 | 地址 |
|------|------|
| 小程序前端 | 微信开发者工具预览 / 扫码体验版 |
| 管理后台 | https://api.your-domain.com/admin |
| API文档 | https://api.your-domain.com/api/health |
| Nginx状态 | https://api.your-domain.com/nginx_status |

## 八、常见问题

### Q: 小程序请求返回 "不在以下 request 合法域名列表中"
A: 确保微信公众平台已配置正确的服务器域名，且域名已备案、启用HTTPS

### Q: 管理后台打开是白屏
A: 检查浏览器控制台，可能是API请求失败。确认 `.env` 中的 Supabase 凭证正确

### Q: Docker 容器启动失败
A: 执行 `docker compose logs` 查看错误日志，常见原因：
- 端口3000被占用：修改 `.env` 中的 PORT
- 环境变量未配置：检查 `.env` 文件

### Q: SSL证书过期
A: Let's Encrypt 证书90天过期，需设置自动续期：
```bash
crontab -e
# 添加：0 0 1 * * certbot renew --quiet && docker compose restart nginx
```
