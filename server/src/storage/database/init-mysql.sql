-- ============================================================
-- 星河平台俱乐部 MySQL 数据库初始化脚本
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS xh_club CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xh_club;

-- ============================================================
-- 1. 会员体系
-- ============================================================

CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  phone VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(128) NOT NULL,
  avatar VARCHAR(500),
  gender VARCHAR(10),
  birthday VARCHAR(20),
  company_name VARCHAR(255),
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
  member_type VARCHAR(32) NOT NULL DEFAULT 'unpaid',
  membership_level VARCHAR(32) NOT NULL DEFAULT 'normal',
  credit_score INT NOT NULL DEFAULT 60,
  active_score INT NOT NULL DEFAULT 0,
  contribution_score INT NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  available_points INT NOT NULL DEFAULT 0,
  referrer_id VARCHAR(36),
  join_source VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP NULL,
  approved_by VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_phone (phone),
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_referrer_id (referrer_id),
  INDEX idx_member_type (member_type),
  INDEX idx_city (city),
  INDEX idx_industry_primary (industry_primary),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. 项目与商机
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  cover_image VARCHAR(500),
  industry VARCHAR(64),
  stage VARCHAR(32),
  amount_min DECIMAL(14,2),
  amount_max DECIMAL(14,2),
  amount_raised DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  owner_id VARCHAR(36) NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INT NOT NULL DEFAULT 0,
  tags_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status (status),
  INDEX idx_owner_id (owner_id),
  INDEX idx_industry (industry),
  INDEX idx_is_featured (is_featured),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. 活动
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  cover_image VARCHAR(500),
  event_type VARCHAR(32) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  location VARCHAR(500),
  max_participants INT,
  current_participants INT NOT NULL DEFAULT 0,
  fee DECIMAL(10,2) DEFAULT 0,
  organizer_id VARCHAR(36),
  org_id VARCHAR(36),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  form_fields JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status (status),
  INDEX idx_event_type (event_type),
  INDEX idx_organizer_id (organizer_id),
  INDEX idx_start_time (start_time),
  INDEX idx_is_featured (is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. 商城
-- ============================================================

CREATE TABLE IF NOT EXISTS mall_products (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  points_price INT NOT NULL,
  cash_price DECIMAL(10,2),
  stock INT NOT NULL DEFAULT 0,
  category VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  enable_distribution BOOLEAN NOT NULL DEFAULT FALSE,
  distribution_rate DECIMAL(5,2) DEFAULT 0,
  sales_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mall_orders (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  order_no VARCHAR(64) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  points_used INT NOT NULL DEFAULT 0,
  cash_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  referrer_id VARCHAR(36),
  distribution_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  INDEX idx_member_id (member_id),
  INDEX idx_product_id (product_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_referrer_id (referrer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. 分销
-- ============================================================

CREATE TABLE IF NOT EXISTS distribution_relations (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  parent_id VARCHAR(36) NOT NULL,
  child_id VARCHAR(36) NOT NULL,
  level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_child_id (child_id),
  INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS distribution_earnings (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  member_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_member_id (member_id),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. 系统表
-- ============================================================

CREATE TABLE IF NOT EXISTS health_check (
  id INT AUTO_INCREMENT PRIMARY KEY,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
