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
/** 静默恢复会话互斥，避免 App/页面同时打 restore */
let restoreInFlight: Promise<boolean> | null = null

const EXPLICIT_LOGOUT_KEY = 'member_explicit_logout'
const TOKEN_REFRESHED_AT_KEY = 'member_token_refreshed_at'
const TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

export const isWeappEnv = () => Taro.getEnv() === Taro.ENV_TYPE.WEAPP

export const getMemberSession = (): MemberSession | null => {
  const memberId = String(Taro.getStorageSync('member_id') || '')
  const token = String(Taro.getStorageSync('member_token') || '')
  if (!memberId || !token) return null
  const openid = String(Taro.getStorageSync('openid') || '')
  return { memberId, token, openid: openid || undefined }
}

export const isLoggedIn = () => !!getMemberSession()

const clearExplicitLogout = () => {
  Taro.removeStorageSync(EXPLICIT_LOGOUT_KEY)
}

const markExplicitLogout = () => {
  Taro.setStorageSync(EXPLICIT_LOGOUT_KEY, '1')
}

const hasExplicitLogout = () => String(Taro.getStorageSync(EXPLICIT_LOGOUT_KEY) || '') === '1'

export const saveMemberSession = (data: {
  member_id: string | number
  token: string
  openid?: string
}) => {
  Taro.setStorageSync('member_id', String(data.member_id))
  Taro.setStorageSync('member_token', data.token)
  if (data.openid) Taro.setStorageSync('openid', data.openid)
  clearExplicitLogout()
}

export const clearMemberSession = () => {
  Taro.removeStorageSync('member_id')
  Taro.removeStorageSync('member_token')
  Taro.removeStorageSync('openid')
  Taro.removeStorageSync(TOKEN_REFRESHED_AT_KEY)
}

export const logoutMember = () => {
  clearMemberSession()
  markExplicitLogout()
  Taro.eventCenter.trigger(AUTH_LOGGED_OUT_EVENT)
}

const isAuthFailure = (error: any, code?: number) => {
  const status = Number(error?.statusCode || error?.status || code || 0)
  const msg = String(error?.message || error?.errMsg || error?.msg || '')
  return (
    status === 401
    || msg.includes('登录已失效')
    || msg.includes('登录凭证无效')
    || msg.includes('缺少登录凭证')
  )
}

const isMemberGone = (error: any, code?: number) => {
  const status = Number(error?.statusCode || error?.status || code || 0)
  const msg = String(error?.message || error?.errMsg || error?.msg || '')
  return status === 404 || msg.includes('会员不存在') || msg.includes('账号未注册')
}

/**
 * 凭微信 openid 静默换发 Token（JWT 过期 / 密钥变更后仍可恢复）。
 * 用户主动退出后不会自动登回。
 */
export const trySilentRestoreSession = async (): Promise<boolean> => {
  if (!isWeappEnv()) return false
  if (hasExplicitLogout()) return false
  if (restoreInFlight) return restoreInFlight

  restoreInFlight = (async () => {
    try {
      const { Network } = await import('@/network')
      const loginRes = await Taro.login().catch(() => null as any)
      const res = await Network.request({
        url: '/api/auth/restore-session',
        method: 'POST',
        data: { code: loginRes?.code || '' },
      })
      const body = res?.data
      const data = body?.data
      const token = String(data?.token || '').trim()
      if (Number(body?.code) === 200 && token && data?.member_id) {
        saveMemberSession({
          member_id: data.member_id,
          token,
          openid: data.openid || undefined,
        })
        Taro.setStorageSync(TOKEN_REFRESHED_AT_KEY, Date.now())
        return true
      }
      // 未注册 / 账号已删：清本地并标记退出，避免每次打开都打 restore
      if (Number(body?.code) === 404) {
        if (getMemberSession()) {
          logoutMember()
        } else {
          markExplicitLogout()
        }
      }
      return false
    } catch (error: any) {
      console.warn('[auth] silent restore failed', error)
      return false
    } finally {
      restoreInFlight = null
    }
  })()

  return restoreInFlight
}

/**
 * 凭证失效时先静默恢复；仅恢复失败才退出。
 * 返回 true 表示最终仍保持登录。
 */
export const recoverMemberSession = async (): Promise<boolean> => {
  if (await trySilentRestoreSession()) return true
  if (getMemberSession()) {
    // 本地有旧凭证但无法恢复：清掉，避免反复 401
    clearMemberSession()
    Taro.eventCenter.trigger(AUTH_LOGGED_OUT_EVENT)
  }
  return false
}

/**
 * 校验本地登录是否仍有效（账号被后台删除 / Token 真正失效时清理）。
 * 网络抖动或业务错误不得强制退出。
 */
export const validateMemberSession = async (): Promise<boolean> => {
  let session = getMemberSession()
  if (!session) {
    // 本地无凭证但未主动退出：尝试静默恢复（兼容存储被系统清理）
    return trySilentRestoreSession()
  }

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

    if (code === 401) {
      return recoverMemberSession()
    }
    if (code === 404) {
      logoutMember()
      return false
    }
    return true
  } catch (error: any) {
    if (isAuthFailure(error)) {
      return recoverMemberSession()
    }
    if (isMemberGone(error)) {
      logoutMember()
      return false
    }
    // 网络抖动 / 服务端短暂异常：保留本地登录态
    return true
  }
}

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

/** 用当前有效凭证换发新 Token；失败则尝试 openid 静默恢复 */
export const refreshMemberToken = async (): Promise<boolean> => {
  const session = getMemberSession()
  if (!session) return trySilentRestoreSession()
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
    if (Number(res?.data?.code) === 401) {
      return recoverMemberSession()
    }
    return false
  } catch (error: any) {
    if (isAuthFailure(error)) {
      return recoverMemberSession()
    }
    return false
  }
}

/**
 * App 每次显示时维护登录态：已登录则续期；未登录且非主动退出则静默恢复。
 */
export const ensurePersistedSession = () => {
  if (!isWeappEnv()) return
  if (isLoggedIn()) {
    maybeRefreshMemberToken()
    return
  }
  if (!hasExplicitLogout()) {
    void trySilentRestoreSession()
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
  clearExplicitLogout()
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
  if (!force && !isLoggedIn() && !hasExplicitLogout()) {
    const restored = await trySilentRestoreSession()
    if (restored) return true
  }
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
