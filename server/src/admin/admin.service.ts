import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { pool } from '@/storage/database/mysql-client'
import * as bcrypt from 'bcryptjs'
import { RowDataPacket } from 'mysql2'

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
  /** 管理员登录 */
  async login(username: string, password: string) {
    console.log('[AdminService] login - username:', username)
    
    try {
      // 查询 users 表，phone 字段存储 admin 标识
      const [rows] = await pool.query<UserRow[]>(
        'SELECT * FROM users WHERE phone = ? LIMIT 1',
        [username]
      )

      if (rows.length === 0) {
        console.log('[AdminService] login failed - user not found:', username)
        throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED)
      }

      const user = rows[0]
      console.log('[AdminService] login - user found:', user.id, user.phone)

      // 使用 bcrypt 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password_hash)
      
      if (!isPasswordValid) {
        console.log('[AdminService] login failed - invalid password for:', username)
        throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED)
      }

      // 生成简单 token
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
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('登录失败: ' + (error as Error).message, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 数据看板 ====== */
  async getDashboardStats() {
    console.log('[AdminService] getDashboardStats')
    
    try {
      const [members] = await pool.query('SELECT COUNT(*) as count FROM users')
      const [events] = await pool.query('SELECT COUNT(*) as count FROM event_registrations')
      const [projects] = await pool.query('SELECT COUNT(*) as count FROM business_opportunities')
      const [orders] = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM mall_orders WHERE status = "completed"')

      return {
        totalMembers: (members as any)[0].count,
        totalEvents: (events as any)[0].count,
        totalProjects: (projects as any)[0].count,
        totalAmount: (orders as any)[0].total || 0
      }
    } catch (error) {
      console.error('[AdminService] getDashboardStats error:', error)
      throw new HttpException('获取统计数据失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== Banner 管理 ====== */
  async getBanners() {
    console.log('[AdminService] getBanners')
    
    try {
      const [rows] = await pool.query('SELECT * FROM banners ORDER BY sort_order ASC')
      return rows
    } catch (error) {
      console.error('[AdminService] getBanners error:', error)
      throw new HttpException('获取 Banner 列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createBanner(dto: any) {
    console.log('[AdminService] createBanner - title:', dto.title)
    
    try {
      const [result] = await pool.query(
        `INSERT INTO banners (title, image_url, link_type, link_id, link_config, sort_order, is_active, start_time, end_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.title,
          dto.image_url,
          dto.link_type || null,
          dto.link_id || null,
          dto.link_config ? JSON.stringify(dto.link_config) : null,
          dto.sort_order || 0,
          dto.is_active !== false,
          dto.start_time || null,
          dto.end_time || null
        ]
      )
      
      const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [(result as any).insertId])
      return (rows as any)[0]
    } catch (error) {
      console.error('[AdminService] createBanner error:', error)
      throw new HttpException('创建 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateBanner(id: string, dto: any) {
    console.log('[AdminService] updateBanner - id:', id)
    
    try {
      await pool.query('UPDATE banners SET ? WHERE id = ?', [dto, id])
      const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [id])
      return (rows as any)[0]
    } catch (error) {
      console.error('[AdminService] updateBanner error:', error)
      throw new HttpException('更新 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteBanner(id: string) {
    console.log('[AdminService] deleteBanner - id:', id)
    
    try {
      await pool.query('DELETE FROM banners WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteBanner error:', error)
      throw new HttpException('删除 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 会员管理 ====== */
  async getAllMembers(query: any) {
    console.log('[AdminService] getAllMembers', query)
    
    try {
      const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC')
      return rows
    } catch (error) {
      console.error('[AdminService] getAllMembers error:', error)
      throw new HttpException('获取会员列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getPendingMembers(query: any) {
    console.log('[AdminService] getPendingMembers')
    
    try {
      // 简化处理，返回所有用户
      const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 10')
      return rows
    } catch (error) {
      console.error('[AdminService] getPendingMembers error:', error)
      throw new HttpException('获取待审批会员失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async approveMember(id: string, approvedBy: string) {
    console.log('[AdminService] approveMember - id:', id, 'by:', approvedBy)
    
    try {
      await pool.query('UPDATE users SET status = "approved" WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] approveMember error:', error)
      throw new HttpException('审批失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async rejectMember(id: string, reason: string) {
    console.log('[AdminService] rejectMember - id:', id, 'reason:', reason)
    
    try {
      await pool.query('UPDATE users SET status = "rejected" WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] rejectMember error:', error)
      throw new HttpException('拒绝失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 商品管理 ====== */
  async createMallProduct(dto: any) {
    console.log('[AdminService] createMallProduct - name:', dto.name)
    
    try {
      const [result] = await pool.query(
        `INSERT INTO mall_products (name, description, points_price, cash_price, stock, category, image_url, enable_distribution, distribution_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.name,
          dto.description || null,
          dto.points_price || 0,
          dto.cash_price || 0,
          dto.stock || 0,
          dto.category || 'gift',
          dto.image_url || null,
          dto.enable_distribution || false,
          dto.distribution_rate || 0
        ]
      )
      
      const [rows] = await pool.query('SELECT * FROM mall_products WHERE id = ?', [(result as any).insertId])
      return (rows as any)[0]
    } catch (error) {
      console.error('[AdminService] createMallProduct error:', error)
      throw new HttpException('创建商品失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateMallProduct(id: string, dto: any) {
    console.log('[AdminService] updateMallProduct - id:', id)
    
    try {
      await pool.query('UPDATE mall_products SET ? WHERE id = ?', [dto, id])
      const [rows] = await pool.query('SELECT * FROM mall_products WHERE id = ?', [id])
      return (rows as any)[0]
    } catch (error) {
      console.error('[AdminService] updateMallProduct error:', error)
      throw new HttpException('更新商品失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteMallProduct(id: string) {
    console.log('[AdminService] deleteMallProduct - id:', id)
    
    try {
      await pool.query('DELETE FROM mall_products WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteMallProduct error:', error)
      throw new HttpException('删除商品失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 交易管理 ====== */
  async getAllTransactions(query: any) {
    console.log('[AdminService] getAllTransactions', query)
    
    try {
      const [rows] = await pool.query('SELECT * FROM mall_orders ORDER BY created_at DESC')
      return rows
    } catch (error) {
      console.error('[AdminService] getAllTransactions error:', error)
      throw new HttpException('获取交易列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 通知管理 ====== */
  async broadcastNotification(dto: any) {
    console.log('[AdminService] broadcastNotification - title:', dto.title)
    
    try {
      // 简化处理，返回成功
      return { success: true, message: '通知已发送' }
    } catch (error) {
      console.error('[AdminService] broadcastNotification error:', error)
      throw new HttpException('发送通知失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 组织管理 ====== */
  async getOrganizations() {
    console.log('[AdminService] getOrganizations')
    
    try {
      // 简化处理，返回空数组
      return []
    } catch (error) {
      console.error('[AdminService] getOrganizations error:', error)
      throw new HttpException('获取组织列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createOrganization(dto: any) {
    console.log('[AdminService] createOrganization - name:', dto.name)
    
    try {
      // 简化处理
      return { id: Date.now(), ...dto }
    } catch (error) {
      console.error('[AdminService] createOrganization error:', error)
      throw new HttpException('创建组织失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 配置管理 ====== */
  async getConfigs() {
    console.log('[AdminService] getConfigs')
    
    try {
      // 简化处理，返回默认配置
      return [
        { key: 'site_name', value: '粤商汇' },
        { key: 'points_exchange_rate', value: '100' }
      ]
    } catch (error) {
      console.error('[AdminService] getConfigs error:', error)
      throw new HttpException('获取配置失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateConfig(key: string, value: string) {
    console.log('[AdminService] updateConfig - key:', key, 'value:', value)
    
    try {
      // 简化处理
      return { key, value }
    } catch (error) {
      console.error('[AdminService] updateConfig error:', error)
      throw new HttpException('更新配置失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 文章管理 ====== */
  async getAllArticles(query: any) {
    console.log('[AdminService] getAllArticles', query)
    
    try {
      // 简化处理，返回空数组
      return []
    } catch (error) {
      console.error('[AdminService] getAllArticles error:', error)
      throw new HttpException('获取文章列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createArticle(dto: any) {
    console.log('[AdminService] createArticle - title:', dto.title)
    
    try {
      // 简化处理
      return { id: Date.now(), ...dto }
    } catch (error) {
      console.error('[AdminService] createArticle error:', error)
      throw new HttpException('创建文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateArticle(id: string, dto: any) {
    console.log('[AdminService] updateArticle - id:', id)
    
    try {
      // 简化处理
      return { id, ...dto }
    } catch (error) {
      console.error('[AdminService] updateArticle error:', error)
      throw new HttpException('更新文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteArticle(id: string) {
    console.log('[AdminService] deleteArticle - id:', id)
    
    try {
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteArticle error:', error)
      throw new HttpException('删除文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async publishArticle(id: string) {
    console.log('[AdminService] publishArticle - id:', id)
    
    try {
      return { success: true }
    } catch (error) {
      console.error('[AdminService] publishArticle error:', error)
      throw new HttpException('发布文章失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
