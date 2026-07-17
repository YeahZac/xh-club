import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'
import { PointsEngineService } from '@/points/points-engine.service'

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

@Injectable()
export class TalentService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly pointsEngine: PointsEngineService,
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

  private async signTalent(row: any) {
    if (!row) return null
    const signed = await this.uploadService.signRowFields(row, ['photo_url', 'card_image_url', 'avatar_url', 'member_avatar'])
    return {
      ...signed,
      industry_tags: parseIndustryTags(signed.industry_tags),
    }
  }

  private async signTalents(rows: any[]) {
    const list = await Promise.all(rows.map((row) => this.signTalent(row)))
    return list.filter(Boolean)
  }

  async listApproved(params: { industry?: string; keyword?: string; page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20))
    const offset = (page - 1) * pageSize
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
    const rows = await queryRows(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       ${whereSql}
       ORDER BY t.reviewed_at DESC, t.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    )
    return {
      list: await this.signTalents(rows),
      total: Number(countRow?.total || 0),
      page,
      pageSize,
    }
  }

  async getApprovedById(id: string) {
    const row = await queryOne(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       WHERE t.id = ? AND t.status = 'approved'`,
      [id],
    )
    if (!row) throw new HttpException('人才不存在或未通过审核', HttpStatus.NOT_FOUND)
    return this.signTalent(row)
  }

  async getMine(memberId: string) {
    const row = await queryOne(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       WHERE t.member_id = ?`,
      [memberId],
    )
    return this.signTalent(row)
  }

  private validateApplicationPayload(dto: any, partial = false) {
    const realName = dto.real_name !== undefined ? String(dto.real_name || '').trim() : undefined
    const contact = dto.contact !== undefined ? String(dto.contact || '').trim() : undefined
    const tags = dto.industry_tags !== undefined ? parseIndustryTags(dto.industry_tags) : undefined

    if (!partial || dto.real_name !== undefined) {
      if (!realName) throw new HttpException('真实姓名不能为空', HttpStatus.BAD_REQUEST)
    }
    if (!partial || dto.contact !== undefined) {
      if (!contact) throw new HttpException('联系方式不能为空', HttpStatus.BAD_REQUEST)
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
        (member_id, real_name, contact, photo_url, industry_tags, experience, card_image_url, avatar_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        memberId,
        payload.real_name,
        payload.contact,
        payload.photo_url,
        JSON.stringify(payload.industry_tags),
        payload.experience || null,
        payload.card_image_url || null,
        avatarUrl,
      ],
    )
    return this.getMine(memberId)
  }

  async updateMine(memberId: string, dto: any) {
    const existing = await queryOne('SELECT * FROM talent_applications WHERE member_id = ?', [memberId])
    if (!existing) throw new HttpException('尚未提交人才申请', HttpStatus.NOT_FOUND)

    const merged = {
      real_name: dto.real_name !== undefined ? dto.real_name : existing.real_name,
      contact: dto.contact !== undefined ? dto.contact : existing.contact,
      photo_url: dto.photo_url !== undefined ? dto.photo_url : existing.photo_url,
      industry_tags: dto.industry_tags !== undefined ? dto.industry_tags : existing.industry_tags,
      experience: dto.experience !== undefined ? dto.experience : existing.experience,
      card_image_url: dto.card_image_url !== undefined ? dto.card_image_url : existing.card_image_url,
      avatar_url: dto.avatar_url !== undefined ? dto.avatar_url : existing.avatar_url,
    }
    const payload = this.validateApplicationPayload(merged, false)
    const avatarUrl = payload.avatar_url || payload.photo_url || null

    await queryExecute(
      `UPDATE talent_applications SET
        real_name = ?, contact = ?, photo_url = ?, industry_tags = ?, experience = ?,
        card_image_url = ?, avatar_url = ?, status = 'pending', reject_reason = NULL,
        reviewed_at = NULL, reviewed_by = NULL
       WHERE member_id = ?`,
      [
        payload.real_name,
        payload.contact,
        payload.photo_url,
        JSON.stringify(payload.industry_tags),
        payload.experience || null,
        payload.card_image_url || null,
        avatarUrl,
        memberId,
      ],
    )
    return this.getMine(memberId)
  }

  async adminList(query: any = {}) {
    const where: string[] = []
    const values: any[] = []
    if (query.status && TALENT_STATUSES.includes(query.status)) {
      where.push('t.status = ?')
      values.push(query.status)
    }
    if (query.keyword) {
      where.push('(t.real_name LIKE ? OR t.contact LIKE ? OR CAST(t.member_id AS CHAR) LIKE ?)')
      const kw = `%${query.keyword}%`
      values.push(kw, kw, kw)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await queryRows(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name, m.phone AS member_phone
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       ${whereSql}
       ORDER BY
         CASE t.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
         t.updated_at DESC`,
      values,
    )
    return this.signTalents(rows)
  }

  async adminGetById(id: string) {
    const row = await queryOne(
      `SELECT t.*, m.avatar AS member_avatar, m.name AS member_name, m.phone AS member_phone
       FROM talent_applications t
       LEFT JOIN members m ON m.id = t.member_id
       WHERE t.id = ?`,
      [id],
    )
    if (!row) throw new HttpException('人才申请不存在', HttpStatus.NOT_FOUND)
    return this.signTalent(row)
  }

  async adminUpdate(id: string, dto: any) {
    const existing = await queryOne('SELECT * FROM talent_applications WHERE id = ?', [id])
    if (!existing) throw new HttpException('人才申请不存在', HttpStatus.NOT_FOUND)

    const updates: string[] = []
    const params: any[] = []
    const assign = (col: string, value: unknown) => {
      updates.push(`${col} = ?`)
      params.push(value)
    }

    if (dto.real_name !== undefined) assign('real_name', String(dto.real_name || '').trim())
    if (dto.contact !== undefined) assign('contact', String(dto.contact || '').trim())
    if (dto.experience !== undefined) assign('experience', String(dto.experience || '').trim() || null)
    if (dto.industry_tags !== undefined) {
      const tags = parseIndustryTags(dto.industry_tags)
      assign('industry_tags', JSON.stringify(tags))
    }
    if (dto.photo_url !== undefined) assign('photo_url', normalizeOptionalImage(dto.photo_url))
    if (dto.card_image_url !== undefined) assign('card_image_url', normalizeOptionalImage(dto.card_image_url))
    if (dto.avatar_url !== undefined) assign('avatar_url', normalizeOptionalImage(dto.avatar_url))
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
    } else if (dto.reject_reason !== undefined) {
      assign('reject_reason', String(dto.reject_reason || '').trim() || null)
    }

    if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    params.push(id)
    await queryExecute(`UPDATE talent_applications SET ${updates.join(', ')} WHERE id = ?`, params)
    const result = await this.adminGetById(id)
    if (dto.status === 'approved') {
      const memberId = (result as any)?.member_id
      if (memberId) {
        void this.pointsEngine
          .evaluate(memberId, 'talent_settle', {
            referenceType: 'talent',
            referenceId: id,
            description: '完成人才入驻奖励积分',
          })
          .catch((err) => console.warn('[TalentService] points evaluate failed', err))
      }
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
    await queryExecute('DELETE FROM talent_applications WHERE id = ?', [id])
    return { success: true }
  }
}
