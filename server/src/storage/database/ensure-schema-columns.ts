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
  ['projects', 'audit_status', `VARCHAR(16) NOT NULL DEFAULT 'approved'`],
  ['projects', 'reject_reason', 'VARCHAR(500) NULL'],
  ['projects', 'submitter_id', 'INT NULL'],
  ['projects', 'avg_score', 'DECIMAL(4,2) NOT NULL DEFAULT 0'],
  ['projects', 'score_count', 'INT NOT NULL DEFAULT 0'],
  // 项目成交对接：负责人确认
  ['project_deal_applications', 'owner_member_id', 'INT NULL'],
  ['project_deal_applications', 'is_deal', `TINYINT(1) NOT NULL DEFAULT 0`],
  // 系统通知扩展
  ['notifications', 'link', 'VARCHAR(500) NULL'],
  ['notifications', 'biz_type', 'VARCHAR(32) NULL'],
  ['notifications', 'biz_id', 'VARCHAR(64) NULL'],
  ['notifications', 'result', 'VARCHAR(64) NULL'],
  ['notifications', 'processed_at', 'TIMESTAMP NULL'],
  ['articles', 'subtitle', 'VARCHAR(255) NULL'],
  ['articles', 'video_url', 'VARCHAR(500) NULL'],
  ['articles', 'category', `VARCHAR(50) DEFAULT 'news'`],
  ['articles', 'tags', 'JSON NULL'],
  ['articles', 'summary', 'VARCHAR(500) NULL'],
  ['articles', 'author', 'VARCHAR(100) NULL'],
  ['articles', 'status', `VARCHAR(20) DEFAULT 'draft'`],
  ['mall_products', 'image_url', 'VARCHAR(500) NULL'],
  ['mall_products', 'video_url', 'VARCHAR(500) NULL'],
  ['mall_products', 'view_count', 'INT NOT NULL DEFAULT 0'],
  ['mall_products', 'description', 'MEDIUMTEXT NULL'],
  ['mall_products', 'category', `VARCHAR(32) NOT NULL DEFAULT 'gift'`],
  ['mall_products', 'cash_price', 'DECIMAL(10,2) DEFAULT 0'],
  ['mall_products', 'sort_order', 'INT NOT NULL DEFAULT 0'],
  ['mall_products', 'enable_distribution', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['mall_products', 'distribution_rate', 'DECIMAL(5,2) DEFAULT 0'],
  ['mall_products', 'sales_count', 'INT NOT NULL DEFAULT 0'],
  ['events', 'description', 'MEDIUMTEXT NULL'],
  ['events', 'content', 'MEDIUMTEXT NULL'],
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
  ['business_opportunities', 'contact_phone', 'VARCHAR(32) NULL'],
  ['business_opportunities', 'demand_talent_id', 'INT NULL'],
  ['business_opportunities', 'source', `VARCHAR(16) NOT NULL DEFAULT 'admin'`],
  ['business_opportunities', 'audit_status', `VARCHAR(16) NOT NULL DEFAULT 'approved'`],
  ['business_opportunities', 'reject_reason', 'VARCHAR(500) NULL'],
  ['business_opportunities', 'user_id', 'INT NULL'],
  // 会员推荐码
  ['members', 'invite_code', 'VARCHAR(32) NULL'],
  // 邀请奖励：积分 / 成长值 / 收益 / 贡献值 / 图文
  ['invitation_reward_rules', 'points_value', 'INT NOT NULL DEFAULT 0'],
  ['invitation_reward_rules', 'experience_value', 'INT NOT NULL DEFAULT 0'],
  ['invitation_reward_rules', 'growth_value', 'INT NOT NULL DEFAULT 0'],
  ['invitation_reward_rules', 'earnings_value', 'DECIMAL(14,2) NOT NULL DEFAULT 0'],
  ['invitation_reward_rules', 'contribution_value', 'INT NOT NULL DEFAULT 0'],
  ['invitation_reward_rules', 'content', 'MEDIUMTEXT NULL'],
  // 积分商城订单：收货与物流
  ['mall_orders', 'product_name', 'VARCHAR(255) NULL'],
  ['mall_orders', 'points_used', 'INT NOT NULL DEFAULT 0'],
  ['mall_orders', 'cash_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
  ['mall_orders', 'actual_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
  ['mall_orders', 'payment_method', `VARCHAR(32) NOT NULL DEFAULT 'points'`],
  ['mall_orders', 'contact_name', 'VARCHAR(64) NULL'],
  ['mall_orders', 'contact_phone', 'VARCHAR(32) NULL'],
  ['mall_orders', 'shipping_address', 'VARCHAR(500) NULL'],
  ['mall_orders', 'remark', 'VARCHAR(500) NULL'],
  ['mall_orders', 'logistics_company', 'VARCHAR(64) NULL'],
  ['mall_orders', 'logistics_no', 'VARCHAR(64) NULL'],
  ['mall_orders', 'shipped_at', 'TIMESTAMP NULL'],
  ['mall_orders', 'received_at', 'TIMESTAMP NULL'],
  ['mall_orders', 'referrer_id', 'INT NULL'],
  // 积分流水（兼容新旧字段）
  ['points_records', 'member_id', 'INT NULL'],
  ['points_records', 'amount', 'INT NULL'],
  ['points_records', 'balance', 'INT NULL'],
  ['points_records', 'source', 'VARCHAR(32) NULL'],
  ['points_records', 'source_id', 'VARCHAR(64) NULL'],
  ['points_records', 'description', 'TEXT NULL'],
  ['points_records', 'points', 'INT NULL'],
  // 积分规则：阈值与说明
  ['points_rules', 'threshold_value', 'INT NOT NULL DEFAULT 1'],
  ['points_rules', 'description', 'VARCHAR(500) NULL'],
  ['points_rules', 'repeatable', 'TINYINT(1) NOT NULL DEFAULT 0'],
  // 人才缴费会员
  ['talent_applications', 'payment_status', `VARCHAR(20) NOT NULL DEFAULT 'unpaid'`],
  ['talent_applications', 'payment_start_at', 'DATE NULL'],
  ['talent_applications', 'membership_years', 'TINYINT NOT NULL DEFAULT 0'],
  ['talent_applications', 'payment_expire_at', 'DATE NULL'],
  // 部门负责人姓名（组织架构展示用）
  ['departments', 'leader_name', 'VARCHAR(100) NULL'],
  ['departments', 'level', 'INT DEFAULT 1'],
  ['departments', 'path', `VARCHAR(500) DEFAULT '/'`],
  ['departments', 'manager_id', 'INT NULL'],
  ['departments', 'status', `VARCHAR(20) DEFAULT 'active'`],
  ['member_departments', 'talent_id', 'INT NULL'],
  ['member_departments', 'position', 'VARCHAR(100) NULL'],
]

const TABLES_TO_ENSURE: Array<{ name: string; sql: string }> = [
  {
    name: 'articles',
    sql: `CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      subtitle VARCHAR(255) NULL,
      content MEDIUMTEXT NULL,
      summary VARCHAR(500) NULL,
      cover_image VARCHAR(500) NOT NULL,
      video_url VARCHAR(500) NULL,
      category VARCHAR(50) DEFAULT 'news',
      tags JSON NULL,
      author VARCHAR(100) NULL,
      status VARCHAR(20) DEFAULT 'draft',
      view_count INT DEFAULT 0,
      like_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_articles_status (status),
      INDEX idx_articles_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
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
    name: 'project_score_dimensions',
    sql: `CREATE TABLE IF NOT EXISTS project_score_dimensions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      name VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_project_dimension_project (project_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'project_scores',
    sql: `CREATE TABLE IF NOT EXISTS project_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      dimension_id INT NOT NULL,
      member_id INT NOT NULL,
      stars TINYINT NOT NULL DEFAULT 5,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_project_score (project_id, dimension_id, member_id),
      INDEX idx_project_score_project (project_id),
      INDEX idx_project_score_member (member_id)
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
      growth_value INT NOT NULL DEFAULT 0,
      earnings_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      contribution_value INT NOT NULL DEFAULT 0,
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
  {
    name: 'invitation_records',
    sql: `CREATE TABLE IF NOT EXISTS invitation_records (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      inviter_id INT NOT NULL,
      invitee_id INT NOT NULL,
      invitation_code VARCHAR(32) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reward_points INT DEFAULT 0,
      reward_contribution INT DEFAULT 0,
      accepted_at TIMESTAMP NULL,
      rewarded_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_inviter_id (inviter_id),
      INDEX idx_invitee_id (invitee_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'invitation_rewards',
    sql: `CREATE TABLE IF NOT EXISTS invitation_rewards (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL,
      member_id INT NOT NULL,
      reward_type VARCHAR(32) NOT NULL,
      reward_value INT NOT NULL,
      rule_id INT NULL,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'project_deal_applications',
    sql: `CREATE TABLE IF NOT EXISTS project_deal_applications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      business_id INT NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      deal_time DATE NOT NULL,
      contract_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      contact_name VARCHAR(100) NOT NULL,
      deal_status VARCHAR(20) NOT NULL DEFAULT 'connecting',
      image_urls JSON NULL,
      cooperation_description TEXT NULL,
      audit_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reject_reason VARCHAR(500) NULL,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
      reviewed_by INT NULL,
      reviewed_at TIMESTAMP NULL,
      paid_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_deal_member (member_id),
      INDEX idx_deal_business (business_id),
      INDEX idx_deal_audit (audit_status),
      INDEX idx_deal_payment (payment_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'member_invitations',
    sql: `CREATE TABLE IF NOT EXISTS member_invitations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      inviter_id INT NOT NULL,
      invite_code VARCHAR(64) NOT NULL,
      invitee_name VARCHAR(100) NOT NULL,
      invitee_phone VARCHAR(20) NOT NULL,
      company_name VARCHAR(255) NULL,
      position VARCHAR(100) NULL,
      is_registered TINYINT(1) NOT NULL DEFAULT 0,
      registered_member_id INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_invite_inviter (inviter_id),
      INDEX idx_member_invite_phone (invitee_phone),
      INDEX idx_member_invite_code (invite_code),
      INDEX idx_member_invite_created (created_at)
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

  // 富文本字段升级为 MEDIUMTEXT，避免图文内容被截断
  for (const [table, column] of [
    ['mall_products', 'description'],
    ['events', 'description'],
    ['events', 'content'],
    ['articles', 'content'],
  ] as const) {
    try {
      await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` MEDIUMTEXT NULL`)
    } catch (error: any) {
      const msg = String(error?.message || '')
      if (
        !msg.includes('Unknown column') &&
        !msg.includes("doesn't exist") &&
        error?.code !== 'ER_NO_SUCH_TABLE'
      ) {
        console.warn(`[MySQL] 调整 ${table}.${column} 为 MEDIUMTEXT 失败:`, error?.message || error)
      }
    }
  }

  // 通知表（用户商机审核等）
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      content TEXT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      link VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_member (member_id),
      INDEX idx_notifications_type (type),
      INDEX idx_notifications_read (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  } catch (error: any) {
    console.warn('[MySQL] 确保 notifications 表失败:', error?.message || error)
  }
}
