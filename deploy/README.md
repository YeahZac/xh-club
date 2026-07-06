# 粤商汇 - 阿里云部署指南

本指南将帮助您将项目部署到阿里云轻量应用服务器。

## 📋 目录

- [部署成本评估](#部署成本评估)
- [快速开始](#快速开始)
- [详细步骤](#详细步骤)
- [运维命令](#运维命令)
- [常见问题](#常见问题)

---

## 💰 部署成本评估

### 推荐配置（200日活用户）

| 物料 | 规格 | 月费用 | 年费用 |
|------|------|--------|--------|
| 轻量应用服务器 | 2核2G/40G SSD/3Mbps | ¥60 | ¥720 |
| 阿里云OSS | 10GB存储 | ¥1-5 | ¥12-60 |
| 域名 | .com域名 | - | ¥55 |
| SSL证书 | Let's Encrypt | ¥0 | ¥0 |
| **合计** | - | **¥61-65/月** | **¥787-835/年** |

### 新用户优惠

阿里云/腾讯云新用户首年优惠约 ¥300-500，可大幅降低成本。

---

## 🚀 快速开始

### 方式一：一键部署（推荐）

```bash
# 1. 上传代码到服务器
tar -czf yueshanghui.tar.gz --exclude=node_modules --exclude=.git .
scp yueshanghui.tar.gz root@YOUR_SERVER_IP:/tmp/

# 2. SSH 登录服务器
ssh root@YOUR_SERVER_IP

# 3. 解压代码
mkdir -p /var/www/yueshanghui
tar -xzf /tmp/yueshanghui.tar.gz -C /var/www/yueshanghui
cd /var/www/yueshanghui

# 4. 初始化服务器环境
sudo bash deploy/setup-server.sh

# 5. 配置环境变量
cp .env.example .env
vim .env  # 填写 Supabase、OSS 等配置

# 6. 一键部署
bash deploy/deploy.sh --full
```

### 方式二：查看完整指南

```bash
bash deploy/QUICKSTART.sh
```

---

## 📝 详细步骤

### 第一步：购买服务器

1. 访问 [阿里云轻量应用服务器](https://www.aliyun.com/product/swas)
2. 选择配置：
   - **地域**: 华南1(深圳) 或 华东1(杭州)
   - **镜像**: Ubuntu 22.04 LTS
   - **套餐**: 2核2G (¥60/月)
3. 设置 root 密码
4. 在安全组中开放端口: **22, 80, 443, 3000**

### 第二步：配置环境变量

编辑 `.env` 文件，填写以下必填项：

```bash
# Supabase 配置 (从 Supabase 控制台获取)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 阿里云 OSS 配置 (从阿里云控制台获取)
ALIYUN_OSS_REGION=oss-cn-shenzhen
ALIYUN_OSS_ACCESS_KEY_ID=your-access-key-id
ALIYUN_OSS_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_OSS_BUCKET=your-bucket-name

# 域名配置
PROJECT_DOMAIN=https://your-domain.com

# JWT 密钥 (使用 openssl rand -hex 32 生成)
JWT_SECRET=your-jwt-secret-key
```

### 第三步：配置域名（可选）

```bash
# 1. 在域名服务商处添加 A 记录指向服务器 IP

# 2. 修改 Nginx 配置
vim /etc/nginx/sites-available/yueshanghui.conf
# 将 your-domain.com 改为您的实际域名

# 3. 申请 SSL 证书
certbot --nginx -d your-domain.com -d www.your-domain.com

# 4. 重载 Nginx
systemctl reload nginx
```

### 第四步：验证部署

```bash
# 查看服务状态
bash deploy/deploy.sh --status

# 查看后端日志
pm2 logs yueshanghui-api

# 测试 API
curl http://localhost:3000/api/health
```

---

## 🔧 运维命令

### 部署脚本

```bash
# 完整部署（前端+后端）
bash deploy/deploy.sh --full

# 仅部署前端
bash deploy/deploy.sh --frontend

# 仅部署后端
bash deploy/deploy.sh --backend

# 回滚到上一版本
bash deploy/deploy.sh --rollback

# 查看部署状态
bash deploy/deploy.sh --status
```

### PM2 命令

```bash
# 查看进程状态
pm2 list

# 查看日志
pm2 logs yueshanghui-api

# 重启服务
pm2 restart yueshanghui-api

# 停止服务
pm2 stop yueshanghui-api

# 清空日志
pm2 flush
```

### Nginx 命令

```bash
# 查看状态
systemctl status nginx

# 重载配置
systemctl reload nginx

# 重启
systemctl restart nginx

# 测试配置
nginx -t
```

---

## 📁 目录结构

```
/var/www/yueshanghui/
├── deploy/                 # 部署脚本
│   ├── setup-server.sh     # 服务器初始化
│   ├── deploy.sh           # 一键部署
│   ├── nginx.conf          # Nginx 配置
│   └── ecosystem.config.js # PM2 配置
├── server/                 # 后端代码
│   ├── dist/               # 编译产物
│   └── src/                # 源代码
├── dist-web/               # 前端编译产物
├── logs/                   # 日志目录
├── uploads/                # 上传文件（本地存储模式）
├── .env                    # 环境变量
└── .env.example            # 环境变量模板
```

---

## ❓ 常见问题

### Q: 如何查看实时日志？

```bash
# 后端日志
pm2 logs yueshanghui-api

# Nginx 访问日志
tail -f /var/www/yueshanghui/logs/nginx-access.log

# Nginx 错误日志
tail -f /var/www/yueshanghui/logs/nginx-error.log
```

### Q: 如何更新代码？

```bash
# 1. 上传新代码到服务器
# 2. 执行部署
bash deploy/deploy.sh --full
```

### Q: 如何回滚版本？

```bash
bash deploy/deploy.sh --rollback
```

### Q: 服务器重启后服务没有自动启动？

```bash
# 确保 PM2 开机自启已配置
pm2 startup
pm2 save
```

### Q: 如何扩容存储？

1. 升级阿里云 OSS 套餐（按量付费，无需升级）
2. 或挂载阿里云云盘到服务器

### Q: 如何备份数据库？

如果使用 Supabase，数据自动备份。如需手动备份：

```bash
# 从 Supabase 控制台导出
# 或使用 pg_dump（需要数据库连接信息）
```

---

## 🔐 安全建议

1. **修改 SSH 端口**: 编辑 `/etc/ssh/sshd_config`，修改 Port 为其他端口
2. **禁用密码登录**: 使用 SSH 密钥登录
3. **配置防火墙**: 仅开放必要端口
4. **定期更新**: `apt update && apt upgrade`
5. **监控告警**: 配置阿里云监控告警

---

## 📞 技术支持

- 阿里云客服: 95187
- Supabase 文档: https://supabase.com/docs
- 阿里云 OSS 文档: https://help.aliyun.com/product/31815.html

---

**部署完成后，请记得：**
- [ ] 配置域名解析
- [ ] 申请 SSL 证书
- [ ] 测试所有功能
- [ ] 配置监控告警
