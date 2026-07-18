import * as mysql from 'mysql2/promise';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// MySQL 连接池
let pool: mysql.Pool | null = null;
let isInitialized = false;
let recreatingPool: Promise<void> | null = null;

const TRANSIENT_DB_ERRORS = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
  'PROTOCOL_ENQUEUE_HANDSHAKE_TWICE',
  'ER_CLIENT_INTERACTION_TIMEOUT',
]);

function isTransientDbError(error: any): boolean {
  const code = String(error?.code || error?.errno || '');
  const message = String(error?.message || '');
  if (TRANSIENT_DB_ERRORS.has(code)) return true;
  return /ECONNRESET|connection lost|server closed the connection|Cannot enqueue|read ETIMEDOUT/i.test(
    message,
  );
}

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

function createPoolFromConfig(config: mysql.PoolOptions): mysql.Pool {
  // 云托管 / 云 MySQL 常会主动掐空闲连接，需 keepAlive + 较短闲置回收，避免拿到已死连接
  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 8),
    maxIdle: Number(process.env.MYSQL_MAX_IDLE || 4),
    idleTimeout: Number(process.env.MYSQL_IDLE_TIMEOUT_MS || 30000),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 10000),
    multipleStatements: true,
    timezone: 'Z',
  });
}

async function recreatePool(reason: string): Promise<void> {
  if (recreatingPool) return recreatingPool;
  recreatingPool = (async () => {
    console.warn(`[MySQL] 重建连接池: ${reason}`);
    const old = pool;
    pool = null;
    try {
      if (old) await old.end();
    } catch (err: any) {
      console.warn('[MySQL] 关闭旧连接池失败:', err?.message || err);
    }
    const config = getMySQLConfig();
    if (!config) throw new Error('数据库配置为空，无法重建连接池');
    pool = createPoolFromConfig(config);
    isInitialized = true;
    console.log('[MySQL] 连接池重建完成');
  })().finally(() => {
    recreatingPool = null;
  });
  return recreatingPool;
}

async function withDbRetry<T>(operation: string, runner: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (!pool) {
        await recreatePool('pool_missing');
      }
      return await runner();
    } catch (error: any) {
      lastError = error;
      if (!isTransientDbError(error) || attempt >= retries) {
        throw error;
      }
      console.warn(
        `[MySQL] ${operation} 瞬态失败(${error?.code || error?.message})，重试 ${attempt + 1}/${retries}`,
      );
      try {
        await recreatePool(String(error?.code || 'transient'));
      } catch (rebuildError) {
        console.error('[MySQL] 重建连接池失败:', rebuildError);
      }
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
  throw lastError;
}

// 初始化 MySQL 连接池（异步，不阻塞）
export async function initMySQL(): Promise<void> {
  if (isInitialized && pool) {
    console.log('[MySQL] 已初始化，跳过');
    return;
  }

  try {
    const config = getMySQLConfig();
    if (!config) {
      console.error('[MySQL] 配置为空，跳过数据库初始化');
      return;
    }

    console.log(
      '[MySQL] 配置:',
      `host=${config.host}, port=${config.port}, user=${config.user}, database=${config.database}`,
    );

    pool = createPoolFromConfig(config);
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

    // 无论连接测试是否超时，均尝试补齐旧库缺失列（幂等）
    try {
      const { ensureSchemaColumns } = await import('./ensure-schema-columns');
      await ensureSchemaColumns();
    } catch (err: any) {
      console.error('[MySQL] schema 补齐失败:', err.message);
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
export async function queryRows<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: any[],
): Promise<T[]> {
  return withDbRetry('queryRows', async () => {
    const p = getPool();
    if (!p) throw new Error('数据库未连接');
    const [rows] = (await p.query(sql, params)) as [T[], any];
    return rows;
  });
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: any[],
): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] || null;
}

export async function queryExecute(sql: string, params?: any[]): Promise<ResultSetHeader> {
  return withDbRetry('queryExecute', async () => {
    const p = getPool();
    if (!p) throw new Error('数据库未连接');
    const [result] = (await p.query(sql, params)) as [ResultSetHeader, any];
    return result;
  });
}

export async function withTransaction<T>(
  handler: (connection: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  return withDbRetry('withTransaction', async () => {
    const p = getPool();
    if (!p) throw new Error('数据库未连接');

    const connection = await p.getConnection();
    try {
      await connection.beginTransaction();
      const result = await handler(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        /* ignore rollback errors on dead connection */
      }
      throw error;
    } finally {
      connection.release();
    }
  });
}
