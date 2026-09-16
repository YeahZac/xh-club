import { useState, useCallback } from "react"
import { View, Text, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { ClipboardList, Gift, ShoppingCart } from "lucide-react-taro"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  brandColors,
  EmptyState,
  HeroHeader,
  icon,
  layout,
  PageShell,
  SectionTitle,
  SoftCard,
} from "@/components/brand-ui"
import { useMediaRefresh } from "@/lib/use-media-refresh"
import { LIST_FIELDS_QUERY, loadWithListCache, getListCache } from "@/lib/list-cache"
import { Network } from "@/network"
import { getCartCount } from "@/lib/mall-cart"
import { isLoggedIn } from "@/lib/auth"
import { useTabShareAppMessage } from "@/lib/mini-program-share"

interface Product {
  id: string
  name: string
  description: string
  image_url: string
  points_price: number
  cash_price: string
  stock: number
  status: string
  sort_order?: number
}

const MallPage = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)
  const [pointsReady, setPointsReady] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  useTabShareAppMessage('mall')

  const loadProducts = useCallback(async (options?: { force?: boolean }) => {
    const cacheKey = 'mall:products'
    const hasCache = !options?.force && !!getListCache(cacheKey)
    if (!hasCache) setLoading(true)
    try {
      await loadWithListCache(
        cacheKey,
        async () => {
          const res = await Network.request({ url: `/api/mall/products?${LIST_FIELDS_QUERY}` })
          const list = res?.data?.data
          const products = Array.isArray(list) ? (list as Product[]) : []
          return [...products].sort((a, b) => {
            const ao = Number(a.sort_order)
            const bo = Number(b.sort_order)
            const aOrder = Number.isFinite(ao) ? ao : 0
            const bOrder = Number.isFinite(bo) ? bo : 0
            if (aOrder !== bOrder) return aOrder - bOrder
            return Number(a.id) - Number(b.id)
          })
        },
        {
          force: options?.force,
          ttlMs: 90_000,
          onData: (list) => setProducts(list),
        },
      )
    } catch (err) {
      console.error("[商城] 加载商品失败:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    void loadProducts()
    void loadUserPoints()
    setCartCount(getCartCount())
  })

  const { onImageError } = useMediaRefresh(() => loadProducts({ force: true }), { skipFirstShow: true })

  const loadUserPoints = async () => {
    try {
      if (!isLoggedIn()) {
        setUserPoints(0)
        return
      }
      const memberId = Taro.getStorageSync("member_id")
      if (!memberId) {
        setUserPoints(0)
        return
      }
      const res = await Network.request({ url: `/api/members/profile/${memberId}` })
      if (res?.data?.data) {
        setUserPoints(res.data.data.available_points || 0)
      }
    } catch (err) {
      console.error("[商城] 加载积分失败:", err)
    } finally {
      setPointsReady(true)
    }
  }

  const hasAvailablePoints = isLoggedIn() && userPoints > 0

  const goToProductDetail = (productId: string) => {
    Taro.navigateTo({ url: `/pages/mall/product-detail/index?id=${productId}` })
  }

  const canAfford = (pointsPrice: number) => userPoints >= pointsPrice

  return (
    <PageShell>
      <HeroHeader
        title="积分商城"
        subtitle="会员积分兑换精选好物"
        compact
      >
        <View
          className="overflow-hidden rounded-xl px-4 py-3"
          style={{
            backgroundColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "rgba(255,255,255,0.18)",
          }}
        >
          <View className="flex flex-row items-center">
            <View className="min-w-0 flex-1">
              <View className="flex flex-row items-center gap-2">
                <Gift size={icon.sm} color={brandColors.gold} strokeWidth={icon.stroke} />
                <Text className="block text-xs font-medium" style={{ color: brandColors.goldLight }}>
                  可用积分
                </Text>
              </View>
              <View className="mt-1">
                {pointsReady && !hasAvailablePoints ? (
                  <Text className="block text-sm text-white text-opacity-90">暂无可用积分</Text>
                ) : (
                  <View className="flex flex-row items-baseline gap-1">
                    <Text className="block text-2xl font-semibold tracking-tight text-white">
                      {userPoints.toLocaleString()}
                    </Text>
                    <Text className="block text-xs text-white text-opacity-80">积分</Text>
                  </View>
                )}
              </View>
            </View>
            <View className="flex flex-row items-center gap-2">
              <View onClick={() => Taro.navigateTo({ url: "/pages/mall/orders/index" })}>
                <View
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <ClipboardList size={icon.md} color="#ffffff" strokeWidth={icon.stroke} />
                </View>
              </View>
              <View
                className="relative"
                onClick={() => Taro.navigateTo({ url: "/pages/mall/cart/index" })}
              >
                <View
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <ShoppingCart size={icon.md} color="#ffffff" strokeWidth={icon.stroke} />
                </View>
                {cartCount > 0 ? (
                  <View className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1">
                    <Text className="text-xs leading-none text-white">{cartCount > 99 ? "99+" : cartCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </HeroHeader>

      <View className={`px-4 ${layout.bottomBarPad}`}>
        <SectionTitle title="精选好物" subtitle="为会员权益精选" />
        {loading ? (
          <SoftCard className="flex items-center justify-center py-16">
            <Text className="text-sm text-muted-foreground">好物加载中...</Text>
          </SoftCard>
        ) : products.length === 0 ? (
          <EmptyState title="暂无可兑换商品" description="商城商品上架后会显示在这里" icon={ShoppingCart} />
        ) : (
          <View className="grid grid-cols-2 gap-4">
            {products.map((product) => {
              const affordable = canAfford(product.points_price)
              const soldOut = product.stock <= 0
              return (
                <SoftCard
                  key={product.id}
                  className="overflow-hidden"
                  onClick={() => goToProductDetail(product.id)}
                >
                  <View className="relative aspect-square w-full overflow-hidden bg-muted">
                    <Image
                      key={`mall-img-${product.id}-${product.image_url || ''}`}
                      src={product.image_url}
                      className="absolute inset-0 h-full w-full"
                      mode="aspectFill"
                      lazyLoad
                      onError={onImageError}
                    />
                    {soldOut ? (
                      <View className="absolute inset-0 flex items-center justify-center bg-primary bg-opacity-40">
                        <Text className="text-sm font-medium text-white">已售罄</Text>
                      </View>
                    ) : (
                      <View className="absolute left-2 top-2">
                        <Badge variant={affordable ? "gold" : "soft"} className="px-3 py-1">
                          {affordable ? "可兑换" : "积分不足"}
                        </Badge>
                      </View>
                    )}
                  </View>
                  <View className="px-3 pb-3 pt-2">
                    <Text className="block min-h-10 text-sm font-semibold leading-snug text-foreground line-clamp-2">
                      {product.name}
                    </Text>
                    <View className="mt-2 flex flex-row items-end justify-between gap-2">
                      <View className="min-w-0 flex flex-row items-baseline">
                        <Text className="text-base font-bold leading-none text-accent-foreground">
                          {product.points_price}
                        </Text>
                        <Text className="ml-1 text-xs text-accent-foreground">积分</Text>
                      </View>
                      <Button
                        size="sm"
                        variant={soldOut ? "secondary" : "brand"}
                        className="h-7 flex-shrink-0 rounded-md px-2 text-xs"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (soldOut) {
                            Taro.showToast({ title: "已售罄", icon: "none" })
                            return
                          }
                          goToProductDetail(product.id)
                        }}
                      >
                        {soldOut ? "已售罄" : "立即购买"}
                      </Button>
                    </View>
                  </View>
                </SoftCard>
              )
            })}
          </View>
        )}
      </View>
    </PageShell>
  )
}

export default MallPage
