import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  ShoppingCart, Share2, Minus, Plus, ChevronLeft, Package
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Network } from "@/network"
import { addToCart } from "@/lib/mall-cart"

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

const ProductDetailPage = () => {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [userPoints, setUserPoints] = useState(0)

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

  const ensureLogin = () => {
    const memberId = Taro.getStorageSync("member_id")
    const token = Taro.getStorageSync("member_token")
    if (!memberId || !token) {
      Taro.showToast({ title: "请先登录", icon: "none" })
      return false
    }
    return true
  }

  const handleAddCart = () => {
    if (!product || product.stock <= 0) return
    if (!ensureLogin()) return
    addToCart({
      product_id: product.id,
      name: product.name,
      image_url: product.image_url,
      points_price: product.points_price,
      stock: product.stock,
      quantity,
    })
    Taro.showToast({ title: "已加入购物车", icon: "success" })
  }

  const handleBuyNow = () => {
    if (!product || product.stock <= 0) return
    if (!ensureLogin()) return
    if (!canAfford) {
      Taro.showToast({ title: "积分不足", icon: "none" })
      return
    }
    const payload = encodeURIComponent(JSON.stringify([{
      product_id: product.id,
      name: product.name,
      image_url: product.image_url,
      points_price: product.points_price,
      quantity,
      stock: product.stock,
    }]))
    Taro.navigateTo({ url: `/pages/mall/checkout/index?items=${payload}` })
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
        <View
          className="absolute top-4 right-4 bg-black bg-opacity-30 rounded-full p-2"
          onClick={() => Taro.navigateTo({ url: "/pages/mall/orders/index" })}
        >
          <Package size={18} color="#fff" />
        </View>
      </View>

      <View className="bg-white px-4 py-5">
        <Text className="block text-xl font-bold text-gray-900">
          {product.name}
        </Text>
        <View className="flex items-baseline gap-2 mt-4">
          <Text className="text-[#C9A96E] text-3xl font-bold">
            {product.points_price}
          </Text>
          <Text className="text-[#C9A96E] text-sm">积分</Text>
        </View>
        <View className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <Text>库存 {product.stock}</Text>
          <Text>已售 {product.sales_count || 0}</Text>
          <Text>可用积分 {userPoints}</Text>
        </View>
      </View>

      <Card className="mx-4 mt-4">
        <CardContent className="p-4">
          <Text className="block text-base font-semibold text-gray-900 mb-3">
            购买数量
          </Text>
          <View className="flex items-center gap-3">
            <View
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
              onClick={() => quantity > 1 && setQuantity(quantity - 1)}
            >
              <Minus size={16} color="#6b7280" />
            </View>
            <Text className="text-base font-medium w-10 text-center">{quantity}</Text>
            <View
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
              onClick={() => quantity < product.stock && setQuantity(quantity + 1)}
            >
              <Plus size={16} color="#6b7280" />
            </View>
            <Text className="text-sm text-gray-500 ml-2">合计 {totalPoints} 积分</Text>
          </View>
        </CardContent>
      </Card>

      <Card className="mx-4 mt-4 mb-4">
        <CardContent className="p-4">
          <Text className="block text-base font-semibold text-gray-900 mb-3">
            商品详情
          </Text>
          <Text className="block text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {product.description || "暂无详情"}
          </Text>
        </CardContent>
      </Card>

      <View
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "row",
          gap: "8px",
          padding: "12px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          backgroundColor: "#fff",
          borderTop: "1px solid #e5e5e5",
          zIndex: 100,
        }}
      >
        <View style={{ flexShrink: 0 }}>
          <Button variant="outline" onClick={handleShare}>
            <Share2 size={16} color="#666" className="mr-1" />
            分享
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="outline" className="w-full" onClick={handleAddCart} disabled={product.stock <= 0}>
            <ShoppingCart size={16} color="#666" className="mr-1" />
            加购物车
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            className="w-full bg-[#1B2A4A]"
            disabled={!canAfford || product.stock <= 0}
            onClick={handleBuyNow}
          >
            {product.stock <= 0 ? "已售罄" : canAfford ? "立即兑换" : "积分不足"}
          </Button>
        </View>
      </View>

      <View className="h-24" />
    </ScrollView>
  )
}

export default ProductDetailPage
