import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Search, Clock, MapPin, Users,
  ShoppingBag, Award
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getResponseList } from "@/lib/api-response"
import { Network } from "@/network"

interface EventFormField {
  label: string
  type?: string
  required?: boolean
  options?: string[]
}

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
  form_fields?: EventFormField[] | string | null
}

interface TalentItem {
  id: string
  real_name: string
  contact: string
  photo_url: string
  avatar_url?: string
  member_avatar?: string
  industry_tags: string[]
  experience?: string
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

interface IndustryItem {
  code: string
  name: string
}

const eventTypeMap: Record<string, string> = {
  other: '其他活动', roadshow: '项目路演', salon: '专题沙龙', annual: '年度大会', training: '培训', meeting: '定期例会',
}

const isCloudStorageImageUrl = (url: string) =>
  /^https:\/\/[^/]*(?:\.myqcloud\.com|\.tcb\.qcloud\.la)/i.test(url)

const parseFormFields = (value: EventItem['form_fields']): EventFormField[] => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((item) => item?.label)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((item: EventFormField) => item?.label) : []
    } catch {
      return []
    }
  }
  return []
}

const DiscoverPage = () => {
  const [activeTab, setActiveTab] = useState("events")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? (Taro.getWindowInfo().statusBarHeight || 22) : 44

  const [events, setEvents] = useState<EventItem[]>([])
  const [talents, setTalents] = useState<TalentItem[]>([])
  const [industries, setIndustries] = useState<IndustryItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registeringEvent, setRegisteringEvent] = useState<EventItem | null>(null)
  const [registerFields, setRegisterFields] = useState<EventFormField[]>([])
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventsRes, talentsRes, industriesRes, productsRes] = await Promise.all([
        Network.request({ url: '/api/events?pageSize=100' }),
        Network.request({ url: '/api/talents?pageSize=100' }),
        Network.request({ url: '/api/industries' }),
        Network.request({ url: '/api/mall/products' }),
      ])
      console.log('[发现页] events:', eventsRes?.data)
      console.log('[发现页] talents:', talentsRes?.data)
      console.log('[发现页] products:', productsRes?.data)

      setEvents(getResponseList<EventItem>(eventsRes?.data?.data))
      setTalents(getResponseList<TalentItem>(talentsRes?.data?.data))
      setIndustries(Array.isArray(industriesRes?.data?.data) ? industriesRes.data.data : [])
      setProducts(getResponseList<ProductItem>(productsRes?.data?.data))
    } catch (err) {
      console.error('[发现页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const industryName = (code: string) =>
    industries.find((item) => item.code === code)?.name || code

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const submitRegistration = async (eventId: string, answers?: Record<string, string>) => {
    const response = await Network.request({
      url: `/api/events/${eventId}/register`,
      method: 'POST',
      data: {
        form_answers: answers && Object.keys(answers).length ? answers : undefined,
      },
    })
    Taro.showToast({
      title: response.data?.code === 200 ? '报名成功' : (response.data?.msg || '报名失败'),
      icon: response.data?.code === 200 ? 'success' : 'none',
    })
    if (response.data?.code === 200) {
      setRegisterOpen(false)
      setRegisteringEvent(null)
      setFormAnswers({})
      loadData()
    }
  }

  const handleEventRegistration = async (eventId: string) => {
    const memberId = Taro.getStorageSync('member_id')
    if (!memberId) {
      Taro.showToast({ title: '请先登录后报名', icon: 'none' })
      return
    }

    try {
      const detailRes = await Network.request({ url: `/api/events/${eventId}` })
      const eventDetail = (detailRes.data?.data || {}) as EventItem
      const fields = parseFormFields(eventDetail.form_fields)
      if (fields.length > 0) {
        setRegisteringEvent({ ...eventDetail, id: eventId })
        setRegisterFields(fields)
        setFormAnswers({})
        setRegisterOpen(true)
        return
      }
      await submitRegistration(eventId)
    } catch (error) {
      console.error('[发现页] 活动报名失败:', error)
      Taro.showToast({ title: '报名失败，请稍后重试', icon: 'none' })
    }
  }

  const handleSubmitRegisterForm = async () => {
    if (!registeringEvent?.id) return
    for (const field of registerFields) {
      if (field.required && !String(formAnswers[field.label] || '').trim()) {
        Taro.showToast({ title: `请填写${field.label}`, icon: 'none' })
        return
      }
    }
    try {
      setSubmitting(true)
      await submitRegistration(registeringEvent.id, formAnswers)
    } catch (error) {
      console.error('[发现页] 提交报名表单失败:', error)
      Taro.showToast({ title: '报名失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      {/* Header */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-4">
        <View style={{ height: `${statusBarHeight}px` }} />
        {isMiniApp && <Text className="block text-xl font-bold text-white mb-3">发现</Text>}
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
                  <Card
                    key={item.id}
                    className="shadow-sm border-0 overflow-hidden"
                    onClick={() => Taro.navigateTo({ url: `/pages/content-detail/index?type=event&id=${item.id}` })}
                  >
                    {isCloudStorageImageUrl(item.cover_image) ? (
                      <View className="relative">
                        <Image src={item.cover_image} mode="aspectFill" className="w-full aspect-[69/29]" />
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
                        <Button
                          size="sm"
                          className="bg-[#1B2A4A] text-white text-xs h-8 rounded-lg"
                          onClick={(e) => {
                            e?.stopPropagation?.()
                            handleEventRegistration(item.id)
                          }}
                        >
                          立即报名
                        </Button>
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
                {talents.map((item) => {
                  const avatar = item.avatar_url || item.member_avatar || item.photo_url
                  return (
                    <Card
                      key={item.id}
                      className="shadow-sm border-0"
                      onClick={() => Taro.navigateTo({ url: `/pages/content-detail/index?type=talent&id=${item.id}` })}
                    >
                      <CardContent className="p-4">
                        <View className="flex flex-row items-start gap-3">
                          <Avatar className="w-12 h-12 flex-shrink-0 overflow-hidden">
                            {isCloudStorageImageUrl(avatar || '') ? (
                              <AvatarImage src={avatar!} mode="aspectFill" />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-base">
                              {(item.real_name || '?')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <View className="flex-1 min-w-0">
                            <View className="flex flex-row items-center gap-2 mb-1">
                              <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.real_name}</Text>
                              <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-[10px] px-1 py-0">已入驻</Badge>
                            </View>
                            <View className="flex flex-row flex-wrap gap-1 mb-1">
                              {(item.industry_tags || []).slice(0, 3).map((code) => (
                                <Badge key={code} className="bg-gray-100 text-gray-500 text-[10px] px-1 py-0">
                                  {industryName(code)}
                                </Badge>
                              ))}
                            </View>
                            {item.experience && (
                              <Text className="block text-xs text-gray-400 mt-1">
                                {item.experience.slice(0, 48)}{item.experience.length > 48 ? '...' : ''}
                              </Text>
                            )}
                          </View>
                          <Button size="sm" variant="outline" className="text-xs h-7 rounded-lg">
                            查看详情
                          </Button>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}
                {talents.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无入驻人才</Text>
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
                    <View className="bg-gradient-to-br from-[#FAF6F1] to-[#F5F0E8] aspect-square flex items-center justify-center">
                      {isCloudStorageImageUrl(item.image_url) ? (
                        <Image src={item.image_url} mode="aspectFill" className="w-full h-full" />
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

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{registeringEvent?.title || '活动报名'}</DialogTitle>
          </DialogHeader>
          <View className="flex flex-col gap-3 py-2">
            {registerFields.map((field) => (
              <View key={field.label} className="flex flex-col gap-1.5">
                <Label>
                  <Text className="block text-sm text-gray-700">
                    {field.label}{field.required ? ' *' : ''}
                  </Text>
                </Label>
                {field.type === 'textarea' ? (
                  <View className="rounded-md border border-input bg-background px-3 py-2">
                    <Textarea
                      className="w-full bg-transparent"
                      placeholder={`请输入${field.label}`}
                      value={formAnswers[field.label] || ''}
                      onInput={(e) => setFormAnswers((prev) => ({ ...prev, [field.label]: e.detail.value }))}
                    />
                  </View>
                ) : (
                  <Input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'text' : 'text'}
                    placeholder={field.type === 'select' && field.options?.length ? field.options.join('/') : `请输入${field.label}`}
                    value={formAnswers[field.label] || ''}
                    onInput={(e) => setFormAnswers((prev) => ({ ...prev, [field.label]: e.detail.value }))}
                  />
                )}
              </View>
            ))}
          </View>
          <DialogFooter className="flex flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRegisterOpen(false)}>取消</Button>
            <Button className="flex-1 bg-[#1B2A4A] text-white" disabled={submitting} onClick={handleSubmitRegisterForm}>
              {submitting ? '提交中...' : '提交报名'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}

export default DiscoverPage
