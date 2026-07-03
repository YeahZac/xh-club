import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [adminUrl, setAdminUrl] = useState('')

  useEffect(() => {
    // 获取当前环境的基础URL
    const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
    if (isH5) {
      // H5环境直接使用相对路径
      const baseUrl = window.location.origin
      setAdminUrl(`${baseUrl}/admin-page.html`)
    }
  }, [])

  if (!adminUrl) {
    return (
      <View className="flex items-center justify-center h-screen">
        <View className="text-gray-500">管理后台仅支持在浏览器中访问</View>
      </View>
    )
  }

  return (
    <View className="w-full h-screen">
      <iframe
        src={adminUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="管理后台"
      />
    </View>
  )
}
