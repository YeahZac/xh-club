import { getPublicHttpsBaseUrl, isBlockedPublicHost } from '@/utils/public-base-url'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** COS / 云开发临时域名无法作为 web-view 业务域名，需走云托管自定义域名 + html-render */
export function isBlockedWebViewHost(hostname: string): boolean {
  return isBlockedPublicHost(hostname)
}

export function isAllowedWebViewUrl(raw: string): boolean {
  const target = String(raw || '').trim()
  if (!target) return false
  try {
    const parsed = new URL(target)
    if (parsed.protocol !== 'https:') return false
    return !isBlockedWebViewHost(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * 构造可供小程序 web-view 打开的 HTML 渲染地址。
 * 必须使用已备案 HTTPS 自定义域名，并在小程序后台配置为「业务域名」。
 */
export function buildWebViewHtmlPageUrl(params: {
  type: string
  key?: string
  id?: string | number
  extra?: Record<string, string | number | boolean | undefined | null>
}): string | null {
  const base = trimTrailingSlash(getPublicHttpsBaseUrl())
  if (!base) return null

  const search = new URLSearchParams({ type: String(params.type || '').trim() })
  if (params.key) search.set('key', String(params.key))
  if (params.id != null && params.id !== '') search.set('id', String(params.id))
  if (params.extra) {
    Object.entries(params.extra).forEach(([k, v]) => {
      if (v == null || v === '') return
      search.set(k, String(v))
    })
  }

  const url = `${base}/api/system/html-render?${search.toString()}`
  return isAllowedWebViewUrl(url) ? url : null
}
