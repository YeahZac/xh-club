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

const IndexPage = () => {
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  const [banners, setBanners] = useState<BannerItem[]>([])
  const [roadshows, setRoadshows] = useState<RoadshowItem[]>([])
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [feeds, setFeeds] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    try {
      setLoading(true)
      const [bannersRes, projectsRes, resourcesRes, postsRes] = await Promise.all([
        Network.request({ url: '/api/admin/banners' }),
        Network.request({ url: '/api/events' }),
        Network.request({ url: '/api/community/resources' }),
        Network.request({ url: '/api/community/posts' }),
      ])
      console.log('[首页] banners:', bannersRes?.data)
      console.log('[首页] projects:', projectsRes?.data)
      console.log('[首页] resources:', resourcesRes?.data)
      console.log('[首页] posts:', postsRes?.data)

      if (bannersRes?.data?.data) setBanners(bannersRes.data.data.slice(0, 5))
      if (projectsRes?.data?.data) setRoadshows(projectsRes.data.data.slice(0, 6))
      if (resourcesRes?.data?.data) setResources(resourcesRes.data.data.slice(0, 5))
      if (postsRes?.data?.data) setFeeds(postsRes.data.data.slice(0, 5))
    } catch (err) {
      console.error('[首页] 加载数据失败:', err)
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
    const mins = Math.floor(diff / 60000)
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
          Taro.showToast({ title: '文章详情开发中', icon: 'none' })
        }
        break
      case 'event':
        if (config.event_id) {
          Taro.switchTab({ url: '/pages/discover/index' })
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

  return (
    <ScrollView scrollY className="h-full bg-[#F5F6FA]">
      {/* ── Custom Header ── */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-5">
        <View style={{ height: `${statusBarHeight}px` }} />
        <View className="flex flex-row items-center justify-between mb-3">
          <View className="flex flex-row items-center gap-2">
            <Text className="block text-xl font-bold text-white">星河百谷</Text>
            <Text className="block text-xs text-[#E8D5A8] bg-[#F4EEE2] px-2 py-0 rounded-full">商会会员平台</Text>
          </View>
          <View className="relative" onClick={() => Taro.switchTab({ url: '/pages/message/index' })}>
            <Bell size={20} color="#ffffff" />
            <View className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          </View>
        </View>
        {/* Search Bar */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} className="rounded-xl px-3 py-2 flex flex-row items-center gap-2">
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索项目、人才、资源...</Text>
        </View>
      </View>

      {/* ── Banner Carousel ── */}
      {banners.length > 0 && (
        <View className="px-4 -mt-2">
          <Carousel
            opts={{ autoplay: true, interval: 4000, duration: 500, loop: true }}
            className="rounded-2xl overflow-hidden"
          >
            <CarouselContent>
              {banners.map((banner) => (
                <CarouselItem key={banner.id}>
                  {banner.image_url ? (
                    <View className="rounded-2xl overflow-hidden relative" style={{ height: '140px' }} onClick={() => handleBannerClick(banner)}>
                      <Image src={banner.image_url} mode="aspectFill" className="w-full h-full" />
                      <View className="absolute left-0 bottom-0 right-0 p-4" style={{ background: 'linear-gradient(transparent, rgba(27,42,74,0.85))' }}>
                        <Text className="block text-white text-base font-bold">{banner.title}</Text>
                      </View>
                    </View>
                  ) : (
                    <View className="bg-gradient-to-br from-[#1B2A4A] to-[#3B5998] rounded-2xl p-5 relative overflow-hidden" onClick={() => handleBannerClick(banner)}>
                      <View className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      <View className="absolute left-0 bottom-0 right-0 h-1 bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] rounded-full" />
                      <Text className="block text-white text-lg font-bold mb-1">{banner.title}</Text>
                      <View className="rounded-lg px-3 py-1 self-start" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <Text className="block text-white text-xs font-medium">立即参与 →</Text>
                      </View>
                    </View>
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselDots total={banners.length} />
          </Carousel>
        </View>
      )}

      {/* ── Quick Entry Grid ── */}
      <View className="px-4 mt-5">
        <View className="bg-white rounded-2xl p-4 shadow-sm">
          <View className="grid grid-cols-4 gap-y-4">
            {QUICK_ENTRIES.map((entry) => (
              <View key={entry.label} className="flex flex-col items-center gap-1" onClick={() => {
                if (entry.path) {
                  if (entry.path.includes('/pages/')) {
                    const isTab = ['index', 'business', 'discover', 'message', 'profile'].some(t => entry.path.includes(t + '/index'))
                    if (isTab) {
                      Taro.switchTab({ url: entry.path })
                    } else {
                      Taro.navigateTo({ url: entry.path })
                    }
                  }
                }
              }}
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
                <Card key={item.id} className="min-w-[260px] shadow-sm border-0 overflow-hidden flex-shrink-0">
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
            <View className="flex flex-row items-center gap-0">
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
        <View className="flex items-center justify-center py-20">
          <Text className="block text-sm text-gray-400">暂无数据，请在后台配置Banner和内容</Text>
        </View>
      )}

      {/* Bottom padding for TabBar */}
      <View className="h-16" />
    </ScrollView>
  )
}

export default IndexPage
