import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [adminUrl, setAdminUrl] = useState('')

  useEffect(() => {
    // H5 环境优先打开后端托管的 /admin，避免本地 admin-page.html 请求到错误的 /api 源。
    const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB
    if (isH5) {
      const normalizedProjectDomain =
        typeof PROJECT_DOMAIN === 'string' && PROJECT_DOMAIN.trim()
          ? PROJECT_DOMAIN.replace(/\/$/, '')
          : ''

      if (normalizedProjectDomain) {
        setAdminUrl(`${normalizedProjectDomain}/admin`)
        return
      }

      // 本地未配置 PROJECT_DOMAIN 时，回退到本地后端 /admin（若已启动 dev:server）。
      setAdminUrl(`${window.location.origin}/admin`)
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
