import Taro from '@tarojs/taro'

export const AUTH_OPEN_LOGIN_EVENT = 'auth:open-login'
export const AUTH_LOGGED_IN_EVENT = 'auth:logged-in'
export const AUTH_LOGGED_OUT_EVENT = 'auth:logged-out'

export interface MemberSession {
  memberId: string
  token: string
  openid?: string
}

type LoginWaiter = {
  resolve: (ok: boolean) => void
}

let loginWaiter: LoginWaiter | null = null

export const isWeappEnv = () => Taro.getEnv() === Taro.ENV_TYPE.WEAPP

export const getMemberSession = (): MemberSession | null => {
  const memberId = String(Taro.getStorageSync('member_id') || '')
  const token = String(Taro.getStorageSync('member_token') || '')
  if (!memberId || !token) return null
  const openid = String(Taro.getStorageSync('openid') || '')
  return { memberId, token, openid: openid || undefined }
}

export const isLoggedIn = () => !!getMemberSession()

export const saveMemberSession = (data: {
  member_id: string | number
  token: string
  openid?: string
}) => {
  Taro.setStorageSync('member_id', String(data.member_id))
  Taro.setStorageSync('member_token', data.token)
  if (data.openid) Taro.setStorageSync('openid', data.openid)
}

export const clearMemberSession = () => {
  Taro.removeStorageSync('member_id')
  Taro.removeStorageSync('member_token')
  Taro.removeStorageSync('openid')
}

export const logoutMember = () => {
  clearMemberSession()
  Taro.eventCenter.trigger(AUTH_LOGGED_OUT_EVENT)
}

/** 打开登录弹层；若已有等待中的 Promise，复用 */
export const openLoginSheet = () => {
  Taro.eventCenter.trigger(AUTH_OPEN_LOGIN_EVENT)
}

export const notifyLoginSuccess = () => {
  if (loginWaiter) {
    loginWaiter.resolve(true)
    loginWaiter = null
  }
  Taro.eventCenter.trigger(AUTH_LOGGED_IN_EVENT)
}

export const notifyLoginCancel = () => {
  if (loginWaiter) {
    loginWaiter.resolve(false)
    loginWaiter = null
  }
}

/**
 * 需要登录时调用：已登录直接 true；否则拉起微信授权登录弹层并等待结果。
 */
export const ensureLogin = async (tip = '请先登录'): Promise<boolean> => {
  if (isLoggedIn()) return true
  if (!isWeappEnv()) {
    Taro.showToast({ title: '请在微信小程序中登录', icon: 'none' })
    return false
  }
  if (tip) Taro.showToast({ title: tip, icon: 'none' })
  return new Promise((resolve) => {
    loginWaiter = { resolve }
    openLoginSheet()
  })
}
