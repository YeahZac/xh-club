import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { Clock, MapPin, Users } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RichHtml } from '@/components/rich-html'
import { Network } from '@/network'

type ContentType = 'article' | 'project' | 'event' | 'business' | 'talent'

const TYPE_TITLE: Record<ContentType, string> = {
  article: '文章详情',
  project: '项目详情',
  event: '活动详情',
  business: '商机详情',
  talent: '人才详情',
}

const CATEGORY_MAP: Record<string, string> = {
  roadshow: '项目路演',
  financing: '融资招募',
  resource: '资源对接',
  other: '其他活动',
  salon: '专题沙龙',
  annual: '年度大会',
  training: '培训',
  meeting: '定期例会',
}

const isCloudStorageImageUrl = (url?: string) =>
  !!url && /^https:\/\/[^/]*(?:\.myqcloud\.com|\.tcb\.qcloud\.la)/i.test(url)

const unwrapDetail = (payload: unknown): Record<string, any> | null => {
  let current: unknown = payload
  for (let i = 0; i < 3; i += 1) {
    if (!current || typeof current !== 'object') return null
    const obj = current as Record<string, any>
    if (obj.title || obj.name || obj.real_name || obj.content || obj.description || obj.experience) return obj
    if ('data' in obj) {
      current = obj.data
      continue
    }
    return obj
  }
  return null
}

const ContentDetailPage = () => {
  const [contentType, setContentType] = useState<ContentType>('article')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Record<string, any> | null>(null)
  const [industryMap, setIndustryMap] = useState<Record<string, string>>({})

  useLoad((query) => {
    const type = (query?.type || 'article') as ContentType
    const id = query?.id || ''
    setContentType(type)
    Taro.setNavigationBarTitle({ title: TYPE_TITLE[type] || '详情' })
    if (type === 'talent') {
      Network.request({ url: '/api/industries' }).then((res) => {
        const map: Record<string, string> = {}
        const list = Array.isArray(res?.data?.data) ? res.data.data : []
        list.forEach((item: any) => {
          map[item.code] = item.name
        })
        setIndustryMap(map)
      }).catch(() => undefined)
    }
    if (id) {
      loadDetail(type, id)
    } else {
      setLoading(false)
    }
  })

  const loadDetail = async (type: ContentType, id: string) => {
    setLoading(true)
    try {
      const urlMap: Record<ContentType, string> = {
        article: `/api/articles/${id}`,
        project: `/api/projects/${id}`,
        event: `/api/events/${id}`,
        business: `/api/business/${id}`,
        talent: `/api/talents/${id}`,
      }
      const res = await Network.request({ url: urlMap[type] })
      console.log('[内容详情]', type, res?.data)
      const payload = unwrapDetail(res?.data?.data ?? res?.data)
      if (payload) {
        setDetail(payload)
      } else {
        Taro.showToast({ title: '内容不存在', icon: 'none' })
      }
    } catch (error) {
      console.error('[内容详情] 加载失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const title = detail?.title || detail?.name || detail?.real_name || ''
  const cover =
    contentType === 'talent'
      ? detail?.photo_url
      : detail?.cover_image || detail?.image_url || ''
  const html =
    contentType === 'article' || contentType === 'business'
      ? detail?.content
      : contentType === 'talent'
        ? null
        : detail?.description

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const goRegister = async () => {
    if (!detail?.id) return
    const memberId = Taro.getStorageSync('member_id')
    if (!memberId) {
      Taro.showToast({ title: '请先登录后报名', icon: 'none' })
      return
    }
    const fields = detail.form_fields
    const hasFields = Array.isArray(fields)
      ? fields.length > 0
      : typeof fields === 'string' && fields !== '[]' && fields !== 'null'
    if (hasFields) {
      Taro.switchTab({ url: '/pages/discover/index' })
      Taro.showToast({ title: '请在发现页完善报名信息', icon: 'none' })
      return
    }
    try {
      const response = await Network.request({
        url: `/api/events/${detail.id}/register`,
        method: 'POST',
        data: {},
      })
      Taro.showToast({
        title: response.data?.code === 200 ? '报名成功' : (response.data?.msg || '报名失败'),
        icon: response.data?.code === 200 ? 'success' : 'none',
      })
    } catch (error) {
      console.error('[内容详情] 报名失败:', error)
      Taro.showToast({ title: '报名失败', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-full bg-[#F5F6FA]">
        <Text className="block text-sm text-gray-400">加载中...</Text>
      </View>
    )
  }

  if (!detail) {
    return (
      <View className="flex items-center justify-center h-full bg-[#F5F6FA]">
        <Text className="block text-sm text-gray-400">暂无内容</Text>
      </View>
    )
  }

  const talentAvatar = detail.avatar_url || detail.member_avatar || detail.photo_url

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <ScrollView scrollY className="flex-1">
        {isCloudStorageImageUrl(cover) && (
          <Image src={cover} mode="aspectFill" className="w-full aspect-video" />
        )}
        <View className="bg-white px-4 py-5 mb-3">
          {contentType === 'talent' ? (
            <View className="flex flex-row items-center gap-3 mb-3">
              {isCloudStorageImageUrl(talentAvatar) ? (
                <Image src={talentAvatar} mode="aspectFill" className="w-14 h-14 rounded-full" />
              ) : (
                <View className="w-14 h-14 rounded-full bg-[#1B2A4A] flex items-center justify-center">
                  <Text className="block text-white text-lg font-bold">{(title || '?')[0]}</Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="block text-xl font-bold text-[#1A1D2E]">{title}</Text>
                {detail.contact && (
                  <Text className="block text-sm text-gray-500 mt-1">{detail.contact}</Text>
                )}
              </View>
            </View>
          ) : (
            <>
              <View className="flex flex-row items-center gap-2 mb-2 flex-wrap">
                {(detail.category || detail.event_type) && (
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-[10px] px-2 py-0">
                    {CATEGORY_MAP[detail.category || detail.event_type] || detail.category || detail.event_type}
                  </Badge>
                )}
                {detail.stage && (
                  <Badge className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0">{detail.stage}</Badge>
                )}
              </View>
              <Text className="block text-xl font-bold text-[#1A1D2E] leading-relaxed">{title}</Text>
            </>
          )}

          {contentType === 'talent' && Array.isArray(detail.industry_tags) && (
            <View className="flex flex-row flex-wrap gap-2 mt-2">
              {detail.industry_tags.map((code: string) => (
                <Badge key={code} className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-2 py-0">
                  {industryMap[code] || code}
                </Badge>
              ))}
            </View>
          )}

          {detail.subtitle && (
            <Text className="block text-sm text-gray-500 mt-2">{detail.subtitle}</Text>
          )}
          {detail.summary && (
            <Text className="block text-sm text-gray-500 mt-2 leading-relaxed">{detail.summary}</Text>
          )}
          {contentType === 'event' && (
            <View className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-100">
              {detail.start_time && (
                <View className="flex flex-row items-center gap-2">
                  <Clock size={14} color="#6B7280" />
                  <Text className="block text-xs text-gray-500">{formatTime(detail.start_time)}</Text>
                </View>
              )}
              {detail.location && (
                <View className="flex flex-row items-center gap-2">
                  <MapPin size={14} color="#6B7280" />
                  <Text className="block text-xs text-gray-500">{detail.location}</Text>
                </View>
              )}
              <View className="flex flex-row items-center gap-2">
                <Users size={14} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  {detail.current_participants || 0}/{detail.max_participants || '∞'}人
                </Text>
              </View>
            </View>
          )}
        </View>

        <View className={`bg-white px-4 py-5 ${contentType === 'event' ? 'mb-24' : 'mb-8'}`}>
          <Text className="block text-base font-semibold text-[#1A1D2E] mb-3">
            {contentType === 'talent' ? '过往经历' : '详细内容'}
          </Text>
          {contentType === 'talent' ? (
            <>
              <Text className="block text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {detail.experience || '暂无经历介绍'}
              </Text>
              {isCloudStorageImageUrl(detail.card_image_url) && (
                <View className="mt-4">
                  <Text className="block text-sm font-semibold text-[#1A1D2E] mb-2">个人名片</Text>
                  <Image src={detail.card_image_url} mode="widthFix" className="w-full rounded-xl" />
                </View>
              )}
            </>
          ) : (
            <RichHtml html={html} />
          )}
        </View>
      </ScrollView>

      {contentType === 'event' && detail.status === 'open' && (
        <View
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            padding: '12px 16px',
            backgroundColor: '#fff',
            borderTop: '1px solid #e5e5e5',
            zIndex: 100,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button className="w-full bg-[#1B2A4A] text-white rounded-xl" onClick={goRegister}>
              <Text>立即报名</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

export default ContentDetailPage
