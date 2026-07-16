import { useState } from "react"
import { View, Text, ScrollView, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import { Package } from "lucide-react-taro"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Network } from "@/network"

interface MallOrder {
  id: string
  order_no: string
  product_name: string
  product_image?: string
  quantity: number
  points_used: number
  status: string
  status_label: string
  created_at?: string
  logistics_company?: string
  logistics_no?: string
}

const STATUS_TABS = [
  { key: "all", label: "全部" },
  { key: "paid", label: "待发货" },
  { key: "shipped", label: "已发货" },
  { key: "completed", label: "已收货" },
]

const MallOrdersPage = () => {
  const [status, setStatus] = useState("all")
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: "我的订单" })
    const params = Taro.getCurrentInstance().router?.params
    if (params?.status) setStatus(params.status)
    loadOrders(params?.status || status)
  })

  const loadOrders = async (filter = status) => {
    setLoading(true)
    try {
      const url =
        filter && filter !== "all"
          ? `/api/mall/orders?status=${filter}`
          : "/api/mall/orders"
      const res = await Network.request({ url })
      console.log("[订单列表]", res?.data)
      const list = res?.data?.data
      setOrders(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error("[订单列表] 失败", err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const confirmReceipt = async (orderId: string) => {
    const { confirm } = await Taro.showModal({
      title: "确认收货",
      content: "确认已收到商品？",
    })
    if (!confirm) return
    try {
      const res = await Network.request({
        url: `/api/mall/orders/${orderId}/confirm-receipt`,
        method: "POST",
      })
      if (res?.data?.code === 200) {
        Taro.showToast({ title: "已确认收货", icon: "success" })
        loadOrders()
      } else {
        Taro.showToast({ title: res?.data?.msg || "操作失败", icon: "none" })
      }
    } catch (err) {
      console.error("[确认收货] 失败", err)
      Taro.showToast({ title: "操作失败", icon: "none" })
    }
  }

  return (
    <View className="min-h-screen bg-[#F5F6FA]">
      <View className="bg-white px-3 py-2 flex gap-2 sticky top-0 z-10">
        {STATUS_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`px-3 py-1.5 rounded-md text-xs ${
              status === tab.key ? "bg-[#1B2A4A] text-white" : "bg-gray-100 text-gray-600"
            }`}
            onClick={() => {
              setStatus(tab.key)
              loadOrders(tab.key)
            }}
          >
            {tab.label}
          </View>
        ))}
      </View>

      <ScrollView scrollY className="h-screen">
        <View className="px-3.5 py-3 pb-10">
          {loading ? (
            <Text className="block text-center text-gray-400 text-sm py-12">加载中...</Text>
          ) : !orders.length ? (
            <View className="flex flex-col items-center py-16">
              <Package size={40} color="#d1d5db" />
              <Text className="block text-gray-400 text-sm mt-3">暂无订单</Text>
            </View>
          ) : (
            orders.map((order) => (
              <Card
                key={order.id}
                className="mb-2"
                onClick={() =>
                  Taro.navigateTo({ url: `/pages/mall/order-detail/index?id=${order.id}` })
                }
              >
                <CardContent className="p-3">
                  <View className="flex items-center justify-between mb-2">
                    <Text className="text-xs text-gray-400">{order.order_no}</Text>
                    <Badge className="bg-gray-100 text-gray-700 text-xs">
                      {order.status_label || order.status}
                    </Badge>
                  </View>
                  <View className="flex gap-3">
                    {order.product_image ? (
                      <Image
                        src={order.product_image}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                        mode="aspectFill"
                      />
                    ) : (
                      <View className="w-16 h-16 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <View className="flex-1">
                      <Text className="block text-sm font-medium text-gray-900 line-clamp-2">
                        {order.product_name}
                      </Text>
                      <View className="flex justify-between mt-2">
                        <Text className="text-xs text-gray-500">x{order.quantity}</Text>
                        <Text className="text-[#C9A96E] text-sm font-bold">
                          {order.points_used} 积分
                        </Text>
                      </View>
                    </View>
                  </View>
                  {order.status === "shipped" && (
                    <View className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation?.()}>
                      <Button
                        size="sm"
                        className="bg-[#1B2A4A]"
                        onClick={(e) => {
                          e?.stopPropagation?.()
                          confirmReceipt(order.id)
                        }}
                      >
                        确认收货
                      </Button>
                    </View>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default MallOrdersPage
