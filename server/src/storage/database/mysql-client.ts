import * as mysql from 'mysql2/promise';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// MySQL 连接池
let pool: mysql.Pool | null = null;

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

// 初始化 MySQL 连接池
export function initMySQL() {
  try {
    const config = getMySQLConfig();
    if (!config) {
      console.error('[MySQL] 配置为空，跳过数据库初始化');
      return;
    }
    
    console.log('[MySQL] 配置:', `host=${config.host}, port=${config.port}, user=${config.user}, database=${config.database}`);
    
    // 创建连接池，不立即连接
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10000,
    });
    
    console.log('[MySQL] 连接池创建成功（延迟连接）');
    
    // 异步测试连接，不阻塞启动
    setTimeout(() => {
      testConnection().then(() => {
        console.log('[MySQL] 连接测试成功');
      }).catch(err => {
        console.error('[MySQL] 连接测试失败:', err.message);
      });
    }, 1000);
  } catch (error: any) {
    console.error('[MySQL] 连接池创建失败:', error.message);
  }
}

// 获取连接池 - 返回类型包装
export function getPool() {
  if (!pool) {
    initMySQL();
  }
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
      host: process.env.MYSQL_HOST || process.env.DATABASE_URL ? 'from-url' : 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      database: process.env.MYSQL_DATABASE || 'xh_club',
      user: process.env.MYSQL_USER || 'configured',
    } : null,
  };
}
