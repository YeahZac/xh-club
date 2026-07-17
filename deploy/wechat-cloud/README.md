# 微信云托管部署指南

## 什么是微信云托管？

微信云托管是微信官方提供的**容器化部署平台**。你只需要把后端代码打包上传，微信会帮你：
- 运行服务器（不用买云服务器）
- 自动配置 HTTPS 和域名
- 自动扩缩容（没人访问时缩到0实例，省钱）
- 与小程序天然打通（不用配域名白名单）

**简单理解**：它就像一个"微信帮你运维的服务器"，你只管上传代码，其他都不用操心。

---

## 部署步骤（图文指引）

### 第一步：开通微信云托管

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 左侧菜单找到 **「云开发」** 或 **「云托管」**
3. 如果是首次使用，点击 **「开通」**，按提示操作
4. 开通后进入 **云托管控制台**

### 第二步：创建服务

1. 在云托管控制台，点击 **「新建服务」**
2. 服务名称填写：`xinghe-server`（或你喜欢的名字）
3. 选择 **「手动部署」**（代码部署）

### 第三步：上传代码

1. 将 `deploy/wechat-cloud/` 目录下的所有文件，连同 `server/` 目录一起打包
2. 在云托管控制台，点击 **「创建版本」**
3. 上传方式选择 **「本地代码上传」** 或 **「代码仓库」**
4. 上传目录结构如下：

```
├── Dockerfile              ← deploy/wechat-cloud/Dockerfile
├── .dockerignore
├── container.config.json
├── package.json            ← server/package.json
├── pnpm-lock.yaml          ← server/pnpm-lock.yaml
├── tsconfig.json           ← server/tsconfig.json
├── nest-cli.json           ← server/nest-cli.json
└── src/                    ← server/src/
    ├── main.ts
    ├── app.module.ts
    ├── admin/
    ├── articles/
    ├── upload/
    └── ...
```

> ⚠️ **注意**：上传的内容是 `server/` 目录下的所有文件 + `deploy/wechat-cloud/Dockerfile`

### 第四步：配置环境变量

在云托管控制台的 **「服务设置」→「环境变量」** 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `PORT` | `80` | 监听端口（微信云托管要求80） |
| `SUPABASE_URL` | 你的Supabase URL | 数据库连接地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的Service Key | 数据库密钥 |

> 💡 Supabase 的 URL 和 Key 可以在你项目的 Supabase 后台 → Settings → API 中找到

### 第五步：部署并测试

1. 点击 **「部署」** 按钮
2. 等待构建完成（约2-5分钟）
3. 部署成功后，云托管会提供一个 **内网访问地址**
4. 在小程序中直接调用，无需配置域名

---

## 小程序端配置

部署到微信云托管后，**推荐使用 callContainer**（免配服务器域名）：

### 方式一：使用云托管 callContainer（已接入项目 Network）

环境变量（根目录 `.env`）：

```bash
TARO_APP_WX_CLOUD_ENV=prod-d6g34e4cna470ab7e
TARO_APP_WX_CLOUD_SERVICE=xh-server
```

小程序端 [`src/network.ts`](../../src/network.ts) 在微信环境下会自动：

1. `Taro.cloud.init` + `callContainer` 调用 `/api/*`（请求头带 `X-WX-SERVICE`）
2. 上传：先 `wx.cloud.uploadFile` 到对象存储，再 `POST /api/upload/member/from-cloud` 换业务 URL

因此 **无需** 在公众平台配置 request / uploadFile 合法域名。

请确认：

- 云托管环境已绑定小程序 AppID
- 服务名与 `TARO_APP_WX_CLOUD_SERVICE` 一致
- 公众平台「基础库最低版本」≥ `2.23.0`

### 方式二：使用云托管域名（非 callContainer 场景）

- **内网域名**（当前项目 `PROJECT_DOMAIN`）：`http://vfvpilcv.xh-server.rp2kla7i.0y09mxrz.com`  
  仅云托管内网/微信侧可达，浏览器公网一般无法直接访问。
- **公网域名**（仅测试/对外 H5）：如 `https://xxx.sh.run.tcloudbase.com`，需在小程序后台配置服务器域名白名单。

小程序业务请求请优先使用方式一 callContainer，无需也不应依赖公网域名。

---

## 费用说明

微信云托管采用**按量计费**，主要费用项：

| 项目 | 价格 | 说明 |
|------|------|------|
| CPU | 约 0.0002元/秒 | 0.5核 |
| 内存 | 约 0.0001元/秒 | 1GB |
| 公网流量 | 约 0.8元/GB | 出站流量 |
| 数据库 | 另计 | 可继续使用 Supabase |

**省钱技巧**：
- 设置最小实例数为 0，没人访问时自动缩容到 0，不产生费用
- 新用户有免费额度，可以先试用

---

## 与当前方案对比

| | 当前方案（Supabase + 自建） | 微信云托管 |
|--|---|---|
| 服务器 | 需要自己买 | 微信提供 |
| 域名/HTTPS | 需要自己配 | 自动提供 |
| 运维 | 需要自己维护 | 微信自动运维 |
| 数据库 | Supabase（继续使用） | 可继续连 Supabase |
| 小程序配置 | 需配域名白名单 | 免配置 |
| 管理后台 | 通过域名访问 | 通过云托管域名访问 |
| 成本 | 服务器月费 + 域名费 | 按量付费，闲时0费用 |

---

## 常见问题

**Q: 数据库还需要迁移吗？**
A: 不需要。微信云托管只是替代了你的"后端服务器"，数据库仍然可以继续使用 Supabase。你的 NestJS 后端通过环境变量连接 Supabase 数据库。

**Q: 管理后台还能用吗？**
A: 可以。管理后台是 NestJS 服务的一部分，部署后通过云托管提供的域名 + `/admin` 路径访问。

**Q: 文件上传还能用吗？**
A: 可以。文件上传使用的是 Supabase Storage，与服务器部署位置无关。

**Q: 需要改小程序代码吗？**
A: 需要小幅调整。主要是把 API 请求地址从当前域名改为云托管提供的域名，或使用 `wx.cloud.callContainer` 方式调用。
