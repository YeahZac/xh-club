import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows, queryOne, queryExecute } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'

export const BUSINESS_CATEGORIES = ['roadshow', 'financing', 'resource'] as const
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]

function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === 'string' && (BUSINESS_CATEGORIES as readonly string[]).includes(value)
}

@Injectable()
export class BusinessService {
  constructor(private readonly uploadService: UploadService) {}

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

  async getById(id: string) {
    const row = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)
    await queryExecute('UPDATE business_opportunities SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?', [id])
    return this.uploadService.signRowFields(row, ['cover_image'])
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
        (title, category, summary, content, cover_image, industry, region, amount_min, amount_max, stage, contact_info, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
    )
    return this.getAdminById(String(result.insertId))
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

    if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    params.push(id)
    await queryExecute(`UPDATE business_opportunities SET ${updates.join(', ')} WHERE id = ?`, params)
    return this.getAdminById(id)
  }

  async remove(id: string) {
    await queryExecute('DELETE FROM business_opportunities WHERE id = ?', [id])
    return { success: true }
  }

  async adminGetById(id: string) {
    return this.getAdminById(id)
  }

  private async getAdminById(id: string) {
    const row = await queryOne('SELECT * FROM business_opportunities WHERE id = ?', [id])
    if (!row) throw new HttpException('商机不存在', HttpStatus.NOT_FOUND)
    return this.uploadService.signRowFields(row, ['cover_image'])
  }
}
