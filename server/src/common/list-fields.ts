/** 列表场景瘦身：仅当客户端显式传 fields=list / slim=1 时生效，旧客户端行为不变 */
export function wantsListFields(query: Record<string, unknown> | null | undefined): boolean {
  const fields = String(query?.fields || '').trim().toLowerCase()
  if (fields === 'list' || fields === 'slim' || fields === 'card') return true
  const slim = String(query?.slim || '').trim().toLowerCase()
  return slim === '1' || slim === 'true' || slim === 'yes'
}
