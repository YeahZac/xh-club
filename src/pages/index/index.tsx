import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState, useEffect } from "react"
import {
  Presentation, TrendingUp, UserPlus, CalendarDays,
  UserSearch, Search, SquarePen, Wallet,
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
import { openContentDetail, openExternalUrl, openMiniProgram, pickId } from "@/lib/content-navigation"
import { isDisplayableImageUrl } from "@/lib/media-url"
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
    <View className="absolute bottom-3 left-0 right-0 flex flex-row justify-center gap-1.5 z-20 pointer-events-none">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
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
  { label: "项目路演", icon: Presentation, tint: "#EDF0F4", color: "#1B2A4A", path: "/pages/business/index", tabStorageKey: "business_initial_tab", tabValue: "roadshow" },
  { label: "融资招募", icon: TrendingUp, tint: "#EEF1F6", color: "#2D4A7A", path: "/pages/business/index", tabStorageKey: "business_initial_tab", tabValue: "financing" },
  { label: "会员推荐", icon: UserPlus, tint: "#FAF6F1", color: "#C9A96E", path: "/pages/invite/index", navType: "navigate" },
  { label: "活动报名", icon: CalendarDays, tint: "#ECFDF5", color: "#10B981", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "events" },
  { label: "人才查询", icon: UserSearch, tint: "#F0F0FE", color: "#6366F1", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "talents" },
  { label: "项目查询", icon: Search, tint: "#FDF2F8", color: "#EC4899", path: "/pages/business/index", tabStorageKey: "business_initial_tab", tabValue: "all" },
  { label: "发布动态", icon: SquarePen, tint: "#FFFBEB", color: "#F59E0B", path: "/pages/publish-post/index", navType: "navigate" },
  { label: "我的收益", icon: Wallet, tint: "#FEF2F2", color: "#EF4444", path: "/pages/profile/index" },
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

const IndexPage = () => {
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? (Taro.getWindowInfo().statusBarHeight || 22) : 44

  const [banners, setBanners] = useState<BannerItem[]>([])
  const [feedItems, setFeedItems] = useState<HomepageFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [failedBannerImages, setFailedBannerImages] = useState<Set<string>>(() => new Set())
  const [loadedBannerImages, setLoadedBannerImages] = useState<Set<string>>(() => new Set())
  const [failedFeedImages, setFailedFeedImages] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    try {
      setLoading(true)
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
        setBanners(parsed.slice(0, 5))
        setFailedBannerImages(new Set())
        setLoadedBannerImages(new Set())
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
      setLoading(false)
    }
  }

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

  const handleBannerImageError = (bannerId: string) => {
    setFailedBannerImages(current => {
      const next = new Set(current)
      next.add(bannerId)
      return next
    })
  }

  const handleBannerImageLoad = (bannerId: string) => {
    setLoadedBannerImages(current => {
      const next = new Set(current)
      next.add(bannerId)
      return next
    })
  }

  return (
    <ScrollView scrollY className="h-full bg-[#F5F6FA]">
      {/* ── Custom Header ── */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-3.5 pb-3">
        <View style={{ height: `${statusBarHeight}px` }} />
        {isMiniApp && (
          <View className="flex flex-row items-center justify-between mb-2">
            <View className="flex flex-row items-center gap-1.5">
              <Text className="block text-lg font-bold text-white">星河百谷</Text>
              <Text className="block text-xs text-[#C9A96E] bg-white/10 px-1.5 py-0 rounded">商会会员平台</Text>
            </View>
            <View className="relative" onClick={() => Taro.navigateTo({ url: '/pages/message/index' })}>
              <Bell size={18} color="#ffffff" />
              <View className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </View>
          </View>
        )}
        {/* Search Bar */}
        <View
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          className="rounded-lg px-2.5 py-1.5 flex flex-row items-center gap-1.5"
          onClick={() => Taro.showToast({ title: '搜索功能建设中', icon: 'none' })}
        >
          <Search size={14} color="rgba(255,255,255,0.6)" />
          <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索项目、人才、资源...</Text>
          {!isMiniApp && (
            <View
              className="ml-auto"
              onClick={(event) => {
                event.stopPropagation()
                Taro.navigateTo({ url: '/pages/message/index' })
              }}
            >
              <Bell size={16} color="#ffffff" />
            </View>
          )}
        </View>
      </View>

      {/* ── Banner Carousel ── */}
      {banners.length > 0 && (
        <View className="px-3.5 pt-2.5">
          <Carousel
            key={banners.map((item) => item.id).join('-')}
            opts={{ autoplay: true, interval: 4000, duration: 500, loop: true }}
            className="w-full"
          >
            <View
              className="relative w-full overflow-hidden rounded-xl shadow-sm"
              style={{ paddingBottom: `${(28 / 69) * 100}%` }}
            >
              <View className="absolute inset-0">
                <CarouselContent className="h-full">
                  {banners.map((banner) => (
                    <CarouselItem key={banner.id} className="h-full">
                      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] relative overflow-hidden h-full w-full">
                        {isDisplayableImageUrl(banner.image_url) && !failedBannerImages.has(banner.id) && (
                          <Image
                            src={banner.image_url}
                            mode="aspectFill"
                            className={`absolute inset-0 w-full h-full ${loadedBannerImages.has(banner.id) ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => handleBannerImageLoad(banner.id)}
                            onError={() => handleBannerImageError(banner.id)}
                          />
                        )}
                        {loadedBannerImages.has(banner.id) ? (
                          <View
                            className="absolute left-0 bottom-0 right-0 px-3 py-2.5 pb-6 z-10"
                            style={{ background: 'linear-gradient(transparent, rgba(27,42,74,0.85))' }}
                          >
                            <Text className="block text-white text-sm font-semibold">{banner.title}</Text>
                          </View>
                        ) : (
                          <View className="h-full flex flex-col justify-end p-3.5 pb-6">
                            <View className="absolute left-0 bottom-0 right-0 h-0.5 bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8]" />
                            <Text className="block text-white text-sm font-semibold mb-1 relative z-10">{banner.title}</Text>
                            <View className="rounded px-2 py-0.5 self-start relative z-10" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                              <Text className="block text-white text-xs font-medium">立即参与 →</Text>
                            </View>
                          </View>
                        )}
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
      <View className="px-3.5 mt-3">
        <View className="bg-white rounded-xl p-3 shadow-sm">
          <View className="grid grid-cols-4 gap-y-3">
            {QUICK_ENTRIES.map((entry) => (
              <View
                key={entry.label}
                className="flex flex-col items-center gap-1"
                onClick={() => handleQuickEntryClick(entry)}
              >
                <View className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: entry.tint }}>
                  <entry.icon size={18} color={entry.color} />
                </View>
                <Text className="block text-xs text-[#1A1D2E]">{entry.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Homepage Waterfall Feed ── */}
      {feedItems.length > 0 && (
        <View className="mt-4 px-3.5">
          <View className="flex flex-row items-center gap-1.5 mb-2">
            <View className="w-0.5 h-3.5 bg-[#C9A96E] rounded-full" />
            <Text className="block text-sm font-semibold text-[#1A1D2E]">精选内容</Text>
            <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1 py-0">{feedItems.length}</Badge>
          </View>
          <View className="flex flex-row gap-2 items-start">
            {[leftFeed, rightFeed].map((column, colIdx) => (
              <View key={colIdx} className="flex-1 flex flex-col gap-2">
                {column.map((item) => {
                  const key = String(item.id)
                  const coverOk = isDisplayableImageUrl(item.cover_image || '') && !failedFeedImages.has(key)
                  const aspectClass = getFeedCoverAspect(item)
                  return (
                    <View
                      key={key}
                      className="bg-white rounded-xl overflow-hidden shadow-sm"
                      onClick={() => openFeedItem(item)}
                    >
                      {coverOk ? (
                        <View className={`relative w-full overflow-hidden ${aspectClass}`}>
                          <Image
                            src={item.cover_image!}
                            mode="aspectFill"
                            className="absolute inset-0 w-full h-full"
                            onError={() => setFailedFeedImages((prev) => new Set(prev).add(key))}
                          />
                        </View>
                      ) : (
                        <View className={`w-full ${aspectClass} bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] flex items-center justify-center px-2`}>
                          <Text className="block text-white text-xs font-semibold text-center">{item.title}</Text>
                        </View>
                      )}
                      <View className="p-2">
                        <Text className="block text-xs font-semibold text-[#1A1D2E] leading-snug line-clamp-2">{item.title}</Text>
                        <View className="flex flex-row items-center justify-between mt-1.5">
                          <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">
                            {item.content_type_label || item.content_type}
                          </Badge>
                          <View className="flex flex-row items-center gap-0.5">
                            <Eye size={11} color="#9CA3AF" />
                            <Text className="block text-xs text-gray-400">{item.view_count || 0}</Text>
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
          <Text className="block text-xs text-gray-400">加载中...</Text>
        </View>
      )}

      {/* ── Empty State ── */}
      {!loading && banners.length === 0 && feedItems.length === 0 && (
        <View className="flex flex-col items-center justify-center gap-2 py-12">
          <Text className="block text-xs text-gray-400">
            {loadFailed ? '内容加载失败，请检查网络后重试' : '暂无数据，请在后台配置Banner和内容'}
          </Text>
          {loadFailed && (
            <Button variant="outline" size="sm" onClick={loadHomeData}>
              <Text className="block">重新加载</Text>
            </Button>
          )}
        </View>
      )}

      {/* Bottom padding for TabBar */}
      <View className="h-14" />
    </ScrollView>
  )
}

export default IndexPage
