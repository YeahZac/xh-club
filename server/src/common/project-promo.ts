/** 项目推广合作模式 */
export const PROMO_COOP_MODES = [
  'customer_referral',
  'project_deal',
  'resource_match',
  'channel_coop',
  'equity_coop',
] as const

export type PromoCoopMode = (typeof PROMO_COOP_MODES)[number]

export const PROMO_COOP_MODE_LABELS: Record<PromoCoopMode, string> = {
  customer_referral: '客户引荐',
  project_deal: '项目成交',
  resource_match: '资源需求',
  channel_coop: '渠道合作',
  equity_coop: '股权合作',
}

export function normalizePromoCoopMode(value: unknown): PromoCoopMode | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if ((PROMO_COOP_MODES as readonly string[]).includes(raw)) return raw as PromoCoopMode
  return null
}

export function promoCoopModeLabel(value: unknown): string {
  const mode = normalizePromoCoopMode(value)
  return mode ? PROMO_COOP_MODE_LABELS[mode] : ''
}

/**
 * 对非推广员/会员单位隐藏正文中含「佣金」的片段。
 * 只删同一标签内含佣金的小段，避免跨标签误删整页。
 */
export function stripCommissionMentions(input: unknown): string {
  const raw = String(input ?? '')
  if (!raw || !raw.includes('佣金')) return raw

  const isHtml = /<[a-z][\s\S]*>/i.test(raw)
  if (!isHtml) {
    return raw
      .split(/\r?\n/)
      .filter((line) => !line.includes('佣金'))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  let out = raw
  const blockRe =
    /<(p|li|tr|blockquote|h[1-6])(\s[^>]*)?>[^<]*佣金[^<]*<\/\1>/gi
  let prev = ''
  while (prev !== out) {
    prev = out
    out = out.replace(blockRe, '')
  }
  out = out.replace(
    /<(span|strong|em|b|i|u|font|a|label)(\s[^>]*)?>[^<]*佣金[^<]*<\/\1>/gi,
    '',
  )
  out = out
    .split(/<br\s*\/?>/i)
    .filter((part) => !part.includes('佣金'))
    .join('<br/>')
  if (out.includes('佣金')) {
    out = out.replace(/>([^<]*佣金[^<]*)</g, '><')
  }
  return out
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>')
    .replace(/(<p>\s*<\/p>\s*)+/gi, '')
    .trim()
}
