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
  ['projects', 'view_count', 'INT NOT NULL DEFAULT 0'],
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
  ['business_opportunities', 'view_count', 'INT NOT NULL DEFAULT 0'],
  ['business_opportunities', 'start_time', 'TIMESTAMP NULL'],
  ['business_opportunities', 'end_time', 'TIMESTAMP NULL'],
  ['business_opportunities', 'form_fields', 'JSON NULL'],
  // 会员推荐码
  ['members', 'invite_code', 'VARCHAR(32) NULL'],
  // 邀请奖励：积分值 / 经验值 / 图文说明
  ['invitation_reward_rules', 'points_value', 'INT NOT NULL DEFAULT 0'],
  ['invitation_reward_rules', 'experience_value', 'INT NOT NULL DEFAULT 0'],
  ['invitation_reward_rules', 'content', 'MEDIUMTEXT NULL'],
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
    name: 'roadshow_projects',
    sql: `CREATE TABLE IF NOT EXISTS roadshow_projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      business_id INT NOT NULL,
      project_id INT NOT NULL,
      cover_image VARCHAR(500) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_roadshow_project (business_id, project_id),
      INDEX idx_roadshow_business (business_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'roadshow_score_dimensions',
    sql: `CREATE TABLE IF NOT EXISTS roadshow_score_dimensions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      business_id INT NOT NULL,
      name VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_roadshow_dimension_business (business_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'roadshow_registrations',
    sql: `CREATE TABLE IF NOT EXISTS roadshow_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      business_id INT NOT NULL,
      member_id INT NOT NULL,
      form_answers JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_roadshow_registration (business_id, member_id),
      INDEX idx_roadshow_registration_business (business_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'roadshow_scores',
    sql: `CREATE TABLE IF NOT EXISTS roadshow_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      business_id INT NOT NULL,
      project_id INT NOT NULL,
      member_id INT NOT NULL,
      dimension_id INT NOT NULL,
      stars TINYINT NOT NULL DEFAULT 5,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_roadshow_score (business_id, project_id, member_id, dimension_id),
      INDEX idx_roadshow_score_business_project (business_id, project_id)
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
  {
    name: 'invitation_reward_rules',
    sql: `CREATE TABLE IF NOT EXISTS invitation_reward_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_name VARCHAR(100) NOT NULL,
      rule_type VARCHAR(32) NOT NULL DEFAULT 'direct',
      reward_type VARCHAR(32) NOT NULL DEFAULT 'both',
      reward_value INT NOT NULL DEFAULT 0,
      points_value INT NOT NULL DEFAULT 0,
      experience_value INT NOT NULL DEFAULT 0,
      content MEDIUMTEXT NULL,
      conditions JSON NULL,
      max_rewards INT DEFAULT -1,
      is_active BOOLEAN DEFAULT TRUE,
      start_date TIMESTAMP NULL,
      end_date TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
