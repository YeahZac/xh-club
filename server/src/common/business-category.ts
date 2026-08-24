/** 商机分类：DB 键保持稳定，仅改展示文案 */

export const BUSINESS_CATEGORIES = ['roadshow', 'financing', 'resource', 'life'] as const
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]

/** 用户可自行发布的商机分类（不含路演） */
export const USER_BUSINESS_CATEGORIES = ['financing', 'resource', 'life'] as const

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  roadshow: '项目路演',
  financing: '商业需求',
  resource: '资源需求',
  life: '生活需求',
}

export function businessCategoryLabel(category: string | null | undefined): string {
  if (!category) return ''
  return BUSINESS_CATEGORY_LABELS[category as BusinessCategory] || category
}

export function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === 'string' && (BUSINESS_CATEGORIES as readonly string[]).includes(value)
}

export function isUserBusinessCategory(
  value: unknown,
): value is (typeof USER_BUSINESS_CATEGORIES)[number] {
  return typeof value === 'string' && (USER_BUSINESS_CATEGORIES as readonly string[]).includes(value)
}

/** 需要联系人/需求人才字段的分类 */
export function isDemandBusinessCategory(category: string): boolean {
  return category === 'financing' || category === 'resource' || category === 'life'
}
