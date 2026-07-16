import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'

export const HOMEPAGE_SECTIONS = [
  'events',
  'products',
  'projects',
  'financing',
  'roadshow',
  'resource',
] as const

export type HomepageSection = (typeof HOMEPAGE_SECTIONS)[number]
export type HomepageSortMode = 'time_desc' | 'view_count' | 'custom'

const SECTION_META: Record<
  HomepageSection,
  { display_name: string; content_type: string; content_type_label: string; sort_order: number }
> = {
  events: { display_name: '活动', content_type: 'event', content_type_label: '活动', sort_order: 1 },
  products: { display_name: '商城商品', content_type: 'product', content_type_label: '商城商品', sort_order: 2 },
  projects: { display_name: '项目', content_type: 'project', content_type_label: '项目', sort_order: 3 },
  financing: { display_name: '融资招募', content_type: 'financing', content_type_label: '融资招募', sort_order: 4 },
  roadshow: { display_name: '项目路演', content_type: 'roadshow', content_type_label: '项目路演', sort_order: 5 },
  resource: { display_name: '资源对接', content_type: 'resource', content_type_label: '资源对接', sort_order: 6 },
}

const SORT_MODES: HomepageSortMode[] = ['time_desc', 'view_count', 'custom']

function assertSection(value: string): HomepageSection {
  if (!HOMEPAGE_SECTIONS.includes(value as HomepageSection)) {
    throw new BadRequestException('不支持的首页栏目')
  }
  return value as HomepageSection
}

function assertSortMode(value: unknown): HomepageSortMode {
  if (typeof value !== 'string' || !SORT_MODES.includes(value as HomepageSortMode)) {
    throw new BadRequestException('排序机制无效')
  }
  return value as HomepageSortMode
}

export interface HomepageFeedItem {
  id: number | string
  section: HomepageSection
  item_id: string
  sort_order: number
  title: string
  cover_image: string | null
  view_count: number
  content_type: string
  content_type_label: string
  created_at: string | null
  detail_type: string
  detail_id: string
}

@Injectable()
export class HomepageService {
  constructor(private readonly uploadService: UploadService) {}

  async ensureHomepageSchema() {
    try {
      await queryExecute(`
        CREATE TABLE IF NOT EXISTS homepage_sections (
          section VARCHAR(32) PRIMARY KEY,
          display_name VARCHAR(64) NOT NULL,
          is_enabled TINYINT(1) DEFAULT 1,
          item_limit INT DEFAULT 8,
          sort_order INT DEFAULT 0,
          sort_mode VARCHAR(32) NOT NULL DEFAULT 'custom',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      await queryExecute(`
        CREATE TABLE IF NOT EXISTS homepage_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          section VARCHAR(32) NOT NULL,
          item_id VARCHAR(64) NOT NULL,
          sort_order INT DEFAULT 0,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_homepage_section_item (section, item_id),
          INDEX idx_homepage_section (section, is_active, sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    } catch {
      // ignore
    }

    try {
      await queryExecute(
        `ALTER TABLE homepage_sections ADD COLUMN sort_mode VARCHAR(32) NOT NULL DEFAULT 'custom'`,
      )
    } catch {
      // column exists
    }

    for (const section of HOMEPAGE_SECTIONS) {
      const meta = SECTION_META[section]
      await queryExecute(
        `INSERT INTO homepage_sections (section, display_name, is_enabled, item_limit, sort_order, sort_mode)
         VALUES (?, ?, 1, 8, ?, 'custom')
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), sort_order = VALUES(sort_order)`,
        [section, meta.display_name, meta.sort_order],
      )
    }
  }

  async getConfig(admin = false) {
    await this.ensureHomepageSchema()
    try {
      const sections = await queryRows<any>(
        `SELECT section, display_name, is_enabled, item_limit, sort_order, sort_mode
         FROM homepage_sections
         WHERE section IN (${HOMEPAGE_SECTIONS.map(() => '?').join(',')})
         ORDER BY sort_order ASC`,
        [...HOMEPAGE_SECTIONS],
      )
      const items = await queryRows<any>(
        `SELECT id, section, item_id, sort_order, is_active
         FROM homepage_items
         WHERE section IN (${HOMEPAGE_SECTIONS.map(() => '?').join(',')})
         ${admin ? '' : 'AND is_active = 1'}
         ORDER BY section ASC, sort_order ASC, id ASC`,
        [...HOMEPAGE_SECTIONS],
      )

      const sortMode = (sections[0]?.sort_mode as HomepageSortMode) || 'custom'

      return {
        configured: sections.length > 0,
        sort_mode: sortMode,
        sections: sections.map((section) => ({
          ...section,
          is_enabled: Boolean(section.is_enabled),
          sort_mode: section.sort_mode || sortMode,
          items: items
            .filter((item) => item.section === section.section)
            .map((item) => ({ ...item, is_active: Boolean(item.is_active) })),
        })),
      }
    } catch (error: any) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return { configured: false, sort_mode: 'custom', sections: [] }
      }
      throw error
    }
  }

  async getFeed() {
    const config = await this.getConfig(false)
    if (!config.configured) {
      return { configured: false, sort_mode: 'custom', list: [] as HomepageFeedItem[] }
    }

    const cards: HomepageFeedItem[] = []
    for (const section of config.sections) {
      if (!section.is_enabled) continue
      const limit = Math.max(1, Math.min(50, Number(section.item_limit) || 8))
      const sectionItems = (section.items || []).slice(0, limit)
      for (const item of sectionItems) {
        const enriched = await this.enrichItem(section.section as HomepageSection, String(item.item_id), item)
        if (enriched) cards.push(enriched)
      }
    }

    const sortMode = assertSortMode(config.sort_mode || 'custom')
    const sorted = this.sortFeed(cards, sortMode)
    const list = await this.uploadService.signRowsFields(sorted, ['cover_image'])
    return { configured: true, sort_mode: sortMode, list }
  }

  private sortFeed(list: HomepageFeedItem[], mode: HomepageSortMode) {
    const next = [...list]
    if (mode === 'view_count') {
      next.sort((a, b) => (b.view_count || 0) - (a.view_count || 0) || (b.sort_order || 0) - (a.sort_order || 0))
    } else if (mode === 'time_desc') {
      next.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta || (a.sort_order || 0) - (b.sort_order || 0)
      })
    } else {
      next.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || Number(a.id) - Number(b.id))
    }
    return next
  }

  private async enrichItem(
    section: HomepageSection,
    itemId: string,
    homepageItem: { id: number | string; sort_order: number },
  ): Promise<HomepageFeedItem | null> {
    const meta = SECTION_META[section]
    let row: any = null

    if (section === 'events') {
      row = await queryOne('SELECT id, title, cover_image, event_type, view_count, created_at FROM events WHERE id = ?', [itemId])
    } else if (section === 'products') {
      row = await queryOne(
        `SELECT id, name AS title, image_url AS cover_image, IFNULL(view_count, 0) AS view_count, created_at
         FROM mall_products WHERE id = ?`,
        [itemId],
      )
    } else if (section === 'projects') {
      row = await queryOne(
        'SELECT id, title, cover_image, IFNULL(view_count, 0) AS view_count, created_at FROM projects WHERE id = ?',
        [itemId],
      )
    } else if (section === 'financing' || section === 'roadshow' || section === 'resource') {
      row = await queryOne(
        `SELECT id, title, cover_image, IFNULL(view_count, 0) AS view_count, created_at, category
         FROM business_opportunities WHERE id = ? AND category = ?`,
        [itemId, section],
      )
    }

    if (!row) return null

    const typeLabel =
      section === 'events'
        ? this.eventTypeLabel(row.event_type) || meta.content_type_label
        : meta.content_type_label

    const detailType =
      section === 'events'
        ? 'event'
        : section === 'products'
          ? 'product'
          : section === 'projects'
            ? 'project'
            : 'business'

    return {
      id: homepageItem.id,
      section,
      item_id: String(row.id),
      sort_order: Number(homepageItem.sort_order) || 0,
      title: row.title || '',
      cover_image: row.cover_image || null,
      view_count: Number(row.view_count) || 0,
      content_type: meta.content_type,
      content_type_label: typeLabel,
      created_at: row.created_at || null,
      detail_type: detailType,
      detail_id: String(row.id),
    }
  }

  private eventTypeLabel(type?: string) {
    const map: Record<string, string> = {
      other: '其他活动',
      roadshow: '项目路演',
      salon: '专题沙龙',
      annual: '年度大会',
      training: '培训',
      meeting: '定期例会',
    }
    return type ? map[type] || type : ''
  }

  async getCandidates(sectionValue: string, keyword?: string) {
    const section = assertSection(sectionValue)
    const kw = String(keyword || '').trim()
    const like = `%${kw}%`

    if (section === 'events') {
      const sql = kw
        ? `SELECT id, title, cover_image, event_type, IFNULL(view_count, 0) AS view_count, created_at
           FROM events WHERE title LIKE ? ORDER BY created_at DESC LIMIT 100`
        : `SELECT id, title, cover_image, event_type, IFNULL(view_count, 0) AS view_count, created_at
           FROM events ORDER BY created_at DESC LIMIT 100`
      return queryRows(sql, kw ? [like] : [])
    }

    if (section === 'products') {
      const sql = kw
        ? `SELECT id, name AS title, image_url AS cover_image, IFNULL(view_count, 0) AS view_count, created_at
           FROM mall_products WHERE name LIKE ?
           ORDER BY created_at DESC LIMIT 100`
        : `SELECT id, name AS title, image_url AS cover_image, IFNULL(view_count, 0) AS view_count, created_at
           FROM mall_products
           ORDER BY created_at DESC LIMIT 100`
      return queryRows(sql, kw ? [like] : [])
    }

    if (section === 'projects') {
      const sql = kw
        ? `SELECT id, title, cover_image, IFNULL(view_count, 0) AS view_count, created_at
           FROM projects WHERE status IN ('active', 'published', 'funding') AND title LIKE ?
           ORDER BY created_at DESC LIMIT 100`
        : `SELECT id, title, cover_image, IFNULL(view_count, 0) AS view_count, created_at
           FROM projects WHERE status IN ('active', 'published', 'funding')
           ORDER BY created_at DESC LIMIT 100`
      return queryRows(sql, kw ? [like] : [])
    }

    // financing / roadshow / resource
    const sql = kw
      ? `SELECT id, title, cover_image, IFNULL(view_count, 0) AS view_count, created_at
         FROM business_opportunities
         WHERE category = ? AND status = 'published' AND title LIKE ?
         ORDER BY created_at DESC LIMIT 100`
      : `SELECT id, title, cover_image, IFNULL(view_count, 0) AS view_count, created_at
         FROM business_opportunities
         WHERE category = ? AND status = 'published'
         ORDER BY created_at DESC LIMIT 100`
    return queryRows(sql, kw ? [section, like] : [section])
  }

  async updateSettings(dto: { sort_mode: string }) {
    await this.ensureHomepageSchema()
    const sortMode = assertSortMode(dto.sort_mode)
    await queryExecute(
      `UPDATE homepage_sections SET sort_mode = ?, updated_at = NOW()
       WHERE section IN (${HOMEPAGE_SECTIONS.map(() => '?').join(',')})`,
      [sortMode, ...HOMEPAGE_SECTIONS],
    )
    return { success: true, sort_mode: sortMode }
  }

  async updateSection(
    sectionValue: string,
    dto: { is_enabled?: boolean; item_limit?: number; sort_mode?: string },
  ) {
    await this.ensureHomepageSchema()
    const section = assertSection(sectionValue)
    const itemLimit = Number(dto.item_limit)
    if (!Number.isInteger(itemLimit) || itemLimit < 1 || itemLimit > 50) {
      throw new BadRequestException('展示数量必须为 1 到 50 的整数')
    }
    const params: any[] = [dto.is_enabled !== false, itemLimit]
    let sortSql = ''
    if (dto.sort_mode !== undefined) {
      const sortMode = assertSortMode(dto.sort_mode)
      sortSql = ', sort_mode = ?'
      params.push(sortMode)
    }
    params.push(section)
    await queryExecute(
      `UPDATE homepage_sections
       SET is_enabled = ?, item_limit = ?${sortSql}, updated_at = NOW()
       WHERE section = ?`,
      params,
    )
    return { success: true }
  }

  async addItem(dto: { section: string; item_id: string; sort_order?: number }) {
    await this.ensureHomepageSchema()
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

  async updateItem(id: string, dto: { sort_order?: number; is_active?: boolean }) {
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
