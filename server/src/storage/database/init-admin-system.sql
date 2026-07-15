-- ============================================
-- 管理员与权限系统
-- ============================================

-- 角色表
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称: super_admin/admin',
  `display_name` VARCHAR(100) NOT NULL COMMENT '显示名称',
  `description` TEXT COMMENT '角色描述',
  `permissions` JSON COMMENT '权限列表',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 管理员表（扩展现有users表）
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT '关联users表ID',
  `role_id` INT NOT NULL DEFAULT 2 COMMENT '角色ID',
  `status` ENUM('active', 'inactive', 'locked') DEFAULT 'active' COMMENT '状态',
  `last_login_at` TIMESTAMP NULL COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(45) COMMENT '最后登录IP',
  `login_attempts` INT DEFAULT 0 COMMENT '登录尝试次数',
  `locked_until` TIMESTAMP NULL COMMENT '锁定截止时间',
  `created_by` INT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- 操作日志表
CREATE TABLE IF NOT EXISTS `admin_operation_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` INT NOT NULL COMMENT '管理员ID',
  `action` VARCHAR(100) NOT NULL COMMENT '操作类型',
  `target_type` VARCHAR(50) COMMENT '目标类型: member/article/product等',
  `target_id` INT COMMENT '目标ID',
  `details` JSON COMMENT '操作详情',
  `ip_address` VARCHAR(45) COMMENT 'IP地址',
  `user_agent` TEXT COMMENT '用户代理',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  INDEX `idx_admin_id` (`admin_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员操作日志';

-- ============================================
-- 会员等级体系
-- ============================================

-- 会员等级配置表
CREATE TABLE IF NOT EXISTS `member_levels` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `level_code` VARCHAR(20) NOT NULL UNIQUE COMMENT '等级代码: normal/silver/gold/diamond',
  `level_name` VARCHAR(50) NOT NULL COMMENT '等级名称',
  `level_icon` VARCHAR(255) COMMENT '等级图标URL',
  `min_contribution` INT DEFAULT 0 COMMENT '所需最低贡献值',
  `min_points` INT DEFAULT 0 COMMENT '所需最低积分',
  `discount_rate` DECIMAL(3,2) DEFAULT 1.00 COMMENT '商城折扣率',
  `points_multiplier` DECIMAL(3,2) DEFAULT 1.00 COMMENT '积分倍率',
  `benefits` JSON COMMENT '等级权益配置',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员等级配置';

-- 会员等级变更记录
CREATE TABLE IF NOT EXISTS `member_level_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL COMMENT '会员ID',
  `old_level` VARCHAR(20) COMMENT '原等级',
  `new_level` VARCHAR(20) NOT NULL COMMENT '新等级',
  `reason` VARCHAR(255) COMMENT '变更原因',
  `changed_by` INT COMMENT '操作人ID（管理员或系统）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员等级变更记录';

-- ============================================
-- 邀请奖励机制
-- ============================================

-- 邀请奖励规则表
CREATE TABLE IF NOT EXISTS `invitation_reward_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `rule_type` ENUM('direct', 'indirect', 'level_up', 'purchase') NOT NULL COMMENT '规则类型',
  `reward_type` ENUM('points', 'contribution', 'both') NOT NULL COMMENT '奖励类型',
  `reward_value` INT NOT NULL COMMENT '奖励数值',
  `conditions` JSON COMMENT '触发条件',
  `max_rewards` INT DEFAULT -1 COMMENT '最大奖励次数，-1为不限',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  `start_date` TIMESTAMP NULL COMMENT '活动开始时间',
  `end_date` TIMESTAMP NULL COMMENT '活动结束时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请奖励规则';

-- 邀请记录表
CREATE TABLE IF NOT EXISTS `invitation_records` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `inviter_id` INT NOT NULL COMMENT '邀请人ID',
  `invitee_id` INT NOT NULL COMMENT '被邀请人ID',
  `invitation_code` VARCHAR(20) COMMENT '邀请码',
  `status` ENUM('pending', 'accepted', 'rewarded', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  `reward_points` INT DEFAULT 0 COMMENT '奖励积分',
  `reward_contribution` INT DEFAULT 0 COMMENT '奖励贡献值',
  `accepted_at` TIMESTAMP NULL COMMENT '接受时间',
  `rewarded_at` TIMESTAMP NULL COMMENT '奖励发放时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`inviter_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`invitee_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  INDEX `idx_inviter_id` (`inviter_id`),
  INDEX `idx_invitee_id` (`invitee_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请记录';

-- 邀请奖励发放记录
CREATE TABLE IF NOT EXISTS `invitation_rewards` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL COMMENT '邀请记录ID',
  `member_id` INT NOT NULL COMMENT '获得奖励的会员ID',
  `reward_type` ENUM('points', 'contribution') NOT NULL COMMENT '奖励类型',
  `reward_value` INT NOT NULL COMMENT '奖励数值',
  `rule_id` INT COMMENT '触发的规则ID',
  `description` VARCHAR(255) COMMENT '奖励描述',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`record_id`) REFERENCES `invitation_records`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请奖励发放记录';

-- ============================================
-- 积分规则配置
-- ============================================

-- 积分规则表
CREATE TABLE IF NOT EXISTS `points_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `action_type` VARCHAR(50) NOT NULL COMMENT '触发动作: login/checkin/purchase/invite等',
  `points_value` INT NOT NULL COMMENT '积分值',
  `conditions` JSON COMMENT '触发条件',
  `daily_limit` INT DEFAULT -1 COMMENT '每日限制，-1为不限',
  `total_limit` INT DEFAULT -1 COMMENT '总限制，-1为不限',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  `priority` INT DEFAULT 0 COMMENT '优先级',
  `start_date` TIMESTAMP NULL COMMENT '生效开始时间',
  `end_date` TIMESTAMP NULL COMMENT '生效结束时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分规则';

-- 积分发放记录
CREATE TABLE IF NOT EXISTS `points_grants` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL COMMENT '会员ID',
  `rule_id` INT COMMENT '触发的规则ID',
  `points` INT NOT NULL COMMENT '积分值',
  `balance_before` INT NOT NULL COMMENT '变更前余额',
  `balance_after` INT NOT NULL COMMENT '变更后余额',
  `action_type` VARCHAR(50) NOT NULL COMMENT '动作类型',
  `description` VARCHAR(255) COMMENT '描述',
  `reference_type` VARCHAR(50) COMMENT '关联类型',
  `reference_id` INT COMMENT '关联ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_action_type` (`action_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分发放记录';

-- ============================================
-- 贡献值计算规则
-- ============================================

-- 贡献值规则表
CREATE TABLE IF NOT EXISTS `contribution_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `action_type` VARCHAR(50) NOT NULL COMMENT '触发动作: purchase/invite/active等',
  `contribution_value` INT NOT NULL COMMENT '贡献值',
  `conditions` JSON COMMENT '触发条件',
  `calculation_method` ENUM('fixed', 'percentage', 'formula') DEFAULT 'fixed' COMMENT '计算方式',
  `formula` TEXT COMMENT '计算公式（当calculation_method为formula时）',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  `priority` INT DEFAULT 0 COMMENT '优先级',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='贡献值规则';

-- 贡献值变更记录
CREATE TABLE IF NOT EXISTS `contribution_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL COMMENT '会员ID',
  `rule_id` INT COMMENT '触发的规则ID',
  `contribution` INT NOT NULL COMMENT '贡献值变化',
  `balance_before` INT NOT NULL COMMENT '变更前余额',
  `balance_after` INT NOT NULL COMMENT '变更后余额',
  `action_type` VARCHAR(50) NOT NULL COMMENT '动作类型',
  `description` VARCHAR(255) COMMENT '描述',
  `reference_type` VARCHAR(50) COMMENT '关联类型',
  `reference_id` INT COMMENT '关联ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_action_type` (`action_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='贡献值变更记录';

-- ============================================
-- 部门/组织架构管理
-- ============================================

-- 部门表
CREATE TABLE IF NOT EXISTS `departments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL COMMENT '部门名称',
  `parent_id` INT DEFAULT NULL COMMENT '父部门ID',
  `level` INT DEFAULT 1 COMMENT '层级',
  `path` VARCHAR(500) COMMENT '路径，如 /1/2/3/',
  `manager_id` INT COMMENT '部门负责人ID',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  `description` TEXT COMMENT '部门描述',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL,
  INDEX `idx_parent_id` (`parent_id`),
  INDEX `idx_path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';

-- 会员部门关联表
CREATE TABLE IF NOT EXISTS `member_departments` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL COMMENT '会员ID',
  `department_id` INT NOT NULL COMMENT '部门ID',
  `position` VARCHAR(100) COMMENT '职位',
  `is_primary` BOOLEAN DEFAULT FALSE COMMENT '是否主部门',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_member_department` (`member_id`, `department_id`),
  INDEX `idx_department_id` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员部门关联';

-- ============================================
-- 初始化数据
-- ============================================

-- 插入默认角色
INSERT INTO `roles` (`name`, `display_name`, `description`, `permissions`) VALUES
('super_admin', '超级管理员', '拥有所有权限', '["*"]'),
('admin', '普通管理员', '拥有基础管理权限', '["members:read", "articles:read", "articles:write", "events:read"]');

-- 插入默认会员等级
INSERT INTO `member_levels` (`level_code`, `level_name`, `min_contribution`, `discount_rate`, `points_multiplier`, `benefits`, `sort_order`) VALUES
('normal', '普通会员', 0, 1.00, 1.00, '{"basic": true}', 1),
('silver', '银卡会员', 100, 0.98, 1.20, '{"basic": true, "discount": true}', 2),
('gold', '金卡会员', 500, 0.95, 1.50, '{"basic": true, "discount": true, "priority": true}', 3),
('diamond', '钻石会员', 2000, 0.90, 2.00, '{"basic": true, "discount": true, "priority": true, "exclusive": true}', 4);

-- 插入默认积分规则
INSERT INTO `points_rules` (`rule_name`, `action_type`, `points_value`, `daily_limit`, `description`) VALUES
('每日登录', 'login', 5, 1, '每日登录奖励5积分'),
('每日签到', 'checkin', 10, 1, '每日签到奖励10积分'),
('邀请好友注册', 'invite_register', 50, -1, '成功邀请好友注册奖励50积分'),
('购买商品', 'purchase', 100, -1, '购买商品每消费10元奖励10积分');

-- 插入默认贡献值规则
INSERT INTO `contribution_rules` (`rule_name`, `action_type`, `contribution_value`, `calculation_method`) VALUES
('购买商品', 'purchase', 10, 'percentage'),
('邀请好友', 'invite', 50, 'fixed'),
('参与活动', 'event_participate', 30, 'fixed'),
('发布内容', 'content_publish', 20, 'fixed');

-- 插入默认邀请奖励规则
INSERT INTO `invitation_reward_rules` (`rule_name`, `rule_type`, `reward_type`, `reward_value`) VALUES
('邀请注册奖励', 'direct', 'both', 100),
('被邀请人消费奖励', 'purchase', 'points', 50);
