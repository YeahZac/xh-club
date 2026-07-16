import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows } from '@/storage/database/mysql-client'
import { normalizeMediaUrl } from '@/utils/media-url'

function parseLinkConfig(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string') return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

@Controller('banners')
export class BannersController {
  @Get()
  async getBanners() {
    try {
      const rows = await queryRows(
        `SELECT id, title, image_url, link_type, link_id, link_config, sort_order
         FROM banners
         WHERE is_active = 1
           AND (start_time IS NULL OR start_time <= NOW())
           AND (end_time IS NULL OR end_time >= NOW())
         ORDER BY sort_order ASC`
      )
      return {
        code: 200,
        msg: 'success',
        data: rows.map((row: any) => ({
          ...row,
          image_url: normalizeMediaUrl(row.image_url),
          link_config: parseLinkConfig(row.link_config),
        })),
      }
    } catch (error) {
      console.error('[BannersController] getBanners error:', error)
      throw new HttpException('获取 Banner 列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
