import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { ShoppingCart, Share2, Minus, Plus, ChevronLeft, Package } from "lucide-react-taro"
import { Button } from "@/components/ui/button"
import { RichHtml } from "@/components/rich-html"
import { Network } from "@/network"
import { addToCart } from "@/lib/mall-cart"
import { ensureLogin } from "@/lib/auth"

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

  const handleAddCart = async () => {
    if (!product || product.stock <= 0) return
    if (!(await ensureLogin())) return
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

  const handleBuyNow = async () => {
    if (!product || product.stock <= 0) return
    if (!(await ensureLogin())) return
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
      <View className="flex justify-center items-center h-screen bg-[#F7F5F1]">
        <Text className="text-gray-400 text-sm">加载中...</Text>
      </View>
    )
  }

  if (!product) {
    return (
      <View className="flex flex-col justify-center items-center h-screen bg-[#F7F5F1]">
        <Text className="text-gray-400 text-sm">商品不存在</Text>
        <Button variant="outline" className="mt-4" onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </Button>
      </View>
    )
  }

  return (
    <View className="h-screen bg-white">
      <ScrollView scrollY className="h-screen">
        {/* 全宽主图，无圆角、无边距 */}
        <View className="relative w-full">
          <Image
            src={product.image_url}
            className="w-full aspect-square"
            mode="aspectFill"
          />
          <View
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/35 flex items-center justify-center"
            onClick={() => Taro.navigateBack()}
          >
            <ChevronLeft size={20} color="#fff" />
          </View>
          <View
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/35 flex items-center justify-center"
            onClick={() => Taro.navigateTo({ url: "/pages/mall/orders/index" })}
          >
            <Package size={17} color="#fff" />
          </View>
          {product.stock <= 0 ? (
            <View className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Text className="text-white text-base font-medium">已售罄</Text>
            </View>
          ) : null}
        </View>

        {/* 信息区：用间距分层，少用线框卡片 */}
        <View className="px-4 pt-5 pb-2">
          <Text className="block text-xl font-bold text-[#1A1D2E] leading-snug">
            {product.name}
          </Text>
          <View className="flex flex-row items-baseline mt-3">
            <Text className="text-[#C9A96E] text-3xl font-bold leading-none">
              {product.points_price}
            </Text>
            <Text className="text-[#C9A96E] text-sm ml-1.5">积分</Text>
          </View>
          <View className="flex flex-row items-center mt-3 gap-4">
            <Text className="block text-xs text-gray-400">库存 {product.stock}</Text>
            <Text className="block text-xs text-gray-400">已兑 {product.sales_count || 0}</Text>
            <Text className="block text-xs text-gray-400">可用 {userPoints}</Text>
          </View>
        </View>

        <View className="h-2 bg-[#F7F5F1]" />

        <View className="px-4 py-5">
          <Text className="block text-sm font-semibold text-[#1A1D2E] mb-3">兑换数量</Text>
          <View className="flex flex-row items-center justify-between">
            <View className="flex flex-row items-center gap-3">
              <View
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  quantity > 1 ? "bg-[#F0EDE7]" : "bg-gray-100"
                }`}
                onClick={() => quantity > 1 && setQuantity(quantity - 1)}
              >
                <Minus size={16} color={quantity > 1 ? "#1B2A4A" : "#9CA3AF"} />
              </View>
              <Text className="text-base font-semibold text-[#1A1D2E] w-8 text-center">{quantity}</Text>
              <View
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  quantity < product.stock ? "bg-[#F0EDE7]" : "bg-gray-100"
                }`}
                onClick={() => quantity < product.stock && setQuantity(quantity + 1)}
              >
                <Plus size={16} color={quantity < product.stock ? "#1B2A4A" : "#9CA3AF"} />
              </View>
            </View>
            <Text className="block text-sm text-gray-500">
              合计 <Text className="text-[#C9A96E] font-semibold">{totalPoints}</Text> 积分
            </Text>
          </View>
        </View>

        <View className="h-2 bg-[#F7F5F1]" />

        <View className="px-4 pt-5 pb-28">
          <Text className="block text-sm font-semibold text-[#1A1D2E] mb-3">商品详情</Text>
          <RichHtml
            html={product.description}
            className="text-sm"
            emptyText="暂无商品图文详情"
          />
        </View>
      </ScrollView>

      <View
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "10px",
          padding: "10px 16px",
          paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          backgroundColor: "#fff",
          boxShadow: "0 -6px 24px rgba(27,42,74,0.06)",
          zIndex: 100,
        }}
      >
        <View
          className="w-11 h-11 rounded-full bg-[#F7F5F1] flex items-center justify-center"
          onClick={handleShare}
        >
          <Share2 size={18} color="#1B2A4A" />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            className="w-full h-11 rounded-full border-[#E5E1D8]"
            onClick={handleAddCart}
            disabled={product.stock <= 0}
          >
            <View className="flex flex-row items-center justify-center gap-1.5">
              <ShoppingCart size={16} color="#1B2A4A" />
              <Text className="text-sm text-[#1B2A4A]">加购</Text>
            </View>
          </Button>
        </View>
        <View style={{ flex: 1.2 }}>
          <Button
            className="w-full h-11 rounded-full bg-[#1B2A4A]"
            disabled={!canAfford || product.stock <= 0}
            onClick={handleBuyNow}
          >
            <Text className="text-white text-sm font-semibold">
              {product.stock <= 0 ? "已售罄" : canAfford ? "立即兑换" : "积分不足"}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

export default ProductDetailPage
