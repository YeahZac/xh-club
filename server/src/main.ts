import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import * as fs from 'fs';
import * as path from 'path';
import { initMySQL } from '@/storage/database/mysql-client';

function parsePort(): number {
  // 优先使用环境变量 PORT（微信云托管等平台会注入）
  if (process.env.PORT) {
    const envPort = parseInt(process.env.PORT, 10);
    if (!isNaN(envPort) && envPort > 0 && envPort < 65536) {
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

async function bootstrap() {
  // 初始化 MySQL 连接
  initMySQL();

  const app = await NestFactory.create(AppModule);

  // 提供 Admin 管理后台静态页面（必须在 setGlobalPrefix 之前）
  const adminHtmlPath = path.resolve(process.cwd(), 'src/admin-panel/index.html');
  if (fs.existsSync(adminHtmlPath)) {
    const adminHtml = fs.readFileSync(adminHtmlPath, 'utf-8');
    app.use('/admin', (req: express.Request, res: express.Response) => {
      res.type('text/html').send(adminHtml);
    });
    console.log('✅ Admin panel available at /admin');
  }

  // 根路径处理 - 提供 API 信息
  app.use('/', (req: express.Request, res: express.Response) => {
    if (req.path === '/') {
      res.json({
        name: '星河平台俱乐部 API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/api/health',
          admin: '/admin',
          api: '/api',
        },
      });
    }
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 2. 解析端口
  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 \({port} 被占用! 请运行 'npx kill-port \){port}' 然后重试。`);
      process.exit(1);
    } else {
      throw err;
    }
  }
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();
