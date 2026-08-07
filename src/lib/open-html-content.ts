import Taro from '@tarojs/taro'
import { isFullHtmlDocument, type HtmlRenderType } from '@/lib/rich-html'
import { buildWebViewHtmlPageUrl, normalizeWebViewPageUrl } from '@/lib/webview-url'
import { Network } from '@/network'

export const WEBVIEW_URL_STORAGE_KEY = 'XH_WEBVIEW_URL'

/** 解析可供 web-view 打开的 HTTPS 地址（云托管自定义域名 + html-render） */
export const resolveHtmlPageUrl = async (
  type: HtmlRenderType,
  params: { key?: string; id?: string | number },
): Promise<string | null> => {
  const local = buildWebViewHtmlPageUrl(type, params)
  if (local) return local

  const search = new URLSearchParams({ type })
  if (params.key) search.set('key', String(params.key))
  if (params.id != null && params.id !== '') search.set('id', String(params.id))

  try {
    const res = await Network.request({
      url: `/api/system/html-page-url?${search.toString()}`,
    })
    const remoteUrl = normalizeWebViewPageUrl(
      String(res?.data?.data?.url || res?.data?.url || ''),
    )
    if (remoteUrl) return remoteUrl
  } catch (error) {
    console.error('[resolveHtmlPageUrl]', error)
  }

  return buildWebViewHtmlPageUrl(type, params)
}

/** 完整 HTML 页面：跳转独立 web-view 页（使用 html-render，非 COS） */
export const openFullHtmlIfNeeded = (
  html: string | null | undefined,
  type: HtmlRenderType,
  params: { key?: string; id?: string | number },
): boolean => {
  if (!isFullHtmlDocument(html)) return false

  void (async () => {
    Taro.showLoading({ title: '打开中...', mask: true })
    try {
      const target = await resolveHtmlPageUrl(type, params)
      if (!target) {
        Taro.showToast({
          title: '完整页面暂不可用，请联系管理员配置业务域名',
          icon: 'none',
        })
        return
      }
      Taro.setStorageSync(WEBVIEW_URL_STORAGE_KEY, target)
      await Taro.navigateTo({ url: '/pages/webview/index' })
    } catch (error) {
      console.error('[openFullHtmlIfNeeded]', error)
      Taro.showToast({ title: '打开完整页失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  })()

  return true
}
