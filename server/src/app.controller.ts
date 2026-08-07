import { Controller, Get, Param } from '@nestjs/common'
import { AppService } from '@/app.service'
import { queryOne } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('hello')
  getHello(): { status: string; data: string } {
    return {
      status: 'success',
      data: this.appService.getHello(),
    }
  }

  @Get('health')
  getHealth(): { status: string; data: string } {
    return {
      status: 'success',
      data: new Date().toISOString(),
    }
  }

  /** 公开读取「关于我们」等系统文案配置 */
  @Get('system/configs/:key')
  async getPublicConfig(@Param('key') key: string) {
    const allowed = new Set(['about_us'])
    const configKey = String(key || '').trim()
    if (!allowed.has(configKey)) {
      return { code: 404, msg: '配置不存在', data: null }
    }
    const row = await queryOne(
      'SELECT config_key, config_value, description, updated_at FROM configs WHERE config_key = ?',
      [configKey],
    )
    if (!row) {
      return {
        code: 200,
        msg: 'success',
        data: {
          config_key: configKey,
          config_value: '',
          description: '',
          updated_at: null,
        },
      }
    }
    const config_value = await this.uploadService.signHtmlMedia(row.config_value)
    return {
      code: 200,
      msg: 'success',
      data: { ...row, config_value },
    }
  }
}
