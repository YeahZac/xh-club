import Taro from '@tarojs/taro'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile
 *
 * 微信小程序：优先走 wx.cloud.callContainer / 云存储上传（免配服务器域名）
 * H5 / 其他端：使用 PROJECT_DOMAIN 拼接后走常规 HTTP
 *
 * 业务侧请继续使用 Network.*；页面无需再为云托管单独改请求方式。
 */

let cloudInitPromise: Promise<void> | null = null

const isWeapp = () => Taro.getEnv() === Taro.ENV_TYPE.WEAPP

const canUseCallContainer = () =>
  isWeapp() && !!String(WX_CLOUD_ENV || '').trim() && !!String(WX_CLOUD_SERVICE || '').trim()

const createAuthHeader = () => {
  const token = Taro.getStorageSync('member_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const createUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `${PROJECT_DOMAIN || ''}${url}`
}

/** 将绝对/相对 URL 转为 callContainer 的 path（含 query） */
const toContainerPath = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      return `${parsed.pathname}${parsed.search}`
    } catch {
      return url
    }
  }
  return url.startsWith('/') ? url : `/${url}`
}

/** 是否应走云托管私有通道（相对路径或本项目公网域名） */
const shouldCallContainer = (url: string): boolean => {
  if (!canUseCallContainer()) return false
  if (!url.startsWith('http://') && !url.startsWith('https://')) return true
  const domain = String(PROJECT_DOMAIN || '').replace(/\/+$/, '')
  return !!domain && url.startsWith(domain)
}

const pickRawNetworkText = (error: unknown): string => {
  if (typeof error === 'string') return error
  const e = error as any
  return String(
    e?.message
    || e?.errMsg
    || e?.error_description
    || e?.error
    || e?.cause?.message
    || e?.cause?.errMsg
    || '',
  )
}

const dumpNetworkError = (error: unknown) => {
  const e = error as any
  return {
    message: e?.message,
    errMsg: e?.errMsg,
    errCode: e?.errCode,
    statusCode: e?.statusCode,
    data: e?.data,
    causeMessage: e?.cause?.message,
    causeErrMsg: e?.cause?.errMsg,
    causeErrCode: e?.cause?.errCode,
    string: String(error),
  }
}

/** 把底层报错转成用户能看懂的中文 */
export const getFriendlyNetworkMessage = (error: unknown, fallback = '网络异常，请稍后重试'): string => {
  const e = error as any
  if (typeof e?.statusCode === 'number' && e.statusCode >= 400) {
    const serverMsg = String(e?.message || e?.msg || '').trim()
    if (serverMsg && /[\u4e00-\u9fff]/.test(serverMsg)) return serverMsg.slice(0, 40)
    if (e.statusCode === 401) return '登录已失效，请重新登录'
    if (e.statusCode === 404) return '接口不存在或服务未正确部署'
    if (e.statusCode === 502 || e.statusCode === 503) return '云托管服务未就绪（可能正在启动），请稍后重试'
    return fallback || `服务返回 ${e.statusCode}`
  }

  const text = pickRawNetworkText(error)
  if (!text) return fallback

  // 已经是中文提示则直接用（但排除我们自己二次包装前的英文混排）
  if (/[\u4e00-\u9fff]/.test(text) && text.length <= 40 && !/Error:|TypeError|at\s|cloud\./i.test(text)) {
    return text
  }

  const lower = text.toLowerCase()

  if (
    lower.includes("cloud api isn't enabled")
    || lower.includes('cloud.init')
    || lower.includes('cloud is not enabled')
  ) {
    return '云服务未就绪，请升级微信后重试'
  }
  if (lower.includes('invalid host') || lower.includes('-501000')) {
    return '云托管服务名或环境不正确，请核对 xh-server 是否已部署'
  }
  if (
    lower.includes('service not found')
    || lower.includes('servicenotfound')
    || lower.includes('-501002')
    || lower.includes('no version')
  ) {
    return '云托管服务未部署或未发布版本，请先在控制台发布'
  }
  if (lower.includes('permission') || lower.includes('not authorized') || lower.includes('-604100')) {
    return '小程序未授权该云托管环境，请在云托管控制台关联本 AppID'
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return '请求超时（服务可能冷启动中），请稍后重试'
  }
  if (
    lower.includes('fail connect')
    || lower.includes('connection refused')
    || lower.includes('network')
    || lower.includes('net::')
    || lower.includes('request:fail')
  ) {
    return '网络连接失败，请检查网络后重试'
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid token')) {
    return '登录已失效，请重新登录'
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return '暂无权限执行此操作'
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return '服务暂时不可用，请稍后重试'
  }
  if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('bad gateway')) {
    return '服务器繁忙，请稍后再试'
  }
  if (lower.includes('fileid') || lower.includes('uploadfile')) {
    return '文件上传失败，请换一张图片重试'
  }
  if (lower.includes('domain') || lower.includes('url not in domain') || lower.includes('not in domain list')) {
    return '网络配置异常，请重新编译小程序或联系管理员'
  }
  // callContainer 的 errMsg 常为 cloud.callContainer:ok/fail，优先用传入的 fallback
  if (lower.includes('callcontainer') || lower.includes('x-wx-service')) {
    if (fallback && !fallback.includes('加载失败') && !fallback.includes('网络异常')) {
      return fallback
    }
    return '云托管调用失败，请确认服务已启动后重试'
  }

  return fallback
}

const notifyUserError = (error: unknown, fallback: string) => {
  const title = getFriendlyNetworkMessage(error, fallback)
  Taro.showToast({ title, icon: 'none', duration: 2500 })
  return title
}

const toFriendlyError = (error: unknown, fallback: string) => {
  const message = notifyUserError(error, fallback)
  const err = new Error(message)
  ;(err as any).cause = error
  ;(err as any).statusCode = (error as any)?.statusCode
  return err
}

export const ensureCloudReady = async (): Promise<void> => {
  if (!canUseCallContainer()) return
  if (!cloudInitPromise) {
    cloudInitPromise = (async () => {
      try {
        // 云托管要求基础库 ≥ 2.23.0；init 全局执行一次即可
        await Taro.cloud.init({
          env: String(WX_CLOUD_ENV),
          traceUser: true,
        })
        console.log('[Network] wx.cloud.init ok', WX_CLOUD_ENV)
      } catch (error) {
        cloudInitPromise = null
        console.error('[Network] wx.cloud.init failed', dumpNetworkError(error), error)
        throw toFriendlyError(error, '云服务启动失败，请重启小程序后再试')
      }
    })()
  }
  await cloudInitPromise
}

const callContainerRequest = async <T = any>(
  option: Taro.request.Option,
): Promise<Taro.request.SuccessCallbackResult<T>> => {
  const path = toContainerPath(option.url)
  const method = String(option.method || 'GET').toUpperCase()
  const env = String(WX_CLOUD_ENV || '')
  const service = String(WX_CLOUD_SERVICE || '')

  try {
    await ensureCloudReady()
    const header = {
      'content-type': 'application/json',
      'X-WX-SERVICE': service,
      ...createAuthHeader(),
      ...(option.header || {}),
    }

    console.log('[Network] callContainer →', { env, service, path, method })

    const result = await Taro.cloud.callContainer({
      config: { env },
      path,
      method: method as any,
      data: option.data as any,
      header,
      // 云托管冷启动较慢
      timeout: option.timeout || 60000,
      dataType: (option.dataType as any) || 'json',
      responseType: option.responseType as any,
    })

    const statusCode = Number((result as any).statusCode || 200)
    const dataPreview =
      typeof result.data === 'string'
        ? String(result.data).slice(0, 200)
        : result.data

    console.log('[Network] callContainer ←', {
      path,
      statusCode,
      errMsg: (result as any).errMsg,
      dataPreview,
    })

    if (statusCode >= 400) {
      const payload = result.data as any
      const serverMsg = String(
        (typeof payload === 'string' && payload)
        || payload?.msg
        || payload?.message
        || (Array.isArray(payload?.message) ? payload.message[0] : '')
        || '',
      ).trim()

      console.error('[Network] callContainer HTTP error', {
        env,
        service,
        path,
        method,
        statusCode,
        serverMsg,
        dataPreview,
        errMsg: (result as any).errMsg,
      })

      throw toFriendlyError(
        {
          message: serverMsg || `HTTP ${statusCode}`,
          statusCode,
          data: payload,
        },
        statusCode === 401
          ? (serverMsg || '登录已失效，请重新登录')
          : statusCode === 404
            ? (serverMsg || '接口不存在或服务未正确部署')
            : statusCode === 502 || statusCode === 503
              ? (serverMsg || '云托管服务未就绪（可能正在启动），请稍后重试')
              : (serverMsg || `服务返回 ${statusCode}，请稍后重试`),
      )
    }

    return {
      data: result.data as T,
      statusCode,
      header: (result as any).header || {},
      cookies: (result as any).cookies || [],
      errMsg: (result as any).errMsg || 'cloud.callContainer:ok',
    }
  } catch (error) {
    // 已包装过的友好错误：继续抛出，但把 cause 打全
    console.error('[Network] callContainer fail', {
      env,
      service,
      path,
      method,
      dump: dumpNetworkError(error),
    })
    if ((error as any)?.message && /[\u4e00-\u9fff]/.test((error as any).message)) {
      throw error
    }
    throw toFriendlyError(error, '加载失败，请稍后重试')
  }
}

const guessExt = (filePath: string, name?: string) => {
  const fromName = (name || '').match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]
  if (fromName) return fromName.toLowerCase()
  const fromPath = filePath.match(/\.([a-zA-Z0-9]{1,10})(?:\?|$)/)?.[1]
  return (fromPath || 'jpg').toLowerCase()
}

const mapUploadApiToFromCloud = (url: string) => {
  const path = toContainerPath(url).split('?')[0]
  if (path.includes('/upload/member/')) {
    return '/api/upload/member/from-cloud'
  }
  if (path.includes('/upload/')) {
    return '/api/upload/from-cloud'
  }
  return '/api/upload/member/from-cloud'
}

const uploadViaCloudStorage = async (
  option: Taro.uploadFile.Option,
): Promise<Taro.uploadFile.SuccessCallbackResult> => {
  try {
    await ensureCloudReady()
    const ext = guessExt(option.filePath, option.name)
    const cloudPath = `member/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const uploadRes = await Taro.cloud.uploadFile({
      cloudPath,
      filePath: option.filePath,
      config: { env: String(WX_CLOUD_ENV) },
    })

    const fileID = (uploadRes as any)?.fileID
    if (!fileID) {
      throw toFriendlyError('missing fileID', '文件上传失败，请换一张图片重试')
    }

    const fromCloudPath = mapUploadApiToFromCloud(option.url)
    const registerRes = await callContainerRequest({
      url: fromCloudPath,
      method: 'POST',
      data: {
        fileID,
        filename: cloudPath.split('/').pop(),
        ...(typeof option.formData === 'object' ? option.formData : {}),
      },
      header: option.header,
    })

    const payload =
      typeof registerRes.data === 'string'
        ? registerRes.data
        : JSON.stringify(registerRes.data ?? {})

    // 业务层失败（如未登录）
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
      if (parsed && typeof parsed.code === 'number' && parsed.code !== 200) {
        throw toFriendlyError(parsed.msg || '上传失败', parsed.msg || '文件上传失败，请稍后重试')
      }
    } catch (parseErr) {
      if ((parseErr as any)?.message && /[\u4e00-\u9fff]/.test((parseErr as any).message)) {
        throw parseErr
      }
    }

    return {
      data: payload,
      statusCode: registerRes.statusCode,
      errMsg: 'cloud.uploadFile:ok',
    }
  } catch (error) {
    if ((error as any)?.message && /[\u4e00-\u9fff]/.test((error as any).message)) {
      throw error
    }
    throw toFriendlyError(error, '文件上传失败，请稍后重试')
  }
}

const httpRequest = (option: Taro.request.Option) =>
  Taro.request({
    ...option,
    url: createUrl(option.url),
    header: { ...createAuthHeader(), ...option.header },
  }).catch((error) => {
    throw toFriendlyError(error, '加载失败，请稍后重试')
  })

const httpUpload = (option: Taro.uploadFile.Option) =>
  Taro.uploadFile({
    ...option,
    url: createUrl(option.url),
    header: { ...createAuthHeader(), ...option.header },
  }).catch((error) => {
    throw toFriendlyError(error, '文件上传失败，请稍后重试')
  })

export namespace Network {
  export const request: typeof Taro.request = ((option: Taro.request.Option) => {
    // 微信小程序：业务 API 必须走 callContainer，禁止再拼域名用 wx.request（会触发合法域名校验）
    if (isWeapp()) {
      if (!canUseCallContainer()) {
        return Promise.reject(
          toFriendlyError(
            'missing cloud env',
            '云服务未配置，请检查小程序云托管环境后重新编译',
          ),
        ) as any
      }
      return callContainerRequest(option) as any
    }
    return httpRequest(option) as any
  }) as typeof Taro.request

  export const uploadFile: typeof Taro.uploadFile = ((option: Taro.uploadFile.Option) => {
    if (isWeapp()) {
      if (!canUseCallContainer()) {
        return Promise.reject(
          toFriendlyError(
            'missing cloud env',
            '云服务未配置，请检查小程序云托管环境后重新编译',
          ),
        ) as any
      }
      return uploadViaCloudStorage(option) as any
    }
    return httpUpload(option) as any
  }) as typeof Taro.uploadFile

  export const downloadFile: typeof Taro.downloadFile = ((option: Taro.downloadFile.Option) => {
    return Taro.downloadFile({
      ...option,
      url: createUrl(option.url),
      header: { ...createAuthHeader(), ...(option as any).header },
    }).catch((error) => {
      throw toFriendlyError(error, '文件下载失败，请稍后重试')
    }) as any
  }) as typeof Taro.downloadFile
}
