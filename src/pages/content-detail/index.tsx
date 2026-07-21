import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Image, Button as TaroButton } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useShareAppMessage } from '@tarojs/taro'
import { Clock, MapPin, Users, Eye } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { RichHtml } from '@/components/rich-html'
import { PageShell, SoftCard } from '@/components/brand-ui'
import { isDisplayableImageUrl } from '@/lib/media-url'
import { maskPhone } from '@/lib/mask-phone'
import { useMediaRefresh } from '@/lib/use-media-refresh'
import { Network } from '@/network'
import { ensureLogin } from '@/lib/auth'
import { openRegisterPage } from '@/lib/register-form'

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

const scoreKey = (projectId: string | number, dimensionId: string | number) =>
  `${projectId}:${dimensionId}`

const StarPicker = ({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (stars: number) => void
  disabled?: boolean
}) => (
  <View className="flex flex-row gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <View key={star} onClick={() => !disabled && onChange(star)}>
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
  const [submitting, setSubmitting] = useState(false)
  const [scoreDraft, setScoreDraft] = useState<Record<string, number>>({})
  const [projectScoreDraft, setProjectScoreDraft] = useState<Record<string, number>>({})
  const [scoreOpen, setScoreOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const skipFirstShowRef = useRef(true)
  const loadDetailSeq = useRef(0)

  const initRoadshowScoreDraft = (payload: Record<string, any>) => {
    const next: Record<string, number> = {}
    const myScores = payload?.member_state?.my_scores || []
    myScores.forEach((item: any) => {
      next[scoreKey(item.project_id, item.dimension_id)] = Number(item.stars) || 0
    })
    setScoreDraft(next)
  }

  const initProjectScoreDraft = (payload: Record<string, any>) => {
    const next: Record<string, number> = {}
    ;(payload?.member_state?.my_scores || []).forEach((item: any) => {
      next[String(item.dimension_id)] = Number(item.stars) || 0
    })
    setProjectScoreDraft(next)
  }

  const loadDetail = async (type: ContentType, id: string, options?: { silent?: boolean }) => {
    if (!id) {
      setLoading(false)
      return
    }
    const seq = ++loadDetailSeq.current
    if (!options?.silent) setLoading(true)
    try {
      const urlMap: Record<ContentType, string> = {
        article: `/api/articles/${id}`,
        project: `/api/projects/${id}`,
        event: `/api/events/${id}`,
        business: `/api/business/${id}`,
        talent: `/api/talents/${id}`,
      }
      const requestUrl = urlMap[type]
      if (!requestUrl) {
        throw new Error(`不支持的内容类型: ${type}`)
      }
      const res = await Network.request({ url: requestUrl })
      if (seq !== loadDetailSeq.current) return
      console.log('[内容详情]', type, res?.data)
      const payload = unwrapDetail(res?.data?.data ?? res?.data)
      if (payload) {
        setDetail(payload)
        if (payload.category === 'roadshow') {
          initRoadshowScoreDraft(payload)
        }
        if (type === 'project') {
          initProjectScoreDraft(payload)
        }
      } else if (!options?.silent) {
        Taro.showToast({ title: '内容不存在', icon: 'none' })
      }
    } catch (error) {
      console.error('[内容详情] 加载失败:', error)
      if (!options?.silent) {
        Taro.showToast({ title: '加载失败', icon: 'none' })
      }
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }

  useShareAppMessage(() => ({
    title: detail?.title || detail?.name || '星河百谷项目',
    path: `/pages/content-detail/index?type=${contentType}&id=${contentId}`,
    imageUrl: detail?.cover_image || undefined,
  }))


  useLoad((query) => {
    // 历史入口可能传 type=roadshow，统一映射为 business
    const rawType = String(query?.type || 'article')
    const type = (
      rawType === 'roadshow' ? 'business' : rawType
    ) as ContentType
    const id = String(query?.id || '')
    setContentType(type)
    setContentId(id)
    Taro.setNavigationBarTitle({ title: TYPE_TITLE[type] || '详情' })
    if (type === 'talent') {
      Network.request({ url: '/api/industries' }).then((res) => {
        const map: Record<string, string> = {}
        const list = Array.isArray(res?.data?.data) ? res.data.data : []
        list.forEach((item: any) => {
          if (item?.code) map[item.code] = item.name || item.code
        })
        setIndustryMap(map)
      }).catch(() => undefined)
    }
    void loadDetail(type, id)
  })

  useDidShow(() => {
    if (skipFirstShowRef.current) {
      skipFirstShowRef.current = false
      return
    }
    if (contentType && contentId) {
      void loadDetail(contentType, contentId, { silent: true })
    }
  })

  useMediaRefresh(() => {
    if (contentType && contentId) {
      return loadDetail(contentType, contentId, { silent: true })
    }
  }, { skipFirstShow: true })

  const title = detail?.title || detail?.name || detail?.real_name || ''
  // 人才详情顶部横图：仅展示名片；无名片则不展示顶部图片
  const cover =
    contentType === 'talent'
      ? (isDisplayableImageUrl(detail?.card_image_url) ? detail.card_image_url : '')
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
      ?? detail?.registration_count
      ?? (Array.isArray(detail?.registrations) ? detail.registrations.length : 0)
      ?? 0,
    )
    : 0
  const isRoadshow = contentType === 'business' && detail?.category === 'roadshow'
  const memberState = detail?.member_state || {}
  const roadshowProjects = Array.isArray(detail?.roadshow_projects) ? detail.roadshow_projects : []
  const scoreDimensions = Array.isArray(detail?.score_dimensions) ? detail.score_dimensions : []

  const openRoadshowRegister = async () => {
    if (!detail?.id) return
    await openRegisterPage({
      kind: 'roadshow',
      id: detail.id,
      title: detail.title || detail.name,
    })
  }

  const submitRoadshowScores = async () => {
    if (!detail?.id || !(await ensureLogin())) return
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
    await openRegisterPage({
      kind: 'event',
      id: detail.id,
      title: detail.title || detail.name,
    })
  }

  const openProjectScore = async () => {
    if (!(await ensureLogin())) return
    if (detail?.member_state?.has_scored) {
      Taro.showToast({ title: '您已评分，不能再次评分', icon: 'none' })
      return
    }
    if (!(detail?.score_dimensions || []).length) {
      Taro.showToast({ title: '该项目暂未开放评分', icon: 'none' })
      return
    }
    setScoreOpen(true)
  }

  const submitProjectScores = async () => {
    if (!detail?.id || !(await ensureLogin())) return
    const dimensions = Array.isArray(detail.score_dimensions) ? detail.score_dimensions : []
    const scores = dimensions.map((dim: any) => ({
      dimension_id: dim.id,
      stars: Number(projectScoreDraft[String(dim.id)] || 0),
    }))
    if (scores.some((item) => !item.stars)) {
      Taro.showToast({ title: '请完成全部评分维度', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const response = await Network.request({
        url: `/api/projects/${detail.id}/scores`,
        method: 'POST',
        data: { scores },
      })
      const ok = response.data?.code === 200
      Taro.showToast({
        title: ok ? '评分成功' : (response.data?.msg || '提交失败'),
        icon: ok ? 'success' : 'none',
      })
      if (ok) {
        setScoreOpen(false)
        await loadDetail(contentType, contentId)
      }
    } catch (error) {
      console.error('[项目评分] 失败:', error)
      Taro.showToast({ title: (error as any)?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const openProjectShare = async () => {
    if (!(await ensureLogin())) return
    setShareOpen(true)
  }

  const shareToAllTalents = async () => {
    if (!detail?.id) return
    const ok = await Taro.showModal({
      title: '分享给入驻人才',
      content: '将向平台全部已入驻人才发送项目通知，是否继续？',
    })
    if (!ok.confirm) return
    setSubmitting(true)
    try {
      const response = await Network.request({
        url: `/api/projects/${detail.id}/share-talents`,
        method: 'POST',
      })
      const okRes = response.data?.code === 200
      const count = response.data?.data?.count
      Taro.showToast({
        title: okRes
          ? (count ? `已通知 ${count} 位人才` : (response.data?.msg || '分享成功'))
          : (response.data?.msg || '分享失败'),
        icon: okRes ? 'success' : 'none',
      })
      if (okRes) setShareOpen(false)
    } catch (error) {
      Taro.showToast({ title: (error as any)?.message || '分享失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <View className="flex min-h-screen items-center justify-center">
          <Text className="block text-sm text-[#98A2B3]">加载中...</Text>
        </View>
      </PageShell>
    )
  }

  if (!detail) {
    return (
      <PageShell>
        <View className="flex min-h-screen items-center justify-center">
          <Text className="block text-sm text-[#98A2B3]">暂无内容</Text>
        </View>
      </PageShell>
    )
  }

  const talentAvatar = detail.photo_url || detail.avatar_url || detail.member_avatar
  const eventRegistered = contentType === 'event' && !!memberState.is_registered
  const roadshowRegistered = isRoadshow && !!memberState.is_registered
  const showRoadshowBar = isRoadshow && (memberState.can_register || memberState.can_score || roadshowRegistered)
  const showProjectBar = contentType === 'project'
  const projectDimensions = Array.isArray(detail?.score_dimensions) ? detail.score_dimensions : []
  const bottomPadding =
    contentType === 'event' || showRoadshowBar || showProjectBar ? 'mb-24' : 'mb-8'
  const projectBodyText = contentType === 'project'
    ? String(detail?.description || detail?.content || '').trim()
    : ''
  const projectBodyIsPlain = projectBodyText && !/<[a-z][\s\S]*>/i.test(projectBodyText)

  return (
    <PageShell scroll={false}>
      <ScrollView scrollY className="flex-1">
        <View className="px-4 pt-4">
          {isDisplayableImageUrl(cover) && (
            <Image
              key={cover}
              src={cover}
              mode="aspectFill"
              className="w-full rounded-3xl aspect-video"
            />
          )}
        </View>

        {contentType === 'event' && (
          <View className="mx-4 mt-3 flex flex-row items-center justify-between rounded-2xl bg-[#172033] px-4 py-3">
            <View className="flex flex-row items-center gap-2">
              <Users size={14} color="#E8D5A8" />
              <Text className="block text-xs text-white">当前报名人数</Text>
            </View>
            <Text className="block text-sm font-bold text-[#E8D5A8]">
              {eventSignupCount}{detail.max_participants ? ` / ${detail.max_participants}` : ''} 人
            </Text>
          </View>
        )}

        <SoftCard className="mx-4 mt-3 px-4 py-4">
          {contentType === 'talent' ? (
            <View className="mb-2 flex flex-row items-start gap-3">
              {isDisplayableImageUrl(talentAvatar) ? (
                <Image src={talentAvatar} mode="aspectFill" className="h-28 w-24 rounded-xl" />
              ) : (
                <View className="flex h-28 w-24 items-center justify-center rounded-xl bg-[#1B2A4A]">
                  <Text className="block text-xl font-bold text-white">{(title || '?')[0]}</Text>
                </View>
              )}
              <View className="flex-1">
                <View className="flex flex-row flex-wrap items-center gap-2">
                  <Text className="block text-base font-bold text-[#1A1D2E]">{title}</Text>
                  {detail.membership_active && detail.membership_badge ? (
                    <Badge className="bg-[#FFF8E8] px-2 py-0 text-xs text-[#C8A96A]">
                      {detail.membership_badge}
                    </Badge>
                  ) : null}
                </View>
                {detail.job_title ? (
                  <Text className="mt-1 block text-xs text-[#334155]">{detail.job_title}</Text>
                ) : null}
                {detail.company_name ? (
                  <Text className="mt-1 block text-xs text-gray-600 whitespace-pre-wrap">
                    {detail.company_name}
                  </Text>
                ) : null}
                {detail.department_text ? (
                  <Text className="mt-1 block text-xs text-[#2457A7]">
                    部门职位：{detail.department_text}
                  </Text>
                ) : Array.isArray(detail.departments) && detail.departments.length > 0 ? (
                  <Text className="mt-1 block text-xs text-[#2457A7]">
                    部门职位：
                    {detail.departments
                      .map((d: any) => [d.department_name, d.position].filter(Boolean).join(' · '))
                      .filter(Boolean)
                      .join('；')}
                  </Text>
                ) : null}
                {detail.contact && (
                  <Text className="mt-1 block text-xs text-gray-500">
                    手机号：{maskPhone(detail.contact)}
                  </Text>
                )}
                {!detail.contact && detail.phone && (
                  <Text className="mt-1 block text-xs text-gray-500">
                    手机号：{maskPhone(detail.phone)}
                  </Text>
                )}
                {detail.membership_active && detail.payment_expire_at ? (
                  <Text className="mt-1 block text-xs text-[#98A2B3]">
                    会员有效期至 {String(detail.payment_expire_at).slice(0, 10)}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              <View className="mb-2 flex flex-row flex-wrap items-center gap-2">
                {(detail.category || detail.event_type) && (
                  <Badge className="bg-[#FFF8E8] px-2 py-1 text-xs font-medium text-[#C8A96A]">
                    {CATEGORY_MAP[detail.category || detail.event_type] || detail.category || detail.event_type}
                  </Badge>
                )}
                {detail.stage && (
                  <Badge className="bg-gray-100 px-2 py-0 text-xs text-gray-600">{detail.stage}</Badge>
                )}
              </View>
              <Text className="block text-base font-bold text-[#1A1D2E] leading-snug">{title}</Text>
              {contentType === 'project' ? (
                <Text className="mt-2 block text-xs text-[#B89452]">
                  {Number(detail.score_count || 0) > 0
                    ? `综合评分 ${Number(detail.avg_score || 0).toFixed(1)} · ${detail.score_count}人评`
                    : '暂无评分'}
                </Text>
              ) : null}
            </>
          )}

          {contentType === 'talent' && Array.isArray(detail.industry_tags) && (
            <View className="mt-2 flex flex-row flex-wrap gap-2">
              {detail.industry_tags.map((code: string) => (
                <Badge key={code} className="bg-[#FFF8E8] px-2 py-0 text-xs text-[#C8A96A]">
                  {industryMap[code] || code}
                </Badge>
              ))}
            </View>
          )}

          {contentType === 'talent' ? (
            <View className="mt-3 flex flex-row rounded-xl bg-[#F4F7FB] px-2 py-3">
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-[#10264A]">
                  {detail.member_days || 0}
                </Text>
                <Text className="mt-1 block text-center text-xs text-[#98A2B3]">注册天数</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-[#10264A]">
                  {detail.available_points || 0}
                </Text>
                <Text className="mt-1 block text-center text-xs text-[#98A2B3]">积分</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-[#10264A]">
                  {detail.deal_count || 0}
                </Text>
                <Text className="mt-1 block text-center text-xs text-[#98A2B3]">成交项目</Text>
              </View>
            </View>
          ) : null}

          {detail.subtitle && (
            <Text className="mt-2 block text-xs text-gray-500">{detail.subtitle}</Text>
          )}
          {detail.summary && (
            <Text className="mt-2 block text-xs leading-relaxed text-gray-500">{detail.summary}</Text>
          )}

          {/* 通用元信息：发布时间 / 开始时间 / 浏览 / 状态 */}
          <View className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
            {(detail.created_at || detail.published_at) && (
              <View className="flex flex-row items-center gap-2">
                <Clock size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  发布时间：{formatDetailTime(detail.published_at || detail.created_at)}
                </Text>
              </View>
            )}
            {detail.start_time && (
              <View className="flex flex-row items-center gap-2">
                <Clock size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  开始时间：{formatDetailTime(detail.start_time)}
                </Text>
              </View>
            )}
            {detail.end_time && (isRoadshow || contentType === 'event') && (
              <View className="flex flex-row items-center gap-2">
                <Clock size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  结束时间：{formatDetailTime(detail.end_time)}
                </Text>
              </View>
            )}
            {typeof detail.view_count !== 'undefined' && detail.view_count !== null && (
              <View className="flex flex-row items-center gap-2">
                <Eye size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  浏览次数：{detail.view_count || 0}
                </Text>
              </View>
            )}
            {contentType === 'event' && detail.status && (
              <View className="flex flex-row items-center gap-2">
                <Badge className="bg-[#FFF8E8] px-2 py-0 text-xs text-[#C8A96A]">
                  状态：{STATUS_MAP[detail.status] || detail.status}
                </Badge>
              </View>
            )}
            {contentType === 'event' && detail.location && (
              <View className="flex flex-row items-center gap-2">
                <MapPin size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">{detail.location}</Text>
              </View>
            )}
            {contentType === 'event' && (
              <View className="flex flex-row items-center gap-2">
                <Users size={12} color="#6B7280" />
                <Text className="block text-xs text-gray-500">
                  报名人数：{eventSignupCount}/{detail.max_participants || '∞'}人
                </Text>
              </View>
            )}
            {isRoadshow && (
              <View className="flex flex-row items-center gap-2">
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
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-gray-500">电话：{detail.contact_phone}</Text>
                  </View>
                )}
                {detail.demand_talent_name && (
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-gray-500">需求方：{detail.demand_talent_name}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </SoftCard>

        {isRoadshow && roadshowProjects.length > 0 && (
          <SoftCard className="mx-4 mt-3 px-4 py-4">
            <Text className="mb-3 block text-sm font-semibold text-[#172033]">参与路演项目</Text>
            <View className="flex flex-col gap-3">
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
          </SoftCard>
        )}

        <SoftCard className={`mx-4 mt-3 px-4 py-4 ${bottomPadding}`}>
          <Text className="mb-3 block text-sm font-semibold text-[#172033]">
            {contentType === 'talent' ? '过往经历' : contentType === 'event' ? '活动详情' : '详细内容'}
          </Text>
          {contentType === 'talent' ? (
            <>
              <Text className="block text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {detail.experience || '暂无经历介绍'}
              </Text>
            </>
          ) : contentType === 'project' && projectBodyIsPlain ? (
            <Text className="block text-base leading-7 text-[#334155] whitespace-pre-wrap">
              {projectBodyText || '暂无内容'}
            </Text>
          ) : (
            <RichHtml
              html={html}
              className={contentType === 'project' ? 'text-base leading-7' : 'text-sm leading-6'}
              emptyText={contentType === 'event' ? '暂无活动图文详情，请在后台活动管理中完善' : '暂无内容'}
            />
          )}
        </SoftCard>
      </ScrollView>

      {contentType === 'event' && (detail.status === 'open' || eventRegistered) && (
        <View
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #E8EDF5',
            zIndex: 100,
          }}
        >
          <View style={{ flex: 1 }}>
            {eventRegistered ? (
              <Button className="w-full rounded-2xl bg-[#E8EDF5] text-[#64748B]" disabled>
                <Text>已报名</Text>
              </Button>
            ) : (
              <Button className="w-full rounded-2xl bg-[#172033] text-white" onClick={goRegister}>
                <Text>立即报名</Text>
              </Button>
            )}
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
            backgroundColor: '#ffffff',
            borderTop: '1px solid #E8EDF5',
            zIndex: 100,
          }}
        >
          {(memberState.can_register || roadshowRegistered) && (
            <View style={{ flex: 1 }}>
              {roadshowRegistered ? (
                <Button className="w-full rounded-2xl bg-[#E8EDF5] text-[#64748B]" disabled>
                  <Text>已报名</Text>
                </Button>
              ) : (
                <Button className="w-full rounded-2xl bg-[#172033] text-white" onClick={openRoadshowRegister}>
                  <Text>立即报名</Text>
                </Button>
              )}
            </View>
          )}
          {memberState.can_score && (
            <View style={{ flex: 1 }}>
              <Button className="w-full rounded-2xl bg-[#C8A96A] text-white" onClick={submitRoadshowScores}>
                <Text>{submitting ? '提交中...' : '提交评分'}</Text>
              </Button>
            </View>
          )}
        </View>
      )}

      {showProjectBar && (
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
            backgroundColor: '#ffffff',
            borderTop: '1px solid #E8EDF5',
            zIndex: 100,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              className="w-full rounded-2xl bg-[#C8A96A] text-white"
              onClick={() => void openProjectScore()}
            >
              <Text>{memberState.has_scored ? '已评分' : '评分'}</Text>
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              className="w-full rounded-2xl bg-[#172033] text-white"
              onClick={() => void openProjectShare()}
            >
              <Text>分享</Text>
            </Button>
          </View>
        </View>
      )}

      <Sheet open={scoreOpen} onOpenChange={setScoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-white px-4 pb-8 pt-4">
          <SheetHeader>
            <SheetTitle>项目评分</SheetTitle>
          </SheetHeader>
          <Text className="mt-2 block text-xs text-[#98A2B3]">每个会员仅可评分一次，提交后不可修改</Text>
          <View className="mt-4 flex flex-col gap-4">
            {projectDimensions.map((dim: any) => (
              <View key={dim.id} className="flex flex-row items-center justify-between">
                <Text className="block text-sm text-[#172033]">{dim.name}</Text>
                <StarPicker
                  value={Number(projectScoreDraft[String(dim.id)] || 0)}
                  disabled={!!memberState.has_scored}
                  onChange={(stars) =>
                    setProjectScoreDraft((current) => ({ ...current, [String(dim.id)]: stars }))
                  }
                />
              </View>
            ))}
          </View>
          {!memberState.has_scored ? (
            <Button
              className="mt-6 w-full rounded-2xl bg-[#C8A96A] text-white"
              disabled={submitting}
              onClick={() => void submitProjectScores()}
            >
              <Text>{submitting ? '提交中...' : '提交评分'}</Text>
            </Button>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={shareOpen} onOpenChange={setShareOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-white px-4 pb-8 pt-4">
          <SheetHeader>
            <SheetTitle>分享项目</SheetTitle>
          </SheetHeader>
          <View className="mt-4 flex flex-col gap-3">
            {/* openType=share 必须用原生 button，UI Button(View) 无效 */}
            <TaroButton
              openType="share"
              className="m-0 flex w-full items-center justify-center rounded-2xl border-0 bg-[#07C160] py-3 text-sm font-medium text-white after:border-0"
              style={{ backgroundColor: '#07C160', color: '#ffffff', borderRadius: '16px' }}
              onClick={() => setShareOpen(false)}
            >
              分享给微信好友
            </TaroButton>
            <View className="rounded-2xl border border-[#E8EDF5] p-3">
              <Text className="mb-2 block text-sm font-semibold text-[#172033]">分享给入驻人才</Text>
              <Text className="mb-3 block text-xs leading-relaxed text-[#98A2B3]">
                将向平台全部已通过人才入驻审核的会员发送消息通知，对方可在「消息通知」中查看并打开项目详情。
              </Text>
              <Button
                className="w-full rounded-2xl bg-[#172033] text-white"
                disabled={submitting}
                onClick={() => void shareToAllTalents()}
              >
                <Text className="block">{submitting ? '发送中...' : '分享给全部入驻人才'}</Text>
              </Button>
            </View>
          </View>
        </SheetContent>
      </Sheet>
    </PageShell>
  )
}

export default ContentDetailPage
