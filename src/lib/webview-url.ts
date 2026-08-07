import { assertSafeExternalUrl } from '@/lib/safe-url'
import type { HtmlRenderType } from '@/lib/rich-html'

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

/** 生产公网业务域名（web-view / 富文本 H5 最终回退，避免编译进云托管内网域） */
export const DEFAULT_PUBLIC_ORIGIN = 'https://xinghegogo.cn'

/** 云托管内网 / COS 临时域：不可作为 web-view / 公网业务域名 */
export const isBlockedPublicHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase()
  if (!host) return true
  if (/(?:^|\.)0y09mxrz\.com$/i.test(host)) return true
  if (/(?:^|\.)tcb\.qcloud\.la$/i.test(host)) return true
  if (/\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(host)) return true
  return false
}

export const isBlockedWebViewHost = isBlockedPublicHost

export const isCosWebViewUrl = (raw: string): boolean => {
  const target = String(raw || '').trim()
  if (!target) return false
  try {
    return isBlockedWebViewHost(new URL(target).hostname)
  } catch {
    return false
  }
}

const toHttpsBase = (raw: string): string => {
  let value = trimTrailingSlash(String(raw || '').trim())
  if (!value) return ''
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  if (value.startsWith('http://') && !/localhost|127\.0\.0\.1/i.test(value)) {
    value = `https://${value.slice('http://'.length)}`
  }
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return ''
    if (isBlockedPublicHost(parsed.hostname)) return ''
    return trimTrailingSlash(parsed.origin)
  } catch {
    return ''
  }
}

/** 小程序/H5 对外 HTTPS 基址 */
export const getPublicHttpsBaseUrl = (): string => {
  const candidates = [
    typeof WEBVIEW_BASE_URL !== 'undefined' ? WEBVIEW_BASE_URL : '',
    typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : '',
    DEFAULT_PUBLIC_ORIGIN,
  ]
  for (const raw of candidates) {
    const next = toHttpsBase(String(raw || ''))
    if (next) return next
  }
  return DEFAULT_PUBLIC_ORIGIN
}

/** 将历史内网域 / HTML 实体编码的 web-view 地址规范为可打开的公网 URL */
export const normalizeWebViewPageUrl = (raw: string): string | null => {
  let target = String(raw || '')
    .trim()
    .replace(/&amp;/gi, '&')
  if (!target) return null

  try {
    const parsed = new URL(target)
    if (isBlockedPublicHost(parsed.hostname)) {
      const base = getPublicHttpsBaseUrl()
      target = `${base}${parsed.pathname}${parsed.search}`
    }
  } catch {
    return null
  }

  const safe = assertSafeExternalUrl(target)
  if (!safe || isCosWebViewUrl(safe)) return null
  return safe
}

/**
 * 构造 web-view 可打开的 HTML 渲染地址（自定义 HTTPS 域名 + /api/system/html-render）。
 * 域名须在小程序后台「业务域名」中配置；不可使用 COS / 云托管内网域名。
 */
export const buildWebViewHtmlPageUrl = (
  type: HtmlRenderType,
  params: { key?: string; id?: string | number },
): string | null => {
  const base = getPublicHttpsBaseUrl()
  if (!base) return null

  const search = new URLSearchParams({ type })
  if (params.key) search.set('key', String(params.key))
  if (params.id != null && params.id !== '') search.set('id', String(params.id))

  const url = `${base}/api/system/html-render?${search.toString()}`
  return normalizeWebViewPageUrl(url)
}
