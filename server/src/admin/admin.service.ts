import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute, getConnectionStatus, testConnection, getPool, withTransaction } from '@/storage/database/mysql-client'
import { ensureSchemaColumns } from '@/storage/database/ensure-schema-columns'
import * as bcrypt from 'bcryptjs'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import { canonicalizeCloudStorageUrl, isCloudStorageUrl } from '@/utils/media-url'
import { parseJsonUrlList, serializeJsonUrlList } from '@/utils/media-json'
import { signAuthToken } from '@/auth/jwt'
import { UploadService } from '@/upload/upload.service'
import {
  formatInviteRuleRow,
  hasAnyInviteReward,
  inferLegacyRewardType,
  normalizeInviteConditions,
  normalizeInviteRewards,
} from '@/invitation/invitation-rule.util'
import {
  formatPointsRuleRow,
  normalizePointsRuleDto,
} from '@/points/points-rule.util'
import { createNotification } from '@/common/notify'
import { resolveEventStatus } from '@/common/event-status'
import { normalizeUserCategory, userCategoryLabel } from '@/common/user-category'
import { toDatetimeLocalValue, toMysqlDateTime } from '@/common/mysql-datetime'
import {
  normalizePromoCoopMode,
  promoCoopModeLabel,
} from '@/common/project-promo'
import {
  getMemberDashboardDetails,
  getMemberDashboardStats,
  type MemberStatsMetric,
} from '@/common/member-stats'

type RolePermissionMap = Record<string, Record<string, boolean>>

function parsePermissionsRaw(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw ?? {}
}

/** 统一角色权限：兼容历史 ["*"] / ["dashboard", ...] 与新版 { page: { view: true } } */
export function normalizeRolePermissions(raw: unknown): {
  isAll: boolean
  pages: RolePermissionMap
} {
  const perms = parsePermissionsRaw(raw)

  if (Array.isArray(perms)) {
    if (perms.includes('*')) {
      return { isAll: true, pages: {} }
    }
    const pages: RolePermissionMap = {}
    perms.forEach((key) => {
      if (typeof key === 'string' && key) {
        pages[key] = { view: true }
      }
    })
    return { isAll: false, pages }
  }

  if (perms && typeof perms === 'object') {
    const pages: RolePermissionMap = {}
    Object.entries(perms as Record<string, any>).forEach(([key, value]) => {
      if (value === true) {
        pages[key] = { view: true }
        return
      }
      if (value && typeof value === 'object') {
        pages[key] = { ...value }
      }
    })
    return { isAll: false, pages }
  }

  return { isAll: false, pages: {} }
}

interface UserRow extends RowDataPacket {
  id: number
  login_account: string
  phone: string | null
  password_hash: string
  name: string | null
  avatar: string | null
  industry: string | null
  bio: string | null
  status: string
  created_at: Date
}

const BANNER_UPDATE_FIELDS = [
  'title',
  'image_url',
  'link_type',
  'link_id',
  'link_config',
  'sort_order',
  'is_active',
  'start_time',
  'end_time',
] as const

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function assertCloudStorageImageUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!isCloudStorageUrl(url)) {
    throw new HttpException('封面图片为必填项，且必须使用微信云托管对象存储 URL', HttpStatus.BAD_REQUEST)
  }
  return canonicalizeCloudStorageUrl(url)
}

function normalizeOptionalVideoUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  const url = typeof value === 'string' ? value.trim() : ''
  if (!isCloudStorageUrl(url)) {
    throw new HttpException('视频必须使用微信云托管对象存储 URL', HttpStatus.BAD_REQUEST)
  }
  return canonicalizeCloudStorageUrl(url)
}

@Injectable()
export class AdminService {
  constructor(private readonly uploadService: UploadService) {}

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

      const admin = adminRows[0]
      const rolePerms = normalizeRolePermissions(admin?.role_permissions)
      const isSuperAdmin = admin?.role_name === 'super_admin' || rolePerms.isAll
      const token = signAuthToken({
        sub: String(user.id),
        type: 'admin',
        role: admin?.role_name || 'admin',
      })

      console.log('[AdminService] login success:', username, 'role:', admin?.role_name, 'isSuperAdmin:', isSuperAdmin)

      return {
        id: user.id,
        username: user.login_account,
        name: user.name || '管理员',
        role: admin?.role_name || 'admin',
        role_display_name: admin?.role_display_name || '管理员',
        permissions: isSuperAdmin ? null : rolePerms.pages,
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
  private async normalizeBannerRow(row: any) {
    if (!row) return row
    return {
      ...row,
      image_url: await this.uploadService.signMediaUrl(row.image_url),
      link_config: parseJsonObject(row.link_config),
    }
  }

  /** ====== Banner 管理 ====== */
  async getBanners() {
    try {
      const rows = await queryRows('SELECT * FROM banners ORDER BY sort_order ASC')
      return Promise.all(rows.map((row) => this.normalizeBannerRow(row)))
    } catch (error) {
      console.error('[AdminService] getBanners error:', error)
      throw new HttpException('获取 Banner 列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createBanner(dto: any) {
    try {
      const imageUrl = assertCloudStorageImageUrl(dto.image_url)
      const result = await queryExecute(
        `INSERT INTO banners (title, image_url, link_type, link_id, link_config, sort_order, is_active, start_time, end_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dto.title, imageUrl, dto.link_type || null, dto.link_id || null,
         dto.link_config ? JSON.stringify(dto.link_config) : null,
         dto.sort_order || 0, dto.is_active !== false, dto.start_time || null, dto.end_time || null]
      )
      return this.normalizeBannerRow(await queryOne('SELECT * FROM banners WHERE id = ?', [result.insertId]))
    } catch (error) {
      console.error('[AdminService] createBanner error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('创建 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateBanner(id: string, dto: any) {
    try {
      const updates: Record<string, unknown> = {}
      for (const field of BANNER_UPDATE_FIELDS) {
        if (dto[field] === undefined) continue
        if (field === 'image_url') {
          updates[field] = assertCloudStorageImageUrl(dto[field])
        } else if (field === 'link_config') {
          updates[field] = dto[field] ? JSON.stringify(dto[field]) : null
        } else {
          updates[field] = dto[field]
        }
      }
      if (Object.keys(updates).length === 0) {
        throw new HttpException('没有可更新的 Banner 字段', HttpStatus.BAD_REQUEST)
      }
      await queryExecute('UPDATE banners SET ? WHERE id = ?', [updates, id])
      return this.normalizeBannerRow(await queryOne('SELECT * FROM banners WHERE id = ?', [id]))
    } catch (error) {
      console.error('[AdminService] updateBanner error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('更新 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteBanner(id: string) {
    try {
      const result = await queryExecute('DELETE FROM banners WHERE id = ?', [id])
      const affected = Number((result as any)?.affectedRows ?? 0)
      if (!affected) {
        throw new HttpException('Banner 不存在', HttpStatus.NOT_FOUND)
      }
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteBanner error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('删除 Banner 失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 会员管理 ====== */
  async getAllMembers(query: any) {
    try {
      const rows = await queryRows('SELECT * FROM members ORDER BY created_at DESC')
      const signed = await this.uploadService.signRowsFields(rows || [], ['avatar'])
      return (signed || []).map((row: any) => ({
        ...row,
        user_category: normalizeUserCategory(row.user_category),
        user_category_label: userCategoryLabel(row.user_category),
      }))
    } catch (error) {
      console.error('[AdminService] getAllMembers error:', error)
      throw new HttpException('获取会员列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getMemberById(id: string) {
    try {
      const row = await queryOne('SELECT * FROM members WHERE id = ?', [id])
      if (!row) throw new HttpException('会员不存在', HttpStatus.NOT_FOUND)
      const signed = await this.uploadService.signRowFields(row, ['avatar'])
      const category = normalizeUserCategory(signed.user_category)
      const dashboard = await getMemberDashboardStats(id).catch(() => null)
      return {
        ...signed,
        user_category: category,
        user_category_label: userCategoryLabel(category),
        dashboard,
      }
    } catch (error) {
      console.error('[AdminService] getMemberById error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('获取会员详情失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** 管理台编辑会员基本信息 / 公司信息等 */
  async updateMember(id: string, dto: any) {
    const existing = await queryOne('SELECT * FROM members WHERE id = ?', [id])
    if (!existing) throw new HttpException('会员不存在', HttpStatus.NOT_FOUND)

    const updates: string[] = []
    const params: any[] = []
    const assign = (col: string, value: unknown) => {
      updates.push(`${col} = ?`)
      params.push(value)
    }
    const trimOrNull = (value: unknown) => {
      const text = String(value ?? '').trim()
      return text || null
    }

    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim()
      if (!name) throw new HttpException('姓名不能为空', HttpStatus.BAD_REQUEST)
      assign('name', name)
    }
    if (dto.phone !== undefined) {
      const phone = String(dto.phone || '').trim()
      if (!phone) throw new HttpException('手机号不能为空', HttpStatus.BAD_REQUEST)
      if (!/^1\d{10}$/.test(phone)) {
        throw new HttpException('手机号格式不正确', HttpStatus.BAD_REQUEST)
      }
      if (phone !== String(existing.phone || '')) {
        const dup = await queryOne(
          'SELECT id FROM members WHERE phone = ? AND id <> ? LIMIT 1',
          [phone, id],
        )
        if (dup) throw new HttpException('该手机号已被其他会员使用', HttpStatus.BAD_REQUEST)
      }
      assign('phone', phone)
    }
    if (dto.avatar !== undefined) {
      const raw = String(dto.avatar || '').trim()
      assign('avatar', raw ? canonicalizeCloudStorageUrl(raw) || raw : null)
    }
    if (dto.gender !== undefined) {
      const gender = String(dto.gender || '').trim()
      if (gender && !['male', 'female', 'unknown', '男', '女'].includes(gender)) {
        throw new HttpException('性别无效', HttpStatus.BAD_REQUEST)
      }
      assign('gender', gender || null)
    }
    if (dto.birthday !== undefined) {
      const birthday = String(dto.birthday || '').trim().slice(0, 10)
      assign('birthday', /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : null)
    }
    if (dto.company_name !== undefined) assign('company_name', trimOrNull(dto.company_name))
    if (dto.company_position !== undefined) assign('company_position', trimOrNull(dto.company_position))
    if (dto.industry_primary !== undefined) assign('industry_primary', trimOrNull(dto.industry_primary))
    if (dto.industry_secondary !== undefined) {
      assign('industry_secondary', trimOrNull(dto.industry_secondary))
    }
    if (dto.company_scale !== undefined) assign('company_scale', trimOrNull(dto.company_scale))
    if (dto.company_founded !== undefined) {
      const founded = String(dto.company_founded || '').trim().slice(0, 10)
      assign('company_founded', /^\d{4}-\d{2}-\d{2}$/.test(founded) ? founded : null)
    }
    if (dto.company_address !== undefined) assign('company_address', trimOrNull(dto.company_address))
    if (dto.company_website !== undefined) assign('company_website', trimOrNull(dto.company_website))
    if (dto.business_description !== undefined) {
      assign('business_description', trimOrNull(dto.business_description))
    }
    if (dto.core_advantage !== undefined) assign('core_advantage', trimOrNull(dto.core_advantage))
    if (dto.resources_supply !== undefined) assign('resources_supply', trimOrNull(dto.resources_supply))
    if (dto.resources_demand !== undefined) assign('resources_demand', trimOrNull(dto.resources_demand))
    if (dto.city !== undefined) assign('city', trimOrNull(dto.city))
    if (dto.wechat_id !== undefined) assign('wechat_id', trimOrNull(dto.wechat_id))
    if (dto.bio !== undefined) assign('bio', trimOrNull(dto.bio))
    if (dto.membership_level !== undefined) {
      const level = String(dto.membership_level || '').trim() || 'normal'
      if (!['normal', 'silver', 'gold', 'diamond'].includes(level)) {
        throw new HttpException('会员等级无效', HttpStatus.BAD_REQUEST)
      }
      assign('membership_level', level)
    }
    if (dto.user_category !== undefined) {
      assign('user_category', normalizeUserCategory(dto.user_category))
    }
    if (dto.status !== undefined) {
      const status = String(dto.status || '').trim()
      if (!['pending', 'active', 'approved', 'frozen', 'exited', 'rejected'].includes(status)) {
        throw new HttpException('会员状态无效', HttpStatus.BAD_REQUEST)
      }
      assign('status', status === 'approved' ? 'active' : status)
    }

    if (!updates.length) {
      throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    }

    params.push(id)
    await queryExecute(
      `UPDATE members SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params,
    )
    return this.getMemberById(id)
  }

  async getMemberDashboard(id: string) {
    const data = await getMemberDashboardStats(id)
    if (!data) throw new HttpException('会员不存在', HttpStatus.NOT_FOUND)
    if (data.member.avatar) {
      data.member.avatar = await this.uploadService.signMediaUrl(data.member.avatar)
    }
    return data
  }

  async getMemberDashboardMetric(id: string, metric: string) {
    const allowed: MemberStatsMetric[] = [
      'invites',
      'events',
      'projects',
      'demands',
      'shares',
      'deals',
      'points',
    ]
    if (!(allowed as string[]).includes(metric)) {
      throw new HttpException('不支持的明细类型', HttpStatus.BAD_REQUEST)
    }
    const member = await queryOne('SELECT id FROM members WHERE id = ?', [id])
    if (!member) throw new HttpException('会员不存在', HttpStatus.NOT_FOUND)
    const list = await getMemberDashboardDetails(id, metric as MemberStatsMetric)
    return { metric, list }
  }

  async getPendingMembers(query: any) {
    try {
      const rows = await queryRows('SELECT * FROM members ORDER BY created_at DESC LIMIT 10')
      return this.uploadService.signRowsFields(rows || [], ['avatar'])
    } catch (error) {
      console.error('[AdminService] getPendingMembers error:', error)
      throw new HttpException('获取待审批会员失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async approveMember(id: string, approvedBy: string) {
    try {
      // 与 STATUS_MAP / 业务查询统一为 active；历史数据可能仍是 approved
      await queryExecute('UPDATE members SET status = "active" WHERE id = ?', [id])
      await createNotification({
        memberId: id,
        type: 'approval',
        title: '会员审核通过',
        content: '您的会员资料已通过审核，可正常使用平台功能',
        link: '/pages/profile/index',
        bizType: 'member_audit',
        bizId: id,
        result: 'approved',
      })
      return { success: true }
    } catch (error) {
      console.error('[AdminService] approveMember error:', error)
      throw new HttpException('审批失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async rejectMember(id: string, reason: string) {
    try {
      await queryExecute('UPDATE members SET status = "rejected" WHERE id = ?', [id])
      await createNotification({
        memberId: id,
        type: 'approval',
        title: '会员审核未通过',
        content: `您的会员资料未通过审核${reason ? `：${reason}` : ''}`,
        link: '/pages/profile/index',
        bizType: 'member_audit',
        bizId: id,
        result: 'rejected',
      })
      return { success: true }
    } catch (error) {
      console.error('[AdminService] rejectMember error:', error)
      throw new HttpException('拒绝失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateMemberUserCategory(id: string, userCategory: string) {
    const category = normalizeUserCategory(userCategory)
    const existing = await queryOne('SELECT id FROM members WHERE id = ?', [id])
    if (!existing) throw new HttpException('会员不存在', HttpStatus.NOT_FOUND)
    await queryExecute(
      'UPDATE members SET user_category = ?, updated_at = NOW() WHERE id = ?',
      [category, id],
    )
    return {
      user_category: category,
      user_category_label: userCategoryLabel(category),
    }
  }

  /**
   * 测试/运维：彻底删除会员及其关联数据，避免残留外键导致小程序报错。
   * 需 body.confirm === 'DELETE' 二次确认。
   */
  async purgeMember(id: string, confirm?: string) {
    if (String(confirm || '').trim() !== 'DELETE') {
      throw new HttpException('请传 confirm=DELETE 以确认彻底删除', HttpStatus.BAD_REQUEST)
    }

    const memberId = Number(id)
    if (!Number.isFinite(memberId) || memberId <= 0) {
      throw new HttpException('无效的会员 ID', HttpStatus.BAD_REQUEST)
    }

    const member = await queryOne('SELECT id, name, phone, wx_openid FROM members WHERE id = ?', [memberId])
    if (!member) throw new HttpException('会员不存在', HttpStatus.NOT_FOUND)

    try {
    const deleted: Record<string, number> = {}

    const run = async (
      connection: import('mysql2/promise').PoolConnection,
      key: string,
      sql: string,
      params: any[] = [memberId],
    ) => {
      try {
        const [result] = (await connection.query(sql, params)) as [ResultSetHeader, any]
        const rows = Number(result?.affectedRows || 0)
        if (rows > 0) deleted[key] = (deleted[key] || 0) + rows
        return rows
      } catch (error: any) {
        // 1146 表不存在 / 1054 列不存在：兼容新旧库结构
        if (error?.errno === 1146 || error?.errno === 1054) return 0
        throw error
      }
    }

    await withTransaction(async (connection) => {
      // 先清理该会员发布的商机/项目的附属数据，再删主记录
      let ownedBusinesses: RowDataPacket[] = []
      try {
        const [rows] = await connection.query<RowDataPacket[]>(
          'SELECT id FROM business_opportunities WHERE user_id = ?',
          [memberId],
        )
        ownedBusinesses = rows || []
      } catch (error: any) {
        if (error?.errno !== 1146 && error?.errno !== 1054) throw error
      }
      const businessIds = ownedBusinesses.map((row) => Number(row.id)).filter((n) => n > 0)

      if (businessIds.length) {
        const placeholders = businessIds.map(() => '?').join(',')
        await run(connection, 'roadshow_scores', `DELETE FROM roadshow_scores WHERE business_id IN (${placeholders})`, businessIds)
        await run(connection, 'roadshow_registrations', `DELETE FROM roadshow_registrations WHERE business_id IN (${placeholders})`, businessIds)
        await run(connection, 'roadshow_score_dimensions', `DELETE FROM roadshow_score_dimensions WHERE business_id IN (${placeholders})`, businessIds)
        await run(connection, 'roadshow_projects', `DELETE FROM roadshow_projects WHERE business_id IN (${placeholders})`, businessIds)
        await run(connection, 'project_deal_applications', `DELETE FROM project_deal_applications WHERE business_id IN (${placeholders})`, businessIds)
        await run(connection, 'business_opportunities', `DELETE FROM business_opportunities WHERE id IN (${placeholders})`, businessIds)
      }

      let ownedProjects: RowDataPacket[] = []
      try {
        const [rows] = await connection.query<RowDataPacket[]>(
          'SELECT id FROM projects WHERE submitter_id = ?',
          [memberId],
        )
        ownedProjects = rows || []
      } catch (error: any) {
        if (error?.errno !== 1146 && error?.errno !== 1054) throw error
      }
      const projectIds = ownedProjects.map((row) => Number(row.id)).filter((n) => n > 0)

      if (projectIds.length) {
        const placeholders = projectIds.map(() => '?').join(',')
        await run(connection, 'project_scores', `DELETE FROM project_scores WHERE project_id IN (${placeholders})`, projectIds)
        await run(connection, 'project_score_dimensions', `DELETE FROM project_score_dimensions WHERE project_id IN (${placeholders})`, projectIds)
        await run(connection, 'roadshow_projects', `DELETE FROM roadshow_projects WHERE project_id IN (${placeholders})`, projectIds)
        await run(connection, 'roadshow_scores', `DELETE FROM roadshow_scores WHERE project_id IN (${placeholders})`, projectIds)
        await run(connection, 'project_deal_applications', `DELETE FROM project_deal_applications WHERE business_id IN (${placeholders})`, projectIds)
        await run(connection, 'projects', `DELETE FROM projects WHERE id IN (${placeholders})`, projectIds)
      }

      // 会员作为参与方的业务数据
      const directDeletes: Array<[string, string]> = [
        ['notifications', 'DELETE FROM notifications WHERE member_id = ?'],
        ['project_scores', 'DELETE FROM project_scores WHERE member_id = ?'],
        ['roadshow_scores', 'DELETE FROM roadshow_scores WHERE member_id = ?'],
        ['roadshow_registrations', 'DELETE FROM roadshow_registrations WHERE member_id = ?'],
        ['event_registrations', 'DELETE FROM event_registrations WHERE member_id = ?'],
        ['event_form_registrations', 'DELETE FROM event_form_registrations WHERE member_id = ?'],
        ['comments', 'DELETE FROM comments WHERE member_id = ?'],
        ['posts', 'DELETE FROM posts WHERE member_id = ?'],
        ['points_records', 'DELETE FROM points_records WHERE member_id = ?'],
        ['points_exchanges', 'DELETE FROM points_exchanges WHERE member_id = ?'],
        ['points_grants', 'DELETE FROM points_grants WHERE member_id = ?'],
        ['contribution_logs', 'DELETE FROM contribution_logs WHERE member_id = ?'],
        ['member_level_logs', 'DELETE FROM member_level_logs WHERE member_id = ?'],
        ['member_departments', 'DELETE FROM member_departments WHERE member_id = ?'],
        ['member_organizations', 'DELETE FROM member_organizations WHERE member_id = ?'],
        ['member_tags', 'DELETE FROM member_tags WHERE member_id = ?'],
        ['talent_applications', 'DELETE FROM talent_applications WHERE member_id = ?'],
        ['user_feedbacks', 'DELETE FROM user_feedbacks WHERE member_id = ?'],
        ['mall_orders', 'DELETE FROM mall_orders WHERE member_id = ?'],
        ['transactions', 'DELETE FROM transactions WHERE member_id = ?'],
        ['resources', 'DELETE FROM resources WHERE member_id = ?'],
        ['invitation_rewards', 'DELETE FROM invitation_rewards WHERE member_id = ?'],
        ['project_deal_applications', 'DELETE FROM project_deal_applications WHERE member_id = ? OR owner_member_id = ?'],
        ['invitation_records', 'DELETE FROM invitation_records WHERE inviter_id = ? OR invitee_id = ?'],
        ['member_invitations', 'DELETE FROM member_invitations WHERE inviter_id = ? OR registered_member_id = ?'],
        ['distribution_relations', 'DELETE FROM distribution_relations WHERE referrer_id = ? OR referee_id = ?'],
        ['distribution_earnings', 'DELETE FROM distribution_earnings WHERE user_id = ?'],
        ['distribution_earnings', 'DELETE FROM distribution_earnings WHERE member_id = ?'],
        ['distribution_earnings', 'DELETE FROM distribution_earnings WHERE from_member_id = ?'],
        ['messages', 'DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?'],
      ]

      for (const [key, sql] of directDeletes) {
        const needsTwoParams = sql.includes('OR')
        await run(connection, key, sql, needsTwoParams ? [memberId, memberId] : [memberId])
      }

      // 手机号关联的匿名报名（无 member_id）
      if (member.phone) {
        await run(
          connection,
          'event_form_registrations',
          'DELETE FROM event_form_registrations WHERE phone = ?',
          [member.phone],
        )
        await run(
          connection,
          'member_invitations',
          'DELETE FROM member_invitations WHERE phone = ?',
          [member.phone],
        )
      }

      // 断开别人指向该会员的引用，避免残留脏 ID
      await run(connection, 'members_referrer_cleared', 'UPDATE members SET referrer_id = NULL WHERE referrer_id = ?')
      await run(connection, 'mall_orders_referrer_cleared', 'UPDATE mall_orders SET referrer_id = NULL WHERE referrer_id = ?')
      await run(connection, 'projects_submitter_cleared', 'UPDATE projects SET submitter_id = NULL WHERE submitter_id = ?')
      await run(connection, 'business_user_cleared', 'UPDATE business_opportunities SET user_id = NULL WHERE user_id = ?')
      await run(
        connection,
        'deal_owner_cleared',
        'UPDATE project_deal_applications SET owner_member_id = NULL WHERE owner_member_id = ?',
      )
      await run(
        connection,
        'member_invitations_registered_cleared',
        'UPDATE member_invitations SET registered_member_id = NULL WHERE registered_member_id = ?',
      )

      await run(connection, 'members', 'DELETE FROM members WHERE id = ?')
    })

    return {
      success: true,
      member: {
        id: member.id,
        name: member.name || '',
        phone: member.phone || '',
      },
      deleted,
    }
  } catch (error) {
    console.error('[AdminService] purgeMember error:', error)
    if (error instanceof HttpException) throw error
    throw new HttpException(
      String((error as any)?.message || '彻底删除会员失败'),
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
  }

  /** ====== 活动管理 ====== */
  private parseJsonValue(value: unknown): unknown {
    if (value == null) return null
    if (typeof value === 'object') return value
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  private formatDateTimeToMinute(value: unknown): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
  }

  private toDatetimeLocalValue(value: unknown): string {
    return toDatetimeLocalValue(value)
  }

  private normalizeFormFields(value: unknown): unknown[] | null {
    if (value == null || value === '') return null
    const parsed = this.parseJsonValue(value)
    return Array.isArray(parsed) ? parsed : null
  }

  private normalizeFormAnswers(value: unknown): Record<string, unknown> {
    const parsed = this.parseJsonValue(value)
    if (!parsed) return {}
    if (Array.isArray(parsed)) {
      const mapped: Record<string, unknown> = {}
      parsed.forEach((item) => {
        if (!item || typeof item !== 'object') return
        const row = item as Record<string, unknown>
        const label = String(row.label || row.name || '').trim()
        if (!label) return
        mapped[label] = row.value ?? ''
      })
      return mapped
    }
    if (typeof parsed === 'object') return parsed as Record<string, unknown>
    return {}
  }

  private async syncEventRuntimeStatus(row: any) {
    if (!row || String(row.status) === 'draft') return row
    const next = resolveEventStatus({
      status: row.status,
      start_time: row.start_time,
      end_time: row.end_time,
      max_participants: row.max_participants,
      current_participants: row.current_participants,
    })
    if (String(row.status) !== next) {
      try {
        await queryExecute(
          `UPDATE events SET status = ? WHERE id = ? AND status <> 'draft'`,
          [next, row.id],
        )
      } catch (error) {
        console.warn('[AdminService] syncEventRuntimeStatus failed', error)
      }
      return { ...row, status: next }
    }
    return { ...row, status: next }
  }

  private resolvePersistedEventStatus(dto: any, currentParticipants = 0) {
    if (String(dto?.status || '') === 'draft') return 'draft'
    return resolveEventStatus({
      status: 'open',
      start_time: toMysqlDateTime(dto?.start_time) ?? dto?.start_time,
      end_time: toMysqlDateTime(dto?.end_time) ?? dto?.end_time,
      max_participants: dto?.max_participants,
      current_participants: currentParticipants,
    })
  }

  async getAllEvents(query: any) {
    try {
      let sql = 'SELECT * FROM events'
      const params: any[] = []
      if (query?.status) {
        sql += ' WHERE status = ?'
        params.push(query.status)
      }
      sql += ' ORDER BY updated_at DESC, created_at DESC'
      const rows = (await queryRows(sql, params)) as any[]
      const synced: any[] = []
      for (const row of rows) {
        const next: any = await this.syncEventRuntimeStatus(row)
        synced.push(next)
      }
      // 若按状态筛选，同步后可能状态已变，再过滤一次
      const filtered: any[] = query?.status
        ? synced.filter((row: any) => String(row.status) === String(query.status))
        : synced
      return this.uploadService.signRowsFields(filtered, ['cover_image', 'video_url'])
    } catch (error) {
      console.error('[AdminService] getAllEvents error:', error)
      throw new HttpException('获取活动列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getEventById(id: string) {
    try {
      const row = await queryOne('SELECT * FROM events WHERE id = ?', [id])
      if (!row) throw new HttpException('活动不存在', HttpStatus.NOT_FOUND)
      const synced = await this.syncEventRuntimeStatus(row)
      const signed = await this.uploadService.signDetailMediaFields(
        synced,
        ['cover_image', 'video_url'],
        ['description', 'content'],
      )
      return {
        ...signed,
        form_fields: this.normalizeFormFields(synced.form_fields),
        start_time_local: this.toDatetimeLocalValue(synced.start_time),
        end_time_local: this.toDatetimeLocalValue(synced.end_time),
        runtime_status: resolveEventStatus(synced),
      }
    } catch (error) {
      console.error('[AdminService] getEventById error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('获取活动详情失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createEvent(dto: any) {
    try {
      const coverImage = assertCloudStorageImageUrl(dto.cover_image)
      const videoUrl = normalizeOptionalVideoUrl(dto.video_url)
      const formFieldsJson =
        dto.form_fields == null
          ? null
          : typeof dto.form_fields === 'string'
            ? dto.form_fields
            : JSON.stringify(dto.form_fields)
      const status = this.resolvePersistedEventStatus(dto, 0)
      const result = await queryExecute(
        `INSERT INTO events (title, description, cover_image, video_url, event_type, status, start_time, end_time, location, address, max_participants, fee, form_fields, is_featured, sort_order, admin_operated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [dto.title, dto.description || null, coverImage, videoUrl, dto.event_type || 'salon',
         status, toMysqlDateTime(dto.start_time), toMysqlDateTime(dto.end_time),
         dto.location || null, dto.address || null,
         dto.max_participants == null ? 100 : Number(dto.max_participants) || 0,
         dto.fee || 0,
         formFieldsJson,
         dto.is_featured ? 1 : 0,
         Math.max(0, Number(dto.sort_order) || 0)]
      )
      const insertedId = result.insertId
      if (insertedId) {
        return await this.getEventById(String(insertedId))
      }
      const latest = await queryOne('SELECT * FROM events ORDER BY created_at DESC LIMIT 1')
      return latest ? await this.getEventById(String(latest.id)) : latest
    } catch (error) {
      console.error('[AdminService] createEvent error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('创建活动失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateEvent(id: string, dto: any) {
    try {
      const existing = await queryOne('SELECT * FROM events WHERE id = ?', [id])
      if (!existing) throw new HttpException('活动不存在', HttpStatus.NOT_FOUND)

      const updates: string[] = []
      const params: any[] = []
      const assign = (column: string, value: unknown) => {
        updates.push(`${column} = ?`)
        params.push(value)
      }

      if (dto.title !== undefined) assign('title', dto.title)
      if (dto.description !== undefined) assign('description', dto.description || null)
      if (dto.cover_image !== undefined) assign('cover_image', assertCloudStorageImageUrl(dto.cover_image))
      if (dto.video_url !== undefined) assign('video_url', normalizeOptionalVideoUrl(dto.video_url))
      if (dto.event_type !== undefined) assign('event_type', dto.event_type || 'salon')
      if (dto.start_time !== undefined) assign('start_time', toMysqlDateTime(dto.start_time))
      if (dto.end_time !== undefined) assign('end_time', toMysqlDateTime(dto.end_time))
      if (dto.location !== undefined) assign('location', dto.location || null)
      if (dto.address !== undefined) assign('address', dto.address || null)
      if (dto.max_participants !== undefined) {
        assign(
          'max_participants',
          dto.max_participants == null ? 100 : Number(dto.max_participants) || 0,
        )
      }
      if (dto.fee !== undefined) assign('fee', dto.fee || 0)
      if (dto.is_featured !== undefined) assign('is_featured', dto.is_featured ? 1 : 0)
      if (dto.sort_order !== undefined) assign('sort_order', Math.max(0, Number(dto.sort_order) || 0))
      if (dto.form_fields !== undefined) {
        const formFieldsJson =
          dto.form_fields == null
            ? null
            : typeof dto.form_fields === 'string'
              ? dto.form_fields
              : JSON.stringify(dto.form_fields)
        assign('form_fields', formFieldsJson)
      }

      const merged = {
        ...existing,
        ...dto,
        start_time: dto.start_time !== undefined ? toMysqlDateTime(dto.start_time) : existing.start_time,
        end_time: dto.end_time !== undefined ? toMysqlDateTime(dto.end_time) : existing.end_time,
        max_participants: dto.max_participants !== undefined ? dto.max_participants : existing.max_participants,
        status: dto.status !== undefined ? dto.status : existing.status,
      }
      assign(
        'status',
        this.resolvePersistedEventStatus(merged, Number(existing.current_participants) || 0),
      )

      if (!updates.length) {
        throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
      }

      updates.push('admin_operated_at = NOW()')
      params.push(id)
      await queryExecute(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`, params)
      return await this.getEventById(id)
    } catch (error) {
      console.error('[AdminService] updateEvent error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('更新活动失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getEventRegistrations(eventId: string) {
    try {
      const event = await queryOne('SELECT id, title, form_fields FROM events WHERE id = ?', [eventId])
      if (!event) throw new HttpException('活动不存在', HttpStatus.NOT_FOUND)

      const rows = await queryRows(
        `SELECT
           er.id,
           er.event_id,
           er.member_id,
           er.status,
           er.form_answers,
           er.created_at,
           m.name AS member_name,
           m.avatar AS member_avatar,
           m.phone AS member_phone,
           m.company_name AS member_company
         FROM event_registrations er
         LEFT JOIN members m ON m.id = er.member_id
         WHERE er.event_id = ?
         ORDER BY er.created_at DESC`,
        [eventId],
      )

      const formFields = this.normalizeFormFields(event.form_fields) || []
      const list = await this.uploadService.signRowsFields(
        rows.map((row) => {
          const answers = this.normalizeFormAnswers(row.form_answers)
          return {
            id: row.id,
            event_id: row.event_id,
            member_id: row.member_id,
            member_nickname: row.member_name || '-',
            member_name: row.member_name || '-',
            member_avatar: row.member_avatar || null,
            member_phone: row.member_phone || null,
            member_company: row.member_company || null,
            status: row.status,
            form_answers: answers,
            filled_at: this.formatDateTimeToMinute(row.created_at),
            created_at: row.created_at,
          }
        }),
        ['member_avatar'],
      )

      return {
        event: {
          id: event.id,
          title: event.title,
          form_fields: formFields,
        },
        total: list.length,
        list,
      }
    } catch (error) {
      console.error('[AdminService] getEventRegistrations error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('获取报名名单失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteEventRegistration(eventId: string, registrationId: string) {
    try {
      const row = await queryOne(
        'SELECT id, member_id FROM event_registrations WHERE id = ? AND event_id = ?',
        [registrationId, eventId],
      )
      if (!row) throw new HttpException('报名记录不存在', HttpStatus.NOT_FOUND)

      await queryExecute('DELETE FROM event_registrations WHERE id = ? AND event_id = ?', [
        registrationId,
        eventId,
      ])

      const countRow = await queryOne(
        'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?',
        [eventId],
      )
      const total = Number(countRow?.total || 0)
      const event = await queryOne(
        'SELECT id, status, start_time, end_time, max_participants FROM events WHERE id = ?',
        [eventId],
      )
      if (event) {
        const nextStatus =
          String(event.status) === 'draft'
            ? 'draft'
            : resolveEventStatus({
                status: 'open',
                start_time: event.start_time,
                end_time: event.end_time,
                max_participants: event.max_participants,
                current_participants: total,
              })
        await queryExecute(
          'UPDATE events SET current_participants = ?, status = ? WHERE id = ?',
          [total, nextStatus, eventId],
        )
      }

      return { success: true, current_participants: total }
    } catch (error) {
      console.error('[AdminService] deleteEventRegistration error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('删除报名失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteEvent(id: string) {
    try {
      try {
        await queryExecute(
          `DELETE FROM homepage_items WHERE section = 'events' AND item_id = ?`,
          [String(id)],
        )
      } catch {
        // 首页关联清理失败不阻断活动删除
      }
      try {
        await queryExecute('DELETE FROM event_registrations WHERE event_id = ?', [id])
      } catch {
        // 报名表可能不存在或结构不同，不影响活动删除
      }
      await queryExecute('DELETE FROM events WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteEvent error:', error)
      throw new HttpException('删除活动失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 项目管理 ====== */
  private normalizeScoreDimensions(input: unknown): Array<{ id?: number; name: string; sort_order: number }> {
    if (!Array.isArray(input)) return []
    return input
      .map((item, index) => ({
        id: item?.id != null && Number(item.id) > 0 ? Number(item.id) : undefined,
        name: String(item?.name || '').trim(),
        sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
      }))
      .filter((item) => item.name)
  }

  private async syncProjectScoreDimensions(
    projectId: string | number,
    dimensions: Array<{ id?: number; name: string; sort_order: number }>,
  ) {
    const existing = await queryRows(
      'SELECT id FROM project_score_dimensions WHERE project_id = ?',
      [projectId],
    )
    const keepIds = new Set<number>()
    for (const item of dimensions) {
      if (item.id) {
        const hit = existing.find((row: any) => Number(row.id) === Number(item.id))
        if (hit) {
          await queryExecute(
            'UPDATE project_score_dimensions SET name = ?, sort_order = ? WHERE id = ? AND project_id = ?',
            [item.name, item.sort_order, item.id, projectId],
          )
          keepIds.add(Number(item.id))
          continue
        }
      }
      const result = await queryExecute(
        `INSERT INTO project_score_dimensions (project_id, name, sort_order) VALUES (?, ?, ?)`,
        [projectId, item.name, item.sort_order],
      )
      keepIds.add(Number(result.insertId))
    }
    const removeIds = (existing || [])
      .map((row: any) => Number(row.id))
      .filter((id) => !keepIds.has(id))
    if (removeIds.length) {
      const placeholders = removeIds.map(() => '?').join(',')
      await queryExecute(
        `DELETE FROM project_scores WHERE project_id = ? AND dimension_id IN (${placeholders})`,
        [projectId, ...removeIds],
      )
      await queryExecute(
        `DELETE FROM project_score_dimensions WHERE project_id = ? AND id IN (${placeholders})`,
        [projectId, ...removeIds],
      )
      const scoreAgg = await queryOne(
        `SELECT AVG(stars) AS avg_score, COUNT(DISTINCT member_id) AS score_count
         FROM project_scores WHERE project_id = ?`,
        [projectId],
      )
      await queryExecute(
        `UPDATE projects SET avg_score = ?, score_count = ?, updated_at = NOW() WHERE id = ?`,
        [
          Number(scoreAgg?.avg_score || 0).toFixed(2),
          Number(scoreAgg?.score_count || 0),
          projectId,
        ],
      )
    }
  }

  async getAllProjects(query: any) {
    try {
      const rows = await queryRows(
        `SELECT p.*,
                m.name AS owner_name,
                COALESCE(
                  NULLIF(TRIM(m.company_name), ''),
                  (
                    SELECT NULLIF(TRIM(t.company_name), '')
                    FROM talent_applications t
                    WHERE t.member_id = m.id AND t.status = 'approved'
                    ORDER BY t.id DESC
                    LIMIT 1
                  )
                ) AS owner_company_name,
                m.phone AS owner_phone,
                (SELECT COUNT(*) FROM project_score_dimensions d WHERE d.project_id = p.id) AS dimension_count
         FROM projects p
         LEFT JOIN members m ON m.id = p.submitter_id
         ORDER BY p.updated_at DESC, p.created_at DESC`,
      )
      return this.uploadService.signRowsFields(rows, ['cover_image', 'video_url'])
    } catch (error) {
      console.error('[AdminService] getAllProjects error:', error)
      return []
    }
  }

  async getProjectById(id: string) {
    try {
      const row = await queryOne(
        `SELECT p.*,
                m.name AS owner_name,
                COALESCE(
                  NULLIF(TRIM(m.company_name), ''),
                  (
                    SELECT NULLIF(TRIM(t.company_name), '')
                    FROM talent_applications t
                    WHERE t.member_id = m.id AND t.status = 'approved'
                    ORDER BY t.id DESC
                    LIMIT 1
                  )
                ) AS owner_company_name,
                m.phone AS owner_phone,
                m.user_category AS owner_user_category
         FROM projects p
         LEFT JOIN members m ON m.id = p.submitter_id
         WHERE p.id = ?`,
        [id],
      )
      if (!row) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)
      const dimensions = await queryRows(
        `SELECT id, project_id, name, sort_order
         FROM project_score_dimensions
         WHERE project_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [id],
      )
      const signed = await this.uploadService.signRowFields(row, ['cover_image', 'video_url'])
      const galleryImages = await this.uploadService.signMediaUrls(
        parseJsonUrlList((row as any).gallery_images),
      )
      const fileUrls = await this.uploadService.signMediaUrls(
        parseJsonUrlList((row as any).file_urls),
      )
      return {
        ...signed,
        company_name: (row as any).company_name || (row as any).owner_company_name || null,
        gallery_images: galleryImages,
        file_urls: fileUrls,
        score_dimensions: dimensions || [],
      }
    } catch (error) {
      console.error('[AdminService] getProjectById error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('获取项目失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  private async resolveProjectOwner(submitterIdRaw: unknown) {
    if (submitterIdRaw == null || submitterIdRaw === '') return null
    const submitterId = Number(submitterIdRaw)
    if (!Number.isFinite(submitterId) || submitterId <= 0) {
      throw new HttpException('项目负责人无效', HttpStatus.BAD_REQUEST)
    }
    const owner = await queryOne(
      `SELECT m.id, m.name, m.company_name, m.status,
              (
                SELECT t.company_name
                FROM talent_applications t
                WHERE t.member_id = m.id AND t.status = 'approved'
                ORDER BY t.id DESC
                LIMIT 1
              ) AS talent_company_name,
              (
                SELECT t.job_title
                FROM talent_applications t
                WHERE t.member_id = m.id AND t.status = 'approved'
                ORDER BY t.id DESC
                LIMIT 1
              ) AS talent_job_title
       FROM members m
       WHERE m.id = ?`,
      [submitterId],
    )
    if (!owner) throw new HttpException('项目负责人不存在', HttpStatus.BAD_REQUEST)
    return owner
  }

  /** 项目公司：会员公司优先，人才入驻公司兜底；两边都有值则必须一致 */
  private resolveLinkedCompanyName(owner: any, dtoCompanyRaw: unknown) {
    const ownerCompany = String(owner?.company_name || owner?.talent_company_name || '').trim()
    const dtoCompany = String(dtoCompanyRaw || '').trim()
    if (ownerCompany && dtoCompany && ownerCompany.toLowerCase() !== dtoCompany.toLowerCase()) {
      throw new HttpException('项目负责人所属公司与所选公司不一致', HttpStatus.BAD_REQUEST)
    }
    if (owner && !ownerCompany) {
      throw new HttpException('项目负责人未填写公司名称（请先在人才/会员资料中完善）', HttpStatus.BAD_REQUEST)
    }
    return ownerCompany || dtoCompany || null
  }

  /** 将人才公司回写到会员，保证后续项目管理可按公司筛选负责人 */
  private async ensureMemberCompanyFromOwner(owner: any, companyName: string | null) {
    if (!owner?.id || !companyName) return
    const memberCompany = String(owner.company_name || '').trim()
    if (memberCompany) return
    try {
      const jobTitle = String(owner.talent_job_title || '').trim().slice(0, 128) || null
      if (jobTitle) {
        await queryExecute(
          `UPDATE members
           SET company_name = ?, company_position = COALESCE(NULLIF(company_position, ''), ?), updated_at = NOW()
           WHERE id = ?`,
          [String(companyName).slice(0, 100), jobTitle, owner.id],
        )
      } else {
        await queryExecute(
          `UPDATE members SET company_name = ?, updated_at = NOW() WHERE id = ?`,
          [String(companyName).slice(0, 100), owner.id],
        )
      }
    } catch (error) {
      console.warn('[AdminService] sync member company from project owner failed:', error)
    }
  }

  async createProject(dto: any) {
    try {
      const coverImage = assertCloudStorageImageUrl(dto.cover_image)
      const videoUrl = normalizeOptionalVideoUrl(dto.video_url)
      const galleryImages = parseJsonUrlList(dto.gallery_images)
        .map((url) => canonicalizeCloudStorageUrl(url))
        .filter((url) => isCloudStorageUrl(url))
      const fileUrls = parseJsonUrlList(dto.file_urls)
        .map((url) => canonicalizeCloudStorageUrl(url))
        .filter((url) => isCloudStorageUrl(url))
      const owner = await this.resolveProjectOwner(dto.submitter_id)
      if (!owner) throw new HttpException('请选择项目负责人', HttpStatus.BAD_REQUEST)
      const companyName = this.resolveLinkedCompanyName(owner, dto.company_name)
      await this.ensureMemberCompanyFromOwner(owner, companyName)
      const result = await queryExecute(
        `INSERT INTO projects
           (title, description, cover_image, video_url, gallery_images, file_urls, industry, stage, amount_max, status,
            audit_status, submitter_id, company_name, is_featured, sort_order, avg_score, score_count,
            promo_coop_mode, promo_commission_rate, promo_amount_wan, promo_remark, promo_share_count, admin_operated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, NOW())`,
        [
          dto.title,
          dto.description || null,
          coverImage,
          videoUrl,
          serializeJsonUrlList(galleryImages),
          serializeJsonUrlList(fileUrls),
          dto.industry || null,
          dto.stage || 'seed',
          null,
          dto.status || 'active',
          owner ? owner.id : null,
          companyName,
          dto.is_featured ? 1 : 0,
          Math.max(0, Number(dto.sort_order) || 0),
          normalizePromoCoopMode(dto.promo_coop_mode),
          dto.promo_commission_rate != null && dto.promo_commission_rate !== ''
            ? Number(dto.promo_commission_rate)
            : null,
          null,
          dto.promo_remark != null ? String(dto.promo_remark || '').trim() || null : null,
          Math.max(0, Number(dto.promo_share_count) || 0),
        ],
      )
      const dimensions = this.normalizeScoreDimensions(dto.score_dimensions)
      if (dimensions.length) {
        await this.syncProjectScoreDimensions(result.insertId, dimensions)
      }
      return await this.getProjectById(String(result.insertId))
    } catch (error) {
      console.error('[AdminService] createProject error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('创建项目失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateProject(id: string, dto: any) {
    try {
      const existing = await queryOne('SELECT * FROM projects WHERE id = ?', [id])
      if (!existing) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)

      const updates: string[] = []
      const params: any[] = []
      const assign = (column: string, value: unknown) => {
        updates.push(`${column} = ?`)
        params.push(value)
      }

      if (dto.title !== undefined) assign('title', dto.title)
      if (dto.description !== undefined) assign('description', dto.description || null)
      if (dto.cover_image !== undefined) assign('cover_image', assertCloudStorageImageUrl(dto.cover_image))
      if (dto.video_url !== undefined) assign('video_url', normalizeOptionalVideoUrl(dto.video_url))
      if (dto.gallery_images !== undefined) {
        const galleryImages = parseJsonUrlList(dto.gallery_images)
          .map((url) => canonicalizeCloudStorageUrl(url))
          .filter((url) => isCloudStorageUrl(url))
        assign('gallery_images', serializeJsonUrlList(galleryImages))
      }
      if (dto.file_urls !== undefined) {
        const fileUrls = parseJsonUrlList(dto.file_urls)
          .map((url) => canonicalizeCloudStorageUrl(url))
          .filter((url) => isCloudStorageUrl(url))
        assign('file_urls', serializeJsonUrlList(fileUrls))
      }
      if (dto.industry !== undefined) assign('industry', dto.industry || null)
      if (dto.stage !== undefined) assign('stage', dto.stage || 'seed')
      if (dto.status !== undefined) assign('status', dto.status || 'draft')
      if (dto.promo_coop_mode !== undefined) {
        assign('promo_coop_mode', normalizePromoCoopMode(dto.promo_coop_mode))
      }
      if (dto.promo_commission_rate !== undefined) {
        assign(
          'promo_commission_rate',
          dto.promo_commission_rate === '' || dto.promo_commission_rate == null
            ? null
            : Number(dto.promo_commission_rate),
        )
      }
      if (dto.promo_remark !== undefined) {
        assign('promo_remark', String(dto.promo_remark || '').trim() || null)
      }
      if (dto.promo_share_count !== undefined) {
        assign('promo_share_count', Math.max(0, Number(dto.promo_share_count) || 0))
      }
      if (dto.submitter_id !== undefined || dto.company_name !== undefined) {
        const nextSubmitterId =
          dto.submitter_id !== undefined
            ? dto.submitter_id
            : existing.submitter_id
        if (nextSubmitterId == null || nextSubmitterId === '') {
          if (dto.submitter_id !== undefined) assign('submitter_id', null)
          if (dto.company_name !== undefined) {
            assign('company_name', String(dto.company_name || '').trim() || null)
          }
        } else {
          const owner = await this.resolveProjectOwner(nextSubmitterId)
          if (dto.submitter_id !== undefined) assign('submitter_id', owner!.id)
          const companySource =
            dto.company_name !== undefined
              ? dto.company_name
              : existing.company_name
          const linkedCompany = this.resolveLinkedCompanyName(owner, companySource)
          assign('company_name', linkedCompany)
          await this.ensureMemberCompanyFromOwner(owner, linkedCompany)
        }
      }
      if (dto.is_featured !== undefined) {
        assign('is_featured', dto.is_featured ? 1 : 0)
      }
      if (dto.sort_order !== undefined) {
        assign('sort_order', Math.max(0, Number(dto.sort_order) || 0))
      }
      if (dto.audit_status !== undefined) {
        const audit = String(dto.audit_status)
        if (!['pending', 'approved', 'rejected'].includes(audit)) {
          throw new HttpException('审核状态无效', HttpStatus.BAD_REQUEST)
        }
        assign('audit_status', audit)
        if (audit === 'approved' && (dto.status === undefined || !dto.status)) {
          assign('status', existing.status === 'draft' ? 'active' : existing.status)
        }
        if (audit === 'rejected') {
          assign('reject_reason', String(dto.reject_reason || '').trim() || '未通过审核')
        } else if (dto.reject_reason !== undefined) {
          assign('reject_reason', String(dto.reject_reason || '').trim() || null)
        }
      } else if (dto.reject_reason !== undefined) {
        assign('reject_reason', String(dto.reject_reason || '').trim() || null)
      }

      if (updates.length) {
        params.push(id)
        await queryExecute(
          `UPDATE projects SET ${updates.join(', ')}, updated_at = NOW(), admin_operated_at = NOW() WHERE id = ?`,
          params,
        )
      } else if (dto.score_dimensions !== undefined) {
        await queryExecute(
          'UPDATE projects SET admin_operated_at = NOW(), updated_at = NOW() WHERE id = ?',
          [id],
        )
      }

      if (dto.score_dimensions !== undefined) {
        await this.syncProjectScoreDimensions(id, this.normalizeScoreDimensions(dto.score_dimensions))
      }

      const next = (await this.getProjectById(id)) as Record<string, any>
      if (
        dto.audit_status
        && existing.submitter_id
        && String(existing.audit_status) !== String(dto.audit_status)
        && (dto.audit_status === 'approved' || dto.audit_status === 'rejected')
      ) {
        await createNotification({
          memberId: existing.submitter_id,
          type: 'approval',
          title: dto.audit_status === 'approved' ? '项目审核通过' : '项目审核未通过',
          content:
            dto.audit_status === 'approved'
              ? `您发布的项目「${next?.title || existing.title}」已通过审核`
              : `您发布的项目「${next?.title || existing.title}」未通过审核${
                  next?.reject_reason || existing.reject_reason
                    ? `：${next?.reject_reason || existing.reject_reason}`
                    : ''
                }`,
          link: `/pages/content-detail/index?type=project&id=${id}`,
          bizType: 'project_audit',
          bizId: id,
          result: dto.audit_status,
        })
      }
      return next
    } catch (error) {
      console.error('[AdminService] updateProject error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('更新项目失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async auditProject(id: string, dto: { audit_status: string; reject_reason?: string; status?: string }) {
    return this.updateProject(id, {
      audit_status: dto.audit_status,
      reject_reason: dto.reject_reason,
      status: dto.status,
    })
  }

  async deleteProject(id: string) {
    try {
      try {
        await queryExecute(
          `DELETE FROM homepage_items WHERE section IN ('projects', 'financing', 'roadshow') AND item_id = ?`,
          [String(id)],
        )
      } catch {
        // 首页关联清理失败不阻断项目删除
      }
      await queryExecute('DELETE FROM project_scores WHERE project_id = ?', [id])
      await queryExecute('DELETE FROM project_score_dimensions WHERE project_id = ?', [id])
      await queryExecute('DELETE FROM projects WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteProject error:', error)
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
      return await queryRows('SELECT * FROM configs ORDER BY id ASC')
    } catch (error) {
      return []
    }
  }

  async getConfigByKey(key: string) {
    const row = await queryOne('SELECT * FROM configs WHERE config_key = ?', [key])
    return row || null
  }

  async updateConfig(key: string, value: string) {
    try {
      const configKey = String(key || '').trim()
      if (!configKey) throw new HttpException('配置键无效', HttpStatus.BAD_REQUEST)
      const existing = await queryOne('SELECT id FROM configs WHERE config_key = ?', [configKey])
      if (existing) {
        await queryExecute(
          'UPDATE configs SET config_value = ?, updated_at = NOW() WHERE config_key = ?',
          [value ?? '', configKey],
        )
      } else {
        await queryExecute(
          'INSERT INTO configs (config_key, config_value, description) VALUES (?, ?, ?)',
          [configKey, value ?? '', configKey === 'about_us' ? '关于我们（富文本）' : null],
        )
      }
      return await this.getConfigByKey(configKey)
    } catch (error) {
      if (error instanceof HttpException) throw error
      throw new HttpException('更新配置失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 文章管理 ====== */
  async getAllArticles(query?: any) {
    try {
      const rows = await queryRows('SELECT * FROM articles ORDER BY created_at DESC')
      return this.uploadService.signRowsFields(rows, ['cover_image', 'video_url'])
    } catch (error) {
      return []
    }
  }

  async createArticle(dto: any) {
    try {
      const coverImage = assertCloudStorageImageUrl(dto.cover_image)
      const videoUrl = normalizeOptionalVideoUrl(dto.video_url)
      const result = await queryExecute(
        `INSERT INTO articles
           (title, subtitle, content, summary, cover_image, video_url, category, tags, author, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.title,
          dto.subtitle || null,
          dto.content || null,
          dto.summary || null,
          coverImage,
          videoUrl,
          dto.category || 'news',
          dto.tags ? JSON.stringify(dto.tags) : null,
          dto.author || null,
          dto.status || 'draft',
        ]
      )
      return await queryOne('SELECT * FROM articles WHERE id = ?', [result.insertId])
    } catch (error) {
      if (error instanceof HttpException) throw error
      console.error('[AdminService] createArticle error:', error)
      throw new HttpException(this.describeArticleDbError(error, '创建文章失败'), HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** 把常见 MySQL 错误翻译成管理台可读的提示 */
  private describeArticleDbError(error: unknown, fallback: string): string {
    const msg = String((error as any)?.message || '')
    if (msg.includes('Unknown column')) {
      return `${fallback}：数据库缺少字段（${msg.match(/Unknown column '([^']+)'/)?.[1] || '未知'}），请重启服务自动补齐表结构`
    }
    if (msg.includes('Data too long')) {
      return `${fallback}：内容过长，超出数据库字段限制，请精简后重试`
    }
    if (msg.includes("doesn't exist") || (error as any)?.code === 'ER_NO_SUCH_TABLE') {
      return `${fallback}：articles 表不存在，请先初始化数据库`
    }
    return fallback
  }

  async updateArticle(id: string, dto: any) {
    try {
      const allowedFields = [
        'title', 'subtitle', 'content', 'summary', 'category', 'status', 'author',
      ]
      const updates: Record<string, unknown> = Object.fromEntries(
        allowedFields
          .filter(field => dto[field] !== undefined)
          .map(field => [field, dto[field] || null]),
      )
      if (dto.cover_image !== undefined) {
        updates.cover_image = assertCloudStorageImageUrl(dto.cover_image)
      }
      if (dto.video_url !== undefined) {
        updates.video_url = normalizeOptionalVideoUrl(dto.video_url)
      }
      if (dto.tags !== undefined) {
        updates.tags = dto.tags ? JSON.stringify(dto.tags) : null
      }
      await queryExecute('UPDATE articles SET ? WHERE id = ?', [updates, id])
      return { success: true }
    } catch (error) {
      if (error instanceof HttpException) throw error
      console.error('[AdminService] updateArticle error:', error)
      throw new HttpException(this.describeArticleDbError(error, '更新文章失败'), HttpStatus.INTERNAL_SERVER_ERROR)
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
      const rows = await queryRows('SELECT * FROM mall_products ORDER BY created_at DESC')
      return this.uploadService.signRowsFields(rows, ['image_url', 'video_url', 'cover_image'])
    } catch (error) {
      console.error('[AdminService] getMallProducts error:', error)
      throw new HttpException('获取商品列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async getMallProductById(id: string) {
    try {
      const row = await queryOne('SELECT * FROM mall_products WHERE id = ?', [id])
      if (!row) throw new HttpException('商品不存在', HttpStatus.NOT_FOUND)
      return this.uploadService.signDetailMediaFields(
        row,
        ['image_url', 'video_url', 'cover_image'],
        ['description'],
      )
    } catch (error) {
      console.error('[AdminService] getMallProductById error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('获取商品详情失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** ====== 商品管理 ====== */
  async createMallProduct(dto: any) {
    try {
      await ensureSchemaColumns()
      const imageUrl = assertCloudStorageImageUrl(dto.image_url || dto.cover_image)
      const videoUrl = normalizeOptionalVideoUrl(dto.video_url)
      const result = await queryExecute(
        `INSERT INTO mall_products (name, description, points_price, stock, image_url, video_url, status, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.name,
          dto.description || null,
          dto.points_price || 0,
          dto.stock || 0,
          imageUrl,
          videoUrl,
          dto.status || 'active',
          dto.category || 'gift',
        ],
      )
      return await this.getMallProductById(String(result.insertId))
    } catch (error) {
      console.error('[AdminService] createMallProduct error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('创建商品失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateMallProduct(id: string, dto: any) {
    try {
      await ensureSchemaColumns()
      const updates: string[] = []
      const params: any[] = []
      const assign = (field: string, value: any) => {
        updates.push(`${field} = ?`)
        params.push(value)
      }
      if (dto.name !== undefined) assign('name', dto.name)
      if (dto.description !== undefined) assign('description', dto.description || null)
      if (dto.points_price !== undefined) assign('points_price', dto.points_price)
      if (dto.stock !== undefined) assign('stock', dto.stock)
      if (dto.status !== undefined) assign('status', dto.status)
      if (dto.category !== undefined) assign('category', dto.category)
      if (dto.image_url !== undefined || dto.cover_image !== undefined) {
        assign('image_url', assertCloudStorageImageUrl(dto.image_url || dto.cover_image))
      }
      if (dto.video_url !== undefined) {
        assign('video_url', normalizeOptionalVideoUrl(dto.video_url))
      }
      if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
      updates.push('updated_at = NOW()')
      params.push(id)
      await queryExecute(`UPDATE mall_products SET ${updates.join(', ')} WHERE id = ?`, params)
      return await this.getMallProductById(id)
    } catch (error) {
      console.error('[AdminService] updateMallProduct error:', error)
      if (error instanceof HttpException) throw error
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
      return roles.map((role: any) => {
        const normalized = normalizeRolePermissions(role.permissions)
        return {
          ...role,
          permissions: normalized.isAll ? ['*'] : normalized.pages,
        }
      })
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
        const permissionValue = typeof dto.permissions === 'string'
          ? dto.permissions
          : JSON.stringify(dto.permissions)
        values.push(permissionValue)
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
      const rows = await queryRows('SELECT * FROM invitation_reward_rules ORDER BY created_at DESC')
      return (rows || []).map((row) => formatInviteRuleRow(row))
    } catch (error) {
      console.error('[AdminService] getInvitationRewardRules error:', error)
      throw new HttpException('获取邀请奖励规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createInvitationRewardRule(dto: any) {
    try {
      if (!String(dto?.rule_name || '').trim()) {
        throw new HttpException('规则名称不能为空', HttpStatus.BAD_REQUEST)
      }
      const conditions = normalizeInviteConditions(dto.conditions)
      if (!conditions.length) {
        throw new HttpException('请至少配置一个触发条件', HttpStatus.BAD_REQUEST)
      }
      const rewards = normalizeInviteRewards(dto)
      const rewardType = hasAnyInviteReward(rewards) ? inferLegacyRewardType(rewards) : 'none'
      const rewardValue = rewards.points_value || rewards.growth_value || rewards.contribution_value || 0

      const result = await queryExecute(
        `INSERT INTO invitation_reward_rules
         (rule_name, rule_type, reward_type, reward_value, points_value, experience_value, growth_value, earnings_value, contribution_value, content, conditions, max_rewards, is_active, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(dto.rule_name).trim(),
          dto.rule_type || 'direct',
          rewardType,
          rewardValue,
          rewards.points_value,
          rewards.growth_value,
          rewards.growth_value,
          rewards.earnings_value,
          rewards.contribution_value,
          dto.content || null,
          JSON.stringify(conditions),
          dto.max_rewards ?? -1,
          dto.is_active !== false,
          dto.start_date || null,
          dto.end_date || null,
        ],
      )
      return formatInviteRuleRow(
        await queryOne('SELECT * FROM invitation_reward_rules WHERE id = ?', [result.insertId]),
      )
    } catch (error) {
      console.error('[AdminService] createInvitationRewardRule error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('创建邀请奖励规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateInvitationRewardRule(id: string, dto: any) {
    try {
      const payload: Record<string, any> = {}
      if (dto.rule_name !== undefined) {
        const name = String(dto.rule_name || '').trim()
        if (!name) throw new HttpException('规则名称不能为空', HttpStatus.BAD_REQUEST)
        payload.rule_name = name
      }
      if (dto.rule_type !== undefined) payload.rule_type = dto.rule_type || 'direct'
      if (dto.content !== undefined) payload.content = dto.content || null
      if (dto.max_rewards !== undefined) payload.max_rewards = dto.max_rewards
      if (dto.is_active !== undefined) payload.is_active = !!dto.is_active
      if (dto.start_date !== undefined) payload.start_date = dto.start_date || null
      if (dto.end_date !== undefined) payload.end_date = dto.end_date || null

      if (dto.conditions !== undefined) {
        const conditions = normalizeInviteConditions(dto.conditions)
        if (!conditions.length) {
          throw new HttpException('请至少配置一个触发条件', HttpStatus.BAD_REQUEST)
        }
        payload.conditions = JSON.stringify(conditions)
      }

      const rewardTouched = [
        'points_value',
        'growth_value',
        'experience_value',
        'earnings_value',
        'contribution_value',
        'reward_value',
      ].some((key) => dto[key] !== undefined)
      if (rewardTouched) {
        const rewards = normalizeInviteRewards(dto)
        payload.points_value = rewards.points_value
        payload.growth_value = rewards.growth_value
        payload.experience_value = rewards.growth_value
        payload.earnings_value = rewards.earnings_value
        payload.contribution_value = rewards.contribution_value
        payload.reward_value = rewards.points_value || rewards.growth_value || rewards.contribution_value || 0
        payload.reward_type = hasAnyInviteReward(rewards) ? inferLegacyRewardType(rewards) : 'none'
      }

      if (!Object.keys(payload).length) {
        throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
      }

      await queryExecute('UPDATE invitation_reward_rules SET ? WHERE id = ?', [payload, id])
      return formatInviteRuleRow(
        await queryOne('SELECT * FROM invitation_reward_rules WHERE id = ?', [id]),
      )
    } catch (error) {
      console.error('[AdminService] updateInvitationRewardRule error:', error)
      if (error instanceof HttpException) throw error
      throw new HttpException('更新邀请奖励规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async deleteInvitationRewardRule(id: string) {
    try {
      await queryExecute('DELETE FROM invitation_reward_rules WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deleteInvitationRewardRule error:', error)
      throw new HttpException('删除邀请奖励规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** 小程序端读取启用中的邀请规则（含图文说明、条件、多奖励） */
  async getActiveInvitationRulesForClient() {
    try {
      const rows = await queryRows(
        `SELECT *
         FROM invitation_reward_rules
         WHERE is_active = 1
         ORDER BY id ASC`,
      )
      const list = (rows || []).map((row) => formatInviteRuleRow(row))
      return Promise.all(
        list.map(async (row: any) => ({
          ...row,
          content: row.content
            ? await this.uploadService.signHtmlMedia(row.content)
            : '',
        })),
      )
    } catch (error) {
      console.error('[AdminService] getActiveInvitationRulesForClient error:', error)
      return []
    }
  }

  /** ====== 积分规则管理 ====== */
  async getPointsRules() {
    try {
      const rows = await queryRows('SELECT * FROM points_rules ORDER BY priority DESC, created_at DESC')
      return (rows || []).map((r) => formatPointsRuleRow(r))
    } catch (error) {
      console.error('[AdminService] getPointsRules error:', error)
      throw new HttpException('获取积分规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async createPointsRule(dto: any) {
    try {
      const data = normalizePointsRuleDto(dto)
      if (data.action_type === 'invite' || data.action_type === 'invite_friend' || data.action_type === 'invite_register') {
        throw new HttpException('邀请积分请在「邀请奖励」模块配置', HttpStatus.BAD_REQUEST)
      }
      const result = await queryExecute(
        `INSERT INTO points_rules
           (rule_name, action_type, points_value, threshold_value, conditions, daily_limit, total_limit,
            is_active, priority, repeatable, description, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.rule_name,
          data.action_type,
          data.points_value,
          data.threshold_value,
          data.conditions,
          data.daily_limit,
          data.total_limit,
          data.is_active ? 1 : 0,
          data.priority,
          data.repeatable ? 1 : 0,
          data.description,
          data.start_date,
          data.end_date,
        ],
      )
      const row = await queryOne('SELECT * FROM points_rules WHERE id = ?', [result.insertId])
      return formatPointsRuleRow(row)
    } catch (error) {
      if (error instanceof HttpException) throw error
      console.error('[AdminService] createPointsRule error:', error)
      throw new HttpException(
        (error as Error)?.message || '创建积分规则失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async updatePointsRule(id: string, dto: any) {
    try {
      const data = normalizePointsRuleDto({ ...dto, action_type: dto.action_type || dto.action })
      if (data.action_type === 'invite' || data.action_type === 'invite_friend' || data.action_type === 'invite_register') {
        throw new HttpException('邀请积分请在「邀请奖励」模块配置', HttpStatus.BAD_REQUEST)
      }
      await queryExecute(
        `UPDATE points_rules SET
           rule_name = ?, action_type = ?, points_value = ?, threshold_value = ?, conditions = ?,
           daily_limit = ?, total_limit = ?, is_active = ?, priority = ?, repeatable = ?,
           description = ?, start_date = ?, end_date = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          data.rule_name,
          data.action_type,
          data.points_value,
          data.threshold_value,
          data.conditions,
          data.daily_limit,
          data.total_limit,
          data.is_active ? 1 : 0,
          data.priority,
          data.repeatable ? 1 : 0,
          data.description,
          data.start_date,
          data.end_date,
          id,
        ],
      )
      const row = await queryOne('SELECT * FROM points_rules WHERE id = ?', [id])
      return formatPointsRuleRow(row)
    } catch (error) {
      if (error instanceof HttpException) throw error
      console.error('[AdminService] updatePointsRule error:', error)
      throw new HttpException(
        (error as Error)?.message || '更新积分规则失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async deletePointsRule(id: string) {
    try {
      await queryExecute('DELETE FROM points_rules WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      console.error('[AdminService] deletePointsRule error:', error)
      throw new HttpException('删除积分规则失败', HttpStatus.INTERNAL_SERVER_ERROR)
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
  private async tryAddColumn(table: string, column: string, definition: string) {
    try {
      await queryExecute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
    } catch {
      /* column may already exist */
    }
  }

  private async ensureDepartmentsTable() {
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        parent_id INT DEFAULT NULL,
        level INT DEFAULT 1,
        path VARCHAR(500) DEFAULT '/',
        manager_id INT NULL,
        leader_name VARCHAR(100) NULL,
        sort_order INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_parent_id (parent_id),
        INDEX idx_path (path)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await this.tryAddColumn('departments', 'level', 'INT DEFAULT 1')
    await this.tryAddColumn('departments', 'path', `VARCHAR(500) DEFAULT '/'`)
    await this.tryAddColumn('departments', 'manager_id', 'INT NULL')
    await this.tryAddColumn('departments', 'leader_name', 'VARCHAR(100) NULL')
    await this.tryAddColumn('departments', 'sort_order', 'INT DEFAULT 0')
    await this.tryAddColumn('departments', 'status', `VARCHAR(20) DEFAULT 'active'`)
    await this.tryAddColumn('departments', 'description', 'TEXT NULL')

    await queryExecute(`
      CREATE TABLE IF NOT EXISTS member_departments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        department_id INT NOT NULL,
        talent_id INT NULL,
        position VARCHAR(100) NULL,
        is_primary TINYINT(1) DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_member_department (member_id, department_id),
        INDEX idx_department_id (department_id),
        INDEX idx_talent_id (talent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await this.tryAddColumn('member_departments', 'talent_id', 'INT NULL')
    await this.tryAddColumn('member_departments', 'position', 'VARCHAR(100) NULL')
    await this.tryAddColumn('member_departments', 'is_primary', 'TINYINT(1) DEFAULT 0')
  }

  /** 按组织架构图写入默认部门；force=true 时清空后重建 */
  async ensureDefaultDepartments(force = false) {
    await this.ensureDepartmentsTable()
    const count = await queryOne('SELECT COUNT(*) AS total FROM departments')
    const total = Number((count as any)?.total || 0)
    if (total > 0 && !force) return { seeded: false, total }

    if (force && total > 0) {
      await queryExecute('DELETE FROM member_departments')
      await queryExecute('DELETE FROM departments')
    }

    const insertOne = async (
      name: string,
      parentId: number | null,
      sortOrder: number,
      description?: string,
    ) => {
      let level = 1
      let path = '/'
      if (parentId) {
        const parent = await queryOne('SELECT level, path FROM departments WHERE id = ?', [parentId])
        if (parent) {
          level = Number((parent as any).level || 1) + 1
          path = `${(parent as any).path || '/'}${parentId}/`
        }
      }
      const result = await queryExecute(
        `INSERT INTO departments (name, parent_id, level, path, leader_name, sort_order, description, status)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 'active')`,
        [name, parentId, level, path, sortOrder, description || null],
      )
      const id = result.insertId
      await queryExecute('UPDATE departments SET path = CONCAT(?, ?, "/") WHERE id = ?', [path, id, id])
      return id
    }

    const board = await insertOne('理事会', null, 1, '最高决策机构')
    await insertOne('理事长', board, 1)
    await insertOne('监事长', board, 2)
    await insertOne('理事会成员', board, 3)
    const president = await insertOne('会长', board, 4, '执行负责人')
    await insertOne('专家委员会', president, 1)
    await insertOne('顾问委员', president, 2)
    await insertOne('荣誉会长', president, 3)
    const secretariat = await insertOne('秘书处', president, 4, '日常运营统筹')
    await insertOne('秘书长', secretariat, 1)
    await insertOne('副秘书长', secretariat, 2)
    await insertOne('执行秘书', secretariat, 3)
    await insertOne('会员发展部', secretariat, 10)
    await insertOne('品牌宣传部', secretariat, 11)
    await insertOne('系统运营部', secretariat, 12)
    await insertOne('项目合作部', secretariat, 13)
    await insertOne('对外联络部', secretariat, 14)
    const sz = await insertOne('深圳分会', secretariat, 20)
    await insertOne('广州分会', secretariat, 21)
    await insertOne('佛山分会', secretariat, 22)
    await insertOne('东莞分会', secretariat, 23)
    const baoan = await insertOne('分会一部部长（宝安）', sz, 1)
    await insertOne('分会二部部长（南山）', sz, 2)
    await insertOne('五金行业会员中心', baoan, 1)
    await insertOne('洗护行业会员中心', baoan, 2)
    await insertOne('食品行业会员中心', baoan, 3)

    const after = await queryOne('SELECT COUNT(*) AS total FROM departments')
    return { seeded: true, total: Number((after as any)?.total || 0) }
  }

  private async listDepartmentMembers(departmentId: string | number) {
    try {
      return await queryRows(
        `SELECT md.id, md.member_id, md.talent_id, md.position, md.is_primary,
                t.real_name AS talent_name, t.photo_url, t.avatar_url,
                m.name AS member_name
         FROM member_departments md
         LEFT JOIN talent_applications t ON t.id = md.talent_id
         LEFT JOIN members m ON m.id = md.member_id
         WHERE md.department_id = ?
         ORDER BY md.position ASC, md.id ASC`,
        [departmentId],
      )
    } catch (error) {
      console.warn('[AdminService] listDepartmentMembers failed', error)
      return []
    }
  }

  async getDepartments() {
    try {
      await this.ensureDefaultDepartments(false)
      const rows = await queryRows(`
        SELECT d.id, d.name, d.parent_id, d.level, d.path, d.manager_id, d.leader_name,
               d.sort_order, d.status, d.description, d.created_at, d.updated_at
        FROM departments d
        ORDER BY d.level ASC, d.sort_order ASC, d.id ASC
      `)
      const list = Array.isArray(rows) ? rows : []
      return Promise.all(
        list.map(async (row: any) => {
          const members = await this.listDepartmentMembers(row.id)
          return {
            ...row,
            level: Number(row.level || 1),
            member_count: members.length,
            members,
          }
        }),
      )
    } catch (error) {
      console.error('[AdminService] getDepartments error:', error)
      throw new HttpException('获取部门列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async listApprovedTalentsForDept(keyword?: string) {
    await this.ensureDepartmentsTable()
    const values: any[] = []
    let where = `t.status = 'approved'`
    if (keyword) {
      where += ' AND (t.real_name LIKE ? OR t.contact LIKE ? OR CAST(t.member_id AS CHAR) LIKE ?)'
      const kw = `%${keyword}%`
      values.push(kw, kw, kw)
    }
    const rows = await queryRows(
      `SELECT t.id, t.member_id, t.real_name, t.contact, t.photo_url, t.avatar_url
       FROM talent_applications t
       WHERE ${where}
       ORDER BY t.reviewed_at DESC, t.id DESC
       LIMIT 200`,
      values,
    )
    return this.uploadService.signRowsFields(rows || [], ['photo_url', 'avatar_url'])
  }

  async setDepartmentMembers(
    departmentId: string,
    members: Array<{ talent_id: number | string; position?: string }>,
  ) {
    await this.ensureDepartmentsTable()
    const dept = await queryOne('SELECT id FROM departments WHERE id = ?', [departmentId])
    if (!dept) throw new HttpException('部门不存在', HttpStatus.NOT_FOUND)

    await queryExecute('DELETE FROM member_departments WHERE department_id = ?', [departmentId])
    const list = Array.isArray(members) ? members : []
    for (const item of list) {
      const talentId = Number(item.talent_id)
      if (!talentId) continue
      const talent = await queryOne(
        `SELECT id, member_id, real_name FROM talent_applications
         WHERE id = ? AND status = 'approved'`,
        [talentId],
      )
      if (!talent?.member_id) continue
      const position = String(item.position || '').trim() || null
      try {
        await queryExecute(
          `INSERT INTO member_departments (member_id, department_id, talent_id, position, is_primary)
           VALUES (?, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE talent_id = VALUES(talent_id), position = VALUES(position)`,
          [talent.member_id, departmentId, talentId, position],
        )
      } catch (error) {
        console.warn('[AdminService] setDepartmentMembers insert failed', error)
      }
    }
    return this.listDepartmentMembers(departmentId)
  }

  async createDepartment(dto: {
    name: string
    parent_id?: number
    manager_id?: number
    leader_name?: string
    sort_order?: number
    description?: string
  }) {
    try {
      await this.ensureDepartmentsTable()
      let level = 1
      let path = '/'

      if (dto.parent_id) {
        const parent = await queryOne('SELECT level, path FROM departments WHERE id = ?', [dto.parent_id])
        if (parent) {
          level = (parent as any).level + 1
          path = `${(parent as any).path}${dto.parent_id}/`
        }
      }

      const result = await queryExecute(
        `INSERT INTO departments (name, parent_id, level, path, manager_id, leader_name, sort_order, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.name,
          dto.parent_id || null,
          level,
          path,
          dto.manager_id || null,
          String(dto.leader_name || '').trim() || null,
          dto.sort_order || 0,
          dto.description || null,
        ],
      )

      const newId = result.insertId
      await queryExecute('UPDATE departments SET path = CONCAT(path, ?, "/") WHERE id = ?', [newId, newId])

      return await queryOne('SELECT * FROM departments WHERE id = ?', [newId])
    } catch (error) {
      console.error('[AdminService] createDepartment error:', error)
      throw new HttpException('创建部门失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateDepartment(
    id: string,
    dto: {
      name?: string
      parent_id?: number | null
      manager_id?: number
      leader_name?: string
      sort_order?: number
      status?: string
      description?: string
    },
  ) {
    try {
      const existing = await queryOne('SELECT * FROM departments WHERE id = ?', [id])
      if (!existing) throw new HttpException('部门不存在', HttpStatus.NOT_FOUND)

      const updates: string[] = []
      const params: any[] = []
      const assign = (col: string, value: unknown) => {
        updates.push(`${col} = ?`)
        params.push(value)
      }

      if (dto.name !== undefined) assign('name', String(dto.name).trim())
      if (dto.leader_name !== undefined) assign('leader_name', String(dto.leader_name || '').trim() || null)
      if (dto.manager_id !== undefined) assign('manager_id', dto.manager_id || null)
      if (dto.sort_order !== undefined) assign('sort_order', Number(dto.sort_order) || 0)
      if (dto.status !== undefined) assign('status', dto.status === 'inactive' ? 'inactive' : 'active')
      if (dto.description !== undefined) assign('description', dto.description || null)

      if (dto.parent_id !== undefined) {
        const parentId = dto.parent_id || null
        if (parentId && String(parentId) === String(id)) {
          throw new HttpException('上级部门不能是自己', HttpStatus.BAD_REQUEST)
        }
        let level = 1
        let path = '/'
        if (parentId) {
          const parent = await queryOne('SELECT level, path FROM departments WHERE id = ?', [parentId])
          if (!parent) throw new HttpException('上级部门不存在', HttpStatus.BAD_REQUEST)
          level = Number((parent as any).level || 1) + 1
          path = `${(parent as any).path || '/'}${parentId}/`
        }
        assign('parent_id', parentId)
        assign('level', level)
        assign('path', `${path}${id}/`)
      }

      if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
      params.push(id)
      await queryExecute(`UPDATE departments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params)
      return await queryOne('SELECT * FROM departments WHERE id = ?', [id])
    } catch (error) {
      console.error('[AdminService] updateDepartment error:', error)
      if (error instanceof HttpException) throw error
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
