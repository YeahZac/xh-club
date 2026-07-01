import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Presentation, TrendingUp, UserPlus, CalendarDays,
  UserSearch, Search, SquarePen, Wallet,
  Bell, ChevronRight, MapPin, Clock, Users, Handshake
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel"

/* ── Carousel Dots ── */
const CarouselDots = ({ total }: { total: number }) => {
  const { current } = useCarousel()
  return (
    <View className="flex flex-row justify-center gap-1 mt-3">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1 rounded-full transition-all ${i === current ? 'w-5 bg-[#C9A96E]' : 'w-1 bg-gray-300'}`}
        />
      ))}
    </View>
  )
}

/* ── Mock Data ── */
const BANNERS = [
  { id: 1, title: "2025粤商年度峰会", subtitle: "汇聚湾区300+企业家 · 共话新格局", gradient: "from-[#1B2A4A] to-[#3B5998]" },
  { id: 2, title: "智能制造专场路演", subtitle: "6大项目现场PK · 投资人一对一", gradient: "from-[#2D4A7A] to-[#4A6FA5]" },
  { id: 3, title: "会员推荐享双倍积分", subtitle: "推荐新会员即享丰厚回报", gradient: "from-[#1B2A4A] to-[#C9A96E]" },
]

const QUICK_ENTRIES = [
  { label: "项目路演", icon: Presentation, tint: "#EDF0F4", color: "#1B2A4A", path: "" },
  { label: "融资招募", icon: TrendingUp, tint: "#EEF1F6", color: "#2D4A7A", path: "" },
  { label: "会员推荐", icon: UserPlus, tint: "#FAF6F1", color: "#C9A96E", path: "" },
  { label: "活动报名", icon: CalendarDays, tint: "#ECFDF5", color: "#10B981", path: "/pages/event-register/index" },
  { label: "人才查询", icon: UserSearch, tint: "#F0F0FE", color: "#6366F1", path: "" },
  { label: "项目查询", icon: Search, tint: "#FDF2F8", color: "#EC4899", path: "" },
  { label: "发布动态", icon: SquarePen, tint: "#FFFBEB", color: "#F59E0B", path: "" },
  { label: "我的收益", icon: Wallet, tint: "#FEF2F2", color: "#EF4444", path: "" },
]

const ROADSHOWS = [
  {
    id: 1,
    title: "AI+制造：智能工厂解决方案",
    company: "广州智造科技有限公司",
    amount: "融资500万",
    tag: "A轮",
    attendees: 86,
    time: "03/28 周五 14:00",
  },
  {
    id: 2,
    title: "预制菜供应链平台",
    company: "佛山鲜味食品有限公司",
    amount: "融资300万",
    tag: "天使轮",
    attendees: 62,
    time: "04/02 周三 10:00",
  },
  {
    id: 3,
    title: "跨境支付合规SaaS",
    company: "深圳通汇数字科技有限公司",
    amount: "融资800万",
    tag: "B轮",
    attendees: 104,
    time: "04/05 周六 15:00",
  },
]

const OPPORTUNITIES = [
  {
    id: 1,
    title: "寻珠三角3C电子代工厂",
    type: "需求",
    industry: "先进制造",
    budget: "50-100万",
    member: { name: "李志远", company: "深圳优品科技" },
  },
  {
    id: 2,
    title: "5万平精密加工产能可接OEM",
    type: "供给",
    industry: "先进制造",
    budget: "面议",
    member: { name: "陈国强", company: "东莞精工制造" },
  },
  {
    id: 3,
    title: "华南母婴渠道200+门店合作",
    type: "供给",
    industry: "跨境贸易",
    budget: "分成模式",
    member: { name: "黄晓琳", company: "广州贝贝供应链" },
  },
]

const FEEDS = [
  {
    id: 1,
    name: "张伟明",
    company: "珠江投资 · 合伙人",
    action: "发布了一条行业洞察",
    content: "大湾区先进制造政策红利期已到，建议关注佛山、东莞两地的产业园升级项目，特别是新能源配套和智能仓储领域...",
    time: "10分钟前",
    likes: 28,
    comments: 6,
  },
  {
    id: 2,
    name: "刘雅琳",
    company: "金诚律所 · 高级合伙人",
    action: "完成了一笔项目成交",
    content: "成功撮合：深圳XX科技与广州XX供应链达成智能仓储系统集成合作，成交金额28万",
    time: "1小时前",
    likes: 56,
    comments: 12,
  },
  {
    id: 3,
    name: "陈国强",
    company: "东莞精工制造 · 创始人",
    action: "更新了资源供给",
    content: "新增2条SMT产线，可承接中小批量PCBA订单，交期7-10天，欢迎对接",
    time: "3小时前",
    likes: 15,
    comments: 4,
  },
]

const IndexPage = () => {
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  return (
    <ScrollView scrollY className="h-full bg-[#F5F6FA]">
      {/* ── Custom Header ── */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-5">
        <View style={{ height: `${statusBarHeight}px` }} />
        <View className="flex flex-row items-center justify-between mb-3">
          <View className="flex flex-row items-center gap-2">
            <Text className="block text-xl font-bold text-white">粤商汇</Text>
            <Text className="block text-xs text-[#E8D5A8] bg-[#F4EEE2] px-2 py-0 rounded-full">商会会员平台</Text>
          </View>
          <View className="relative">
            <Bell size={20} color="#ffffff" />
            <View className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          </View>
        </View>
        {/* Search Bar */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} className="rounded-xl px-3 py-2 flex flex-row items-center gap-2">
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索项目、人才、资源...</Text>
        </View>
      </View>

      {/* ── Banner Carousel ── */}
      <View className="px-4 -mt-2">
        <Carousel
          opts={{ autoplay: true, interval: 4000, duration: 500, loop: true }}
          className="rounded-2xl overflow-hidden"
        >
          <CarouselContent>
            {BANNERS.map((banner) => (
              <CarouselItem key={banner.id}>
                <View className={`bg-gradient-to-br ${banner.gradient} rounded-2xl p-5 relative overflow-hidden`}>
                  {/* Decorative circles */}
                  <View className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  <View className="absolute -right-2 bottom-0 w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  <View className="absolute left-0 bottom-0 right-0 h-1 bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] rounded-full" />
                  <Text className="block text-white text-lg font-bold mb-1">{banner.title}</Text>
                  <Text className="block mb-4" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{banner.subtitle}</Text>
                  <View className="rounded-lg px-3 py-1 self-start" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text className="block text-white text-xs font-medium">立即参与 →</Text>
                  </View>
                </View>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselDots total={BANNERS.length} />
        </Carousel>
      </View>

      {/* ── Quick Entry Grid ── */}
      <View className="px-4 mt-5">
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <View className="grid grid-cols-4 gap-y-4">
            {QUICK_ENTRIES.map((entry) => (
              <View key={entry.label} className="flex flex-col items-center gap-1" onClick={() => { if (entry.path) Taro.navigateTo({ url: entry.path }) }}>
                <View className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: entry.tint }}>
                  <entry.icon size={22} color={entry.color} />
                </View>
                <Text className="block text-xs text-[#1A1D2E] font-medium">{entry.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Today's Roadshow ── */}
      <View className="mt-6">
        <View className="px-4 flex flex-row items-center justify-between mb-3">
          <View className="flex flex-row items-center gap-2">
            <View className="w-1 h-5 bg-[#C9A96E] rounded-full" />
            <Text className="block text-base font-semibold text-[#1A1D2E]">今日路演</Text>
            <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-[10px] px-1 py-0">{ROADSHOWS.length}场</Badge>
          </View>
          <View className="flex flex-row items-center gap-0">
            <Text className="block text-xs text-gray-400">更多</Text>
            <ChevronRight size={14} color="#9CA3AF" />
          </View>
        </View>
        <ScrollView scrollX className="pl-4">
          <View className="flex flex-row gap-3 pr-4">
            {ROADSHOWS.map((item) => (
              <Card key={item.id} className="min-w-[260px] shadow-sm border-0 overflow-hidden flex-shrink-0">
                {/* Card top gradient image area */}
                <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] p-4 relative overflow-hidden">
                  <View className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  <View className="flex flex-row items-center justify-between mb-2">
                    <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{item.tag}</Badge>
                    <View className="flex flex-row items-center gap-1">
                      <Users size={12} color="rgba(255,255,255,0.7)" />
                      <Text className="block text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.attendees}人关注</Text>
                    </View>
                  </View>
                  <Text className="block text-white font-semibold text-sm mb-1">{item.title}</Text>
                  <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.company}</Text>
                </View>
                <CardContent className="p-3">
                  <View className="flex flex-row items-center justify-between">
                    <View className="flex flex-row items-center gap-1">
                      <Clock size={12} color="#6B7280" />
                      <Text className="block text-xs text-gray-500">{item.time}</Text>
                    </View>
                    <Text className="block text-xs font-semibold text-[#C9A96E]">{item.amount}</Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── Business Opportunities ── */}
      <View className="mt-6 px-4">
        <View className="flex flex-row items-center justify-between mb-3">
          <View className="flex flex-row items-center gap-2">
            <View className="w-1 h-5 bg-[#C9A96E] rounded-full" />
            <Text className="block text-base font-semibold text-[#1A1D2E]">商机大厅</Text>
          </View>
          <View className="flex flex-row items-center gap-0">
            <Text className="block text-xs text-gray-400">全部</Text>
            <ChevronRight size={14} color="#9CA3AF" />
          </View>
        </View>
        <View className="flex flex-col gap-3">
          {OPPORTUNITIES.map((item) => (
            <Card key={item.id} className="shadow-sm border-0">
              <CardContent className="p-4">
                <View className="flex flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <View className="flex flex-row items-center gap-2 mb-1">
                      <Badge className={`${item.type === '需求' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'} text-[10px] px-1 py-0`}>
                        {item.type}
                      </Badge>
                      <Badge className="bg-gray-100 text-gray-500 text-[10px] px-1 py-0">{item.industry}</Badge>
                    </View>
                    <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.title}</Text>
                  </View>
                  <Text className="block text-xs font-bold text-[#C9A96E]">{item.budget}</Text>
                </View>
                <View className="flex flex-row items-center gap-2 pt-2 border-t border-[#E8EAF0]">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="bg-[#1B2A4A] text-white text-[10px]">{item.member.name[0]}</AvatarFallback>
                  </Avatar>
                  <Text className="block text-xs text-gray-500">{item.member.name}</Text>
                  <Text className="block text-xs text-gray-300">·</Text>
                  <Text className="block text-xs text-gray-400">{item.member.company}</Text>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>

      {/* ── Member Activity Feed ── */}
      <View className="mt-6 px-4 pb-8">
        <View className="flex flex-row items-center justify-between mb-3">
          <View className="flex flex-row items-center gap-2">
            <View className="w-1 h-5 bg-[#C9A96E] rounded-full" />
            <Text className="block text-base font-semibold text-[#1A1D2E]">会员动态</Text>
          </View>
        </View>
        <View className="flex flex-col gap-3">
          {FEEDS.map((feed) => (
            <Card key={feed.id} className="shadow-sm border-0">
              <CardContent className="p-4">
                <View className="flex flex-row items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-sm">{feed.name[0]}</AvatarFallback>
                  </Avatar>
                  <View className="flex-1 min-w-0">
                    <View className="flex flex-row items-center gap-2 mb-0">
                      <Text className="block text-sm font-semibold text-[#1A1D2E]">{feed.name}</Text>
                      <Text className="block text-xs text-gray-400">{feed.company}</Text>
                    </View>
                    <Text className="block text-xs text-[#C9A96E] mb-2">{feed.action}</Text>
                    <Text className="block text-sm text-gray-600 leading-relaxed">{feed.content}</Text>
                    <View className="flex flex-row items-center gap-4 mt-3">
                      <Text className="block text-xs text-gray-400">{feed.time}</Text>
                      <Handshake size={14} color="#6B7280" />
                      <Text className="block text-xs text-gray-400">{feed.likes}</Text>
                      <MapPin size={14} color="#6B7280" />
                      <Text className="block text-xs text-gray-400">{feed.comments}</Text>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

export default IndexPage
