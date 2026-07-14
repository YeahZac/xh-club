import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import * as schema from './shared/schema-mysql';

// MySQL 连接池配置
let pool: any = null;

// 解析连接字符串或环境变量
function getMySQLConfig() {
  // 优先使用连接字符串
  if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
    const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
    console.log('[MySQL] 使用连接字符串配置');
    return url;
  }
  
  // 使用分开的环境变量
  console.log('[MySQL] 使用环境变量配置');
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'xh_club',
  };
}

try {
  const config = getMySQLConfig();
  if (!config) {
    console.error('[MySQL] 配置为空');
  } else {
    const logConfig = typeof config === 'string' 
      ? config.replace(/\/\/.*:.*@/, '//***:***@') 
      : `host=${(config as any).host}, port=${(config as any).port}, user=${(config as any).user}, database=${(config as any).database}`;
    console.log('[MySQL] 配置:', logConfig);
  }
  
  pool = (mysql as any).createPool({
    ...(typeof config === 'string' ? { uri: config } : config),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000, // 10秒连接超时
  });
  console.log('[MySQL] 连接池创建成功');
} catch (error) {
  console.error('[MySQL] 连接池创建失败:', error);
}

// 创建 Drizzle 实例
export const db = pool ? drizzle(pool, { schema, mode: 'default' }) : null;

// 导出 pool 用于需要直接访问的情况
export { pool };

// 测试连接
export async function testConnection(): Promise<boolean> {
  if (!pool) {
    console.error('[MySQL] 连接池未初始化');
    return false;
  }
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log('✅ MySQL 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ MySQL 数据库连接失败:', error);
    return false;
  }
}
