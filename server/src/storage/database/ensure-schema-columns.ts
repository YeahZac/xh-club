import { getPool } from './mysql-client'

/** 线上旧库缺列时自动补齐（幂等，重复执行安全） */
const COLUMNS_TO_ENSURE: Array<[table: string, column: string, definition: string]> = [
  ['events', 'video_url', 'VARCHAR(500) NULL'],
  ['events', 'address', 'TEXT NULL'],
  ['events', 'form_fields', 'JSON NULL'],
  ['event_registrations', 'form_answers', 'JSON NULL'],
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
  ['mall_products', 'view_count', 'INT NOT NULL DEFAULT 0'],
  ['events', 'view_count', 'INT NOT NULL DEFAULT 0'],
  ['homepage_sections', 'sort_mode', `VARCHAR(32) NOT NULL DEFAULT 'custom'`],
  // 商机管理（兼容旧 business_opportunities 表结构）
  ['business_opportunities', 'summary', 'TEXT NULL'],
  ['business_opportunities', 'content', 'MEDIUMTEXT NULL'],
  ['business_opportunities', 'cover_image', 'VARCHAR(500) NULL'],
  ['business_opportunities', 'industry', 'VARCHAR(64) NULL'],
  ['business_opportunities', 'region', 'VARCHAR(64) NULL'],
  ['business_opportunities', 'amount_min', 'DECIMAL(14,2) NULL'],
  ['business_opportunities', 'amount_max', 'DECIMAL(14,2) NULL'],
  ['business_opportunities', 'stage', 'VARCHAR(32) NULL'],
  ['business_opportunities', 'contact_info', 'VARCHAR(255) NULL'],
  ['business_opportunities', 'sort_order', 'INT NOT NULL DEFAULT 0'],
]

const TABLES_TO_ENSURE: Array<{ name: string; sql: string }> = [
  {
    name: 'business_opportunities',
    sql: `CREATE TABLE IF NOT EXISTS business_opportunities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(32) NOT NULL COMMENT 'roadshow|financing|resource',
      summary TEXT NULL,
      content MEDIUMTEXT NULL,
      cover_image VARCHAR(500) NULL,
      industry VARCHAR(64) NULL,
      region VARCHAR(64) NULL,
      amount_min DECIMAL(14,2) NULL,
      amount_max DECIMAL(14,2) NULL,
      stage VARCHAR(32) NULL,
      contact_info VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'published',
      sort_order INT NOT NULL DEFAULT 0,
      view_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_business_category (category),
      INDEX idx_business_status (status),
      INDEX idx_business_sort (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'industries',
    sql: `CREATE TABLE IF NOT EXISTS industries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL,
      name VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_industries_code (code),
      UNIQUE KEY uk_industries_name (name),
      INDEX idx_industries_status (status),
      INDEX idx_industries_sort (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'talent_applications',
    sql: `CREATE TABLE IF NOT EXISTS talent_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      real_name VARCHAR(64) NOT NULL,
      contact VARCHAR(64) NOT NULL,
      photo_url VARCHAR(500) NOT NULL,
      industry_tags JSON NOT NULL,
      experience TEXT NULL,
      card_image_url VARCHAR(500) NULL,
      avatar_url VARCHAR(500) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending|approved|rejected',
      reject_reason VARCHAR(500) NULL,
      reviewed_at TIMESTAMP NULL,
      reviewed_by VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_talent_member (member_id),
      INDEX idx_talent_status (status),
      INDEX idx_talent_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
]

function isDuplicateColumnError(message?: string): boolean {
  const msg = message || ''
  return msg.includes('Duplicate column') || msg.includes('ER_DUP_FIELDNAME')
}

export async function ensureSchemaColumns(): Promise<void> {
  const pool = getPool()
  if (!pool) return

  for (const table of TABLES_TO_ENSURE) {
    try {
      await pool.query(table.sql)
      console.log(`[MySQL] 已确保表 ${table.name} 存在`)
    } catch (error: any) {
      console.warn(`[MySQL] 确保表 ${table.name} 失败:`, error?.message || error)
    }
  }

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

  // 旧商机表 user_id 为 NOT NULL，放开以便管理台直接创建
  try {
    await pool.query('ALTER TABLE `business_opportunities` MODIFY COLUMN `user_id` INT NULL')
  } catch (error: any) {
    const msg = String(error?.message || '')
    if (
      !msg.includes('Unknown column') &&
      !msg.includes("doesn't exist") &&
      error?.code !== 'ER_NO_SUCH_TABLE'
    ) {
      console.warn('[MySQL] 调整 business_opportunities.user_id 失败:', error?.message || error)
    }
  }
}
