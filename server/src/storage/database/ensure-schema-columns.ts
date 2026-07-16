import { getPool } from './mysql-client'

/** 线上旧库缺列时自动补齐（幂等，重复执行安全） */
const COLUMNS_TO_ENSURE: Array<[table: string, column: string, definition: string]> = [
  ['events', 'video_url', 'VARCHAR(500) NULL'],
  ['events', 'address', 'TEXT NULL'],
  ['events', 'form_fields', 'JSON NULL'],
  ['projects', 'video_url', 'VARCHAR(500) NULL'],
  ['projects', 'industry', 'VARCHAR(64) NULL'],
  ['projects', 'stage', `VARCHAR(32) DEFAULT 'seed'`],
  ['projects', 'amount_max', 'DECIMAL(14,2) NULL'],
  ['articles', 'subtitle', 'VARCHAR(255) NULL'],
  ['articles', 'video_url', 'VARCHAR(500) NULL'],
  ['articles', 'category', `VARCHAR(50) DEFAULT 'news'`],
  ['articles', 'tags', 'JSON NULL'],
  ['mall_products', 'image_url', 'VARCHAR(500) NULL'],
  ['mall_products', 'video_url', 'VARCHAR(500) NULL'],
]

function isDuplicateColumnError(message?: string): boolean {
  const msg = message || ''
  return msg.includes('Duplicate column') || msg.includes('ER_DUP_FIELDNAME')
}

export async function ensureSchemaColumns(): Promise<void> {
  const pool = getPool()
  if (!pool) return

  for (const [table, column, definition] of COLUMNS_TO_ENSURE) {
    try {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
      console.log(`[MySQL] 已补齐列 ${table}.${column}`)
    } catch (error: any) {
      if (isDuplicateColumnError(error?.message)) continue
      // 表不存在时跳过，等 initDatabase 创建
      if (error?.message?.includes("doesn't exist") || error?.code === 'ER_NO_SUCH_TABLE') {
        continue
      }
      console.warn(`[MySQL] 补齐列 ${table}.${column} 失败:`, error?.message || error)
    }
  }
}
