import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { queryOne } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'

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

  /**
   * 公开 HTML 渲染页：供小程序 web-view 打开完整富文本/H5 源码
   * GET /api/system/html-render?type=config&key=about_us
   * GET /api/system/html-render?type=article&id=1
   */
  @Get('html-render')
  async renderHtml(
    @Query('type') type: string,
    @Query('key') key: string,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    const kind = String(type || '').trim()
    let html = ''
    let title = '星河俱乐部'

    try {
      if (kind === 'config') {
        const configKey = String(key || '').trim()
        if (!CONFIG_KEYS.has(configKey)) {
          res.status(404).type('text/plain').send('not found')
          return
        }
        const row = await queryOne('SELECT config_value FROM configs WHERE config_key = ?', [configKey])
        html = String(row?.config_value || '')
        title = configKey === 'about_us' ? '关于我们' : title
      } else if (kind === 'article') {
        const row = await queryOne(
          'SELECT title, content FROM articles WHERE id = ? AND status = ?',
          [id, 'published'],
        )
        if (!row) {
          res.status(404).type('text/plain').send('not found')
          return
        }
        html = String(row.content || '')
        title = String(row.title || title)
      } else if (kind === 'event') {
        const row = await queryOne('SELECT title, description, content FROM events WHERE id = ?', [id])
        if (!row) {
          res.status(404).type('text/plain').send('not found')
          return
        }
        html = String(row.description || row.content || '')
        title = String(row.title || title)
      } else if (kind === 'project') {
        const row = await queryOne('SELECT title, description FROM projects WHERE id = ?', [id])
        if (!row) {
          res.status(404).type('text/plain').send('not found')
          return
        }
        html = String(row.description || '')
        title = String(row.title || title)
      } else if (kind === 'business') {
        const row = await queryOne(
          'SELECT title, content FROM business_opportunities WHERE id = ?',
          [id],
        )
        if (!row) {
          res.status(404).type('text/plain').send('not found')
          return
        }
        html = String(row.content || '')
        title = String(row.title || title)
      } else if (kind === 'product') {
        const row = await queryOne(
          'SELECT name, description FROM mall_products WHERE id = ? AND is_active = 1',
          [id],
        )
        if (!row) {
          res.status(404).type('text/plain').send('not found')
          return
        }
        html = String(row.description || '')
        title = String(row.name || title)
      } else if (kind === 'invitation') {
        const row = await queryOne(
          'SELECT title, content FROM invitation_reward_rules WHERE id = ? AND is_active = 1',
          [id],
        )
        if (!row) {
          res.status(404).type('text/plain').send('not found')
          return
        }
        html = String(row.content || '')
        title = String(row.title || '邀请规则')
      } else {
        res.status(400).type('text/plain').send('invalid type')
        return
      }
    } catch (error) {
      console.error('[html-render] load failed', error)
      res.status(500).type('text/plain').send('error')
      return
    }

    const signed = await this.uploadService.signHtmlMedia(html)
    const page = ensureHtmlDocument(signed, title)
    res.status(200)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.send(page)
  }
}
