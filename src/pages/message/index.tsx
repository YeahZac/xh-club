import { useState } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Search, Bell, ChevronRight, Users, Clock
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

/* ── Mock Data ── */
const CHATS = [
  { id: 1, name: "张伟明", avatar: "", lastMsg: "那个项目方案你看了吗？我觉得很有潜力", time: "10:32", unread: 2, isGroup: false },
  { id: 2, name: "广州分会·金融部", avatar: "", lastMsg: "刘部长：下周三例会改到2点", time: "09:15", unread: 5, isGroup: true },
  { id: 3, name: "陈国强", avatar: "", lastMsg: "好的，明天下午3点见面详谈", time: "昨天", unread: 0, isGroup: false },
  { id: 4, name: "2025峰会筹备组", avatar: "", lastMsg: "王秘书：场地已确认，方案已更新", time: "昨天", unread: 0, isGroup: true },
  { id: 5, name: "黄晓琳", avatar: "", lastMsg: "渠道合作方案我发你邮箱了", time: "周一", unread: 0, isGroup: false },
  { id: 6, name: "智能制造兴趣圈", avatar: "", lastMsg: "李工：新出的AI质检方案大家看看", time: "周一", unread: 12, isGroup: true },
]

const NOTIFICATIONS = [
  {
    id: 1, type: "approval", title: "入会审批", desc: "新会员赵XX的入会申请需要您审批",
    time: "30分钟前", read: false,
  },
  {
    id: 2, type: "deal", title: "成交确认", desc: "您撮合的智能仓储项目已成交，获得56积分",
    time: "1小时前", read: false,
  },
  {
    id: 3, type: "activity", title: "活动提醒", desc: "粤商年度峰会将于明天09:00开始，请准时参加",
    time: "2小时前", read: false,
  },
  {
    id: 4, type: "recommend", title: "推荐奖励", desc: "您推荐的王XX已正式入会，获得100积分奖励",
    time: "昨天", read: true,
  },
  {
    id: 5, type: "system", title: "信用评分更新", desc: "您的信用评分已更新为82分，继续保持",
    time: "昨天", read: true,
  },
  {
    id: 6, type: "credit", title: "等级晋升", desc: "恭喜！您已晋升为金卡会员，解锁更多特权",
    time: "3天前", read: true,
  },
]

const NOTIFICATION_TYPE_MAP: Record<string, { color: string; bg: string }> = {
  approval: { color: "#6366F1", bg: "#F0F0FE" },
  deal: { color: "#C9A96E", bg: "#FAF6F1" },
  activity: { color: "#10B981", bg: "#ECFDF5" },
  recommend: { color: "#EC4899", bg: "#FDF2F8" },
  system: { color: "#3B82F6", bg: "#EFF6FF" },
  credit: { color: "#F59E0B", bg: "#FFFBEB" },
}

const MessagePage = () => {
  const [activeTab, setActiveTab] = useState("chat")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      {/* Header */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-4">
        <View style={{ height: `${statusBarHeight}px` }} />
        <View className="flex flex-row items-center justify-between mb-3">
          <Text className="block text-xl font-bold text-white">消息</Text>
          <Bell size={20} color="#ffffff" />
        </View>
        <View className="rounded-xl px-3 py-2 flex flex-row items-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <Text className="block text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>搜索联系人、群聊...</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="px-4 -mt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white rounded-xl shadow-sm w-full flex flex-row justify-around p-1 h-auto">
            <TabsTrigger value="chat" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              聊天
            </TabsTrigger>
            <TabsTrigger value="notify" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              通知
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 200px)' }}>
              <View className="flex flex-col gap-2 pb-8">
                {CHATS.map((chat) => (
                  <Card key={chat.id} className="shadow-sm border-0">
                    <CardContent className="p-3">
                      <View className="flex flex-row items-center gap-3">
                        <View className="relative flex-shrink-0">
                          <Avatar className="w-11 h-11">
                            {chat.isGroup ? (
                              <AvatarFallback className="bg-[#1B2A4A]">
                                <Users size={18} color="#ffffff" />
                              </AvatarFallback>
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-sm">{chat.name[0]}</AvatarFallback>
                            )}
                          </Avatar>
                          {chat.unread > 0 && (
                            <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center">
                              <Text className="block text-[10px] text-white font-bold">{chat.unread > 99 ? '99+' : chat.unread}</Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-1 min-w-0">
                          <View className="flex flex-row items-center justify-between mb-1">
                            <Text className="block text-sm font-semibold text-[#1A1D2E] truncate">{chat.name}</Text>
                            <Text className="block text-[10px] text-gray-400 flex-shrink-0 ml-2">{chat.time}</Text>
                          </View>
                          <Text className="block text-xs text-gray-500 truncate">{chat.lastMsg}</Text>
                        </View>
                        <ChevronRight size={14} color="#D1D5DB" className="flex-shrink-0" />
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Notification Tab */}
          <TabsContent value="notify">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 200px)' }}>
              <View className="flex flex-col gap-3 pb-8">
                {NOTIFICATIONS.map((item) => {
                  const typeStyle = NOTIFICATION_TYPE_MAP[item.type] || NOTIFICATION_TYPE_MAP.system
                  return (
                    <Card key={item.id} className={`shadow-sm border-0 ${!item.read ? 'border-l-2 border-l-[#C9A96E]' : ''}`}>
                      <CardContent className="p-4">
                        <View className="flex flex-row items-start gap-3">
                          <View className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: typeStyle.bg }}>
                            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: typeStyle.color }} />
                          </View>
                          <View className="flex-1 min-w-0">
                            <View className="flex flex-row items-center justify-between mb-1">
                              <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.title}</Text>
                              {!item.read && <View className="w-2 h-2 bg-red-500 rounded-full" />}
                            </View>
                            <Text className="block text-xs text-gray-500 leading-relaxed mb-1">{item.desc}</Text>
                            <View className="flex flex-row items-center gap-1">
                              <Clock size={10} color="#9CA3AF" />
                              <Text className="block text-[10px] text-gray-400">{item.time}</Text>
                            </View>
                          </View>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}
              </View>
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>
    </View>
  )
}

export default MessagePage
