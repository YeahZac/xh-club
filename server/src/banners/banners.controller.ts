import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'

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
  constructor(private readonly uploadService: UploadService) {}

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
      const data = await Promise.all(
        rows.map(async (row: any) => ({
          ...row,
          image_url: await this.uploadService.signMediaUrl(row.image_url),
          link_config: parseLinkConfig(row.link_config),
        })),
      )
      return {
        code: 200,
        msg: 'success',
        data,
      }
    } catch (error) {
      console.error('[BannersController] getBanners error:', error)
      throw new HttpException('获取 Banner 列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
