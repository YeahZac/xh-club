import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import * as schema from './shared/schema-mysql';

// MySQL 连接池配置
let pool: any = null;
let db: any = null;

// 解析连接字符串或环境变量
function getMySQLConfig(): any {
  // 优先使用连接字符串
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (url) {
    console.log('[MySQL] 使用连接字符串配置');
    // 解析连接字符串
    try {
      const urlObj = new URL(url);
      return {
        host: urlObj.hostname,
        port: parseInt(urlObj.port || '3306'),
        user: urlObj.username,
        password: urlObj.password,
        database: urlObj.pathname.slice(1), // 移除开头的 /
      };
    } catch (e) {
      console.error('[MySQL] 连接字符串解析失败:', e);
      return null;
    }
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

// 初始化 MySQL 连接池
export function initMySQL() {
  try {
    const config = getMySQLConfig();
    if (!config) {
      console.error('[MySQL] 配置为空，跳过数据库初始化');
      return;
    }
    
    console.log('[MySQL] 配置:', `host=${config.host}, port=${config.port}, user=${config.user}, database=${config.database}`);
    
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 5000, // 5秒连接超时
    });
    
    db = drizzle(pool, { schema, mode: 'default' });
    console.log('[MySQL] 连接池创建成功');
    
    // 测试连接
    testConnection().catch(err => {
      console.error('[MySQL] 初始连接测试失败:', err.message);
    });
  } catch (error: any) {
    console.error('[MySQL] 连接池创建失败:', error.message);
  }
}

// 获取数据库实例
export function getDb() {
  if (!db) {
    initMySQL();
  }
  return db;
}

// 获取连接池
export function getPool() {
  if (!pool) {
    initMySQL();
  }
  return pool;
}

// 兼容旧代码
export { pool as _pool };
export const _db = db;

// 测试连接
export async function testConnection(): Promise<boolean> {
  if (!pool) {
    console.error('[MySQL] 连接池未初始化');
    return false;
  }
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log('[MySQL] 数据库连接正常');
    return true;
  } catch (error: any) {
    console.error('[MySQL] 数据库连接失败:', error.message);
    return false;
  }
}

// 获取连接状态
export function getConnectionStatus() {
  return {
    connected: pool !== null,
    config: pool ? {
      host: process.env.MYSQL_HOST || 'configured',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      database: process.env.MYSQL_DATABASE || 'xh_club',
      user: process.env.MYSQL_USER || 'configured',
    } : null,
  };
}
