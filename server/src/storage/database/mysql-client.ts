import * as mysql from 'mysql2/promise';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// MySQL 连接池
let pool: mysql.Pool | null = null;
let isInitialized = false;

// 解析连接字符串或环境变量
function getMySQLConfig(): mysql.PoolOptions | null {
  // 优先使用连接字符串
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (url) {
    console.log('[MySQL] 使用连接字符串配置');
    try {
      const urlObj = new URL(url);
      return {
        host: urlObj.hostname,
        port: parseInt(urlObj.port || '3306'),
        user: urlObj.username,
        password: urlObj.password,
        database: urlObj.pathname.slice(1),
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

// 初始化 MySQL 连接池（异步，不阻塞）
export async function initMySQL(): Promise<void> {
  if (isInitialized) {
    console.log('[MySQL] 已初始化，跳过');
    return;
  }

  try {
    const config = getMySQLConfig();
    if (!config) {
      console.error('[MySQL] 配置为空，跳过数据库初始化');
      return;
    }
  
    console.log('[MySQL] 配置:', `host=${config.host}, port=${config.port}, user=${config.user}, database=${config.database}`);
  
    // 创建连接池
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 5000, // 5秒超时
    });
  
    console.log('[MySQL] 连接池创建成功');
    
    // 测试连接（带超时）
    const testPromise = testConnection();
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('连接测试超时')), 3000);
    });
    
    try {
      await Promise.race([testPromise, timeoutPromise]);
      console.log('[MySQL] 连接测试成功');
    } catch (err: any) {
      console.error('[MySQL] 连接测试失败或超时:', err.message);
      // 不抛出错误，允许服务继续启动
    }
    
    isInitialized = true;
  } catch (error: any) {
    console.error('[MySQL] 连接池创建失败:', error.message);
    // 不抛出错误，允许服务继续启动
  }
}

// 测试连接
export async function testConnection(): Promise<void> {
  if (!pool) throw new Error('连接池未创建');
  
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

// 获取连接状态
export function getConnectionStatus(): { connected: boolean; pool: boolean } {
  return {
    connected: isInitialized && pool !== null,
    pool: pool !== null,
  };
}

// 获取连接池
export function getPool(): mysql.Pool | null {
  return pool;
}

// 类型安全的查询辅助方法
export async function queryRows<T extends RowDataPacket = RowDataPacket>(sql: string, params?: any[]): Promise<T[]> {
  const p = getPool();
  if (!p) throw new Error('数据库未连接');
  const [rows] = await p.query(sql, params) as [T[], any];
  return rows;
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] || null;
}

export async function queryExecute(sql: string, params?: any[]): Promise<ResultSetHeader> {
  const p = getPool();
  if (!p) throw new Error('数据库未连接');
  const [result] = await p.query(sql, params) as [ResultSetHeader, any];
  return result;
}
