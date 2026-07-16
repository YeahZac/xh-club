import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  User, Award, TrendingUp, ChevronRight, Settings, Shield,
  FileText, Users, Gift, ShoppingBag, Star, Wallet, ChartBar, LogOut, Crown,
  DollarSign, UserPlus, Camera
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Network } from "@/network"

interface MemberProfile {
  id: string
  name: string
  avatar: string
  phone: string
  company_name: string
  company_position: string
  industry_primary: string
  membership_level: string
  member_type: string
  credit_score: number
  active_score: number
  contribution_score: number
  total_points: number
  available_points: number
  total_transactions: number
  total_transaction_amount: number
  referrer_count: number
  match_count: number
}

interface DistributionStats {
  total_earnings: number
  pending_earnings: number
  settled_earnings: number
  subordinate_count: number
  direct_count: number
  indirect_count: number
}

interface Subordinate {
  id: string
  name: string
  avatar: string
  company_name: string
  level: number
  created_at: string
}

const industryMap: Record<string, string> = {
  tech: '科技互联网', finance: '金融资本', manufacture: '先进制造', health: '大健康',
  realestate: '房地产建筑', education: '教育培训', media: '文化传媒', law: '法律服务',
  agriculture: '现代农业', crossborder: '跨境贸易', food: '餐饮消费', energy: '环保能源',
  service: '综合服务',
}

const levelMap: Record<string, { label: string; color: string; icon: any }> = {
  normal: { label: '普通会员', color: 'bg-gray-200 text-gray-700', icon: User },
  silver: { label: '银卡会员', color: 'bg-gray-300 text-gray-800', icon: Award },
  gold: { label: '金卡会员', color: 'bg-amber-100 text-amber-700', icon: Crown },
  diamond: { label: '钻石会员', color: 'bg-sky-100 text-sky-700', icon: Star },
}

const ProfilePage = () => {
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [distStats, setDistStats] = useState<DistributionStats | null>(null)
  const [subordinates, setSubordinates] = useState<Subordinate[]>([])
  const [showSubordinates, setShowSubordinates] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [wxAvatar, setWxAvatar] = useState('')
  const [wxNickname, setWxNickname] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    loadProfile()
    loadDistributionStats()
  }, [])

  const loadProfile = async () => {
    try {
      const memberId = Taro.getStorageSync('member_id')
      if (!memberId) {
        console.log('[我的页] 未登录')
        return
      }
      const res = await Network.request({ url: `/api/members/profile/${memberId}` })
      console.log('[我的页] profile:', res?.data)
      if (res?.data?.data) setProfile(res.data.data)
    } catch (err) {
      console.error('[我的页] 加载失败:', err)
    }
  }

  const loadDistributionStats = async () => {
    try {
      const memberId = Taro.getStorageSync('member_id')
      if (!memberId) return
      const res = await Network.request({ url: `/api/mall/distribution/stats/${memberId}` })
      console.log('[我的页] distribution stats:', res?.data)
      if (res?.data?.data) {
        setDistStats(res.data.data)
      }
    } catch (err) {
      console.error('[我的页] 加载分销统计失败:', err)
    }
  }

  const loadSubordinates = async () => {
    try {
      const memberId = Taro.getStorageSync('member_id')
      if (!memberId) return
      const res = await Network.request({ url: `/api/mall/distribution/subordinates/${memberId}` })
      console.log('[我的页] subordinates:', res?.data)
      if (res?.data?.data) {
        setSubordinates(res.data.data)
        setShowSubordinates(true)
      }
    } catch (err) {
      console.error('[我的页] 加载下级人员失败:', err)
    }
  }

  /* ── WeChat Login ── */
  const handleAvatarClick = () => {
    if (!isMiniApp) {
      Taro.showToast({ title: '请在小程序中授权登录', icon: 'none' })
      return
    }
    setShowLoginModal(true)
  }

  const handleChooseAvatar = async (e: any) => {
    const avatarUrl = e?.detail?.avatarUrl || ''
    console.log('[我的页] 选择头像:', avatarUrl)
    setWxAvatar(avatarUrl)
  }

  const handleNicknameInput = (e: any) => {
    const value = e?.detail?.value || ''
    setWxNickname(value)
  }

  const handleWxLogin = async () => {
    if (!wxNickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    try {
      setLoginLoading(true)
      const loginRes = await Taro.login()
      console.log('[我的页] wx.login code:', loginRes.code)

      const res = await Network.request({
        url: '/api/auth/wx-login',
        method: 'POST',
        data: {
          code: loginRes.code,
          avatar: wxAvatar,
          nickname: wxNickname.trim(),
        }
      })
      console.log('[我的页] wx-login response:', res?.data)

      if (res?.data?.code === 200 && res?.data?.data) {
        const { member_id, openid, token } = res.data.data
        Taro.setStorageSync('member_id', member_id)
        if (openid) Taro.setStorageSync('openid', openid)
        if (token) Taro.setStorageSync('member_token', token)
        Taro.showToast({ title: '登录成功', icon: 'success' })
        setShowLoginModal(false)
        setWxAvatar('')
        setWxNickname('')
        await loadProfile()
      } else {
        Taro.showToast({ title: res?.data?.msg || '登录失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[我的页] 微信登录失败:', err)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setLoginLoading(false)
    }
  }

  const currentLevel = levelMap[profile?.membership_level || 'normal'] || levelMap.normal

  const menuSections = [
    {
      title: '业务管理',
      items: [
        { icon: FileText, label: '成交记录', badge: profile?.total_transactions ? `${profile.total_transactions}单` : '', color: '#1B2A4A' },
        { icon: TrendingUp, label: '推荐管理', badge: profile?.referrer_count ? `${profile.referrer_count}人` : '', color: '#2D4A7A', action: 'subordinates' },
        { icon: Users, label: '撮合对接', badge: profile?.match_count ? `${profile.match_count}次` : '', color: '#3B5998' },
      ]
    },
    {
      title: '资产与权益',
      items: [
        { icon: Gift, label: '积分明细', badge: profile?.available_points ? `${profile.available_points}` : '', color: '#C9A96E' },
        { icon: ShoppingBag, label: '积分商城', color: '#B8935E', action: 'mall' },
        { icon: DollarSign, label: '分销收益', badge: distStats?.total_earnings ? `¥${distStats.total_earnings.toFixed(0)}` : '', color: '#10B981' },
        { icon: Wallet, label: '收益管理', color: '#8B7355' },
        { icon: Crown, label: '会员等级', badge: currentLevel.label, color: '#1B2A4A' },
      ]
    },
    {
      title: '其他',
      items: [
        { icon: Shield, label: '隐私设置', color: '#6B7280' },
        { icon: Settings, label: '系统设置', color: '#6B7280' },
        { icon: LogOut, label: '退出登录', color: '#EF4444' },
      ]
    },
  ]

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <ScrollView scrollY style={{ height: '100vh' }}>
        {/* Header with profile */}
        <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-6 relative overflow-hidden">
          <View style={{ height: `${statusBarHeight}px` }} />
          {/* Decorative circles */}
          <View className="absolute -right-12 -top-12 w-40 h-40 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} />
          <View className="absolute right-20 bottom-2 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} />

          <View className="flex flex-row items-center gap-4 mt-2">
            <View onClick={handleAvatarClick}>
              <Avatar className="w-16 h-16 border-2 border-[#C9A96E]">
                {profile?.avatar ? (
                  <Image src={profile.avatar} className="w-full h-full rounded-full" mode="aspectFill" />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-[#C9A96E] to-[#E8D5A8] text-white text-xl">
                    {(profile?.name || '星')[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              {isMiniApp && (
                <View className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#C9A96E] rounded-full flex items-center justify-center">
                  <Camera size={10} color="#fff" />
                </View>
              )}
            </View>
            <View className="flex-1">
              <View className="flex flex-row items-center gap-2 mb-1">
                <Text className="block text-lg font-bold text-white">{profile?.name || '星河百谷会员'}</Text>
                <Badge className={`${currentLevel.color} text-[10px] px-2 py-0`}>{currentLevel.label}</Badge>
              </View>
              <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {profile?.company_position || ''}{profile?.company_name ? ` · ${profile.company_name}` : ''}
              </Text>
              {profile?.industry_primary && (
                <Badge className="bg-[#C9A96E] bg-opacity-20 text-[#C9A96E] text-[10px] px-1 py-0 mt-1">{industryMap[profile.industry_primary] || profile.industry_primary}</Badge>
              )}
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.5)" />
          </View>
        </View>

        {/* Stats Cards */}
        <View className="px-4 -mt-3">
          <Card className="shadow-sm border-0">
            <CardContent className="p-4">
              <View className="flex flex-row items-center justify-around">
                <View className="flex flex-col items-center">
                  <Text className="block text-lg font-bold text-[#1A1D2E]">{profile?.total_transactions || 0}</Text>
                  <Text className="block text-xs text-gray-500">成交单数</Text>
                </View>
                <View className="w-px h-8 bg-[#E8EAF0]" />
                <View className="flex flex-col items-center">
                  <Text className="block text-lg font-bold text-[#C9A96E]">{profile?.available_points || 0}</Text>
                  <Text className="block text-xs text-gray-500">可用积分</Text>
                </View>
                <View className="w-px h-8 bg-[#E8EAF0]" />
                <View className="flex flex-col items-center">
                  <Text className="block text-lg font-bold text-[#1A1D2E]">{profile?.referrer_count || 0}</Text>
                  <Text className="block text-xs text-gray-500">推荐人数</Text>
                </View>
                <View className="w-px h-8 bg-[#E8EAF0]" />
                <View className="flex flex-col items-center">
                  <Text className="block text-lg font-bold text-[#C9A96E]">{profile?.credit_score || 60}</Text>
                  <Text className="block text-xs text-gray-500">信用分</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* Growth Section */}
        <View className="px-4 mt-4">
          <Card className="shadow-sm border-0">
            <CardContent className="p-4">
              <View className="flex flex-row items-center justify-between mb-4">
                <Text className="block text-sm font-bold text-[#1A1D2E]">成长体系</Text>
                <View className="flex flex-row items-center gap-1">
                  <ChartBar size={14} color="#C9A96E" />
                  <Text className="block text-xs text-[#C9A96E]">查看详情</Text>
                </View>
              </View>
              <View className="flex flex-col gap-3">
                <View>
                  <View className="flex flex-row items-center justify-between mb-1">
                    <Text className="block text-xs text-gray-600">活跃值</Text>
                    <Text className="block text-xs font-semibold text-[#1A1D2E]">{profile?.active_score || 0}</Text>
                  </View>
                  <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <View className="h-full bg-gradient-to-r from-[#1B2A4A] to-[#3B5998] rounded-full" style={{ width: `${Math.min((profile?.active_score || 0) / 2000 * 100, 100)}%` }} />
                  </View>
                </View>
                <View>
                  <View className="flex flex-row items-center justify-between mb-1">
                    <Text className="block text-xs text-gray-600">贡献值</Text>
                    <Text className="block text-xs font-semibold text-[#C9A96E]">{profile?.contribution_score || 0}</Text>
                  </View>
                  <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <View className="h-full bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] rounded-full" style={{ width: `${Math.min((profile?.contribution_score || 0) / 1500 * 100, 100)}%` }} />
                  </View>
                </View>
                <View>
                  <View className="flex flex-row items-center justify-between mb-1">
                    <Text className="block text-xs text-gray-600">信用值</Text>
                    <Text className="block text-xs font-semibold text-[#1A1D2E]">{profile?.credit_score || 60}/100</Text>
                  </View>
                  <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <View className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${profile?.credit_score || 60}%` }} />
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* 分销收益卡片 */}
        {distStats && (
          <View className="px-4 mt-4">
            <Card className="shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-teal-50">
              <CardContent className="p-4">
                <View className="flex items-center justify-between mb-3">
                  <View className="flex items-center gap-2">
                    <DollarSign size={18} color="#10B981" />
                    <Text className="block text-sm font-semibold text-gray-900">分销收益</Text>
                  </View>
                  <Text className="text-xs text-emerald-600">邀请好友赚收益</Text>
                </View>
                <View className="flex items-center justify-around">
                  <View className="flex flex-col items-center">
                    <Text className="block text-lg font-bold text-emerald-600">
                      ¥{(distStats.total_earnings || 0).toFixed(2)}
                    </Text>
                    <Text className="block text-xs text-gray-500 mt-1">累计收益</Text>
                  </View>
                  <View className="w-px h-8 bg-emerald-200" />
                  <View className="flex flex-col items-center">
                    <Text className="block text-lg font-bold text-amber-600">
                      ¥{(distStats.pending_earnings || 0).toFixed(2)}
                    </Text>
                    <Text className="block text-xs text-gray-500 mt-1">待结算</Text>
                  </View>
                  <View className="w-px h-8 bg-emerald-200" />
                  <View className="flex flex-col items-center">
                    <Text className="block text-lg font-bold text-gray-900">
                      {distStats.subordinate_count || 0}
                    </Text>
                    <Text className="block text-xs text-gray-500 mt-1">下级人数</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* 下级人员弹窗 */}
        {showSubordinates && (
          <View className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50" onClick={() => setShowSubordinates(false)}>
            <View className="bg-white rounded-t-3xl w-full max-h-96 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <Text className="text-base font-semibold text-gray-900">我的下级</Text>
                <View onClick={() => setShowSubordinates(false)}>
                  <Text className="text-gray-400 text-sm">关闭</Text>
                </View>
              </View>
              <ScrollView scrollY className="max-h-80">
                {subordinates.length === 0 ? (
                  <View className="flex flex-col items-center py-12">
                    <UserPlus size={40} color="#d1d5db" />
                    <Text className="text-gray-400 text-sm mt-3">暂无下级成员</Text>
                    <Text className="text-gray-400 text-xs mt-1">分享邀请好友加入</Text>
                  </View>
                ) : (
                  <View className="p-4">
                    {subordinates.map((sub) => (
                      <View key={sub.id} className="flex items-center gap-3 py-3 border-b border-gray-50">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-sm">
                            {sub.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <View className="flex-1">
                          <Text className="block text-sm font-medium text-gray-900">{sub.name}</Text>
                          <Text className="block text-xs text-gray-500">{sub.company_name || '未设置公司'}</Text>
                        </View>
                        <Badge className={sub.level === 1 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}>
                          {sub.level === 1 ? '直推' : '间推'}
                        </Badge>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Menu Sections */}
        {menuSections.map((section, sIdx) => (
          <View className="px-4 mt-4" key={sIdx}>
            <Text className="block text-xs text-gray-400 mb-2 ml-1">{section.title}</Text>
            <Card className="shadow-sm border-0">
              <CardContent className="p-0">
                {section.items.map((item, iIdx) => {
                  const ItemIcon = item.icon
                  const handleItemClick = () => {
                    if (item.action === 'subordinates') {
                      loadSubordinates()
                    } else if (item.action === 'mall') {
                      Taro.switchTab({ url: '/pages/mall/index' })
                    }
                  }
                  return (
                    <View key={iIdx}>
                      <View className="flex flex-row items-center px-4 py-3" onClick={handleItemClick}>
                        <View className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: `${item.color}15` }}>
                          <ItemIcon size={16} color={item.color} />
                        </View>
                        <Text className="block flex-1 text-sm text-[#1A1D2E]">{item.label}</Text>
                        {item.badge && <Badge className="bg-[#C9A96E] bg-opacity-10 text-[#C9A96E] text-[10px] px-2 py-0 mr-2">{item.badge}</Badge>}
                        <ChevronRight size={16} color="#D1D5DB" />
                      </View>
                      {iIdx < section.items.length - 1 && <View className="h-px bg-[#F0F1F5] ml-15" />}
                    </View>
                  )
                })}
              </CardContent>
            </Card>
          </View>
        ))}

        <View className="h-24" />
      </ScrollView>

      {/* ── WeChat Login Modal ── */}
      {showLoginModal && isMiniApp && (
        <View className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-white rounded-t-3xl w-full p-6 pb-10">
            <View className="flex flex-row items-center justify-between mb-6">
              <Text className="block text-lg font-bold text-[#1A1D2E]">微信授权登录</Text>
              <View className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" onClick={() => setShowLoginModal(false)}>
                <Text className="block text-gray-500 text-lg">✕</Text>
              </View>
            </View>

            <Text className="block text-sm text-gray-500 mb-4">
              授权后我们将获取您的微信头像和昵称，用于完善会员资料
            </Text>

            {/* Avatar Selector */}
            <View className="flex flex-col items-center mb-4">
              {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
              <button
                {...({ openType: 'chooseAvatar' } as any)}
                onChooseAvatar={handleChooseAvatar}
                className="bg-transparent border-none p-0 m-0"
              >
                <View className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-[#C9A96E]">
                  {wxAvatar ? (
                    <Image src={wxAvatar} className="w-full h-full" mode="aspectFill" />
                  ) : (
                    <Camera size={24} color="#C9A96E" />
                  )}
                </View>
              </button>
              <Text className="block text-xs text-gray-400 mt-2">点击选择微信头像</Text>
            </View>

            {/* Nickname Input */}
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-6">
              <Input
                className="w-full bg-transparent text-base text-[#1A1D2E]"
                placeholder="请输入您的昵称"
                value={wxNickname}
                onInput={handleNicknameInput}
              />
            </View>

            {/* Submit Button */}
            <View className="w-full rounded-xl bg-gradient-to-r from-[#1B2A4A] to-[#2D4A7A] py-3 flex items-center justify-center" onClick={handleWxLogin}>
              {loginLoading ? (
                <Text className="block text-white text-base font-medium">登录中...</Text>
              ) : (
                <Text className="block text-white text-base font-medium">授权登录</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default ProfilePage
