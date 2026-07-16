import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { Gift, ShoppingCart, Star } from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Network } from "@/network"

interface Product {
  id: string
  name: string
  description: string
  image_url: string
  points_price: number
  cash_price: string
  stock: number
  category: string
  status: string
  enable_distribution: boolean
  distribution_rate: string
  sales_count: number
}

const categoryMap: Record<string, string> = {
  all: "全部",
  rights: "会员权益",
  service: "专属服务",
  gift: "精美礼品",
  activity: "活动门票",
  learning: "学习课程",
}

const MallPage = () => {
  const [activeCategory, setActiveCategory] = useState("all")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)

  useEffect(() => {
    loadProducts()
    loadUserPoints()
  }, [activeCategory])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const url = activeCategory === "all"
        ? "/api/mall/products"
        : `/api/mall/products?category=${activeCategory}`
      const res = await Network.request({ url })
      console.log("[商城] products:", res?.data)
      if (res?.data?.data) {
        setProducts(res.data.data)
      }
    } catch (err) {
      console.error("[商城] 加载失败:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadUserPoints = async () => {
    try {
      const memberId = Taro.getStorageSync("member_id")
      if (!memberId) return
      const res = await Network.request({ url: `/api/members/profile/${memberId}` })
      console.log("[商城] user profile:", res?.data)
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
    <ScrollView scrollY className="h-screen bg-gray-50">
      {/* 积分余额卡片 */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pt-6 pb-8">
        <View className="flex items-center justify-between">
          <View>
            <Text className="block text-white text-opacity-80 text-sm">我的积分</Text>
            <Text className="block text-white text-3xl font-bold mt-1">
              {userPoints.toLocaleString()}
            </Text>
          </View>
          <View className="bg-white bg-opacity-20 rounded-full p-3">
            <Gift size={28} color="#fff" />
          </View>
        </View>
        <View className="flex items-center gap-2 mt-4 bg-white bg-opacity-10 rounded-xl px-3 py-2">
          <Star size={14} color="#C9A96E" />
          <Text className="text-white text-opacity-90 text-xs">
            积分可兑换商品或抵扣现金，邀请好友还可获得分销收益
          </Text>
        </View>
      </View>

      {/* 分类标签 */}
      <View className="bg-white px-4 py-3 sticky top-0 z-10">
        <ScrollView scrollX className="whitespace-nowrap">
          <View className="flex gap-2">
            {Object.entries(categoryMap).map(([key, label]) => (
              <View
                key={key}
                className={`px-4 py-2 rounded-full text-sm ${
                  activeCategory === key
                    ? "bg-[#1B2A4A] text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
                onClick={() => setActiveCategory(key)}
              >
                {label}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 商品列表 */}
      <View className="px-4 py-4">
        {loading ? (
          <View className="flex justify-center items-center py-20">
            <Text className="text-gray-400 text-sm">加载中...</Text>
          </View>
        ) : products.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <ShoppingCart size={48} color="#d1d5db" />
            <Text className="text-gray-400 text-sm mt-4">暂无商品</Text>
          </View>
        ) : (
          <View className="grid grid-cols-2 gap-3">
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
                  {product.enable_distribution && (
                    <View className="absolute top-2 left-2 bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] px-2 py-1 rounded-md">
                      <Text className="text-white text-xs font-medium">
                        赚{product.distribution_rate}%
                      </Text>
                    </View>
                  )}
                  {product.stock <= 0 && (
                    <View className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <Text className="text-white text-sm font-medium">已售罄</Text>
                    </View>
                  )}
                </View>
                <CardContent className="p-3">
                  <Text className="block text-sm font-medium text-gray-900 line-clamp-2">
                    {product.name}
                  </Text>
                  <View className="flex items-center justify-between mt-2">
                    <View>
                      <Text className="text-[#C9A96E] text-lg font-bold">
                        {product.points_price}
                      </Text>
                      <Text className="text-[#C9A96E] text-xs ml-1">积分</Text>
                    </View>
                    {product.cash_price && parseFloat(product.cash_price) > 0 && (
                      <Text className="text-gray-400 text-xs line-through">
                        ¥{product.cash_price}
                      </Text>
                    )}
                  </View>
                  <View className="flex items-center justify-between mt-2">
                    <Badge
                      className={
                        canAfford(product.points_price)
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {canAfford(product.points_price) ? "可兑换" : "积分不足"}
                    </Badge>
                    <Text className="text-gray-400 text-xs">
                      已售{product.sales_count}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default MallPage
