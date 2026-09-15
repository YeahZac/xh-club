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
/** 防止并发 ensureLogin 重复 navigateTo，触发微信 navigateTo:fail timeout */
let loginNavigating = false

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
  Taro.removeStorageSync('member_token_refreshed_at')
}

export const logoutMember = () => {
  clearMemberSession()
  Taro.eventCenter.trigger(AUTH_LOGGED_OUT_EVENT)
}

/**
 * 校验本地登录是否仍有效（账号被后台删除 / Token 真正失效时清理）。
 * 网络抖动或业务错误不得强制退出。
 */
export const validateMemberSession = async (): Promise<boolean> => {
  const session = getMemberSession()
  if (!session) return false

  try {
    const { Network } = await import('@/network')
    const res = await Network.request({
      url: `/api/members/profile/${session.memberId}`,
    })
    const code = Number(res?.data?.code)
    const data = res?.data?.data
    if (code === 200 && data) {
      void maybeRefreshMemberToken()
      return true
    }

    // 仅凭证失效或会员已删除时退出
    if (code === 401 || code === 404) {
      logoutMember()
      return false
    }
    // 403/其它业务码：保留登录态
    return true
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.status || 0)
    const msg = String(error?.message || error?.errMsg || '')
    if (status === 401 || msg.includes('登录已失效') || msg.includes('登录凭证无效')) {
      logoutMember()
      return false
    }
    if (status === 404 || msg.includes('会员不存在')) {
      logoutMember()
      return false
    }
    // 网络抖动 / 服务端短暂异常：保留本地登录态
    return true
  }
}

const TOKEN_REFRESHED_AT_KEY = 'member_token_refreshed_at'
const TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

/** 活跃用户每天最多续期一次 Token */
export const maybeRefreshMemberToken = () => {
  const last = Number(Taro.getStorageSync(TOKEN_REFRESHED_AT_KEY) || 0)
  if (Date.now() - last < TOKEN_REFRESH_INTERVAL_MS) return
  void refreshMemberToken()
    .then((ok) => {
      if (ok) Taro.setStorageSync(TOKEN_REFRESHED_AT_KEY, Date.now())
    })
    .catch(() => undefined)
}

/** 用当前有效凭证换发新 Token（延长登录态） */
export const refreshMemberToken = async (): Promise<boolean> => {
  const session = getMemberSession()
  if (!session) return false
  try {
    const { Network } = await import('@/network')
    const res = await Network.request({
      url: '/api/auth/refresh',
      method: 'POST',
    })
    const token = String(res?.data?.data?.token || '').trim()
    if (res?.data?.code === 200 && token) {
      saveMemberSession({
        member_id: res?.data?.data?.member_id || session.memberId,
        token,
        openid: session.openid,
      })
      Taro.setStorageSync(TOKEN_REFRESHED_AT_KEY, Date.now())
      return true
    }
    return false
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.status || 0)
    const msg = String(error?.message || error?.errMsg || '')
    if (status === 401 || msg.includes('登录已失效') || msg.includes('登录凭证无效')) {
      logoutMember()
    }
    return false
  }
}

const LOGIN_PAGE_URL = '/pages/login/index'

const isLoginRoute = (route: string) => route.includes('pages/login/index')

/** 小程序端直接打开登录页（App 层 fixed 弹层真机不渲染） */
export const openLoginSheet = () => {
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1]
  const route = String((current as any)?.route || '')
  console.log('[auth] openLoginPage', {
    route,
    stack: pages.length,
    navigating: loginNavigating,
    env: Taro.getEnv(),
  })
  // 已在登录页：保留 ensureLogin waiter，由登录页 success / unload 结算
  if (isLoginRoute(route)) return

  // 登录页在栈中但非当前页：回到登录页，避免 waiter 永久挂起
  const loginStackIndex = pages.findIndex((page) =>
    isLoginRoute(String((page as any)?.route || '')),
  )
  if (loginStackIndex >= 0) {
    const delta = pages.length - 1 - loginStackIndex
    if (delta > 0) {
      Taro.navigateBack({
        delta,
        fail: (err) => {
          console.warn('[auth] navigateBack to login failed', err)
          notifyLoginCancel()
        },
      })
      return
    }
  }

  // 已有跳转进行中：保留 waiter，避免重复 navigate 与永久 pending
  if (loginNavigating) return

  loginNavigating = true
  const clearNavigating = () => {
    loginNavigating = false
  }

  const failOpen = (stage: string, err: unknown) => {
    console.error(`[auth] ${stage} login failed`, err)
    clearNavigating()
    Taro.showToast({ title: '无法打开登录页', icon: 'none' })
    notifyLoginCancel()
  }

  const tryReLaunch = () => {
    Taro.reLaunch({
      url: LOGIN_PAGE_URL,
      success: clearNavigating,
      fail: (err) => failOpen('reLaunch', err),
    })
  }

  const tryRedirect = () => {
    Taro.redirectTo({
      url: LOGIN_PAGE_URL,
      success: clearNavigating,
      fail: (err) => {
        console.warn('[auth] redirectTo login failed, fallback reLaunch', err)
        tryReLaunch()
      },
    })
  }

  // 页面栈较深时 navigateTo 易失败/超时，直接替换当前页
  if (pages.length >= 8) {
    tryRedirect()
    return
  }

  Taro.navigateTo({
    url: LOGIN_PAGE_URL,
    success: clearNavigating,
    fail: (err) => {
      console.warn('[auth] navigateTo login failed, fallback redirectTo', err)
      tryRedirect()
    },
  })
}

export const notifyLoginSuccess = () => {
  loginNavigating = false
  if (loginWaiter) {
    loginWaiter.resolve(true)
    loginWaiter = null
  }
  Taro.eventCenter.trigger(AUTH_LOGGED_IN_EVENT)
}

export const notifyLoginCancel = () => {
  loginNavigating = false
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
      // 已有登录流程进行中：只挂接回调，避免重复 navigateTo 导致 timeout
      const prev = loginWaiter.resolve
      loginWaiter = {
        resolve: (ok) => {
          prev(ok)
          resolve(ok)
        },
      }
      return
    }
    loginWaiter = { resolve }
    openLoginSheet()
  })
}
