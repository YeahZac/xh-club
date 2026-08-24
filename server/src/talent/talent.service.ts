import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'
import { PointsEngineService } from '@/points/points-engine.service'
import { InvitationEngineService } from '@/invitation/invitation-engine.service'
import { createNotification } from '@/common/notify'
import { normalizeUserCategory, userCategoryLabel } from '@/common/user-category'
import { wantsListFields } from '@/common/list-fields'

export const TALENT_STATUSES = ['pending', 'approved', 'rejected'] as const
export type TalentStatus = (typeof TALENT_STATUSES)[number]

const DEFAULT_INDUSTRIES: Array<{ code: string; name: string; sort_order: number }> = [
  { code: 'tech', name: '科技互联网', sort_order: 1 },
  { code: 'finance', name: '金融资本', sort_order: 2 },
  { code: 'manufacture', name: '先进制造', sort_order: 3 },
  { code: 'health', name: '大健康', sort_order: 4 },
  { code: 'realestate', name: '房地产建筑', sort_order: 5 },
  { code: 'education', name: '教育培训', sort_order: 6 },
  { code: 'media', name: '文化传媒', sort_order: 7 },
  { code: 'law', name: '法律服务', sort_order: 8 },
  { code: 'agriculture', name: '现代农业', sort_order: 9 },
  { code: 'crossborder', name: '跨境贸易', sort_order: 10 },
  { code: 'food', name: '餐饮消费', sort_order: 11 },
  { code: 'energy', name: '环保能源', sort_order: 12 },
  { code: 'service', name: '综合服务', sort_order: 13 },
]

function parseIndustryTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
    } catch {
      return text.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
    }
  }
  return []
}

function normalizeOptionalImage(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  return assertCloudStorageImageUrl(value, true) as string
}

/** 公开接口脱敏联系方式/手机号 */
function maskPublicContact(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (/^1\d{10}$/.test(digits)) {
    return `${digits.slice(0, 3)}****${digits.slice(7)}`
  }
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}****${digits.slice(-2)}`
  }
  if (raw.length >= 7) {
    return `${raw.slice(0, 3)}****${raw.slice(-2)}`
  }
  return raw
}

@Injectable()
export class TalentService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly pointsEngine: PointsEngineService,
    private readonly invitationEngine: InvitationEngineService,
  ) {}

  async ensureDefaultIndustries() {
    const countRow = await queryOne('SELECT COUNT(*) AS total FROM industries')
    if (Number((countRow as any)?.total || 0) > 0) return
    for (const item of DEFAULT_INDUSTRIES) {
      await queryExecute(
        'INSERT INTO industries (code, name, sort_order, status) VALUES (?, ?, ?, ?)',
        [item.code, item.name, item.sort_order, 'active'],
      )
    }
  }

  async listIndustries(activeOnly = true) {
    await this.ensureDefaultIndustries()
    const where = activeOnly ? `WHERE status = 'active'` : ''
    return queryRows(
      `SELECT * FROM industries ${where} ORDER BY sort_order ASC, id ASC`,
    )
  }

  async createIndustry(dto: any) {
    if (!dto?.name?.trim()) throw new HttpException('行业名称不能为空', HttpStatus.BAD_REQUEST)
    const code = String(dto.code || dto.name).trim().toLowerCase().replace(/\s+/g, '_')
    const existing = await queryOne('SELECT id FROM industries WHERE code = ? OR name = ?', [code, dto.name.trim()])
    if (existing) throw new HttpException('行业已存在', HttpStatus.BAD_REQUEST)
    const result = await queryExecute(
      'INSERT INTO industries (code, name, sort_order, status) VALUES (?, ?, ?, ?)',
      [code, dto.name.trim(), dto.sort_order || 0, dto.status || 'active'],
    )
    return queryOne('SELECT * FROM industries WHERE id = ?', [result.insertId])
  }

  async updateIndustry(id: string, dto: any) {
    const existing = await queryOne('SELECT id FROM industries WHERE id = ?', [id])
    if (!existing) throw new HttpException('行业不存在', HttpStatus.NOT_FOUND)
    const updates: string[] = []
    const params: any[] = []
    if (dto.name !== undefined) {
      updates.push('name = ?')
      params.push(String(dto.name).trim())
    }
    if (dto.code !== undefined) {
      updates.push('code = ?')
      params.push(String(dto.code).trim())
    }
    if (dto.sort_order !== undefined) {
      updates.push('sort_order = ?')
      params.push(Number(dto.sort_order) || 0)
    }
    if (dto.status !== undefined) {
      updates.push('status = ?')
      params.push(dto.status === 'inactive' ? 'inactive' : 'active')
    }
    if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    params.push(id)
    await queryExecute(`UPDATE industries SET ${updates.join(', ')} WHERE id = ?`, params)
    return queryOne('SELECT * FROM industries WHERE id = ?', [id])
  }

  async removeIndustry(id: string) {
    await queryExecute('DELETE FROM industries WHERE id = ?', [id])
    return { success: true }
  }

  private computeMembership(row: any) {
    const years = Number(row?.membership_years || 0)
    const start = row?.payment_start_at ? String(row.payment_start_at).slice(0, 10) : ''
    let expire = row?.payment_expire_at ? String(row.payment_expire_at).slice(0, 10) : ''
    let paymentStatus = String(row?.payment_status || 'unpaid')

    if (paymentStatus === 'paid' && expire) {
      const expireTime = new Date(`${expire}T23:59:59`).getTime()
      if (!Number.isNaN(expireTime) && expireTime < Date.now()) {
        paymentStatus = 'expired'
      }
    }

    const membershipActive = paymentStatus === 'paid'
    const yearsLabel =
      years === 1 ? '一年缴会员' : years === 2 ? '二年缴会员' : years === 3 ? '三年缴会员' : ''

    return {
      payment_status: paymentStatus,
      payment_status_label:
        paymentStatus === 'paid' ? '已缴费' : paymentStatus === 'expired' ? '已到期' : '未缴费',
      payment_start_at: start || null,
      membership_years: years || 0,
      membership_years_label: yearsLabel,
      payment_expire_at: expire || null,
      membership_active: membershipActive,
      membership_badge: membershipActive ? yearsLabel || '缴费会员' : '',
    }
  }

  private async syncExpiredPayment(row: any) {
    if (!row?.id) return row
    const meta = this.computeMembership(row)
    if (String(row.payment_status) === 'paid' && meta.payment_status === 'expired') {
      await queryExecute(
        `UPDATE talent_applications
         SET payment_status = 'expired', updated_at = NOW()
         WHERE id = ? AND payment_status = 'paid'`,
        [row.id],
      )
      return { ...row, payment_status: 'expired' }
    }
    return row
  }

  private async signTalent(row: any, options?: { maskContact?: boolean; list?: boolean }) {
    if (!row) return null
    const synced = await this.syncExpiredPayment(row)
    const mediaFields = options?.list
      ? (['photo_url', 'avatar_url', 'member_avatar'] as const)
      : (['photo_url', 'card_image_url', 'avatar_url', 'member_avatar'] as const)
    const signed = await this.uploadService.signRowFields(synced, [...mediaFields])
    return {
      ...signed,
      contact: options?.maskContact ? maskPublicContact(signed.contact) : signed.contact,
      industry_tags: parseIndustryTags(signed.industry_tags),
      ...this.computeMembership(signed),
      user_category: normalizeUserCategory(signed.user_category),
      user_category_label: userCategoryLabel(signed.user_category),
      apply_type: signed.apply_type || null,
      apply_type_label: this.applyTypeLabel(signed.apply_type),
      payment_method: signed.payment_method || null,
      payment_method_label: this.paymentMethodLabel(signed.payment_method),
    }
  }

  private async signTalents(rows: any[], options?: { maskContact?: boolean; list?: boolean }) {
    const list = await Promise.all(rows.map((row) => this.signTalent(row, options)))
    return list.filter(Boolean)
  }

  private parsePendingData(value: unknown): Record<string, any> | null {
    if (!value) return null
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>
    }
    if (typeof value !== 'string') return null
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  /** 本人及后台审核页查看待审新资料；公开查询始终直接读取已审核字段。 */
  private applyPendingView(row: any) {
    if (!row) return row
    const pending = this.parsePendingData(row.pending_data)
    if (!pending || !row.update_status) return row
    return {
      ...row,
      ...pending,
      status: row.update_status,
      reject_reason: row.update_reject_reason || null,
      approved_status: row.status,
      is_profile_update: true,
    }
  }

  async listApproved(params: {
    industry?: string
    keyword?: string
    page?: number
    pageSize?: number
    fields?: string
    slim?: string
  } = {}) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const listFields = wantsListFields(params as any)
    const where = [`t.status = 'approved'`]
    const values: any[] = []

    if (params.industry) {
      where.push('(t.industry_tags LIKE ? OR t.industry_tags LIKE ?)')
      values.push(`%"${params.industry}"%`, `%${params.industry}%`)
    }
    if (params.keyword) {
      where.push('(t.real_name LIKE ? OR t.experience LIKE ? OR t.contact LIKE ?)')
      const kw = `%${params.keyword}%`
      values.push(kw, kw, kw)
    }

    const whereSql = `WHERE ${where.join(' AND ')}`
    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM talent_applications t ${whereSql}`,
      values,
    )
    const selectSql = listFields
      ? `SELECT t.id, t.member_id, t.real_name, t.contact, t.photo_url, t.avatar_url,
                t.industry_tags, t.status, t.is_featured, t.sort_order, t.reviewed_at,
                t.updated_at, t.created_at, t.admin_operated_at, t.payment_expire_at,
                t.payment_start_at, t.payment_status, m.avatar AS member_avatar, m.name AS member_name, m.user_category
         FROM talent_applications t
         LEFT JOIN members m ON m.id = t.member_id`
      : `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name, m.user_category
         FROM talent_applications t
         LEFT JOIN members m ON m.id = t.member_id`
    const rows = await queryRows(
      `${selectSql}
       ${whereSql}
       ORDER BY t.is_featured DESC, t.sort_order ASC,
                COALESCE(t.admin_operated_at, t.created_at) DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    )
    return {
      list: await this.signTalents(rows, { maskContact: true, list: listFields }),
      total: Number(countRow?.total || 0),
      page,
      pageSize,
    }
  }

  async getApprovedById(id: string) {
    const row = await queryOne(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name,
              m.available_points, m.total_points, m.created_at AS member_created_at,
              m.user_category
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       WHERE t.id = ? AND t.status = 'approved'`,
      [id],
    )
    if (!row) throw new HttpException('人才不存在或未通过审核', HttpStatus.NOT_FOUND)

    try {
      await queryExecute(
        'UPDATE talent_applications SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?',
        [id],
      )
    } catch (error) {
      console.warn('[TalentService] increment talent view_count failed:', error)
    }

    const signed = await this.signTalent(row, { maskContact: true })

    let departments: Array<{ department_id: number; department_name: string; position: string }> = []
    try {
      const deptRows = await queryRows(
        `SELECT md.department_id, md.position, d.name AS department_name
         FROM member_departments md
         INNER JOIN departments d ON d.id = md.department_id
         WHERE md.member_id = ?
         ORDER BY md.is_primary DESC, md.id ASC`,
        [row.member_id],
      )
      departments = (deptRows || []).map((item: any) => ({
        department_id: item.department_id,
        department_name: item.department_name || '',
        position: item.position || '',
      }))
    } catch (error) {
      console.warn('[TalentService] load departments failed', error)
    }

    let dealCount = 0
    let dealAmountWan = 0
    try {
      const dealRow = await queryOne(
        `SELECT COUNT(*) AS cnt,
                COALESCE(SUM(contract_amount), 0) AS amount
         FROM project_deal_applications
         WHERE is_deal = 1 AND (member_id = ? OR owner_member_id = ?)`,
        [row.member_id, row.member_id],
      )
      dealCount = Number(dealRow?.cnt || 0)
      const amountYuan = Number(dealRow?.amount || 0)
      dealAmountWan = Math.round((amountYuan / 10000) * 100) / 100
    } catch {
      try {
        const legacy = await queryOne(
          `SELECT COUNT(*) AS cnt FROM transactions
           WHERE status = 'completed'
             AND (party_a_id = ? OR party_b_id = ? OR matcher_id = ?)`,
          [row.member_id, row.member_id, row.member_id],
        )
        dealCount = Number(legacy?.cnt || 0)
      } catch {
        dealCount = 0
      }
    }

    const createdAt = row.member_created_at || row.created_at
    const memberDays = createdAt
      ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000) + 1)
      : 0

    return {
      ...signed,
      view_count: Number(row.view_count || 0) + 1,
      departments,
      department_text: departments
        .map((d) => [d.department_name, d.position].filter(Boolean).join(' · '))
        .filter(Boolean)
        .join('；'),
      available_points: Number(row.available_points || 0),
      total_points: Number(row.total_points || 0),
      member_days: memberDays,
      deal_count: dealCount,
      deal_amount_wan: dealAmountWan,
    }
  }

  /**
   * 项目分享收件人：与后台「人才管理」审核通过名单对齐。
   * - 不按会员 status / 缴费状态过滤（避免 approved 会员、未缴费人才被漏掉）
   * - 默认不排除本人，由前端标记 is_self 禁用勾选；提交时再过滤
   */
  async listApprovedShareRecipients(options?: {
    excludeMemberId?: string | number
    memberIds?: Array<string | number>
  }) {
    const where = [`t.status = 'approved'`, 't.member_id IS NOT NULL']
    const values: Array<string | number> = []
    if (options?.excludeMemberId != null && options.excludeMemberId !== '') {
      where.push('CAST(t.member_id AS CHAR) != ?')
      values.push(String(options.excludeMemberId))
    }
    const memberIds = [...new Set(
      (options?.memberIds || []).map((id) => String(id || '').trim()).filter(Boolean),
    )]
    if (memberIds.length) {
      where.push(`CAST(t.member_id AS CHAR) IN (${memberIds.map(() => '?').join(', ')})`)
      values.push(...memberIds)
    }

    return queryRows(
      `SELECT t.member_id, t.real_name, t.company_name, t.job_title
       FROM talent_applications t
       WHERE ${where.join(' AND ')}
       ORDER BY t.real_name ASC, t.id DESC`,
      values,
    )
  }

  async getMine(memberId: string) {
    const row = await queryOne(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       WHERE t.member_id = ?`,
      [memberId],
    )
    return this.signTalent(this.applyPendingView(row))
  }

  /**
   * 人才公司/职位同步到会员资料，供项目管理「公司→负责人」关联使用。
   * 会员表 company_name 为 VARCHAR(100)，超出截断。
   */
  private async syncMemberProfileFromTalent(
    memberId: string | number | null | undefined,
    opts: { company_name?: string | null; job_title?: string | null },
  ) {
    if (memberId == null || memberId === '') return
    const company = String(opts.company_name || '').trim().slice(0, 100)
    const jobTitle = String(opts.job_title || '').trim().slice(0, 128)
    if (!company && !jobTitle) return

    const sets: string[] = []
    const params: any[] = []
    if (company) {
      sets.push('company_name = ?')
      params.push(company)
    }
    if (jobTitle) {
      sets.push('company_position = ?')
      params.push(jobTitle)
    }
    params.push(memberId)
    try {
      await queryExecute(
        `UPDATE members SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params,
      )
    } catch (error) {
      console.warn('[TalentService] sync member company from talent failed:', error)
    }
  }

  private validateApplicationPayload(dto: any, partial = false) {
    const realName = dto.real_name !== undefined ? String(dto.real_name || '').trim() : undefined
    const contact = dto.contact !== undefined ? String(dto.contact || '').trim() : undefined
    const companyName = dto.company_name !== undefined ? String(dto.company_name || '').trim() : undefined
    const jobTitle = dto.job_title !== undefined ? String(dto.job_title || '').trim() : undefined
    const tags = dto.industry_tags !== undefined ? parseIndustryTags(dto.industry_tags) : undefined

    if (!partial || dto.real_name !== undefined) {
      if (!realName) throw new HttpException('真实姓名不能为空', HttpStatus.BAD_REQUEST)
    }
    if (!partial || dto.contact !== undefined) {
      if (!contact) throw new HttpException('联系方式不能为空', HttpStatus.BAD_REQUEST)
    }
    if (!partial || dto.company_name !== undefined) {
      if (!companyName) throw new HttpException('公司名称不能为空', HttpStatus.BAD_REQUEST)
    }
    if (!partial || dto.photo_url !== undefined) {
      if (!dto.photo_url) throw new HttpException('职业照片不能为空', HttpStatus.BAD_REQUEST)
    }
    if (!partial || dto.industry_tags !== undefined) {
      if (!tags?.length) throw new HttpException('请选择至少一个行业标签', HttpStatus.BAD_REQUEST)
    }

    return {
      real_name: realName,
      contact,
      company_name: companyName,
      job_title: jobTitle || null,
      industry_tags: tags,
      experience: dto.experience !== undefined ? String(dto.experience || '').trim() || null : undefined,
      photo_url: dto.photo_url !== undefined ? normalizeOptionalImage(dto.photo_url) : undefined,
      card_image_url: dto.card_image_url !== undefined ? normalizeOptionalImage(dto.card_image_url) : undefined,
      avatar_url: dto.avatar_url !== undefined ? normalizeOptionalImage(dto.avatar_url) : undefined,
    }
  }

  async apply(memberId: string, dto: any) {
    const existing = await queryOne('SELECT id, status FROM talent_applications WHERE member_id = ?', [memberId])
    if (existing) {
      return this.updateMine(memberId, dto)
    }

    const payload = this.validateApplicationPayload(dto, false)
    const avatarUrl = payload.avatar_url || payload.photo_url || null
    await queryExecute(
      `INSERT INTO talent_applications
        (member_id, real_name, contact, company_name, job_title, photo_url, industry_tags, experience,
         card_image_url, avatar_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        memberId,
        payload.real_name,
        payload.contact,
        payload.company_name,
        payload.job_title,
        payload.photo_url,
        JSON.stringify(payload.industry_tags),
        payload.experience || null,
        payload.card_image_url || null,
        avatarUrl,
      ],
    )
    await this.syncMemberProfileFromTalent(memberId, {
      company_name: payload.company_name,
      job_title: payload.job_title,
    })
    return this.getMine(memberId)
  }

  private normalizeApplyType(value: unknown): 'promoter' | 'member_unit' | null {
    const raw = String(value || '').trim()
    if (raw === 'promoter' || raw === 'member_unit') return raw
    return null
  }

  private normalizePaymentMethod(value: unknown): string | null {
    const raw = String(value || '').trim()
    if (['offline', 'wechat', 'bank'].includes(raw)) return raw
    return null
  }

  private applyTypeLabel(value: unknown): string {
    const type = this.normalizeApplyType(value)
    if (type === 'promoter') return '推广员'
    if (type === 'member_unit') return '会员单位'
    return '-'
  }

  private paymentMethodLabel(value: unknown): string {
    const raw = String(value || '').trim()
    if (raw === 'offline') return '线下缴费'
    if (raw === 'wechat') return '微信支付'
    if (raw === 'bank') return '银行转账'
    return '-'
  }

  /** 推广员/会员单位升级申请（含缴费字段，与普通人才入驻分离） */
  async memberApply(memberId: string, dto: any) {
    const applyType = this.normalizeApplyType(dto.apply_type)
    if (!applyType) {
      throw new HttpException('请选择申请类型', HttpStatus.BAD_REQUEST)
    }
    const paymentMethod = this.normalizePaymentMethod(dto.payment_method)
    if (!paymentMethod) {
      throw new HttpException('请选择缴费方式', HttpStatus.BAD_REQUEST)
    }
    const paymentStatus = String(dto.payment_status || 'unpaid').trim() === 'paid' ? 'paid' : 'unpaid'

    const payload = this.validateApplicationPayload(dto, false)
    const avatarUrl = payload.avatar_url || payload.photo_url || null
    const existing = await queryOne('SELECT id, status FROM talent_applications WHERE member_id = ?', [memberId])

    if (existing) {
      await queryExecute(
        `UPDATE talent_applications SET
           real_name = ?, contact = ?, company_name = ?, job_title = ?, photo_url = ?,
           industry_tags = ?, experience = ?, card_image_url = ?, avatar_url = ?,
           apply_type = ?, payment_status = ?, payment_method = ?,
           status = 'pending', reject_reason = NULL, reviewed_at = NULL, reviewed_by = NULL,
           updated_at = NOW()
         WHERE member_id = ?`,
        [
          payload.real_name,
          payload.contact,
          payload.company_name,
          payload.job_title,
          payload.photo_url,
          JSON.stringify(payload.industry_tags),
          payload.experience || null,
          payload.card_image_url || null,
          avatarUrl,
          applyType,
          paymentStatus,
          paymentMethod,
          memberId,
        ],
      )
    } else {
      await queryExecute(
        `INSERT INTO talent_applications
          (member_id, real_name, contact, company_name, job_title, photo_url, industry_tags, experience,
           card_image_url, avatar_url, apply_type, payment_status, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          memberId,
          payload.real_name,
          payload.contact,
          payload.company_name,
          payload.job_title,
          payload.photo_url,
          JSON.stringify(payload.industry_tags),
          payload.experience || null,
          payload.card_image_url || null,
          avatarUrl,
          applyType,
          paymentStatus,
          paymentMethod,
        ],
      )
    }

    await this.syncMemberProfileFromTalent(memberId, {
      company_name: payload.company_name,
      job_title: payload.job_title,
    })

    await createNotification({
      memberId,
      type: 'approval',
      title: '会员升级申请已提交',
      content: `您的${this.applyTypeLabel(applyType)}申请已提交，请等待后台审核`,
      link: '/pages/member-apply/index',
      bizType: 'talent_audit',
      bizId: memberId,
      result: 'pending',
    })

    return this.getMine(memberId)
  }

  async updateMine(memberId: string, dto: any) {
    const existing = await queryOne('SELECT * FROM talent_applications WHERE member_id = ?', [memberId])
    if (!existing) throw new HttpException('尚未提交人才申请', HttpStatus.NOT_FOUND)

    const merged = {
      real_name: dto.real_name !== undefined ? dto.real_name : existing.real_name,
      contact: dto.contact !== undefined ? dto.contact : existing.contact,
      company_name: dto.company_name !== undefined ? dto.company_name : existing.company_name,
      job_title: dto.job_title !== undefined ? dto.job_title : existing.job_title,
      photo_url: dto.photo_url !== undefined ? dto.photo_url : existing.photo_url,
      industry_tags: dto.industry_tags !== undefined ? dto.industry_tags : existing.industry_tags,
      experience: dto.experience !== undefined ? dto.experience : existing.experience,
      card_image_url: dto.card_image_url !== undefined ? dto.card_image_url : existing.card_image_url,
      avatar_url: dto.avatar_url !== undefined ? dto.avatar_url : existing.avatar_url,
    }
    const payload = this.validateApplicationPayload(merged, false)
    const avatarUrl = payload.avatar_url || payload.photo_url || null
    const nextData = {
      real_name: payload.real_name,
      contact: payload.contact,
      company_name: payload.company_name,
      job_title: payload.job_title,
      photo_url: payload.photo_url,
      industry_tags: payload.industry_tags,
      experience: payload.experience || null,
      card_image_url: payload.card_image_url || null,
      avatar_url: avatarUrl,
    }

    if (String(existing.status) === 'approved') {
      await queryExecute(
        `UPDATE talent_applications SET
           pending_data = ?, update_status = 'pending',
           update_reject_reason = NULL, reviewed_at = NULL, reviewed_by = NULL
         WHERE member_id = ?`,
        [JSON.stringify(nextData), memberId],
      )
      return this.getMine(memberId)
    }

    await queryExecute(
      `UPDATE talent_applications SET
        real_name = ?, contact = ?, company_name = ?, job_title = ?, photo_url = ?, industry_tags = ?, experience = ?,
        card_image_url = ?, avatar_url = ?, status = 'pending', reject_reason = NULL,
        reviewed_at = NULL, reviewed_by = NULL
       WHERE member_id = ?`,
      [
        payload.real_name,
        payload.contact,
        payload.company_name,
        payload.job_title,
        payload.photo_url,
        JSON.stringify(payload.industry_tags),
        payload.experience || null,
        payload.card_image_url || null,
        avatarUrl,
        memberId,
      ],
    )
    await this.syncMemberProfileFromTalent(memberId, {
      company_name: payload.company_name,
      job_title: payload.job_title,
    })
    return this.getMine(memberId)
  }

  async adminList(query: any = {}) {
    const where: string[] = []
    const values: any[] = []
    if (query.status && TALENT_STATUSES.includes(query.status)) {
      if (query.status === 'approved') {
        where.push(`t.status = 'approved' AND (t.update_status IS NULL OR t.update_status = '')`)
      } else {
        where.push('(t.status = ? OR t.update_status = ?)')
        values.push(query.status, query.status)
      }
    }
    if (query.keyword) {
      where.push(`(
        t.real_name LIKE ? OR t.contact LIKE ? OR CAST(t.member_id AS CHAR) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(t.pending_data, '$.real_name')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(t.pending_data, '$.contact')) LIKE ?
      )`)
      const kw = `%${query.keyword}%`
      values.push(kw, kw, kw, kw, kw)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await queryRows(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name, m.phone AS member_phone, m.user_category
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       ${whereSql}
       ORDER BY
         CASE COALESCE(NULLIF(t.update_status, ''), t.status)
           WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
         t.updated_at DESC`,
      values,
    )
    return this.signTalents((rows || []).map((row: any) => this.applyPendingView(row)))
  }

  async adminGetById(id: string) {
    const row = await queryOne(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name, m.phone AS member_phone, m.user_category
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       WHERE t.id = ?`,
      [id],
    )
    if (!row) throw new HttpException('人才申请不存在', HttpStatus.NOT_FOUND)
    return this.signTalent(this.applyPendingView(row))
  }

  /** 后台直接新增人才（须绑定尚未入驻的会员） */
  async adminCreate(dto: any) {
    const memberId = Number(dto?.member_id)
    if (!Number.isInteger(memberId) || memberId <= 0) {
      throw new HttpException('请选择关联会员', HttpStatus.BAD_REQUEST)
    }
    const member = await queryOne(
      'SELECT id, name, phone, avatar FROM members WHERE id = ?',
      [memberId],
    )
    if (!member) throw new HttpException('关联会员不存在', HttpStatus.NOT_FOUND)

    const existing = await queryOne(
      'SELECT id FROM talent_applications WHERE member_id = ?',
      [memberId],
    )
    if (existing) {
      throw new HttpException('该会员已有人才记录，请直接编辑', HttpStatus.BAD_REQUEST)
    }

    const payload = this.validateApplicationPayload(
      {
        real_name: dto.real_name || member.name,
        contact: dto.contact || member.phone,
        company_name: dto.company_name,
        job_title: dto.job_title,
        industry_tags: dto.industry_tags,
        experience: dto.experience,
        photo_url: dto.photo_url,
        card_image_url: dto.card_image_url,
        avatar_url: dto.avatar_url || member.avatar,
      },
      false,
    )
    if (!payload.photo_url) {
      throw new HttpException('请上传职业照片', HttpStatus.BAD_REQUEST)
    }

    const status: TalentStatus = TALENT_STATUSES.includes(dto.status) ? dto.status : 'approved'
    if (status === 'rejected' && !String(dto.reject_reason || '').trim()) {
      throw new HttpException('未通过时请填写原因', HttpStatus.BAD_REQUEST)
    }

    const avatarUrl = payload.avatar_url || payload.photo_url || null
    const isFeatured = dto.is_featured ? 1 : 0
    const sortOrder = Math.max(0, Number(dto.sort_order) || 0)
    const rejectReason = status === 'rejected' ? String(dto.reject_reason || '').trim() : null
    const reviewedBy = status === 'pending' ? null : dto.reviewed_by || null

    const result = await queryExecute(
      `INSERT INTO talent_applications
        (member_id, real_name, contact, company_name, job_title, photo_url, industry_tags, experience,
         card_image_url, avatar_url, status, reject_reason, is_featured, sort_order,
         reviewed_at, reviewed_by, admin_operated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${status === 'pending' ? 'NULL' : 'NOW()'}, ?, NOW())`,
      [
        memberId,
        payload.real_name,
        payload.contact,
        payload.company_name,
        payload.job_title,
        payload.photo_url,
        JSON.stringify(payload.industry_tags),
        payload.experience || null,
        payload.card_image_url || null,
        avatarUrl,
        status,
        rejectReason,
        isFeatured,
        sortOrder,
        reviewedBy,
      ],
    )

    const id = String(result.insertId)

    await this.syncMemberProfileFromTalent(memberId, {
      company_name: payload.company_name,
      job_title: payload.job_title,
    })

    // 缴费信息复用 update 逻辑
    if (
      dto.payment_status !== undefined
      || dto.payment_start_at !== undefined
      || dto.membership_years !== undefined
    ) {
      await this.adminUpdate(id, {
        payment_status: dto.payment_status,
        payment_start_at: dto.payment_start_at,
        membership_years: dto.membership_years,
      })
    }

    if (status === 'approved') {
      void this.pointsEngine
        .evaluate(String(memberId), 'talent_settle', {
          referenceType: 'talent',
          referenceId: id,
          description: '完成人才入驻奖励积分',
        })
        .catch((err) => console.warn('[TalentService] points evaluate failed', err))
      void this.invitationEngine
        .grantConditionRewards(String(memberId), 'invitee_talent', {
          description: '推荐会员完成人才入驻',
          referenceId: id,
        })
        .catch((err) => console.warn('[TalentService] invite reward failed', err))
      await createNotification({
        memberId: String(memberId),
        type: 'approval',
        title: '人才入驻审核通过',
        content: `您的人才资料「${payload.real_name}」已由管理员录入并通过`,
        link: '/pages/talent-settle/index',
        bizType: 'talent_audit',
        bizId: id,
        result: 'approved',
      })
    }

    return this.adminGetById(id)
  }

  async adminUpdate(id: string, dto: any) {
    const existing = await queryOne('SELECT * FROM talent_applications WHERE id = ?', [id])
    if (!existing) throw new HttpException('人才申请不存在', HttpStatus.NOT_FOUND)

    const pendingData = this.parsePendingData((existing as any).pending_data)
    const isPendingProfileUpdate =
      String((existing as any).status) === 'approved'
      && String((existing as any).update_status) === 'pending'
      && !!pendingData

    if (isPendingProfileUpdate && (dto.status === 'approved' || dto.status === 'rejected')) {
      const memberId = (existing as any).member_id
      if (dto.status === 'approved') {
        await queryExecute(
          `UPDATE talent_applications SET
             real_name = ?, contact = ?, company_name = ?, job_title = ?,
             photo_url = ?, industry_tags = ?, experience = ?,
             card_image_url = ?, avatar_url = ?,
             pending_data = NULL, update_status = NULL, update_reject_reason = NULL,
             status = 'approved', reject_reason = NULL,
             reviewed_at = NOW(), reviewed_by = ?,
             admin_operated_at = NOW()
           WHERE id = ?`,
          [
            pendingData.real_name,
            pendingData.contact,
            pendingData.company_name,
            pendingData.job_title || null,
            pendingData.photo_url || null,
            JSON.stringify(parseIndustryTags(pendingData.industry_tags)),
            pendingData.experience || null,
            pendingData.card_image_url || null,
            pendingData.avatar_url || pendingData.photo_url || null,
            dto.reviewed_by || null,
            id,
          ],
        )
        await this.syncMemberProfileFromTalent(memberId, {
          company_name: pendingData.company_name,
          job_title: pendingData.job_title,
        })
      } else {
        await queryExecute(
          `UPDATE talent_applications SET
             update_status = 'rejected', update_reject_reason = ?,
             reviewed_at = NOW(), reviewed_by = ?,
             admin_operated_at = NOW()
           WHERE id = ?`,
          [
            String(dto.reject_reason || '').trim() || '资料修改未通过审核',
            dto.reviewed_by || null,
            id,
          ],
        )
      }

      const result = await this.adminGetById(id)
      await createNotification({
        memberId,
        type: 'approval',
        title: dto.status === 'approved' ? '人才资料修改审核通过' : '人才资料修改审核未通过',
        content:
          dto.status === 'approved'
            ? '您修改的人才资料已通过审核并更新展示'
            : `您修改的人才资料未通过审核：${String(dto.reject_reason || '').trim() || '请修改后重新提交'}`,
        link: '/pages/talent-settle/index',
        bizType: 'talent_profile_audit',
        bizId: id,
        result: dto.status,
      })
      return result
    }

    const updates: string[] = []
    const params: any[] = []
    const assign = (col: string, value: unknown) => {
      updates.push(`${col} = ?`)
      params.push(value)
    }

    if (dto.real_name !== undefined) assign('real_name', String(dto.real_name || '').trim())
    if (dto.contact !== undefined) assign('contact', String(dto.contact || '').trim())
    if (dto.company_name !== undefined) assign('company_name', String(dto.company_name || '').trim())
    if (dto.job_title !== undefined) assign('job_title', String(dto.job_title || '').trim() || null)
    if (dto.experience !== undefined) assign('experience', String(dto.experience || '').trim() || null)
    if (dto.industry_tags !== undefined) {
      const tags = parseIndustryTags(dto.industry_tags)
      assign('industry_tags', JSON.stringify(tags))
    }
    if (dto.photo_url !== undefined) assign('photo_url', normalizeOptionalImage(dto.photo_url))
    if (dto.card_image_url !== undefined) assign('card_image_url', normalizeOptionalImage(dto.card_image_url))
    if (dto.avatar_url !== undefined) {
      assign('avatar_url', normalizeOptionalImage(dto.avatar_url))
    } else if (dto.photo_url !== undefined && !existing.avatar_url) {
      // 后台仅改职业照时，补齐空头像字段
      assign('avatar_url', normalizeOptionalImage(dto.photo_url))
    }
    if (dto.is_featured !== undefined) assign('is_featured', dto.is_featured ? 1 : 0)
    if (dto.sort_order !== undefined) {
      assign('sort_order', Math.max(0, Number(dto.sort_order) || 0))
    }
    if (dto.status !== undefined) {
      if (!TALENT_STATUSES.includes(dto.status)) {
        throw new HttpException('状态无效', HttpStatus.BAD_REQUEST)
      }
      assign('status', dto.status)
      if (dto.status === 'rejected') {
        assign('reject_reason', String(dto.reject_reason || '').trim() || '未通过审核')
      }
      if (dto.status === 'approved') {
        assign('reject_reason', null)
      }
      assign('reviewed_at', new Date())
      if (dto.reviewed_by !== undefined) assign('reviewed_by', dto.reviewed_by || null)
    } else     if (dto.reject_reason !== undefined) {
      assign('reject_reason', String(dto.reject_reason || '').trim() || null)
    }

    // 缴费会员：开始时间 + 年限（1/2/3）→ 自动计算到期日
    if (
      dto.payment_status !== undefined
      || dto.payment_start_at !== undefined
      || dto.membership_years !== undefined
    ) {
      const paymentStatus = String(dto.payment_status ?? existing.payment_status ?? 'unpaid').trim()
      if (!['unpaid', 'paid', 'expired'].includes(paymentStatus)) {
        throw new HttpException('缴费状态无效', HttpStatus.BAD_REQUEST)
      }
      assign('payment_status', paymentStatus)

      if (paymentStatus === 'unpaid') {
        assign('payment_start_at', null)
        assign('membership_years', 0)
        assign('payment_expire_at', null)
      } else {
        const years = Number(dto.membership_years ?? existing.membership_years ?? 0)
        if (![1, 2, 3].includes(years) && paymentStatus === 'paid') {
          throw new HttpException('请选择一年/二年/三年缴会员', HttpStatus.BAD_REQUEST)
        }
        const startRaw = String(dto.payment_start_at ?? existing.payment_start_at ?? '').slice(0, 10)
        if (paymentStatus === 'paid' && !/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) {
          throw new HttpException('请填写缴费开始时间', HttpStatus.BAD_REQUEST)
        }
        let expire: string | null = null
        if (startRaw && years > 0) {
          const startDate = new Date(`${startRaw}T00:00:00`)
          startDate.setFullYear(startDate.getFullYear() + years)
          expire = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
        }
        assign('payment_start_at', startRaw || null)
        assign('membership_years', years || 0)
        assign('payment_expire_at', expire)
      }
    }

    if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    updates.push('admin_operated_at = NOW()')
    params.push(id)
    await queryExecute(`UPDATE talent_applications SET ${updates.join(', ')} WHERE id = ?`, params)
    const result = await this.adminGetById(id)
    const memberId = (result as any)?.member_id
    if (
      memberId
      && (
        dto.company_name !== undefined
        || dto.job_title !== undefined
        || dto.status === 'approved'
      )
    ) {
      await this.syncMemberProfileFromTalent(memberId, {
        company_name: (result as any).company_name,
        job_title: (result as any).job_title,
      })
    }
    if (
      memberId
      && dto.status
      && String(existing.status) !== String(dto.status)
      && (dto.status === 'approved' || dto.status === 'rejected')
    ) {
      await createNotification({
        memberId,
        type: 'approval',
        title: dto.status === 'approved' ? '人才入驻审核通过' : '人才入驻审核未通过',
        content:
          dto.status === 'approved'
            ? `您的人才入驻申请「${(result as any).real_name || ''}」已通过审核`
            : `您的人才入驻申请未通过审核${(result as any).reject_reason ? `：${(result as any).reject_reason}` : ''}`,
        link: '/pages/talent-settle/index',
        bizType: 'talent_audit',
        bizId: id,
        result: dto.status,
      })
    }
    if (dto.status === 'approved' && memberId) {
      const applyType = this.normalizeApplyType((result as any)?.apply_type)
      if (applyType) {
        await queryExecute(
          `UPDATE members SET user_category = ?, updated_at = NOW() WHERE id = ?`,
          [applyType, memberId],
        )
      }
      void this.pointsEngine
        .evaluate(memberId, 'talent_settle', {
          referenceType: 'talent',
          referenceId: id,
          description: '完成人才入驻奖励积分',
        })
        .catch((err) => console.warn('[TalentService] points evaluate failed', err))
      void this.invitationEngine
        .grantConditionRewards(memberId, 'invitee_talent', {
          description: '推荐会员完成人才入驻',
          referenceId: id,
        })
        .catch((err) => console.warn('[TalentService] invite reward failed', err))
    }
    if (
      memberId
      && (result as any)?.membership_active
      && String(existing.payment_status) !== 'paid'
      && String((result as any).payment_status) === 'paid'
    ) {
      void this.invitationEngine
        .grantConditionRewards(memberId, 'invitee_paid_member', {
          description: '推荐会员成为缴费会员',
          referenceId: id,
        })
        .catch((err) => console.warn('[TalentService] paid member invite reward failed', err))
    }
    return result
  }

  async adminReview(id: string, dto: { status: TalentStatus; reject_reason?: string; reviewed_by?: string }) {
    if (!TALENT_STATUSES.includes(dto.status) || dto.status === 'pending') {
      throw new HttpException('审核状态无效', HttpStatus.BAD_REQUEST)
    }
    if (dto.status === 'rejected' && !String(dto.reject_reason || '').trim()) {
      throw new HttpException('请填写未通过原因', HttpStatus.BAD_REQUEST)
    }
    return this.adminUpdate(id, {
      status: dto.status,
      reject_reason: dto.reject_reason,
      reviewed_by: dto.reviewed_by,
    })
  }

  async adminRemove(id: string) {
    const existing = await queryOne(
      'SELECT id, status, update_status FROM talent_applications WHERE id = ?',
      [id],
    )
    if (!existing) {
      throw new HttpException('人才申请不存在', HttpStatus.NOT_FOUND)
    }
    // 已入驻人才若仅有「资料更新待审」，删除应清掉待审资料，而不是整行硬删导致公开展示消失
    if (
      String(existing.status) === 'approved'
      && String(existing.update_status || '').trim()
    ) {
      await queryExecute(
        `UPDATE talent_applications SET
           pending_data = NULL, update_status = NULL, update_reject_reason = NULL,
           updated_at = NOW()
         WHERE id = ?`,
        [id],
      )
      return { success: true, cleared_pending_update: true }
    }
    await queryExecute('DELETE FROM talent_applications WHERE id = ?', [id])
    return { success: true }
  }
}
