import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'
import { RoadshowService } from './roadshow.service'

export const BUSINESS_CATEGORIES = ['roadshow', 'financing', 'resource'] as const
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]

function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === 'string' && (BUSINESS_CATEGORIES as readonly string[]).includes(value)
}

/** MySQL DATETIME 不接受 ISO（含 T/Z），统一转为 `YYYY-MM-DD HH:mm:ss` */
function toMysqlDateTime(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' && !(value instanceof Date)) return null

  const raw = value instanceof Date ? value.toISOString() : value.trim()
  if (!raw) return null

  // 已是 MySQL 格式
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.length === 16 ? `${raw}:00` : raw
  }

  // datetime-local: 2026-07-16T18:53 或 2026-07-16T18:53:00
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

  async list(params: { category?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20))
    const offset = (page - 1) * pageSize
    const where: string[] = []
    const values: any[] = []

    if (params.category && isBusinessCategory(params.category)) {
      where.push('category = ?')
      values.push(params.category)
    }
    if (params.status) {
      where.push('status = ?')
      values.push(params.status)
    } else {
      where.push(`status = 'published'`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const countRow = await queryOne(
      `SELECT COUNT(*) AS total FROM business_opportunities ${whereSql}`,
      values,
    )
    const rows = await queryRows(
      `SELECT * FROM business_opportunities ${whereSql}
       ORDER BY sort_order ASC, created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    )
    const list = await this.uploadService.signRowsFields(rows, ['cover_image'])
    return {
      list,
      total: Number(countRow?.total || 0),
      page,
      pageSize,
    }
  }

  async getById(id: string, memberId?: string | number) {
    const row = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)
    await queryExecute('UPDATE business_opportunities SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?', [id])
    const signed = await this.uploadService.signDetailMediaFields(
      row,
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
      where.push('category = ?')
      values.push(query.category)
    }
    if (query?.status) {
      where.push('status = ?')
      values.push(query.status)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await queryRows(
      `SELECT * FROM business_opportunities ${whereSql} ORDER BY sort_order ASC, created_at DESC`,
      values,
    )
    return this.uploadService.signRowsFields(rows, ['cover_image'])
  }

  async create(dto: any) {
    if (!dto?.title?.trim()) throw new HttpException('标题不能为空', HttpStatus.BAD_REQUEST)
    if (!isBusinessCategory(dto.category)) {
      throw new HttpException('分类必须是项目路演/融资招募/资源对接', HttpStatus.BAD_REQUEST)
    }
    if (!dto.cover_image?.trim()) {
      throw new HttpException('封面图片为必填项', HttpStatus.BAD_REQUEST)
    }
    const coverImage = assertCloudStorageImageUrl(dto.cover_image, true)
    const result = await queryExecute(
      `INSERT INTO business_opportunities
        (title, category, summary, content, cover_image, industry, region, amount_min, amount_max, stage, contact_info, status, sort_order, start_time, end_time, form_fields)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        dto.status || 'published',
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
      return this.getAdminById(businessId)
    } catch (error) {
      // 路演配置失败时回滚已创建的商机，避免重复点击产生多条脏数据
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
    const existing = await queryOne('SELECT id FROM business_opportunities WHERE id = ?', [id])
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
    const row = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)
    return this.uploadService.signRowFields(row, ['cover_image'])
  }
}
