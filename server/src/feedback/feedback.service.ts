import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { assertCloudStorageImageUrl } from '@/utils/media-validators'

export const FEEDBACK_TYPES = [
  'trade_complaint',
  'project_suggestion',
  'feature_feedback',
  'other',
] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  trade_complaint: '交易投诉',
  project_suggestion: '项目建议',
  feature_feedback: '功能反馈',
  other: '其他反馈',
}

const FEEDBACK_STATUSES = ['pending', 'processing', 'resolved', 'closed'] as const

const parseImages = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

@Injectable()
export class FeedbackService {
  constructor(private readonly uploadService: UploadService) {}

  private requireType(value: unknown): FeedbackType {
    const type = String(value || '').trim() as FeedbackType
    if (!(FEEDBACK_TYPES as readonly string[]).includes(type)) {
      throw new HttpException('反馈类型无效', HttpStatus.BAD_REQUEST)
    }
    return type
  }

  private async formatRow(row: any) {
    if (!row) return row
    const type = this.requireType(row.feedback_type)
    const images = parseImages(row.image_urls)
    const signedImages = await this.uploadService.signMediaUrls(images)
    return {
      ...row,
      feedback_type: type,
      feedback_type_label: FEEDBACK_TYPE_LABELS[type],
      image_urls: signedImages,
      project_title: row.project_title || null,
      member_name: row.member_name || null,
      member_phone: row.member_phone || null,
    }
  }

  async create(memberId: string | number, dto: any) {
    const type = this.requireType(dto.feedback_type)
    const content = String(dto.content || '').trim()
    if (!content) throw new HttpException('请填写反馈内容', HttpStatus.BAD_REQUEST)

    const needsProject = type === 'trade_complaint' || type === 'project_suggestion'
    const projectId = dto.project_id != null && dto.project_id !== '' ? Number(dto.project_id) : null
    if (needsProject) {
      if (!projectId || Number.isNaN(projectId)) {
        throw new HttpException('请选择项目', HttpStatus.BAD_REQUEST)
      }
      const project = await queryOne('SELECT id FROM projects WHERE id = ?', [projectId])
      if (!project) throw new HttpException('所选项目不存在', HttpStatus.BAD_REQUEST)
    }

    const phone = String(dto.phone || '').trim()
    if (needsProject) {
      if (!/^1\d{10}$/.test(phone)) {
        throw new HttpException('请填写正确手机号', HttpStatus.BAD_REQUEST)
      }
    } else if (phone && !/^1\d{10}$/.test(phone)) {
      throw new HttpException('请填写正确手机号', HttpStatus.BAD_REQUEST)
    }

    const email = String(dto.email || '').trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpException('邮箱格式不正确', HttpStatus.BAD_REQUEST)
    }

    const rawImages = Array.isArray(dto.image_urls) ? dto.image_urls : []
    if (rawImages.length > 6) throw new HttpException('图片最多 6 张', HttpStatus.BAD_REQUEST)
    const images: string[] = []
    for (const item of rawImages) {
      const url = String(item || '').trim()
      if (!url) continue
      assertCloudStorageImageUrl(url)
      images.push(url)
    }

    const result = await queryExecute(
      `INSERT INTO user_feedbacks
         (member_id, feedback_type, project_id, content, phone, email, image_urls, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        memberId,
        type,
        needsProject ? projectId : null,
        content,
        phone || null,
        email || null,
        JSON.stringify(images),
      ],
    )
    return this.getMineById(String(result.insertId), memberId)
  }

  async listMine(memberId: string | number) {
    const rows = await queryRows(
      `SELECT f.*, p.title AS project_title
       FROM user_feedbacks f
       LEFT JOIN projects p ON p.id = f.project_id
       WHERE f.member_id = ?
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [memberId],
    )
    return Promise.all((rows || []).map((row) => this.formatRow(row)))
  }

  async getMineById(id: string, memberId: string | number) {
    const row = await queryOne(
      `SELECT f.*, p.title AS project_title
       FROM user_feedbacks f
       LEFT JOIN projects p ON p.id = f.project_id
       WHERE f.id = ? AND f.member_id = ?`,
      [id, memberId],
    )
    if (!row) throw new HttpException('反馈不存在', HttpStatus.NOT_FOUND)
    return this.formatRow(row)
  }

  async adminList(query?: { type?: string; status?: string }) {
    const where: string[] = []
    const values: any[] = []
    if (query?.type && (FEEDBACK_TYPES as readonly string[]).includes(query.type)) {
      where.push('f.feedback_type = ?')
      values.push(query.type)
    }
    if (query?.status && (FEEDBACK_STATUSES as readonly string[]).includes(query.status)) {
      where.push('f.status = ?')
      values.push(query.status)
    }
    const rows = await queryRows(
      `SELECT f.*, p.title AS project_title, m.name AS member_name, m.phone AS member_phone
       FROM user_feedbacks f
       LEFT JOIN projects p ON p.id = f.project_id
       LEFT JOIN members m ON m.id = f.member_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY
         CASE f.status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,
         f.created_at DESC
       LIMIT 300`,
      values,
    )
    return Promise.all((rows || []).map((row) => this.formatRow(row)))
  }

  async adminGetById(id: string) {
    const row = await queryOne(
      `SELECT f.*, p.title AS project_title, m.name AS member_name, m.phone AS member_phone
       FROM user_feedbacks f
       LEFT JOIN projects p ON p.id = f.project_id
       LEFT JOIN members m ON m.id = f.member_id
       WHERE f.id = ?`,
      [id],
    )
    if (!row) throw new HttpException('反馈不存在', HttpStatus.NOT_FOUND)
    return this.formatRow(row)
  }

  async adminUpdate(id: string, dto: any, adminName?: string) {
    const existing = await queryOne('SELECT * FROM user_feedbacks WHERE id = ?', [id])
    if (!existing) throw new HttpException('反馈不存在', HttpStatus.NOT_FOUND)

    const updates: string[] = []
    const params: any[] = []
    if (dto.status !== undefined) {
      const status = String(dto.status || '').trim()
      if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
        throw new HttpException('状态无效', HttpStatus.BAD_REQUEST)
      }
      updates.push('status = ?')
      params.push(status)
      if (status !== 'pending') {
        updates.push('handled_at = NOW()')
        updates.push('handled_by = ?')
        params.push(adminName || 'admin')
      }
    }
    if (dto.admin_reply !== undefined) {
      updates.push('admin_reply = ?')
      params.push(String(dto.admin_reply || '').trim() || null)
    }
    if (!updates.length) throw new HttpException('没有可更新的字段', HttpStatus.BAD_REQUEST)
    params.push(id)
    await queryExecute(
      `UPDATE user_feedbacks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params,
    )
    return this.adminGetById(id)
  }

  async adminRemove(id: string) {
    const existing = await queryOne('SELECT id FROM user_feedbacks WHERE id = ?', [id])
    if (!existing) throw new HttpException('反馈不存在', HttpStatus.NOT_FOUND)
    await queryExecute('DELETE FROM user_feedbacks WHERE id = ?', [id])
    return { success: true }
  }
}
