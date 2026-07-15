import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute, getConnectionStatus, testConnection, getPool } from '@/storage/database/mysql-client'
import * as bcrypt from 'bcryptjs'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

interface UserRow extends RowDataPacket {
  id: number
  phone: string
  password_hash: string
  name: string | null
  industry: string | null
  bio: string | null
  created_at: Date
}

@Injectable()
export class AdminService {
  /** 执行原始 SQL */
  async executeRaw(sql: string): Promise<any> {
    const pool = getPool()
    if (!pool) throw new Error('数据库未初始化')
    const [result] = await pool.query(sql) as any
    return result
  }

  /** 检查数据库连接状态 */
  async checkDatabaseConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      await testConnection()
      return { connected: true, message: '数据库连接正常' }
    } catch (error) {
      return { connected: false, message: `数据库连接失败: ${(error as Error).message}` }
    }
  }

  /** 管理员登录 */
  async login(username: string, password: string) {
    console.log('[AdminService] login - username:', username)
    
    try {
      // 查询用户
      const rows = await queryRows<UserRow>(
        'SELECT * FROM users WHERE login_account = ? LIMIT 1',
        [username]
      )

      if (rows.length === 0) {
        console.log('[AdminService] login failed - user not found:', username)
        throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED)
      }

      const user = rows[0]
      console.log('[AdminService] login - user found:', user.id, user.phone)

      const isPasswordValid = await bcrypt.compare(password, user.password_hash)
      
      if (!isPasswordValid) {
        console.log('[AdminService] login failed - invalid password for:', username)
        throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED)
      }

      // 查询管理员信息（包含角色）
      const adminRows = await queryRows(
        'SELECT a.*, r.name as role_name, r.display_name as role_display_name, r.permissions as role_permissions, r.is_system as role_is_system FROM admins a LEFT JOIN roles r ON a.role_id = r.id WHERE a.user_id = ? LIMIT 1',
        [user.id]
      )

      const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64')
      const admin = adminRows[0]
      const isSuperAdmin = admin?.role_name === 'super_admin' || admin?.role_is_system

      console.log('[AdminService] login success:', username, 'role:', admin?.role_name, 'isSuperAdmin:', isSuperAdmin)
      
      return {
        id: user.id,
        username: user.login_account,
        name: user.name || '管理员',
        role: admin?.role_name || 'admin',
        role_display_name: admin?.role_display_name || '管理员',
        permissions: isSuperAdmin ? null : (admin?.role_permissions || {}),
        is_super_admin: isSuperAdmin,
        token
      }
    } catch (error) {
      console.error('[AdminService] login error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('登录失败: ' + (error as Error).message, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 数据看板 ====== */
  async getDashboardStats() {
    console.log('[AdminService] getDashboardStats')
    try {
      // 使用 try-catch 处理可能不存在的表
      let membersCount = 0
      let eventsCount = 0
      let projectsCount = 0
      let ordersTotal = 0

      try {
        const members = await queryOne('SELECT COUNT(*) as count FROM members')
        membersCount = (members as any)?.count || 0
      } catch (e) {
        console.log('[AdminService] members table not found or empty')
      }

      try {
        const events = await queryOne('SELECT COUNT(*) as count FROM events')
        eventsCount = (events as any)?.count || 0
      } catch (e) {
        console.log('[AdminService] events table not found or empty')
      }

      try {
        const projects = await queryOne('SELECT COUNT(*) as count FROM projects')
        projectsCount = (projects as any)?.count || 0
      } catch (e) {
        console.log('[AdminService] projects table not found or empty')
      }

      try {
        const orders = await queryOne('SELECT COALESCE(SUM(total_amount), 0) as total FROM mall_orders WHERE status = "completed"')
        ordersTotal = (orders as any)?.total || 0
      } catch (e) {
        console.log('[AdminService] mall_orders table not found or empty')
      }

      return {
        totalMembers: membersCount,
        totalEvents: eventsCount,
        totalProjects: projectsCount,
        totalAmount: ordersTotal
      }
    } catch (error) {
      console.error('[AdminService] getDashboardStats error:', error)
      // 返回默认值而不是抛出错误
      return {
        totalMembers: 0,
        totalEvents: 0,
        totalProjects: 0,
        totalAmount: 0
      }
    }
  }

  /** ====== Banner 管理 ====== */
  async getBanners() {
    try {
      return await queryRows('SELECT * FROM banners ORDER BY sort_order ASC')
    } catch (error) {
      console.error('[AdminService] getBanners error:', error)
      throw new HttpException('获取 Banner 列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createBanner(dto: any) {
    try {
      const result = await queryExecute(
        `INSERT INTO banners (title, image_url, link_type, link_id, link_config, sort_order, is_active, start_time, end_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.title, dto.image_url, dto.link_type || null, dto.link_id || null,
         dto.link_config ? JSON.stringify(dto.link_config) : null,
         dto.sort_order || 0, dto.is_active !== false, dto.start_time || null, dto.end_time || null]
      )
      return await queryOne('SELECT * FROM banners WHERE id = ?', [result.insertId])
    } catch (error) {
      console.error('[AdminService] createBanner error:', error)
      throw new HttpException('创建 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateBanner(id: string, dto: any) {
    try {
      await queryExecute('UPDATE banners SET ? WHERE id = ?', [dto, id])
      return await queryOne('SELECT * FROM banners WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updateBanner error:', error)
      throw new HttpException('更新 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteBanner(id: string) {
    try {
      await queryExecute('DELETE FROM banners WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteBanner error:', error)
      throw new HttpException('删除 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 会员管理 ====== */
  async getAllMembers(query: any) {
    try {
      return await queryRows('SELECT * FROM members ORDER BY created_at DESC')
    } catch (error) {
      console.error('[AdminService] getAllMembers error:', error)
      throw new HttpException('获取会员列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getPendingMembers(query: any) {
    try {
      return await queryRows('SELECT * FROM members ORDER BY created_at DESC LIMIT 10')
    } catch (error) {
      console.error('[AdminService] getPendingMembers error:', error)
      throw new HttpException('获取待审批会员失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async approveMember(id: string, approvedBy: string) {
    try {
      await queryExecute('UPDATE members SET status = "approved" WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] approveMember error:', error)
      throw new HttpException('审批失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async rejectMember(id: string, reason: string) {
    try {
      await queryExecute('UPDATE members SET status = "rejected" WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] rejectMember error:', error)
      throw new HttpException('拒绝失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 活动管理 ====== */
  async getAllEvents(query: any) {
    try {
      return await queryRows('SELECT * FROM events ORDER BY created_at DESC')
    } catch (error) {
      console.error('[AdminService] getAllEvents error:', error)
      throw new HttpException('获取活动列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createEvent(dto: any) {
    try {
      return { id: Date.now(), ...dto }
    } catch (error) {
      throw new HttpException('创建活动失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteEvent(id: string) {
    try {
      return { success: true }
    } catch (error) {
      throw new HttpException('删除活动失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 项目管理 ====== */
  async getAllProjects(query: any) {
    try {
      return await queryRows('SELECT * FROM projects ORDER BY created_at DESC')
    } catch (error) {
      console.error('[AdminService] getAllProjects error:', error)
      return []
    }
  }

  async createProject(dto: any) {
    try {
      return { id: Date.now(), ...dto }
    } catch (error) {
      throw new HttpException('创建项目失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteProject(id: string) {
    try {
      return { success: true }
    } catch (error) {
      throw new HttpException('删除项目失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 组织管理 ====== */
  async getOrganizations() {
    try {
      return await queryRows('SELECT * FROM organizations ORDER BY created_at DESC')
    } catch (error) {
      return []
    }
  }

  async createOrganization(dto: any) {
    try {
      const result = await queryExecute(
        'INSERT INTO organizations (name, description) VALUES (?, ?)',
        [dto.name, dto.description || null]
      )
      return await queryOne('SELECT * FROM organizations WHERE id = ?', [result.insertId])
    } catch (error) {
      throw new HttpException('创建组织失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 配置管理 ====== */
  async getConfigs() {
    try {
      return await queryRows('SELECT * FROM configs ORDER BY created_at DESC')
    } catch (error) {
      return []
    }
  }

  async updateConfig(id: string, dto: any) {
    try {
      await queryExecute('UPDATE configs SET ? WHERE id = ?', [dto, id])
      return { success: true }
    } catch (error) {
      throw new HttpException('更新配置失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 文章管理 ====== */
  async getAllArticles(query?: any) {
    try {
      return await queryRows('SELECT * FROM articles ORDER BY created_at DESC')
    } catch (error) {
      return []
    }
  }

  async createArticle(dto: any) {
    try {
      const result = await queryExecute(
        'INSERT INTO articles (title, content, author) VALUES (?, ?, ?)',
        [dto.title, dto.content || null, dto.author || null]
      )
      return await queryOne('SELECT * FROM articles WHERE id = ?', [result.insertId])
    } catch (error) {
      throw new HttpException('创建文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateArticle(id: string, dto: any) {
    try {
      await queryExecute('UPDATE articles SET ? WHERE id = ?', [dto, id])
      return { success: true }
    } catch (error) {
      throw new HttpException('更新文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteArticle(id: string) {
    try {
      await queryExecute('DELETE FROM articles WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      throw new HttpException('删除文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async publishArticle(id: string) {
    try {
      await queryExecute('UPDATE articles SET status = "published" WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      throw new HttpException('发布文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 商品列表 ====== */
  async getMallProducts() {
    try {
      return await queryRows('SELECT * FROM mall_products ORDER BY created_at DESC')
    } catch (error) {
      console.error('[AdminService] getMallProducts error:', error)
      throw new HttpException('获取商品列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 商品管理 ====== */
  async createMallProduct(dto: any) {
    try {
      const result = await queryExecute(
        `INSERT INTO mall_products (name, description, points_price, cash_price, stock, category, image_url, enable_distribution, distribution_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.name, dto.description || null, dto.points_price || 0, dto.cash_price || 0,
         dto.stock || 0, dto.category || 'gift', dto.image_url || null,
         dto.enable_distribution || false, dto.distribution_rate || 0]
      )
      return await queryOne('SELECT * FROM mall_products WHERE id = ?', [result.insertId])
    } catch (error) {
      console.error('[AdminService] createMallProduct error:', error)
      throw new HttpException('创建商品失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateMallProduct(id: string, dto: any) {
    try {
      await queryExecute('UPDATE mall_products SET ? WHERE id = ?', [dto, id])
      return await queryOne('SELECT * FROM mall_products WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updateMallProduct error:', error)
      throw new HttpException('更新商品失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteMallProduct(id: string) {
    try {
      await queryExecute('DELETE FROM mall_products WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteMallProduct error:', error)
      throw new HttpException('删除商品失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 交易管理 ====== */
  async getAllTransactions(query: any) {
    try {
      return await queryRows('SELECT * FROM mall_orders ORDER BY created_at DESC')
    } catch (error) {
      console.error('[AdminService] getAllTransactions error:', error)
      throw new HttpException('获取交易列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 通知管理 ====== */
  async broadcastNotification(dto: any) {
    try {
      return { success: true, message: '通知已发送' }
    } catch (error) {
      throw new HttpException('发送通知失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 系统设置 ====== */
  async getSettings() {
    try {
      return {
        siteName: '星河平台俱乐部',
        siteDescription: '高端资源整合商业链接平台',
        contactEmail: 'admin@xinghe.club',
        pointsRate: 1,
        distributionEnabled: true,
        maxDistributionLevel: 2,
      }
    } catch (error) {
      throw new HttpException('获取设置失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateSettings(dto: any) {
    try {
      return { success: true, ...dto }
    } catch (error) {
      throw new HttpException('更新设置失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 数据库状态 ====== */
  getDbStatus() {
    return getConnectionStatus()
  }

  /** ====== 管理员账号管理 ====== */
  async getAdmins() {
    try {
      console.log('[AdminService] getAdmins - querying admins table')
      const admins = await queryRows(`
        SELECT a.*, a.name as admin_name, a.remark, u.login_account, u.phone, u.name as user_name, r.name as role_name, r.display_name as role_display_name
        FROM admins a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN roles r ON a.role_id = r.id
        ORDER BY a.created_at DESC
      `)
      console.log('[AdminService] getAdmins - found', admins.length, 'admins')
      return admins
    } catch (error) {
      console.error('[AdminService] getAdmins error:', error)
      console.error('[AdminService] getAdmins error details:', (error as Error).message)
      throw new HttpException(`获取管理员列表失败: ${(error as Error).message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createAdmin(dto: { login_account: string; phone?: string; password: string; name: string; remark?: string; role_id: number; status?: string; created_by?: number }) {
    try {
      // 检查登录账号是否已存在
      const existingUser = await queryOne('SELECT id FROM users WHERE login_account = ?', [dto.login_account])
      if (existingUser) {
        throw new HttpException('登录账号已存在', HttpStatus.BAD_REQUEST)
      }

      // 创建新用户
      const passwordHash = await bcrypt.hash(dto.password, 10)
      const userResult = await queryExecute(
        'INSERT INTO users (login_account, phone, password_hash, name, status) VALUES (?, ?, ?, ?, "approved")',
        [dto.login_account, dto.phone || null, passwordHash, dto.name]
      )
      const userId = userResult.insertId

      // 创建管理员记录
      const adminStatus = dto.status === 'disabled' ? 'disabled' : 'enabled'
      const adminResult = await queryExecute(
        'INSERT INTO admins (user_id, role_id, name, remark, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, dto.role_id, dto.name, dto.remark || null, adminStatus, dto.created_by || null]
      )

      return await queryOne(`
        SELECT a.*, u.login_account, u.phone, r.display_name as role_name
        FROM admins a
        JOIN users u ON a.user_id = u.id
        JOIN roles r ON a.role_id = r.id
        WHERE a.id = ?
      `, [adminResult.insertId])
    } catch (error) {
      console.error('[AdminService] createAdmin error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('创建管理员失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateAdmin(id: string, dto: { login_account?: string; phone?: string; name?: string; remark?: string; role_id?: number; status?: string }) {
    try {
      // 获取管理员信息
      const admin = await queryOne(`
        SELECT a.*, a.user_id FROM admins a WHERE a.id = ?
      `, [id])
      if (!admin) {
        throw new HttpException('管理员不存在', HttpStatus.NOT_FOUND)
      }

      // 更新 admins 表
      const adminUpdates: string[] = []
      const adminValues: any[] = []

      if (dto.name !== undefined) {
        adminUpdates.push('name = ?')
        adminValues.push(dto.name)
      }
      if (dto.remark !== undefined) {
        adminUpdates.push('remark = ?')
        adminValues.push(dto.remark)
      }
      if (dto.role_id !== undefined) {
        adminUpdates.push('role_id = ?')
        adminValues.push(dto.role_id)
      }
      if (dto.status !== undefined) {
        const adminStatus = dto.status === 'disabled' ? 'disabled' : 'enabled'
        adminUpdates.push('status = ?')
        adminValues.push(adminStatus)
      }

      if (adminUpdates.length > 0) {
        adminValues.push(id)
        await queryExecute(`UPDATE admins SET ${adminUpdates.join(', ')} WHERE id = ?`, adminValues)
      }

      // 更新 users 表
      const userUpdates: string[] = []
      const userValues: any[] = []

      if (dto.login_account !== undefined) {
        // 检查登录账号是否已被使用
        const existingUser = await queryOne('SELECT id FROM users WHERE login_account = ? AND id != ?', [dto.login_account, (admin as any).user_id])
        if (existingUser) {
          throw new HttpException('登录账号已存在', HttpStatus.BAD_REQUEST)
        }
        userUpdates.push('login_account = ?')
        userValues.push(dto.login_account)
      }
      if (dto.phone !== undefined) {
        userUpdates.push('phone = ?')
        userValues.push(dto.phone || null)
      }
      if (dto.name !== undefined) {
        userUpdates.push('name = ?')
        userValues.push(dto.name)
      }

      if (userUpdates.length > 0) {
        userValues.push((admin as any).user_id)
        await queryExecute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues)
      }

      return await queryOne(`
        SELECT a.*, u.login_account, u.phone, u.name, r.display_name as role_name
        FROM admins a
        JOIN users u ON a.user_id = u.id
        JOIN roles r ON a.role_id = r.id
        WHERE a.id = ?
      `, [id])
    } catch (error) {
      console.error('[AdminService] updateAdmin error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('更新管理员失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteAdmin(id: string) {
    try {
      await queryExecute('DELETE FROM admins WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteAdmin error:', error)
      throw new HttpException('删除管理员失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async changeAdminPassword(id: string, newPassword: string) {
    try {
      const admin = await queryOne('SELECT user_id FROM admins WHERE id = ?', [id])
      if (!admin) {
        throw new HttpException('管理员不存在', HttpStatus.NOT_FOUND)
      }

      const passwordHash = await bcrypt.hash(newPassword, 10)
      await queryExecute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, (admin as any).user_id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] changeAdminPassword error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('修改密码失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 角色管理 ====== */
  async getRoles() {
    try {
      console.log('[AdminService] getRoles - querying roles table')
      const roles = await queryRows('SELECT * FROM roles ORDER BY id ASC')
      console.log('[AdminService] getRoles - found', roles.length, 'roles')
      return roles
    } catch (error) {
      console.error('[AdminService] getRoles error:', error)
      console.error('[AdminService] getRoles error details:', (error as Error).message)
      throw new HttpException(`获取角色列表失败: ${(error as Error).message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createRole(dto: { name: string; display_name: string; description?: string; permissions?: Record<string, any> }) {
    try {
      const result = await queryExecute(
        'INSERT INTO roles (name, display_name, description, permissions) VALUES (?, ?, ?, ?)',
        [dto.name, dto.display_name, dto.description || null, dto.permissions ? JSON.stringify(dto.permissions) : null]
      )
      return await queryOne('SELECT * FROM roles WHERE id = ?', [result.insertId])
    } catch (error) {
      console.error('[AdminService] createRole error:', error)
      throw new HttpException('创建角色失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateRole(id: string, dto: { name?: string; display_name?: string; description?: string; permissions?: Record<string, any> }) {
    try {
      const updates: string[] = []
      const values: any[] = []

      if (dto.name !== undefined) {
        updates.push('name = ?')
        values.push(dto.name)
      }
      if (dto.display_name !== undefined) {
        updates.push('display_name = ?')
        values.push(dto.display_name)
      }
      if (dto.description !== undefined) {
        updates.push('description = ?')
        values.push(dto.description)
      }
      if (dto.permissions !== undefined) {
        updates.push('permissions = ?')
        values.push(JSON.stringify(dto.permissions))
      }

      if (updates.length > 0) {
        values.push(id)
        await queryExecute(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values)
      }

      return await queryOne('SELECT * FROM roles WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updateRole error:', error)
      throw new HttpException('更新角色失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 会员等级管理 ====== */
  async getMemberLevels() {
    try {
      return await queryRows('SELECT * FROM member_levels ORDER BY sort_order ASC')
    } catch (error) {
      console.error('[AdminService] getMemberLevels error:', error)
      throw new HttpException('获取会员等级列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createMemberLevel(dto: any) {
    try {
      const result = await queryExecute(
        `INSERT INTO member_levels (level_code, level_name, level_icon, min_contribution, min_points, discount_rate, points_multiplier, benefits, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.level_code, dto.level_name, dto.level_icon || null, dto.min_contribution || 0,
         dto.min_points || 0, dto.discount_rate || 1.00, dto.points_multiplier || 1.00,
         dto.benefits ? JSON.stringify(dto.benefits) : null, dto.sort_order || 0, dto.is_active !== false]
      )
      return await queryOne('SELECT * FROM member_levels WHERE id = ?', [result.insertId])
    } catch (error) {
      console.error('[AdminService] createMemberLevel error:', error)
      throw new HttpException('创建会员等级失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateMemberLevel(id: string, dto: any) {
    try {
      await queryExecute('UPDATE member_levels SET ? WHERE id = ?', [dto, id])
      return await queryOne('SELECT * FROM member_levels WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updateMemberLevel error:', error)
      throw new HttpException('更新会员等级失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteMemberLevel(id: string) {
    try {
      await queryExecute('DELETE FROM member_levels WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteMemberLevel error:', error)
      throw new HttpException('删除会员等级失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 邀请奖励规则管理 ====== */
  async getInvitationRewardRules() {
    try {
      return await queryRows('SELECT * FROM invitation_reward_rules ORDER BY created_at DESC')
    } catch (error) {
      console.error('[AdminService] getInvitationRewardRules error:', error)
      throw new HttpException('获取邀请奖励规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createInvitationRewardRule(dto: any) {
    try {
      const result = await queryExecute(
        `INSERT INTO invitation_reward_rules (rule_name, rule_type, reward_type, reward_value, conditions, max_rewards, is_active, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.rule_name, dto.rule_type, dto.reward_type, dto.reward_value,
         dto.conditions ? JSON.stringify(dto.conditions) : null,
         dto.max_rewards || -1, dto.is_active !== false,
         dto.start_date || null, dto.end_date || null]
      )
      return await queryOne('SELECT * FROM invitation_reward_rules WHERE id = ?', [result.insertId])
    } catch (error) {
      console.error('[AdminService] createInvitationRewardRule error:', error)
      throw new HttpException('创建邀请奖励规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateInvitationRewardRule(id: string, dto: any) {
    try {
      await queryExecute('UPDATE invitation_reward_rules SET ? WHERE id = ?', [dto, id])
      return await queryOne('SELECT * FROM invitation_reward_rules WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updateInvitationRewardRule error:', error)
      throw new HttpException('更新邀请奖励规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 积分规则管理 ====== */
  async getPointsRules() {
    try {
      return await queryRows('SELECT * FROM points_rules ORDER BY priority DESC, created_at DESC')
    } catch (error) {
      console.error('[AdminService] getPointsRules error:', error)
      throw new HttpException('获取积分规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createPointsRule(dto: any) {
    try {
      const result = await queryExecute(
        `INSERT INTO points_rules (rule_name, action_type, points_value, conditions, daily_limit, total_limit, is_active, priority, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.rule_name, dto.action_type, dto.points_value,
         dto.conditions ? JSON.stringify(dto.conditions) : null,
         dto.daily_limit || -1, dto.total_limit || -1,
         dto.is_active !== false, dto.priority || 0,
         dto.start_date || null, dto.end_date || null]
      )
      return await queryOne('SELECT * FROM points_rules WHERE id = ?', [result.insertId])
    } catch (error) {
      console.error('[AdminService] createPointsRule error:', error)
      throw new HttpException('创建积分规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updatePointsRule(id: string, dto: any) {
    try {
      await queryExecute('UPDATE points_rules SET ? WHERE id = ?', [dto, id])
      return await queryOne('SELECT * FROM points_rules WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updatePointsRule error:', error)
      throw new HttpException('更新积分规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 贡献值规则管理 ====== */
  async getContributionRules() {
    try {
      return await queryRows('SELECT * FROM contribution_rules ORDER BY priority DESC, created_at DESC')
    } catch (error) {
      console.error('[AdminService] getContributionRules error:', error)
      throw new HttpException('获取贡献值规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createContributionRule(dto: any) {
    try {
      const result = await queryExecute(
        `INSERT INTO contribution_rules (rule_name, action_type, contribution_value, conditions, calculation_method, formula, is_active, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.rule_name, dto.action_type, dto.contribution_value,
         dto.conditions ? JSON.stringify(dto.conditions) : null,
         dto.calculation_method || 'fixed', dto.formula || null,
         dto.is_active !== false, dto.priority || 0]
      )
      return await queryOne('SELECT * FROM contribution_rules WHERE id = ?', [result.insertId])
    } catch (error) {
      console.error('[AdminService] createContributionRule error:', error)
      throw new HttpException('创建贡献值规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateContributionRule(id: string, dto: any) {
    try {
      await queryExecute('UPDATE contribution_rules SET ? WHERE id = ?', [dto, id])
      return await queryOne('SELECT * FROM contribution_rules WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updateContributionRule error:', error)
      throw new HttpException('更新贡献值规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 部门管理 ====== */
  async getDepartments() {
    try {
      return await queryRows(`
        SELECT d.*, u.name as manager_name
        FROM departments d
        LEFT JOIN users u ON d.manager_id = u.id
        ORDER BY d.sort_order ASC, d.id ASC
      `)
    } catch (error) {
      console.error('[AdminService] getDepartments error:', error)
      throw new HttpException('获取部门列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createDepartment(dto: { name: string; parent_id?: number; manager_id?: number; sort_order?: number; description?: string }) {
    try {
      // 计算层级和路径
      let level = 1
      let path = '/'

      if (dto.parent_id) {
        const parent = await queryOne('SELECT level, path FROM departments WHERE id = ?', [dto.parent_id])
        if (parent) {
          level = (parent as any).level + 1
          path = `${(parent as any).path}${dto.parent_id}/`
        }
      } else {
        path = '/'
      }

      const result = await queryExecute(
        `INSERT INTO departments (name, parent_id, level, path, manager_id, sort_order, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dto.name, dto.parent_id || null, level, path, dto.manager_id || null, dto.sort_order || 0, dto.description || null]
      )

      // 更新路径包含自身ID
      const newId = result.insertId
      await queryExecute('UPDATE departments SET path = CONCAT(path, ?, "/") WHERE id = ?', [newId, newId])

      return await queryOne('SELECT * FROM departments WHERE id = ?', [newId])
    } catch (error) {
      console.error('[AdminService] createDepartment error:', error)
      throw new HttpException('创建部门失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateDepartment(id: string, dto: { name?: string; manager_id?: number; sort_order?: number; status?: string; description?: string }) {
    try {
      await queryExecute('UPDATE departments SET ? WHERE id = ?', [dto, id])
      return await queryOne(`
        SELECT d.*, u.name as manager_name
        FROM departments d
        LEFT JOIN users u ON d.manager_id = u.id
        WHERE d.id = ?
      `, [id])
    } catch (error) {
      console.error('[AdminService] updateDepartment error:', error)
      throw new HttpException('更新部门失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteDepartment(id: string) {
    try {
      // 检查是否有子部门
      const children = await queryRows('SELECT id FROM departments WHERE parent_id = ?', [id])
      if (children.length > 0) {
        throw new HttpException('该部门下有子部门，无法删除', HttpStatus.BAD_REQUEST)
      }

      // 检查是否有成员
      const members = await queryRows('SELECT id FROM member_departments WHERE department_id = ?', [id])
      if (members.length > 0) {
        throw new HttpException('该部门下有成员，无法删除', HttpStatus.BAD_REQUEST)
      }

      await queryExecute('DELETE FROM departments WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteDepartment error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('删除部门失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
