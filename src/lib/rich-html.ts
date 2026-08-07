/** 去掉 HTML 标签，用于列表摘要展示 */
import { assertSafeHref } from '@/lib/safe-url'
import { buildWebViewHtmlPageUrl, DEFAULT_PUBLIC_ORIGIN } from '@/lib/webview-url'

export const stripHtml = (html?: string | null): string => {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** 是否为完整 HTML 页面（含样式/文档壳），需走 web-view 才能完整还原 */
export const isFullHtmlDocument = (html?: string | null): boolean => {
  const value = String(html || '').trim()
  if (!value) return false
  if (/<!DOCTYPE\s+html/i.test(value) || /<html[\s>]/i.test(value)) return true
  if (/<style[\s>]/i.test(value) && /<\/style>/i.test(value) && value.length > 600) return true
  if (/<head[\s>]/i.test(value) && /<body[\s>]/i.test(value)) return true
  return false
}

/** 从完整文档中提取 body 内层，供 RichText 降级展示 */
export const extractHtmlBody = (html?: string | null): string => {
  const value = String(html || '').trim()
  if (!value) return ''
  const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch?.[1]) return bodyMatch[1].trim()
  return value
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .trim()
}

export type HtmlRenderType =
  | 'config'
  | 'article'
  | 'event'
  | 'project'
  | 'business'
  | 'product'
  | 'invitation'

/** 构造可供 web-view 打开的 HTML 渲染地址 */
export const buildHtmlRenderUrl = buildWebViewHtmlPageUrl

/**
 * 规范化富文本 HTML，适配微信小程序 RichText：
 * - 图片撑满宽度
 * - 链接可点击样式
 * - 段落字号与行距（小程序 RichText 不继承外层 class）
 */
export const normalizeRichHtml = (html?: string | null): string => {
  if (!html) return ''
  let value = extractHtmlBody(html)
  if (!value || value === '<p><br></p>') return ''

  // 历史富文本里可能残留云托管内网域，改写为公网业务域
  value = value
    .replace(/https?:\/\/[a-z0-9.-]*0y09mxrz\.com/gi, DEFAULT_PUBLIC_ORIGIN)
    .replace(/https?:\/\/[a-z0-9.-]*\.tcb\.qcloud\.la/gi, DEFAULT_PUBLIC_ORIGIN)

  // 剥离脚本、事件处理器与危险协议；style 标签对 RichText 无效，去掉避免裸露代码
  value = value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\s+on\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')

  const escapeAttr = (input: string) =>
    String(input || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  value = value.replace(
    /<img([^>]*?)>/gi,
    (_match, attrs: string) => {
      let next = attrs
      if (!/style=/i.test(next)) {
        next += ' style="max-width:100%;width:100%;height:auto;display:block;margin:12px 0;"'
      } else if (!/max-width/i.test(next)) {
        next = next.replace(
          /style=(["'])(.*?)\1/i,
          (_m, q: string, style: string) => `style=${q}${style};max-width:100%;width:100%;height:auto;display:block;${q}`,
        )
      }
      return `<img${next}>`
    },
  )

  value = value.replace(
    /<a([^>]*?)href\s*=\s*(['"])(.*?)\2([^>]*)>/gi,
    (_match, before: string, quote: string, href: string, after: string) => {
      const safeHref = assertSafeHref(href)
      if (!safeHref) return ''
      const attrs = `${before}href=${quote}${safeHref}${quote}${after}`
      if (/style=/i.test(attrs)) return `<a${attrs}>`
      return `<a${attrs} style="color:#2563eb;text-decoration:underline;">`
    },
  )

  value = value.replace(
    /<a((?![^>]*href)[^>]*)>/gi,
    (_match, attrs: string) => {
      if (/style=/i.test(attrs)) return `<a${attrs}>`
      return `<a${attrs} style="color:#2563eb;text-decoration:underline;">`
    },
  )

  // Quill 文字颜色：转为 font 标签，提升微信小程序 RichText 兼容性
  // 注意：勿把 background-color 误匹配成 color（用 (?<!-) 排除）
  value = value.replace(
    /<span[^>]*style=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/span>/gi,
    (match, _q: string, style: string, inner: string) => {
      const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)
      if (!colorMatch?.[1]) return match
      const color = colorMatch[1].trim()
      if (!color) return match
      return `<font color="${escapeAttr(color)}">${inner}</font>`
    },
  )

  // 段落：放大字号、拉开行距（RichText 内联样式才能生效）
  value = value.replace(
    /<p(\s[^>]*)?>/gi,
    (_match, attrs = '') => {
      const rest = attrs || ''
      if (/style=/i.test(rest)) {
        return `<p${rest.replace(
          /style=(["'])(.*?)\1/i,
          (_m, q: string, style: string) =>
            `style=${q}${style};font-size:16px;line-height:1.75;margin:0 0 12px;color:#334155;${q}`,
        )}>`
      }
      return `<p${rest} style="font-size:16px;line-height:1.75;margin:0 0 12px;color:#334155;">`
    },
  )

  // 纯文本无标签时包一层
  if (!/<[a-z][\s\S]*>/i.test(value)) {
    value = `<p style="font-size:16px;line-height:1.75;margin:0 0 12px;color:#334155;">${value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')}</p>`
  }

  return value
}

export interface HtmlAttachment {
  url: string
  name: string
  isPdf: boolean
}

/** 从富文本 HTML 中提取可预览的附件链接 */
export const extractHtmlAttachments = (html?: string | null): HtmlAttachment[] => {
  if (!html) return []
  const list: HtmlAttachment[] = []
  const seen = new Set<string>()
  const pattern = /<a[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    const url = String(match[2] || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    const label = stripHtml(match[3] || '') || url.split('/').pop() || '附件'
    const lower = url.toLowerCase()
    const isDoc = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(?:$|[?#])/i.test(lower)
    if (!isDoc) continue
    list.push({ url, name: label, isPdf: /\.pdf(?:$|[?#])/i.test(lower) })
  }
  return list
}
