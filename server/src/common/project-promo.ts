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
