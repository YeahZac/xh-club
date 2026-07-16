import { useState } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { Gift, ShoppingCart, Package } from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    <ScrollView scrollY className="h-screen bg-[#F5F6FA]">
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-3.5 pt-4 pb-5">
        <View className="flex items-center justify-between">
          <View>
            <Text className="block text-white text-opacity-80 text-xs">我的积分</Text>
            <Text className="block text-white text-2xl font-bold mt-0.5">
              {userPoints.toLocaleString()}
            </Text>
          </View>
          <View className="flex items-center gap-2">
            <View
              className="bg-white bg-opacity-20 rounded-xl px-3 py-2"
              onClick={() => Taro.navigateTo({ url: "/pages/mall/orders/index" })}
            >
              <Package size={18} color="#fff" />
            </View>
            <View
              className="relative bg-white bg-opacity-20 rounded-xl px-3 py-2"
              onClick={() => Taro.navigateTo({ url: "/pages/mall/cart/index" })}
            >
              <ShoppingCart size={18} color="#fff" />
              {cartCount > 0 && (
                <View className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 flex items-center justify-center">
                  <Text className="text-white text-xs">{cartCount > 99 ? "99+" : cartCount}</Text>
                </View>
              )}
            </View>
            <View className="bg-white bg-opacity-20 rounded-xl p-2.5">
              <Gift size={22} color="#fff" />
            </View>
          </View>
        </View>
        <Text className="block text-white text-opacity-80 text-xs mt-3">
          仅支持积分兑换 · 支付成功后等待发货
        </Text>
      </View>

      <View className="px-3.5 py-3">
        {loading ? (
          <View className="flex justify-center items-center py-12">
            <Text className="text-gray-400 text-xs">加载中...</Text>
          </View>
        ) : products.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-12">
            <ShoppingCart size={36} color="#d1d5db" />
            <Text className="text-gray-400 text-xs mt-3">暂无商品</Text>
          </View>
        ) : (
          <View className="grid grid-cols-2 gap-2">
            {products.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden"
                onClick={() => goToProductDetail(product.id)}
              >
                <View className="relative">
                  <Image
                    src={product.image_url}
                    className="w-full aspect-square object-cover"
                    mode="aspectFill"
                  />
                  {product.stock <= 0 && (
                    <View className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <Text className="text-white text-sm font-medium">已售罄</Text>
                    </View>
                  )}
                </View>
                <CardContent className="p-2">
                  <Text className="block text-xs font-medium text-gray-900 line-clamp-2">
                    {product.name}
                  </Text>
                  <View className="flex items-center justify-between mt-1.5">
                    <View>
                      <Text className="text-[#C9A96E] text-base font-bold">
                        {product.points_price}
                      </Text>
                      <Text className="text-[#C9A96E] text-xs ml-0.5">积分</Text>
                    </View>
                    <Badge
                      className={
                        canAfford(product.points_price)
                          ? "bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0"
                          : "bg-gray-100 text-gray-500 text-xs px-1.5 py-0"
                      }
                    >
                      {canAfford(product.points_price) ? "可兑换" : "积分不足"}
                    </Badge>
                  </View>
                  <Text className="block text-gray-400 text-xs mt-1">已售{product.sales_count || 0}</Text>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View className="px-3.5 pb-8">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => Taro.navigateTo({ url: "/pages/mall/orders/index" })}
        >
          我的订单
        </Button>
      </View>
    </ScrollView>
  )
}

export default MallPage
