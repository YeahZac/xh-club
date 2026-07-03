import { useState, useEffect } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  User, Award, TrendingUp, ChevronRight, Settings, Shield,
  FileText, Users, Gift, ShoppingBag, Star, Wallet, ChartBar, LogOut, Crown
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

  useEffect(() => {
    loadProfile()
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

  const currentLevel = levelMap[profile?.membership_level || 'normal'] || levelMap.normal

  const menuSections = [
    {
      title: '业务管理',
      items: [
        { icon: FileText, label: '成交记录', badge: profile?.total_transactions ? `${profile.total_transactions}单` : '', color: '#1B2A4A' },
        { icon: TrendingUp, label: '推荐管理', badge: profile?.referrer_count ? `${profile.referrer_count}人` : '', color: '#2D4A7A' },
        { icon: Users, label: '撮合对接', badge: profile?.match_count ? `${profile.match_count}次` : '', color: '#3B5998' },
      ]
    },
    {
      title: '资产与权益',
      items: [
        { icon: Gift, label: '积分明细', badge: profile?.available_points ? `${profile.available_points}` : '', color: '#C9A96E' },
        { icon: ShoppingBag, label: '积分兑换', color: '#B8935E' },
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
            <Avatar className="w-16 h-16 border-2 border-[#C9A96E]">
              <AvatarFallback className="bg-gradient-to-br from-[#C9A96E] to-[#E8D5A8] text-white text-xl">
                {(profile?.name || '星')[0]}
              </AvatarFallback>
            </Avatar>
            <View className="flex-1">
              <View className="flex flex-row items-center gap-2 mb-1">
                <Text className="block text-lg font-bold text-white">{profile?.name || '星河百谷会员'}</Text>
                <Badge className={`${currentLevel.color} text-[10px] px-2 py-0`}>{currentLevel.label}</Badge>
              </View>
              <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {profile?.company_position || ''}{profile?.company_name ? ` · ${profile.company_name}` : ''}
              </Text>
              {profile?.industry_primary && (
                <Badge className="bg-[#C9A96E]/20 text-[#C9A96E] text-[10px] px-1 py-0 mt-1">{industryMap[profile.industry_primary] || profile.industry_primary}</Badge>
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

        {/* Menu Sections */}
        {menuSections.map((section, sIdx) => (
          <View className="px-4 mt-4" key={sIdx}>
            <Text className="block text-xs text-gray-400 mb-2 ml-1">{section.title}</Text>
            <Card className="shadow-sm border-0">
              <CardContent className="p-0">
                {section.items.map((item, iIdx) => {
                  const ItemIcon = item.icon
                  return (
                    <View key={iIdx}>
                      <View className="flex flex-row items-center px-4 py-3">
                        <View className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: `${item.color}15` }}>
                          <ItemIcon size={16} color={item.color} />
                        </View>
                        <Text className="block flex-1 text-sm text-[#1A1D2E]">{item.label}</Text>
                        {item.badge && <Badge className="bg-[#C9A96E]/10 text-[#C9A96E] text-[10px] px-2 py-0 mr-2">{item.badge}</Badge>}
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
