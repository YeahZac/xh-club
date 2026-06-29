import { useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { Card, CardContent } from "@/components/ui/card"

const CATEGORIES = [
  { id: 1, name: "美食零食", icon: "🍪" },
  { id: 2, name: "美妆护肤", icon: "💄" },
  { id: 3, name: "家居生活", icon: "🏠" },
  { id: 4, name: "数码电子", icon: "📱" },
  { id: 5, name: "服饰箱包", icon: "👗" },
  { id: 6, name: "运动户外", icon: "⚽" },
  { id: 7, name: "母婴亲子", icon: "🍼" },
  { id: 8, name: "图书文具", icon: "📚" },
  { id: 9, name: "宠物用品", icon: "🐾" },
  { id: 10, name: "更多分类", icon: "📌" },
]

const SUB_CATEGORIES: Record<number, { name: string; items: { id: number; name: string; price: number }[] }> = {
  1: {
    name: "美食零食",
    items: [
      { id: 101, name: "进口坚果礼盒", price: 49.9 },
      { id: 102, name: "日式抹茶大福", price: 29.9 },
      { id: 103, name: "手工牛轧糖", price: 19.9 },
      { id: 104, name: "有机燕麦片", price: 39.9 },
      { id: 105, name: "韩国海苔套装", price: 24.9 },
      { id: 106, name: "法式马卡龙", price: 59.9 },
    ],
  },
  2: {
    name: "美妆护肤",
    items: [
      { id: 201, name: "保湿精华液", price: 199 },
      { id: 202, name: "防晒隔离霜", price: 89 },
      { id: 203, name: "口红套装", price: 149 },
      { id: 204, name: "面膜礼盒", price: 69 },
      { id: 205, name: "卸妆水", price: 49 },
      { id: 206, name: "眼霜精华", price: 259 },
    ],
  },
  3: {
    name: "家居生活",
    items: [
      { id: 301, name: "北欧风陶瓷杯", price: 59 },
      { id: 302, name: "香薰蜡烛套装", price: 79 },
      { id: 303, name: "棉麻抱枕", price: 39 },
      { id: 304, name: "收纳盒三件套", price: 49 },
    ],
  },
}

const CategoryPage = () => {
  const [activeId, setActiveId] = useState(1)
  const currentCat = SUB_CATEGORIES[activeId] || { name: CATEGORIES.find(c => c.id === activeId)?.name || "", items: [] }

  return (
    <View className="flex flex-col h-full bg-[#F4F4F4]">
      <View className="flex flex-row flex-1 overflow-hidden">
        {/* Left sidebar */}
        <ScrollView scrollY className="bg-white shrink-0" style={{ width: "80px" }}>
          {CATEGORIES.map((cat) => (
            <View
              key={cat.id}
              className={`flex items-center justify-center py-3 px-1 ${activeId === cat.id ? "bg-[#F4F4F4] border-l-2 border-[#FF2442]" : "border-l-2 border-transparent"}`}
              onClick={() => setActiveId(cat.id)}
            >
              <Text className={`block text-center text-xs leading-tight ${activeId === cat.id ? "text-[#FF2442] font-bold" : "text-gray-600"}`}>
                {cat.icon}{"\n"}{cat.name}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Right content */}
        <ScrollView scrollY className="flex-1 px-2 pt-2">
          {/* Category header */}
          <View className="mb-2">
            <Text className="block text-sm font-bold text-[#1A1A1A]">{currentCat.name}</Text>
          </View>

          {/* Product grid */}
          <View className="grid grid-cols-2 gap-2 pb-4">
            {currentCat.items.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden border-0 shadow-sm"
                onClick={() => Taro.navigateTo({ url: `/pages/product-detail/index?id=${item.id}` })}
              >
                <View className="w-full bg-gray-100" style={{ height: "96px" }} />
                <CardContent className="p-2">
                  <Text className="block text-xs font-semibold text-[#1A1A1A] leading-tight truncate">
                    {item.name}
                  </Text>
                  <Text className="block text-[#FF2442] text-sm font-extrabold mt-1">
                    ¥{item.price}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </View>

          {currentCat.items.length === 0 && (
            <View className="flex items-center justify-center py-16">
              <Text className="block text-sm text-gray-400">暂无商品</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  )
}

export default CategoryPage
