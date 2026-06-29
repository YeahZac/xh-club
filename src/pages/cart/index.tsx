import { useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2 } from "lucide-react-taro"

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  checked: boolean
}

const INITIAL_CART: CartItem[] = [
  { id: 1, name: "日本进口零食大礼包 精选20种人气零食", price: 49.9, quantity: 2, checked: true },
  { id: 2, name: "韩国护肤套装 保湿补水6件套", price: 199, quantity: 1, checked: true },
  { id: 3, name: "北欧风陶瓷餐具套装 16件套", price: 128, quantity: 1, checked: false },
]

const CartPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>(INITIAL_CART)

  const allChecked = cartItems.length > 0 && cartItems.every((item) => item.checked)
  const checkedItems = cartItems.filter((item) => item.checked)
  const totalPrice = checkedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalCount = checkedItems.reduce((sum, item) => sum + item.quantity, 0)

  const toggleItem = (id: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    )
  }

  const toggleAll = () => {
    const nextChecked = !allChecked
    setCartItems((prev) => prev.map((item) => ({ ...item, checked: nextChecked })))
  }

  const updateQuantity = (id: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0)
    )
  }

  const removeItem = (id: number) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <View className="flex flex-col h-full bg-[#F4F4F4]">
      {cartItems.length === 0 ? (
        <View className="flex-1 flex items-center justify-center">
          <Text className="block text-sm text-gray-400">购物车是空的</Text>
        </View>
      ) : (
        <>
          <ScrollView scrollY className="flex-1 pt-2" style={{ height: "0px" }}>
            {cartItems.map((item) => (
              <View
                key={item.id}
                className="mx-3 mb-2 bg-white rounded-xl shadow-sm p-3 flex flex-row items-center gap-3"
              >
                <View onClick={() => toggleItem(item.id)}>
                  <Checkbox checked={item.checked} />
                </View>
                <View className="bg-gray-100 rounded-lg shrink-0" style={{ width: "80px", height: "80px" }} />
                <View className="flex-1 min-w-0">
                  <Text className="block text-xs font-semibold text-[#1A1A1A] leading-tight line-clamp-2">
                    {item.name}
                  </Text>
                  <Text className="block text-[#FF2442] text-sm font-extrabold mt-1">
                    ¥{item.price}
                  </Text>
                  <View className="flex flex-row items-center justify-between mt-1">
                    <View className="flex flex-row items-center gap-2">
                      <View
                        className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus size={12} color="#888" />
                      </View>
                      <Text className="text-xs font-semibold w-6 text-center">{item.quantity}</Text>
                      <View
                        className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus size={12} color="#888" />
                      </View>
                    </View>
                    <View onClick={() => removeItem(item.id)}>
                      <Trash2 size={14} color="#ccc" />
                    </View>
                  </View>
                </View>
              </View>
            ))}
            <View className="h-16" />
          </ScrollView>

          {/* Bottom bar */}
          <View
            className="bg-white border-t border-[#F0F0F0] flex flex-row items-center px-3 py-2"
            style={{ paddingBottom: "8px" }}
          >
            <View className="flex flex-row items-center gap-1" onClick={toggleAll}>
              <Checkbox checked={allChecked} />
              <Text className="text-xs text-gray-600">全选</Text>
            </View>
            <View className="flex-1" />
            <View className="flex flex-row items-center gap-3">
              <View className="flex flex-col items-end">
                <View className="flex flex-row items-baseline gap-1">
                  <Text className="text-xs text-gray-500">合计:</Text>
                  <Text className="text-[#FF2442] text-base font-extrabold">¥{totalPrice.toFixed(2)}</Text>
                </View>
              </View>
              <Button
                className="bg-[#FF2442] text-white rounded-full px-6 h-9"
                disabled={totalCount === 0}
              >
                结算({totalCount})
              </Button>
            </View>
          </View>
        </>
      )}
    </View>
  )
}

export default CartPage
