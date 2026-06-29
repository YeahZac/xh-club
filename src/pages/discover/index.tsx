import { useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Search, MapPin, CalendarDays, Users, Award,
  ChevronRight, Clock, Star, Briefcase, Crown
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

/* ── Mock Data ── */
const ACTIVITIES = [
  {
    id: 1, title: "2025粤商年度峰会", date: "04/18 周五", time: "09:00-17:00",
    location: "广州白云国际会议中心", type: "年度大会", attendees: 320,
    maxAttendees: 500, fee: "会员免费", image: "summit",
    gradient: "from-[#1B2A4A] to-[#C9A96E]",
  },
  {
    id: 2, title: "智能制造专题沙龙", date: "04/03 周四", time: "14:00-17:00",
    location: "佛山南海瀚天科技城", type: "行业沙龙", attendees: 45,
    maxAttendees: 60, fee: "免费", image: "salon",
    gradient: "from-[#2D4A7A] to-[#4A6FA5]",
  },
  {
    id: 3, title: "创投路演日·第12期", date: "04/05 周六", time: "14:00-18:00",
    location: "深圳南山软件产业基地", type: "路演日", attendees: 86,
    maxAttendees: 100, fee: "¥99", image: "roadshow",
    gradient: "from-[#3B5998] to-[#5B7DB1]",
  },
  {
    id: 4, title: "私董会：企业传承与二代培养", date: "04/12 周六", time: "09:00-12:00",
    location: "广州天河四季酒店", type: "私董会", attendees: 12,
    maxAttendees: 15, fee: "¥299", image: "board",
    gradient: "from-[#1B2A4A] to-[#2D4A7A]",
  },
]

const TALENTS = [
  {
    id: 1, name: "张伟明", title: "合伙人", company: "珠江投资",
    industry: "金融资本", tags: ["股权投资", "并购重组", "大湾区"],
    credit: 92, level: "diamond", deals: 18,
  },
  {
    id: 2, name: "刘雅琳", title: "高级合伙人", company: "金诚律所",
    industry: "法律服务", tags: ["公司法务", "跨境合规", "IPO"],
    credit: 88, level: "gold", deals: 12,
  },
  {
    id: 3, name: "陈国强", title: "创始人", company: "东莞精工制造",
    industry: "先进制造", tags: ["精密加工", "OEM代工", "自动化"],
    credit: 85, level: "gold", deals: 8,
  },
  {
    id: 4, name: "黄晓琳", title: "CEO", company: "贝贝供应链",
    industry: "跨境贸易", tags: ["母婴渠道", "供应链", "华南市场"],
    credit: 79, level: "silver", deals: 6,
  },
  {
    id: 5, name: "王建辉", title: "总经理", company: "跨境优选",
    industry: "跨境贸易", tags: ["跨境电商", "海外仓", "东南亚"],
    credit: 75, level: "silver", deals: 4,
  },
]

const MARKET = [
  { id: 1, title: "1个月会费抵扣券", category: "会员权益", points: 500, stock: 50 },
  { id: 2, title: "法律咨询1小时", category: "商务服务", points: 200, stock: 30 },
  { id: 3, title: "品牌诊断服务", category: "商务服务", points: 500, stock: 10 },
  { id: 4, title: "商会定制公文包", category: "商务礼品", points: 300, stock: 100 },
  { id: 5, title: "年度大会VIP席位", category: "活动权益", points: 1000, stock: 5 },
  { id: 6, title: "商业课程月卡", category: "学习成长", points: 200, stock: 20 },
]

const LEVEL_MAP: Record<string, { label: string; color: string; bg: string }> = {
  diamond: { label: "钻石", color: "#C9A96E", bg: "#FAF6F1" },
  gold: { label: "金卡", color: "#F59E0B", bg: "#FFFBEB" },
  silver: { label: "银卡", color: "#6B7280", bg: "#F3F4F6" },
  normal: { label: "普通", color: "#9CA3AF", bg: "#F9FAFB" },
}

const DiscoverPage = () => {
  const [activeTab, setActiveTab] = useState("activity")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      {/* Header */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-4">
        <View style={{ height: `${statusBarHeight}px` }} />
        <Text className="block text-xl font-bold text-white mb-3">发现</Text>
        <View className="rounded-xl px-3 py-2 flex flex-row items-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索活动、人才、商品...</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="px-4 -mt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white rounded-xl shadow-sm w-full flex flex-row justify-around p-1 h-auto">
            <TabsTrigger value="activity" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              活动
            </TabsTrigger>
            <TabsTrigger value="talent" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              人才
            </TabsTrigger>
            <TabsTrigger value="market" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              商城
            </TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {ACTIVITIES.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0 overflow-hidden">
                    <View className={`bg-gradient-to-br ${item.gradient} p-5 relative overflow-hidden`}>
                      <View className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="absolute right-8 bottom-2 w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="flex flex-row items-center justify-between mb-2">
                        <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{item.type}</Badge>
                        <Text className="block text-xs font-semibold text-[#C9A96E]">{item.fee}</Text>
                      </View>
                      <Text className="block text-white font-bold text-lg mb-1">{item.title}</Text>
                      <View className="flex flex-row items-center gap-1 mb-1">
                        <MapPin size={12} color="rgba(255,255,255,0.7)" />
                        <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.location}</Text>
                      </View>
                    </View>
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center justify-between">
                        <View className="flex flex-row items-center gap-3">
                          <View className="flex flex-row items-center gap-1">
                            <CalendarDays size={14} color="#6B7280" />
                            <Text className="block text-xs text-gray-600">{item.date}</Text>
                          </View>
                          <View className="flex flex-row items-center gap-1">
                            <Clock size={14} color="#6B7280" />
                            <Text className="block text-xs text-gray-600">{item.time}</Text>
                          </View>
                        </View>
                        <View className="flex flex-row items-center gap-1">
                          <Users size={14} color="#C9A96E" />
                          <Text className="block text-xs font-semibold text-[#C9A96E]">{item.attendees}/{item.maxAttendees}</Text>
                        </View>
                      </View>
                      <View className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className={`h-full rounded-full ${item.attendees >= item.maxAttendees ? 'bg-red-400' : 'bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8]'}`}
                          style={{ width: `${Math.min((item.attendees / item.maxAttendees) * 100, 100)}%` }}
                        />
                      </View>
                      <View className="flex flex-row items-center justify-between mt-2">
                        <Text className="block text-[10px] text-gray-400">
                          {item.attendees >= item.maxAttendees ? '已满员' : `剩余${item.maxAttendees - item.attendees}个名额`}
                        </Text>
                        <View className="flex flex-row items-center gap-0">
                          <Text className="block text-xs text-[#1B2A4A] font-semibold">立即报名</Text>
                          <ChevronRight size={12} color="#1B2A4A" />
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Talent Tab */}
          <TabsContent value="talent">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-3 pb-8">
                {TALENTS.map((item) => {
                  const lv = LEVEL_MAP[item.level] || LEVEL_MAP.normal
                  return (
                    <Card key={item.id} className="shadow-sm border-0">
                      <CardContent className="p-4">
                        <View className="flex flex-row items-start gap-3">
                          <Avatar className="w-12 h-12 flex-shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-base">{item.name[0]}</AvatarFallback>
                          </Avatar>
                          <View className="flex-1 min-w-0">
                            <View className="flex flex-row items-center gap-2 mb-0">
                              <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.name}</Text>
                              <Badge className="text-[10px] px-1 py-0" style={{ backgroundColor: lv.bg, color: lv.color }}>
                                {lv.label}
                              </Badge>
                            </View>
                            <Text className="block text-xs text-gray-500 mb-2">{item.title} · {item.company}</Text>
                            <View className="flex flex-row items-center gap-2 mb-2">
                              <Badge className="bg-[#EDF0F4] text-[#1B2A4A] text-[10px] px-1 py-0">{item.industry}</Badge>
                              {item.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} className="bg-gray-100 text-gray-500 text-[10px] px-1 py-0">{tag}</Badge>
                              ))}
                            </View>
                            <View className="flex flex-row items-center gap-4">
                              <View className="flex flex-row items-center gap-1">
                                <Star size={12} color="#C9A96E" />
                                <Text className="block text-xs text-gray-500">信用 {item.credit}</Text>
                              </View>
                              <View className="flex flex-row items-center gap-1">
                                <Briefcase size={12} color="#6B7280" />
                                <Text className="block text-xs text-gray-500">成交 {item.deals}单</Text>
                              </View>
                              <View className="flex flex-row items-center gap-1">
                                <Crown size={12} color="#C9A96E" />
                                <Text className="block text-xs text-gray-500">{lv.label}会员</Text>
                              </View>
                            </View>
                          </View>
                          <View className="flex-shrink-0">
                            <View className="flex flex-row items-center gap-0">
                              <Text className="block text-xs text-[#C9A96E]">介绍</Text>
                              <ChevronRight size={12} color="#C9A96E" />
                            </View>
                          </View>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Market Tab */}
          <TabsContent value="market">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              {/* Points Balance */}
              <Card className="shadow-sm border-0 mb-4">
                <CardContent className="p-4">
                  <View className="flex flex-row items-center justify-between">
                    <View>
                      <Text className="block text-xs text-gray-400 mb-1">可用积分</Text>
                      <View className="flex flex-row items-baseline gap-1">
                        <Text className="block text-2xl font-bold text-[#C9A96E]">3,850</Text>
                        <Text className="block text-xs text-gray-400">分</Text>
                      </View>
                    </View>
                    <View className="rounded-lg px-3 py-1 bg-[#1B2A4A]">
                      <Text className="block text-xs text-white font-medium">积分明细</Text>
                    </View>
                  </View>
                </CardContent>
              </Card>

              {/* Category filters */}
              <View className="flex flex-row gap-2 mb-4">
                {["全部", "会员权益", "商务服务", "商务礼品", "活动权益", "学习成长"].map((cat, i) => (
                  <View key={cat} className={`px-3 py-1 rounded-full ${i === 0 ? 'bg-[#1B2A4A]' : 'bg-white'}`}>
                    <Text className={`block text-xs ${i === 0 ? 'text-white' : 'text-gray-600'}`}>{cat}</Text>
                  </View>
                ))}
              </View>

              {/* Product Grid */}
              <View className="grid grid-cols-2 gap-3 pb-8">
                {MARKET.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0">
                    <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] h-24 flex items-center justify-center relative overflow-hidden">
                      <View className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <Award size={28} color="#C9A96E" />
                    </View>
                    <CardContent className="p-3">
                      <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-[10px] px-1 py-0 mb-1">{item.category}</Badge>
                      <Text className="block text-sm font-semibold text-[#1A1D2E] mb-1">{item.title}</Text>
                      <View className="flex flex-row items-center justify-between">
                        <View className="flex flex-row items-baseline gap-0">
                          <Text className="block text-sm font-bold text-[#C9A96E]">{item.points}</Text>
                          <Text className="block text-[10px] text-gray-400">积分</Text>
                        </View>
                        <Text className="block text-[10px] text-gray-400">剩{item.stock}件</Text>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>
    </View>
  )
}

export default DiscoverPage
