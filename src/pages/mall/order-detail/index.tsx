import { useEffect, useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Network } from "@/network"

interface MallOrderDetail {
  id: string
  order_no: string
  product_name: string
  quantity: number
  points_used: number
  status: string
  status_label: string
  contact_name?: string
  contact_phone?: string
  shipping_address?: string
  remark?: string
  logistics?: {
    company?: string
    no?: string
    shipped_at?: string
    received_at?: string
  }
  logistics_company?: string
  logistics_no?: string
  created_at?: string
}

const MallOrderDetailPage = () => {
  const [order, setOrder] = useState<MallOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: "订单详情" })
    const id = Taro.getCurrentInstance().router?.params?.id
    if (id) loadOrder(id)
  }, [])

  const loadOrder = async (id: string) => {
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/mall/orders/${id}` })
      console.log("[订单详情]", res?.data)
      if (res?.data?.data) setOrder(res.data.data)
    } catch (err) {
      console.error("[订单详情] 失败", err)
    } finally {
      setLoading(false)
    }
  }

  const confirmReceipt = async () => {
    if (!order) return
    const { confirm } = await Taro.showModal({
      title: "确认收货",
      content: "确认已收到商品？",
    })
    if (!confirm) return
    try {
      const res = await Network.request({
        url: `/api/mall/orders/${order.id}/confirm-receipt`,
        method: "POST",
      })
      if (res?.data?.code === 200) {
        Taro.showToast({ title: "已确认收货", icon: "success" })
        setOrder(res.data.data)
      } else {
        Taro.showToast({ title: res?.data?.msg || "操作失败", icon: "none" })
      }
    } catch (err) {
      console.error("[确认收货] 失败", err)
      Taro.showToast({ title: "操作失败", icon: "none" })
    }
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-screen">
        <Text className="text-gray-400 text-sm">加载中...</Text>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="flex items-center justify-center h-screen">
        <Text className="text-gray-400 text-sm">订单不存在</Text>
      </View>
    )
  }

  const logisticsCompany = order.logistics?.company || order.logistics_company
  const logisticsNo = order.logistics?.no || order.logistics_no

  return (
    <ScrollView scrollY className="h-screen bg-[#F5F6FA]">
      <View className="px-3.5 py-3 pb-24">
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <Text className="text-base font-semibold text-gray-900">
                {order.status_label || order.status}
              </Text>
              <Badge className="bg-gray-100 text-gray-700">{order.order_no}</Badge>
            </View>
            <Text className="block text-xs text-gray-400 mt-2">
              {order.status === "paid" && "积分已支付，商家正在备货发货"}
              {order.status === "shipped" && "商品已发出，可查看物流信息"}
              {order.status === "completed" && "订单已完成"}
            </Text>
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-gray-900 mb-2">商品信息</Text>
            <Text className="block text-sm text-gray-800">{order.product_name}</Text>
            <View className="flex justify-between mt-2">
              <Text className="text-sm text-gray-500">数量 x{order.quantity}</Text>
              <Text className="text-[#C9A96E] font-bold">{order.points_used} 积分</Text>
            </View>
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-sm font-semibold text-gray-900 mb-2">收货信息</Text>
            <Text className="block text-sm text-gray-700">
              {order.contact_name} {order.contact_phone}
            </Text>
            <Text className="block text-sm text-gray-600 mt-1">{order.shipping_address}</Text>
            {!!order.remark && (
              <Text className="block text-xs text-gray-400 mt-2">备注：{order.remark}</Text>
            )}
          </CardContent>
        </Card>

        {(order.status === "shipped" || order.status === "completed") && (
          <Card className="mb-3">
            <CardContent className="p-4">
              <Text className="block text-sm font-semibold text-gray-900 mb-2">物流信息</Text>
              {logisticsCompany ? (
                <>
                  <Text className="block text-sm text-gray-700">承运商：{logisticsCompany}</Text>
                  <Text className="block text-sm text-gray-700 mt-1">运单号：{logisticsNo}</Text>
                  {order.logistics?.shipped_at && (
                    <Text className="block text-xs text-gray-400 mt-2">
                      发货时间：{order.logistics.shipped_at}
                    </Text>
                  )}
                  {order.logistics?.received_at && (
                    <Text className="block text-xs text-gray-400 mt-1">
                      收货时间：{order.logistics.received_at}
                    </Text>
                  )}
                </>
              ) : (
                <Text className="block text-sm text-gray-400">暂无物流信息</Text>
              )}
            </CardContent>
          </Card>
        )}
      </View>

      {order.status === "shipped" && (
        <View
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
            backgroundColor: "#fff",
            borderTop: "1px solid #e5e5e5",
            zIndex: 100,
          }}
        >
          <Button className="w-full bg-[#1B2A4A]" onClick={confirmReceipt}>
            确认收货
          </Button>
        </View>
      )}
    </ScrollView>
  )
}

export default MallOrderDetailPage
