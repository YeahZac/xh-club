import { useState } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { Gift, ShoppingCart, Package } from "lucide-react-taro"
import { Network } from "@/network"
import { getCartCount } from "@/lib/mall-cart"

interface Product {
  id: string
  name: string
  description: string
  image_url: string
  points_price: number
  cash_price: string
  stock: number
  status: string
  sales_count: number
}

const MallPage = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)
  const [cartCount, setCartCount] = useState(0)

  useDidShow(() => {
    loadProducts()
    loadUserPoints()
    setCartCount(getCartCount())
  })

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: "/api/mall/products" })
      console.log("[商城] products:", res?.data)
      const list = res?.data?.data
      setProducts(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error("[商城] 加载失败:", err)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const loadUserPoints = async () => {
    try {
      const memberId = Taro.getStorageSync("member_id")
      if (!memberId) return
      const res = await Network.request({ url: `/api/members/profile/${memberId}` })
      if (res?.data?.data) {
        setUserPoints(res.data.data.available_points || 0)
      }
    } catch (err) {
      console.error("[商城] 加载积分失败:", err)
    }
  }

  const goToProductDetail = (productId: string) => {
    Taro.navigateTo({ url: `/pages/mall/product-detail/index?id=${productId}` })
  }

  const canAfford = (pointsPrice: number) => userPoints >= pointsPrice

  return (
    <ScrollView scrollY className="h-screen bg-[#F7F5F1]">
      <View className="bg-gradient-to-br from-[#1B2A4A] via-[#243656] to-[#2D4A7A] px-4 pt-5 pb-6">
        <View className="flex flex-row items-end justify-between">
          <View>
            <Text className="block text-white/65 text-xs tracking-wide">我的可用积分</Text>
            <Text className="block text-white text-3xl font-bold mt-1 tracking-tight">
              {userPoints.toLocaleString()}
            </Text>
          </View>
          <View className="flex flex-row items-center gap-2.5">
            <View
              className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              onClick={() => Taro.navigateTo({ url: "/pages/mall/orders/index" })}
            >
              <Package size={18} color="#fff" />
            </View>
            <View
              className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              onClick={() => Taro.navigateTo({ url: "/pages/mall/cart/index" })}
            >
              <ShoppingCart size={18} color="#fff" />
              {cartCount > 0 ? (
                <View className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#C9A96E] flex items-center justify-center">
                  <Text className="text-white text-xs leading-none">
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View className="mt-4 flex flex-row items-center gap-2">
          <Gift size={14} color="#C9A96E" />
          <Text className="block text-white/70 text-xs">积分兑换精选好物 · 兑换后等待发货</Text>
        </View>
      </View>

      <View className="px-3.5 -mt-3 pb-10">
        {loading ? (
          <View className="bg-white rounded-3xl py-16 flex items-center justify-center">
            <Text className="text-gray-400 text-sm">好物加载中...</Text>
          </View>
        ) : products.length === 0 ? (
          <View className="bg-white rounded-3xl py-16 flex flex-col items-center justify-center">
            <ShoppingCart size={36} color="#d1d5db" />
            <Text className="block text-gray-400 text-sm mt-3">暂无可兑换商品</Text>
          </View>
        ) : (
          <View className="flex flex-row flex-wrap justify-between">
            {products.map((product) => {
              const affordable = canAfford(product.points_price)
              return (
                <View
                  key={product.id}
                  className="w-[48.5%] mb-3 bg-white rounded-2xl overflow-hidden"
                  onClick={() => goToProductDetail(product.id)}
                >
                  <View className="relative">
                    <Image
                      src={product.image_url}
                      className="w-full aspect-square"
                      mode="aspectFill"
                    />
                    {product.stock <= 0 ? (
                      <View className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <Text className="text-white text-sm font-medium">已售罄</Text>
                      </View>
                    ) : (
                      <View
                        className={`absolute top-2 left-2 rounded-full px-2 py-0.5 ${
                          affordable ? "bg-[#1B2A4A]/80" : "bg-black/40"
                        }`}
                      >
                        <Text className="block text-white text-xs">
                          {affordable ? "可兑换" : "积分不足"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="px-2.5 pt-2.5 pb-3">
                    <Text className="block text-sm font-medium text-[#1A1D2E] leading-snug line-clamp-2 min-h-10">
                      {product.name}
                    </Text>
                    <View className="flex flex-row items-baseline mt-2">
                      <Text className="text-[#C9A96E] text-lg font-bold leading-none">
                        {product.points_price}
                      </Text>
                      <Text className="text-[#C9A96E] text-xs ml-1">积分</Text>
                    </View>
                    <Text className="block text-gray-400 text-xs mt-1.5">
                      已兑 {product.sales_count || 0}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default MallPage
