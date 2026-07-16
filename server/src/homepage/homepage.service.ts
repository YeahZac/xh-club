import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { queryExecute, queryRows } from '@/storage/database/mysql-client'

const HOMEPAGE_SECTIONS = ['projects', 'resources', 'posts'] as const
type HomepageSection = typeof HOMEPAGE_SECTIONS[number]

function assertSection(value: string): HomepageSection {
  if (!HOMEPAGE_SECTIONS.includes(value as HomepageSection)) {
    throw new BadRequestException('不支持的首页栏目')
  }
  return value as HomepageSection
}

@Injectable()
export class HomepageService {
  async getConfig(admin = false) {
    try {
      const sections = await queryRows<any>(
        `SELECT section, display_name, is_enabled, item_limit, sort_order
         FROM homepage_sections
         ORDER BY sort_order ASC`,
      )
      const items = await queryRows<any>(
        `SELECT id, section, item_id, sort_order, is_active
         FROM homepage_items
         ${admin ? '' : 'WHERE is_active = 1'}
         ORDER BY section ASC, sort_order ASC, id ASC`,
      )

      return {
        configured: sections.length > 0,
        sections: sections.map(section => ({
          ...section,
          is_enabled: Boolean(section.is_enabled),
          items: items
            .filter(item => item.section === section.section)
            .map(item => ({ ...item, is_active: Boolean(item.is_active) })),
        })),
      }
    } catch (error: any) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return { configured: false, sections: [] }
      }
      throw error
    }
  }

  async getCandidates(sectionValue: string) {
    const section = assertSection(sectionValue)
    const queries: Record<HomepageSection, string> = {
      projects: `SELECT id, title, status, created_at
                 FROM projects
                 WHERE status IN ('active', 'published', 'funding')
                 ORDER BY created_at DESC LIMIT 100`,
      resources: `SELECT id, title, status, created_at
                  FROM resources
                  WHERE status = 'active'
                  ORDER BY created_at DESC LIMIT 100`,
      posts: `SELECT id, COALESCE(NULLIF(title, ''), LEFT(content, 60)) AS title, status, created_at
              FROM posts
              WHERE status IN ('active', 'published')
              ORDER BY created_at DESC LIMIT 100`,
    }
    return queryRows<any>(queries[section])
  }

  async updateSection(
    sectionValue: string,
    dto: { is_enabled?: boolean; item_limit?: number },
  ) {
    const section = assertSection(sectionValue)
    const itemLimit = Number(dto.item_limit)
    if (!Number.isInteger(itemLimit) || itemLimit < 1 || itemLimit > 20) {
      throw new BadRequestException('展示数量必须为 1 到 20 的整数')
    }
    await queryExecute(
      `UPDATE homepage_sections
       SET is_enabled = ?, item_limit = ?, updated_at = NOW()
       WHERE section = ?`,
      [dto.is_enabled !== false, itemLimit, section],
    )
    return { success: true }
  }

  async addItem(dto: { section: string; item_id: string; sort_order?: number }) {
    const section = assertSection(dto.section)
    const itemId = String(dto.item_id || '').trim()
    if (!itemId) throw new BadRequestException('请选择首页内容')

    try {
      const result = await queryExecute(
        `INSERT INTO homepage_items (section, item_id, sort_order, is_active)
         VALUES (?, ?, ?, 1)`,
        [section, itemId, Number(dto.sort_order) || 0],
      )
      return { id: result.insertId }
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException('该内容已加入当前栏目')
      }
      throw error
    }
  }

  async updateItem(
    id: string,
    dto: { sort_order?: number; is_active?: boolean },
  ) {
    const result = await queryExecute(
      `UPDATE homepage_items
       SET sort_order = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [Number(dto.sort_order) || 0, dto.is_active !== false, id],
    )
    if (result.affectedRows === 0) throw new NotFoundException('首页内容不存在')
    return { success: true }
  }

  async removeItem(id: string) {
    const result = await queryExecute('DELETE FROM homepage_items WHERE id = ?', [id])
    if (result.affectedRows === 0) throw new NotFoundException('首页内容不存在')
    return { success: true }
  }
}
