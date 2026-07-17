import { useMemo, useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import {
  Search, Clock, MapPin, Users,
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
import { isDisplayableImageUrl } from "@/lib/media-url"
import { Network } from "@/network"
import { ensureLogin } from "@/lib/auth"

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
  created_at?: string
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
  reviewed_at?: string
  updated_at?: string
  created_at?: string
}

interface IndustryItem {
  code: string
  name: string
}

type DiscoverFeedItem =
  | { kind: 'event'; sortTime: number; data: EventItem }
  | { kind: 'talent'; sortTime: number; data: TalentItem }

const eventTypeMap: Record<string, string> = {
  other: '其他活动', roadshow: '项目路演', salon: '专题沙龙', annual: '年度大会', training: '培训', meeting: '定期例会',
}

const toSortTime = (value?: string | null) => {
  if (!value) return 0
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

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
  const [activeTab, setActiveTab] = useState("all")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? (Taro.getWindowInfo().statusBarHeight || 22) : 44

  const [events, setEvents] = useState<EventItem[]>([])
  const [talents, setTalents] = useState<TalentItem[]>([])
  const [industries, setIndustries] = useState<IndustryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registeringEvent, setRegisteringEvent] = useState<EventItem | null>(null)
  const [registerFields, setRegisterFields] = useState<EventFormField[]>([])
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadData() }, [])

  useDidShow(() => {
    const initialTab = String(Taro.getStorageSync('discover_initial_tab') || '')
    if (initialTab === 'all' || initialTab === 'events' || initialTab === 'talents') {
      setActiveTab(initialTab)
      Taro.removeStorageSync('discover_initial_tab')
    }
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventsRes, talentsRes, industriesRes] = await Promise.all([
        Network.request({ url: '/api/events?pageSize=100' }),
        Network.request({ url: '/api/talents?pageSize=100' }),
        Network.request({ url: '/api/industries' }),
      ])

      const eventList = getResponseList<EventItem>(eventsRes?.data?.data)
        .slice()
        .sort((a, b) => toSortTime(b.start_time || b.created_at) - toSortTime(a.start_time || a.created_at))
      const talentList = getResponseList<TalentItem>(talentsRes?.data?.data)
        .slice()
        .sort((a, b) =>
          toSortTime(b.reviewed_at || b.updated_at || b.created_at)
          - toSortTime(a.reviewed_at || a.updated_at || a.created_at),
        )

      setEvents(eventList)
      setTalents(talentList)
      setIndustries(Array.isArray(industriesRes?.data?.data) ? industriesRes.data.data : [])
    } catch (err) {
      console.error('[发现页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const allFeed = useMemo<DiscoverFeedItem[]>(() => {
    const eventItems: DiscoverFeedItem[] = events.map((item) => ({
      kind: 'event',
      sortTime: toSortTime(item.start_time || item.created_at),
      data: item,
    }))
    const talentItems: DiscoverFeedItem[] = talents.map((item) => ({
      kind: 'talent',
      sortTime: toSortTime(item.reviewed_at || item.updated_at || item.created_at),
      data: item,
    }))
    return [...eventItems, ...talentItems].sort((a, b) => b.sortTime - a.sortTime)
  }, [events, talents])

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
    if (!(await ensureLogin('请先登录后报名'))) return

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

  const renderEventCard = (item: EventItem) => {
    const coverOk = isDisplayableImageUrl(item.cover_image)
    return (
      <Card
        key={`event-${item.id}`}
        className="shadow-sm border-0 overflow-hidden"
        onClick={() => Taro.navigateTo({ url: `/pages/content-detail/index?type=event&id=${item.id}` })}
      >
        <CardContent className="p-2.5">
          <View className="flex flex-row gap-2.5">
            <View className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              {coverOk ? (
                <Image src={item.cover_image} mode="aspectFill" className="w-full h-full" />
              ) : (
                <View className="w-full h-full bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] flex items-center justify-center px-1.5">
                  <Text className="block text-white text-xs font-semibold text-center">{item.title}</Text>
                </View>
              )}
            </View>
            <View className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <View>
                <View className="flex flex-row items-start justify-between gap-1.5 mb-0.5">
                  <Text className="block text-xs font-semibold text-[#1A1D2E] leading-snug flex-1">{item.title}</Text>
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0 flex-shrink-0">
                    {eventTypeMap[item.event_type] || item.event_type || '活动'}
                  </Badge>
                </View>
                <View className="flex flex-col gap-0.5">
                  <View className="flex flex-row items-center gap-1">
                    <Clock size={11} color="#6B7280" />
                    <Text className="block text-xs text-gray-500">{formatTime(item.start_time)}</Text>
                  </View>
                  <View className="flex flex-row items-center gap-1">
                    <MapPin size={11} color="#6B7280" />
                    <Text className="block text-xs text-gray-500 truncate">{item.location}</Text>
                  </View>
                  <View className="flex flex-row items-center gap-1">
                    <Users size={11} color="#6B7280" />
                    <Text className="block text-xs text-gray-500">{item.current_participants || 0}/{item.max_participants || '∞'}人</Text>
                  </View>
                </View>
              </View>
              <View className="flex flex-row items-center justify-between mt-1.5">
                <Text className="block text-xs font-bold text-[#C9A96E]">{item.fee > 0 ? `¥${item.fee}` : '免费'}</Text>
                <Button
                  size="sm"
                  className="bg-[#1B2A4A] text-white text-xs h-6 px-2.5 rounded-md"
                  onClick={(e) => {
                    e?.stopPropagation?.()
                    handleEventRegistration(item.id)
                  }}
                >
                  报名
                </Button>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    )
  }

  const renderTalentCard = (item: TalentItem) => {
    const avatar = item.avatar_url || item.member_avatar || item.photo_url
    return (
      <Card
        key={`talent-${item.id}`}
        className="shadow-sm border-0"
        onClick={() => Taro.navigateTo({ url: `/pages/content-detail/index?type=talent&id=${item.id}` })}
      >
        <CardContent className="p-2.5">
          <View className="flex flex-row items-start gap-2.5">
            <Avatar className="w-11 h-11 flex-shrink-0 overflow-hidden">
              {isDisplayableImageUrl(avatar || '') ? (
                <AvatarImage src={avatar!} mode="aspectFill" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-sm">
                {(item.real_name || '?')[0]}
              </AvatarFallback>
            </Avatar>
            <View className="flex-1 min-w-0">
              <View className="flex flex-row items-center gap-1.5 mb-0.5">
                <Text className="block text-xs font-semibold text-[#1A1D2E]">{item.real_name}</Text>
                <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1 py-0">人才</Badge>
              </View>
              <View className="flex flex-row flex-wrap gap-1 mb-0.5">
                {(item.industry_tags || []).slice(0, 3).map((code) => (
                  <Badge key={code} className="bg-gray-100 text-gray-500 text-xs px-1 py-0">
                    {industryName(code)}
                  </Badge>
                ))}
              </View>
              {item.experience && (
                <Text className="block text-xs text-gray-400 mt-0.5">
                  {item.experience.slice(0, 42)}{item.experience.length > 42 ? '...' : ''}
                </Text>
              )}
            </View>
            <Button size="sm" variant="outline" className="text-xs h-6 px-2 rounded-md">
              详情
            </Button>
          </View>
        </CardContent>
      </Card>
    )
  }

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-3.5 pb-3">
        <View style={{ height: `${statusBarHeight}px` }} />
        {isMiniApp && <Text className="block text-lg font-bold text-white mb-2.5">发现</Text>}
        <View className="rounded-lg px-2.5 py-1.5 flex flex-row items-center gap-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <Search size={14} color="rgba(255,255,255,0.6)" />
          <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索活动、人才...</Text>
        </View>
      </View>

      <View className="px-3.5 -mt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white rounded-lg shadow-sm w-full flex flex-row justify-around p-0.5 h-auto">
            <TabsTrigger value="all" className="flex-1 rounded-md data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-1.5 text-xs">
              全部
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1 rounded-md data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-1.5 text-xs">
              活动报名
            </TabsTrigger>
            <TabsTrigger value="talents" className="flex-1 rounded-md data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-1.5 text-xs">
              人才查询
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 200px)' }}>
              <View className="flex flex-col gap-2 pb-6">
                {allFeed.map((item) =>
                  item.kind === 'event'
                    ? renderEventCard(item.data)
                    : renderTalentCard(item.data),
                )}
                {allFeed.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-12">
                    <Text className="block text-xs text-gray-400">暂无内容</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          <TabsContent value="events">
            <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 200px)' }}>
              <View className="flex flex-col gap-2 pb-6">
                {events.map((item) => renderEventCard(item))}
                {events.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-12">
                    <Text className="block text-xs text-gray-400">暂无活动</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>

          <TabsContent value="talents">
            <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 200px)' }}>
              <View className="flex flex-col gap-2 pb-6">
                {talents.map((item) => renderTalentCard(item))}
                {talents.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-12">
                    <Text className="block text-xs text-gray-400">暂无入驻人才</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>
      <View className="h-14" />

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
