import { useRef, useState } from 'react'
import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { useDetailPageShare } from '@/lib/mini-program-share'
import { Clock, MapPin, Users, Eye, FileText } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichHtml } from '@/components/rich-html'
import { HtmlDetailFrame } from '@/components/html-detail-frame'
import {
  brandColors,
  CoverThumb,
  FixedBottomBar,
  icon,
  ListThumb,
  MetaRow,
  PageShell,
  SoftCard,
} from '@/components/brand-ui'
import { isDisplayableImageUrl } from '@/lib/media-url'
import { maskPhone } from '@/lib/mask-phone'
import { useMediaRefresh } from '@/lib/use-media-refresh'
import { Network } from '@/network'
import { ensureLogin, getMemberSession, isLoggedIn } from '@/lib/auth'
import { ensurePromoterOrMemberUnit } from '@/lib/member-access'
import { openRegisterPage } from '@/lib/register-form'
import { formatProjectStage } from '@/lib/project-stage'
import { previewRemoteDocument, isPdfUrl } from '@/lib/open-document'
import { isFullHtmlDocument, type HtmlRenderType } from '@/lib/rich-html'
import { userCategoryLabel } from '@/lib/user-category'

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
  financing: '商业需求',
  resource: '资源需求',
  life: '生活需求',
  other: '其他活动',
  salon: '专题沙龙',
  annual: '年度大会',
  training: '培训',
  meeting: '定期例会',
}

const STATUS_MAP: Record<string, string> = {
  open: '报名中',
  full: '已满员',
  ended: '已结束',
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

interface BusinessComment {
  id: string | number
  member_id?: string | number
  member_name?: string
  member_avatar?: string
  content: string
  created_at?: string
  parent_id?: string | number | null
  replies?: BusinessComment[]
}

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
        <Text className={`block text-xl ${star <= value ? 'text-accent-foreground' : 'text-muted'}`}>★</Text>
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
  const [h5Surface, setH5Surface] = useState<'loading' | 'webview' | 'fallback'>('loading')
  const [businessComments, setBusinessComments] = useState<BusinessComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
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

  const loadBusinessComments = async (businessId: string) => {
    setCommentsLoading(true)
    try {
      const res = await Network.request({ url: `/api/business/${businessId}/comments` })
      const list = Array.isArray(res?.data?.data) ? res.data.data : []
      setBusinessComments(list)
    } catch (error) {
      console.warn('[商机评论] 加载失败:', error)
      setBusinessComments([])
    } finally {
      setCommentsLoading(false)
    }
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
          setBusinessComments([])
          setReplyTarget(null)
          setCommentText('')
        } else if (type === 'business') {
          void loadBusinessComments(id)
        } else {
          setBusinessComments([])
          setReplyTarget(null)
          setCommentText('')
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

  useDetailPageShare(() => ({
    title: detail?.title || detail?.name || '星河百谷',
    path: `/pages/content-detail/index?type=${contentType}&id=${contentId}`,
    query: `type=${encodeURIComponent(contentType || '')}&id=${encodeURIComponent(contentId || '')}`,
    imageUrl: detail?.cover_image || detail?.image_url || detail?.photo_url || undefined,
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
      : contentType === 'event' || contentType === 'project'
        ? ([detail?.description, detail?.content].find(
            (v) => typeof v === 'string' && v.trim() && v.trim() !== '<p><br></p>',
          ) || '')
        : contentType === 'talent'
          ? detail?.experience
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
  const isBusinessCommentable = contentType === 'business' && !isRoadshow
  const memberState = detail?.member_state || {}
  const session = getMemberSession()
  const isSelfTalent =
    contentType === 'talent'
    && session?.memberId
    && String(detail?.member_id || '') === String(session.memberId)
  const roadshowProjects = Array.isArray(detail?.roadshow_projects) ? detail.roadshow_projects : []
  const scoreDimensions = Array.isArray(detail?.score_dimensions) ? detail.score_dimensions : []
  const roadshowScoreSummary = detail?.score_summary
  const roadshowRegistered = isRoadshow && !!memberState.is_registered
  const canViewRoadshowResults = isRoadshow && !!memberState.can_view_results
  const roadshowScoringPhase = String(memberState.scoring_phase || '')
  const showRoadshowScoring = isRoadshow && !!memberState.can_score
  const showRoadshowBar = isRoadshow && (
    memberState.can_register
    || roadshowRegistered
    || memberState.can_score
    || canViewRoadshowResults
  )

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
    if (!detail?.member_state?.can_score) {
      Taro.showToast({ title: '当前不在评分时间或未报名', icon: 'none' })
      return
    }
    if (!roadshowProjects.length || !scoreDimensions.length) {
      Taro.showToast({ title: '暂无可评分项目', icon: 'none' })
      return
    }
    const scores: Array<{ project_id: string; dimension_id: string; stars: number }> = []
    for (const project of roadshowProjects) {
      for (const dimension of scoreDimensions) {
        const key = `${project.id}:${dimension.id}`
        const stars = Number(scoreDraft[key] || 0)
        if (stars <= 0) {
          Taro.showToast({ title: '请完成全部评分项', icon: 'none' })
          return
        }
        scores.push({
          project_id: String(project.id),
          dimension_id: String(dimension.id),
          stars,
        })
      }
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
      const msg = String((error as any)?.message || '')
      if (!msg || /fail|error|network/i.test(msg)) {
        Taro.showToast({ title: '提交失败', icon: 'none' })
      }
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

  const goProjectScore = async () => {
    if (!(await ensureLogin())) return
    if (detail?.member_state?.has_scored) {
      Taro.showToast({ title: '您已评分，不能再次评分', icon: 'none' })
      return
    }
    const query = [
      `projectId=${encodeURIComponent(contentId)}`,
      `title=${encodeURIComponent(detail?.title || '')}`,
    ]
    await Taro.navigateTo({ url: `/pages/project-score/index?${query.join('&')}` })
  }

  const goProjectShare = async () => {
    if (!(await ensureLogin())) return
    // 不把已签名的超长 cover URL 塞进页面参数（易超 navigateTo 长度限制，导致丢参）
    const query = [
      `projectId=${encodeURIComponent(contentId)}`,
      `title=${encodeURIComponent(detail?.title || '')}`,
    ]
    await Taro.navigateTo({ url: `/pages/project-share/index?${query.join('&')}` })
  }

  const openDealApplication = async () => {
    if (!detail?.id || !(await ensureLogin('请先登录后申请成交记录'))) return
    const session = getMemberSession()
    const ownerId = detail.owner_member_id || detail.submitter_id
    if (session && ownerId && String(session.memberId) === String(ownerId)) {
      Taro.showToast({ title: '不能为自己发布的项目申请成交记录', icon: 'none' })
      return
    }
    if (!(await ensurePromoterOrMemberUnit('项目成交申请'))) return
    const query = [`project_id=${encodeURIComponent(String(detail.id))}`]
    if (ownerId) query.push(`owner_member_id=${encodeURIComponent(String(ownerId))}`)
    if (detail.title) query.push(`project_title=${encodeURIComponent(String(detail.title))}`)
    if (detail.owner_name) query.push(`owner_name=${encodeURIComponent(String(detail.owner_name))}`)
    await Taro.navigateTo({
      url: `/pages/deal-applications/form/index?${query.join('&')}`,
    })
  }

  if (loading) {
    return (
      <PageShell>
        <View className="flex min-h-screen items-center justify-center">
          <Text className="block text-sm text-muted-foreground">加载中...</Text>
        </View>
      </PageShell>
    )
  }

  if (!detail) {
    return (
      <PageShell>
        <View className="flex min-h-screen items-center justify-center">
          <Text className="block text-sm text-muted-foreground">暂无内容</Text>
        </View>
      </PageShell>
    )
  }

  const talentAvatar = detail.photo_url || detail.avatar_url || detail.member_avatar
  const eventRegistered = contentType === 'event' && !!memberState.is_registered
  const canRegisterEvent = contentType === 'event' && Boolean(memberState.can_register)
  const eventRegisterBlockedLabel =
    memberState.register_blocked_reason
    || (detail.status === 'ended' ? '已结束' : detail.status === 'full' ? '已满员' : detail.status === 'draft' ? '活动未开放' : '暂不可报名')
  const showProjectBar = contentType === 'project'
  const showBusinessCommentBar = isBusinessCommentable
  const bottomPadding =
    contentType === 'event' || showRoadshowBar || showProjectBar || showBusinessCommentBar
      ? 'mb-32 pb-8'
      : 'mb-8'
  const projectBodyText = contentType === 'project'
    ? String(detail?.description || detail?.content || '').trim()
    : ''
  const projectBodyIsPlain = projectBodyText && !/<[a-z][\s\S]*>/i.test(projectBodyText)
  const projectGallery = contentType === 'project' && Array.isArray(detail?.gallery_images)
    ? detail.gallery_images.filter((url: string) => isDisplayableImageUrl(url))
    : []
  const projectFiles = contentType === 'project' && Array.isArray(detail?.file_urls)
    ? detail.file_urls.filter((url: string) => Boolean(String(url || '').trim()))
    : []

  const previewGallery = (current: string) => {
    const urls = projectGallery.filter((url: string) => isDisplayableImageUrl(url))
    if (!urls.length) return
    Taro.previewImage({ current, urls })
  }

  const fileDisplayName = (url: string, index: number) => {
    const clean = String(url || '').split('?')[0]
    const name = clean.split('/').pop()
    return name || `附件 ${index + 1}`
  }

  const submitBusinessComment = async () => {
    if (!detail?.id || !isBusinessCommentable) return
    if (!(await ensureLogin())) return
    const text = commentText.trim()
    if (!text) {
      Taro.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    setCommentSubmitting(true)
    try {
      const res = await Network.request({
        url: `/api/business/${detail.id}/comments`,
        method: 'POST',
        data: {
          content: text,
          parent_id: replyTarget?.id || null,
        },
      })
      if (res?.data?.code === 200) {
        setCommentText('')
        setReplyTarget(null)
        Taro.showToast({ title: '已发送', icon: 'success' })
        await loadBusinessComments(String(detail.id))
      } else {
        Taro.showToast({ title: String(res?.data?.msg || '发送失败').slice(0, 40), icon: 'none' })
      }
    } catch (error) {
      console.error('[商机评论] 发送失败:', error)
      Taro.showToast({ title: '发送失败', icon: 'none' })
    } finally {
      setCommentSubmitting(false)
    }
  }

  const renderBusinessCommentItem = (item: BusinessComment, depth = 0) => (
    <View key={String(item.id)} className={depth > 0 ? 'mt-3 ml-4 border-l border-border pl-3' : ''}>
      <View className="flex flex-row items-start gap-2">
        <View className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
          <Text className="block text-xs font-semibold text-foreground">
            {(item.member_name || '?')[0]}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex flex-row items-center justify-between gap-2">
            <Text className="block text-sm font-medium text-foreground">{item.member_name || '用户'}</Text>
            <Text className="block text-xs text-muted-foreground">{formatDetailTime(item.created_at)}</Text>
          </View>
          <Text className="mt-1 block text-sm leading-relaxed text-foreground">{item.content}</Text>
          {depth === 0 ? (
            <Text
              className="mt-2 block text-xs text-primary"
              onClick={() => {
                if (!isLoggedIn()) {
                  void ensureLogin()
                  return
                }
                setReplyTarget({ id: String(item.id), name: item.member_name || '用户' })
              }}
            >
              回复
            </Text>
          ) : null}
        </View>
      </View>
      {(item.replies || []).map((reply) => renderBusinessCommentItem(reply, depth + 1))}
    </View>
  )

  const renderBusinessCommentBar = () => (
    <FixedBottomBar mode={bottomBarMode} className="flex-col gap-2">
      {replyTarget ? (
        <View className="flex flex-row items-center justify-between rounded-xl bg-muted px-3 py-2">
          <Text className="block text-xs text-muted-foreground">回复 {replyTarget.name}</Text>
          <Text className="block text-xs text-primary" onClick={() => setReplyTarget(null)}>取消</Text>
        </View>
      ) : null}
      <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
        <View className="min-w-0 flex-1 rounded-xl bg-field px-3 py-2">
          <Input
            style={{ width: '100%' }}
            value={commentText}
            placeholder={replyTarget ? '写下回复...' : '写下评论（仅文字）'}
            maxlength={500}
            onInput={(e) => setCommentText(e.detail.value)}
            onConfirm={() => void submitBusinessComment()}
          />
        </View>
        <Button
          variant="brand"
          size="sm"
          className="h-10 px-4"
          disabled={commentSubmitting || !commentText.trim()}
          onClick={() => void submitBusinessComment()}
        >
          <Text className="block text-xs text-primary-foreground">发送</Text>
        </Button>
      </View>
    </FixedBottomBar>
  )

  const h5RenderType: HtmlRenderType | null =
    contentType === 'article'
    || contentType === 'business'
    || contentType === 'event'
    || contentType === 'project'
    || contentType === 'talent'
      ? contentType
      : null
  /**
   * 人才详情：顶部保留原生资料卡，过往经历完整 H5 用下方 web-view 加载（不可整页替换）。
   * 其余类型：完整 H5 仍走整页 HtmlDetailFrame。
   */
  const talentSplitH5 = contentType === 'talent' && isFullHtmlDocument(html)
  // 路演商机需保留页内评分/报名区块，不走整页 H5 壳；人才走上下分栏
  const useEmbeddedFullH5 = Boolean(
    isFullHtmlDocument(html)
    && h5RenderType
    && !talentSplitH5
    && (contentType === 'project'
      || contentType === 'event'
      || contentType === 'article'
      || (contentType === 'business' && !isRoadshow)),
  )
  const showEventBar = contentType === 'event' && detail.status !== 'draft'
  /** web-view 成功时底栏由 html-render 注入；降级预览时仍用原生 FixedBottomBar */
  const showNativeBottomBar = !useEmbeddedFullH5 || h5Surface !== 'webview'
  const bottomBarMode: 'fixed' | 'dock' = useEmbeddedFullH5 && h5Surface === 'fallback' ? 'dock' : 'fixed'

  const h5ToolbarExtra =
    contentType === 'project'
      ? {
          toolbar: 'project',
          has_scored: memberState.has_scored ? '1' : '0',
          owner_id: String(detail.owner_member_id || detail.submitter_id || ''),
          owner_name: String(detail.owner_name || ''),
          title: String(detail.title || ''),
        }
      : showEventBar
        ? {
            toolbar: 'event',
            registered: eventRegistered ? '1' : '0',
            can_register: canRegisterEvent ? '1' : '0',
            blocked: eventRegisterBlockedLabel,
          }
        : undefined

  const renderProjectBottomBar = () => (
    <FixedBottomBar mode={bottomBarMode} className="items-stretch">
      <Button
        className="min-w-0 flex-1 rounded-2xl"
        size="lg"
        variant="gold"
        onClick={() => void goProjectScore()}
      >
        <Text>{memberState.has_scored ? '已评分' : '评分'}</Text>
      </Button>
      <Button
        className="min-w-0 flex-1 rounded-2xl"
        size="lg"
        variant="brand"
        onClick={() => void goProjectShare()}
      >
        <Text>分享</Text>
      </Button>
      <Button
        className="min-w-0 flex-1 rounded-2xl"
        size="lg"
        variant="outline"
        onClick={() => void openDealApplication()}
      >
        <Text>申请成交记录</Text>
      </Button>
    </FixedBottomBar>
  )

  const renderEventBottomBar = () => (
    <FixedBottomBar mode={bottomBarMode}>
      {eventRegistered ? (
        <Button className="w-full rounded-2xl" variant="secondary" disabled>
          <Text>已报名</Text>
        </Button>
      ) : canRegisterEvent ? (
        <Button className="w-full rounded-2xl" variant="brand" onClick={goRegister}>
          <Text>立即报名</Text>
        </Button>
      ) : (
        <Button
          className="w-full rounded-2xl"
          variant="secondary"
          onClick={() => Taro.showToast({ title: eventRegisterBlockedLabel, icon: 'none' })}
        >
          <Text>{eventRegisterBlockedLabel}</Text>
        </Button>
      )}
    </FixedBottomBar>
  )

  const renderRoadshowBottomBar = () => (
    <FixedBottomBar mode={bottomBarMode}>
      {(memberState.can_register || roadshowRegistered) && (
        <View className="flex-1">
          {roadshowRegistered ? (
            <Button className="w-full rounded-2xl" variant="secondary" disabled>
              <Text>已报名</Text>
            </Button>
          ) : (
            <Button className="w-full rounded-2xl" variant="brand" onClick={openRoadshowRegister}>
              <Text>立即报名</Text>
            </Button>
          )}
        </View>
      )}
      {memberState.can_score && (
        <View className="flex-1">
          <Button className="w-full rounded-2xl" variant="gold" onClick={submitRoadshowScores}>
            <Text className="block">{submitting ? '提交中...' : '提交评分'}</Text>
          </Button>
        </View>
      )}
      {canViewRoadshowResults && !memberState.can_score ? (
        <View className="flex-1">
          <Button className="w-full rounded-2xl" variant="secondary" disabled>
            <Text className="block">评分已结束</Text>
          </Button>
        </View>
      ) : null}
    </FixedBottomBar>
  )

  return (
    <PageShell scroll={false}>
      <View
        className="box-border"
        style={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
      {useEmbeddedFullH5 && h5RenderType ? (
        <HtmlDetailFrame
          layout="embedded"
          html={html}
          type={h5RenderType}
          params={{ id: contentId, extra: h5ToolbarExtra }}
          onSurfaceChange={setH5Surface}
        />
      ) : (
      <View
        className="box-border"
        style={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
      <ScrollView
        scrollY
        enhanced
        showScrollbar
        className="box-border"
        style={
          talentSplitH5
            ? { flexShrink: 0, maxHeight: '46%', minHeight: 0 }
            : { flex: 1, height: '100%', minHeight: 0 }
        }
      >
        <View className="px-4 pt-4">
          {isDisplayableImageUrl(cover) ? (
            <CoverThumb aspect="video" className="w-full">
              <Image
                key={cover}
                src={cover}
                mode="aspectFill"
                className="h-full w-full"
              />
            </CoverThumb>
          ) : null}
        </View>

        {contentType === 'project' && detail?.video_url ? (
          <SoftCard className="mx-4 mt-3 overflow-hidden px-0 py-0">
            <Video
              src={detail.video_url}
              controls
              className="w-full aspect-video"
              objectFit="contain"
            />
          </SoftCard>
        ) : null}

        {contentType === 'project' && projectGallery.length > 0 ? (
          <SoftCard className="mx-4 mt-3 px-4 py-4">
            <Text className="mb-3 block text-sm font-semibold text-foreground">项目图片</Text>
            <View className="flex flex-row flex-wrap gap-2">
              {projectGallery.map((url: string, index: number) => (
                <Image
                  key={`${url}-${index}`}
                  src={url}
                  mode="aspectFill"
                  className="h-24 w-24 rounded-xl"
                  onClick={() => previewGallery(url)}
                />
              ))}
            </View>
          </SoftCard>
        ) : null}

        {contentType === 'project' && projectFiles.length > 0 ? (
          <SoftCard className="mx-4 mt-3 px-4 py-4">
            <Text className="mb-3 block text-sm font-semibold text-foreground">项目文件</Text>
            <View className="flex flex-col gap-2">
              {projectFiles.map((url: string, index: number) => (
                <View
                  key={`${url}-${index}`}
                  className="flex flex-row items-center gap-2 rounded-xl bg-field px-3 py-3"
                  onClick={() => void previewRemoteDocument(url, fileDisplayName(url, index))}
                >
                  <FileText size={icon.lg} color={brandColors.blue} strokeWidth={icon.stroke} />
                  <Text className="block flex-1 text-sm text-primary">{fileDisplayName(url, index)}</Text>
                  <Text className="block text-xs text-muted-foreground">{isPdfUrl(url) ? '预览 PDF' : '打开'}</Text>
                </View>
              ))}
            </View>
          </SoftCard>
        ) : null}

        <SoftCard className="mx-4 mt-3 px-4 py-4">
          {contentType === 'talent' ? (
            <View className="mb-2 flex flex-row items-start gap-3">
              {isDisplayableImageUrl(talentAvatar) ? (
                <ListThumb>
                  <Image src={talentAvatar} mode="aspectFill" className="h-full w-full" />
                </ListThumb>
              ) : (
                <ListThumb>
                  <View
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${brandColors.navyDeep}, ${brandColors.navySecondary})` }}
                  >
                    <Text className="block text-xl font-bold text-white">{(title || '?')[0]}</Text>
                  </View>
                </ListThumb>
              )}
              <View className="flex-1">
                <View className="flex flex-row flex-wrap items-center gap-2">
                  <Text className="block text-base font-bold text-foreground">{title}</Text>
                  {detail.membership_active && detail.membership_badge ? (
                    <Badge variant="gold" className="px-2 py-0 text-xs">
                      {detail.membership_badge}
                    </Badge>
                  ) : null}
                  <Badge variant="soft" className="px-2 py-0 text-xs">
                    {detail.user_category_label || userCategoryLabel(detail.user_category)}
                  </Badge>
                </View>
                {detail.job_title ? (
                  <Text className="mt-1 block text-xs text-foreground">{detail.job_title}</Text>
                ) : null}
                {detail.company_name ? (
                  <Text className="mt-1 block text-xs text-muted-foreground whitespace-pre-wrap">
                    {detail.company_name}
                  </Text>
                ) : null}
                {detail.department_text ? (
                  <Text className="mt-1 block text-xs text-primary">
                    部门职位：{detail.department_text}
                  </Text>
                ) : Array.isArray(detail.departments) && detail.departments.length > 0 ? (
                  <Text className="mt-1 block text-xs text-primary">
                    部门职位：
                    {detail.departments
                      .map((d: any) => [d.department_name, d.position].filter(Boolean).join(' · '))
                      .filter(Boolean)
                      .join('；')}
                  </Text>
                ) : null}
                {detail.contact && (
                  <Text className="mt-1 block text-xs text-muted-foreground">
                    手机号：{maskPhone(detail.contact)}
                  </Text>
                )}
                {!detail.contact && detail.phone && (
                  <Text className="mt-1 block text-xs text-muted-foreground">
                    手机号：{maskPhone(detail.phone)}
                  </Text>
                )}
                {detail.membership_active && detail.payment_expire_at ? (
                  <Text className="mt-1 block text-xs text-muted-foreground">
                    会员有效期至 {String(detail.payment_expire_at).slice(0, 10)}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              <View className="mb-2 flex flex-row flex-wrap items-center gap-2">
                {(detail.category || detail.event_type) && (
                  <Badge variant="gold" className="px-2 py-1 text-xs font-medium">
                    {CATEGORY_MAP[detail.category || detail.event_type] || detail.category || detail.event_type}
                  </Badge>
                )}
                {contentType !== 'project' && detail.stage && (
                  <Badge variant="soft" className="px-2 py-0 text-xs">
                    {formatProjectStage(detail.stage)}
                  </Badge>
                )}
              </View>
              <Text className="block text-base font-bold text-foreground leading-snug">{title}</Text>
              {contentType === 'project' ? (
                <Text className="mt-2 block text-xs text-accent-foreground">
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
                <Badge key={code} variant="gold" className="px-2 py-0 text-xs">
                  {industryMap[code] || code}
                </Badge>
              ))}
            </View>
          )}

          {contentType === 'talent' && isSelfTalent ? (
            <View className="mt-3 flex flex-row rounded-xl bg-field px-2 py-3">
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-foreground">
                  {detail.member_days || 0}
                </Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">注册天数</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-foreground">
                  {detail.available_points || 0}
                </Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">积分</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-foreground">
                  {detail.deal_count || 0}
                </Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">成功对接</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-foreground">
                  {Number(detail.deal_amount_wan || 0)}
                </Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">成交金额(万)</Text>
              </View>
            </View>
          ) : null}

          {detail.subtitle && (
            <Text className="mt-2 block text-xs text-muted-foreground">{detail.subtitle}</Text>
          )}
          {detail.summary && (
            <Text className="mt-2 block text-xs leading-relaxed text-muted-foreground">{detail.summary}</Text>
          )}

          {/* 通用元信息：发布时间 / 开始时间 / 浏览 / 状态 */}
          <View className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            {(detail.created_at || detail.published_at) && (
              <MetaRow icon={Clock} iconColor={icon.color.default}>
                发布时间：{formatDetailTime(detail.published_at || detail.created_at)}
              </MetaRow>
            )}
            {detail.start_time && (
              <MetaRow icon={Clock} iconColor={icon.color.default}>
                开始时间：{formatDetailTime(detail.start_time)}
              </MetaRow>
            )}
            {detail.end_time && (isRoadshow || contentType === 'event') && (
              <MetaRow icon={Clock} iconColor={icon.color.default}>
                结束时间：{formatDetailTime(detail.end_time)}
              </MetaRow>
            )}
            {typeof detail.view_count !== 'undefined' && detail.view_count !== null && (
              <MetaRow icon={Eye} iconColor={icon.color.default}>
                浏览次数：{detail.view_count || 0}
              </MetaRow>
            )}
            {contentType === 'event' && detail.status && (
              <View className="flex flex-row items-center gap-2">
                <Badge variant="gold" className="px-2 py-0 text-xs">
                  状态：{STATUS_MAP[detail.status] || detail.status}
                </Badge>
              </View>
            )}
            {contentType === 'event' && detail.location && (
              <MetaRow icon={MapPin} iconColor={icon.color.default}>
                {detail.location}
              </MetaRow>
            )}
            {contentType === 'event' && (
              <MetaRow icon={Users} iconColor={icon.color.default}>
                报名人数：{eventSignupCount}/{detail.max_participants || '∞'}人
              </MetaRow>
            )}
            {isRoadshow && (
              <View className="flex flex-col gap-2">
                <MetaRow icon={Users} iconColor={icon.color.default}>
                  已报名 {detail.registration_count || 0} 人
                  {memberState.is_registered ? ' · 您已报名' : ''}
                </MetaRow>
                {(detail.start_time || detail.end_time) ? (
                  <Text className="block text-xs text-muted-foreground">
                    路演时间：{formatDetailTime(detail.start_time) || '待定'}
                    {detail.end_time ? ` 至 ${formatDetailTime(detail.end_time)}` : ''}
                  </Text>
                ) : null}
                {roadshowRegistered && roadshowScoringPhase === 'before' ? (
                  <Text className="block text-xs text-amber-600">评分尚未开始，请在路演开始后进行评分</Text>
                ) : null}
                {roadshowRegistered && roadshowScoringPhase === 'active' && !memberState.can_score ? (
                  <Text className="block text-xs text-muted-foreground">当前暂不可评分</Text>
                ) : null}
                {canViewRoadshowResults ? (
                  <Text className="block text-xs text-primary">路演已结束，以下为评分结果</Text>
                ) : null}
              </View>
            )}
            {contentType === 'business' && (detail.category === 'financing' || detail.category === 'resource' || detail.category === 'life') && (
              <>
                {detail.contact_phone && (
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-muted-foreground">电话：{detail.contact_phone}</Text>
                  </View>
                )}
                {detail.demand_talent_name && (
                  <View className="flex flex-row items-center gap-2">
                    <Text className="block text-xs text-muted-foreground">需求方：{detail.demand_talent_name}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </SoftCard>

        {isRoadshow && roadshowProjects.length > 0 && (
          <SoftCard className="mx-4 mt-3 px-4 py-4">
            <Text className="mb-3 block text-sm font-semibold text-foreground">参与路演项目</Text>
            <View className="flex flex-col gap-3">
              {roadshowProjects.map((project: any) => (
                <View key={project.project_id} className="overflow-hidden rounded-xl border border-border">
                  {isDisplayableImageUrl(project.cover_image) && (
                    <Image src={project.cover_image} mode="aspectFill" className="w-full aspect-video" />
                  )}
                  <View className="p-3">
                    <Text className="block text-sm font-semibold text-foreground">{project.title}</Text>
                    {showRoadshowScoring && scoreDimensions.map((dimension: any) => (
                      <View key={dimension.id} className="mt-2">
                        <Text className="mb-1 block text-xs text-muted-foreground">{dimension.name}</Text>
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
                    {canViewRoadshowResults && Array.isArray(roadshowScoreSummary?.projects) ? (
                      (() => {
                        const summary = roadshowScoreSummary.projects.find(
                          (item: any) => String(item.project_id) === String(project.project_id),
                        )
                        if (!summary) return null
                        return (
                          <View className="mt-2 rounded-lg bg-field px-3 py-2">
                            <Text className="block text-xs text-muted-foreground">
                              综合得分 {summary.overall_avg || 0} · 排名 #{summary.rank || '-'}
                            </Text>
                            {(summary.dimension_scores || []).map((dim: any) => (
                              <Text key={dim.dimension_id} className="mt-1 block text-xs text-muted-foreground">
                                {dim.name}：{dim.avg_stars || 0} 分（{dim.vote_count || 0} 人评）
                              </Text>
                            ))}
                          </View>
                        )
                      })()
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </SoftCard>
        )}

        {canViewRoadshowResults && roadshowScoreSummary?.summary_text ? (
          <SoftCard className="mx-4 mt-3 px-4 py-4">
            <Text className="mb-2 block text-sm font-semibold text-foreground">评分结果</Text>
            <Text className="block text-sm leading-relaxed text-muted-foreground">{roadshowScoreSummary.summary_text}</Text>
            {roadshowScoreSummary.overall_judgement ? (
              <Text className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                {roadshowScoreSummary.overall_judgement}
              </Text>
            ) : null}
          </SoftCard>
        ) : null}

        {contentType === 'project' && isLoggedIn() && (
          detail.promo_coop_mode
          || detail.promo_commission_rate != null
          || detail.promo_share_count
          || detail.promo_remark
        ) ? (
          <SoftCard className="mx-4 mt-3 px-4 py-4">
            <Text className="mb-3 block text-sm font-semibold text-foreground">推广收益</Text>
            <View className="flex flex-col gap-2">
              {detail.promo_coop_mode_label || detail.promo_coop_mode ? (
                <Text className="block text-xs text-muted-foreground">
                  合作模式：{detail.promo_coop_mode_label || detail.promo_coop_mode}
                </Text>
              ) : null}
              {detail.promo_commission_rate != null ? (
                <Text className="block text-xs text-muted-foreground">
                  分成比例：{Number(detail.promo_commission_rate)}%
                </Text>
              ) : null}
              <Text className="block text-xs text-muted-foreground">
                推广次数：{Number(detail.promo_share_count || 0)}
              </Text>
              {detail.promo_remark ? (
                <Text className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  其他说明：{detail.promo_remark}
                </Text>
              ) : null}
            </View>
          </SoftCard>
        ) : null}

        {isBusinessCommentable ? (
          <SoftCard className="mx-4 mt-3 px-4 py-4">
            <Text className="mb-3 block text-sm font-semibold text-foreground">
              评论与回复{businessComments.length ? `（${businessComments.length}）` : ''}
            </Text>
            {commentsLoading ? (
              <Text className="block text-sm text-muted-foreground">加载中...</Text>
            ) : businessComments.length === 0 ? (
              <Text className="block text-sm text-muted-foreground">暂无评论，来抢沙发吧</Text>
            ) : (
              <View className="flex flex-col gap-4">
                {businessComments.map((item) => renderBusinessCommentItem(item))}
              </View>
            )}
          </SoftCard>
        ) : null}

        <SoftCard className={`mx-4 mt-3 px-4 py-4 ${talentSplitH5 ? 'mb-3' : bottomPadding}`}>
          <Text className="mb-3 block text-sm font-semibold text-foreground">
            {contentType === 'talent' ? '过往经历' : contentType === 'event' ? '活动详情' : '详细内容'}
          </Text>
          {talentSplitH5 ? (
            <Text className="block text-xs leading-relaxed text-muted-foreground">
              完整图文介绍在下方加载，可滚动查看。
            </Text>
          ) : contentType === 'talent' ? (
            <RichHtml
              html={html}
              className="text-sm leading-6"
              emptyText="暂无经历介绍"
              fullPage={{ type: 'talent', id: contentId }}
            />
          ) : contentType === 'project' && projectBodyIsPlain ? (
            <Text className="block text-base leading-7 text-foreground whitespace-pre-wrap">
              {projectBodyText || '暂无内容'}
            </Text>
          ) : (
            <RichHtml
              html={html}
              className={contentType === 'project' ? 'text-base leading-7' : 'text-sm leading-6'}
              emptyText={contentType === 'event' ? '暂无活动图文详情，请在后台活动管理中完善' : '暂无内容'}
              fullPage={
                h5RenderType
                  ? { type: h5RenderType, id: contentId }
                  : undefined
              }
            />
          )}
        </SoftCard>
      </ScrollView>
      {talentSplitH5 ? (
        <View
          className="box-border min-h-0 w-full"
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <HtmlDetailFrame
            layout="embedded"
            html={html}
            type="talent"
            params={{ id: contentId }}
            onSurfaceChange={setH5Surface}
            loadingText="加载过往经历..."
            errorText="过往经历加载失败"
            className="h-full min-h-0"
          />
        </View>
      ) : null}
      </View>
      )}

      {showEventBar && showNativeBottomBar && renderEventBottomBar()}
      {showRoadshowBar && renderRoadshowBottomBar()}
      {showProjectBar && showNativeBottomBar && renderProjectBottomBar()}
      {showBusinessCommentBar && showNativeBottomBar && renderBusinessCommentBar()}
      </View>
    </PageShell>
  )
}

export default ContentDetailPage
