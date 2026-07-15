import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { queryRows } from '@/storage/database/mysql-client'

@Controller('banners')
export class BannersController {
  @Get()
  async getBanners() {
    try {
      const rows = await queryRows(
        'SELECT id, title, image_url, link_type, link_config, sort_order FROM banners WHERE is_active = 1 ORDER BY sort_order ASC'
      )
      return {
        code: 200,
        msg: 'success',
        data: rows.map((row: any) => ({
          ...row,
          link_config: row.link_config
            ? (typeof row.link_config === 'string' ? JSON.parse(row.link_config) : row.link_config)
            : null,
        })),
      }
    } catch (error) {
      console.error('[BannersController] getBanners error:', error)
      throw new HttpException('获取 Banner 列表失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
