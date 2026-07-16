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
    const signed = await this.uploadService.signRowFields(row, ['cover_image'])
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
    const coverImage = dto.cover_image
      ? assertCloudStorageImageUrl(dto.cover_image, true)
      : null
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
        dto.start_time || null,
        dto.end_time || null,
        dto.form_fields == null ? null : JSON.stringify(dto.form_fields),
      ],
    )
    const businessId = String(result.insertId)
    if (dto.category === 'roadshow' && dto.roadshow) {
      await this.roadshowService.saveConfig(businessId, {
        start_time: dto.start_time || dto.roadshow.start_time,
        end_time: dto.end_time || dto.roadshow.end_time,
        form_fields: dto.form_fields ?? dto.roadshow.form_fields,
        projects: dto.roadshow.projects,
        dimensions: dto.roadshow.dimensions,
      })
    }
    return this.getAdminById(businessId)
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
      assign('cover_image', dto.cover_image ? assertCloudStorageImageUrl(dto.cover_image, true) : null)
    }
    if (dto.industry !== undefined) assign('industry', dto.industry || null)
    if (dto.region !== undefined) assign('region', dto.region || null)
    if (dto.amount_min !== undefined) assign('amount_min', dto.amount_min ?? null)
    if (dto.amount_max !== undefined) assign('amount_max', dto.amount_max ?? null)
    if (dto.stage !== undefined) assign('stage', dto.stage || null)
    if (dto.contact_info !== undefined) assign('contact_info', dto.contact_info || null)
    if (dto.status !== undefined) assign('status', dto.status || 'published')
    if (dto.sort_order !== undefined) assign('sort_order', dto.sort_order || 0)
    if (dto.start_time !== undefined) assign('start_time', dto.start_time || null)
    if (dto.end_time !== undefined) assign('end_time', dto.end_time || null)
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
        start_time: dto.start_time,
        end_time: dto.end_time,
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
