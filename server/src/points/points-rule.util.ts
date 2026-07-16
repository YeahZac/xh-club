/** 积分规则：邀请奖励不在此模块，由「邀请奖励」配置 */

export const POINTS_RULE_PRESETS = [
  {
    code: 'attend_event',
    label: '参加活动',
    unit: '次',
    hint: '会员成功报名/参加活动达到设定次数后发放积分',
  },
  {
    code: 'deal_complete',
    label: '促成成交项目',
    unit: '个',
    hint: '会员作为成交方或撮合人完成成交达到设定个数后发放积分',
  },
  {
    code: 'member_days',
    label: '成为会员天数',
    unit: '天',
    hint: '自注册日起满设定天数后发放积分（默认仅发一次）',
  },
  {
    code: 'daily_login',
    label: '每日登录',
    unit: '次',
    hint: '每日首次登录小程序发放积分',
  },
  {
    code: 'daily_checkin',
    label: '每日签到',
    unit: '次',
    hint: '每日签到发放积分',
  },
  {
    code: 'talent_settle',
    label: '完成人才入驻',
    unit: '次',
    hint: '完成人才入驻后发放积分',
  },
  {
    code: 'custom',
    label: '自定义条件',
    unit: '次',
    hint: '自定义业务条件，由运营配置名称与阈值，需对应业务埋点触发',
  },
] as const

export type PointsRuleActionType = (typeof POINTS_RULE_PRESETS)[number]['code']

const PRESET_MAP = Object.fromEntries(POINTS_RULE_PRESETS.map((p) => [p.code, p])) as Record<
  string,
  (typeof POINTS_RULE_PRESETS)[number]
>

export function getPointsRulePreset(code: string) {
  return PRESET_MAP[code] || null
}

export function formatPointsRuleRow(row: any) {
  if (!row) return row
  const preset = getPointsRulePreset(String(row.action_type || ''))
  const threshold = Math.max(1, Number(row.threshold_value) || 1)
  const points = Math.max(0, Number(row.points_value) || 0)
  let conditions: any = row.conditions
  if (typeof conditions === 'string') {
    try {
      conditions = JSON.parse(conditions)
    } catch {
      conditions = null
    }
  }
  return {
    ...row,
    threshold_value: threshold,
    points_value: points,
    repeatable: !!row.repeatable,
    is_active: row.is_active === true || row.is_active === 1,
    action_label: preset?.label || row.action_type,
    unit: preset?.unit || '次',
    conditions,
    condition_text: `${preset?.label || row.rule_name || row.action_type}达到 ${threshold}${preset?.unit || '次'}，奖励 ${points} 积分`,
  }
}

export function normalizePointsRuleDto(dto: any) {
  const actionType = String(dto.action_type || dto.action || '').trim()
  if (!actionType) {
    throw new Error('请选择规则类型')
  }
  const preset = getPointsRulePreset(actionType)
  const ruleName = String(dto.rule_name || dto.name || preset?.label || actionType).trim()
  const pointsValue = Math.max(0, Math.floor(Number(dto.points_value ?? dto.points) || 0))
  if (pointsValue <= 0) {
    throw new Error('奖励积分必须大于 0')
  }
  const thresholdValue = Math.max(1, Math.floor(Number(dto.threshold_value ?? dto.threshold) || 1))
  const dailyLimit =
    dto.daily_limit === '' || dto.daily_limit === null || dto.daily_limit === undefined
      ? -1
      : Number(dto.daily_limit)
  const totalLimit =
    dto.total_limit === '' || dto.total_limit === null || dto.total_limit === undefined
      ? -1
      : Number(dto.total_limit)

  return {
    rule_name: ruleName,
    action_type: actionType,
    points_value: pointsValue,
    threshold_value: thresholdValue,
    description: String(dto.description || '').trim() || null,
    conditions: dto.conditions
      ? typeof dto.conditions === 'string'
        ? dto.conditions
        : JSON.stringify(dto.conditions)
      : JSON.stringify({ threshold: thresholdValue }),
    daily_limit: Number.isFinite(dailyLimit) ? dailyLimit : -1,
    total_limit: Number.isFinite(totalLimit) ? totalLimit : -1,
    is_active: dto.is_active !== false && dto.is_active !== 0,
    priority: Math.floor(Number(dto.priority) || 0),
    repeatable: !!(dto.repeatable === true || dto.repeatable === 1),
    start_date: dto.start_date || null,
    end_date: dto.end_date || null,
  }
}
