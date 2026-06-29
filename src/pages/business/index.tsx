import { useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Search, MapPin, Clock, Users,
  ChevronRight, SlidersHorizontal, Eye
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

/* ── Mock Data ── */
const ROADSHOWS = [
  {
    id: 1, title: "AI+制造：智能工厂解决方案", company: "广州智造科技",
    industry: "先进制造", tag: "A轮", amount: "500万", progress: 65,
    attendees: 86, time: "03/28 14:00", location: "广州天河",
    desc: "面向中小制造企业的AI质检+智能排产一体化SaaS方案，已服务3家上市企业",
  },
  {
    id: 2, title: "预制菜供应链平台", company: "佛山鲜味食品",
    industry: "餐饮消费", tag: "天使轮", amount: "300万", progress: 30,
    attendees: 62, time: "04/02 10:00", location: "佛山南海",
    desc: "从田间到餐桌的全链路数字化管理，月GMV突破2000万",
  },
  {
    id: 3, title: "跨境支付合规SaaS", company: "深圳通汇数字",
    industry: "科技互联网", tag: "B轮", amount: "800万", progress: 82,
    attendees: 104, time: "04/05 15:00", location: "深圳南山",
    desc: "一站式跨境支付合规解决方案，已获香港MSO牌照",
  },
  {
    id: 4, title: "新能源储能系统集成", company: "东莞绿能科技",
    industry: "环保能源", tag: "A+轮", amount: "1200万", progress: 45,
    attendees: 78, time: "04/10 14:00", location: "东莞松山湖",
    desc: "工商业储能+光伏一体化方案，已落地项目12个",
  },
]

const FINANCING = [
  {
    id: 1, title: "大湾区智慧物流平台", company: "深圳速达科技",
    industry: "科技互联网", stage: "A轮", amount: "1500万",
    valuation: "6000万", progress: 40, investors: 3, desc: "基于AI的仓储+配送一体化调度平台",
  },
  {
    id: 2, title: "中医大健康连锁品牌", company: "广州本草堂",
    industry: "大健康", stage: "Pre-A", amount: "800万",
    valuation: "4000万", progress: 55, investors: 2, desc: "社区中医理疗+线上问诊O2O模式",
  },
  {
    id: 3, title: "工业机器人核心部件", company: "佛山精密智造",
    industry: "先进制造", stage: "B轮", amount: "3000万",
    valuation: "1.5亿", progress: 70, investors: 4, desc: "国产替代RV减速器，已获20+专利",
  },
]

const RESOURCES = [
  {
    id: 1, title: "珠三角3C电子代工厂", type: "需求", industry: "先进制造",
    budget: "50-100万", member: "李志远", company: "深圳优品科技",
    desc: "年订单量50万件以上，需SMT+组装一体化代工",
  },
  {
    id: 2, title: "5万平精密加工产能可接OEM", type: "供给", industry: "先进制造",
    budget: "面议", member: "陈国强", company: "东莞精工制造",
    desc: "CNC加工中心20台，精度0.01mm，7天交付",
  },
  {
    id: 3, title: "华南200+母婴门店渠道", type: "供给", industry: "跨境贸易",
    budget: "分成模式", member: "黄晓琳", company: "广州贝贝供应链",
    desc: "覆盖广深佛莞4城核心商圈，单店月销3万+",
  },
  {
    id: 4, title: "寻跨境电商海外仓合作", type: "需求", industry: "跨境贸易",
    budget: "30-50万", member: "王建辉", company: "东莞跨境优选",
    desc: "东南亚方向，需1万平以上仓储能力",
  },
]

const BusinessPage = () => {
  const [activeTab, setActiveTab] = useState("roadshow")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      {/* ── Header ── */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-4">
        <View style={{ height: `${statusBarHeight}px` }} />
        <Text className="block text-xl font-bold text-white mb-3">商机</Text>
        <View className="flex flex-row items-center gap-2">
          <View className="flex-1 rounded-xl px-3 py-2 flex flex-row items-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Search size={16} color="rgba(255,255,255,0.6)" />
            <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索项目、融资、资源...</Text>
          </View>
          <View className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <SlidersHorizontal size={18} color="#ffffff" />
          </View>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View className="px-4 -mt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white rounded-xl shadow-sm w-full flex flex-row justify-around p-1 h-auto">
            <TabsTrigger value="roadshow" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              项目路演
            </TabsTrigger>
            <TabsTrigger value="financing" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              融资招募
            </TabsTrigger>
            <TabsTrigger value="resource" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              资源对接
            </TabsTrigger>
          </TabsList>

          {/* Roadshow Tab */}
          <TabsContent value="roadshow">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {ROADSHOWS.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0 overflow-hidden">
                    <View className="bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] p-5 relative overflow-hidden">
                      <View className="absolute -right-8 -top-8 w-28 h-28 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="absolute right-4 bottom-2 w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="flex flex-row items-center justify-between mb-3">
                        <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{item.tag}</Badge>
                        <View className="flex flex-row items-center gap-1">
                          <Eye size={12} color="rgba(255,255,255,0.7)" />
                          <Text className="block text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.attendees}人关注</Text>
                        </View>
                      </View>
                      <Text className="block text-white font-bold text-base mb-1">{item.title}</Text>
                      <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.desc}</Text>
                    </View>
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center justify-between mb-3">
                        <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.company}</Text>
                        <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1 py-0">{item.industry}</Badge>
                      </View>
                      <View className="mb-3">
                        <View className="flex flex-row items-center justify-between mb-1">
                          <Text className="block text-xs text-gray-500">融资进度</Text>
                          <Text className="block text-xs font-semibold text-[#C9A96E]">{item.progress}%</Text>
                        </View>
                        <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <View className="h-full bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] rounded-full" style={{ width: `${item.progress}%` }} />
                        </View>
                      </View>
                      <View className="flex flex-row items-center justify-between">
                        <View className="flex flex-row items-center gap-3">
                          <View className="flex flex-row items-center gap-1">
                            <Clock size={12} color="#6B7280" />
                            <Text className="block text-xs text-gray-500">{item.time}</Text>
                          </View>
                          <View className="flex flex-row items-center gap-1">
                            <MapPin size={12} color="#6B7280" />
                            <Text className="block text-xs text-gray-500">{item.location}</Text>
                          </View>
                        </View>
                        <Text className="block text-sm font-bold text-[#C9A96E]">融资{item.amount}</Text>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Financing Tab */}
          <TabsContent value="financing">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {FINANCING.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0 overflow-hidden">
                    <View className="bg-gradient-to-br from-[#2D4A7A] to-[#4A6FA5] p-5 relative overflow-hidden">
                      <View className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="flex flex-row items-center justify-between mb-2">
                        <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{item.stage}</Badge>
                        <View className="flex flex-row items-center gap-1">
                          <Users size={12} color="rgba(255,255,255,0.7)" />
                          <Text className="block text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.investors}位投资人关注</Text>
                        </View>
                      </View>
                      <Text className="block text-white font-bold text-base mb-1">{item.title}</Text>
                      <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.desc}</Text>
                    </View>
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center justify-between mb-3">
                        <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.company}</Text>
                        <Badge className="bg-gray-100 text-gray-600 text-[10px] px-1 py-0">{item.industry}</Badge>
                      </View>
                      <View className="flex flex-row items-center justify-between mb-3">
                        <View>
                          <Text className="block text-xs text-gray-400 mb-0">目标金额</Text>
                          <Text className="block text-sm font-bold text-[#1A1D2E]">{item.amount}</Text>
                        </View>
                        <View>
                          <Text className="block text-xs text-gray-400 mb-0">估值</Text>
                          <Text className="block text-sm font-bold text-[#1A1D2E]">{item.valuation}</Text>
                        </View>
                        <View className="text-right">
                          <Text className="block text-xs text-gray-400 mb-0">已获意向</Text>
                          <Text className="block text-sm font-bold text-[#C9A96E]">{item.progress}%</Text>
                        </View>
                      </View>
                      <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <View className="h-full bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] rounded-full" style={{ width: `${item.progress}%` }} />
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Resource Tab */}
          <TabsContent value="resource">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-3 pb-8">
                {RESOURCES.map((item) => (
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
                      <Text className="block text-xs text-gray-500 mb-3 leading-relaxed">{item.desc}</Text>
                      <View className="flex flex-row items-center justify-between pt-2 border-t border-[#E8EAF0]">
                        <View className="flex flex-row items-center gap-2">
                          <View className="w-5 h-5 rounded-full bg-[#1B2A4A] flex items-center justify-center">
                            <Text className="block text-[8px] text-white">{item.member[0]}</Text>
                          </View>
                          <Text className="block text-xs text-gray-500">{item.member}</Text>
                          <Text className="block text-xs text-gray-300">·</Text>
                          <Text className="block text-xs text-gray-400">{item.company}</Text>
                        </View>
                        <View className="flex flex-row items-center gap-0">
                          <Text className="block text-xs text-[#C9A96E]">对接</Text>
                          <ChevronRight size={12} color="#C9A96E" />
                        </View>
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

export default BusinessPage
