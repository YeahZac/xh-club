import * as bcrypt from 'bcryptjs'
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
  // 社区帖子 / 评论（community 模块字段）
  ['posts', 'type', 'VARCHAR(32) NULL'],
  ['posts', 'images_json', 'JSON NULL'],
  ['posts', 'is_featured', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['posts', 'view_count', 'INT NOT NULL DEFAULT 0'],
  ['comments', 'post_id', 'INT NULL'],
  // 积分流水 / 兑换（transactions 兼容层字段）
  ['points_records', 'balance_after', 'INT NULL'],
  ['points_records', 'expires_at', 'TIMESTAMP NULL'],
  ['points_exchanges', 'points_cost', 'INT NULL'],
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
    name: 'users',
    sql: `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      login_account VARCHAR(50) NOT NULL UNIQUE,
      phone VARCHAR(20) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(50) NOT NULL,
      avatar VARCHAR(255),
      industry VARCHAR(50),
      bio TEXT,
      status VARCHAR(20) DEFAULT 'approved',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'roles',
    sql: `CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      permissions JSON,
      is_system TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'admins',
    sql: `CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      role_id INT NOT NULL DEFAULT 2,
      name VARCHAR(50),
      remark TEXT,
      status ENUM('enabled', 'disabled') DEFAULT 'enabled',
      last_login_at TIMESTAMP NULL,
      last_login_ip VARCHAR(45),
      login_attempts INT DEFAULT 0,
      locked_until TIMESTAMP NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'admin_operation_logs',
    sql: `CREATE TABLE IF NOT EXISTS admin_operation_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50),
      target_id INT,
      details JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_id (admin_id),
      INDEX idx_action (action),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'member_levels',
    sql: `CREATE TABLE IF NOT EXISTS member_levels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      level_code VARCHAR(20) NOT NULL UNIQUE,
      level_name VARCHAR(50) NOT NULL,
      level_icon VARCHAR(255),
      min_contribution INT DEFAULT 0,
      min_points INT DEFAULT 0,
      discount_rate DECIMAL(3,2) DEFAULT 1.00,
      points_multiplier DECIMAL(3,2) DEFAULT 1.00,
      benefits JSON,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'member_level_logs',
    sql: `CREATE TABLE IF NOT EXISTS member_level_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      old_level VARCHAR(20),
      new_level VARCHAR(20) NOT NULL,
      reason VARCHAR(255),
      changed_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'points_rules',
    sql: `CREATE TABLE IF NOT EXISTS points_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_name VARCHAR(100) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      points_value INT NOT NULL,
      conditions JSON,
      daily_limit INT DEFAULT -1,
      total_limit INT DEFAULT -1,
      is_active BOOLEAN DEFAULT TRUE,
      priority INT DEFAULT 0,
      start_date TIMESTAMP NULL,
      end_date TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'points_grants',
    sql: `CREATE TABLE IF NOT EXISTS points_grants (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      rule_id INT,
      points INT NOT NULL,
      balance_before INT NOT NULL,
      balance_after INT NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      description VARCHAR(255),
      reference_type VARCHAR(50),
      reference_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_action_type (action_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'contribution_rules',
    sql: `CREATE TABLE IF NOT EXISTS contribution_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_name VARCHAR(100) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      contribution_value INT NOT NULL,
      conditions JSON,
      calculation_method ENUM('fixed', 'percentage', 'formula') DEFAULT 'fixed',
      formula TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      priority INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'contribution_logs',
    sql: `CREATE TABLE IF NOT EXISTS contribution_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      rule_id INT,
      contribution_value INT NOT NULL,
      balance_before INT NOT NULL,
      balance_after INT NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      description VARCHAR(255),
      reference_type VARCHAR(50),
      reference_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_action_type (action_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'departments',
    sql: `CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      parent_id INT DEFAULT NULL,
      leader_id INT,
      sort_order INT DEFAULT 0,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_parent_id (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'member_departments',
    sql: `CREATE TABLE IF NOT EXISTS member_departments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      department_id INT NOT NULL,
      is_primary BOOLEAN DEFAULT TRUE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_department_id (department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'members',
    sql: `CREATE TABLE IF NOT EXISTS members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE,
      wx_openid VARCHAR(128) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(50),
      avatar VARCHAR(255),
      gender VARCHAR(10),
      birthday VARCHAR(20),
      company_name VARCHAR(100),
      company_position VARCHAR(128),
      industry_primary VARCHAR(64),
      industry_secondary VARCHAR(64),
      company_scale VARCHAR(32),
      company_founded VARCHAR(10),
      company_address VARCHAR(500),
      company_website VARCHAR(500),
      business_description TEXT,
      core_advantage VARCHAR(500),
      resources_supply TEXT,
      resources_demand TEXT,
      city VARCHAR(64),
      wechat_id VARCHAR(128),
      bio TEXT,
      member_type VARCHAR(32) DEFAULT 'unpaid',
      membership_level VARCHAR(20) DEFAULT 'normal',
      credit_score INT DEFAULT 0,
      active_score INT DEFAULT 0,
      contribution_score INT DEFAULT 0,
      total_points INT DEFAULT 0,
      available_points INT DEFAULT 0,
      referrer_id INT,
      join_source VARCHAR(64),
      status VARCHAR(20) DEFAULT 'pending',
      approved_at TIMESTAMP NULL,
      approved_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_phone (phone),
      INDEX idx_status (status),
      INDEX idx_referrer (referrer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'events',
    sql: `CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description MEDIUMTEXT,
      content MEDIUMTEXT,
      cover_image VARCHAR(500) NOT NULL,
      video_url VARCHAR(500),
      event_type VARCHAR(50),
      status VARCHAR(20) DEFAULT 'draft',
      start_time DATETIME,
      end_time DATETIME,
      location VARCHAR(200),
      address TEXT,
      max_participants INT DEFAULT 0,
      current_participants INT DEFAULT 0,
      fee DECIMAL(10,2) DEFAULT 0,
      form_fields JSON,
      view_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_start_time (start_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'event_registrations',
    sql: `CREATE TABLE IF NOT EXISTS event_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      member_id INT NOT NULL,
      status VARCHAR(20) DEFAULT 'registered',
      form_answers JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_event_member (event_id, member_id),
      INDEX idx_event_id (event_id),
      INDEX idx_member_id (member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'event_form_registrations',
    sql: `CREATE TABLE IF NOT EXISTS event_form_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      gender VARCHAR(16),
      birthday DATE,
      age INT,
      industry VARCHAR(64),
      phone VARCHAR(32) NOT NULL,
      contact_method VARCHAR(128),
      referrer VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'comments',
    sql: `CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      article_id INT,
      post_id INT,
      member_id INT,
      content TEXT NOT NULL,
      parent_id INT,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_article_id (article_id),
      INDEX idx_member_id (member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'posts',
    sql: `CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      title VARCHAR(200),
      content TEXT NOT NULL,
      type VARCHAR(32) NULL,
      images JSON,
      images_json JSON NULL,
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      like_count INT DEFAULT 0,
      comment_count INT DEFAULT 0,
      view_count INT NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'messages',
    sql: `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT,
      receiver_id INT,
      content TEXT NOT NULL,
      type VARCHAR(32) NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sender (sender_id),
      INDEX idx_receiver (receiver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'transactions',
    sql: `CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT,
      type VARCHAR(50),
      amount DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'pending',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'projects',
    sql: `CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      cover_image VARCHAR(500) NOT NULL,
      video_url VARCHAR(500),
      industry VARCHAR(64),
      stage VARCHAR(32) DEFAULT 'seed',
      amount_max DECIMAL(14,2),
      status VARCHAR(20) DEFAULT 'draft',
      audit_status VARCHAR(16) NOT NULL DEFAULT 'approved',
      reject_reason VARCHAR(500) NULL,
      submitter_id INT NULL,
      view_count INT NOT NULL DEFAULT 0,
      avg_score DECIMAL(4,2) NOT NULL DEFAULT 0,
      score_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'resources',
    sql: `CREATE TABLE IF NOT EXISTS resources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      resource_type VARCHAR(50),
      url VARCHAR(500),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_type (resource_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'mall_products',
    sql: `CREATE TABLE IF NOT EXISTS mall_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description MEDIUMTEXT,
      price DECIMAL(10,2),
      points_price INT,
      cash_price DECIMAL(10,2) DEFAULT 0,
      stock INT DEFAULT 0,
      image_url VARCHAR(500) NOT NULL,
      video_url VARCHAR(500),
      images JSON,
      category VARCHAR(32) NOT NULL DEFAULT 'gift',
      status VARCHAR(20) DEFAULT 'active',
      sort_order INT NOT NULL DEFAULT 0,
      enable_distribution TINYINT(1) NOT NULL DEFAULT 0,
      distribution_rate DECIMAL(5,2) DEFAULT 0,
      sales_count INT NOT NULL DEFAULT 0,
      view_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'points_exchanges',
    sql: `CREATE TABLE IF NOT EXISTS points_exchanges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      product_id INT,
      points INT NOT NULL,
      points_cost INT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'points_records',
    sql: `CREATE TABLE IF NOT EXISTS points_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      type VARCHAR(50),
      points INT NOT NULL,
      amount INT NULL,
      balance INT NULL,
      balance_after INT NULL,
      source VARCHAR(32) NULL,
      source_id VARCHAR(64) NULL,
      expires_at TIMESTAMP NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'financing',
    sql: `CREATE TABLE IF NOT EXISTS financing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      amount DECIMAL(15,2),
      status VARCHAR(20) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'roadshows',
    sql: `CREATE TABLE IF NOT EXISTS roadshows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      event_time DATETIME,
      status VARCHAR(20) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'member_organizations',
    sql: `CREATE TABLE IF NOT EXISTS member_organizations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      organization_name VARCHAR(200),
      position VARCHAR(100),
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'member_tags',
    sql: `CREATE TABLE IF NOT EXISTS member_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      tag VARCHAR(50) NOT NULL,
      INDEX idx_member_id (member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'organizations',
    sql: `CREATE TABLE IF NOT EXISTS organizations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      logo VARCHAR(255),
      contact_person VARCHAR(50),
      contact_phone VARCHAR(20),
      address VARCHAR(255),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'configs',
    sql: `CREATE TABLE IF NOT EXISTS configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(100) NOT NULL UNIQUE,
      config_value TEXT,
      description VARCHAR(255),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'mall_orders',
    sql: `CREATE TABLE IF NOT EXISTS mall_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(50) NOT NULL UNIQUE,
      member_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(255) NULL,
      quantity INT DEFAULT 1,
      total_amount DECIMAL(10,2) NOT NULL,
      points_used INT NOT NULL DEFAULT 0,
      cash_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      actual_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      payment_method VARCHAR(32) NOT NULL DEFAULT 'points',
      contact_name VARCHAR(64) NULL,
      contact_phone VARCHAR(32) NULL,
      shipping_address VARCHAR(500) NULL,
      remark VARCHAR(500) NULL,
      logistics_company VARCHAR(64) NULL,
      logistics_no VARCHAR(64) NULL,
      shipped_at TIMESTAMP NULL,
      received_at TIMESTAMP NULL,
      referrer_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_member_id (member_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'banners',
    sql: `CREATE TABLE IF NOT EXISTS banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      image_url VARCHAR(500) NOT NULL,
      link_type VARCHAR(20) DEFAULT 'link',
      link_id VARCHAR(100),
      link_config JSON,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      start_time TIMESTAMP NULL,
      end_time TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'homepage_sections',
    sql: `CREATE TABLE IF NOT EXISTS homepage_sections (
      section VARCHAR(32) PRIMARY KEY,
      display_name VARCHAR(64) NOT NULL,
      is_enabled TINYINT(1) DEFAULT 1,
      item_limit INT DEFAULT 5,
      sort_order INT DEFAULT 0,
      sort_mode VARCHAR(32) NOT NULL DEFAULT 'custom',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'homepage_items',
    sql: `CREATE TABLE IF NOT EXISTS homepage_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      section VARCHAR(32) NOT NULL,
      item_id VARCHAR(64) NOT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_homepage_section_item (section, item_id),
      INDEX idx_homepage_section (section, is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'distribution_relations',
    sql: `CREATE TABLE IF NOT EXISTS distribution_relations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      referrer_id INT NOT NULL,
      referee_id INT NOT NULL,
      level INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_referrer_referee (referrer_id, referee_id),
      INDEX idx_referrer_id (referrer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    name: 'distribution_earnings',
    sql: `CREATE TABLE IF NOT EXISTS distribution_earnings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      order_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      rate DECIMAL(5,2) NOT NULL,
      status VARCHAR(32) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
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

  await ensureSeedData(pool)
}

/**
 * 缺失种子数据自动补齐（幂等，绝不覆盖已有数据）
 * 覆盖：默认角色、会员等级、首页栏目、初始管理员账号
 * 行业(industries)与部门(departments)已有各自模块的运行时自愈，此处不重复
 */
async function ensureSeedData(pool: NonNullable<ReturnType<typeof getPool>>): Promise<void> {
  // 1) 默认角色（roles.name 唯一键，INSERT IGNORE 幂等）
  try {
    await pool.query(
      `INSERT IGNORE INTO roles (name, display_name, description, permissions, is_system) VALUES
       ('super_admin', '超级管理员', '拥有所有权限', '["*"]', 1),
       ('admin', '普通管理员', '基础管理权限', '["dashboard","homepage","members","articles","banners"]', 1)`,
    )
  } catch (error: any) {
    console.warn('[MySQL] 补齐默认角色失败:', error?.message || error)
  }

  // 2) 默认会员等级（level_code 唯一键）
  try {
    await pool.query(
      `INSERT IGNORE INTO member_levels
         (level_code, level_name, min_contribution, discount_rate, points_multiplier, sort_order) VALUES
       ('normal', '普通会员', 0, 1.00, 1.00, 1),
       ('silver', '银卡会员', 100, 0.95, 1.20, 2),
       ('gold', '金卡会员', 500, 0.90, 1.50, 3),
       ('diamond', '钻石会员', 2000, 0.85, 2.00, 4)`,
    )
  } catch (error: any) {
    console.warn('[MySQL] 补齐默认会员等级失败:', error?.message || error)
  }

  // 3) 默认首页栏目（section 主键；homepage 模块访问时也会自愈，这里兜底）
  try {
    await pool.query(
      `INSERT IGNORE INTO homepage_sections (section, display_name, item_limit, sort_order) VALUES
       ('projects', '精选项目', 6, 1),
       ('resources', '资源大厅', 5, 2),
       ('posts', '商会动态', 5, 3)`,
    )
  } catch (error: any) {
    console.warn('[MySQL] 补齐默认首页栏目失败:', error?.message || error)
  }

  // 4) 初始管理员账号：仅当 admin 账号完全不存在时创建，绝不重置已有密码
  try {
    const [rows] = await pool.query(`SELECT id FROM users WHERE login_account = 'admin' LIMIT 1`)
    const existing = Array.isArray(rows) ? (rows as any[]) : []
    let userId: number | null = existing[0]?.id ?? null

    if (!userId) {
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'a123123'
      const passwordHash = await bcrypt.hash(initialPassword, 10)
      const [result] = await pool.query(
        `INSERT INTO users (login_account, password_hash, name) VALUES ('admin', ?, '系统管理员')`,
        [passwordHash],
      )
      userId = (result as any)?.insertId ?? null
      if (!process.env.ADMIN_INITIAL_PASSWORD) {
        console.warn('[MySQL] 已用默认密码创建初始管理员 admin，请尽快登录管理台修改密码')
      } else {
        console.log('[MySQL] 已按 ADMIN_INITIAL_PASSWORD 创建初始管理员 admin')
      }
    }

    if (userId) {
      // 关联超级管理员角色（admins.user_id 无唯一键，先查再插避免重复）
      const [adminRows] = await pool.query('SELECT id FROM admins WHERE user_id = ? LIMIT 1', [userId])
      if (!(Array.isArray(adminRows) && (adminRows as any[]).length > 0)) {
        const [roleRows] = await pool.query(`SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1`)
        const roleId = (Array.isArray(roleRows) && (roleRows as any[])[0]?.id) || 1
        await pool.query(
          `INSERT INTO admins (user_id, role_id, status) VALUES (?, ?, 'enabled')`,
          [userId, roleId],
        )
        console.log('[MySQL] 已补齐 admin 的超级管理员授权')
      }
    }
  } catch (error: any) {
    console.warn('[MySQL] 补齐初始管理员失败:', error?.message || error)
  }
}
