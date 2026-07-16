import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState, useEffect } from "react"
import {
  Presentation, TrendingUp, UserPlus, CalendarDays,
  UserSearch, Search, SquarePen, Wallet,
  Bell, ChevronRight, Users,
  ThumbsUp, MessageCircle,
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

interface RoadshowItem {
  id: string
  title: string
  cover_image: string
  company_name: string
  amount_min: number
  amount_max: number
  industry: string
  stage: string
  view_count: number
  status: string
  is_featured: boolean
}

interface ResourceItem {
  id: string
  title: string
  type: string
  category: string
  industry: string
  description: string
  member_name: string
  member_company: string
}

interface PostItem {
  id: string
  title: string
  content: string
  type: string
  member_name: string
  member_company: string
  like_count: number
  comment_count: number
  created_at: string
  is_featured: boolean
}

type HomepageSectionKey = 'projects' | 'resources' | 'posts'

interface HomepageConfig {
  configured: boolean
  sections: Array<{
    section: HomepageSectionKey
    is_enabled: boolean
    item_limit: number
    items: Array<{
      item_id: string
      sort_order: number
      is_active: boolean
    }>
  }>
}

const selectHomepageItems = <T extends { id: string }>(
  list: T[],
  config: HomepageConfig | null,
  sectionKey: HomepageSectionKey,
  fallbackLimit: number,
): T[] => {
  if (!config?.configured) return list.slice(0, fallbackLimit)
  const section = config.sections.find(item => item.section === sectionKey)
  if (!section?.is_enabled) return []

  const activeItems = section.items.filter(item => item.is_active)
  if (activeItems.length === 0) {
    return list.slice(0, section.item_limit || fallbackLimit)
  }

  const itemsById = new Map(list.map(item => [String(item.id), item]))
  return activeItems
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(item => itemsById.get(String(item.item_id)))
    .filter((item): item is T => Boolean(item))
    .slice(0, section.item_limit)
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

const IndexPage = () => {
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? (Taro.getWindowInfo().statusBarHeight || 22) : 44

  const [banners, setBanners] = useState<BannerItem[]>([])
  const [roadshows, setRoadshows] = useState<RoadshowItem[]>([])
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [feeds, setFeeds] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [failedBannerImages, setFailedBannerImages] = useState<Set<string>>(() => new Set())
  const [loadedBannerImages, setLoadedBannerImages] = useState<Set<string>>(() => new Set())
  const [failedCoverImages, setFailedCoverImages] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    console.log('[首页] API domain:', PROJECT_DOMAIN)
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    try {
      setLoading(true)
      setLoadFailed(false)
      const [bannersRes, projectsRes, resourcesRes, postsRes, homepageRes] = await Promise.all([
        Network.request({ url: '/api/banners' }).catch((error) => {
          console.error('[首页] Banner加载失败:', error)
          return null
        }),
        Network.request({ url: '/api/projects?pageSize=100' }).catch((error) => {
          console.error('[首页] 项目加载失败:', error)
          return null
        }),
        Network.request({ url: '/api/community/resources?limit=100' }).catch((error) => {
          console.error('[首页] 资源加载失败:', error)
          return null
        }),
        Network.request({ url: '/api/community/posts?pageSize=100' }).catch((error) => {
          console.error('[首页] 动态加载失败:', error)
          return null
        }),
        Network.request({ url: '/api/homepage' }).catch((error) => {
          console.warn('[首页] 首页配置加载失败，使用默认列表:', error)
          return null
        }),
      ])
      console.log('[首页] banners:', bannersRes?.data)
      console.log('[首页] projects:', projectsRes?.data)
      console.log('[首页] resources:', resourcesRes?.data)
      console.log('[首页] posts:', postsRes?.data)
      console.log('[首页] config:', homepageRes?.data)

      setLoadFailed([bannersRes, projectsRes, resourcesRes, postsRes].some(response => response === null))
      const homepageConfig = (homepageRes?.data?.data || null) as HomepageConfig | null

      if (bannersRes) {
        // 兼容 Taro 响应体直接是数组 / {data:[]} / {code,data:[]} 多种形态
        const list = getResponseList<BannerItem>(bannersRes.data?.data ?? bannersRes.data)
        console.log('[首页] banners parsed count:', list.length)
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
      if (projectsRes) {
        const list = getResponseList<RoadshowItem>(projectsRes.data?.data)
        setRoadshows(selectHomepageItems(list, homepageConfig, 'projects', 6))
      }
      if (resourcesRes) {
        const list = getResponseList<ResourceItem>(resourcesRes.data?.data)
        setResources(selectHomepageItems(list, homepageConfig, 'resources', 5))
      }
      if (postsRes) {
        const list = getResponseList<PostItem>(postsRes.data?.data)
        setFeeds(selectHomepageItems(list, homepageConfig, 'posts', 5))
      }
    } catch (err) {
      console.error('[首页] 加载数据失败:', err)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (min: number, max: number) => {
    if (!min && !max) return '面议'
    if (min && max) return `${min / 10000}-${max / 10000}万`
    return `${(min || max) / 10000}万`
  }

  const stageMap: Record<string, string> = {
    seed: '种子期', angel: '天使轮', a: 'A轮', b: 'B轮', c: 'C轮', ipm: 'Pre-IPO', ipo: '已上市',
  }

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    if (!Number.isFinite(diff)) return ''
    if (diff <= 0) return '刚刚'
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

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
          Taro.showToast({ title: '内容详情开发中', icon: 'none' })
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

  const handleCoverImageError = (itemId: string) => {
    setFailedCoverImages(current => {
      const next = new Set(current)
      next.add(itemId)
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

      {/* ── Featured Projects / Roadshows ── */}
      {roadshows.length > 0 && (
        <View className="mt-6">
          <View className="px-4 flex flex-row items-center justify-between mb-3">
            <View className="flex flex-row items-center gap-2">
              <View className="w-1 h-5 bg-[#C9A96E] rounded-full" />
              <Text className="block text-base font-semibold text-[#1A1D2E]">精选项目</Text>
              <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-[10px] px-1 py-0">{roadshows.length}个</Badge>
            </View>
            <View className="flex flex-row items-center gap-0" onClick={() => Taro.switchTab({ url: '/pages/business/index' })}>
              <Text className="block text-xs text-gray-400">更多</Text>
              <ChevronRight size={14} color="#9CA3AF" />
            </View>
          </View>
          <ScrollView scrollX className="pl-4">
            <View className="flex flex-row gap-3 pr-4">
              {roadshows.map((item) => (
                <Card
                  key={item.id}
                  className="min-w-[260px] shadow-sm border-0 overflow-hidden flex-shrink-0"
                  onClick={() => Taro.navigateTo({ url: `/pages/content-detail/index?type=project&id=${item.id}` })}
                >
                  {isCloudStorageImageUrl(item.cover_image) && !failedCoverImages.has(item.id) && (
                    <Image
                      src={item.cover_image}
                      mode="aspectFill"
                      className="w-full aspect-video"
                      onError={() => handleCoverImageError(item.id)}
                    />
                  )}
                  <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] p-4 relative overflow-hidden">
                    <View className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                    <View className="flex flex-row items-center justify-between mb-2">
                      <Badge className="bg-[#C9A96E] text-white text-[10px] px-2 py-0">{stageMap[item.stage] || item.stage}</Badge>
                      <View className="flex flex-row items-center gap-1">
                        <Users size={12} color="rgba(255,255,255,0.7)" />
                        <Text className="block text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.view_count || 0}人关注</Text>
                      </View>
                    </View>
                    <Text className="block text-white font-semibold text-sm mb-1">{item.title}</Text>
                    <Text className="block text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.company_name || ''}</Text>
                  </View>
                  <CardContent className="p-3">
                    <View className="flex flex-row items-center justify-between">
                      <Badge className="bg-gray-100 text-gray-500 text-[10px] px-1 py-0">{item.industry || '综合'}</Badge>
                      <Text className="block text-xs font-semibold text-[#C9A96E]">{formatAmount(item.amount_min, item.amount_max)}</Text>
                    </View>
                  </CardContent>
                </Card>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── Business Opportunities / Resource Hall ── */}
      {resources.length > 0 && (
        <View className="mt-6 px-4">
          <View className="flex flex-row items-center justify-between mb-3">
            <View className="flex flex-row items-center gap-2">
              <View className="w-1 h-5 bg-[#C9A96E] rounded-full" />
              <Text className="block text-base font-semibold text-[#1A1D2E]">资源大厅</Text>
            </View>
            <View
              className="flex flex-row items-center gap-0"
              onClick={() => Taro.switchTab({ url: '/pages/business/index' })}
            >
              <Text className="block text-xs text-gray-400">全部</Text>
              <ChevronRight size={14} color="#9CA3AF" />
            </View>
          </View>
          <View className="flex flex-col gap-3">
            {resources.map((item) => (
              <Card key={item.id} className="shadow-sm border-0">
                <CardContent className="p-4">
                  <View className="flex flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-3">
                      <View className="flex flex-row items-center gap-2 mb-1">
                        <Badge className={`${item.type === 'demand' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'} text-[10px] px-1 py-0`}>
                          {item.type === 'demand' ? '需求' : '供给'}
                        </Badge>
                        <Badge className="bg-gray-100 text-gray-500 text-[10px] px-1 py-0">{item.industry || '综合'}</Badge>
                      </View>
                      <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.title}</Text>
                    </View>
                  </View>
                  <View className="flex flex-row items-center gap-2 pt-2 border-t border-[#E8EAF0]">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-[#1B2A4A] text-white text-[10px]">{(item.member_name || '?')[0]}</AvatarFallback>
                    </Avatar>
                    <Text className="block text-xs text-gray-500">{item.member_name || '匿名'}</Text>
                    <Text className="block text-xs text-gray-300">·</Text>
                    <Text className="block text-xs text-gray-400">{item.member_company || ''}</Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* ── Member Activity Feed ── */}
      {feeds.length > 0 && (
        <View className="mt-6 px-4 pb-8">
          <View className="flex flex-row items-center justify-between mb-3">
            <View className="flex flex-row items-center gap-2">
              <View className="w-1 h-5 bg-[#C9A96E] rounded-full" />
              <Text className="block text-base font-semibold text-[#1A1D2E]">会员动态</Text>
            </View>
          </View>
          <View className="flex flex-col gap-3">
            {feeds.map((feed) => (
              <Card key={feed.id} className="shadow-sm border-0">
                <CardContent className="p-4">
                  <View className="flex flex-row items-start gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-sm">{(feed.member_name || '?')[0]}</AvatarFallback>
                    </Avatar>
                    <View className="flex-1 min-w-0">
                      <View className="flex flex-row items-center gap-2 mb-0">
                        <Text className="block text-sm font-semibold text-[#1A1D2E]">{feed.member_name || '匿名'}</Text>
                        <Text className="block text-xs text-gray-400">{feed.member_company || ''}</Text>
                      </View>
                      {feed.title && <Text className="block text-sm font-medium text-[#1A1D2E] mt-1">{feed.title}</Text>}
                      <Text className="block text-sm text-gray-600 leading-relaxed mt-1">{feed.content}</Text>
                      <View className="flex flex-row items-center gap-4 mt-3">
                        <Text className="block text-xs text-gray-400">{formatTimeAgo(feed.created_at)}</Text>
                        <View className="flex flex-row items-center gap-1">
                          <ThumbsUp size={14} color="#6B7280" />
                          <Text className="block text-xs text-gray-400">{feed.like_count || 0}</Text>
                        </View>
                        <View className="flex flex-row items-center gap-1">
                          <MessageCircle size={14} color="#6B7280" />
                          <Text className="block text-xs text-gray-400">{feed.comment_count || 0}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </CardContent>
              </Card>
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
      {!loading && banners.length === 0 && roadshows.length === 0 && resources.length === 0 && feeds.length === 0 && (
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
