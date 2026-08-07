import { useState } from 'react'
import { View, Text, WebView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { PageShell, ui } from '@/components/brand-ui'
import { WEBVIEW_URL_STORAGE_KEY } from '@/lib/open-html-content'
import { normalizeWebViewPageUrl } from '@/lib/webview-url'

const WebviewPage = () => {
  const [url, setUrl] = useState('')

  useLoad((query) => {
    const fromStorage = String(Taro.getStorageSync(WEBVIEW_URL_STORAGE_KEY) || '')
    const fromQuery = decodeURIComponent(String(query?.url || ''))
    const target = normalizeWebViewPageUrl(fromStorage || fromQuery)
    if (fromStorage) {
      try {
        Taro.removeStorageSync(WEBVIEW_URL_STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
    if (!target) {
      Taro.showToast({ title: '链接无效或不安全', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1200)
      return
    }
    setUrl(target)
    Taro.setNavigationBarTitle({ title: '网页' })
  })

  if (!url) {
    return (
      <PageShell scroll={false}>
        <View className="flex min-h-screen items-center justify-center bg-background">
          <Text className={ui.caption}>加载中...</Text>
        </View>
      </PageShell>
    )
  }

  return <WebView src={url} />
}

export default WebviewPage
