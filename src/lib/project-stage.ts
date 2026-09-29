/** 与后台管理 STAGE_MAP 保持一致 */
export const PROJECT_STAGE_MAP: Record<string, string> = {
  seed: '种子期',
  angel: '天使轮',
  pre_a: 'Pre-A',
  a: 'A轮',
  b: 'B轮',
  c: 'C轮',
  growth: '成长期',
  ip: 'IPO',
  bootstrapped: '自有资金',
}

export const PROJECT_STAGE_OPTIONS = Object.entries(PROJECT_STAGE_MAP).map(([value, label]) => ({
  value,
  label,
}))

export const formatProjectStage = (stage?: string | null) => {
  const key = String(stage || '').trim()
  if (!key) return ''
  return PROJECT_STAGE_MAP[key] || key
}
