function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** 云托管内网 / 临时域名：不可作为公网 API、web-view、媒体拼域 */
export function isBlockedPublicHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase()
  if (!host) return true
  if (/(?:^|\.)0y09mxrz\.com$/i.test(host)) return true
  if (/(?:^|\.)tcb\.qcloud\.la$/i.test(host)) return true
  if (/\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(host)) return true
  if (/localhost|127\.0\.0\.1/i.test(host)) return true
  return false
}

function toHttpsCandidate(raw: string): string | null {
  let value = trimTrailingSlash(String(raw || '').trim())
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`
  }
  if (value.startsWith('http://') && !/localhost|127\.0\.0\.1/i.test(value)) {
    value = `https://${value.slice('http://'.length)}`
  }
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    if (isBlockedPublicHost(parsed.hostname)) return null
    return trimTrailingSlash(parsed.origin)
  } catch {
    return null
  }
}

/**
 * 对外公网 HTTPS 基址（自定义域名）。
 * 优先级：WEBVIEW_BASE_URL → PUBLIC_BASE_URL → PROJECT_DOMAIN
 * 自动过滤云托管内网域名与 COS 临时域。
 */
export function getPublicHttpsBaseUrl(): string {
  const candidates = [
    process.env.WEBVIEW_BASE_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.PROJECT_DOMAIN,
  ]
  for (const raw of candidates) {
    const next = toHttpsCandidate(String(raw || ''))
    if (next) return next
  }
  return ''
}

/** 把历史内网域名绝对地址改写为当前公网域名，避免富文本/配置里残留旧链接 */
export function rewriteLegacyCloudHostUrls(input: string): string {
  const html = String(input || '')
  if (!html) return html
  const publicBase = getPublicHttpsBaseUrl()
  if (!publicBase) return html

  return html
    .replace(/https?:\/\/[a-z0-9.-]*0y09mxrz\.com/gi, publicBase)
    .replace(/https?:\/\/[a-z0-9.-]*\.tcb\.qcloud\.la/gi, publicBase)
}
