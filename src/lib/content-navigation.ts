import Taro from '@tarojs/taro'
import { assertSafeExternalUrl } from '@/lib/safe-url'

let navigating = false
let lastNavigateAt = 0

const guardedNavigateTo = (url: string, label: string) => {
  const now = Date.now()
  if (navigating || now - lastNavigateAt < 400) {
    return
  }
  navigating = true
  lastNavigateAt = now
  Taro.navigateTo({
    url,
    fail: (err) => {
      console.error(`[导航] ${label} 失败:`, url, err)
      const msg = String(err?.errMsg || '')
      Taro.showToast({
        title: msg.includes('timeout') ? '页面加载较慢，请稍后再试' : '页面跳转失败',
        icon: 'none',
      })
    },
    complete: () => {
      navigating = false
    },
  })
}

export type ContentDetailType = 'article' | 'project' | 'event' | 'business' | 'talent' | 'product'

export const pickId = (...candidates: Array<string | number | undefined | null>) => {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  return ''
}

export const normalizeDetailType = (type?: string): ContentDetailType | '' => {
  if (!type) return ''
  if (type === 'product') return 'product'
  if (type === 'financing' || type === 'roadshow' || type === 'resource' || type === 'life') return 'business'
  if (['article', 'project', 'event', 'business', 'talent'].includes(type)) {
    return type as ContentDetailType
  }
  return ''
}

export const openContentDetail = (type: string | undefined, id: string | number | undefined) => {
  const targetId = pickId(id)
  if (!targetId) {
    Taro.showToast({ title: '跳转目标未配置', icon: 'none' })
    return
  }

  const detailType = normalizeDetailType(type)
  if (!detailType) {
    Taro.showToast({ title: '暂不支持该内容类型', icon: 'none' })
    return
  }

  if (detailType === 'product') {
    guardedNavigateTo(`/pages/mall/product-detail/index?id=${targetId}`, '商品详情')
    return
  }

  guardedNavigateTo(
    `/pages/content-detail/index?type=${detailType}&id=${targetId}`,
    '内容详情',
  )
}

export const openExternalUrl = (url: string) => {
  const target = assertSafeExternalUrl(url)
  if (!target) {
    Taro.showToast({ title: '链接无效或不安全', icon: 'none' })
    return
  }

  if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
    Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(target)}` })
    return
  }

  if (typeof window !== 'undefined') {
    window.open(target, '_blank')
    return
  }

  Taro.setClipboardData({
    data: target,
    success: () => Taro.showToast({ title: '链接已复制', icon: 'none' }),
  })
}

export const openMiniProgram = (appId: string, path: string) => {
  const appid = appId.trim()
  const miniPath = path.trim()
  if (!appid || !miniPath) {
    Taro.showToast({ title: '小程序跳转未配置', icon: 'none' })
    return
  }

  Taro.navigateToMiniProgram({
    appId: appid,
    path: miniPath,
    fail: () => Taro.showToast({ title: '跳转失败，请检查配置', icon: 'none' }),
  })
}
