import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import * as fs from 'fs';
import * as path from 'path';
import { initMySQL } from '@/storage/database/mysql-client';

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
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // CORS 配置
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // 全局中间件（在 setGlobalPrefix 之前）
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  // 设置全局前缀
  app.setGlobalPrefix('api');

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  
  // 开启优雅关闭 Hooks
  app.enableShutdownHooks();

  // 提供 Admin 管理后台静态页面（异步读取）
  const adminHtmlPath = path.resolve(process.cwd(), 'src/admin-panel/index.html');
  if (fs.existsSync(adminHtmlPath)) {
    const adminHtml = await fs.promises.readFile(adminHtmlPath, 'utf-8');
    app.use('/admin', (req: express.Request, res: express.Response) => {
      res.type('text/html').send(adminHtml);
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
