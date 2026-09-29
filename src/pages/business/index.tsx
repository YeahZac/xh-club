import { useMemo, useState, useEffect, useCallback } from "react"
import { Image, View, Text, ScrollView } from "@tarojs/components"
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
import {
  BUSINESS_CATEGORY_LABELS,
  businessCategoryLabel,
} from "@/lib/business-category"
import { isDisplayableImageUrl } from "@/lib/media-url"
import { loadWithListCache, getListCache } from "@/lib/list-cache"
import { fetchAllPagedList } from "@/lib/fetch-paged-list"
import { useMediaRefresh } from "@/lib/use-media-refresh"
import { stripHtml } from "@/lib/rich-html"
import { useTabShareAppMessage } from "@/lib/mini-program-share"

interface BusinessItem {
  id: string
  title: string
  summary?: string
  content?: string
  cover_image?: string
  category: string
  industry?: string
  region?: string
  amount_min?: number
  amount_max?: number
  stage?: string
  view_count?: number
  status: string
  is_featured?: boolean | number
  sort_order?: number
  start_time?: string | null
  updated_at?: string
  created_at?: string
  admin_operated_at?: string
  is_registered?: boolean
  can_register?: boolean
  end_time?: string | null
}

const stageMap: Record<string, string> = {
  seed: '种子期', angel: '天使轮', a: 'A轮', 'a_plus': 'A+轮', b: 'B轮', c: 'C轮', pre_ipo: 'Pre-IPO', ipo: '已上市',
}

const industryMap: Record<string, string> = {
  tech: '科技互联网', finance: '金融资本', manufacture: '先进制造', health: '大健康',
  realestate: '房地产建筑', education: '教育培训', media: '文化传媒', law: '法律服务',
  agriculture: '现代农业', crossborder: '跨境贸易', food: '餐饮消费', energy: '环保能源',
  service: '综合服务',
}

const TAB_KEYS = ['all', 'roadshow', 'financing', 'resource', 'life'] as const

const BusinessPage = () => {
  const [activeTab, setActiveTab] = useState("all")

  useTabShareAppMessage('business')

  const [roadshowList, setRoadshowList] = useState<BusinessItem[]>([])
  const [financingList, setFinancingList] = useState<BusinessItem[]>([])
  const [resourceList, setResourceList] = useState<BusinessItem[]>([])
  const [lifeList, setLifeList] = useState<BusinessItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    try {
      const hasCache = !options?.force && !!getListCache('business:lists')
      if (!options?.silent && !hasCache) setLoading(true)
      await loadWithListCache(
        'business:lists',
        async () => {
          const [roadshow, financing, resource, life] = await Promise.all([
            fetchAllPagedList<BusinessItem>('/api/business?category=roadshow'),
            fetchAllPagedList<BusinessItem>('/api/business?category=financing'),
            fetchAllPagedList<BusinessItem>('/api/business?category=resource'),
            fetchAllPagedList<BusinessItem>('/api/business?category=life'),
          ])
          return { roadshow, financing, resource, life }
        },
        {
          force: options?.force,
          ttlMs: 90_000,
          onData: (bundle) => {
            setRoadshowList(bundle.roadshow)
            setFinancingList(bundle.financing)
            setResourceList(bundle.resource)
            setLifeList(bundle.life)
          },
        },
      )
    } catch (err) {
      console.error('[商机页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useDidShow(() => {
    const initialTab = String(Taro.getStorageSync('business_initial_tab') || '')
    if ((TAB_KEYS as readonly string[]).includes(initialTab)) {
      setActiveTab(initialTab)
      Taro.removeStorageSync('business_initial_tab')
    }
  })

  const { onImageError } = useMediaRefresh(
    () => loadData({ silent: true, force: true }),
  )

  const allList = useMemo(() => {
    const sortTime = (item: BusinessItem) => {
      const value = item.admin_operated_at || item.created_at || ''
      const time = new Date(value).getTime()
      return Number.isNaN(time) ? 0 : time
    }
    return [...roadshowList, ...financingList, ...resourceList, ...lifeList].sort((a, b) => {
      const featured = Number(Number(b.is_featured) > 0) - Number(Number(a.is_featured) > 0)
      if (featured) return featured
      const order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
      if (order) return order
      return sortTime(b) - sortTime(a)
    })
  }, [roadshowList, financingList, resourceList, lifeList])

  const formatAmount = (min?: number, max?: number) => {
    if (!min && !max) return ''
    if (min && max) return `${min / 10000}-${max / 10000}万`
    return `${((min || max) || 0) / 10000}万`
  }

  const getSummary = (item: BusinessItem) => {
    const text = item.summary || stripHtml(item.content)
    return text.slice(0, 30)
  }

  const openDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/content-detail/index?type=business&id=${id}` })
  }

  const renderBusinessCard = (item: BusinessItem, showCategory = false) => {
    const coverOk = isDisplayableImageUrl(item.cover_image)
    const amountText = formatAmount(item.amount_min, item.amount_max)
    const badgeText = showCategory
      ? businessCategoryLabel(item.category)
      : (stageMap[item.stage || ''] || businessCategoryLabel(item.category))
    const summary = getSummary(item)
    const meta =
      amountText
      || (item.industry ? industryMap[item.industry] || item.industry : '')
      || item.region
      || ''
    const description = summary || meta

    return (
      <SoftCard
        key={`${item.category}-${item.id}`}
        className="overflow-hidden p-3"
        onClick={() => openDetail(item.id)}
      >
        <View className="flex flex-row items-center gap-3">
          <View className={ui.listRowThumb}>
            {coverOk ? (
              <Image
                key={`biz-img-${item.id}-${item.cover_image || ''}`}
                src={item.cover_image!}
                mode="aspectFill"
                className="h-full w-full"
                lazyLoad
                onError={onImageError}
              />
            ) : (
              <View
                className="flex h-full w-full items-center justify-center px-2"
                style={{ background: `linear-gradient(135deg, ${brandColors.blue}, ${brandColors.mint})` }}
              >
                <Text className="block text-center text-xs font-semibold text-white line-clamp-2">{item.title}</Text>
              </View>
            )}
            <Badge variant="gold" className="absolute left-1 top-1 px-1 py-0 text-xs">
              {badgeText}
            </Badge>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="block text-sm font-semibold leading-snug text-foreground line-clamp-1">{item.title}</Text>
            {description ? (
              <Text className="mt-1 block text-xs leading-snug text-muted-foreground line-clamp-1">{description}</Text>
            ) : null}
          </View>
        </View>
      </SoftCard>
    )
  }

  const renderList = (list: BusinessItem[], emptyText: string, showCategory = false) => (
    <ScrollView scrollY className="mt-3" style={{ height: 'calc(100vh - 148px)' }}>
      <View className={`flex flex-col ${ui.listGap} ${layout.bottomBarPad}`}>
        {list.map((item) => renderBusinessCard(item, showCategory))}
        {list.length === 0 && !loading && (
          <EmptyState title={emptyText} />
        )}
      </View>
    </ScrollView>
  )

  return (
    <PageShell scroll={false}>
      <HeroHeader
        title="商机"
        subtitle="路演、商业、资源与生活需求"
        compact
      />

      <View className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="segmented" className="flex h-auto w-full flex-row justify-around">
            <TabsTrigger value="all" className="flex-1 py-2">
              全部
            </TabsTrigger>
            <TabsTrigger value="roadshow" className="flex-1 py-2">
              {BUSINESS_CATEGORY_LABELS.roadshow}
            </TabsTrigger>
            <TabsTrigger value="financing" className="flex-1 py-2">
              {BUSINESS_CATEGORY_LABELS.financing}
            </TabsTrigger>
            <TabsTrigger value="resource" className="flex-1 py-2">
              {BUSINESS_CATEGORY_LABELS.resource}
            </TabsTrigger>
            <TabsTrigger value="life" className="flex-1 py-2">
              {BUSINESS_CATEGORY_LABELS.life}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {renderList(allList, '暂无商机内容', true)}
          </TabsContent>
          <TabsContent value="roadshow">
            {renderList(roadshowList, '暂无路演项目')}
          </TabsContent>
          <TabsContent value="financing">
            {renderList(financingList, `暂无${BUSINESS_CATEGORY_LABELS.financing}`)}
          </TabsContent>
          <TabsContent value="resource">
            {renderList(resourceList, `暂无${BUSINESS_CATEGORY_LABELS.resource}`)}
          </TabsContent>
          <TabsContent value="life">
            {renderList(lifeList, `暂无${BUSINESS_CATEGORY_LABELS.life}`)}
          </TabsContent>
        </Tabs>
      </View>
    </PageShell>
  )
}

export default BusinessPage
