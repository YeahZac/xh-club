-- ============================================================
-- 星河百谷商会平台 - MySQL 建表脚本
-- 数据库: xh_club
-- 字符集: utf8mb4
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 系统表
-- ============================================================
CREATE TABLE IF NOT EXISTS health_check (
  id INT AUTO_INCREMENT PRIMARY KEY,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 1. 会员体系
-- ============================================================

-- 会员主表
CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(32) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(128) NOT NULL,
  avatar VARCHAR(500),
  gender VARCHAR(10),
  birthday VARCHAR(20),
  -- 公司信息
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
  -- 个人信息
  city VARCHAR(64),
  wechat_id VARCHAR(128),
  wx_openid VARCHAR(128),
  bio TEXT,
  -- 会员身份
  member_type VARCHAR(32) NOT NULL DEFAULT 'unpaid',
  membership_level VARCHAR(32) NOT NULL DEFAULT 'normal',
  credit_score INT NOT NULL DEFAULT 60,
  active_score INT NOT NULL DEFAULT 0,
  contribution_score INT NOT NULL DEFAULT 0,
  total_points INT NOT NULL DEFAULT 0,
  available_points INT NOT NULL DEFAULT 0,
  -- 推荐关系
  referrer_id VARCHAR(36),
  join_source VARCHAR(64),
  -- 状态
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  approved_at DATETIME,
  approved_by VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX members_phone_idx (phone),
  INDEX members_status_idx (status),
  INDEX members_referrer_id_idx (referrer_id),
  INDEX members_member_type_idx (member_type),
  INDEX members_city_idx (city),
  INDEX members_industry_primary_idx (industry_primary),
  INDEX members_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员标签表
CREATE TABLE IF NOT EXISTS member_tags (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  tag_type VARCHAR(32) NOT NULL,
  tag_value VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX member_tags_member_id_idx (member_id),
  INDEX member_tags_tag_type_idx (tag_type),
  INDEX member_tags_tag_value_idx (tag_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 组织架构表
CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(36) PRIMARY KEY,
  parent_id VARCHAR(36),
  org_type VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  level INT NOT NULL DEFAULT 0,
  leader_id VARCHAR(36),
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX organizations_parent_id_idx (parent_id),
  INDEX organizations_org_type_idx (org_type),
  INDEX organizations_sort_order_idx (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员-组织关联表
CREATE TABLE IF NOT EXISTS member_organizations (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  org_id VARCHAR(36) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'member',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX member_organizations_member_id_idx (member_id),
  INDEX member_organizations_org_id_idx (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. 项目与商机
-- ============================================================

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) PRIMARY KEY,
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
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  tags_json JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX projects_status_idx (status),
  INDEX projects_owner_id_idx (owner_id),
  INDEX projects_industry_idx (industry),
  INDEX projects_is_featured_idx (is_featured),
  INDEX projects_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 融资项目表
CREATE TABLE IF NOT EXISTS financing (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  target_amount DECIMAL(14,2) NOT NULL,
  raised_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  valuation DECIMAL(14,2),
  equity_ratio DECIMAL(5,2),
  deadline DATETIME,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX financing_project_id_idx (project_id),
  INDEX financing_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 资源供需表
CREATE TABLE IF NOT EXISTS resources (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  type VARCHAR(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64),
  industry VARCHAR(64),
  region VARCHAR(64),
  contact_info VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX resources_member_id_idx (member_id),
  INDEX resources_type_idx (type),
  INDEX resources_category_idx (category),
  INDEX resources_status_idx (status),
  INDEX resources_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. 活动与路演
-- ============================================================

-- 活动表
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  cover_image VARCHAR(500),
  event_type VARCHAR(32) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  location VARCHAR(500),
  max_participants INT,
  current_participants INT NOT NULL DEFAULT 0,
  fee DECIMAL(10,2) DEFAULT 0,
  organizer_id VARCHAR(36),
  org_id VARCHAR(36),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  form_fields JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX events_status_idx (status),
  INDEX events_event_type_idx (event_type),
  INDEX events_organizer_id_idx (organizer_id),
  INDEX events_start_time_idx (start_time),
  INDEX events_is_featured_idx (is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 活动报名表
CREATE TABLE IF NOT EXISTS event_registrations (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'registered',
  form_answers JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX event_registrations_event_id_idx (event_id),
  INDEX event_registrations_member_id_idx (member_id),
  INDEX event_registrations_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 路演表
CREATE TABLE IF NOT EXISTS roadshows (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  event_id VARCHAR(36),
  presenter_id VARCHAR(36) NOT NULL,
  presentation_order INT,
  score_avg DECIMAL(5,2),
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX roadshows_project_id_idx (project_id),
  INDEX roadshows_event_id_idx (event_id),
  INDEX roadshows_presenter_id_idx (presenter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. 交易与积分
-- ============================================================

-- 成交记录表
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  category VARCHAR(64),
  description TEXT,
  party_a_id VARCHAR(36) NOT NULL,
  party_b_id VARCHAR(36) NOT NULL,
  matcher_id VARCHAR(36),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  confirmed_by_a TINYINT(1) NOT NULL DEFAULT 0,
  confirmed_by_b TINYINT(1) NOT NULL DEFAULT 0,
  points_awarded TINYINT(1) NOT NULL DEFAULT 0,
  milestone_json JSON,
  rating_a INT,
  rating_b INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  INDEX transactions_party_a_id_idx (party_a_id),
  INDEX transactions_party_b_id_idx (party_b_id),
  INDEX transactions_matcher_id_idx (matcher_id),
  INDEX transactions_status_idx (status),
  INDEX transactions_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 积分流水表
CREATE TABLE IF NOT EXISTS points_records (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  type VARCHAR(16) NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  source VARCHAR(32) NOT NULL,
  source_id VARCHAR(36),
  description VARCHAR(255),
  expires_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX points_records_member_id_idx (member_id),
  INDEX points_records_type_idx (type),
  INDEX points_records_source_idx (source),
  INDEX points_records_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 积分兑换记录表
CREATE TABLE IF NOT EXISTS points_exchanges (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  points_cost INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX points_exchanges_member_id_idx (member_id),
  INDEX points_exchanges_product_id_idx (product_id),
  INDEX points_exchanges_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. 社区与沟通
-- ============================================================

-- 动态/帖子表
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'insight',
  title VARCHAR(255),
  content TEXT NOT NULL,
  images_json JSON,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX posts_member_id_idx (member_id),
  INDEX posts_type_idx (type),
  INDEX posts_status_idx (status),
  INDEX posts_is_featured_idx (is_featured),
  INDEX posts_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  parent_id VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX comments_post_id_idx (post_id),
  INDEX comments_member_id_idx (member_id),
  INDEX comments_parent_id_idx (parent_id),
  INDEX comments_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 私信表
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  sender_id VARCHAR(36) NOT NULL,
  receiver_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(16) NOT NULL DEFAULT 'text',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX messages_sender_id_idx (sender_id),
  INDEX messages_receiver_id_idx (receiver_id),
  INDEX messages_is_read_idx (is_read),
  INDEX messages_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  link VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX notifications_member_id_idx (member_id),
  INDEX notifications_type_idx (type),
  INDEX notifications_is_read_idx (is_read),
  INDEX notifications_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. 配置与管理
-- ============================================================

-- 轮播图/Banner表
CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  link_type VARCHAR(32),
  link_id VARCHAR(36),
  link_url VARCHAR(500),
  link_config JSON,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  start_time DATETIME,
  end_time DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX banners_is_active_idx (is_active),
  INDEX banners_sort_order_idx (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  summary VARCHAR(500),
  content TEXT NOT NULL,
  cover_image VARCHAR(500),
  author_id VARCHAR(36),
  category VARCHAR(64),
  tags JSON,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  publish_at DATETIME,
  published_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX articles_status_idx (status),
  INDEX articles_category_idx (category),
  INDEX articles_published_at_idx (published_at),
  INDEX articles_is_featured_idx (is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员商城商品表
CREATE TABLE IF NOT EXISTS mall_products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  points_price INT NOT NULL,
  cash_price DECIMAL(10,2),
  stock INT NOT NULL DEFAULT 0,
  category VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  enable_distribution TINYINT(1) NOT NULL DEFAULT 0,
  distribution_rate DECIMAL(5,2) DEFAULT 0,
  sales_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX mall_products_status_idx (status),
  INDEX mall_products_category_idx (category),
  INDEX mall_products_sort_order_idx (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 商城订单表
CREATE TABLE IF NOT EXISTS mall_orders (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  points_cost INT NOT NULL,
  cash_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  contact_name VARCHAR(64),
  contact_phone VARCHAR(32),
  shipping_address VARCHAR(500),
  remark TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX mall_orders_member_id_idx (member_id),
  INDEX mall_orders_product_id_idx (product_id),
  INDEX mall_orders_status_idx (status),
  INDEX mall_orders_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分销关系表
CREATE TABLE IF NOT EXISTS distribution_relations (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL UNIQUE,
  parent_id VARCHAR(36),
  level INT NOT NULL DEFAULT 1,
  total_commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX distribution_relations_parent_id_idx (parent_id),
  INDEX distribution_relations_level_idx (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分销收益表
CREATE TABLE IF NOT EXISTS distribution_earnings (
  id VARCHAR(36) PRIMARY KEY,
  member_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36),
  amount DECIMAL(14,2) NOT NULL,
  type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX distribution_earnings_member_id_idx (member_id),
  INDEX distribution_earnings_order_id_idx (order_id),
  INDEX distribution_earnings_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(128) NOT NULL UNIQUE,
  config_value TEXT,
  description VARCHAR(255),
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  INDEX admins_username_idx (username),
  INDEX admins_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 初始化数据
-- ============================================================

-- 默认管理员 (用户名: admin, 密码: admin123456)
INSERT IGNORE INTO admins (id, username, password_hash, name, role)
VALUES (
  '1',
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  '超级管理员',
  'super_admin'
);

-- 系统配置初始化
INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES
('site_name', '星河百谷', '网站名称'),
('register_audit', '1', '注册是否需要审核'),
('default_credit_score', '60', '默认信用分'),
('default_points', '0', '默认积分');

SET FOREIGN_KEY_CHECKS = 1;
