import Taro from '@tarojs/taro'

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

/** 小程序端直接打开登录页（App 层 fixed 弹层真机不渲染） */
export const openLoginSheet = () => {
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1]
  const route = String((current as any)?.route || '')
  console.log('[auth] openLoginPage', { route, env: Taro.getEnv() })
  if (route.includes('pages/login/index')) return

  Taro.navigateTo({
    url: '/pages/login/index',
    fail: (err) => {
      console.error('[auth] navigateTo login failed', err)
      Taro.showToast({ title: '无法打开登录页', icon: 'none' })
      notifyLoginCancel()
    },
  })
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
 * 需要登录时跳转登录页。
 * @param force 为 true 时即使本地有 token 也重新打开登录
 */
export const ensureLogin = async (
  _tip = '请先登录',
  force = false,
): Promise<boolean> => {
  console.log('[auth] ensureLogin', {
    loggedIn: isLoggedIn(),
    force,
    env: Taro.getEnv(),
  })
  if (!force && isLoggedIn()) return true
  if (!isWeappEnv()) {
    Taro.showToast({ title: '请在微信小程序中登录', icon: 'none' })
    return false
  }
  return new Promise((resolve) => {
    if (loginWaiter) {
      const prev = loginWaiter.resolve
      loginWaiter = {
        resolve: (ok) => {
          prev(ok)
          resolve(ok)
        },
      }
      openLoginSheet()
      return
    }
    loginWaiter = { resolve }
    openLoginSheet()
  })
}
