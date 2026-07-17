/** 去掉 HTML 标签，用于列表摘要展示 */
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

/**
 * 规范化富文本 HTML，适配微信小程序 RichText：
 * - 图片撑满宽度
 * - 链接可点击样式
 */
export const normalizeRichHtml = (html?: string | null): string => {
  if (!html) return ''
  let value = html.trim()
  if (!value || value === '<p><br></p>') return ''

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
    /<a([^>]*?)>/gi,
    (_match, attrs: string) => {
      if (/style=/i.test(attrs)) return `<a${attrs}>`
      return `<a${attrs} style="color:#2563eb;text-decoration:underline;">`
    },
  )

  // Quill 文字颜色：转为 font 标签，提升微信小程序 RichText 兼容性
  value = value.replace(
    /<span[^>]*style="[^"]*color:\s*([^";]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_match, color: string, inner: string) => `<font color="${color.trim()}">${inner}</font>`,
  )

  return value
}
