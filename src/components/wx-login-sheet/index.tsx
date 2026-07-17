import { useEffect, useState } from 'react'
import { View, Text, Image, Input, Button as TaroButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Camera, Phone } from 'lucide-react-taro'
import { Network } from '@/network'
import {
  isWeappEnv,
  notifyLoginCancel,
  notifyLoginSuccess,
  saveMemberSession,
} from '@/lib/auth'

/**
 * 微信授权登录页内容：
 * - 头像：chooseAvatar，选定后不可再改
 * - 昵称：type=nickname，选定后不可再改
 * - 手机号：getPhoneNumber
 */
export const WxLoginSheet = () => {
  const [wxAvatar, setWxAvatar] = useState('')
  const [wxNickname, setWxNickname] = useState('')
  const [nicknameLocked, setNicknameLocked] = useState(false)
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneCloudId, setPhoneCloudId] = useState('')
  const [phoneReady, setPhoneReady] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    console.log('[登录页] WxLoginSheet mount', { env: Taro.getEnv() })
    // 诊断：先打一下健康检查，方便区分「服务未起」还是「登录接口本身报错」
    void Network.request({ url: '/api/health', method: 'GET' })
      .then((res) => {
        console.log('[登录页] health ok', res?.statusCode, res?.data)
      })
      .catch((err) => {
        console.error('[登录页] health fail', {
          message: err?.message,
          dump: err?.cause || err,
        })
      })
  }, [])

  const finish = (success: boolean) => {
    console.log('[登录页] finish', { success })
    if (success) {
      notifyLoginSuccess()
      Taro.navigateBack({
        fail: () => Taro.switchTab({ url: '/pages/profile/index' }),
      })
      return
    }
    notifyLoginCancel()
    Taro.navigateBack({ fail: () => undefined })
  }

  const handleChooseAvatar = (e: any) => {
    if (wxAvatar) return
    const avatarUrl = e?.detail?.avatarUrl || ''
    console.log('[登录页] chooseAvatar:', avatarUrl)
    if (avatarUrl) setWxAvatar(avatarUrl)
  }

  const lockNickname = (value: string) => {
    const name = String(value || '').trim()
    if (!name) return
    setWxNickname(name)
    setNicknameLocked(true)
  }

  const handleGetPhoneNumber = (e: any) => {
    console.log('[登录页] getPhoneNumber:', e?.detail)
    const errMsg = String(e?.detail?.errMsg || '')
    if (errMsg && !errMsg.includes('ok')) {
      Taro.showToast({ title: '需要授权手机号才能登录', icon: 'none' })
      return
    }
    const code = e?.detail?.code || ''
    const cloudID = e?.detail?.cloudID || e?.detail?.cloudId || ''
    if (!code && !cloudID) {
      Taro.showToast({ title: '未获取到手机号授权，请重试', icon: 'none' })
      return
    }
    setPhoneCode(code)
    setPhoneCloudId(cloudID)
    setPhoneReady(true)
    Taro.showToast({ title: '手机号已授权', icon: 'success' })
  }

  const persistAvatarIfNeeded = async (tempPath: string) => {
    if (!tempPath) return ''
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
      console.error('[登录页] 头像上传失败:', error)
    }
    return ''
  }

  const handleLogin = async () => {
    if (!isWeappEnv()) {
      Taro.showToast({ title: '请在微信小程序中登录', icon: 'none' })
      return
    }
    if (!wxAvatar) {
      Taro.showToast({ title: '请选择微信头像', icon: 'none' })
      return
    }
    if (!wxNickname.trim()) {
      Taro.showToast({ title: '请使用微信昵称', icon: 'none' })
      return
    }
    if (!phoneReady || (!phoneCode && !phoneCloudId)) {
      Taro.showToast({ title: '请授权微信手机号', icon: 'none' })
      return
    }

    try {
      setLoading(true)
      const loginRes = await Taro.login().catch(() => null as any)

      const res = await Network.request({
        url: '/api/auth/wx-login',
        method: 'POST',
        data: {
          code: loginRes?.code || '',
          nickname: wxNickname.trim(),
          avatar: '',
          phoneCode: phoneCode || undefined,
          phoneCloudId: phoneCloudId || undefined,
        },
      })
      console.log('[登录页] wx-login:', res?.statusCode, res?.data)

      const body = res?.data
      if (!body || body.code !== 200 || !body.data) {
        Taro.showToast({
          title: String(body?.msg || body?.message || '登录失败，请重试').slice(0, 40),
          icon: 'none',
        })
        return
      }

      const { member_id, openid, token } = body.data
      saveMemberSession({ member_id, openid, token })

      const avatarUrl = await persistAvatarIfNeeded(wxAvatar)
      if (avatarUrl) {
        try {
          await Network.request({
            url: `/api/members/profile/${member_id}`,
            method: 'PUT',
            data: { avatar: avatarUrl },
          })
        } catch (error) {
          console.warn('[登录页] 回写头像跳过:', error)
        }
      }

      Taro.showToast({ title: '登录成功', icon: 'success' })
      finish(true)
    } catch (error) {
      const cause = (error as any)?.cause
      console.error('[登录页] 失败:', error)
      console.error('[登录页] 失败详情:', {
        message: (error as any)?.message,
        causeMsg: cause?.errMsg || cause?.message || cause,
        cause,
      })
      const msg =
        (error as any)?.message && /[\u4e00-\u9fff]/.test(String((error as any).message))
          ? String((error as any).message)
          : '登录失败，请重试'
      Taro.showToast({ title: msg.slice(0, 40), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="min-h-screen bg-[#F7F5F1] px-4 py-8">
      <View className="bg-white rounded-3xl w-full px-5 pt-5" style={{ paddingBottom: 24 }}>
        <Text className="block text-lg font-bold text-[#1B2A4A] mb-2">微信授权登录</Text>
        <Text className="block text-xs text-gray-500 leading-relaxed mb-5">
          请授权微信头像、昵称与手机号。登录后头像、昵称不可修改。
        </Text>

        <View className="flex flex-col items-center mb-4">
          {wxAvatar ? (
            <View className="w-20 h-20 rounded-full overflow-hidden border border-[#C9A96E]">
              <Image src={wxAvatar} className="w-full h-full" mode="aspectFill" />
            </View>
          ) : (
            <TaroButton
              className="p-0 m-0 bg-transparent border-0 leading-none after:border-0"
              style={{ padding: 0, margin: 0, backgroundColor: 'transparent', border: 'none' }}
              openType="chooseAvatar"
              onChooseAvatar={handleChooseAvatar}
            >
              <View
                className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  backgroundColor: '#F7F5F1',
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#C9A96E',
                }}
              >
                <Camera size={26} color="#C9A96E" />
              </View>
            </TaroButton>
          )}
          <Text className="block text-xs text-gray-400 mt-2">
            {wxAvatar ? '微信头像（已锁定）' : '点击选择微信头像'}
          </Text>
        </View>

        <Text className="block text-xs text-gray-500 mb-1.5">微信昵称</Text>
        {nicknameLocked ? (
          <View className="bg-[#F7F5F1] rounded-2xl px-4 py-3 mb-4">
            <Text className="block text-sm text-[#1A1D2E]">{wxNickname}</Text>
            <Text className="block text-xs text-gray-400 mt-1">来自微信，不可修改</Text>
          </View>
        ) : (
          <View className="bg-[#F7F5F1] rounded-2xl px-4 py-3 mb-4">
            <Input
              type="nickname"
              className="w-full text-sm text-[#1A1D2E]"
              placeholder="点击使用微信昵称"
              maxlength={32}
              onInput={(e) => setWxNickname(e.detail.value || '')}
              onBlur={(e) => lockNickname(e.detail.value || '')}
              onConfirm={(e) => lockNickname(e.detail.value || '')}
            />
          </View>
        )}

        <Text className="block text-xs text-gray-500 mb-1.5">手机号</Text>
        <TaroButton
          className="after:border-0 mb-5"
          style={{
            width: '100%',
            margin: 0,
            backgroundColor: phoneReady ? '#F0F7F0' : '#F7F5F1',
            color: phoneReady ? '#1B7A3D' : '#1A1D2E',
            borderRadius: '16px',
            fontSize: '14px',
            padding: '12px 0',
            border: 'none',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          openType="getPhoneNumber"
          onGetPhoneNumber={handleGetPhoneNumber}
        >
          <View className="flex flex-row items-center justify-center gap-2">
            <Phone size={16} color={phoneReady ? '#1B7A3D' : '#C9A96E'} />
            <Text className="block text-sm">
              {phoneReady ? '手机号已授权（可重新选择）' : '授权微信手机号'}
            </Text>
          </View>
        </TaroButton>

        <View
          className="w-full rounded-2xl py-3.5 flex items-center justify-center mb-3"
          style={{ backgroundColor: loading ? 'rgba(27,42,74,0.7)' : '#1B2A4A' }}
          onClick={() => !loading && handleLogin()}
        >
          <Text className="block text-white text-base font-semibold">
            {loading ? '登录中...' : '确认登录'}
          </Text>
        </View>

        <View
          className="w-full rounded-2xl py-3 flex items-center justify-center"
          onClick={() => !loading && finish(false)}
        >
          <Text className="block text-sm text-gray-400">暂不登录</Text>
        </View>
      </View>
    </View>
  )
}
