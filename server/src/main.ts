import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { initMySQL } from '@/storage/database/mysql-client';
import { WECHAT_DOMAIN_VERIFY_FILES } from '@/wechat-domain-verify';
import { UploadService } from '@/upload/upload.service';

/** 允许通过域名反代的 COS 前缀（对象存储路径） */
const COS_PUBLIC_PROXY_PREFIXES = ['carlife/'] as const;

// 兼容从 server/ 或仓库根目录启动：优先加载项目根 .env
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parsePort(): number {
  // 优先使用环境变量 SERVER_PORT（开发环境）或 PORT（微信云托管等平台会注入）
  if (process.env.SERVER_PORT) {
    const serverPort = parseInt(process.env.SERVER_PORT, 10);
    if (!isNaN(serverPort) && serverPort > 0 && serverPort < 65536) {
      return serverPort;
    }
  }
  if (process.env.PORT) {
    const envPort = parseInt(process.env.PORT, 10);
    // 如果 PORT 是 5000（Taro 开发服务器端口），则使用 3000
    if (!isNaN(envPort) && envPort > 0 && envPort < 65536 && envPort !== 5000) {
      return envPort;
    }
  }
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 3000;
}

function resolvePublicDirs(): string[] {
  return [
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'src/public'),
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../public'),
    path.resolve(__dirname, 'public'),
  ].filter((dir, index, all) => fs.existsSync(dir) && all.indexOf(dir) === index)
}

function readDomainVerifyBody(fileName: string, publicDirs: string[]): string | null {
  for (const dir of publicDirs) {
    const fullPath = path.join(dir, fileName)
    if (!fs.existsSync(fullPath)) continue
    try {
      return fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '').trim()
    } catch {
      /* ignore */
    }
  }
  if (Object.prototype.hasOwnProperty.call(WECHAT_DOMAIN_VERIFY_FILES, fileName)) {
    return WECHAT_DOMAIN_VERIFY_FILES[fileName]
  }
  return null
}

async function bootstrap() {
  console.log('[启动] 开始初始化...');
  
  // 异步初始化 MySQL（不阻塞）
  try {
    await initMySQL();
    console.log('[启动] MySQL 初始化完成');
  } catch (err: any) {
    console.error('[启动] MySQL 初始化失败:', err.message);
  }

  console.log('[启动] 创建 NestJS 应用...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const publicDirs = resolvePublicDirs()
  const expressApp = app.getHttpAdapter().getInstance() as express.Express
  const uploadService = app.get(UploadService)

  // 必须挂在 Nest 路由之前：微信业务域名校验要求根路径 /xxx.txt 返回纯文本
  expressApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    const match = String(req.path || '').match(/^\/([A-Za-z0-9_-]+\.txt)$/)
    if (!match) {
      next()
      return
    }
    const body = readDomainVerifyBody(match[1], publicDirs)
    if (body == null) {
      next()
      return
    }
    res.status(200)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.send(body)
  })
  console.log(
    `[启动] 业务域名校验: /7NSG7VLDwr.txt -> ${
      readDomainVerifyBody('7NSG7VLDwr.txt', publicDirs) ? 'ready' : 'missing'
    }`,
  )

  // 域名反代 COS（挂在 Nest 路由之前，避免被 /api 404 吞掉）
  // https://xinghegogo.cn/carlife/onlinemall.html -> 对象存储 key: carlife/onlinemall.html
  expressApp.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    const requestPath = String(req.path || '').replace(/^\/+/, '')
    const matched = COS_PUBLIC_PROXY_PREFIXES.some(
      (prefix) => requestPath === prefix.replace(/\/$/, '') || requestPath.startsWith(prefix),
    )
    if (!matched) {
      next()
      return
    }
    if (!requestPath || requestPath.includes('..') || requestPath.endsWith('/')) {
      res.status(404).type('text').send('Not Found')
      return
    }

    try {
      const object = await uploadService.getObjectByKey(requestPath)
      res.status(200)
      res.setHeader('Content-Type', object.contentType)
      res.setHeader('Cache-Control', 'public, max-age=300')
      if (object.etag) res.setHeader('ETag', object.etag)
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.send(object.body)
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.status || 0)
      if (statusCode === 404 || String(error?.code || '').includes('NoSuchKey')) {
        res.status(404).type('text').send('Not Found')
        return
      }
      console.error('[COS proxy] failed', requestPath, error?.message || error)
      res.status(502).type('text').send('Bad Gateway')
    }
  })
  console.log(`[启动] COS 域名反代前缀: ${COS_PUBLIC_PROXY_PREFIXES.join(', ')}`)

  const siteIndexPath = publicDirs
    .map((dir) => path.join(dir, 'index.html'))
    .find((fullPath) => fs.existsSync(fullPath))
  if (siteIndexPath) {
    expressApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      const pathname = String(req.path || '')
      if (pathname !== '/' && pathname !== '/index.html') {
        next()
        return
      }
      res.status(200)
      res.type('html')
      res.setHeader('Cache-Control', 'public, max-age=120')
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      createReadStream(siteIndexPath).pipe(res)
    })
    console.log(`[启动] 官网首页: / -> ${siteIndexPath}`)
  }

  // CORS 配置
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // 全局中间件（在 setGlobalPrefix 之前）
  const bodyLimit = process.env.BODY_LIMIT || '10mb';
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ limit: bodyLimit, extended: true }));
  
  // 设置全局前缀
  app.setGlobalPrefix('api');

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  
  // 开启优雅关闭 Hooks
  app.enableShutdownHooks();

  for (const dir of publicDirs) {
    app.useStaticAssets(dir, {
      index: false,
      prefix: '/',
    })
    console.log(`[启动] 静态根目录: ${dir}`)
  }

  // 文旅票务 Demo：本地静态目录（不进 COS，管理台媒体库不可见）
  // 访问 https://xinghegogo.cn/travel_demo → 自动补尾斜杠，保证相对资源路径正确
  const travelDemoDir = publicDirs
    .map((dir) => path.join(dir, 'travel_demo'))
    .find((fullPath) => fs.existsSync(path.join(fullPath, 'index.html')))
  if (travelDemoDir) {
    expressApp.get('/travel_demo', (_req, res) => {
      res.redirect(302, '/travel_demo/')
    })
    expressApp.use(
      '/travel_demo',
      express.static(travelDemoDir, {
        index: 'index.html',
        fallthrough: false,
        maxAge: '5m',
      }),
    )
    console.log(`[启动] 文旅 Demo: /travel_demo/ -> ${travelDemoDir}`)
  }

  try {
    const { getPublicHttpsBaseUrl } = await import('@/utils/public-base-url')
    const publicBase = getPublicHttpsBaseUrl()
    console.log(`[启动] 公网域名: ${publicBase || '(未配置 WEBVIEW_BASE_URL/PROJECT_DOMAIN)'}`)
  } catch (error: any) {
    console.warn('[启动] 读取公网域名失败:', error?.message || error)
  }

  // 提供 Admin 管理后台静态页面（流式输出，避免整页读入内存）
  const adminHtmlPath = path.resolve(process.cwd(), 'src/admin-panel/index.html');
  if (fs.existsSync(adminHtmlPath)) {
    app.use('/admin', (_req: express.Request, res: express.Response) => {
      res.type('text/html');
      res.setHeader('Cache-Control', 'no-cache');
      createReadStream(adminHtmlPath).pipe(res);
    });
    console.log('[启动] Admin panel available at /admin');
  }

  // 解析端口
  const port = parsePort();
  console.log(`[启动] 正在监听端口 ${port}...`);
  
  try {
    await app.listen(port, '0.0.0.0');
    console.log(`[启动] 服务已启动: http://0.0.0.0:${port}`);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`[启动] 端口 ${port} 被占用!`);
      process.exit(1);
    } else {
      throw err;
    }
  }
}

bootstrap().catch(err => {
  console.error('[启动] 致命错误:', err);
  process.exit(1);
});
