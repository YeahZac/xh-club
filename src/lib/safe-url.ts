import { isBlockedPublicHost } from '@/lib/webview-url'

/** 校验外部链接，仅允许 https（或开发环境 http localhost / 项目公网域） */
const decodeUrlEntities = (raw: string): string =>
  String(raw || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

const readAllowedHosts = (): string[] => {
  const hosts: string[] = []
  const candidates = [
    typeof WEBVIEW_BASE_URL !== 'undefined' ? WEBVIEW_BASE_URL : '',
    typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : '',
  ]
  for (const raw of candidates) {
    const value = String(raw || '').trim()
    if (!value) continue
    try {
      const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      if (parsed.hostname) hosts.push(parsed.hostname.toLowerCase())
    } catch {
      /* ignore */
    }
  }
  return hosts
}

export const isSafeExternalUrl = (raw: string): boolean => {
  const target = decodeUrlEntities(String(raw || '').trim())
  if (!target) return false
  try {
    const parsed = new URL(target)
    if (isBlockedPublicHost(parsed.hostname)) return false
    if (parsed.protocol === 'https:') return true
    if (parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)) {
      return true
    }
    // 允许打开本项目公网域名（历史 http 配置兼容）
    if (parsed.protocol === 'http:') {
      const allowed = readAllowedHosts()
      if (allowed.includes(parsed.hostname.toLowerCase())) return true
    }
    return false
  } catch {
    return false
  }
}

export const assertSafeExternalUrl = (raw: string): string | null => {
  const target = decodeUrlEntities(String(raw || '').trim())
  return isSafeExternalUrl(target) ? target : null
}

/** 富文本内链：允许 #、相对路径、https */
export const assertSafeHref = (href: string): string | null => {
  const target = String(href || '').trim()
  if (!target) return null
  if (target.startsWith('#')) return target
  if (target.startsWith('/') && !target.startsWith('//')) return target
  return assertSafeExternalUrl(target)
}
