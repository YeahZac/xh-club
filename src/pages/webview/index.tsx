import { useState } from 'react'
import { View, Text, WebView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'

const WebviewPage = () => {
  const [url, setUrl] = useState('')

  useLoad((query) => {
    const target = decodeURIComponent(String(query?.url || '')).trim()
    if (!target) {
      Taro.showToast({ title: '链接无效', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1200)
      return
    }
    setUrl(target)
    Taro.setNavigationBarTitle({ title: '网页' })
  })

  if (!url) {
    return (
      <View className="flex items-center justify-center h-full bg-[#F5F6FA]">
        <Text className="block text-sm text-gray-400">加载中...</Text>
      </View>
    )
  }

  return <WebView src={url} />
}

export default WebviewPage
