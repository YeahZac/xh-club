import { useState } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react-taro"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  CartItem,
  getCart,
  getCartTotalPoints,
  removeFromCart,
  updateCartQuantity,
} from "@/lib/mall-cart"

const MallCartPage = () => {
  const [items, setItems] = useState<CartItem[]>([])

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: "购物车" })
    setItems(getCart())
  })

  const totalPoints = getCartTotalPoints(items)

  const handleCheckout = () => {
    if (!items.length) {
      Taro.showToast({ title: "购物车为空", icon: "none" })
      return
    }
    const payload = encodeURIComponent(JSON.stringify(items))
    Taro.navigateTo({ url: `/pages/mall/checkout/index?items=${payload}&from=cart` })
  }

  return (
    <View className="min-h-screen bg-[#F5F6FA]">
      <ScrollView scrollY className="h-screen">
        <View className="px-3.5 py-3 pb-28">
          {!items.length ? (
            <View className="flex flex-col items-center justify-center py-20">
              <ShoppingCart size={40} color="#d1d5db" />
              <Text className="block text-gray-400 text-sm mt-3">购物车空空如也</Text>
              <Button className="mt-4" onClick={() => Taro.switchTab({ url: "/pages/mall/index" })}>
                去逛逛
              </Button>
            </View>
          ) : (
            items.map((item) => (
              <Card key={item.product_id} className="mb-2 overflow-hidden">
                <CardContent className="p-3 flex gap-3">
                  <Image
                    src={item.image_url}
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                    mode="aspectFill"
                  />
                  <View className="flex-1 min-w-0">
                    <Text className="block text-sm font-medium text-gray-900 line-clamp-2">
                      {item.name}
                    </Text>
                    <Text className="block text-[#C9A96E] text-sm font-bold mt-1">
                      {item.points_price} 积分
                    </Text>
                    <View className="flex items-center justify-between mt-2">
                      <View className="flex items-center gap-2">
                        <View
                          className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center"
                          onClick={() => setItems(updateCartQuantity(item.product_id, item.quantity - 1))}
                        >
                          <Minus size={14} color="#6b7280" />
                        </View>
                        <Text className="text-sm w-6 text-center">{item.quantity}</Text>
                        <View
                          className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center"
                          onClick={() => setItems(updateCartQuantity(item.product_id, item.quantity + 1))}
                        >
                          <Plus size={14} color="#6b7280" />
                        </View>
                      </View>
                      <View onClick={() => setItems(removeFromCart(item.product_id))}>
                        <Trash2 size={16} color="#ef4444" />
                      </View>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {items.length > 0 && (
        <View
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "12px",
            padding: "12px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
            backgroundColor: "#fff",
            borderTop: "1px solid #e5e5e5",
            zIndex: 100,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text className="block text-xs text-gray-500">合计</Text>
            <Text className="block text-[#C9A96E] text-lg font-bold">{totalPoints} 积分</Text>
          </View>
          <View style={{ flexShrink: 0 }}>
            <Button className="bg-[#1B2A4A] px-6" onClick={handleCheckout}>
              去结算
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

export default MallCartPage
