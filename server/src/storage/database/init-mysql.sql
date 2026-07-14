-- ============================================================
-- 粤商汇 MySQL 数据库初始化脚本
-- 适用于微信云托管 MySQL
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(64),
  avatar_url VARCHAR(512),
  gender VARCHAR(16) DEFAULT 'unknown',
  birthday DATE,
  company VARCHAR(128),
  position VARCHAR(64),
  industry VARCHAR(64),
  region VARCHAR(64),
  bio TEXT,
  points_balance INT DEFAULT 0,
  referrer_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商机表
CREATE TABLE IF NOT EXISTS business_opportunities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64),
  type VARCHAR(32) DEFAULT 'supply',
  status VARCHAR(32) DEFAULT 'pending',
  user_id INT NOT NULL,
  contact_name VARCHAR(64),
  contact_phone VARCHAR(32),
  contact_wechat VARCHAR(64),
  view_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  featured_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商机图片表
CREATE TABLE IF NOT EXISTS business_opportunity_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT NOT NULL,
  image_url VARCHAR(512) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opportunity_id (opportunity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商机收藏表
CREATE TABLE IF NOT EXISTS business_opportunity_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  opportunity_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_opportunity (user_id, opportunity_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商机评论表
CREATE TABLE IF NOT EXISTS business_opportunity_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opportunity_id (opportunity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商机浏览记录表
CREATE TABLE IF NOT EXISTS business_opportunity_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT NOT NULL,
  user_id INT,
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opportunity_id (opportunity_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会员等级表
CREATE TABLE IF NOT EXISTS member_levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  min_points INT NOT NULL,
  max_points INT,
  benefits JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 积分记录表
CREATE TABLE IF NOT EXISTS points_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  type VARCHAR(32) NOT NULL,
  description VARCHAR(255),
  related_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 签到记录表
CREATE TABLE IF NOT EXISTS check_in_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  check_in_date DATE NOT NULL,
  points_earned INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, check_in_date),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 活动报名表
CREATE TABLE IF NOT EXISTS event_registrations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商品表
CREATE TABLE IF NOT EXISTS mall_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  points_price INT NOT NULL,
  cash_price DECIMAL(10,2),
  stock INT DEFAULT 0,
  category VARCHAR(64),
  image_url VARCHAR(512),
  status VARCHAR(32) DEFAULT 'active',
  enable_distribution BOOLEAN DEFAULT FALSE,
  distribution_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订单表
CREATE TABLE IF NOT EXISTS mall_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL,
  member_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT DEFAULT 1,
  points_used INT DEFAULT 0,
  cash_paid DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'pending',
  referrer_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  INDEX idx_member_id (member_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分销关系表
CREATE TABLE IF NOT EXISTS distribution_relations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referee_id INT NOT NULL,
  level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_referrer_referee (referrer_id, referee_id),
  INDEX idx_referrer_id (referrer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分销收益表
CREATE TABLE IF NOT EXISTS distribution_earnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 插入初始数据
-- ============================================================

-- 插入会员等级
INSERT INTO member_levels (name, min_points, max_points, benefits) VALUES
('普通会员', 0, 999, '{"discount": 1.0, "points_rate": 1.0}'),
('银卡会员', 1000, 4999, '{"discount": 0.95, "points_rate": 1.2}'),
('金卡会员', 5000, 19999, '{"discount": 0.9, "points_rate": 1.5}'),
('钻石会员', 20000, NULL, '{"discount": 0.85, "points_rate": 2.0}');
