import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  ChevronRight, Award, Star, Handshake, Users,
  Wallet, Crown, Gift, Settings, Bell, Shield, BookOpen
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

/* ── Mock Data ── */
const PROFILE = {
  name: "李志远",
  company: "深圳优品科技有限公司",
  title: "创始人 · CEO",
  industry: "科技互联网",
  level: "gold" as const,
  credit: 82,
  joinDate: "2023年6月入会",
  branch: "深圳分会",
  department: "科技互联网部",
}

const STATS = [
  { label: "活跃值", value: "1720", target: "2000", icon: BookOpen, color: "#3B82F6", bg: "#EFF6FF" },
  { label: "贡献值", value: "2340", target: "1500", icon: Award, color: "#C9A96E", bg: "#FAF6F1" },
  { label: "信用分", value: "82", target: "80", icon: Shield, color: "#10B981", bg: "#ECFDF5" },
]

const DEAL_STATS = [
  { label: "累计成交", value: "12单", sub: "¥386万" },
  { label: "推荐会员", value: "8人", sub: "转化6人" },
  { label: "撮合成功", value: "6次", sub: "¥124万" },
  { label: "可用积分", value: "3,850", sub: "分" },
]

const MENU_SECTIONS = [
  {
    title: "我的业务",
    items: [
      { icon: Handshake, label: "成交记录", extra: "12单", color: "#C9A96E", bg: "#FAF6F1" },
      { icon: Users, label: "推荐管理", extra: "8人", color: "#3B82F6", bg: "#EFF6FF" },
      { icon: Wallet, label: "收益明细", extra: "¥12,800", color: "#10B981", bg: "#ECFDF5" },
      { icon: Gift, label: "积分兑换", extra: "3,850分", color: "#EC4899", bg: "#FDF2F8" },
    ],
  },
  {
    title: "会员服务",
    items: [
      { icon: Crown, label: "会员等级", extra: "金卡会员", color: "#C9A96E", bg: "#FAF6F1" },
      { icon: Star, label: "信用评分", extra: "82分", color: "#F59E0B", bg: "#FFFBEB" },
      { icon: Award, label: "荣誉徽章", extra: "5枚", color: "#6366F1", bg: "#F0F0FE" },
    ],
  },
  {
    title: "设置",
    items: [
      { icon: Bell, label: "消息设置", extra: "", color: "#6B7280", bg: "#F3F4F6" },
      { icon: Settings, label: "账户设置", extra: "", color: "#6B7280", bg: "#F3F4F6" },
    ],
  },
]

const LEVEL_MAP: Record<string, { label: string; color: string; bg: string }> = {
  diamond: { label: "钻石会员", color: "#C9A96E", bg: "#FAF6F1" },
  gold: { label: "金卡会员", color: "#F59E0B", bg: "#FFFBEB" },
  silver: { label: "银卡会员", color: "#6B7280", bg: "#F3F4F6" },
  normal: { label: "普通会员", color: "#9CA3AF", bg: "#F9FAFB" },
}

const ProfilePage = () => {
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8
  const lv = LEVEL_MAP[PROFILE.level] || LEVEL_MAP.normal

  return (
    <ScrollView scrollY className="h-full bg-[#F5F6FA]">
      {/* ── Profile Header ── */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-8 relative overflow-hidden">
        <View style={{ height: `${statusBarHeight}px` }} />
        {/* Decorative circles */}
        <View className="absolute -right-12 -top-12 w-40 h-40 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View className="absolute right-8 bottom-2 w-20 h-20 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View className="absolute left-20 -bottom-8 w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <View className="flex flex-row items-center gap-4 relative z-10">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-[#C9A96E] text-white text-xl font-bold">{PROFILE.name[0]}</AvatarFallback>
          </Avatar>
          <View className="flex-1">
            <View className="flex flex-row items-center gap-2 mb-1">
              <Text className="block text-lg font-bold text-white">{PROFILE.name}</Text>
              <Badge className="text-[10px] px-2 py-0 font-semibold" style={{ backgroundColor: lv.bg, color: lv.color }}>
                {lv.label}
              </Badge>
            </View>
            <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{PROFILE.title}</Text>
            <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{PROFILE.company}</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
        </View>

        {/* Sub info */}
        <View className="flex flex-row items-center gap-4 mt-4 relative z-10">
          <View className="flex flex-row items-center gap-1">
            <Crown size={12} color="#C9A96E" />
            <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{PROFILE.branch}</Text>
          </View>
          <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>|</Text>
          <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{PROFILE.department}</Text>
          <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>|</Text>
          <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{PROFILE.joinDate}</Text>
        </View>
      </View>

      {/* ── Growth Stats ── */}
      <View className="px-4 -mt-4">
        <Card className="shadow-sm border-0">
          <CardContent className="p-4">
            <View className="flex flex-row items-center justify-between mb-3">
              <Text className="block text-sm font-semibold text-[#1A1D2E]">成长体系</Text>
              <View className="flex flex-row items-center gap-0">
                <Text className="block text-xs text-[#C9A96E]">距钻石还需活跃值+280</Text>
                <ChevronRight size={12} color="#C9A96E" />
              </View>
            </View>
            <View className="flex flex-row gap-4">
              {STATS.map((stat) => (
                <View key={stat.label} className="flex-1">
                  <View className="flex flex-row items-center gap-1 mb-2">
                    <View className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                      <stat.icon size={14} color={stat.color} />
                    </View>
                    <Text className="block text-xs text-gray-500">{stat.label}</Text>
                  </View>
                  <View className="flex flex-row items-baseline gap-1">
                    <Text className="block text-lg font-bold text-[#1A1D2E]">{stat.value}</Text>
                    <Text className="block text-[10px] text-gray-400">/ {stat.target}</Text>
                  </View>
                  <View className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <View className="h-full rounded-full" style={{ backgroundColor: stat.color, width: `${Math.min((parseInt(stat.value) / parseInt(stat.target)) * 100, 100)}%` }} />
                  </View>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      </View>

      {/* ── Deal Stats Grid ── */}
      <View className="px-4 mt-4">
        <Card className="shadow-sm border-0">
          <CardContent className="p-4">
            <View className="grid grid-cols-4 gap-2">
              {DEAL_STATS.map((item) => (
                <View key={item.label} className="flex flex-col items-center">
                  <Text className="block text-base font-bold text-[#1A1D2E]">{item.value}</Text>
                  <Text className="block text-[10px] text-gray-400">{item.label}</Text>
                  <Text className="block text-[10px] text-[#C9A96E]">{item.sub}</Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      </View>

      {/* ── Menu Sections ── */}
      <View className="px-4 mt-4 pb-8">
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} className="mb-4">
            <Text className="block text-xs text-gray-400 mb-2 px-1">{section.title}</Text>
            <Card className="shadow-sm border-0">
              <CardContent className="p-0">
                {section.items.map((item, idx) => (
                  <View
                    key={item.label}
                    className={`flex flex-row items-center justify-between px-4 py-3 ${idx < section.items.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
                  >
                    <View className="flex flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: item.bg }}>
                        <item.icon size={16} color={item.color} />
                      </View>
                      <Text className="block text-sm text-[#1A1D2E]">{item.label}</Text>
                    </View>
                    <View className="flex flex-row items-center gap-1">
                      {item.extra && <Text className="block text-xs text-gray-400">{item.extra}</Text>}
                      <ChevronRight size={14} color="#D1D5DB" />
                    </View>
                  </View>
                ))}
              </CardContent>
            </Card>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

export default ProfilePage
