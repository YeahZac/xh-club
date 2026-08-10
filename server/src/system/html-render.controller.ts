import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Public } from '@/auth/public.decorator'
import { queryOne } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { rewriteLegacyCloudHostUrls } from '@/utils/public-base-url'
import { buildWebViewHtmlPageUrl } from '@/utils/webview-url'
import { injectMpToolbar, type MpToolbarQuery } from '@/system/html-mp-toolbar'

const CONFIG_KEYS = new Set(['about_us'])

function ensureHtmlDocument(html: string, title = '星河俱乐部'): string {
  const value = String(html || '').trim()
  if (!value) {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body><p style="padding:24px;color:#6b7280;">暂无内容</p></body></html>`
  }
  if (/<!DOCTYPE\s+html/i.test(value) || /<html[\s>]/i.test(value)) {
    return value
  }
  // 片段：包一层移动端友好壳，保留原有 style
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
  <style>
    html,body{margin:0;padding:0;background:#F5F6FA;color:#1A1D2E;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;}
    img{max-width:100%;height:auto;}
    a{color:#2457A7;}
    .xh-rich-root{padding:16px;box-sizing:border-box;}
  </style>
</head>
<body><div class="xh-rich-root">${value}</div></body>
</html>`
}

@Controller('system')
export class HtmlRenderController {
  constructor(private readonly uploadService: UploadService) {}

  private async loadHtmlSource(
    kind: string,
    key: string,
    id: string,
  ): Promise<{ html: string; title: string }> {
    let html = ''
    let title = '星河俱乐部'

    if (kind === 'config') {
      const configKey = String(key || '').trim()
      if (!CONFIG_KEYS.has(configKey)) {
        throw new HttpException('not found', HttpStatus.NOT_FOUND)
      }
      const row = await queryOne('SELECT config_value FROM configs WHERE config_key = ?', [configKey])
      html = String(row?.config_value || '')
      title = configKey === 'about_us' ? '关于我们' : title
    } else if (kind === 'article') {
      const row = await queryOne(
        'SELECT title, content FROM articles WHERE id = ? AND status = ?',
        [id, 'published'],
      )
      if (!row) throw new HttpException('not found', HttpStatus.NOT_FOUND)
      html = String(row.content || '')
      title = String(row.title || title)
    } else if (kind === 'event') {
      const row = await queryOne(
        'SELECT title, description, content FROM events WHERE id = ? AND status <> ?',
        [id, 'draft'],
      )
      if (!row) throw new HttpException('not found', HttpStatus.NOT_FOUND)
      html = String(row.description || row.content || '')
      title = String(row.title || title)
    } else if (kind === 'project') {
      const row = await queryOne(
        `SELECT title, description FROM projects
         WHERE id = ? AND (audit_status = ? OR audit_status IS NULL OR audit_status = '')`,
        [id, 'approved'],
      )
      if (!row) throw new HttpException('not found', HttpStatus.NOT_FOUND)
      html = String(row.description || '')
      title = String(row.title || title)
    } else if (kind === 'business') {
      const row = await queryOne(
        `SELECT title, content FROM business_opportunities
         WHERE id = ? AND status = ? AND (audit_status = ? OR audit_status IS NULL OR audit_status = '')`,
        [id, 'published', 'approved'],
      )
      if (!row) throw new HttpException('not found', HttpStatus.NOT_FOUND)
      html = String(row.content || '')
      title = String(row.title || title)
    } else if (kind === 'product') {
      const row = await queryOne(
        'SELECT name, description FROM mall_products WHERE id = ? AND status = ?',
        [id, 'active'],
      )
      if (!row) throw new HttpException('not found', HttpStatus.NOT_FOUND)
      html = String(row.description || '')
      title = String(row.name || title)
    } else if (kind === 'invitation') {
      const row = await queryOne(
        'SELECT title, content FROM invitation_reward_rules WHERE id = ? AND is_active = 1',
        [id],
      )
      if (!row) throw new HttpException('not found', HttpStatus.NOT_FOUND)
      html = String(row.content || '')
      title = String(row.title || '邀请规则')
    } else {
      throw new HttpException('invalid type', HttpStatus.BAD_REQUEST)
    }

    return { html, title }
  }

  /**
   * 公开 HTML 渲染页：供可访问公网域名的 web-view 打开
   * GET /api/system/html-render?type=config&key=about_us
   * GET /api/system/html-render?type=event&id=1
   * GET /api/system/html-render?type=project&id=6&toolbar=project&has_scored=0
   */
  @Public()
  @Get('html-render')
  async renderHtml(
    @Query('type') type: string,
    @Query('key') key: string,
    @Query('id') id: string,
    @Query('toolbar') toolbar: string,
    @Query('has_scored') hasScored: string,
    @Query('owner_id') ownerId: string,
    @Query('title') titleQuery: string,
    @Query('registered') registered: string,
    @Query('can_register') canRegister: string,
    @Query('blocked') blocked: string,
    @Query('stock') stock: string,
    @Res() res: Response,
  ) {
    const kind = String(type || '').trim()
    try {
      const { html, title } = await this.loadHtmlSource(kind, key, id)
      const signed = await this.uploadService.signHtmlMedia(rewriteLegacyCloudHostUrls(html))
      let page = ensureHtmlDocument(signed, title)
      const toolbarQuery: MpToolbarQuery = {
        toolbar,
        has_scored: hasScored,
        owner_id: ownerId,
        title: titleQuery || title,
        registered,
        can_register: canRegister,
        blocked,
        stock,
      }
      page = injectMpToolbar(page, String(id || key || ''), toolbarQuery)
      res.status(200)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=60')
      res.send(page)
    } catch (error: any) {
      if (error instanceof HttpException) {
        res.status(error.getStatus()).type('text/plain').send(String(error.message || 'error'))
        return
      }
      console.error('[html-render] load failed', error)
      res.status(500).type('text/plain').send('error')
    }
  }

  /**
   * 返回可供小程序 web-view 打开的 HTTPS 地址（云托管自定义域名 + html-render）。
   * web-view 不支持 callContainer，且 COS 域名默认不在业务域名白名单内。
   * GET /api/system/html-page-url?type=event&id=5
   */
  @Public()
  @Get('html-page-url')
  async htmlPageUrl(
    @Query('type') type: string,
    @Query('key') key: string,
    @Query('id') id: string,
  ) {
    const kind = String(type || '').trim()
    try {
      const { title } = await this.loadHtmlSource(kind, key, id)
      const url = buildWebViewHtmlPageUrl({ type: kind, key, id })
      if (!url) {
        throw new HttpException(
          '未配置可用的公网 HTTPS 域名（WEBVIEW_BASE_URL / PROJECT_DOMAIN），无法生成 web-view 地址',
          HttpStatus.SERVICE_UNAVAILABLE,
        )
      }
      return {
        code: 200,
        msg: 'success',
        data: {
          url,
          title,
        },
      }
    } catch (error: any) {
      if (error instanceof HttpException) throw error
      console.error('[html-page-url] failed', error)
      throw new HttpException(error?.message || '生成页面地址失败', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
