/** 后台可控的用户类型（展示标签） */
export const USER_CATEGORIES = ['normal', 'promoter', 'member_unit'] as const
export type UserCategory = (typeof USER_CATEGORIES)[number]

export const USER_CATEGORY_LABELS: Record<UserCategory, string> = {
  normal: '普通用户',
  promoter: '推广员',
  member_unit: '会员单位',
}

export function normalizeUserCategory(value: unknown): UserCategory {
  const raw = String(value || '').trim()
  if ((USER_CATEGORIES as readonly string[]).includes(raw)) return raw as UserCategory
  return 'normal'
}

export function userCategoryLabel(value: unknown): string {
  return USER_CATEGORY_LABELS[normalizeUserCategory(value)]
}
