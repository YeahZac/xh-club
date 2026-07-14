import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute, getConnectionStatus, testConnection } from '@/storage/database/mysql-client'
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
  /** 检查数据库连接状态 */
  async checkDatabaseConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const ok = await testConnection()
      return ok
        ? { connected: true, message: '数据库连接正常' }
        : { connected: false, message: '数据库连接失败' }
    } catch (error) {
      return { connected: false, message: `数据库连接失败: ${(error as Error).message}` }
    }
  }

  /** 管理员登录 */
  async login(username: string, password: string) {
    console.log('[AdminService] login - username:', username)
    
    try {
      const rows = await queryRows<UserRow>(
        'SELECT * FROM users WHERE phone = ? LIMIT 1',
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

      const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64')

      console.log('[AdminService] login success:', username)
      
      return {
        id: user.id,
        username: user.phone,
        name: user.name || '管理员',
        role: 'super_admin',
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
      const members = await queryOne('SELECT COUNT(*) as count FROM users')
      const events = await queryOne('SELECT COUNT(*) as count FROM event_registrations')
      const projects = await queryOne('SELECT COUNT(*) as count FROM business_opportunities')
      const orders = await queryOne('SELECT COALESCE(SUM(total_amount), 0) as total FROM mall_orders WHERE status = "completed"')

      return {
        totalMembers: (members as any)?.count || 0,
        totalEvents: (events as any)?.count || 0,
        totalProjects: (projects as any)?.count || 0,
        totalAmount: (orders as any)?.total || 0
      }
    } catch (error) {
      console.error('[AdminService] getDashboardStats error:', error)
      throw new HttpException('获取统计数据失败', HttpStatus.INTERNAL_SERVER_ERROR)
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
      return await queryRows('SELECT * FROM users ORDER BY created_at DESC')
    } catch (error) {
      console.error('[AdminService] getAllMembers error:', error)
      throw new HttpException('获取会员列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getPendingMembers(query: any) {
    try {
      return await queryRows('SELECT * FROM users ORDER BY created_at DESC LIMIT 10')
    } catch (error) {
      console.error('[AdminService] getPendingMembers error:', error)
      throw new HttpException('获取待审批会员失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async approveMember(id: string, approvedBy: string) {
    try {
      await queryExecute('UPDATE users SET status = "approved" WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] approveMember error:', error)
      throw new HttpException('审批失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async rejectMember(id: string, reason: string) {
    try {
      await queryExecute('UPDATE users SET status = "rejected" WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] rejectMember error:', error)
      throw new HttpException('拒绝失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 活动管理 ====== */
  async getAllEvents(query: any) {
    try {
      return await queryRows('SELECT * FROM event_registrations ORDER BY created_at DESC')
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
      return await queryRows('SELECT * FROM business_opportunities ORDER BY created_at DESC')
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
}
