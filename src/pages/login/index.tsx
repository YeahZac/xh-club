import { useEffect, useRef } from 'react'
import Taro, { useUnload } from '@tarojs/taro'
import { WxLoginSheet } from '@/components/wx-login-sheet'
import { isLoggedIn, notifyLoginCancel, notifyLoginSuccess } from '@/lib/auth'

/** 独立登录页（小程序真机可用） */
const LoginPage = () => {
  const settledRef = useRef(false)

  useEffect(() => {
    console.log('[登录页] mount', { loggedIn: isLoggedIn() })
    if (isLoggedIn()) {
      settledRef.current = true
      notifyLoginSuccess()
      Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/profile/index' }) })
    }
  }, [])

  // 用户点系统返回时结束 ensureLogin 等待
  useUnload(() => {
    if (settledRef.current || isLoggedIn()) return
    console.log('[登录页] unload without login -> cancel')
    notifyLoginCancel()
  })

  return <WxLoginSheet />
}

export default LoginPage
