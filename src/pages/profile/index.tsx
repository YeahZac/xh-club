import { View, Text, ScrollView } from "@tarojs/components"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRight,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  Heart,
  MapPin,
  Users,
  Bell,
  Settings,
  FileText,
  Shield,
  LogOut,
  Star,
} from "lucide-react-taro"

const ORDER_ICONS = [
  { label: "待付款", icon: CreditCard },
  { label: "待发货", icon: Package },
  { label: "待收货", icon: Truck },
  { label: "退换货", icon: RotateCcw },
]

const MENU_ITEMS = [
  { label: "我的收藏", icon: Heart },
  { label: "收货地址", icon: MapPin },
  { label: "邀请好友", icon: Users },
  { label: "消息中心", icon: Bell },
  { label: "会员等级", icon: Star },
  { label: "设置", icon: Settings },
]

const SETTINGS_ITEMS = [
  { label: "用户协议", icon: FileText },
  { label: "隐私政策", icon: Shield },
]

const ProfilePage = () => {
  const goToOrders = (tab?: string) => {
    console.log("go to orders", tab)
  }

  return (
    <ScrollView scrollY className="h-full bg-[#F4F4F4]">
      {/* Profile Header */}
      <View className="bg-gradient-to-br from-[#FF2442] to-[#FF6034] px-4 pt-12 pb-6">
        <View className="flex flex-row items-center gap-3">
          <View
            className="w-16 h-16 rounded-full border-2 flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.25)", borderColor: "rgba(255,255,255,0.4)" }}
          >
            <Text className="text-white text-xl font-bold">星</Text>
          </View>
          <View className="flex-1">
            <View className="flex flex-row items-center gap-2">
              <Text className="block text-white text-lg font-bold">星河会员</Text>
              <Badge className="bg-[#FFB800] text-white text-[9px] px-2 py-0 rounded-full">
                VIP3
              </Badge>
            </View>
            <Text className="block text-xs mt-0" style={{ color: "rgba(255,255,255,0.75)" }}>
              积分 2,580 · 优惠券 5张
            </Text>
          </View>
          <View
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <Settings size={16} color="#fff" />
          </View>
        </View>

        {/* Stats row */}
        <View className="flex flex-row mt-4 rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
          <View className="flex-1 flex flex-col items-center">
            <Text className="block text-white text-lg font-bold">28</Text>
            <Text className="block text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>收藏</Text>
          </View>
          <View className="flex-1 flex flex-col items-center">
            <Text className="block text-white text-lg font-bold">15</Text>
            <Text className="block text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>关注</Text>
          </View>
          <View className="flex-1 flex flex-col items-center">
            <Text className="block text-white text-lg font-bold">5</Text>
            <Text className="block text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>足迹</Text>
          </View>
          <View className="flex-1 flex flex-col items-center">
            <Text className="block text-white text-lg font-bold">2,580</Text>
            <Text className="block text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>积分</Text>
          </View>
        </View>
      </View>

      {/* My Orders */}
      <View className="mx-3 mt-3 bg-white rounded-xl shadow-sm overflow-hidden">
        <View
          className="flex flex-row items-center justify-between px-3 py-2 border-b border-[#F0F0F0]"
          onClick={() => goToOrders()}
        >
          <Text className="text-sm font-bold text-[#1A1A1A]">我的订单</Text>
          <View className="flex flex-row items-center">
            <Text className="text-[10px] text-gray-400">全部订单</Text>
            <ChevronRight size={12} color="#999" />
          </View>
        </View>
        <View className="flex flex-row py-3">
          {ORDER_ICONS.map((item) => {
            const Icon = item.icon
            return (
              <View
                key={item.label}
                className="flex-1 flex flex-col items-center gap-1"
                onClick={() => goToOrders(item.label)}
              >
                <Icon size={22} color="#FF2442" />
                <Text className="block text-[10px] text-gray-600">{item.label}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Feature Menu */}
      <View className="mx-3 mt-3 bg-white rounded-xl shadow-sm overflow-hidden">
        {MENU_ITEMS.map((item, idx) => {
          const Icon = item.icon
          return (
            <View
              key={item.label}
              className={`flex flex-row items-center px-3 py-3 ${idx < MENU_ITEMS.length - 1 ? "border-b border-[#F0F0F0]" : ""}`}
            >
              <Icon size={18} color="#888" className="mr-2" />
              <Text className="flex-1 text-xs text-[#1A1A1A]">{item.label}</Text>
              <ChevronRight size={14} color="#ccc" />
            </View>
          )
        })}
      </View>

      {/* Settings */}
      <View className="mx-3 mt-3 bg-white rounded-xl shadow-sm overflow-hidden">
        {SETTINGS_ITEMS.map((item, idx) => {
          const Icon = item.icon
          return (
            <View
              key={item.label}
              className={`flex flex-row items-center px-3 py-3 ${idx < SETTINGS_ITEMS.length - 1 ? "border-b border-[#F0F0F0]" : ""}`}
            >
              <Icon size={18} color="#888" className="mr-2" />
              <Text className="flex-1 text-xs text-[#1A1A1A]">{item.label}</Text>
              <ChevronRight size={14} color="#ccc" />
            </View>
          )
        })}
      </View>

      {/* Logout */}
      <View className="mx-3 mt-3 mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
        <View className="flex flex-row items-center justify-center px-3 py-3">
          <LogOut size={16} color="#FF2442" className="mr-1" />
          <Text className="text-xs text-[#FF2442] font-semibold">退出登录</Text>
        </View>
      </View>
    </ScrollView>
  )
}

export default ProfilePage
