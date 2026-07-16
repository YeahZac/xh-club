import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { AdminService } from './admin.service'
import * as bcrypt from 'bcryptjs'
import { AdminAuthGuard } from '@/auth/auth.guard'
import { Public } from '@/auth/public.decorator'

// 数据库初始化 SQL（直接嵌入代码，避免文件路径问题）
const INIT_SQL = `
-- 先删除旧表（按依赖顺序）
DROP TABLE IF EXISTS admin_operation_logs;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS member_levels;
DROP TABLE IF EXISTS member_level_logs;
DROP TABLE IF EXISTS invitation_reward_rules;
DROP TABLE IF EXISTS invitation_records;
DROP TABLE IF EXISTS invitation_rewards;
DROP TABLE IF EXISTS points_rules;
DROP TABLE IF EXISTS points_grants;
DROP TABLE IF EXISTS contribution_rules;
DROP TABLE IF EXISTS contribution_logs;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS member_departments;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS event_registrations;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS financing;
DROP TABLE IF EXISTS mall_products;
DROP TABLE IF EXISTS member_organizations;
DROP TABLE IF EXISTS member_tags;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS points_exchanges;
DROP TABLE IF EXISTS points_records;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS roadshows;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS configs;
DROP TABLE IF EXISTS mall_orders;
DROP TABLE IF EXISTS banners;

-- 用户表（管理员账号）
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login_account VARCHAR(50) NOT NULL UNIQUE COMMENT '登录账号',
  phone VARCHAR(20) UNIQUE COMMENT '手机号（选填）',
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL COMMENT '姓名',
  avatar VARCHAR(255),
  industry VARCHAR(50),
  bio TEXT,
  status VARCHAR(20) DEFAULT 'approved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 角色表
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON,
  is_system TINYINT(1) DEFAULT 0 COMMENT '是否系统内置角色：1-是，0-否',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 管理员表
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_id INT NOT NULL DEFAULT 2,
  name VARCHAR(50) COMMENT '管理员姓名',
  remark TEXT COMMENT '备注',
  status ENUM('enabled', 'disabled') DEFAULT 'enabled' COMMENT '状态：enabled-启用，disabled-停用',
  last_login_at TIMESTAMP NULL,
  last_login_ip VARCHAR(45),
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作日志表
CREATE TABLE admin_operation_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员等级配置表
DROP TABLE IF EXISTS member_levels;
CREATE TABLE member_levels (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员等级变更记录
CREATE TABLE member_level_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  old_level VARCHAR(20),
  new_level VARCHAR(20) NOT NULL,
  reason VARCHAR(255),
  changed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 邀请奖励规则表
CREATE TABLE invitation_reward_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  rule_type ENUM('direct', 'indirect', 'level_up', 'purchase') NOT NULL,
  reward_type ENUM('points', 'contribution', 'both') NOT NULL,
  reward_value INT NOT NULL,
  conditions JSON,
  max_rewards INT DEFAULT -1,
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMP NULL,
  end_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 邀请记录表
CREATE TABLE invitation_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  inviter_id INT NOT NULL,
  invitee_id INT NOT NULL,
  invitation_code VARCHAR(20),
  status ENUM('pending', 'accepted', 'rewarded', 'cancelled') DEFAULT 'pending',
  reward_points INT DEFAULT 0,
  reward_contribution INT DEFAULT 0,
  accepted_at TIMESTAMP NULL,
  rewarded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inviter_id (inviter_id),
  INDEX idx_invitee_id (invitee_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 邀请奖励发放记录
CREATE TABLE invitation_rewards (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  record_id BIGINT NOT NULL,
  member_id INT NOT NULL,
  reward_type ENUM('points', 'contribution') NOT NULL,
  reward_value INT NOT NULL,
  rule_id INT,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 积分规则表
CREATE TABLE points_rules (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 积分发放记录
CREATE TABLE points_grants (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 贡献值规则表
CREATE TABLE contribution_rules (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 贡献值变更记录
CREATE TABLE contribution_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 部门表
CREATE TABLE departments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员部门关联表
CREATE TABLE member_departments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  department_id INT NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_department_id (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 业务表

-- 会员表
CREATE TABLE members (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 活动表
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 活动报名表
CREATE TABLE event_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  member_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'registered',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_event_member (event_id, member_id),
  INDEX idx_event_id (event_id),
  INDEX idx_member_id (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通用报名表
CREATE TABLE event_form_registrations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 文章表
CREATE TABLE articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(255),
  content TEXT,
  summary VARCHAR(500),
  cover_image VARCHAR(500) NOT NULL,
  video_url VARCHAR(500),
  category VARCHAR(50) DEFAULT 'news',
  tags JSON,
  author VARCHAR(100),
  status VARCHAR(20) DEFAULT 'draft',
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论表
CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  article_id INT,
  member_id INT,
  content TEXT NOT NULL,
  parent_id INT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_article_id (article_id),
  INDEX idx_member_id (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 帖子表
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  title VARCHAR(200),
  content TEXT NOT NULL,
  images JSON,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 消息表
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT,
  receiver_id INT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sender (sender_id),
  INDEX idx_receiver (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知表
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT,
  title VARCHAR(200),
  content TEXT,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 交易表
CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT,
  type VARCHAR(50),
  amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 项目表
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  cover_image VARCHAR(500) NOT NULL,
  video_url VARCHAR(500),
  industry VARCHAR(64),
  stage VARCHAR(32) DEFAULT 'seed',
  amount_max DECIMAL(14,2),
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 资源表
CREATE TABLE resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  resource_type VARCHAR(50),
  url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (resource_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 商城商品表
CREATE TABLE mall_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  points_price INT,
  stock INT DEFAULT 0,
  image_url VARCHAR(500) NOT NULL,
  video_url VARCHAR(500),
  images JSON,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 积分兑换表
CREATE TABLE points_exchanges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  product_id INT,
  points INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 积分记录表
CREATE TABLE points_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  type VARCHAR(50),
  points INT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 融资表
CREATE TABLE financing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  amount DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 路演表
CREATE TABLE roadshows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_time DATETIME,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员组织表
CREATE TABLE member_organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  organization_name VARCHAR(200),
  position VARCHAR(100),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会员标签表
CREATE TABLE member_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  tag VARCHAR(50) NOT NULL,
  INDEX idx_member_id (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 组织/商会表
CREATE TABLE organizations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 系统配置表
CREATE TABLE configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 商城订单表
CREATE TABLE mall_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(50) NOT NULL UNIQUE,
  member_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  points_used INT DEFAULT 0,
  actual_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_member_id (member_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Banner 表
CREATE TABLE banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  link_type VARCHAR(20) DEFAULT 'link' COMMENT '链接类型: article/event/link/miniapp',
  link_id VARCHAR(100) COMMENT '关联ID',
  link_config JSON COMMENT '链接配置',
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  start_time TIMESTAMP NULL,
  end_time TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 首页栏目配置
CREATE TABLE homepage_sections (
  section VARCHAR(32) PRIMARY KEY,
  display_name VARCHAR(64) NOT NULL,
  is_enabled TINYINT(1) DEFAULT 1,
  item_limit INT DEFAULT 5,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 首页栏目内容
CREATE TABLE homepage_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section VARCHAR(32) NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_homepage_section_item (section, item_id),
  INDEX idx_homepage_section (section, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入默认角色
INSERT IGNORE INTO roles (name, display_name, description, permissions, is_system) VALUES 
('super_admin', '超级管理员', '拥有所有权限', '["*"]', 1),
('admin', '普通管理员', '基础管理权限', '["dashboard","homepage","members","articles","banners"]', 1);

-- 插入默认会员等级
INSERT IGNORE INTO member_levels (level_code, level_name, min_contribution, discount_rate, points_multiplier, sort_order) VALUES
('normal', '普通会员', 0, 1.00, 1.00, 1),
('silver', '银卡会员', 100, 0.95, 1.20, 2),
('gold', '金卡会员', 500, 0.90, 1.50, 3),
('diamond', '钻石会员', 2000, 0.85, 2.00, 4);

INSERT IGNORE INTO homepage_sections (section, display_name, item_limit, sort_order) VALUES
('projects', '精选项目', 6, 1),
('resources', '资源大厅', 5, 2),
('posts', '商会动态', 5, 3);
`

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** 数据库连接状态检查 */
  @Get('db-status')
  async checkDatabaseStatus() {
    console.log('[AdminController] GET /api/admin/db-status')
    const result = await this.adminService.checkDatabaseConnection()
    return { code: 200, msg: 'success', data: result }
  }

  /** 初始化数据库表结构 */
  @Post('init-database')
  async initDatabase() {
    console.log('[AdminController] POST /api/admin/init-database')
    try {
      // 执行完整的 SQL（包含所有表创建语句）
      await this.adminService.executeRaw(INIT_SQL)
      
      // 创建默认管理员账号（密码: a123123）
      const passwordHash = await bcrypt.hash('a123123', 10)
      await this.adminService.executeRaw(
        `INSERT IGNORE INTO users (login_account, password_hash, name) VALUES ('admin', '${passwordHash}', '系统管理员')`
      )
      // 获取用户ID
      const users = await this.adminService.executeRaw(`SELECT id FROM users WHERE login_account = 'admin'`)
      const userId = users[0]?.id || 1
      // 创建管理员记录（关联到超级管理员角色）
      await this.adminService.executeRaw(
        `INSERT IGNORE INTO admins (user_id, role_id, status) VALUES (${userId}, 1, 'enabled')`
      )
      
      return { 
        code: 200, 
        msg: '数据库初始化成功', 
        data: { success: true }
      }
    } catch (err: any) {
      console.error('[AdminController] init-database error:', err)
      return { code: 500, msg: '初始化失败: ' + err.message }
    }
  }

  /** 增量迁移：修复现有表结构（不删除数据） */
  @Post('migrate')
  async migrateDatabase() {
    console.log('[AdminController] POST /api/admin/migrate')
    const results: string[] = []
    try {
      // 1. roles 表添加 is_system 列
      try {
        await this.adminService.executeRaw(
          `ALTER TABLE roles ADD COLUMN is_system TINYINT(1) DEFAULT 0 COMMENT '是否系统内置角色：1-是，0-否'`
        )
        results.push('roles.is_system 列已添加')
      } catch (e: any) {
        if (e.message?.includes('Duplicate column')) {
          results.push('roles.is_system 列已存在，跳过')
        } else {
          results.push('roles.is_system 添加失败: ' + e.message)
        }
      }

      // 2. 更新 super_admin 角色的 is_system 和 permissions
      try {
        await this.adminService.executeRaw(
          `UPDATE roles SET is_system = 1, permissions = '["*"]' WHERE name = 'super_admin'`
        )
        results.push('super_admin 角色已更新为系统角色')
      } catch (e: any) {
        results.push('super_admin 更新失败: ' + e.message)
      }

      // 3. 更新 admin 角色的 is_system
      try {
        await this.adminService.executeRaw(
          `UPDATE roles SET is_system = 1 WHERE name = 'admin'`
        )
        results.push('admin 角色已更新为系统角色')
      } catch (e: any) {
        results.push('admin 更新失败: ' + e.message)
      }

      // 4. users 表添加 login_account 列（如果不存在）
      try {
        await this.adminService.executeRaw(
          `ALTER TABLE users ADD COLUMN login_account VARCHAR(50) NOT NULL DEFAULT '' COMMENT '登录账号'`
        )
        results.push('users.login_account 列已添加')
        // 将现有 phone 值复制到 login_account
        await this.adminService.executeRaw(
          `UPDATE users SET login_account = phone WHERE login_account = '' AND phone IS NOT NULL`
        )
        results.push('已将 phone 值复制到 login_account')
      } catch (e: any) {
        if (e.message?.includes('Duplicate column')) {
          results.push('users.login_account 列已存在，跳过')
        } else {
          results.push('users.login_account 添加失败: ' + e.message)
        }
      }

      // 5. 确保 admin 账号存在
      try {
        const existing = await this.adminService.executeRaw(
          `SELECT id FROM users WHERE login_account = 'admin' LIMIT 1`
        )
        if (!existing || existing.length === 0) {
          const initialPassword = process.env.ADMIN_INITIAL_PASSWORD
          if (!initialPassword) {
            results.push('未配置 ADMIN_INITIAL_PASSWORD，跳过初始管理员创建')
          } else {
          const passwordHash = await bcrypt.hash(initialPassword, 10)
          await this.adminService.executeRaw(
            `INSERT INTO users (login_account, phone, password_hash, name) VALUES ('admin', 'admin', '${passwordHash}', '系统管理员')`
          )
          const newUsers = await this.adminService.executeRaw(`SELECT id FROM users WHERE login_account = 'admin'`)
          const userId = newUsers[0]?.id
          if (userId) {
            await this.adminService.executeRaw(
              `INSERT IGNORE INTO admins (user_id, role_id, status) VALUES (${userId}, 1, 'enabled')`
            )
          }
          results.push('admin 账号已创建')
          }
        } else {
          results.push('admin 账号已存在')
        }
      } catch (e: any) {
        results.push('admin 账号检查失败: ' + e.message)
      }

      // 6. 创建 banners 表（如果不存在）
      try {
        await this.adminService.executeRaw(`
          CREATE TABLE IF NOT EXISTS banners (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(100) NOT NULL,
            image_url VARCHAR(500),
            link_type VARCHAR(20) DEFAULT 'link' COMMENT '链接类型: article/event/link/miniapp',
            link_id VARCHAR(100) COMMENT '关联ID',
            link_config JSON COMMENT '链接配置',
            sort_order INT DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            start_time TIMESTAMP NULL,
            end_time TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `)
        results.push('banners 表已创建')
      } catch (e: any) {
        results.push('banners 表创建失败: ' + e.message)
      }

      // 7. 创建首页栏目配置表
      try {
        await this.adminService.executeRaw(`
          CREATE TABLE IF NOT EXISTS homepage_sections (
            section VARCHAR(32) PRIMARY KEY,
            display_name VARCHAR(64) NOT NULL,
            is_enabled TINYINT(1) DEFAULT 1,
            item_limit INT DEFAULT 5,
            sort_order INT DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

          CREATE TABLE IF NOT EXISTS homepage_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            section VARCHAR(32) NOT NULL,
            item_id VARCHAR(64) NOT NULL,
            sort_order INT DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_homepage_section_item (section, item_id),
            INDEX idx_homepage_section (section, is_active, sort_order)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

          INSERT IGNORE INTO homepage_sections
            (section, display_name, item_limit, sort_order)
          VALUES
            ('projects', '精选项目', 6, 1),
            ('resources', '资源大厅', 5, 2),
            ('posts', '商会动态', 5, 3);
        `)
        results.push('首页栏目配置表已创建')
      } catch (e: any) {
        results.push('首页栏目配置表创建失败: ' + e.message)
      }

      // 8. 补齐内容媒体字段（封面由接口对新建/编辑内容强制校验）
      const mediaColumns: Array<[string, string, string]> = [
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
      for (const [table, column, definition] of mediaColumns) {
        try {
          await this.adminService.executeRaw(
            `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
          )
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {
            results.push(`${table}.${column} 添加失败: ${e.message}`)
          }
        }
      }
      try {
        await this.adminService.executeRaw(
          `UPDATE mall_products
           SET image_url = COALESCE(image_url, cover_image)
           WHERE image_url IS NULL`
        )
      } catch {
        // 旧表没有 cover_image 时无需复制
      }
      results.push('内容图片及视频字段已完成兼容补齐')

      // 9. members 表补充微信 openid
      try {
        await this.adminService.executeRaw(
          `ALTER TABLE members ADD COLUMN wx_openid VARCHAR(128) NULL UNIQUE AFTER phone`
        )
        results.push('members.wx_openid 列已添加')
      } catch (e: any) {
        if (e.message?.includes('Duplicate column')) {
          results.push('members.wx_openid 列已存在，跳过')
        } else {
          results.push('members.wx_openid 添加失败: ' + e.message)
        }
      }

      // 10. 补齐统一会员字段
      const memberColumns: Record<string, string> = {
        gender: 'VARCHAR(10) NULL',
        birthday: 'VARCHAR(20) NULL',
        company_position: 'VARCHAR(128) NULL',
        industry_primary: 'VARCHAR(64) NULL',
        industry_secondary: 'VARCHAR(64) NULL',
        company_scale: 'VARCHAR(32) NULL',
        company_founded: 'VARCHAR(10) NULL',
        company_address: 'VARCHAR(500) NULL',
        company_website: 'VARCHAR(500) NULL',
        business_description: 'TEXT NULL',
        core_advantage: 'VARCHAR(500) NULL',
        resources_supply: 'TEXT NULL',
        resources_demand: 'TEXT NULL',
        city: 'VARCHAR(64) NULL',
        wechat_id: 'VARCHAR(128) NULL',
        member_type: `VARCHAR(32) NOT NULL DEFAULT 'unpaid'`,
        join_source: 'VARCHAR(64) NULL',
        approved_at: 'TIMESTAMP NULL',
        approved_by: 'VARCHAR(36) NULL',
      }
      for (const [column, definition] of Object.entries(memberColumns)) {
        try {
          await this.adminService.executeRaw(
            `ALTER TABLE members ADD COLUMN ${column} ${definition}`
          )
        } catch (e: any) {
          if (!e.message?.includes('Duplicate column')) {
            results.push(`members.${column} 添加失败: ${e.message}`)
          }
        }
      }
      try {
        await this.adminService.executeRaw(
          `UPDATE members
           SET company_position = COALESCE(company_position, position),
               industry_primary = COALESCE(industry_primary, industry)`
        )
      } catch {
        // 旧字段不存在时无需复制
      }
      results.push('会员字段已完成兼容补齐')

      // 11. 拆分通用报名与会员活动报名，兼容旧表数据
      try {
        const registrationColumns = await this.adminService.executeRaw(
          `SELECT COLUMN_NAME
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_registrations'`
        )
        const columnNames = new Set((registrationColumns || []).map((row: any) => row.COLUMN_NAME))
        const isLegacyFormTable = columnNames.has('name') && !columnNames.has('event_id')

        if (isLegacyFormTable) {
          const formTable = await this.adminService.executeRaw(
            `SHOW TABLES LIKE 'event_form_registrations'`
          )
          if (!formTable || formTable.length === 0) {
            await this.adminService.executeRaw(
              `RENAME TABLE event_registrations TO event_form_registrations`
            )
          } else {
            await this.adminService.executeRaw(
              `INSERT INTO event_form_registrations
                 (name, gender, birthday, age, industry, phone, contact_method, referrer, created_at)
               SELECT name, gender, birthday, age, industry, phone, contact_method, referrer, created_at
               FROM event_registrations`
            )
            await this.adminService.executeRaw(`DROP TABLE event_registrations`)
          }
          results.push('旧通用报名数据已迁移到 event_form_registrations')
        }

        await this.adminService.executeRaw(`
          CREATE TABLE IF NOT EXISTS event_form_registrations (
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
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `)

        await this.adminService.executeRaw(`
          CREATE TABLE IF NOT EXISTS event_registrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id INT NOT NULL,
            member_id INT NOT NULL,
            status VARCHAR(20) DEFAULT 'registered',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_event_member (event_id, member_id),
            INDEX idx_event_id (event_id),
            INDEX idx_member_id (member_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `)
        results.push('活动报名表结构已统一')
      } catch (e: any) {
        results.push('活动报名表迁移失败: ' + e.message)
      }

      return {
        code: 200,
        msg: '迁移完成',
        data: { success: true, results }
      }
    } catch (err: any) {
      console.error('[AdminController] migrate error:', err)
      return { code: 500, msg: '迁移失败: ' + err.message, data: { results } }
    }
  }

  /** 检查数据库状态 */
  @Get('db-status')
  async checkDbStatus() {
    console.log('[AdminController] GET /api/admin/db-status')
    try {
      const { queryRows } = await import('@/storage/database/mysql-client')
      
      // 检查各个表是否存在
      const tables = ['users', 'roles', 'admins', 'members', 'events', 'mall_orders']
      const tableStatus: any = {}
      
      for (const table of tables) {
        try {
          const result = await queryRows(`SELECT COUNT(*) as count FROM ${table}`)
          tableStatus[table] = { exists: true, count: result[0]?.count || 0 }
        } catch (e: any) {
          tableStatus[table] = { exists: false, error: e.message }
        }
      }
      
      return { code: 200, msg: '数据库状态', data: tableStatus }
    } catch (err: any) {
      return { code: 500, msg: '检查失败: ' + err.message }
    }
  }

  /** 登录 */
  @Post('login')
  @Public()
  async login(@Body() body: { username: string; password: string }) {
    console.log('[AdminController] POST /api/admin/login - username:', body.username)
    const result = await this.adminService.login(body.username, body.password)
    return { code: 200, msg: '登录成功', data: result }
  }

  /** ====== 数据看板 ====== */
  @Get('dashboard')
  async getDashboard() {
    console.log('[AdminController] GET /api/admin/dashboard')
    const result = await this.adminService.getDashboardStats()
    return { code: 200, msg: 'success', data: result }
  }

  /** ====== Banner 管理 ====== */
  @Get('banners')
  async getBanners() {
    console.log('[AdminController] GET /api/admin/banners')
    const result = await this.adminService.getBanners()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('banners')
  async createBanner(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/banners')
    const result = await this.adminService.createBanner(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('banners/:id')
  async updateBanner(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/banners/:id')
    const result = await this.adminService.updateBanner(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('banners/:id')
  async deleteBanner(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/banners/:id')
    const result = await this.adminService.deleteBanner(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 会员管理 ====== */
  @Get('members')
  async getMembers(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/members')
    const result = await this.adminService.getAllMembers(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('members/pending')
  async getPendingMembers(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/members/pending')
    const result = await this.adminService.getPendingMembers(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('members/:id/approve')
  async approveMember(@Param('id') id: string, @Body() body: { approved_by: string }) {
    console.log('[AdminController] POST /api/admin/members/:id/approve')
    const result = await this.adminService.approveMember(id, body.approved_by)
    return { code: 200, msg: '审批成功', data: result }
  }

  @Post('members/:id/reject')
  async rejectMember(@Param('id') id: string, @Body() body: { reason: string }) {
    console.log('[AdminController] POST /api/admin/members/:id/reject')
    const result = await this.adminService.rejectMember(id, body.reason)
    return { code: 200, msg: '已拒绝', data: result }
  }

  /** ====== 活动管理 ====== */
  @Get('events')
  async getEvents(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/events')
    const result = await this.adminService.getAllEvents(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('events')
  async createEvent(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/events')
    const result = await this.adminService.createEvent(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/events/:id')
    const result = await this.adminService.deleteEvent(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 项目管理 ====== */
  @Get('projects')
  async getProjects(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/projects')
    const result = await this.adminService.getAllProjects(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('projects')
  async createProject(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/projects')
    const result = await this.adminService.createProject(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Delete('projects/:id')
  async deleteProject(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/projects/:id')
    const result = await this.adminService.deleteProject(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 商城管理 ====== */
  @Get('mall-products')
  async getMallProducts() {
    console.log('[AdminController] GET /api/admin/mall-products')
    const result = await this.adminService.getMallProducts()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('mall-products')
  async createMallProduct(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/mall-products')
    const result = await this.adminService.createMallProduct(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('mall-products/:id')
  async updateMallProduct(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/mall-products/:id')
    const result = await this.adminService.updateMallProduct(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('mall-products/:id')
  async deleteMallProduct(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/mall-products/:id')
    const result = await this.adminService.deleteMallProduct(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 成交管理 ====== */
  @Get('transactions')
  async getTransactions(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/transactions')
    const result = await this.adminService.getAllTransactions(query)
    return { code: 200, msg: 'success', data: result }
  }

  /** ====== 通知推送 ====== */
  @Post('notifications/broadcast')
  async broadcastNotification(@Body() dto: { title: string; content: string }) {
    console.log('[AdminController] POST /api/admin/notifications/broadcast')
    const result = await this.adminService.broadcastNotification(dto)
    return { code: 200, msg: '推送成功', data: result }
  }

  /** ====== 组织架构 ====== */
  @Get('organizations')
  async getOrganizations() {
    console.log('[AdminController] GET /api/admin/organizations')
    const result = await this.adminService.getOrganizations()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('organizations')
  async createOrganization(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/organizations')
    const result = await this.adminService.createOrganization(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  /** ====== 系统配置 ====== */
  @Get('configs')
  async getConfigs() {
    console.log('[AdminController] GET /api/admin/configs')
    const result = await this.adminService.getConfigs()
    return { code: 200, msg: 'success', data: result }
  }

  @Put('configs')
  async updateConfig(@Body() body: { key: string; value: string }) {
    console.log('[AdminController] PUT /api/admin/configs')
    const result = await this.adminService.updateConfig(body.key, body.value)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 文章管理 ====== */
  @Get('articles')
  async getArticles(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/articles')
    const result = await this.adminService.getAllArticles(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('articles')
  async createArticle(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/articles')
    const result = await this.adminService.createArticle(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('articles/:id')
  async updateArticle(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/articles/:id')
    const result = await this.adminService.updateArticle(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('articles/:id')
  async deleteArticle(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/articles/:id')
    const result = await this.adminService.deleteArticle(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  @Post('articles/:id/publish')
  async publishArticle(@Param('id') id: string) {
    console.log('[AdminController] POST /api/admin/articles/:id/publish')
    const result = await this.adminService.publishArticle(id)
    return { code: 200, msg: '发布成功', data: result }
  }

  /** ====== 管理员账号管理 ====== */
  @Get('admins')
  async getAdmins() {
    console.log('[AdminController] GET /api/admin/admins')
    const result = await this.adminService.getAdmins()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('admins')
  async createAdmin(@Body() dto: { login_account: string; phone?: string; password: string; name: string; remark?: string; role_id: number; status?: string; created_by?: number }) {
    console.log('[AdminController] POST /api/admin/admins')
    const result = await this.adminService.createAdmin(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('admins/:id')
  async updateAdmin(@Param('id') id: string, @Body() dto: { login_account?: string; phone?: string; name?: string; remark?: string; role_id?: number; status?: string; password?: string }) {
    console.log('[AdminController] PUT /api/admin/admins/:id')
    const result = await this.adminService.updateAdmin(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('admins/:id')
  async deleteAdmin(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/admins/:id')
    const result = await this.adminService.deleteAdmin(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  @Post('admins/:id/change-password')
  async changeAdminPassword(@Param('id') id: string, @Body() body: { new_password: string }) {
    console.log('[AdminController] POST /api/admin/admins/:id/change-password')
    const result = await this.adminService.changeAdminPassword(id, body.new_password)
    return { code: 200, msg: '密码修改成功', data: result }
  }

  @Post('admins/:id/reset-password')
  async resetAdminPassword(@Param('id') id: string, @Body() body: { new_password: string }) {
    console.log('[AdminController] POST /api/admin/admins/:id/reset-password')
    const result = await this.adminService.changeAdminPassword(id, body.new_password)
    return { code: 200, msg: '密码重置成功', data: result }
  }

  /** ====== 角色管理 ====== */
  @Get('roles')
  async getRoles() {
    console.log('[AdminController] GET /api/admin/roles')
    const result = await this.adminService.getRoles()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('roles')
  async createRole(@Body() dto: { name: string; display_name: string; description?: string; permissions?: string[] }) {
    console.log('[AdminController] POST /api/admin/roles')
    const result = await this.adminService.createRole(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('roles/:id')
  async updateRole(@Param('id') id: string, @Body() dto: { name?: string; display_name?: string; description?: string; permissions?: Record<string, any> }) {
    console.log('[AdminController] PUT /api/admin/roles/:id')
    const result = await this.adminService.updateRole(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 会员等级管理 ====== */
  @Get('member-levels')
  async getMemberLevels() {
    console.log('[AdminController] GET /api/admin/member-levels')
    const result = await this.adminService.getMemberLevels()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('member-levels')
  async createMemberLevel(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/member-levels')
    const result = await this.adminService.createMemberLevel(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('member-levels/:id')
  async updateMemberLevel(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/member-levels/:id')
    const result = await this.adminService.updateMemberLevel(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('member-levels/:id')
  async deleteMemberLevel(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/member-levels/:id')
    const result = await this.adminService.deleteMemberLevel(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 邀请奖励规则管理 ====== */
  @Get('invitation-rules')
  async getInvitationRewardRules() {
    console.log('[AdminController] GET /api/admin/invitation-rules')
    const result = await this.adminService.getInvitationRewardRules()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('invitation-rules')
  async createInvitationRewardRule(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/invitation-rules')
    const result = await this.adminService.createInvitationRewardRule(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('invitation-rules/:id')
  async updateInvitationRewardRule(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/invitation-rules/:id')
    const result = await this.adminService.updateInvitationRewardRule(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 积分规则管理 ====== */
  @Get('points-rules')
  async getPointsRules() {
    console.log('[AdminController] GET /api/admin/points-rules')
    const result = await this.adminService.getPointsRules()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('points-rules')
  async createPointsRule(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/points-rules')
    const result = await this.adminService.createPointsRule(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('points-rules/:id')
  async updatePointsRule(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/points-rules/:id')
    const result = await this.adminService.updatePointsRule(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 贡献值规则管理 ====== */
  @Get('contribution-rules')
  async getContributionRules() {
    console.log('[AdminController] GET /api/admin/contribution-rules')
    const result = await this.adminService.getContributionRules()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('contribution-rules')
  async createContributionRule(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/contribution-rules')
    const result = await this.adminService.createContributionRule(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('contribution-rules/:id')
  async updateContributionRule(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/contribution-rules/:id')
    const result = await this.adminService.updateContributionRule(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 部门管理 ====== */
  @Get('departments')
  async getDepartments() {
    console.log('[AdminController] GET /api/admin/departments')
    const result = await this.adminService.getDepartments()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('departments')
  async createDepartment(@Body() dto: { name: string; parent_id?: number; manager_id?: number; sort_order?: number; description?: string }) {
    console.log('[AdminController] POST /api/admin/departments')
    const result = await this.adminService.createDepartment(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('departments/:id')
  async updateDepartment(@Param('id') id: string, @Body() dto: { name?: string; manager_id?: number; sort_order?: number; status?: string; description?: string }) {
    console.log('[AdminController] PUT /api/admin/departments/:id')
    const result = await this.adminService.updateDepartment(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('departments/:id')
  async deleteDepartment(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/departments/:id')
    const result = await this.adminService.deleteDepartment(id)
    return { code: 200, msg: '删除成功', data: result }
  }

}
