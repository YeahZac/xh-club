/** 邀请奖励：触发条件预设（管理台可增删选用） */
export const INVITE_CONDITION_PRESETS = [
  { code: 'invitee_register_login', label: '新会员输入推荐码并登录小程序' },
  { code: 'invitee_deal', label: '邀请的新会员成交项目后' },
  { code: 'invitee_event', label: '新会员参加活动后' },
  { code: 'invitee_paid_member', label: '新会员成为付费会员后' },
  { code: 'invitee_talent', label: '新会员完成人才入驻后' },
  { code: 'invitee_mall_order', label: '新会员完成商城兑换/下单后' },
] as const

export type InviteConditionCode = (typeof INVITE_CONDITION_PRESETS)[number]['code'] | 'custom'

export interface InviteConditionItem {
  code: string
  label: string
}

export interface InviteRewardValues {
  points_value: number
  growth_value: number
  earnings_value: number
  contribution_value: number
}

const PRESET_LABEL_MAP = Object.fromEntries(
  INVITE_CONDITION_PRESETS.map((item) => [item.code, item.label]),
) as Record<string, string>

export function parseInviteConditions(raw: unknown): InviteConditionItem[] {
  if (!raw) return []
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []

  const result: InviteConditionItem[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item === 'string') {
      const code = item.trim()
      if (!code || seen.has(code)) continue
      seen.add(code)
      result.push({
        code,
        label: PRESET_LABEL_MAP[code] || code,
      })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const code = String(row.code || '').trim() || 'custom'
    const label = String(row.label || PRESET_LABEL_MAP[code] || '').trim()
    if (!label) continue
    const key = `${code}:${label}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ code, label })
  }
  return result
}

export function normalizeInviteConditions(input: unknown): InviteConditionItem[] {
  return parseInviteConditions(input)
}

export function normalizeInviteRewards(dto: Record<string, any> = {}): InviteRewardValues {
  const points = Math.max(0, Number(dto.points_value ?? dto.reward_value ?? 0) || 0)
  const growth = Math.max(
    0,
    Number(dto.growth_value ?? dto.experience_value ?? 0) || 0,
  )
  const earnings = Math.max(0, Number(dto.earnings_value ?? 0) || 0)
  const contribution = Math.max(0, Number(dto.contribution_value ?? 0) || 0)
  return {
    points_value: points,
    growth_value: growth,
    earnings_value: Number(earnings.toFixed(2)),
    contribution_value: contribution,
  }
}

export function hasAnyInviteReward(rewards: InviteRewardValues): boolean {
  return (
    rewards.points_value > 0
    || rewards.growth_value > 0
    || rewards.earnings_value > 0
    || rewards.contribution_value > 0
  )
}

export function inferLegacyRewardType(rewards: InviteRewardValues): string {
  const flags = [
    rewards.points_value > 0 ? 'points' : '',
    rewards.growth_value > 0 ? 'growth' : '',
    rewards.earnings_value > 0 ? 'earnings' : '',
    rewards.contribution_value > 0 ? 'contribution' : '',
  ].filter(Boolean)
  if (!flags.length) return 'none'
  if (flags.length === 1) return flags[0]
  return 'multi'
}

export function formatInviteRuleRow(row: any) {
  if (!row) return row
  const rewards = normalizeInviteRewards(row)
  const conditions = parseInviteConditions(row.conditions)
  return {
    ...row,
    ...rewards,
    // 兼容旧字段
    experience_value: rewards.growth_value,
    conditions,
  }
}
