import { useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { Search, Zap, Gift, Star, Crown, Clock, ChevronRight } from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import "./index.css"

/* ── Mock Data ── */
const ICON_GRID = [
  { label: "限时秒杀", icon: Zap, gradient: "from-[#FF6B9D] to-[#FF2442]" },
  { label: "新人专享", icon: Gift, gradient: "from-[#FF9A56] to-[#FF6034]" },
  { label: "积分商城", icon: Star, gradient: "from-[#A78BFA] to-[#7C3AED]" },
  { label: "品牌馆", icon: Crown, gradient: "from-[#60A5FA] to-[#2563EB]" },
  { label: "签到领币", icon: Clock, gradient: "from-[#34D399] to-[#059669]" },
]

const FLASH_ITEMS = [
  { id: 1, name: "进口坚果礼盒", price: 29.9, originPrice: 89.9, sold: 82 },
  { id: 2, name: "蓝牙耳机 Pro", price: 59, originPrice: 199, sold: 67 },
  { id: 3, name: "真丝睡衣套装", price: 128, originPrice: 399, sold: 45 },
  { id: 4, name: "智能保温杯", price: 39.9, originPrice: 129, sold: 91 },
]

const PRODUCTS = [
  { id: 1, name: "日本进口零食大礼包", price: 49.9, sales: 2341, tag: "爆款" },
  { id: 2, name: "韩国护肤套装 保湿补水", price: 199, sales: 1856, tag: "推荐" },
  { id: 3, name: "意大利手工皮具钱包", price: 359, sales: 892, tag: "" },
  { id: 4, name: "北欧风陶瓷餐具套装", price: 128, sales: 1567, tag: "新品" },
  { id: 5, name: "有机绿茶礼盒装", price: 88, sales: 923, tag: "" },
  { id: 6, name: "轻奢真皮双肩背包", price: 289, sales: 654, tag: "推荐" },
]

const IndexPage = () => {
  const [countdown] = useState({ h: "02", m: "36", s: "18" })
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  const goProductDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/product-detail/index?id=${id}` })
  }

  return (
    <View className="flex flex-col h-full bg-[#F4F4F4]">
      {/* ── Custom Header ── */}
      <View className="bg-gradient-to-br from-[#FF2442] to-[#FF6034] px-4 pb-2">
        {/* Status bar spacer */}
        <View style={{ height: `${statusBarHeight}px` }} />
        {/* Brand row */}
        <View className="flex flex-row items-center gap-2 mb-2">
          <View
            className="w-8 h-8 rounded-full border flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.35)" }}
          >
            <Text className="text-white text-sm font-extrabold">星</Text>
          </View>
          <View className="flex-1">
            <Text className="block text-white text-base font-bold">上星河俱乐部</Text>
            <Text className="block text-white text-[10px]" style={{ opacity: 0.78 }}>品质生活 · 超值享受</Text>
          </View>
        </View>
        {/* Search bar */}
        <View className="flex flex-row items-center bg-white rounded-full px-3 gap-1" style={{ height: "34px" }}>
          <Search size={14} color="#bbb" />
          <Text className="text-xs text-gray-400">搜索商品、品牌</Text>
        </View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView scrollY className="flex-1" style={{ height: "0px" }}>
        {/* Hero Banner */}
        <View className="mx-2 mt-2 rounded-xl overflow-hidden">
          <View className="bg-gradient-to-br from-[#FF2442] to-[#FF6034] relative flex items-center px-4" style={{ height: "148px" }}>
            <View className="absolute rounded-full" style={{ right: -30, top: -30, width: 140, height: 140, backgroundColor: "rgba(255,255,255,0.1)" }} />
            <View className="absolute rounded-2xl" style={{ right: 20, bottom: -10, width: 110, height: 110, backgroundColor: "rgba(255,255,255,0.15)", transform: "rotate(8deg)" }} />
            <View className="relative z-10 flex-1">
              <Badge className="bg-white text-[9px] px-2 py-0 rounded-full mb-1 font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }}>
                限时活动
              </Badge>
              <Text className="block text-white text-xl font-extrabold leading-tight mb-1">
                新人首单立减50
              </Text>
              <Text className="block text-xs leading-snug" style={{ color: "rgba(255,255,255,0.88)" }}>
                精选好物低至3折起，新人专享优惠
              </Text>
            </View>
            <View className="absolute right-3 bottom-3 z-20 w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md">
              <Text className="text-[#FF2442] text-xs font-extrabold">GO</Text>
            </View>
          </View>
        </View>

        {/* Icon Grid */}
        <View className="mx-2 mt-2 bg-white rounded-xl shadow-sm">
          <View className="grid grid-cols-5 gap-0 py-2">
            {ICON_GRID.map((item) => {
              const Icon = item.icon
              return (
                <View key={item.label} className="flex flex-col items-center gap-1 py-1">
                  <View className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.gradient} flex items-center justify-center`}>
                    <Icon size={18} color="#fff" />
                  </View>
                  <Text className="block text-[10px] text-gray-500 text-center leading-tight">
                    {item.label}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Promo Strip */}
        <View className="mx-2 mt-2 rounded-xl bg-gradient-to-r from-[#FF2442] to-[#FF6034] p-3 flex flex-row items-center gap-2 relative overflow-hidden">
          <View className="absolute rounded-full" style={{ right: -20, top: -20, width: 80, height: 80, backgroundColor: "rgba(255,255,255,0.12)" }} />
          <Gift size={28} color="#fff" />
          <View className="flex-1">
            <Text className="block text-white text-xs font-semibold leading-tight">
              邀请好友 各得500积分
            </Text>
            <Text className="block text-[9px] mt-0" style={{ color: "rgba(255,255,255,0.82)" }}>
              分享赚积分，积分抵现金
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
            <Text className="text-[#FF2442] text-xs font-extrabold">去</Text>
          </View>
        </View>

        {/* Featured 1+2 Grid */}
        <View className="mx-2 mt-2 grid grid-cols-5 gap-2">
          {/* Main featured - spans 3 cols */}
          <View className="col-span-3 bg-white rounded-xl shadow-sm overflow-hidden">
            <View className="bg-[#FFF0F2] p-3">
              <Badge className="bg-[#FF2442] text-white text-[9px] px-2 py-0 rounded mb-1">
                爆款推荐
              </Badge>
              <Text className="block text-sm font-bold text-[#1A1A1A] leading-tight">
                日本进口零食大礼包
              </Text>
              <Text className="block text-[10px] text-gray-400 mt-0">精选20种人气零食</Text>
              <View className="flex flex-row items-baseline gap-1 mt-1">
                <Text className="text-[#FF2442] text-lg font-extrabold">¥49.9</Text>
                <Text className="text-gray-400 text-[10px] line-through">¥128</Text>
              </View>
            </View>
          </View>
          {/* Two smaller items */}
          <View className="col-span-2 flex flex-col gap-2">
            <View className="bg-white rounded-xl shadow-sm p-3 flex-1">
              <Text className="block text-xs font-bold text-[#1A1A1A] leading-tight">护肤套装</Text>
              <Text className="block text-[10px] text-gray-400">保湿补水</Text>
              <View className="flex flex-row items-baseline gap-1 mt-1">
                <Text className="text-[#FF2442] text-sm font-extrabold">¥199</Text>
              </View>
            </View>
            <View className="bg-white rounded-xl shadow-sm p-3 flex-1">
              <Text className="block text-xs font-bold text-[#1A1A1A] leading-tight">智能保温杯</Text>
              <Text className="block text-[10px] text-gray-400">智能显温</Text>
              <View className="flex flex-row items-baseline gap-1 mt-1">
                <Text className="text-[#FF2442] text-sm font-extrabold">¥39.9</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Flash Sale */}
        <View className="mx-2 mt-3 bg-white rounded-xl shadow-sm overflow-hidden">
          <View className="flex flex-row items-center justify-between px-3 py-2">
            <View className="flex flex-row items-center gap-2">
              <Zap size={18} color="#FF2442" />
              <Text className="text-sm font-bold text-[#1A1A1A]">限时抢购</Text>
              <View className="flex flex-row items-center gap-1">
                <View className="bg-[#1A1A1A] text-white text-[10px] font-bold rounded px-1 py-0 min-w-[20px] text-center">
                  {countdown.h}
                </View>
                <Text className="text-[10px] font-bold">:</Text>
                <View className="bg-[#1A1A1A] text-white text-[10px] font-bold rounded px-1 py-0 min-w-[20px] text-center">
                  {countdown.m}
                </View>
                <Text className="text-[10px] font-bold">:</Text>
                <View className="bg-[#1A1A1A] text-white text-[10px] font-bold rounded px-1 py-0 min-w-[20px] text-center">
                  {countdown.s}
                </View>
              </View>
            </View>
            <View className="flex flex-row items-center">
              <Text className="text-[10px] text-gray-400">更多</Text>
              <ChevronRight size={12} color="#999" />
            </View>
          </View>
          <ScrollView scrollX className="flex-shrink-0 pb-3">
            <View className="flex flex-row gap-2 px-3">
              {FLASH_ITEMS.map((item) => (
                <View
                  key={item.id}
                  className="shrink-0"
                  style={{ width: "100px" }}
                  onClick={() => goProductDetail(item.id)}
                >
                  <View className="bg-gray-100 rounded-lg" style={{ width: "100px", height: "100px" }} />
                  <Text className="block text-[11px] font-semibold text-[#1A1A1A] mt-1 leading-tight truncate">
                    {item.name}
                  </Text>
                  <View className="flex flex-row items-baseline gap-1">
                    <Text className="text-[#FF2442] text-sm font-extrabold">¥{item.price}</Text>
                    <Text className="text-gray-400 text-[9px] line-through">¥{item.originPrice}</Text>
                  </View>
                  <View className="w-full bg-[#FFE0E6] rounded-full mt-1 relative overflow-hidden" style={{ height: "12px" }}>
                    <View className="bg-gradient-to-r from-[#FF2442] to-[#FF6034] h-full rounded-full" style={{ width: `${item.sold}%` }} />
                    <Text className="absolute inset-0 text-[8px] text-white font-bold text-center leading-3">
                      已抢{item.sold}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Product List */}
        <View className="mx-2 mt-3">
          <View className="flex flex-row items-center justify-between mb-2">
            <Text className="text-sm font-bold text-[#1A1A1A]">为你推荐</Text>
          </View>
          <View className="grid grid-cols-2 gap-2">
            {PRODUCTS.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden border-0 shadow-sm"
                onClick={() => goProductDetail(product.id)}
              >
                <View className="w-full bg-gray-100" style={{ height: "140px" }} />
                <CardContent className="p-2">
                  {product.tag && (
                    <Badge className="bg-[#FF2442] text-white text-[9px] px-2 py-0 rounded mb-1">
                      {product.tag}
                    </Badge>
                  )}
                  <Text className="block text-xs font-semibold text-[#1A1A1A] leading-tight line-clamp-2">
                    {product.name}
                  </Text>
                  <View className="flex flex-row items-baseline justify-between mt-1">
                    <Text className="text-[#FF2442] text-base font-extrabold">¥{product.price}</Text>
                    <Text className="text-[10px] text-gray-400">已售{product.sales}</Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        </View>

        {/* Bottom padding for TabBar */}
        <View className="h-14" />
      </ScrollView>
    </View>
  )
}

export default IndexPage
