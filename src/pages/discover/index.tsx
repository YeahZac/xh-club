import { useState, useEffect } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Search, Clock, MapPin, Users,
  ShoppingBag, Award, Star
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Network } from "@/network"

interface EventItem {
  id: string
  title: string
  description: string
  cover_image: string
  event_type: string
  start_time: string
  end_time: string
  location: string
  max_participants: number
  current_participants: number
  fee: number
  status: string
  is_featured: boolean
}

interface MemberItem {
  id: string
  name: string
  avatar: string
  company_name: string
  company_position: string
  industry_primary: string
  membership_level: string
  credit_score: number
  core_advantage: string
}

interface ProductItem {
  id: string
  name: string
  description: string
  image_url: string
  points_price: number
  stock: number
  category: string
}

const eventTypeMap: Record<string, string> = {
  salon: '专题沙龙', roadshow: '路演日', annual: '年度大会', training: '培训', meeting: '定期例会',
}

const levelMap: Record<string, { label: string; color: string }> = {
  normal: { label: '普通', color: 'bg-gray-100 text-gray-600' },
  silver: { label: '银卡', color: 'bg-gray-200 text-gray-700' },
  gold: { label: '金卡', color: 'bg-amber-50 text-amber-600' },
  diamond: { label: '钻石', color: 'bg-sky-50 text-sky-600' },
}

const DiscoverPage = () => {
  const [activeTab, setActiveTab] = useState("events")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  const [events, setEvents] = useState<EventItem[]>([])
  const [members, setMembers] = useState<MemberItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventsRes, membersRes, productsRes] = await Promise.all([
        Network.request({ url: '/api/events' }),
        Network.request({ url: '/api/members' }),
        Network.request({ url: '/api/admin/mall-products' }),
      ])
      console.log('[发现页] events:', eventsRes?.data)
      console.log('[发现页] members:', membersRes?.data)
      console.log('[发现页] products:', productsRes?.data)

      if (eventsRes?.data?.data) setEvents(eventsRes.data.data)
      if (membersRes?.data?.data) setMembers(membersRes.data.data)
      if (productsRes?.data?.data) setProducts(productsRes.data.data)
    } catch (err) {
      console.error('[发现页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

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
            <TabsTrigger value="events" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              活动报名
            </TabsTrigger>
            <TabsTrigger value="talents" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              人才查询
            </TabsTrigger>
            <TabsTrigger value="mall" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              会员商城
            </TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-4 pb-8">
                {events.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0 overflow-hidden">
                    {item.cover_image ? (
                      <View className="relative">
                        <img src={item.cover_image} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                        <View className="absolute left-0 top-0 right-0 p-3" style={{ background: 'linear-gradient(rgba(0,0,0,0.5), transparent)' }}>
                          <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{eventTypeMap[item.event_type] || item.event_type}</Badge>
                        </View>
                      </View>
                    ) : (
                      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] p-5 relative overflow-hidden">
                        <View className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                        <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0 mb-2">{eventTypeMap[item.event_type] || item.event_type}</Badge>
                        <Text className="block text-white font-bold text-base">{item.title}</Text>
                      </View>
                    )}
                    <CardContent className="p-4">
                      <Text className="block text-base font-semibold text-[#1A1D2E] mb-2">{item.title}</Text>
                      <View className="flex flex-col gap-1 mb-3">
                        <View className="flex flex-row items-center gap-2">
                          <Clock size={14} color="#6B7280" />
                          <Text className="block text-xs text-gray-500">{formatTime(item.start_time)}</Text>
                        </View>
                        <View className="flex flex-row items-center gap-2">
                          <MapPin size={14} color="#6B7280" />
                          <Text className="block text-xs text-gray-500">{item.location}</Text>
                        </View>
                        <View className="flex flex-row items-center gap-2">
                          <Users size={14} color="#6B7280" />
                          <Text className="block text-xs text-gray-500">{item.current_participants || 0}/{item.max_participants || '∞'}人</Text>
                        </View>
                      </View>
                      <View className="flex flex-row items-center justify-between">
                        <Text className="block text-sm font-bold text-[#C9A96E]">{item.fee > 0 ? `¥${item.fee}` : '免费'}</Text>
                        <Button size="sm" className="bg-[#1B2A4A] text-white text-xs h-8 rounded-lg">立即报名</Button>
                      </View>
                    </CardContent>
                  </Card>
                ))}
                {events.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无活动</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Talents Tab */}
          <TabsContent value="talents">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="flex flex-col gap-3 pb-8">
                {members.map((item) => {
                  const level = levelMap[item.membership_level] || levelMap.normal
                  return (
                    <Card key={item.id} className="shadow-sm border-0">
                      <CardContent className="p-4">
                        <View className="flex flex-row items-start gap-3">
                          <Avatar className="w-12 h-12 flex-shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-base">{(item.name || '?')[0]}</AvatarFallback>
                          </Avatar>
                          <View className="flex-1 min-w-0">
                            <View className="flex flex-row items-center gap-2 mb-1">
                              <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.name}</Text>
                              <Badge className={`${level.color} text-[10px] px-1 py-0`}>{level.label}</Badge>
                            </View>
                            <Text className="block text-xs text-gray-500">{item.company_position || ''} · {item.company_name || ''}</Text>
                            {item.core_advantage && <Text className="block text-xs text-gray-400 mt-1">{item.core_advantage}</Text>}
                            <View className="flex flex-row items-center gap-3 mt-2">
                              <View className="flex flex-row items-center gap-1">
                                <Star size={12} color="#C9A96E" />
                                <Text className="block text-xs text-[#C9A96E]">信用 {item.credit_score || 60}</Text>
                              </View>
                            </View>
                          </View>
                          <Button size="sm" variant="outline" className="text-xs h-7 rounded-lg">介绍对接</Button>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}
                {members.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无会员</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Mall Tab */}
          <TabsContent value="mall">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 220px)' }}>
              <View className="grid grid-cols-2 gap-3 pb-8">
                {products.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0">
                    <View className="bg-gradient-to-br from-[#FAF6F1] to-[#F5F0E8] h-28 flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ShoppingBag size={32} color="#C9A96E" />
                      )}
                    </View>
                    <CardContent className="p-3">
                      <Text className="block text-sm font-medium text-[#1A1D2E] mb-1 truncate">{item.name}</Text>
                      {item.description && <Text className="block text-xs text-gray-400 mb-2 truncate">{item.description}</Text>}
                      <View className="flex flex-row items-center justify-between">
                        <View className="flex flex-row items-center gap-1">
                          <Award size={12} color="#C9A96E" />
                          <Text className="block text-sm font-bold text-[#C9A96E]">{item.points_price}积分</Text>
                        </View>
                        <Badge className="bg-gray-100 text-gray-500 text-[10px] px-1 py-0">剩{item.stock}</Badge>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
              {products.length === 0 && !loading && (
                <View className="flex items-center justify-center py-16">
                  <Text className="block text-sm text-gray-400">商城暂无商品</Text>
                </View>
              )}
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>
      <View className="h-16" />
    </View>
  )
}

export default DiscoverPage
