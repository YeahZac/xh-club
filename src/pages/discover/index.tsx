import { useMemo, useState, useEffect, useCallback } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  brandColors,
  EmptyState,
  HeroHeader,
  layout,
  PageShell,
  SoftCard,
  ui,
} from "@/components/brand-ui"
import { getResponseList } from "@/lib/api-response"
import { isDisplayableImageUrl } from "@/lib/media-url"
import { LIST_FIELDS_QUERY, LIST_PAGE_SIZE, loadWithListCache, getListCache } from "@/lib/list-cache"
import { useMediaRefresh } from "@/lib/use-media-refresh"
import { Network } from "@/network"
import { useTabShareAppMessage } from "@/lib/mini-program-share"
import { openContentDetail } from "@/lib/content-navigation"
import { formatProjectStage } from "@/lib/project-stage"
import { maskPhone } from "@/lib/mask-phone"
import { excerptRichText } from "@/lib/rich-html"
import { TalentPhotoThumb } from "@/components/talent-photo-thumb"

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
  is_featured?: boolean | number
  sort_order?: number
  updated_at?: string
  created_at?: string
  admin_operated_at?: string
  form_fields?: unknown
  is_registered?: boolean
}

interface TalentItem {
  id: string
  real_name: string
  contact: string
  wechat_id?: string
  company_name?: string
  job_title?: string
  photo_url: string
  avatar_url?: string
  member_avatar?: string
  industry_tags: string[]
  experience?: string
  reviewed_at?: string
  updated_at?: string
  created_at?: string
  admin_operated_at?: string
  membership_active?: boolean
  membership_badge?: string
  user_category?: string
  user_category_label?: string
  payment_expire_at?: string
  is_featured?: boolean | number
  sort_order?: number
}

interface ProjectItem {
  id: string
  title: string
  description?: string
  cover_image?: string
  industry?: string
  stage?: string
  company_name?: string
  avg_score?: number
  score_count?: number
  created_at?: string
  updated_at?: string
  admin_operated_at?: string
  is_featured?: boolean | number
  sort_order?: number
}

interface IndustryItem {
  code: string
  name: string
}

type DiscoverFeedItem =
  | { kind: 'event'; sortTime: number; isFeatured: boolean; sortOrder: number; data: EventItem }
  | { kind: 'talent'; sortTime: number; isFeatured: boolean; sortOrder: number; data: TalentItem }
  | { kind: 'project'; sortTime: number; isFeatured: boolean; sortOrder: number; data: ProjectItem }

const eventTypeMap: Record<string, string> = {
  other: '其他活动', roadshow: '项目路演', salon: '专题沙龙', annual: '年度大会', training: '培训', meeting: '定期例会',
}

const toSortTime = (value?: string | null) => {
  if (!value) return 0
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

const excerptText = (value?: string | null, maxLen = 28) =>
  excerptRichText(value, maxLen, '').replace(/\s+/g, ' ')

const DiscoverPage = () => {
  const [activeTab, setActiveTab] = useState("all")

  useTabShareAppMessage('discover')

  const [events, setEvents] = useState<EventItem[]>([])
  const [talents, setTalents] = useState<TalentItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [industries, setIndustries] = useState<IndustryItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    try {
      const hasCache = !options?.force && !!getListCache('discover:lists')
      if (!options?.silent && !hasCache) setLoading(true)
      type DiscoverBundle = {
        events: EventItem[]
        talents: TalentItem[]
        projects: ProjectItem[]
        industries: IndustryItem[]
      }
      const apply = (bundle: DiscoverBundle) => {
        setEvents(bundle.events)
        setTalents(bundle.talents)
        setProjects(bundle.projects)
        setIndustries(bundle.industries)
      }
      await loadWithListCache(
        'discover:lists',
        async () => {
          const q = `pageSize=${LIST_PAGE_SIZE}&${LIST_FIELDS_QUERY}`
          const settled = await Promise.allSettled([
            Network.request({ url: `/api/events?${q}` }),
            Network.request({ url: `/api/talents?${q}` }),
            Network.request({ url: `/api/projects?${q}` }),
            Network.request({ url: '/api/industries' }),
          ])
          const pick = <T,>(idx: number, label: string): T | undefined => {
            const item = settled[idx]
            if (item.status === 'fulfilled') return item.value as T
            console.error(`[发现页] ${label} 加载失败:`, item.reason)
            return undefined
          }
          const eventsRes = pick<any>(0, '活动')
          const talentsRes = pick<any>(1, '人才')
          const projectsRes = pick<any>(2, '项目')
          const industriesRes = pick<any>(3, '行业')
          return {
            events: getResponseList<EventItem>(eventsRes?.data?.data),
            talents: getResponseList<TalentItem>(talentsRes?.data?.data),
            projects: getResponseList<ProjectItem>(projectsRes?.data?.data),
            industries: getResponseList<IndustryItem>(industriesRes?.data?.data),
          }
        },
        {
          force: options?.force,
          ttlMs: 90_000,
          onData: (bundle) => apply(bundle),
        },
      )
    } catch (err) {
      console.error('[发现页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useDidShow(() => {
    const initialTab = String(Taro.getStorageSync('discover_initial_tab') || '')
    if (initialTab === 'all' || initialTab === 'events' || initialTab === 'talents' || initialTab === 'projects') {
      setActiveTab(initialTab)
      Taro.removeStorageSync('discover_initial_tab')
    }
  })

  const { onImageError } = useMediaRefresh(
    () => loadData({ silent: true, force: true }),
  )

  const compareDiscover = <T extends { is_featured?: boolean | number; sort_order?: number; admin_operated_at?: string; created_at?: string }>(
    a: T,
    b: T,
  ) => {
    const featured = Number(Number(b.is_featured) > 0) - Number(Number(a.is_featured) > 0)
    if (featured) return featured
    const order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
    if (order) return order
    return toSortTime(b.admin_operated_at || b.created_at) - toSortTime(a.admin_operated_at || a.created_at)
  }

  const sortedEvents = useMemo(
    () => [...events].sort(compareDiscover),
    [events],
  )
  const sortedTalents = useMemo(
    () => [...talents].sort(compareDiscover),
    [talents],
  )
  const sortedProjects = useMemo(
    () => [...projects].sort(compareDiscover),
    [projects],
  )

  const allFeed = useMemo<DiscoverFeedItem[]>(() => {
    const eventItems: DiscoverFeedItem[] = sortedEvents.map((item) => ({
      kind: 'event',
      sortTime: toSortTime(item.admin_operated_at || item.created_at),
      isFeatured: Number(item.is_featured) > 0,
      sortOrder: Number(item.sort_order || 0),
      data: item,
    }))
    const talentItems: DiscoverFeedItem[] = sortedTalents.map((item) => ({
      kind: 'talent',
      sortTime: toSortTime(item.admin_operated_at || item.created_at),
      isFeatured: Number(item.is_featured) > 0,
      sortOrder: Number(item.sort_order || 0),
      data: item,
    }))
    const projectItems: DiscoverFeedItem[] = sortedProjects.map((item) => ({
      kind: 'project',
      sortTime: toSortTime(item.admin_operated_at || item.created_at),
      isFeatured: Number(item.is_featured) > 0,
      sortOrder: Number(item.sort_order || 0),
      data: item,
    }))
    return [...eventItems, ...talentItems, ...projectItems].sort((a, b) => {
      const featured = Number(b.isFeatured) - Number(a.isFeatured)
      if (featured) return featured
      const order = a.sortOrder - b.sortOrder
      if (order) return order
      return b.sortTime - a.sortTime
    })
  }, [sortedEvents, sortedTalents, sortedProjects])

  const industryName = (code: string) =>
    industries.find((item) => item.code === code)?.name || code

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const renderThumbFallback = (label: string, gradient: string) => (
    <View
      className="flex h-full w-full items-center justify-center px-2"
      style={{ background: gradient }}
    >
      <Text className="block text-center text-xs font-semibold text-white">{label}</Text>
    </View>
  )

  const renderFeaturedBadge = (item: { is_featured?: boolean | number }) =>
    Number(item.is_featured) > 0 ? (
      <Badge variant="gold" className="flex-shrink-0 px-1 py-0 text-xs">
        精选
      </Badge>
    ) : null

  const renderEventCard = (item: EventItem) => {
    const coverOk = isDisplayableImageUrl(item.cover_image)
    const subtitle = [formatTime(item.start_time), item.location].filter(Boolean).join(' · ')
    return (
      <SoftCard
        key={`event-${item.id}`}
        className="overflow-hidden p-3"
        onClick={() => openContentDetail('event', item.id)}
      >
        <View className="flex flex-row items-center gap-3">
          <View className={ui.listRowThumb}>
            {coverOk ? (
              <Image
                key={`event-img-${item.id}-${item.cover_image || ''}`}
                src={item.cover_image}
                mode="aspectFill"
                className="h-full w-full"
                lazyLoad
                onError={onImageError}
              />
            ) : (
              renderThumbFallback(
                item.title,
                `linear-gradient(135deg, ${brandColors.blue}, ${brandColors.mint})`,
              )
            )}
            <Badge variant="gold" className="absolute left-1 top-1 px-1 py-0 text-xs">
              {eventTypeMap[item.event_type] || item.event_type || '活动'}
            </Badge>
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex flex-row items-center gap-2">
              <Text className="block min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground line-clamp-1">
                {item.title}
              </Text>
              {renderFeaturedBadge(item)}
            </View>
            {subtitle ? (
              <Text className="mt-1 block text-xs text-muted-foreground line-clamp-1">{subtitle}</Text>
            ) : null}
          </View>
        </View>
      </SoftCard>
    )
  }

  const renderProjectCard = (item: ProjectItem) => {
    const coverOk = isDisplayableImageUrl(item.cover_image || '')
    const scoreCount = Number(item.score_count || 0)
    const avgScore = Number(item.avg_score || 0)
    const stageLabel = formatProjectStage(item.stage)
    const tagParts = [
      item.industry ? industryName(item.industry) : '',
      stageLabel,
      scoreCount > 0 ? `评分 ${avgScore.toFixed(1)}` : '暂无评分',
    ].filter(Boolean)
    const subtitle = tagParts.join(' · ')
    const summary = excerptText(item.description, 48)
    const company = String(item.company_name || '').trim()
    return (
      <SoftCard
        key={`project-${item.id}`}
        className="overflow-hidden p-3"
        onClick={() => openContentDetail('project', item.id)}
      >
        <View className="flex flex-row items-start gap-3">
          <View className={ui.listRowThumb}>
            {coverOk ? (
              <Image
                key={`project-img-${item.id}-${item.cover_image || ''}`}
                src={item.cover_image!}
                mode="aspectFill"
                className="h-full w-full"
                lazyLoad
                onError={onImageError}
              />
            ) : (
              renderThumbFallback(
                item.title,
                `linear-gradient(135deg, ${brandColors.navyDeep}, ${brandColors.gold})`,
              )
            )}
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex flex-row items-center gap-2">
              <Text className="block min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground line-clamp-1">
                {item.title}
              </Text>
              {renderFeaturedBadge(item)}
            </View>
            {company ? (
              <Text className="mt-1 block text-xs text-muted-foreground line-clamp-1">{company}</Text>
            ) : null}
            <Text className="mt-1 block text-xs text-muted-foreground line-clamp-1">{subtitle}</Text>
            {summary ? (
              <Text className="mt-1 block text-xs text-muted-foreground line-clamp-2">{summary}</Text>
            ) : null}
          </View>
        </View>
      </SoftCard>
    )
  }

  const renderTalentCard = (item: TalentItem) => {
    const avatar = item.photo_url || item.avatar_url || item.member_avatar
    const companyLine = [item.company_name, item.job_title].filter(Boolean).join(" · ")
    const maskedPhone = maskPhone(item.contact)
    const summary = excerptText(item.experience)
    return (
      <SoftCard
        key={`talent-${item.id}`}
        className="overflow-hidden p-3"
        onClick={() => openContentDetail('talent', item.id)}
      >
        <View className="flex flex-row items-start gap-3">
          <TalentPhotoThumb src={avatar} name={item.real_name} onImageError={onImageError} />
          <View className="min-w-0 flex-1">
            <View className="flex flex-row items-center gap-2">
              <Text className="block min-w-0 flex-1 text-sm font-semibold text-foreground line-clamp-1">
                {item.real_name}
              </Text>
              {renderFeaturedBadge(item)}
              {item.user_category_label ? (
                <Badge variant="soft" className="flex-shrink-0 px-1 py-0 text-xs">
                  {item.user_category_label}
                </Badge>
              ) : null}
              {item.membership_active && item.membership_badge ? (
                <Badge variant="gold" className="flex-shrink-0 px-1 py-0 text-xs">
                  {item.membership_badge}
                </Badge>
              ) : null}
            </View>
            {companyLine ? (
              <Text className="mt-1 block text-xs text-muted-foreground line-clamp-1">{companyLine}</Text>
            ) : null}
            {maskedPhone ? (
              <Text className="mt-1 block text-xs text-muted-foreground">{maskedPhone}</Text>
            ) : null}
            {item.wechat_id ? (
              <Text className="mt-1 block text-xs text-muted-foreground">
                微信号：{item.wechat_id}
              </Text>
            ) : null}
            {summary ? (
              <View className="mt-1 min-w-0 w-full overflow-hidden">
                <Text
                  className="block w-full truncate text-xs text-muted-foreground"
                  // 微信小程序 Text 对 line-clamp 支持不稳定，强制单行省略
                  overflow="ellipsis"
                  style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    width: '100%',
                  }}
                >
                  {summary}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </SoftCard>
    )
  }

  return (
    <PageShell scroll={false}>
      <HeroHeader
        title="发现"
        subtitle="活动、人才与精选项目"
        compact
      />

      <View className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="segmented" className="flex h-auto w-full flex-row justify-around">
            <TabsTrigger value="all" className="flex-1 py-2">
              全部
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex-1 py-2">
              项目
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1 py-2">
              活动报名
            </TabsTrigger>
            <TabsTrigger value="talents" className="flex-1 py-2">
              人才查询
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 148px)' }}>
              <View className={`flex flex-col ${ui.listGap} ${layout.bottomBarPad}`}>
                {allFeed.map((item) =>
                  item.kind === 'event'
                    ? renderEventCard(item.data)
                    : item.kind === 'project'
                      ? renderProjectCard(item.data)
                      : renderTalentCard(item.data),
                )}
                {allFeed.length === 0 && !loading && (
                  <EmptyState title="暂无内容" />
                )}
              </View>
            </ScrollView>
          </TabsContent>

          <TabsContent value="projects">
            <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 148px)' }}>
              <View className={`flex flex-col ${ui.listGap} ${layout.bottomBarPad}`}>
                {sortedProjects.map((item) => renderProjectCard(item))}
                {sortedProjects.length === 0 && !loading && (
                  <EmptyState title="暂无项目" />
                )}
              </View>
            </ScrollView>
          </TabsContent>

          <TabsContent value="events">
            <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 148px)' }}>
              <View className={`flex flex-col ${ui.listGap} ${layout.bottomBarPad}`}>
                {sortedEvents.map((item) => renderEventCard(item))}
                {sortedEvents.length === 0 && !loading && (
                  <EmptyState title="暂无活动" />
                )}
              </View>
            </ScrollView>
          </TabsContent>

          <TabsContent value="talents">
            <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 148px)' }}>
              <View className={`flex flex-col ${ui.listGap} ${layout.bottomBarPad}`}>
                {sortedTalents.map((item) => renderTalentCard(item))}
                {sortedTalents.length === 0 && !loading && (
                  <EmptyState title="暂无入驻人才" />
                )}
              </View>
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>
    </PageShell>
  )
}

export default DiscoverPage
