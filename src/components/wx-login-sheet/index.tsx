import { useEffect, useState } from 'react'
import { View, Text, Image, Input, Button as TaroButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Camera } from 'lucide-react-taro'
import { Network } from '@/network'
import {
  AUTH_OPEN_LOGIN_EVENT,
  isWeappEnv,
  notifyLoginCancel,
  notifyLoginSuccess,
  saveMemberSession,
} from '@/lib/auth'

/**
 * 微信授权登录底栏（chooseAvatar + nickname）
 * 微信已不再支持静默拉取头像昵称，必须用户在授权组件中确认。
 */
export const WxLoginSheet = () => {
  const [visible, setVisible] = useState(false)
  const [wxAvatar, setWxAvatar] = useState('')
  const [wxNickname, setWxNickname] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isWeappEnv()) return
    const open = () => setVisible(true)
    Taro.eventCenter.on(AUTH_OPEN_LOGIN_EVENT, open)
    return () => {
      Taro.eventCenter.off(AUTH_OPEN_LOGIN_EVENT, open)
    }
  }, [])

  const close = (success: boolean) => {
    setVisible(false)
    setWxAvatar('')
    setWxNickname('')
    if (success) notifyLoginSuccess()
    else notifyLoginCancel()
  }

  const handleChooseAvatar = (e: any) => {
    const avatarUrl = e?.detail?.avatarUrl || ''
    console.log('[微信登录] chooseAvatar:', avatarUrl)
    if (avatarUrl) setWxAvatar(avatarUrl)
  }

  const persistAvatarIfNeeded = async (tempPath: string) => {
    if (!tempPath) return ''
    // 已是线上地址则直接使用
    if (/^https?:\/\//i.test(tempPath) || tempPath.startsWith('cloud://')) {
      return tempPath
    }
    try {
      const uploadRes = await Network.uploadFile({
        url: '/api/upload/member/image',
        filePath: tempPath,
        name: 'file',
      })
      const parsed = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      if (parsed?.code === 200 && parsed?.data?.url) {
        return parsed.data.canonicalUrl || parsed.data.url
      }
    } catch (error) {
      console.error('[微信登录] 头像上传失败:', error)
    }
    return ''
  }

  const handleLogin = async () => {
    if (!wxAvatar) {
      Taro.showToast({ title: '请点击选择微信头像', icon: 'none' })
      return
    }
    if (!wxNickname.trim()) {
      Taro.showToast({ title: '请使用微信昵称', icon: 'none' })
      return
    }

    try {
      setLoading(true)
      const loginRes = await Taro.login()
      if (!loginRes?.code) {
        Taro.showToast({ title: '获取微信登录凭证失败', icon: 'none' })
        return
      }

      // 先用昵称换 token（头像本地临时路径后端无法访问）
      const res = await Network.request({
        url: '/api/auth/wx-login',
        method: 'POST',
        data: {
          code: loginRes.code,
          nickname: wxNickname.trim(),
          avatar: '',
        },
      })
      console.log('[微信登录] wx-login:', res?.data)

      if (res?.data?.code !== 200 || !res?.data?.data) {
        Taro.showToast({ title: res?.data?.msg || '登录失败', icon: 'none' })
        return
      }

      const { member_id, openid, token } = res.data.data
      saveMemberSession({ member_id, openid, token })

      // 登录成功后再上传微信头像到 COS，并在尚未有头像时回写
      const avatarUrl = await persistAvatarIfNeeded(wxAvatar)
      if (avatarUrl) {
        try {
          await Network.request({
            url: `/api/members/profile/${member_id}`,
            method: 'PUT',
            data: { avatar: avatarUrl },
          })
        } catch (error) {
          // 已有头像会被后端拒绝，属预期
          console.warn('[微信登录] 回写头像跳过/失败:', error)
        }
      }

      Taro.showToast({ title: '登录成功', icon: 'success' })
      close(true)
    } catch (error) {
      console.error('[微信登录] 失败:', error)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (!visible || !isWeappEnv()) return null

  return (
    <View
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={() => !loading && close(false)}
    >
      <View
        className="bg-white rounded-t-3xl w-full px-5 pt-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex flex-row items-center justify-between mb-2">
          <Text className="block text-lg font-bold text-[#1B2A4A]">微信授权登录</Text>
          <View
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            onClick={() => !loading && close(false)}
          >
            <Text className="block text-gray-500">✕</Text>
          </View>
        </View>
        <Text className="block text-xs text-gray-500 leading-relaxed mb-5">
          按微信规范，需你确认头像与昵称。登录后头像、昵称将同步到会员中心，且不可自行修改。
        </Text>

        <View className="flex flex-col items-center mb-5">
          <TaroButton
            className="p-0 m-0 bg-transparent border-0 leading-none after:border-0"
            openType="chooseAvatar"
            onChooseAvatar={handleChooseAvatar}
          >
            <View className="w-20 h-20 rounded-full bg-[#F7F5F1] overflow-hidden flex items-center justify-center border border-dashed border-[#C9A96E]">
              {wxAvatar ? (
                <Image src={wxAvatar} className="w-full h-full" mode="aspectFill" />
              ) : (
                <Camera size={26} color="#C9A96E" />
              )}
            </View>
          </TaroButton>
          <Text className="block text-xs text-gray-400 mt-2">点击使用微信头像</Text>
        </View>

        <View className="bg-[#F7F5F1] rounded-2xl px-4 py-3 mb-6">
          <Input
            type="nickname"
            className="w-full text-sm text-[#1A1D2E]"
            placeholder="点击填写微信昵称"
            value={wxNickname}
            onInput={(e) => setWxNickname(e.detail.value || '')}
            onBlur={(e) => setWxNickname(e.detail.value || '')}
          />
        </View>

        <View
          className={`w-full rounded-2xl py-3.5 flex items-center justify-center ${
            loading ? 'bg-[#1B2A4A]/70' : 'bg-[#1B2A4A]'
          }`}
          onClick={() => !loading && handleLogin()}
        >
          <Text className="block text-white text-base font-semibold">
            {loading ? '登录中...' : '授权并登录'}
          </Text>
        </View>
      </View>
    </View>
  )
}
