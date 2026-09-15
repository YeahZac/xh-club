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
 * 对非推广员/会员单位隐藏正文中含「佣金」的片段（纯文本按行；HTML 按块/行内节点）。
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
  // 含「佣金」的常见块级节点整段移除
  out = out.replace(
    /<(p|div|li|tr|section|article|blockquote|h[1-6])(\s[^>]*)?>[\s\S]*?佣金[\s\S]*?<\/\1>/gi,
    '',
  )
  // 含「佣金」的行内节点移除
  out = out.replace(
    /<(span|strong|em|b|i|u|font|a|label)(\s[^>]*)?>[^<]*佣金[^<]*<\/\1>/gi,
    '',
  )
  // 按 <br> 拆行，去掉含「佣金」的行
  out = out
    .split(/<br\s*\/?>/i)
    .filter((part) => !part.includes('佣金'))
    .join('<br/>')
  // 兜底：去掉仍残留的含「佣金」纯文本片段
  if (out.includes('佣金')) {
    out = out.replace(/[^<>\n]*佣金[^<>\n]*/g, '')
  }
  return out
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>')
    .replace(/(<p>\s*<\/p>\s*)+/gi, '')
    .trim()
}
