import { useEffect, useState } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Network } from "@/network"
import { CartItem, clearCart, getCartTotalPoints } from "@/lib/mall-cart"

const ADDRESS_KEY = "mall_shipping_address"

const MallCheckoutPage = () => {
  const [items, setItems] = useState<CartItem[]>([])
  const [fromCart, setFromCart] = useState(false)
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [shippingAddress, setShippingAddress] = useState("")
  const [remark, setRemark] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [userPoints, setUserPoints] = useState(0)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: "确认订单" })
    const params = Taro.getCurrentInstance().router?.params || {}
    setFromCart(params.from === "cart")
    try {
      const raw = params.items ? decodeURIComponent(params.items) : "[]"
      const parsed = JSON.parse(raw)
      setItems(Array.isArray(parsed) ? parsed : [])
    } catch {
      setItems([])
    }
    try {
      const saved = Taro.getStorageSync(ADDRESS_KEY)
      if (saved) {
        setContactName(saved.contact_name || "")
        setContactPhone(saved.contact_phone || "")
        setShippingAddress(saved.shipping_address || "")
      }
    } catch {
      /* ignore */
    }
    loadUserPoints()
  }, [])

  const loadUserPoints = async () => {
    try {
      const memberId = Taro.getStorageSync("member_id")
      if (!memberId) return
      const res = await Network.request({ url: `/api/members/profile/${memberId}` })
      if (res?.data?.data) setUserPoints(res.data.data.available_points || 0)
    } catch (err) {
      console.error("[结算] 积分加载失败", err)
    }
  }

  const totalPoints = getCartTotalPoints(items)
  const canPay = userPoints >= totalPoints && items.length > 0

  const handlePay = async () => {
    if (submitting) return
    if (!contactName.trim() || !contactPhone.trim() || !shippingAddress.trim()) {
      Taro.showToast({ title: "请完善收货信息", icon: "none" })
      return
    }
    if (!canPay) {
      Taro.showToast({ title: "积分不足", icon: "none" })
      return
    }

    setSubmitting(true)
    try {
      Taro.setStorageSync(ADDRESS_KEY, {
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        shipping_address: shippingAddress.trim(),
      })

      const res = await Network.request({
        url: "/api/mall/orders/checkout",
        method: "POST",
        data: {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          shipping_address: shippingAddress.trim(),
          remark: remark.trim() || undefined,
        },
      })
      console.log("[结算] result:", res?.data)
      if (res?.data?.code === 200) {
        if (fromCart) clearCart()
        Taro.showToast({ title: "支付成功", icon: "success" })
        setTimeout(() => {
          Taro.redirectTo({ url: "/pages/mall/orders/index?status=paid" })
        }, 800)
      } else {
        Taro.showToast({ title: res?.data?.msg || "支付失败", icon: "none" })
      }
    } catch (err) {
      console.error("[结算] 失败", err)
      Taro.showToast({ title: "支付失败", icon: "none" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="min-h-screen bg-[#F5F6FA]">
      <ScrollView scrollY className="h-screen">
        <View className="px-3.5 py-3 pb-28">
          <Card className="mb-3">
            <CardContent className="p-4 space-y-3">
              <Text className="block text-sm font-semibold text-gray-900">收货信息</Text>
              <View className="bg-gray-50 rounded-xl px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  placeholder="收货人姓名"
                  value={contactName}
                  onInput={(e) => setContactName(e.detail.value)}
                />
              </View>
              <View className="bg-gray-50 rounded-xl px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  placeholder="手机号"
                  type="number"
                  value={contactPhone}
                  onInput={(e) => setContactPhone(e.detail.value)}
                />
              </View>
              <View className="bg-gray-50 rounded-xl px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  placeholder="详细收货地址"
                  value={shippingAddress}
                  onInput={(e) => setShippingAddress(e.detail.value)}
                />
              </View>
              <View className="bg-gray-50 rounded-xl px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  placeholder="备注（选填）"
                  value={remark}
                  onInput={(e) => setRemark(e.detail.value)}
                />
              </View>
            </CardContent>
          </Card>

          <Card className="mb-3">
            <CardContent className="p-4">
              <Text className="block text-sm font-semibold text-gray-900 mb-3">商品清单</Text>
              {items.map((item) => (
                <View key={item.product_id} className="flex gap-3 mb-3">
                  <Image
                    src={item.image_url}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                    mode="aspectFill"
                  />
                  <View className="flex-1">
                    <Text className="block text-sm text-gray-900 line-clamp-2">{item.name}</Text>
                    <View className="flex justify-between mt-1">
                      <Text className="text-[#C9A96E] text-sm">{item.points_price} 积分</Text>
                      <Text className="text-gray-500 text-sm">x{item.quantity}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <View className="flex justify-between mb-2">
                <Text className="text-sm text-gray-500">支付方式</Text>
                <Text className="text-sm font-medium text-gray-900">积分余额</Text>
              </View>
              <View className="flex justify-between mb-2">
                <Text className="text-sm text-gray-500">可用积分</Text>
                <Text className="text-sm text-gray-900">{userPoints}</Text>
              </View>
              <View className="flex justify-between">
                <Text className="text-sm text-gray-500">应付积分</Text>
                <Text className="text-[#C9A96E] text-base font-bold">{totalPoints}</Text>
              </View>
            </CardContent>
          </Card>
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
          gap: "12px",
          padding: "12px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          backgroundColor: "#fff",
          borderTop: "1px solid #e5e5e5",
          zIndex: 100,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text className="block text-xs text-gray-500">积分支付</Text>
          <Text className="block text-[#C9A96E] text-lg font-bold">{totalPoints}</Text>
        </View>
        <View style={{ flexShrink: 0 }}>
          <Button
            className="bg-[#1B2A4A] px-6"
            disabled={!canPay || submitting}
            onClick={handlePay}
          >
            {submitting ? "支付中..." : canPay ? "确认支付" : "积分不足"}
          </Button>
        </View>
      </View>
    </View>
  )
}

export default MallCheckoutPage
