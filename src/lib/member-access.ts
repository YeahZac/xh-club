import Taro from '@tarojs/taro'
import { Network } from '@/network'
import {
  AUTH_LOGGED_IN_EVENT,
  AUTH_LOGGED_OUT_EVENT,
  ensureLogin,
  getMemberSession,
} from '@/lib/auth'
import { normalizeUserCategory, type UserCategory } from '@/lib/user-category'

export const MEMBER_APPLY_PAGE_URL = '/pages/member-apply/index'

const PROMOTER_OR_MEMBER_UNIT: UserCategory[] = ['promoter', 'member_unit']

let cachedCategory: UserCategory | null = null
let cachedMemberId: string | null = null

const resetCategoryCache = () => {
  cachedCategory = null
  cachedMemberId = null
}

Taro.eventCenter.on(AUTH_LOGGED_IN_EVENT, resetCategoryCache)
Taro.eventCenter.on(AUTH_LOGGED_OUT_EVENT, resetCategoryCache)

export const isPromoterOrMemberUnit = (category: unknown): boolean => {
  const normalized = normalizeUserCategory(category)
  return PROMOTER_OR_MEMBER_UNIT.includes(normalized)
}

/** 项目详情「推广收益 / 推广员佣金」仅推广员、会员单位可见 */
export const canViewPromoCommission = (category: unknown): boolean =>
  isPromoterOrMemberUnit(category)

export const fetchMemberUserCategory = async (): Promise<UserCategory> => {
  const session = getMemberSession()
  if (!session) return 'normal'

  if (cachedMemberId === session.memberId && cachedCategory) {
    return cachedCategory
  }

  try {
    const res = await Network.request({ url: `/api/members/profile/${session.memberId}` })
    const category = normalizeUserCategory(res?.data?.data?.user_category)
    cachedCategory = category
    cachedMemberId = session.memberId
    return category
  } catch {
    return 'normal'
  }
}

export const showPromoterOrMemberUnitRequiredModal = async (_featureLabel?: string) => {
  const { confirm } = await Taro.showModal({
    title: '权限提示',
    content: '当前功能仅对推广员/会员单位开放',
    confirmText: '立即申请',
    cancelText: '取消',
    showCancel: true,
  })
  if (confirm) {
    Taro.navigateTo({ url: MEMBER_APPLY_PAGE_URL })
  }
  return confirm
}

const leaveProtectedPage = () => {
  const pages = Taro.getCurrentPages()
  if (pages.length > 1) {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/index/index' }),
    })
    return
  }
  Taro.switchTab({ url: '/pages/index/index' })
}

/**
 * 入口点击前校验：无权限时弹窗，点确定后进入「关于我们」。
 */
export const ensurePromoterOrMemberUnit = async (featureLabel?: string): Promise<boolean> => {
  if (!(await ensureLogin())) return false

  const category = await fetchMemberUserCategory()
  if (isPromoterOrMemberUnit(category)) return true

  await showPromoterOrMemberUnitRequiredModal(featureLabel)
  return false
}

/**
 * 受保护页面加载时校验：无权限时弹窗，点确定后替换为「关于我们」。
 */
export const guardPromoterOrMemberUnitPage = async (featureLabel: string): Promise<boolean> => {
  if (!(await ensureLogin())) {
    leaveProtectedPage()
    return false
  }

  const category = await fetchMemberUserCategory()
  if (isPromoterOrMemberUnit(category)) return true

  await showPromoterOrMemberUnitRequiredModal(featureLabel)
  leaveProtectedPage()
  return false
}
