import { View, Text, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Presentation, TrendingUp, UserPlus, CalendarDays,
  UserSearch, Search, SquarePen, FolderPlus,
  Bell, Eye,
} from "lucide-react-taro"
import { Badge } from "@/components/ui/badge"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"
import { getResponseList } from "@/lib/api-response"
import { AUTH_LOGGED_IN_EVENT, ensureLogin, isLoggedIn } from "@/lib/auth"
import { fetchUnreadNotificationCount } from "@/lib/notifications"
import { brand, HeroHeader, IconBubble, PageShell, SearchPill, SectionTitle, SoftCard } from "@/components/brand-ui"
import { openContentDetail, openExternalUrl, openMiniProgram, pickId } from "@/lib/content-navigation"
import { isDisplayableImageUrl } from "@/lib/media-url"
import { useMediaRefresh } from "@/lib/use-media-refresh"
import { Network } from "@/network"

/* ── Types ── */
interface BannerLinkConfig {
  article_id?: string
  event_id?: string
  project_id?: string
  business_id?: string
  product_id?: string
  category?: string
  url?: string
  appid?: string
  path?: string
}

interface BannerItem {
  id: string
  title: string
  image_url: string
  link_type: string
  link_id: string
  link_config: BannerLinkConfig
  sort_order: number
  is_active: boolean
}

interface HomepageFeedItem {
  id: string | number
  section: string
  item_id: string
  title: string
  cover_image?: string | null
  view_count?: number
  content_type: string
  content_type_label: string
  detail_type: string
  detail_id: string
  sort_order?: number
  created_at?: string | null
}

/* ── Carousel Dots ── */
const CarouselDots = ({ total }: { total: number }) => {
  const { current } = useCarousel()
  if (total <= 1) return null
  return (
    <View className="absolute bottom-3 left-0 right-0 z-20 flex flex-row justify-center gap-2 pointer-events-none">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-2 rounded-full transition-all ${i === current ? 'w-4 bg-white' : 'w-2 bg-white bg-opacity-50'}`}
        />
      ))}
    </View>
  )
}

type QuickEntry = {
  label: string
  icon: typeof Presentation
  tint: string
  color: string
  path: string
  /** Tab 页：写入 storage 后 switchTab；子页：navigateTo */
  navType?: 'switchTab' | 'navigate'
  tabStorageKey?: string
  tabValue?: string
}

const QUICK_ENTRIES: QuickEntry[] = [
  { label: "项目路演", icon: Presentation, tint: "#EFF4FF", color: "#5577FF", path: "/pages/business/index", tabStorageKey: "business_initial_tab", tabValue: "roadshow" },
  { label: "融资招募", icon: TrendingUp, tint: "#F0F7FF", color: "#2D8CFF", path: "/pages/business/index", tabStorageKey: "business_initial_tab", tabValue: "financing" },
  { label: "会员推荐", icon: UserPlus, tint: "#FFF8E8", color: "#C8A96A", path: "/pages/invite/index", navType: "navigate" },
  { label: "活动报名", icon: CalendarDays, tint: "#EBFAF6", color: "#34C7A2", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "events" },
  { label: "人才查询", icon: UserSearch, tint: "#F5F1FF", color: "#8A6DFF", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "talents" },
  { label: "项目查询", icon: Search, tint: "#FFF0F6", color: "#F56E9A", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "projects" },
  { label: "发布动态", icon: SquarePen, tint: "#FFF6ED", color: "#FF9F43", path: "/pages/publish-post/index", navType: "navigate" },
  { label: "发布项目", icon: FolderPlus, tint: "#F2F7F3", color: "#5E8C61", path: "/pages/publish-project/index", navType: "navigate" },
]

/** 与管理台 MEDIA_SPECS 上传比例一致 */
const FEED_COVER_ASPECT: Record<string, string> = {
  event: 'aspect-[69/29]',
  product: 'aspect-square',
  project: 'aspect-video',
  article: 'aspect-video',
  financing: 'aspect-video',
  roadshow: 'aspect-video',
  resource: 'aspect-video',
}

const getFeedCoverAspect = (item: HomepageFeedItem) =>
  FEED_COVER_ASPECT[item.content_type] || FEED_COVER_ASPECT[item.detail_type] || 'aspect-[4/3]'

/**
 * 失败状态按「id + 图片URL」记录：URL 刷新后应允许重试
 */
const bannerImageKey = (banner: BannerItem) => `${banner.id}:${banner.image_url || ''}`
const feedImageKey = (item: HomepageFeedItem) => `${item.id}:${item.cover_image || ''}`

const IndexPage = () => {
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [feedItems, setFeedItems] = useState<HomepageFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [failedBannerImages, setFailedBannerImages] = useState<Set<string>>(() => new Set())
  const [failedFeedImages, setFailedFeedImages] = useState<Set<string>>(() => new Set())
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const firstLoadRef = useRef(true)

  const loadUnreadCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount()
    setUnreadNotifications(count)
  }, [])

  const loadHomeData = useCallback(async () => {
    try {
      // 静默刷新：仅首次加载展示 loading，返回页面重拉时不闪加载态
      if (firstLoadRef.current) setLoading(true)
      setLoadFailed(false)
      const [bannersRes, feedRes] = await Promise.all([
        Network.request({ url: '/api/banners' }).catch((error) => {
          console.error('[首页] Banner加载失败:', error)
          return null
        }),
        Network.request({ url: '/api/homepage/feed' }).catch((error) => {
          console.error('[首页] 瀑布流加载失败:', error)
          return null
        }),
      ])
      console.log('[首页] banners:', bannersRes?.data)
      console.log('[首页] feed:', feedRes?.data)

      setLoadFailed([bannersRes, feedRes].some(response => response === null))

      if (bannersRes) {
        const list = getResponseList<BannerItem>(bannersRes.data?.data ?? bannersRes.data)
        const parsed = list.map((banner: BannerItem) => {
          let linkConfig = banner.link_config || {}
          if (typeof banner.link_config === 'string') {
            try {
              linkConfig = JSON.parse(banner.link_config)
            } catch {
              console.warn('[首页] Banner link_config 不是有效 JSON:', banner.id)
              linkConfig = {}
            }
          }
          return { ...banner, link_config: linkConfig }
        })
        const nextBanners = parsed.slice(0, 5)
        setBanners(nextBanners)
        // 只重置失败记录，让失效图片可重试
        setFailedBannerImages(new Set())
      } else {
        setBanners([])
      }

      if (feedRes) {
        const payload = feedRes.data?.data
        const list = Array.isArray(payload?.list)
          ? payload.list
          : getResponseList<HomepageFeedItem>(payload)
        setFeedItems(list)
        setFailedFeedImages(new Set())
      } else {
        setFeedItems([])
      }
    } catch (err) {
      console.error('[首页] 加载数据失败:', err)
      setLoadFailed(true)
    } finally {
      firstLoadRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHomeData()
    void loadUnreadCount()
    const onLogin = () => { void loadUnreadCount() }
    Taro.eventCenter.on(AUTH_LOGGED_IN_EVENT, onLogin)
    return () => {
      Taro.eventCenter.off(AUTH_LOGGED_IN_EVENT, onLogin)
    }
  }, [loadHomeData, loadUnreadCount])

  useDidShow(() => {
    void loadUnreadCount()
  })

  const { onImageError } = useMediaRefresh(loadHomeData)

  const openFeedItem = (item: HomepageFeedItem) => {
    openContentDetail(item.detail_type || item.content_type, item.detail_id || item.item_id)
  }

  const leftFeed = feedItems.filter((_, index) => index % 2 === 0)
  const rightFeed = feedItems.filter((_, index) => index % 2 === 1)

  const handleBannerClick = (banner: BannerItem) => {
    const config = banner.link_config || {}
    const linkType = String(banner.link_type || '').trim()
    console.log('[首页] Banner 点击:', { id: banner.id, linkType, link_id: banner.link_id, config })

    switch (linkType) {
      case 'article':
        openContentDetail('article', pickId(config.article_id, banner.link_id))
        break
      case 'event':
        openContentDetail('event', pickId(config.event_id, banner.link_id))
        break
      case 'project':
        openContentDetail('project', pickId(config.project_id, banner.link_id))
        break
      case 'financing':
      case 'roadshow':
      case 'resource':
      case 'business':
        openContentDetail('business', pickId(config.business_id, banner.link_id))
        break
      case 'product':
        openContentDetail('product', pickId(config.product_id, banner.link_id))
        break
      case 'link':
        openExternalUrl(String(config.url || ''))
        break
      case 'miniapp':
        openMiniProgram(String(config.appid || ''), String(config.path || ''))
        break
      default:
        Taro.showToast({ title: '暂不支持该跳转类型', icon: 'none' })
        break
    }
  }

  const handleQuickEntryClick = (entry: QuickEntry) => {
    if (!entry.path) {
      Taro.showToast({ title: '功能建设中，敬请期待', icon: 'none' })
      return
    }
    if (entry.tabStorageKey && entry.tabValue) {
      Taro.setStorageSync(entry.tabStorageKey, entry.tabValue)
    }
    if (entry.navType === 'navigate') {
      Taro.navigateTo({
        url: entry.path,
        fail: (err) => {
          console.error('[首页] 打开页面失败:', entry.path, err)
          Taro.showToast({ title: '页面打开失败，请重新编译小程序', icon: 'none' })
        },
      })
      return
    }
    Taro.switchTab({
      url: entry.path,
      fail: (err) => {
        console.error('[首页] 切换 Tab 失败:', entry.path, err)
        Taro.showToast({ title: '切换失败', icon: 'none' })
      },
    })
  }

  const handleBannerImageError = (bannerKey: string) => {
    setFailedBannerImages(current => {
      const next = new Set(current)
      next.add(bannerKey)
      return next
    })
    onImageError()
  }

  return (
    <PageShell>
      <HeroHeader
        title="发现新机会"
        subtitle="连接项目、人才、资源与活动"
        compact
      >
        <SearchPill
          text="搜索项目、人才、资源..."
          onClick={() => Taro.navigateTo({ url: '/pages/search/index' })}
          right={(
            <View
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F7FB]"
              onClick={(event) => {
                event.stopPropagation()
                void (async () => {
                  if (!isLoggedIn()) {
                    const ok = await ensureLogin('')
                    if (!ok) return
                    await loadUnreadCount()
                  }
                  Taro.navigateTo({ url: '/pages/message/index' })
                })()
              }}
            >
              <Bell size={22} color={brand.muted} />
              {unreadNotifications > 0 ? (
                <View
                  className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1"
                  style={{ minHeight: '16px' }}
                >
                  <Text className="block text-xs font-semibold leading-none text-white">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        />
      </HeroHeader>

      {/* ── Banner Carousel ── */}
      {banners.length > 0 && (
        <View className="px-4">
          <Carousel
            key={banners.map((item) => `${item.id}:${item.image_url || ''}`).join('|')}
            opts={{ autoplay: true, interval: 4000, duration: 500, loop: true }}
            className="w-full"
          >
            <View
              className="relative w-full overflow-hidden rounded-xl shadow-sm"
              style={{ paddingBottom: `${(34 / 69) * 100}%` }}
            >
              <View className="absolute inset-0">
                <CarouselContent className="h-full">
                  {banners.map((banner) => (
                    <CarouselItem key={banner.id} className="h-full">
                      <View className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#536DFE] to-[#34C7A2]">
                        {isDisplayableImageUrl(banner.image_url) && !failedBannerImages.has(bannerImageKey(banner)) && (
                          <Image
                            key={bannerImageKey(banner)}
                            src={banner.image_url}
                            mode="aspectFill"
                            className="absolute inset-0 h-full w-full"
                            onError={() => handleBannerImageError(bannerImageKey(banner))}
                          />
                        )}
                        <View
                          className="absolute bottom-0 left-0 right-0 z-10 px-4 py-3 pb-7"
                          style={{ background: 'linear-gradient(transparent, rgba(18,27,45,0.76))' }}
                        >
                          <Text className="block text-base font-semibold leading-snug text-white">{banner.title}</Text>
                        </View>
                        {/* 最上层透明点击区：微信 Swiper/Image 容易吞掉父级 onClick */}
                        <View
                          className="absolute inset-0 z-40"
                          style={{ backgroundColor: 'rgba(0,0,0,0.001)' }}
                          onClick={() => handleBannerClick(banner)}
                        />
                      </View>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </View>
              <CarouselDots total={banners.length} />
            </View>
          </Carousel>
        </View>
      )}

      {/* ── Quick Entry Grid ── */}
      <View className="mt-4 px-4">
        <SectionTitle title="常用入口" subtitle="一键抵达会员服务" />
        <SoftCard className="p-3">
          <View className="grid grid-cols-4 gap-y-3">
            {QUICK_ENTRIES.map((entry) => (
              <View
                key={entry.label}
                className="flex flex-col items-center gap-2"
                onClick={() => handleQuickEntryClick(entry)}
              >
                <View className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DCE4EF]" style={{ backgroundColor: entry.tint }}>
                  <entry.icon size={20} color={entry.color} strokeWidth={1.8} />
                </View>
                <Text className="block text-xs font-medium text-[#172033]">{entry.label}</Text>
              </View>
            ))}
          </View>
        </SoftCard>
      </View>

      {/* ── Homepage Waterfall Feed ── */}
      {feedItems.length > 0 && (
        <View className="mt-5 px-4">
          <SectionTitle
            title="精选内容"
            subtitle="为你筛选近期值得关注的信息"
            extra={<Badge className="bg-[#FFF8E8] px-2 py-0 text-xs text-[#C8A96A]">{feedItems.length}</Badge>}
          />
          <View className="flex flex-row items-start gap-3">
            {[leftFeed, rightFeed].map((column, colIdx) => (
              <View key={colIdx} className="flex flex-1 flex-col gap-3">
                {column.map((item) => {
                  const key = feedImageKey(item)
                  const coverOk = isDisplayableImageUrl(item.cover_image || '') && !failedFeedImages.has(key)
                  const aspectClass = getFeedCoverAspect(item)
                  return (
                    <View
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-[#E4EAF2] bg-white shadow-sm"
                      onClick={() => openFeedItem(item)}
                    >
                      {coverOk ? (
                        <View className={`relative w-full overflow-hidden ${aspectClass}`}>
                          <Image
                            key={key}
                            src={item.cover_image!}
                            mode="aspectFill"
                            className="absolute inset-0 w-full h-full"
                            onError={() => {
                              setFailedFeedImages((prev) => new Set(prev).add(key))
                              onImageError()
                            }}
                          />
                        </View>
                      ) : (
                        <View className={`flex w-full items-center justify-center bg-gradient-to-br from-[#5577FF] to-[#34C7A2] px-3 ${aspectClass}`}>
                          <Text className="block text-center text-xs font-semibold text-white">{item.title}</Text>
                        </View>
                      )}
                      <View className="p-3">
                        <Text className="block text-sm font-semibold leading-snug text-[#172033] line-clamp-2">{item.title}</Text>
                        <View className="mt-2 flex flex-row items-center justify-between">
                          <Badge className="bg-[#F7F8FC] px-2 py-0 text-xs text-[#7A8497]">
                            {item.content_type_label || item.content_type}
                          </Badge>
                          <View className="flex flex-row items-center gap-1">
                            <Eye size={11} color="#98A2B3" />
                            <Text className="block text-xs text-[#98A2B3]">{item.view_count || 0}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <View className="flex items-center justify-center py-12">
          <Text className="block text-sm text-[#98A2B3]">正在整理星河内容...</Text>
        </View>
      )}

      {/* ── Empty State ── */}
      {!loading && banners.length === 0 && feedItems.length === 0 && (
        <View className="px-4 py-8">
          <SoftCard className="flex flex-col items-center justify-center px-6 py-14">
            <IconBubble icon={Presentation} color={brand.blue} />
            <Text className="mt-4 block text-sm font-semibold text-[#172033]">
              {loadFailed ? '内容加载失败' : '暂无内容'}
            </Text>
            <Text className="mt-1 block text-center text-xs text-[#98A2B3]">
              {loadFailed ? '请检查网络后重试' : '请在后台配置 Banner 和精选内容'}
            </Text>
          {loadFailed && (
            <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={loadHomeData}>
              <Text className="block text-sm">重新加载</Text>
            </Button>
          )}
          </SoftCard>
        </View>
      )}

      {/* Bottom padding for TabBar */}
      <View className="h-20" />
    </PageShell>
  )
}

export default IndexPage
