import { useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Heart,
  MessageCircle,
  ShoppingBag,
  Star,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react-taro"

const REVIEWS = [
  { id: 1, user: "星***河", rating: 5, content: "包装精美，物流也快，味道很棒！下次还回购", time: "2024-03-15" },
  { id: 2, user: "小***子", rating: 4, content: "整体不错，就是有几样不太喜欢，性价比挺高的", time: "2024-03-12" },
  { id: 3, user: "明***阳", rating: 5, content: "送人特别有面子，品质很好！", time: "2024-03-08" },
]

const SPECS = [
  { label: "口味", options: ["综合坚果", "抹茶味", "巧克力"] },
  { label: "规格", options: ["小份装", "家庭装", "礼盒装"] },
]

const ProductDetailPage = () => {
  const [quantity, setQuantity] = useState(1)
  const [liked, setLiked] = useState(false)
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({
    "口味": "综合坚果",
    "规格": "家庭装",
  })

  const price = 49.9
  const originPrice = 128
  const productName = "日本进口零食大礼包 精选20种人气零食"
  const sales = 2341

  const selectSpec = (label: string, option: string) => {
    setSelectedSpecs((prev) => ({ ...prev, [label]: option }))
  }

  return (
    <View className="flex flex-col h-full bg-[#F4F4F4]">
      <ScrollView scrollY className="flex-1" style={{ height: "0px" }}>
        {/* Product Image Placeholder */}
        <View className="w-full bg-gray-100" style={{ height: "320px" }} />

        {/* Price Section */}
        <View className="bg-gradient-to-r from-[#FF2442] to-[#FF6034] px-4 py-3">
          <View className="flex flex-row items-baseline gap-2">
            <Text className="text-white text-2xl font-extrabold">¥{price}</Text>
            <Text className="text-xs line-through" style={{ color: "rgba(255,255,255,0.6)" }}>¥{originPrice}</Text>
            <Badge className="text-white text-[9px] px-2 py-0 rounded" style={{ backgroundColor: "rgba(255,255,255,0.25)" }}>
              限时折扣
            </Badge>
          </View>
          <Text className="block text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>
            已售{sales}件 · 库存充足
          </Text>
        </View>

        {/* Product Name */}
        <View className="bg-white px-4 py-3">
          <Text className="block text-base font-bold text-[#1A1A1A] leading-snug">
            {productName}
          </Text>
          <View className="flex flex-row items-center gap-2 mt-2">
            <Badge className="bg-[#FFF0F2] text-[#FF2442] text-[9px] px-2 py-0 rounded">
              包邮
            </Badge>
            <Badge className="bg-[#FFF4EE] text-[#FF6034] text-[9px] px-2 py-0 rounded">
              7天无理由
            </Badge>
            <Badge className="bg-[#FFF0F2] text-[#FF2442] text-[9px] px-2 py-0 rounded">
              正品保障
            </Badge>
          </View>
        </View>

        <View className="h-2" />

        {/* Specs Selection */}
        <View className="bg-white px-4 py-3">
          <Text className="block text-sm font-bold text-[#1A1A1A] mb-3">规格选择</Text>
          {SPECS.map((spec) => (
            <View key={spec.label} className="mb-3">
              <Text className="block text-xs text-gray-500 mb-2">{spec.label}</Text>
              <View className="flex flex-row flex-wrap gap-2">
                {spec.options.map((option) => (
                  <View
                    key={option}
                    className={`px-3 py-1 rounded-full border ${
                      selectedSpecs[spec.label] === option
                        ? "border-[#FF2442] bg-[#FFF0F2]"
                        : "border-gray-200 bg-white"
                    }`}
                    onClick={() => selectSpec(spec.label, option)}
                  >
                    <Text
                      className={`text-xs ${
                        selectedSpecs[spec.label] === option ? "text-[#FF2442] font-semibold" : "text-gray-600"
                      }`}
                    >
                      {option}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Quantity */}
          <View className="flex flex-row items-center justify-between mt-2">
            <Text className="text-xs text-gray-500">数量</Text>
            <View className="flex flex-row items-center gap-3">
              <View
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={14} color="#888" />
              </View>
              <Text className="text-sm font-semibold w-6 text-center">{quantity}</Text>
              <View
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={14} color="#888" />
              </View>
            </View>
          </View>
        </View>

        <View className="h-2" />

        {/* Reviews */}
        <View className="bg-white px-4 py-3">
          <View className="flex flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-[#1A1A1A]">用户评价 (128)</Text>
            <View className="flex flex-row items-center">
              <Text className="text-[10px] text-gray-400">查看全部</Text>
              <ChevronRight size={12} color="#999" />
            </View>
          </View>
          {REVIEWS.map((review, idx) => (
            <View key={review.id}>
              <View className="flex flex-row items-center gap-2 mb-1">
                <View className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                  <Text className="text-[10px] text-gray-500">{review.user[0]}</Text>
                </View>
                <Text className="text-xs text-gray-600">{review.user}</Text>
                <View className="flex flex-row">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={10} color="#FFB800" filled />
                  ))}
                </View>
              </View>
              <Text className="block text-xs text-gray-500 leading-relaxed mb-1">
                {review.content}
              </Text>
              <Text className="block text-[10px] text-gray-300 mb-2">{review.time}</Text>
              {idx < REVIEWS.length - 1 && <Separator className="my-1" />}
            </View>
          ))}
        </View>

        <View className="h-16" />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View
        className="bg-white border-t border-[#F0F0F0] flex flex-row items-center px-3 py-2"
        style={{ paddingBottom: "8px" }}
      >
        <View className="flex flex-row items-center gap-4 mr-3">
          <View className="flex flex-col items-center" onClick={() => setLiked(!liked)}>
            <Heart size={20} color={liked ? "#FF2442" : "#888"} filled={liked} />
            <Text className="block text-[9px] text-gray-400">收藏</Text>
          </View>
          <View className="flex flex-col items-center">
            <MessageCircle size={20} color="#888" />
            <Text className="block text-[9px] text-gray-400">客服</Text>
          </View>
          <View className="flex flex-col items-center relative">
            <ShoppingBag size={20} color="#888" />
            <Text className="block text-[9px] text-gray-400">购物车</Text>
            <Badge className="absolute bg-[#FF2442] text-white text-[8px] rounded-full flex items-center justify-center p-0" style={{ top: -4, right: -4, width: "16px", height: "16px" }}>
              3
            </Badge>
          </View>
        </View>
        <View className="flex-1 flex flex-row gap-2">
          <Button className="flex-1 bg-[#FF6034] text-white rounded-full h-9">
            加入购物车
          </Button>
          <Button className="flex-1 bg-[#FF2442] text-white rounded-full h-9">
            立即购买
          </Button>
        </View>
      </View>
    </View>
  )
}

export default ProductDetailPage
