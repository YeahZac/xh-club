import { useState } from 'react'
import { View, Text, ScrollView, Image, Textarea, Input } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { Clock, MapPin, Users, Eye } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RichHtml } from '@/components/rich-html'
import { isDisplayableImageUrl } from '@/lib/media-url'
import { Network } from '@/network'

type ContentType = 'article' | 'project' | 'event' | 'business' | 'talent'

interface FormField {
  label: string
  type: string
  required?: boolean
  options?: string[]
}

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

const STATUS_MAP: Record<string, string> = {
  open: '报名中',
  closed: '已结束',
  cancelled: '已取消',
  draft: '草稿',
  published: '已发布',
  active: '进行中',
  funded: '已融资',
  pending: '待审核',
  approved: '已通过',
  rejected: '未通过',
}

const formatDetailTime = (dateStr?: string | null) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return String(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

const parseFormFields = (value: unknown): FormField[] => {
  if (!value) return []
  if (Array.isArray(value)) return value as FormField[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

const scoreKey = (projectId: string | number, dimensionId: string | number) =>
  `${projectId}:${dimensionId}`

const StarPicker = ({
  value,
  onChange,
}: {
  value: number
  onChange: (stars: number) => void
}) => (
  <View className="flex flex-row gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <View key={star} onClick={() => onChange(star)}>
        <Text className={`block text-xl ${star <= value ? 'text-[#C9A96E]' : 'text-gray-300'}`}>★</Text>
      </View>
    ))}
  </View>
)

const ContentDetailPage = () => {
  const [contentType, setContentType] = useState<ContentType>('article')
  const [contentId, setContentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Record<string, any> | null>(null)
  const [industryMap, setIndustryMap] = useState<Record<string, string>>({})
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerAnswers, setRegisterAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [scoreDraft, setScoreDraft] = useState<Record<string, number>>({})

  useLoad((query) => {
    const type = (query?.type || 'article') as ContentType
    const id = String(query?.id || '')
    setContentType(type)
    setContentId(id)
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

  const initScoreDraft = (payload: Record<string, any>) => {
    const next: Record<string, number> = {}
    const myScores = payload?.member_state?.my_scores || []
    myScores.forEach((item: any) => {
      next[scoreKey(item.project_id, item.dimension_id)] = Number(item.stars) || 0
    })
    setScoreDraft(next)
  }

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
        if (payload.category === 'roadshow') {
          initScoreDraft(payload)
        }
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
      : contentType === 'event'
        ? ([detail?.description, detail?.content].find(
            (v) => typeof v === 'string' && v.trim() && v.trim() !== '<p><br></p>',
          ) || '')
        : contentType === 'talent'
          ? null
          : detail?.description

  const eventSignupCount = contentType === 'event'
    ? Number(
      detail?.current_participants
      ?? (Array.isArray(detail?.registrations) ? detail.registrations.length : 0)
      ?? 0,
    )
    : 0
  const isRoadshow = contentType === 'business' && detail?.category === 'roadshow'
  const memberState = detail?.member_state || {}
  const roadshowProjects = Array.isArray(detail?.roadshow_projects) ? detail.roadshow_projects : []
  const scoreDimensions = Array.isArray(detail?.score_dimensions) ? detail.score_dimensions : []
  const formFields = parseFormFields(detail?.form_fields)

  const ensureLoggedIn = () => {
    const memberId = Taro.getStorageSync('member_id')
    const token = Taro.getStorageSync('member_token')
    if (!memberId || !token) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return false
    }
    return true
  }

  const openRoadshowRegister = () => {
    if (!ensureLoggedIn()) return
    if (formFields.length > 0) {
      setRegisterAnswers({})
      setRegisterOpen(true)
      return
    }
    submitRoadshowRegister({})
  }

  const submitRoadshowRegister = async (answers: Record<string, string>) => {
    if (!detail?.id || !ensureLoggedIn()) return
    setSubmitting(true)
    try {
      const response = await Network.request({
        url: `/api/business/${detail.id}/register`,
        method: 'POST',
        data: { form_answers: answers },
      })
      const ok = response.data?.code === 200
      Taro.showToast({
        title: ok ? '报名成功' : (response.data?.msg || '报名失败'),
        icon: ok ? 'success' : 'none',
      })
      if (ok) {
        setRegisterOpen(false)
        await loadDetail(contentType, contentId)
      }
    } catch (error) {
      console.error('[路演报名] 失败:', error)
      Taro.showToast({ title: '报名失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const submitRoadshowScores = async () => {
    if (!detail?.id || !ensureLoggedIn()) return
    const scores = Object.entries(scoreDraft)
      .filter(([, stars]) => stars > 0)
      .map(([key, stars]) => {
        const [projectId, dimensionId] = key.split(':')
        return { project_id: projectId, dimension_id: dimensionId, stars }
      })
    if (!scores.length) {
      Taro.showToast({ title: '请先完成评分', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const response = await Network.request({
        url: `/api/business/${detail.id}/scores`,
        method: 'POST',
        data: { scores },
      })
      const ok = response.data?.code === 200
      Taro.showToast({
        title: ok ? '评分已提交' : (response.data?.msg || '提交失败'),
        icon: ok ? 'success' : 'none',
      })
      if (ok) {
        await loadDetail(contentType, contentId)
      }
    } catch (error) {
      console.error('[路演评分] 失败:', error)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const goRegister = async () => {
    if (!detail?.id) return
    if (!ensureLoggedIn()) return
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
  const showRoadshowBar = isRoadshow && (memberState.can_register || memberState.can_score)
  const bottomPadding = contentType === 'event' || showRoadshowBar ? 'mb-24' : 'mb-8'

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <ScrollView scrollY className="flex-1">
        {isDisplayableImageUrl(cover) && (
          <Image src={cover} mode="aspectFill" className="w-full aspect-video" />
        )}

        {contentType === 'event' && (
          <View className="bg-[#1B2A4A] px-3.5 py-2.5 flex flex-row items-center justify-between">
            <View className="flex flex-row items-center gap-1.5">
              <Users size={14} color="#E8D5A8" />
              <Text className="block text-xs text-white">当前报名人数</Text>
            </View>
            <Text className="block text-sm font-bold text-[#E8D5A8]">
              {eventSignupCount}{detail.max_participants ? ` / ${detail.max_participants}` : ''} 人
            </Text>
          </View>
        )}

        <View className="bg-white px-3.5 py-3.5 mb-2">
          {contentType === 'talent' ? (
            <View className="flex flex-row items-center gap-2.5 mb-2">
              {isDisplayableImageUrl(talentAvatar) ? (
                <Image src={talentAvatar} mode="aspectFill" className="w-12 h-12 rounded-full" />
              ) : (
                <View className="w-12 h-12 rounded-full bg-[#1B2A4A] flex items-center justify-center">
                  <Text className="block text-white text-base font-bold">{(title || '?')[0]}</Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="block text-base font-bold text-[#1A1D2E]">{title}</Text>
                {detail.contact && (
                  <Text className="block text-xs text-gray-500 mt-0.5">{detail.contact}</Text>
                )}
              </View>
            </View>
          ) : (
            <>
              <View className="flex flex-row items-center gap-1.5 mb-1.5 flex-wrap">
                {(detail.category || detail.event_type) && (
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs font-medium px-2 py-0.5">
                    {CATEGORY_MAP[detail.category || detail.event_type] || detail.category || detail.event_type}
                  </Badge>
                )}
                {detail.stage && (
                  <Badge className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0">{detail.stage}</Badge>
                )}
              </View>
              <Text className="block text-base font-bold text-[#1A1D2E] leading-snug">{title}</Text>
            </>
          )}

          {contentType === 'talent' && Array.isArray(detail.industry_tags) && (
            <View className="flex flex-row flex-wrap gap-1.5 mt-1.5">
              {detail.industry_tags.map((code: string) => (
                <Badge key={code} className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">
                  {industryMap[code] || code}
                </Badge>
              ))}
            </View>
          )}

          {detail.subtitle && (
            <Text className="block text-xs text-gray-500 mt-1.5">{detail.subtitle}</Text>
          )}
          {detail.summary && (
            <Text className="block text-xs text-gray-500 mt-1.5 leading-relaxed">{detail.summary}</Text>
          )}

          {/* 通用元信息：发布时间 / 开始时间 / 浏览 / 状态 */}
          <View className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-gray-100">
            {(detail.created_at || detail.published_at) && (
              <View className="flex flex-row items-center gap-1.5">
                <Clock size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  发布时间：{formatDetailTime(detail.published_at || detail.created_at)}
                </Text>
              </View>
            )}
            {detail.start_time && (
              <View className="flex flex-row items-center gap-1.5">
                <Clock size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  开始时间：{formatDetailTime(detail.start_time)}
                </Text>
              </View>
            )}
            {detail.end_time && (isRoadshow || contentType === 'event') && (
              <View className="flex flex-row items-center gap-1.5">
                <Clock size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  结束时间：{formatDetailTime(detail.end_time)}
                </Text>
              </View>
            )}
            {typeof detail.view_count !== 'undefined' && detail.view_count !== null && (
              <View className="flex flex-row items-center gap-1.5">
                <Eye size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  浏览次数：{detail.view_count || 0}
                </Text>
              </View>
            )}
            {contentType === 'event' && detail.status && (
              <View className="flex flex-row items-center gap-1.5">
                <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">
                  状态：{STATUS_MAP[detail.status] || detail.status}
                </Badge>
              </View>
            )}
            {contentType === 'event' && detail.location && (
              <View className="flex flex-row items-center gap-1.5">
                <MapPin size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">{detail.location}</Text>
              </View>
            )}
            {contentType === 'event' && (
              <View className="flex flex-row items-center gap-1.5">
                <Users size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  报名人数：{eventSignupCount}/{detail.max_participants || '∞'}人
                </Text>
              </View>
            )}
            {isRoadshow && (
              <View className="flex flex-row items-center gap-1.5">
                <Users size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  已报名 {detail.registration_count || 0} 人
                  {memberState.is_registered ? ' · 您已报名' : ''}
                </Text>
              </View>
            )}
            {contentType === 'business' && (detail.category === 'financing' || detail.category === 'resource') && (
              <>
                {detail.contact_phone && (
                  <View className="flex flex-row items-center gap-1.5">
                    <Text className="block text-xs text-gray-500">电话：{detail.contact_phone}</Text>
                  </View>
                )}
                {detail.demand_talent_name && (
                  <View className="flex flex-row items-center gap-1.5">
                    <Text className="block text-xs text-gray-500">需求方：{detail.demand_talent_name}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {isRoadshow && roadshowProjects.length > 0 && (
          <View className="bg-white px-3.5 py-3.5 mb-2">
            <Text className="block text-sm font-semibold text-[#1A1D2E] mb-2.5">参与路演项目</Text>
            <View className="flex flex-col gap-2.5">
              {roadshowProjects.map((project: any) => (
                <View key={project.project_id} className="border border-gray-100 rounded-xl overflow-hidden">
                  {isDisplayableImageUrl(project.cover_image) && (
                    <Image src={project.cover_image} mode="aspectFill" className="w-full aspect-video" />
                  )}
                  <View className="p-3">
                    <Text className="block text-sm font-semibold text-[#1A1D2E]">{project.title}</Text>
                    {memberState.can_score && scoreDimensions.map((dimension: any) => (
                      <View key={dimension.id} className="mt-2">
                        <Text className="block text-xs text-gray-500 mb-1">{dimension.name}</Text>
                        <StarPicker
                          value={scoreDraft[scoreKey(project.project_id, dimension.id)] || 0}
                          onChange={(stars) =>
                            setScoreDraft((prev) => ({
                              ...prev,
                              [scoreKey(project.project_id, dimension.id)]: stars,
                            }))
                          }
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className={`bg-white px-3.5 py-3.5 ${bottomPadding}`}>
          <Text className="block text-sm font-semibold text-[#1A1D2E] mb-2.5">
            {contentType === 'talent' ? '过往经历' : contentType === 'event' ? '活动详情' : '详细内容'}
          </Text>
          {contentType === 'talent' ? (
            <>
              <Text className="block text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {detail.experience || '暂无经历介绍'}
              </Text>
              {isDisplayableImageUrl(detail.card_image_url) && (
                <View className="mt-3">
                  <Text className="block text-sm font-semibold text-[#1A1D2E] mb-2">个人名片</Text>
                  <Image src={detail.card_image_url} mode="widthFix" className="w-full rounded-xl" />
                </View>
              )}
            </>
          ) : (
            <RichHtml
              html={html}
              className="text-xs"
              emptyText={contentType === 'event' ? '暂无活动图文详情，请在后台活动管理中完善' : '暂无内容'}
            />
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

      {showRoadshowBar && (
        <View
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#fff',
            borderTop: '1px solid #e5e5e5',
            zIndex: 100,
          }}
        >
          {memberState.can_register && (
            <View style={{ flex: 1 }}>
              <Button className="w-full bg-[#1B2A4A] text-white rounded-xl" onClick={openRoadshowRegister}>
                <Text>立即报名</Text>
              </Button>
            </View>
          )}
          {memberState.can_score && (
            <View style={{ flex: 1 }}>
              <Button className="w-full bg-[#C9A96E] text-white rounded-xl" onClick={submitRoadshowScores}>
                <Text>{submitting ? '提交中...' : '提交评分'}</Text>
              </Button>
            </View>
          )}
        </View>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>路演报名</DialogTitle>
          </DialogHeader>
          <View className="flex flex-col gap-3 py-2">
            {formFields.map((field) => (
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
                      style={{ width: '100%', minHeight: '80px', backgroundColor: 'transparent' }}
                      value={registerAnswers[field.label] || ''}
                      onInput={(e) =>
                        setRegisterAnswers((prev) => ({ ...prev, [field.label]: e.detail.value }))
                      }
                    />
                  </View>
                ) : (
                  <View className="rounded-md border border-input bg-background px-3 py-2">
                    <Input
                      className="w-full bg-transparent"
                      style={{ width: '100%', backgroundColor: 'transparent' }}
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={registerAnswers[field.label] || ''}
                      onInput={(e) =>
                        setRegisterAnswers((prev) => ({ ...prev, [field.label]: e.detail.value }))
                      }
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
          <DialogFooter>
            <Button
              className="w-full bg-[#1B2A4A] text-white rounded-xl"
              disabled={submitting}
              onClick={() => submitRoadshowRegister(registerAnswers)}
            >
              <Text>{submitting ? '提交中...' : '确认报名'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}

export default ContentDetailPage
