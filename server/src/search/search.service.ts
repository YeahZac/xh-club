import { BadRequestException, Injectable } from '@nestjs/common'
import { queryRows } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'

export interface SearchHit {
  id: string
  title: string
  subtitle: string
  cover_image: string | null
  type: string
  type_label: string
  detail_type: string
  detail_id: string
}

@Injectable()
export class SearchService {
  constructor(private readonly uploadService: UploadService) {}

  async search(keywordRaw: string) {
    const keyword = String(keywordRaw || '').trim()
    if (!keyword) {
      throw new BadRequestException('请输入搜索关键词')
    }
    if (keyword.length > 50) {
      throw new BadRequestException('关键词过长')
    }

    const like = `%${keyword}%`
    const limit = 20

    const [projects, talents, events, articles, roadshows, financings] = await Promise.all([
      queryRows(
        `SELECT id, title, cover_image, industry, created_at
         FROM projects
         WHERE (title LIKE ? OR IFNULL(description, '') LIKE ? OR IFNULL(industry, '') LIKE ?)
         ORDER BY created_at DESC
         LIMIT ?`,
        [like, like, like, limit],
      ).catch(() => []),
      queryRows(
        `SELECT t.id, t.real_name, t.photo_url, t.experience, t.contact, t.created_at,
                m.avatar AS member_avatar
         FROM talent_applications t
         LEFT JOIN members m ON m.id = t.member_id
         WHERE t.status = 'approved'
           AND (t.real_name LIKE ? OR IFNULL(t.experience, '') LIKE ? OR IFNULL(t.contact, '') LIKE ?)
         ORDER BY t.reviewed_at DESC, t.updated_at DESC
         LIMIT ?`,
        [like, like, like, limit],
      ).catch(() => []),
      queryRows(
        `SELECT id, title, cover_image, event_type, location, start_time, created_at
         FROM events
         WHERE title LIKE ? OR IFNULL(location, '') LIKE ? OR IFNULL(description, '') LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [like, like, like, limit],
      ).catch(() => []),
      queryRows(
        `SELECT id, title, cover_image, category, summary, created_at
         FROM articles
         WHERE (status = 'published' OR status IS NULL OR status = '')
           AND (title LIKE ? OR IFNULL(summary, '') LIKE ?)
         ORDER BY created_at DESC
         LIMIT ?`,
        [like, like, limit],
      ).catch(() => []),
      queryRows(
        `SELECT id, title, cover_image, category, created_at
         FROM business_opportunities
         WHERE category = 'roadshow'
           AND status = 'published'
           AND (audit_status = 'approved' OR audit_status IS NULL OR audit_status = '')
           AND (title LIKE ? OR IFNULL(summary, '') LIKE ? OR IFNULL(content, '') LIKE ?)
         ORDER BY created_at DESC
         LIMIT ?`,
        [like, like, like, limit],
      ).catch(() => []),
      queryRows(
        `SELECT id, title, cover_image, category, created_at
         FROM business_opportunities
         WHERE category = 'financing'
           AND status = 'published'
           AND (audit_status = 'approved' OR audit_status IS NULL OR audit_status = '')
           AND (title LIKE ? OR IFNULL(summary, '') LIKE ? OR IFNULL(content, '') LIKE ?)
         ORDER BY created_at DESC
         LIMIT ?`,
        [like, like, like, limit],
      ).catch(() => []),
    ])

    const hits: SearchHit[] = []

    for (const row of projects || []) {
      hits.push({
        id: String(row.id),
        title: row.title || '未命名项目',
        subtitle: row.industry || '精选项目',
        cover_image: row.cover_image || null,
        type: 'project',
        type_label: '项目',
        detail_type: 'project',
        detail_id: String(row.id),
      })
    }

    for (const row of talents || []) {
      hits.push({
        id: String(row.id),
        title: row.real_name || '人才',
        subtitle: String(row.experience || '').slice(0, 40) || '已认证人才',
        cover_image: row.photo_url || row.member_avatar || null,
        type: 'talent',
        type_label: '人才',
        detail_type: 'talent',
        detail_id: String(row.id),
      })
    }

    for (const row of events || []) {
      hits.push({
        id: String(row.id),
        title: row.title || '未命名活动',
        subtitle: row.location || row.event_type || '活动',
        cover_image: row.cover_image || null,
        type: 'event',
        type_label: '活动',
        detail_type: 'event',
        detail_id: String(row.id),
      })
    }

    for (const row of articles || []) {
      hits.push({
        id: String(row.id),
        title: row.title || '未命名文章',
        subtitle: row.summary ? String(row.summary).slice(0, 40) : row.category || '文章',
        cover_image: row.cover_image || null,
        type: 'article',
        type_label: '文章',
        detail_type: 'article',
        detail_id: String(row.id),
      })
    }

    for (const row of roadshows || []) {
      hits.push({
        id: String(row.id),
        title: row.title || '未命名路演',
        subtitle: '项目路演',
        cover_image: row.cover_image || null,
        type: 'roadshow',
        type_label: '项目路演',
        detail_type: 'business',
        detail_id: String(row.id),
      })
    }

    for (const row of financings || []) {
      hits.push({
        id: String(row.id),
        title: row.title || '未命名融资',
        subtitle: '融资招募',
        cover_image: row.cover_image || null,
        type: 'financing',
        type_label: '融资招募',
        detail_type: 'business',
        detail_id: String(row.id),
      })
    }

    const signed = await this.uploadService.signRowsFields(hits, ['cover_image'])
    return {
      keyword,
      total: signed.length,
      list: signed,
    }
  }
}
