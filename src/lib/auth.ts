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

type RestoreReason =
  | 'restored'
  | 'not_registered'
  | 'no_openid'
  | 'network'
  | 'skipped'
  | 'failed'

type RestoreResult = {
  ok: boolean
  reason: RestoreReason
}

let loginWaiter: LoginWaiter | null = null
/** 防止并发 ensureLogin 重复 navigateTo，触发微信 navigateTo:fail timeout */
let loginNavigating = false
/** 静默恢复 / 续期互斥 */
let sessionMaintainInFlight: Promise<boolean> | null = null

const EXPLICIT_LOGOUT_KEY = 'member_explicit_logout'
const TOKEN_REFRESHED_AT_KEY = 'member_token_refreshed_at'

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
  Taro.setStorageSync(TOKEN_REFRESHED_AT_KEY, Date.now())
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

/** 仅 HTTP 401 视为凭证失效；禁止靠文案误伤（网络层会把很多错误改写成「登录已失效」） */
const isHttpUnauthorized = (error: any) => Number(error?.statusCode || error?.status || 0) === 401

const isDefiniteMemberGoneMessage = (msg: string) =>
  msg.includes('会员不存在') || msg.includes('账号未注册') || msg.includes('账号已删除')

/**
 * 凭微信 openid / 当前 JWT 静默换发 Token。
 * 用户主动退出后不会自动登回。
 * 网络抖动、openid 暂不可用时：不清本地登录态。
 */
export const trySilentRestoreSession = async (): Promise<RestoreResult> => {
  if (!isWeappEnv()) return { ok: false, reason: 'skipped' }
  if (hasExplicitLogout()) return { ok: false, reason: 'skipped' }

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
    const code = Number(body?.code)
    const token = String(data?.token || '').trim()

    if (code === 200 && token && data?.member_id) {
      saveMemberSession({
        member_id: data.member_id,
        token,
        openid: data.openid || undefined,
      })
      return { ok: true, reason: 'restored' }
    }

    if (code === 404 || isDefiniteMemberGoneMessage(String(body?.msg || ''))) {
      return { ok: false, reason: 'not_registered' }
    }

    if (code === 401) {
      // 无法识别微信用户：多为瞬时问题，保留本地态
      return { ok: false, reason: 'no_openid' }
    }

    return { ok: false, reason: 'failed' }
  } catch (error: any) {
    console.warn('[auth] silent restore failed', error)
    return { ok: false, reason: 'network' }
  }
}

/**
 * 凭证失效时先静默恢复。
 * - 恢复成功：保持登录
 * - 明确未注册：清本地
 * - 网络 / openid 瞬时失败：保留本地，避免误下线
 */
export const recoverMemberSession = async (): Promise<boolean> => {
  const result = await trySilentRestoreSession()
  if (result.ok) return true

  if (result.reason === 'not_registered') {
    if (getMemberSession()) {
      clearMemberSession()
      Taro.eventCenter.trigger(AUTH_LOGGED_OUT_EVENT)
    }
    return false
  }

  // network / no_openid / failed / skipped：保留现有本地会话
  return isLoggedIn()
}

/**
 * 校验本地登录是否仍有效。
 * 仅在「凭证失效且无法恢复」或「账号确认不存在」时清理。
 */
export const validateMemberSession = async (): Promise<boolean> => {
  const session = getMemberSession()
  if (!session) {
    if (hasExplicitLogout()) return false
    const restored = await trySilentRestoreSession()
    return restored.ok
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
    // 业务信封明确说会员不存在，才退出；不要把任意 HTTP 404 当删号
    if (code === 404 || isDefiniteMemberGoneMessage(String(res?.data?.msg || ''))) {
      logoutMember()
      return false
    }
    return true
  } catch (error: any) {
    if (isHttpUnauthorized(error)) {
      return recoverMemberSession()
    }
    const msg = String(error?.message || error?.errMsg || '')
    if (isDefiniteMemberGoneMessage(msg)) {
      logoutMember()
      return false
    }
    // 网络抖动 / 服务端短暂异常：保留本地登录态
    return true
  }
}

/**
 * 续期：后端支持「有效 JWT」或「openid 静默恢复」，不再要求 Token 仍有效。
 * 每次 App 显示都可调用；失败不主动清登录。
 */
export const refreshMemberToken = async (): Promise<boolean> => {
  if (!isWeappEnv()) return false
  if (hasExplicitLogout()) return false

  try {
    const { Network } = await import('@/network')
    const loginRes = await Taro.login().catch(() => null as any)
    const session = getMemberSession()
    const res = await Network.request({
      url: '/api/auth/refresh',
      method: 'POST',
      data: { code: loginRes?.code || '' },
    })
    const body = res?.data
    const code = Number(body?.code)
    const token = String(body?.data?.token || '').trim()

    if (code === 200 && token) {
      saveMemberSession({
        member_id: body?.data?.member_id || session?.memberId || '',
        token,
        openid: body?.data?.openid || session?.openid,
      })
      return true
    }

    if (code === 404 || isDefiniteMemberGoneMessage(String(body?.msg || ''))) {
      if (getMemberSession()) {
        clearMemberSession()
        Taro.eventCenter.trigger(AUTH_LOGGED_OUT_EVENT)
      }
      return false
    }

    // 401/其它：保留本地态，交由下次再试
    return false
  } catch (error: any) {
    // refresh 已改为 HTTP 200 信封；若仍抛错多为网络问题，不清登录
    if (isHttpUnauthorized(error)) {
      return recoverMemberSession()
    }
    console.warn('[auth] refresh failed', error)
    return false
  }
}

/** 兼容旧调用：活跃时尝试续期（现与 maintain 合并，保留导出） */
export const maybeRefreshMemberToken = () => {
  void refreshMemberToken().catch(() => undefined)
}

/**
 * App 每次显示时维护登录态：
 * - 主动退出过：不自动登回
 * - 其余情况：走 refresh（JWT 或 openid），失败也不误清本地态
 */
export const ensurePersistedSession = () => {
  if (!isWeappEnv()) return
  if (hasExplicitLogout()) return
  if (sessionMaintainInFlight) return

  sessionMaintainInFlight = (async () => {
    try {
      return await refreshMemberToken()
    } finally {
      sessionMaintainInFlight = null
    }
  })()
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
  if (isLoginRoute(route)) return

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
    if (restored.ok) return true
  }
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
      return
    }
    loginWaiter = { resolve }
    openLoginSheet()
  })
}
