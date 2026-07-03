import { useState, useEffect } from "react"
import { View, Text, ScrollView } from "@tarojs/components"
import Taro from "@tarojs/taro"
import {
  Bell, ChevronRight, Clock, CircleAlert,
  CircleCheck, Gift, TrendingUp, UserPlus
} from "lucide-react-taro"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Network } from "@/network"

interface ChatItem {
  id: string
  name: string
  lastMessage: string
  time: string
  unread: number
  avatar: string
}

interface NotificationItem {
  id: string
  type: string
  title: string
  content: string
  is_read: boolean
  created_at: string
  link: string
}

const notifIconMap: Record<string, any> = {
  system: CircleAlert,
  activity: Clock,
  approval: CircleCheck,
  commission: Gift,
  credit: TrendingUp,
  referral: UserPlus,
}

const MessagePage = () => {
  const [activeTab, setActiveTab] = useState("chat")
  const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv() as string)
  const statusBarHeight = isMiniApp ? 22 : 8

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const mockChats: ChatItem[] = [
    { id: '1', name: '张伟', lastMessage: '您好，关于项目合作想和您聊聊', time: '10:30', unread: 2, avatar: '' },
    { id: '2', name: '广州分会群', lastMessage: '本周六沙龙活动报名中...', time: '09:15', unread: 5, avatar: '' },
    { id: '3', name: '李明', lastMessage: 'BP已发送到您邮箱，请查收', time: '昨天', unread: 0, avatar: '' },
    { id: '4', name: '科技部群', lastMessage: '下月路演项目征集', time: '昨天', unread: 0, avatar: '' },
  ]

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const res = await Network.request({ url: '/api/messages/notifications' })
      console.log('[消息页] notifications:', res?.data)
      if (res?.data?.data) {
        setNotifications(res.data.data)
        setUnreadCount(res.data.data.filter((n: NotificationItem) => !n.is_read).length)
      }
    } catch (err) {
      console.error('[消息页] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return `${(d.getMonth() + 1)}/${d.getDate()}`
  }

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      {/* Header */}
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-4 pb-4">
        <View style={{ height: `${statusBarHeight}px` }} />
        <Text className="block text-xl font-bold text-white">消息</Text>
      </View>

      {/* Tabs */}
      <View className="px-4 -mt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white rounded-xl shadow-sm w-full flex flex-row justify-around p-1 h-auto">
            <TabsTrigger value="chat" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm">
              聊天
            </TabsTrigger>
            <TabsTrigger value="notification" className="flex-1 rounded-lg data-[state=active]:bg-[#1B2A4A] data-[state=active]:text-white py-2 text-sm relative">
              通知
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 py-0 min-w-[16px] h-4 flex items-center justify-center">{unreadCount > 99 ? '99+' : unreadCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 180px)' }}>
              <View className="flex flex-col gap-2 pb-8">
                {mockChats.map((item) => (
                  <Card key={item.id} className="shadow-sm border-0">
                    <CardContent className="p-4">
                      <View className="flex flex-row items-center gap-3">
                        <View className="relative">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] text-white text-base">{item.name[0]}</AvatarFallback>
                          </Avatar>
                          {item.unread > 0 && (
                            <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 py-0 min-w-[16px] h-4 flex items-center justify-center">{item.unread}</Badge>
                          )}
                        </View>
                        <View className="flex-1 min-w-0">
                          <View className="flex flex-row items-center justify-between mb-1">
                            <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.name}</Text>
                            <Text className="block text-xs text-gray-400">{item.time}</Text>
                          </View>
                          <Text className="block text-xs text-gray-500 truncate">{item.lastMessage}</Text>
                        </View>
                        <ChevronRight size={16} color="#D1D5DB" />
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </ScrollView>
          </TabsContent>

          {/* Notification Tab */}
          <TabsContent value="notification">
            <ScrollView scrollY className="mt-4" style={{ height: 'calc(100vh - 180px)' }}>
              <View className="flex flex-col gap-2 pb-8">
                {notifications.map((item) => {
                  const IconComp = notifIconMap[item.type] || Bell
                  return (
                    <Card key={item.id} className={`shadow-sm border-0 ${!item.is_read ? 'bg-blue-50' : ''}`}>
                      <CardContent className="p-4">
                        <View className="flex flex-row items-start gap-3">
                          <View className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${!item.is_read ? 'bg-[#1B2A4A]' : 'bg-gray-100'}`}>
                            <IconComp size={18} color={item.is_read ? '#9CA3AF' : '#ffffff'} />
                          </View>
                          <View className="flex-1 min-w-0">
                            <View className="flex flex-row items-center justify-between mb-1">
                              <Text className="block text-sm font-semibold text-[#1A1D2E]">{item.title}</Text>
                              {!item.is_read && <View className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                            </View>
                            <Text className="block text-xs text-gray-500 mb-1">{item.content}</Text>
                            <Text className="block text-[10px] text-gray-400">{formatTime(item.created_at)}</Text>
                          </View>
                        </View>
                      </CardContent>
                    </Card>
                  )
                })}
                {notifications.length === 0 && !loading && (
                  <View className="flex items-center justify-center py-16">
                    <Text className="block text-sm text-gray-400">暂无通知</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </TabsContent>
        </Tabs>
      </View>
      <View className="h-16" />
    </View>
  )
}

export default MessagePage
