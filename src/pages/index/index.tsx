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
  return (
    <View className="flex flex-row justify-center gap-1 mt-3">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1 rounded-full transition-all ${i === current ? 'w-5 bg-[#C9A96E]' : 'w-1 bg-gray-300'}`}
        />
      ))}
    </View>
  )
}

const QUICK_ENTRIES = [
  { label: "项目路演", icon: Presentation, tint: "#EDF0F4", color: "#1B2A4A", path: "/pages/business/index" },
  { label: "融资招募", icon: TrendingUp, tint: "#EEF1F6", color: "#2D4A7A", path: "/pages/business/index" },
  { label: "会员推荐", icon: UserPlus, tint: "#FAF6F1", color: "#C9A96E", path: "" },
  { label: "活动报名", icon: CalendarDays, tint: "#ECFDF5", color: "#10B981", path: "/pages/discover/index" },
  { label: "人才查询", icon: UserSearch, tint: "#F0F0FE", color: "#6366F1", path: "/pages/discover/index" },
  { label: "项目查询", icon: Search, tint: "#FDF2F8", color: "#EC4899", path: "/pages/business/index" },
  { label: "发布动态", icon: SquarePen, tint: "#FFFBEB", color: "#F59E0B", path: "" },
  { label: "我的收益", icon: Wallet, tint: "#FEF2F2", color: "#EF4444", path: "/pages/profile/index" },
]

const isCloudStorageImageUrl = (url: string) => {
  if (!url || typeof url !== 'string') return false
  const value = url.trim()
  if (!/^https:\/\//i.test(value)) return false
  // 兼容 COS / 云托管临时域名 / 带签名 query 的 URL
  return /(?:\.myqcloud\.com|\.tcb\.qcloud\.la)(?:\/|\?|$)/i.test(value)
}

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
    console.log('[首页] API domain:', PROJECT_DOMAIN)
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
    if (item.detail_type === 'product') {
      Taro.navigateTo({ url: `/pages/mall/product-detail/index?id=${item.detail_id}` })
      return
    }
    const type = item.detail_type || 'project'
    Taro.navigateTo({ url: `/pages/content-detail/index?type=${type}&id=${item.detail_id}` })
  }

  const leftFeed = feedItems.filter((_, index) => index % 2 === 0)
  const rightFeed = feedItems.filter((_, index) => index % 2 === 1)

  const handleBannerClick = (banner: BannerItem) => {
    console.log('[首页] Banner点击:', banner.link_type, banner.link_config)
    const config = banner.link_config || {}
    switch (banner.link_type) {
      case 'article':
        if (config.article_id) {
          Taro.navigateTo({ url: `/pages/content-detail/index?type=article&id=${config.article_id}` })
        }
        break
      case 'event':
        if (config.event_id) {
          Taro.navigateTo({ url: `/pages/content-detail/index?type=event&id=${config.event_id}` })
        }
        break
      case 'project':
        if (config.project_id) {
          Taro.navigateTo({ url: `/pages/content-detail/index?type=project&id=${config.project_id}` })
        }
        break
      case 'financing':
      case 'roadshow':
      case 'resource':
        if (config.business_id) {
          Taro.navigateTo({ url: `/pages/content-detail/index?type=business&id=${config.business_id}` })
        } else {
          Taro.switchTab({ url: '/pages/business/index' })
        }
        break
      case 'product':
        if (config.product_id) {
          Taro.navigateTo({ url: `/pages/mall/product-detail/index?id=${config.product_id}` })
        } else {
          Taro.switchTab({ url: '/pages/mall/index' })
        }
        break
      case 'link':
        if (config.url) {
          Taro.setClipboardData({
            data: config.url,
            success: () => Taro.showToast({ title: '链接已复制', icon: 'none' })
          })
        }
        break
      case 'miniapp':
        if (config.appid && config.path) {
          Taro.navigateToMiniProgram({
            appId: config.appid,
            path: config.path,
          })
        }
        break
      default:
        if (banner.link_id) {
          Taro.showToast({ title: '暂不支持该跳转类型', icon: 'none' })
        }
        break
    }
  }

  const handleQuickEntryClick = (path: string) => {
    if (!path) {
      Taro.showToast({ title: '功能建设中，敬请期待', icon: 'none' })
      return
    }
    Taro.switchTab({ url: path })
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
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-5">
        <View style={{ height: `${statusBarHeight}px` }} />
        {isMiniApp && (
          <View className="flex flex-row items-center justify-between mb-3">
            <View className="flex flex-row items-center gap-2">
              <Text className="block text-xl font-bold text-white">星河百谷</Text>
              <Text className="block text-xs text-[#E8D5A8] bg-[#F4EEE2] px-2 py-0 rounded-full">商会会员平台</Text>
            </View>
            <View className="relative" onClick={() => Taro.navigateTo({ url: '/pages/message/index' })}>
              <Bell size={20} color="#ffffff" />
              <View className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            </View>
          </View>
        )}
        {/* Search Bar */}
        <View
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          className="rounded-xl px-3 py-2 flex flex-row items-center gap-2"
          onClick={() => Taro.showToast({ title: '搜索功能建设中', icon: 'none' })}
        >
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索项目、人才、资源...</Text>
          {!isMiniApp && (
            <View
              className="ml-auto"
              onClick={(event) => {
                event.stopPropagation()
                Taro.navigateTo({ url: '/pages/message/index' })
              }}
            >
              <Bell size={18} color="#ffffff" />
            </View>
          )}
        </View>
      </View>

      {/* ── Banner Carousel ── */}
      {banners.length > 0 && (
        <View className="px-4 -mt-2">
          <Carousel
            key={banners.map((item) => item.id).join('-')}
            opts={{ autoplay: true, interval: 4000, duration: 500, loop: true }}
            className="w-full"
          >
            {/* 小程序端 Swiper 依赖明确高度；aspect + 绝对填充比 h-full 更稳 */}
            <View
              className="relative w-full overflow-hidden rounded-2xl"
              style={{ paddingBottom: `${(28 / 69) * 100}%` }}
            >
              <View className="absolute inset-0">
                <CarouselContent className="h-full">
                  {banners.map((banner) => (
                    <CarouselItem key={banner.id} className="h-full">
                      <View
                        className="bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] relative overflow-hidden h-full w-full"
                        onClick={() => handleBannerClick(banner)}
                      >
                        {isCloudStorageImageUrl(banner.image_url) && !failedBannerImages.has(banner.id) && (
                          <Image
                            src={banner.image_url}
                            mode="aspectFill"
                            className={`absolute inset-0 w-full h-full ${loadedBannerImages.has(banner.id) ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => handleBannerImageLoad(banner.id)}
                            onError={() => handleBannerImageError(banner.id)}
                          />
                        )}
                        {loadedBannerImages.has(banner.id) ? (
                          <View className="absolute left-0 bottom-0 right-0 p-4" style={{ background: 'linear-gradient(transparent, rgba(27,42,74,0.85))' }}>
                            <Text className="block text-white text-base font-bold">{banner.title}</Text>
                          </View>
                        ) : (
                          <View className="h-full flex flex-col justify-end p-5">
                            <View className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                            <View className="absolute left-0 bottom-0 right-0 h-1 bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8]" />
                            <Text className="block text-white text-lg font-bold mb-1 relative z-10">{banner.title}</Text>
                            <View className="rounded-lg px-3 py-1 self-start relative z-10" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                              <Text className="block text-white text-xs font-medium">立即参与 →</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </View>
            </View>
            <CarouselDots total={banners.length} />
          </Carousel>
        </View>
      )}

      {/* ── Quick Entry Grid ── */}
      <View className="px-4 mt-5">
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <View className="grid grid-cols-4 gap-y-4">
            {QUICK_ENTRIES.map((entry) => (
              <View
                key={entry.label}
                className="flex flex-col items-center gap-1"
                onClick={() => handleQuickEntryClick(entry.path)}
              >
                <View className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: entry.tint }}>
                  <entry.icon size={22} color={entry.color} />
                </View>
                <Text className="block text-xs text-[#1A1D2E] font-medium">{entry.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Homepage Waterfall Feed ── */}
      {feedItems.length > 0 && (
        <View className="mt-6 px-4">
          <View className="flex flex-row items-center gap-2 mb-3">
            <View className="w-1 h-5 bg-[#C9A96E] rounded-full" />
            <Text className="block text-base font-semibold text-[#1A1D2E]">精选内容</Text>
            <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-[10px] px-1 py-0">{feedItems.length}</Badge>
          </View>
          <View className="flex flex-row gap-3 items-start">
            {[leftFeed, rightFeed].map((column, colIdx) => (
              <View key={colIdx} className="flex-1 flex flex-col gap-3">
                {column.map((item) => {
                  const key = String(item.id)
                  const coverOk = isCloudStorageImageUrl(item.cover_image || '') && !failedFeedImages.has(key)
                  const aspectClass = getFeedCoverAspect(item)
                  return (
                    <View
                      key={key}
                      className="bg-white rounded-2xl overflow-hidden shadow-sm"
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
                        <View className={`w-full ${aspectClass} bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] flex items-center justify-center px-3`}>
                          <Text className="block text-white text-sm font-semibold text-center">{item.title}</Text>
                        </View>
                      )}
                      <View className="p-3">
                        <Text className="block text-sm font-semibold text-[#1A1D2E] leading-snug">{item.title}</Text>
                        <View className="flex flex-row items-center justify-between mt-2">
                          <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-[10px] px-2 py-0">
                            {item.content_type_label || item.content_type}
                          </Badge>
                          <View className="flex flex-row items-center gap-1">
                            <Eye size={12} color="#9CA3AF" />
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
        <View className="flex items-center justify-center py-20">
          <Text className="block text-sm text-gray-400">加载中...</Text>
        </View>
      )}

      {/* ── Empty State ── */}
      {!loading && banners.length === 0 && feedItems.length === 0 && (
        <View className="flex flex-col items-center justify-center gap-3 py-20">
          <Text className="block text-sm text-gray-400">
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
      <View className="h-16" />
    </ScrollView>
  )
}

export default IndexPage
