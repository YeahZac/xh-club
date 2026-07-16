import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  ShoppingCart, Share2, Check,
  Minus, Plus, ChevronLeft, Users
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  rights: "会员权益",
  service: "专属服务",
  gift: "精美礼品",
  activity: "活动门票",
  learning: "学习课程",
}

const ProductDetailPage = () => {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [userPoints, setUserPoints] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.id) {
      loadProduct(params.id)
      loadUserPoints()
    }
  }, [])

  const loadProduct = async (id: string) => {
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/mall/products/${id}` })
      console.log("[商品详情] product:", res?.data)
      if (res?.data?.data) {
        setProduct(res.data.data)
      }
    } catch (err) {
      console.error("[商品详情] 加载失败:", err)
      Taro.showToast({ title: "加载失败", icon: "none" })
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
      console.error("[商品详情] 加载积分失败:", err)
    }
  }

  const canAfford = product ? userPoints >= product.points_price * quantity : false
  const totalPoints = product ? product.points_price * quantity : 0
  const distributionAmount = product && product.enable_distribution
    ? (product.cash_price ? parseFloat(product.cash_price) * quantity * parseFloat(product.distribution_rate) / 100 : 0)
    : 0

  const handleOrder = async () => {
    if (!product || submitting) return
    const memberId = Taro.getStorageSync("member_id")
    if (!memberId) {
      Taro.showToast({ title: "请先登录", icon: "none" })
      return
    }

    if (!canAfford) {
      Taro.showToast({ title: "积分不足", icon: "none" })
      return
    }

    setSubmitting(true)
    try {
      const res = await Network.request({
        url: "/api/mall/orders",
        method: "POST",
        data: {
          member_id: memberId,
          product_id: product.id,
          quantity,
          points_used: totalPoints,
        },
      })
      console.log("[商品详情] order result:", res?.data)
      if (res?.data?.code === 200) {
        setShowSuccess(true)
        setTimeout(() => {
          setShowSuccess(false)
          Taro.navigateBack()
        }, 2000)
      } else {
        Taro.showToast({ title: res?.data?.msg || "下单失败", icon: "none" })
      }
    } catch (err) {
      console.error("[商品详情] 下单失败:", err)
      Taro.showToast({ title: "下单失败", icon: "none" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleShare = () => {
    if (!product) return
    const memberId = Taro.getStorageSync("member_id") || ""
    const shareUrl = `/pages/mall/product-detail/index?id=${product.id}&referrer=${memberId}`
    Taro.setClipboardData({
      data: shareUrl,
      success: () => {
        Taro.showToast({ title: "分享链接已复制", icon: "success" })
      },
    })
  }

  if (loading) {
    return (
      <View className="flex justify-center items-center h-screen bg-gray-50">
        <Text className="text-gray-400 text-sm">加载中...</Text>
      </View>
    )
  }

  if (!product) {
    return (
      <View className="flex flex-col justify-center items-center h-screen bg-gray-50">
        <Text className="text-gray-400 text-sm">商品不存在</Text>
        <Button variant="outline" className="mt-4" onClick={() => Taro.navigateBack()}>
          返回
        </Button>
      </View>
    )
  }

  return (
    <ScrollView scrollY className="h-screen bg-gray-50">
      {/* 成功提示 */}
      {showSuccess && (
        <View className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <View className="bg-white rounded-2xl p-8 flex flex-col items-center">
            <View className="bg-emerald-100 rounded-full p-4 mb-4">
              <Check size={32} color="#10b981" />
            </View>
            <Text className="text-lg font-semibold text-gray-900">兑换成功</Text>
            <Text className="text-sm text-gray-500 mt-2">积分已扣除，商品即将发出</Text>
          </View>
        </View>
      )}

      {/* 商品图片 */}
      <View className="relative">
        <Image
          src={product.image_url}
          className="w-full aspect-square"
          mode="aspectFill"
        />
        <View
          className="absolute top-4 left-4 bg-black bg-opacity-30 rounded-full p-2"
          onClick={() => Taro.navigateBack()}
        >
          <ChevronLeft size={20} color="#fff" />
        </View>
        {product.enable_distribution && (
          <View className="absolute top-4 right-4 bg-gradient-to-r from-[#C9A96E] to-[#E8D5A8] px-3 py-2 rounded-lg">
            <Text className="text-white text-sm font-medium">
              分享赚{product.distribution_rate}%
            </Text>
          </View>
        )}
      </View>

      {/* 商品信息 */}
      <View className="bg-white px-4 py-5">
        <View className="flex items-start justify-between">
          <View className="flex-1">
            <Text className="block text-xl font-bold text-gray-900">
              {product.name}
            </Text>
            <Badge className="mt-2 bg-gray-100 text-gray-600">
              {categoryMap[product.category] || product.category}
            </Badge>
          </View>
        </View>

        <View className="flex items-baseline gap-2 mt-4">
          <Text className="text-[#C9A96E] text-3xl font-bold">
            {product.points_price}
          </Text>
          <Text className="text-[#C9A96E] text-sm">积分</Text>
          {product.cash_price && parseFloat(product.cash_price) > 0 && (
            <Text className="text-gray-400 text-sm line-through ml-2">
              ¥{product.cash_price}
            </Text>
          )}
        </View>

        <View className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <Text>库存 {product.stock}</Text>
          <Text>已售 {product.sales_count}</Text>
        </View>
      </View>

      {/* 分销收益 */}
      {product.enable_distribution && distributionAmount > 0 && (
        <Card className="mx-4 mt-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <View className="flex items-center gap-2 mb-2">
              <Users size={16} color="#C9A96E" />
              <Text className="text-sm font-medium text-amber-800">分销收益</Text>
            </View>
            <Text className="block text-sm text-amber-700">
              邀请好友购买，您可获得 <Text className="font-bold text-amber-900">¥{distributionAmount.toFixed(2)}</Text> 收益
            </Text>
          </CardContent>
        </Card>
      )}

      {/* 商品详情 */}
      <Card className="mx-4 mt-4">
        <CardContent className="p-4">
          <Text className="block text-base font-semibold text-gray-900 mb-3">
            商品详情
          </Text>
          <Text className="block text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {product.description || "暂无详情"}
          </Text>
        </CardContent>
      </Card>

      {/* 底部操作栏 */}
      <View
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <View className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <View onClick={() => quantity > 1 && setQuantity(quantity - 1)}>
            <Minus size={16} color="#6b7280" />
          </View>
          <Text className="text-sm font-medium w-8 text-center">{quantity}</Text>
          <View onClick={() => quantity < product.stock && setQuantity(quantity + 1)}>
            <Plus size={16} color="#6b7280" />
          </View>
        </View>

        <Button
          variant="outline"
          className="flex-1"
          onClick={handleShare}
        >
          <Share2 size={16} color="#666" className="mr-2" />
          分享
        </Button>

        <Button
          className="flex-1 bg-[#1B2A4A]"
          disabled={!canAfford || submitting || product.stock <= 0}
          onClick={handleOrder}
        >
          <ShoppingCart size={16} color="#fff" className="mr-2" />
          {product.stock <= 0 ? "已售罄" : "立即兑换"}
        </Button>
      </View>

      {/* 底部占位 */}
      <View className="h-24" />
    </ScrollView>
  )
}

export default ProductDetailPage
