import { View, Text, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Presentation, UserPlus, CalendarDays,
  UserSearch, Search, Info, FolderPlus, Crown,
  Bell, Eye, ScanLine,
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
import { ensurePromoterOrMemberUnit } from "@/lib/member-access"
import { fetchUnreadNotificationCount } from "@/lib/notifications"
import { parseInviteCodeFromScan } from "@/lib/invite-code"
import {
  brandColors,
  EmptyState,
  HomeHeroHeader,
  icon,
  layout,
  PageShell,
  QuickEntryGrid,
  SearchBar,
  SectionTitle,
  SoftCard,
} from "@/components/brand-ui"
import { openContentDetail, openExternalUrl, openMiniProgram, pickId } from "@/lib/content-navigation"
import { isDisplayableImageUrl } from "@/lib/media-url"
import { loadWithListCache, getListCache } from "@/lib/list-cache"
import { useMediaRefresh } from "@/lib/use-media-refresh"
import { useTabShareAppMessage } from "@/lib/mini-program-share"
import { Network } from "@/network"

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

const CarouselDots = ({ total }: { total: number }) => {
  const { current } = useCarousel()
  if (total <= 1) return null
  return (
    <View className="absolute bottom-3 left-0 right-0 z-20 flex flex-row justify-center gap-2 pointer-events-none">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-2 rounded-full transition-all ${i === current ? "w-4 bg-white" : "w-2 bg-white bg-opacity-50"}`}
        />
      ))}
    </View>
  )
}

type QuickEntry = {
  label: string
  icon: typeof Presentation
  variant: "blue" | "gold" | "mint"
  path: string
  navType?: "switchTab" | "navigate"
  tabStorageKey?: string
  tabValue?: string
}

const QUICK_ENTRIES: QuickEntry[] = [
  { label: "关于我们", icon: Info, variant: "gold", path: "/pages/about/index", navType: "navigate" },
  { label: "项目查询", icon: Search, variant: "blue", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "projects" },
  { label: "会员推荐", icon: UserPlus, variant: "gold", path: "/pages/invite/index", navType: "navigate" },
  { label: "人才查询", icon: UserSearch, variant: "blue", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "talents" },
  { label: "活动报名", icon: CalendarDays, variant: "mint", path: "/pages/discover/index", tabStorageKey: "discover_initial_tab", tabValue: "events" },
  { label: "项目路演", icon: Presentation, variant: "blue", path: "/pages/business/index", tabStorageKey: "business_initial_tab", tabValue: "roadshow" },
  { label: "发布项目", icon: FolderPlus, variant: "blue", path: "/pages/publish-project/index", navType: "navigate" },
  { label: "加入会员", icon: Crown, variant: "gold", path: "/pages/member-apply/index", navType: "navigate" },
]

const FEED_COVER_ASPECT: Record<string, string> = {
  event: "aspect-[69/29]",
  product: "aspect-square",
  project: "aspect-video",
  article: "aspect-video",
  financing: "aspect-video",
  roadshow: "aspect-video",
  resource: "aspect-video",
  life: "aspect-video",
}

const getFeedCoverAspect = (item: HomepageFeedItem) =>
  FEED_COVER_ASPECT[item.content_type] || FEED_COVER_ASPECT[item.detail_type] || "aspect-video"

const bannerImageKey = (banner: BannerItem) => `${banner.id}:${banner.image_url || ""}`
const feedImageKey = (item: HomepageFeedItem) => `${item.id}:${item.cover_image || ""}`

const IndexPage = () => {
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [feedItems, setFeedItems] = useState<HomepageFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [failedBannerImages, setFailedBannerImages] = useState<Set<string>>(() => new Set())
  const [failedFeedImages, setFailedFeedImages] = useState<Set<string>>(() => new Set())
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const firstLoadRef = useRef(true)

  useTabShareAppMessage("index")

  const loadUnreadCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount()
    setUnreadNotifications(count)
  }, [])

  const loadHomeData = useCallback(async (options?: { force?: boolean }) => {
    try {
      const hasCache = !options?.force && !!getListCache('home:feed')
      if (firstLoadRef.current && !hasCache) setLoading(true)
      setLoadFailed(false)

      type HomeBundle = { banners: BannerItem[]; feed: HomepageFeedItem[] }
      await loadWithListCache(
        'home:feed',
        async () => {
          const [bannersRes, feedRes] = await Promise.all([
            Network.request({ url: "/api/banners" }).catch((error) => {
              console.error("[首页] Banner加载失败:", error)
              return null
            }),
            Network.request({ url: "/api/homepage/feed" }).catch((error) => {
              console.error("[首页] 瀑布流加载失败:", error)
              return null
            }),
          ])

          const requestFailed = [bannersRes, feedRes].some((response) => response === null)
          let banners: BannerItem[] = []
          let feed: HomepageFeedItem[] = []

          if (bannersRes) {
            const list = getResponseList<BannerItem>(bannersRes.data?.data ?? bannersRes.data)
            banners = list.map((banner: BannerItem) => {
              let linkConfig = banner.link_config || {}
              if (typeof banner.link_config === "string") {
                try {
                  linkConfig = JSON.parse(banner.link_config)
                } catch {
                  linkConfig = {}
                }
              }
              return { ...banner, link_config: linkConfig }
            })
            banners = [...banners].sort((a, b) => {
              const ao = Number(a.sort_order)
              const bo = Number(b.sort_order)
              const aOrder = Number.isFinite(ao) ? ao : 0
              const bOrder = Number.isFinite(bo) ? bo : 0
              if (aOrder !== bOrder) return aOrder - bOrder
              return Number(a.id) - Number(b.id)
            }).slice(0, 5)
          }

          if (feedRes) {
            const payload = feedRes.data?.data
            const mode = String(payload?.sort_mode || "custom")
            feed = Array.isArray(payload?.list)
              ? payload.list
              : getResponseList<HomepageFeedItem>(payload)

            // 客户端兜底：与后端约定一致，避免旧缓存/旧接口顺序异常
            const byCustom = (a: HomepageFeedItem, b: HomepageFeedItem) => {
              const ao = Number(a.sort_order)
              const bo = Number(b.sort_order)
              const aOrder = Number.isFinite(ao) ? ao : 0
              const bOrder = Number.isFinite(bo) ? bo : 0
              if (aOrder !== bOrder) return aOrder - bOrder
              return Number(a.id) - Number(b.id)
            }
            if (mode === "view_count") {
              feed = [...feed].sort(
                (a, b) =>
                  (Number(b.view_count) || 0) - (Number(a.view_count) || 0) || byCustom(a, b),
              )
            } else if (mode === "time_desc") {
              feed = [...feed].sort((a, b) => {
                const ta = a.created_at ? new Date(a.created_at).getTime() : 0
                const tb = b.created_at ? new Date(b.created_at).getTime() : 0
                return tb - ta || byCustom(a, b)
              })
            } else {
              feed = [...feed].sort(byCustom)
            }
          }

          if (requestFailed && banners.length === 0 && feed.length === 0) {
            throw new Error('home load failed')
          }
          return { banners, feed } satisfies HomeBundle
        },
        {
          force: options?.force,
          ttlMs: 60_000,
          onData: (bundle) => {
            setBanners(bundle.banners || [])
            setFeedItems(bundle.feed || [])
            setFailedBannerImages(new Set())
            setFailedFeedImages(new Set())
          },
        },
      )
    } catch (err) {
      console.error("[首页] 加载数据失败:", err)
      setLoadFailed(true)
    } finally {
      firstLoadRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHomeData()
    const timer = setTimeout(() => {
      void loadUnreadCount()
    }, 800)
    const onLogin = () => { void loadUnreadCount() }
    Taro.eventCenter.on(AUTH_LOGGED_IN_EVENT, onLogin)
    return () => {
      clearTimeout(timer)
      Taro.eventCenter.off(AUTH_LOGGED_IN_EVENT, onLogin)
    }
  }, [loadHomeData, loadUnreadCount])

  useDidShow(() => {
    void loadHomeData({ force: true })
    setTimeout(() => {
      void loadUnreadCount()
    }, 400)
  })

  const { onImageError } = useMediaRefresh(() => loadHomeData({ force: true }))

  const openFeedItem = (item: HomepageFeedItem) => {
    openContentDetail(item.detail_type || item.content_type, item.detail_id || item.item_id)
  }

  const leftFeed = feedItems.filter((_, index) => index % 2 === 0)
  const rightFeed = feedItems.filter((_, index) => index % 2 === 1)

  const handleBannerClick = (banner: BannerItem) => {
    const config = banner.link_config || {}
    const linkType = String(banner.link_type || "").trim()

    switch (linkType) {
      case "article":
        openContentDetail("article", pickId(config.article_id, banner.link_id))
        break
      case "event":
        openContentDetail("event", pickId(config.event_id, banner.link_id))
        break
      case "project":
        openContentDetail("project", pickId(config.project_id, banner.link_id))
        break
      case "financing":
      case "roadshow":
      case "resource":
      case "life":
      case "business":
        openContentDetail("business", pickId(config.business_id, banner.link_id))
        break
      case "product":
        openContentDetail("product", pickId(config.product_id, banner.link_id))
        break
      case "link":
        openExternalUrl(String(config.url || ""))
        break
      case "miniapp":
        openMiniProgram(String(config.appid || ""), String(config.path || ""))
        break
      default:
        Taro.showToast({ title: "暂不支持该跳转类型", icon: "none" })
        break
    }
  }

  const handleQuickEntryClick = async (entry: QuickEntry) => {
    if (!entry.path) {
      Taro.showToast({ title: "功能建设中，敬请期待", icon: "none" })
      return
    }
    // 会员推荐：所有会员类型均可进入；发布项目仍仅限推广员/会员单位
    if (entry.path === "/pages/publish-project/index") {
      if (!(await ensurePromoterOrMemberUnit("发布项目"))) return
    }
    if (entry.tabStorageKey && entry.tabValue) {
      Taro.setStorageSync(entry.tabStorageKey, entry.tabValue)
    }
    if (entry.navType === "navigate") {
      Taro.navigateTo({ url: entry.path })
      return
    }
    Taro.switchTab({ url: entry.path })
  }

  const handleBannerImageError = (bannerKey: string) => {
    setFailedBannerImages((current) => new Set(current).add(bannerKey))
    onImageError()
  }

  const openMessages = async () => {
    if (!isLoggedIn()) {
      const ok = await ensureLogin("")
      if (!ok) return
      await loadUnreadCount()
    }
    Taro.navigateTo({ url: "/pages/message/index" })
  }

  const scanInviteCode = async () => {
    try {
      const result = await Taro.scanCode({
        onlyFromCamera: false,
        scanType: ["qrCode", "barCode"],
      })
      const code = parseInviteCodeFromScan(String(result?.result || ""))
      if (!code) {
        Taro.showToast({ title: "未识别邀请码", icon: "none" })
        return
      }
      Taro.navigateTo({
        url: `/pages/login/index?from=invite&code=${encodeURIComponent(code)}`,
      })
    } catch (error) {
      const msg = String((error as any)?.errMsg || (error as Error)?.message || "")
      if (msg.toLowerCase().includes("cancel") || msg.includes("取消")) return
      Taro.showToast({ title: "扫码失败", icon: "none" })
    }
  }

  return (
    <PageShell>
      <HomeHeroHeader>
        <SearchBar
          text="搜索项目、人才、资源..."
          onClick={() => Taro.navigateTo({ url: "/pages/search/index" })}
          trailing={(
            <View className="flex flex-shrink-0 flex-row items-center gap-2">
              <View
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
                onClick={(event) => {
                  event.stopPropagation()
                  void scanInviteCode()
                }}
              >
                <ScanLine size={icon.md} color={brandColors.goldLight} strokeWidth={icon.stroke} />
              </View>
              <View
                className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
                onClick={(event) => {
                  event.stopPropagation()
                  void openMessages()
                }}
              >
                <Bell size={icon.md} color={brandColors.goldLight} strokeWidth={icon.stroke} />
                {unreadNotifications > 0 ? (
                  <View
                    className="absolute flex items-center justify-center rounded-full bg-destructive"
                    style={{ top: -2, right: -2, minWidth: 16, height: 16, paddingLeft: 4, paddingRight: 4 }}
                  >
                    <Text className="block text-xs font-semibold leading-none text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />
      </HomeHeroHeader>

      {banners.length > 0 && (
        <View className="px-4">
          <Carousel
            key={banners.map((item) => `${item.id}:${item.image_url || ""}`).join("|")}
            opts={{ autoplay: true, interval: 4000, duration: 500, loop: true }}
            className="w-full"
          >
            <View
              className="relative w-full overflow-hidden rounded-2xl"
              style={{ paddingBottom: `${(34 / 69) * 100}%` }}
            >
              <View className="absolute inset-0">
                <CarouselContent className="h-full">
                  {banners.map((banner) => (
                    <CarouselItem key={banner.id} className="h-full">
                      <View
                        className="relative h-full w-full overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${brandColors.navyDeep}, ${brandColors.navySecondary})` }}
                      >
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
                          className="absolute bottom-0 left-0 right-0 z-10 px-4 py-3 pb-6"
                          style={{ background: "linear-gradient(transparent, rgba(16,38,74,0.55))" }}
                        >
                          <Text className="block text-sm font-semibold leading-snug text-white">{banner.title}</Text>
                        </View>
                        <View
                          className="absolute inset-0 z-40"
                          style={{ backgroundColor: "rgba(0,0,0,0.001)" }}
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

      <View className="mt-4 px-4">
        <SectionTitle title="常用入口" subtitle="一键抵达会员服务" />
        <QuickEntryGrid
          entries={QUICK_ENTRIES.map((entry) => ({
            label: entry.label,
            icon: entry.icon,
            variant: entry.variant,
            onClick: () => handleQuickEntryClick(entry),
          }))}
        />
      </View>

      {feedItems.length > 0 && (
        <View className="mt-5 px-4">
          <SectionTitle
            title="精选内容"
            subtitle="为你筛选近期值得关注的信息"
            extra={<Badge variant="gold">{feedItems.length}</Badge>}
          />
          <View className="flex flex-row items-start gap-3">
            {[leftFeed, rightFeed].map((column, colIdx) => (
              <View key={colIdx} className="flex flex-1 flex-col gap-3">
                {column.map((item) => {
                  const key = feedImageKey(item)
                  const coverOk = isDisplayableImageUrl(item.cover_image || "") && !failedFeedImages.has(key)
                  const aspectClass = getFeedCoverAspect(item)
                  return (
                    <SoftCard
                      key={item.id}
                      className="overflow-hidden"
                      onClick={() => openFeedItem(item)}
                    >
                      {coverOk ? (
                        <View className={`relative w-full overflow-hidden ${aspectClass}`}>
                          <Image
                            key={key}
                            src={item.cover_image!}
                            mode="aspectFill"
                            className="absolute inset-0 h-full w-full"
                            lazyLoad
                            onError={() => {
                              setFailedFeedImages((prev) => new Set(prev).add(key))
                              onImageError()
                            }}
                          />
                        </View>
                      ) : (
                        <View
                          className={`flex w-full items-center justify-center px-3 ${aspectClass}`}
                          style={{ background: `linear-gradient(135deg, ${brandColors.navyDeep}, ${brandColors.navySecondary})` }}
                        >
                          <Text className="block text-center text-xs font-semibold text-white">{item.title}</Text>
                        </View>
                      )}
                      <View className="p-3">
                        <Text className="block text-sm font-semibold leading-snug text-foreground line-clamp-2">{item.title}</Text>
                        <View className="mt-2 flex flex-row items-center justify-between">
                          <Badge variant="soft">{item.content_type_label || item.content_type}</Badge>
                          <View className="flex flex-row items-center gap-1">
                            <Eye size={icon.sm} color={brandColors.muted} strokeWidth={icon.stroke} />
                            <Text className="block text-xs text-muted-foreground">{item.view_count || 0}</Text>
                          </View>
                        </View>
                      </View>
                    </SoftCard>
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      )}

      {loading && (
        <View className="flex items-center justify-center py-12">
          <Text className="block text-sm text-muted-foreground">正在整理星河内容...</Text>
        </View>
      )}

      {!loading && banners.length === 0 && feedItems.length === 0 && (
        <View className="px-4 py-8">
          <EmptyState
            title={loadFailed ? "内容加载失败" : "暂无内容"}
            description={loadFailed ? "请检查网络后重试" : "请在后台配置 Banner 和精选内容"}
            icon={Presentation}
          />
          {loadFailed && (
            <View className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={loadHomeData}>
                <Text className="block text-sm">重新加载</Text>
              </Button>
            </View>
          )}
        </View>
      )}

      <View className={layout.bottomBarPad} />
    </PageShell>
  )
}

export default IndexPage
