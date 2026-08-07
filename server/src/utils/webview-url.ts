function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** COS / 云开发临时域名无法作为 web-view 业务域名，需走云托管自定义域名 + html-render */
export function isBlockedWebViewHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase()
  if (!host) return true
  if (/\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(host)) return true
  if (/\.tcb\.qcloud\.la$/i.test(host)) return true
  return false
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
 * 必须使用 WEBVIEW_BASE_URL（云托管已备案自定义 HTTPS 域名），
 * 并在小程序后台配置为「业务域名」。
 */
export function buildWebViewHtmlPageUrl(params: {
  type: string
  key?: string
  id?: string | number
}): string | null {
  const base = trimTrailingSlash(
    String(process.env.WEBVIEW_BASE_URL || process.env.PROJECT_DOMAIN || '').trim(),
  )
  if (!base) return null

  const search = new URLSearchParams({ type: String(params.type || '').trim() })
  if (params.key) search.set('key', String(params.key))
  if (params.id != null && params.id !== '') search.set('id', String(params.id))

  const path = `/api/system/html-render?${search.toString()}`
  const candidates: string[] = []

  if (base.startsWith('http://') && !/localhost|127\.0\.0\.1/i.test(base)) {
    candidates.push(`https://${base.slice('http://'.length)}${path}`)
  }
  if (base.startsWith('http://') || base.startsWith('https://')) {
    candidates.push(`${base}${path}`)
  } else {
    candidates.push(`https://${base}${path}`)
  }

  for (const url of candidates) {
    if (isAllowedWebViewUrl(url)) return url
  }
  return null
}
