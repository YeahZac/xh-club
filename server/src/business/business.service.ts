import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'
import { RoadshowService } from './roadshow.service'
import { createNotification } from '@/common/notify'

export const BUSINESS_CATEGORIES = ['roadshow', 'financing', 'resource'] as const
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]
export const USER_BUSINESS_CATEGORIES = ['financing', 'resource'] as const
export const BUSINESS_SOURCES = ['admin', 'user'] as const
export const BUSINESS_AUDIT_STATUSES = ['pending', 'approved', 'rejected'] as const

function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === 'string' && (BUSINESS_CATEGORIES as readonly string[]).includes(value)
}

function isUserBusinessCategory(value: unknown): value is (typeof USER_BUSINESS_CATEGORIES)[number] {
  return typeof value === 'string' && (USER_BUSINESS_CATEGORIES as readonly string[]).includes(value)
}

/** MySQL DATETIME 不接受 ISO（含 T/Z），统一转为 `YYYY-MM-DD HH:mm:ss` */
function toMysqlDateTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' && !(value instanceof Date)) return null

  const raw = value instanceof Date ? value.toISOString() : value.trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.length === 16 ? `${raw}:00` : raw
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const normalized = raw.replace('T', ' ')
    return normalized.length === 16 ? `${normalized}:00` : normalized
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

@Injectable()
export class BusinessService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly roadshowService: RoadshowService,
  ) {}

  private formatBusinessRow(row: any) {
    if (!row) return row
    const source = row.source || 'admin'
    const audit = row.audit_status || 'approved'
    return {
      ...row,
      source,
      audit_status: audit,
      source_label: source === 'user' ? '用户上传' : '管理员上传',
      audit_status_label:
        audit === 'pending' ? '待审核' : audit === 'rejected' ? '未通过' : '已通过',
      demand_talent_name: row.demand_talent_name || row.demand_member_name || null,
    }
  }

  private async notifyMember(
    memberId: string | number | null | undefined,
    payload: {
      type: string
      title: string
      content: string
      link?: string
      bizType?: string
      bizId?: string | number
      result?: string
    },
  ) {
    if (!memberId) return
    await createNotification({
      memberId,
      type: payload.type,
      title: payload.title,
      content: payload.content,
      link: payload.link,
      bizType: payload.bizType,
      bizId: payload.bizId,
      result: payload.result,
    })
  }

  async list(
    params: { category?: string; status?: string; page?: number; pageSize?: number },
    memberId?: string | number,
  ) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const where: string[] = []
    const values: any[] = []

    if (params.category && isBusinessCategory(params.category)) {
      where.push('b.category = ?')
      values.push(params.category)
    }
    if (params.status) {
      where.push('b.status = ?')
      values.push(params.status)
    } else {
      where.push(`b.status = 'published'`)
    }
    // 仅展示已通过审核（兼容旧数据 audit_status 为空）
    where.push(`(b.audit_status = 'approved' OR b.audit_status IS NULL OR b.audit_status = '')`)

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM business_opportunities b ${whereSql}`,
      values,
    )
    const rows = await queryRows(
      `SELECT b.*,
              COALESCE(NULLIF(t.real_name, ''), NULLIF(m.name, '')) AS demand_talent_name
       FROM business_opportunities b
       LEFT JOIN talent_applications t ON t.id = b.demand_talent_id
       LEFT JOIN members m ON m.id = b.user_id
       ${whereSql}
       ORDER BY b.sort_order ASC, b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    )
    let list = (await this.uploadService.signRowsFields(rows, ['cover_image']) || []).map((r) =>
      this.formatBusinessRow(r),
    )

    if (memberId && list.length) {
      const roadshowIds = list
        .filter((item: any) => item.category === 'roadshow')
        .map((item: any) => item.id)
        .filter(Boolean)
      let registeredIds = new Set<string>()
      if (roadshowIds.length) {
        try {
          const placeholders = roadshowIds.map(() => '?').join(', ')
          const regs = await queryRows(
            `SELECT business_id FROM roadshow_registrations
             WHERE member_id = ? AND business_id IN (${placeholders})`,
            [memberId, ...roadshowIds],
          )
          registeredIds = new Set((regs || []).map((row: any) => String(row.business_id)))
        } catch (err) {
          console.warn('[BusinessService] load roadshow registration flags failed', err)
        }
      }
      list = list.map((item: any) => ({
        ...item,
        is_registered:
          item.category === 'roadshow' ? registeredIds.has(String(item.id)) : false,
      }))
    } else {
      list = list.map((item: any) => ({ ...item, is_registered: false }))
    }

    return {
      list,
      total: Number(countRow?.total || 0),
      page,
      pageSize,
    }
  }

  async getById(id: string, memberId?: string | number) {
    const row = await queryOne(
      `SELECT b.*,
              COALESCE(NULLIF(t.real_name, ''), NULLIF(m.name, '')) AS demand_talent_name
       FROM business_opportunities b
       LEFT JOIN talent_applications t ON t.id = b.demand_talent_id
       LEFT JOIN members m ON m.id = b.user_id
       WHERE b.id = ?`,
      [id],
    )
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)

    const audit = row.audit_status || 'approved'
    const isOwner = memberId != null && String(row.user_id) === String(memberId)
    const isPublic = row.status === 'published' && (audit === 'approved' || !row.audit_status)
    if (!isPublic && !isOwner) {
      throw new HttpException('商机不存在或未通过审核', HttpStatus.NOT_FOUND)
    }

    if (isPublic) {
      await queryExecute(
        'UPDATE business_opportunities SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?',
        [id],
      )
      row.view_count = Number(row.view_count || 0) + 1
    }

    const signed = await this.uploadService.signDetailMediaFields(
      this.formatBusinessRow(row),
      ['cover_image'],
      ['content', 'description', 'summary'],
    )
    if (signed.category === 'roadshow') {
      return this.roadshowService.enrichBusinessRow(signed, memberId)
    }
    return signed
  }

  async adminList(query: any) {
    const where: string[] = []
    const values: any[] = []
    if (query?.category && isBusinessCategory(query.category)) {
      where.push('b.category = ?')
      values.push(query.category)
    }
    if (query?.status) {
      where.push('b.status = ?')
      values.push(query.status)
    }
    if (query?.audit_status) {
      where.push('b.audit_status = ?')
      values.push(query.audit_status)
    }
    if (query?.source) {
      where.push('b.source = ?')
      values.push(query.source)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await queryRows(
      `SELECT b.*,
              COALESCE(NULLIF(t.real_name, ''), NULLIF(m.name, '')) AS demand_talent_name
       FROM business_opportunities b
       LEFT JOIN talent_applications t ON t.id = b.demand_talent_id
       LEFT JOIN members m ON m.id = b.user_id
       ${whereSql}
       ORDER BY
         CASE WHEN b.audit_status = 'pending' THEN 0 ELSE 1 END,
         b.created_at DESC`,
      values,
    )
    const signed = await this.uploadService.signRowsFields(rows, ['cover_image'])
    return (signed || []).map((r) => this.formatBusinessRow(r))
  }

  private normalizeContactPhone(category: string, phone: unknown) {
    if (category !== 'financing' && category !== 'resource') return null
    const value = String(phone || '').trim()
    return value || null
  }

  private normalizeDemandTalentId(category: string, talentId: unknown) {
    if (category !== 'financing' && category !== 'resource') return null
    if (talentId == null || talentId === '') return null
    const id = Number(talentId)
    return Number.isFinite(id) && id > 0 ? id : null
  }

  async create(dto: any, options?: { source?: 'admin' | 'user'; memberId?: string | number }) {
    if (!dto?.title?.trim()) throw new HttpException('标题不能为空', HttpStatus.BAD_REQUEST)
    if (!isBusinessCategory(dto.category)) {
      throw new HttpException('分类必须是项目路演/融资招募/资源对接', HttpStatus.BAD_REQUEST)
    }
    if (!dto.cover_image?.trim()) {
      throw new HttpException('封面图片为必填项', HttpStatus.BAD_REQUEST)
    }
    const source = options?.source || 'admin'
    const coverImage = assertCloudStorageImageUrl(dto.cover_image, true)
    const contactPhone = this.normalizeContactPhone(dto.category, dto.contact_phone)
    const demandTalentId = this.normalizeDemandTalentId(dto.category, dto.demand_talent_id)

    let status = dto.status || 'published'
    let auditStatus = dto.audit_status || 'approved'
    if (source === 'user') {
      if (!isUserBusinessCategory(dto.category)) {
        throw new HttpException('用户仅可发布融资招募或资源对接', HttpStatus.BAD_REQUEST)
      }
      status = 'draft'
      auditStatus = 'pending'
    }

    const result = await queryExecute(
      `INSERT INTO business_opportunities
        (title, category, summary, content, cover_image, industry, region, amount_min, amount_max, stage,
         contact_info, contact_phone, demand_talent_id, source, audit_status, reject_reason, user_id,
         status, sort_order, start_time, end_time, form_fields)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.title.trim(),
        dto.category,
        dto.summary || null,
        dto.content || null,
        coverImage,
        dto.industry || null,
        dto.region || null,
        dto.amount_min ?? null,
        dto.amount_max ?? null,
        dto.stage || null,
        dto.contact_info || null,
        contactPhone,
        demandTalentId,
        source,
        auditStatus,
        null,
        options?.memberId || dto.user_id || null,
        status,
        dto.sort_order || 0,
        dto.start_time ? toMysqlDateTime(dto.start_time) : null,
        dto.end_time ? toMysqlDateTime(dto.end_time) : null,
        dto.form_fields == null ? null : JSON.stringify(dto.form_fields),
      ],
    )
    const businessId = String(result.insertId)
    try {
      if (dto.category === 'roadshow' && dto.roadshow) {
        await this.roadshowService.saveConfig(businessId, {
          start_time: toMysqlDateTime(dto.start_time || dto.roadshow.start_time),
          end_time: toMysqlDateTime(dto.end_time || dto.roadshow.end_time),
          form_fields: dto.form_fields ?? dto.roadshow.form_fields,
          projects: dto.roadshow.projects,
          dimensions: dto.roadshow.dimensions,
        })
      }
      const created = await this.getAdminById(businessId)
      if (source === 'user' && options?.memberId) {
        await this.notifyMember(options.memberId, {
          type: 'approval',
          title: '动态已提交审核',
          content: `您发布的「${dto.title.trim()}」已提交，请等待后台审核`,
          link: `/pages/content-detail/index?type=business&id=${businessId}`,
          bizType: 'business_audit',
          bizId: businessId,
          result: 'pending',
        })
      }
      return created
    } catch (error) {
      try {
        await queryExecute('DELETE FROM roadshow_scores WHERE business_id = ?', [businessId])
        await queryExecute('DELETE FROM roadshow_registrations WHERE business_id = ?', [businessId])
        await queryExecute('DELETE FROM roadshow_projects WHERE business_id = ?', [businessId])
        await queryExecute('DELETE FROM roadshow_score_dimensions WHERE business_id = ?', [businessId])
        await queryExecute('DELETE FROM business_opportunities WHERE id = ?', [businessId])
      } catch (cleanupError) {
        console.error('[BusinessService] create 回滚失败:', cleanupError)
      }
      throw error
    }
  }

  async update(id: string, dto: any) {
    const existing = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!existing) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)

    const updates: string[] = []
    const params: any[] = []
    const assign = (col: string, value: unknown) => {
      updates.push(`${col} = ?`)
      params.push(value)
    }

    if (dto.title !== undefined) assign('title', String(dto.title || '').trim())
    if (dto.category !== undefined) {
      if (!isBusinessCategory(dto.category)) {
        throw new HttpException('分类无效', HttpStatus.BAD_REQUEST)
      }
      assign('category', dto.category)
    }
    if (dto.summary !== undefined) assign('summary', dto.summary || null)
    if (dto.content !== undefined) assign('content', dto.content || null)
    if (dto.cover_image !== undefined) {
      if (!String(dto.cover_image || '').trim()) {
        throw new HttpException('封面图片为必填项', HttpStatus.BAD_REQUEST)
      }
      assign('cover_image', assertCloudStorageImageUrl(dto.cover_image, true))
    }
    if (dto.industry !== undefined) assign('industry', dto.industry || null)
    if (dto.region !== undefined) assign('region', dto.region || null)
    if (dto.amount_min !== undefined) assign('amount_min', dto.amount_min ?? null)
    if (dto.amount_max !== undefined) assign('amount_max', dto.amount_max ?? null)
    if (dto.stage !== undefined) assign('stage', dto.stage || null)
    if (dto.contact_info !== undefined) assign('contact_info', dto.contact_info || null)
    if (dto.contact_phone !== undefined || dto.category !== undefined) {
      const category = dto.category || existing.category
      assign(
        'contact_phone',
        this.normalizeContactPhone(category, dto.contact_phone !== undefined ? dto.contact_phone : existing.contact_phone),
      )
    }
    if (dto.demand_talent_id !== undefined || dto.category !== undefined) {
      const category = dto.category || existing.category
      assign(
        'demand_talent_id',
        this.normalizeDemandTalentId(
          category,
          dto.demand_talent_id !== undefined ? dto.demand_talent_id : existing.demand_talent_id,
        ),
      )
    }
    if (dto.status !== undefined) assign('status', dto.status || 'published')
    if (dto.sort_order !== undefined) assign('sort_order', dto.sort_order || 0)
    if (dto.start_time !== undefined) assign('start_time', toMysqlDateTime(dto.start_time))
    if (dto.end_time !== undefined) assign('end_time', toMysqlDateTime(dto.end_time))
    if (dto.form_fields !== undefined) {
      assign('form_fields', dto.form_fields == null ? null : JSON.stringify(dto.form_fields))
    }

    if (!updates.length && !dto.roadshow) {
      throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    }
    if (updates.length) {
      params.push(id)
      await queryExecute(`UPDATE business_opportunities SET ${updates.join(', ')} WHERE id = ?`, params)
    }
    if (dto.roadshow) {
      await this.roadshowService.saveConfig(id, {
        start_time: toMysqlDateTime(dto.start_time),
        end_time: toMysqlDateTime(dto.end_time),
        form_fields: dto.form_fields,
        projects: dto.roadshow.projects,
        dimensions: dto.roadshow.dimensions,
      })
    }
    return this.getAdminById(id)
  }

  async audit(id: string, dto: { audit_status: string; reject_reason?: string }) {
    const row = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)
    const status = String(dto.audit_status || '').trim()
    if (status !== 'approved' && status !== 'rejected') {
      throw new HttpException('审核状态无效', HttpStatus.BAD_REQUEST)
    }
    if (status === 'rejected' && !String(dto.reject_reason || '').trim()) {
      // reject_reason 可选，给默认文案
    }
    const rejectReason =
      status === 'rejected' ? String(dto.reject_reason || '').trim() || '未通过审核' : null

    await queryExecute(
      `UPDATE business_opportunities
       SET audit_status = ?,
           reject_reason = ?,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [status, rejectReason, status === 'approved' ? 'published' : 'draft', id],
    )

    await this.notifyMember(row.user_id, {
      type: 'approval',
      title: status === 'approved' ? '动态审核通过' : '动态审核未通过',
      content:
        status === 'approved'
          ? `您发布的「${row.title}」已通过审核并上架`
          : `您发布的「${row.title}」未通过审核${rejectReason ? `：${rejectReason}` : ''}`,
      link: `/pages/content-detail/index?type=business&id=${id}`,
      bizType: 'business_audit',
      bizId: id,
      result: status,
    })

    return this.getAdminById(id)
  }

  async listMine(memberId: string | number) {
    const rows = await queryRows(
      `SELECT b.*,
              COALESCE(NULLIF(t.real_name, ''), NULLIF(m.name, '')) AS demand_talent_name
       FROM business_opportunities b
       LEFT JOIN talent_applications t ON t.id = b.demand_talent_id
       LEFT JOIN members m ON m.id = b.user_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [memberId],
    )
    const signed = await this.uploadService.signRowsFields(rows, ['cover_image'])
    return (signed || []).map((r) => this.formatBusinessRow(r))
  }

  /** 用户发布时，需求方固定为当前登录会员（优先绑定其人才档案） */
  private async resolveMemberDemandParty(memberId: string | number) {
    const talent = await queryOne(
      'SELECT id, real_name FROM talent_applications WHERE member_id = ? ORDER BY id DESC LIMIT 1',
      [memberId],
    )
    const member = await queryOne(
      'SELECT name, phone FROM members WHERE id = ?',
      [memberId],
    )
    return {
      demandTalentId: talent?.id || null,
      demandName: talent?.real_name || member?.name || member?.phone || `会员#${memberId}`,
    }
  }

  async submitByMember(memberId: string | number, dto: any) {
    const { demandTalentId } = await this.resolveMemberDemandParty(memberId)
    return this.create(
      { ...dto, demand_talent_id: demandTalentId },
      { source: 'user', memberId },
    )
  }

  async updateMine(id: string, memberId: string | number, dto: any) {
    const existing = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!existing) throw new HttpException('内容不存在', HttpStatus.NOT_FOUND)
    if (String(existing.user_id) !== String(memberId)) {
      throw new HttpException('无权编辑该内容', HttpStatus.FORBIDDEN)
    }
    if (!isUserBusinessCategory(dto.category || existing.category)) {
      throw new HttpException('仅可发布融资招募或资源对接', HttpStatus.BAD_REQUEST)
    }

    const { demandTalentId } = await this.resolveMemberDemandParty(memberId)
    const payload = {
      ...dto,
      category: dto.category || existing.category,
      demand_talent_id: demandTalentId,
      status: 'draft',
    }
    // 用户编辑后重新进入待审核
    const result = await this.update(id, payload)
    await queryExecute(
      `UPDATE business_opportunities
       SET audit_status = 'pending', reject_reason = NULL, status = 'draft', source = 'user', updated_at = NOW()
       WHERE id = ?`,
      [id],
    )
    await this.notifyMember(memberId, {
      type: 'approval',
      title: '动态已重新提交审核',
      content: `您更新的「${payload.title || existing.title}」已重新提交审核`,
      link: `/pages/content-detail/index?type=business&id=${id}`,
      bizType: 'business_audit',
      bizId: id,
      result: 'pending',
    })
    return this.getAdminById(id) || result
  }

  async removeMine(id: string, memberId: string | number) {
    const existing = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!existing) throw new HttpException('内容不存在', HttpStatus.NOT_FOUND)
    if (String(existing.user_id) !== String(memberId)) {
      throw new HttpException('无权删除该内容', HttpStatus.FORBIDDEN)
    }
    await queryExecute('DELETE FROM business_opportunities WHERE id = ?', [id])
    return { success: true }
  }

  async remove(id: string) {
    await queryExecute('DELETE FROM business_opportunities WHERE id = ?', [id])
    return { success: true }
  }

  async adminGetById(id: string) {
    const row = await this.getAdminById(id)
    if (row.category === 'roadshow') {
      return this.roadshowService.getAdminDetail(id)
    }
    return row
  }

  private async getAdminById(id: string) {
    const row = await queryOne(
      `SELECT b.*,
              COALESCE(NULLIF(t.real_name, ''), NULLIF(m.name, '')) AS demand_talent_name
       FROM business_opportunities b
       LEFT JOIN talent_applications t ON t.id = b.demand_talent_id
       LEFT JOIN members m ON m.id = b.user_id
       WHERE b.id = ?`,
      [id],
    )
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)
    const signed = await this.uploadService.signDetailMediaFields(
      this.formatBusinessRow(row),
      ['cover_image'],
      ['content', 'summary'],
    )
    return signed
  }
}
