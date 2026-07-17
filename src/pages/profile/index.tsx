import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import {
  User, Award, TrendingUp, ChevronRight, Settings, Shield,
  FileText, Users, Gift, ShoppingBag, Star, Wallet, Crown,
  DollarSign, BadgeCheck, SquarePen, LogOut
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Network } from "@/network"
import {
  AUTH_LOGGED_IN_EVENT,
  AUTH_LOGGED_OUT_EVENT,
  ensureLogin,
  isLoggedIn,
  isWeappEnv,
  logoutMember,
  openLoginSheet,
} from "@/lib/auth"

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

const levelMap: Record<string, { label: string; color: string; icon: any }> = {
  normal: { label: '普通会员', color: 'bg-gray-200 text-gray-700', icon: User },
  silver: { label: '银卡会员', color: 'bg-gray-300 text-gray-800', icon: Award },
  gold: { label: '金卡会员', color: 'bg-amber-100 text-amber-700', icon: Crown },
  diamond: { label: '钻石会员', color: 'bg-sky-100 text-sky-700', icon: Star },
}

const ProfilePage = () => {
  const isMiniApp = isWeappEnv()
  const statusBarHeight = isMiniApp ? 22 : 8

  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [distStats, setDistStats] = useState<DistributionStats | null>(null)
  const [subordinates, setSubordinates] = useState<Subordinate[]>([])
  const [showSubordinates, setShowSubordinates] = useState(false)

  const refreshAll = async () => {
    await loadProfile()
    await loadDistributionStats()
  }

  useEffect(() => {
    void refreshAll()
    const onLogin = () => { void refreshAll() }
    const onLogout = () => {
      setProfile(null)
      setDistStats(null)
      setSubordinates([])
      setShowSubordinates(false)
    }
    Taro.eventCenter.on(AUTH_LOGGED_IN_EVENT, onLogin)
    Taro.eventCenter.on(AUTH_LOGGED_OUT_EVENT, onLogout)
    return () => {
      Taro.eventCenter.off(AUTH_LOGGED_IN_EVENT, onLogin)
      Taro.eventCenter.off(AUTH_LOGGED_OUT_EVENT, onLogout)
    }
  }, [])

  useDidShow(() => {
    void refreshAll()
  })

  const loadProfile = async () => {
    try {
      if (!isLoggedIn()) {
        setProfile(null)
        return
      }
      const memberId = Taro.getStorageSync('member_id')
      const res = await Network.request({ url: `/api/members/profile/${memberId}` })
      console.log('[我的页] profile:', res?.data)
      if (res?.data?.data) setProfile(res.data.data)
    } catch (err) {
      console.error('[我的页] 加载失败:', err)
    }
  }

  const loadDistributionStats = async () => {
    try {
      if (!isLoggedIn()) return
      const memberId = Taro.getStorageSync('member_id')
      const res = await Network.request({ url: `/api/mall/distribution/stats/${memberId}` })
      if (res?.data?.data) setDistStats(res.data.data)
    } catch (err) {
      console.error('[我的页] 加载分销统计失败:', err)
    }
  }

  const loadSubordinates = async () => {
    try {
      if (!(await ensureLogin())) return
      const memberId = Taro.getStorageSync('member_id')
      const res = await Network.request({ url: `/api/mall/distribution/subordinates/${memberId}` })
      if (res?.data?.data) {
        setSubordinates(res.data.data)
        setShowSubordinates(true)
      }
    } catch (err) {
      console.error('[我的页] 加载下级人员失败:', err)
    }
  }

  const handleAvatarClick = () => {
    if (profile) {
      Taro.showToast({ title: '头像来自微信，不可修改', icon: 'none' })
      return
    }
    if (!isMiniApp) {
      Taro.showToast({ title: '请在微信小程序中授权登录', icon: 'none' })
      return
    }
    openLoginSheet()
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定退出当前微信账号吗？',
      success: (res) => {
        if (!res.confirm) return
        logoutMember()
        Taro.showToast({ title: '已退出', icon: 'success' })
      },
    })
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
        { icon: SquarePen, label: '我的动态', color: '#F59E0B', action: 'my-posts' },
        { icon: BadgeCheck, label: '人才入驻', color: '#C9A96E', action: 'talent' },
        { icon: Shield, label: '隐私设置', color: '#6B7280' },
        { icon: Settings, label: '系统设置', color: '#6B7280' },
        { icon: LogOut, label: '退出登录', color: '#EF4444', action: 'logout' },
      ]
    },
  ]

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <ScrollView scrollY style={{ height: '100vh' }}>
        <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-6 relative overflow-hidden">
          <View style={{ height: `${statusBarHeight}px` }} />
          <View className="absolute -right-12 -top-12 w-40 h-40 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} />

          <View className="flex flex-row items-center gap-4 mt-2">
            <View className="relative" onClick={handleAvatarClick}>
              <Avatar className="w-16 h-16 border-2 border-[#C9A96E]">
                {profile?.avatar ? (
                  <Image src={profile.avatar} className="w-full h-full rounded-full" mode="aspectFill" />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-[#C9A96E] to-[#E8D5A8] text-white text-xl">
                    {(profile?.name || '星')[0]}
                  </AvatarFallback>
                )}
              </Avatar>
            </View>
            <View className="flex-1" onClick={!profile ? handleAvatarClick : undefined}>
              <Text className="block text-lg font-bold text-white">
                {profile?.name || '点击微信授权登录'}
              </Text>
              <Text className="block text-xs text-white/70 mt-1">
                {profile
                  ? ([profile.company_position, profile.company_name].filter(Boolean).join(' · ') || '微信授权会员')
                  : '登录后同步微信头像与昵称'}
              </Text>
              {profile ? (
                <Text className="block text-xs text-white/50 mt-0.5">头像与昵称来自微信，不可修改</Text>
              ) : null}
              {profile ? (
                <View className="mt-2">
                  <Badge className={`${currentLevel.color} text-xs`}>{currentLevel.label}</Badge>
                </View>
              ) : null}
            </View>
          </View>

          {profile ? (
            <View className="flex flex-row mt-5 bg-white/10 rounded-2xl px-3 py-3">
              <View className="flex-1">
                <Text className="block text-white text-base font-bold text-center">{profile.available_points || 0}</Text>
                <Text className="block text-white/60 text-xs text-center mt-0.5">积分</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-white text-base font-bold text-center">{profile.credit_score || 0}</Text>
                <Text className="block text-white/60 text-xs text-center mt-0.5">信用</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-white text-base font-bold text-center">{profile.referrer_count || 0}</Text>
                <Text className="block text-white/60 text-xs text-center mt-0.5">推荐</Text>
              </View>
            </View>
          ) : null}
        </View>

        {showSubordinates && (
          <View className="px-3.5 mt-3">
            <Card>
              <CardContent className="p-4">
                <Text className="block text-sm font-semibold text-[#1A1D2E] mb-3">推荐人员</Text>
                {subordinates.length === 0 ? (
                  <Text className="block text-xs text-gray-400">暂无推荐人员</Text>
                ) : (
                  subordinates.map((sub) => (
                    <View key={sub.id} className="flex flex-row items-center gap-3 py-2">
                      <View className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <Text className="text-xs text-gray-500">{(sub.name || '?')[0]}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="block text-sm font-medium text-gray-900">{sub.name}</Text>
                        <Text className="block text-xs text-gray-500">{sub.company_name || '未设置公司'}</Text>
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          </View>
        )}

        {menuSections.map((section, sIdx) => (
          <View key={sIdx} className="px-3.5 mt-3">
            <Text className="block text-xs text-gray-400 mb-2 px-1">{section.title}</Text>
            <Card>
              <CardContent className="p-0">
                {section.items.map((item, iIdx) => {
                  const ItemIcon = item.icon
                  const handleItemClick = async () => {
                    if (item.action === 'logout') {
                      if (!isLoggedIn()) {
                        openLoginSheet()
                        return
                      }
                      handleLogout()
                      return
                    }
                    if (item.action === 'subordinates') {
                      await loadSubordinates()
                    } else if (item.action === 'mall') {
                      Taro.switchTab({ url: '/pages/mall/index' })
                    } else if (item.action === 'my-posts') {
                      if (!(await ensureLogin())) return
                      Taro.navigateTo({ url: '/pages/my-posts/index' })
                    } else if (item.action === 'talent') {
                      if (!(await ensureLogin())) return
                      Taro.navigateTo({ url: '/pages/talent-settle/index' })
                    }
                  }
                  return (
                    <View key={iIdx}>
                      <View className="flex flex-row items-center px-4 py-3" onClick={handleItemClick}>
                        <View className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: `${item.color}15` }}>
                          <ItemIcon size={16} color={item.color} />
                        </View>
                        <Text className="block flex-1 text-sm text-[#1A1D2E]">{item.label}</Text>
                        {item.badge ? (
                          <Badge className="bg-[#C9A96E] bg-opacity-10 text-[#C9A96E] text-[10px] px-2 py-0 mr-2">{item.badge}</Badge>
                        ) : null}
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
    </View>
  )
}

export default ProfilePage
