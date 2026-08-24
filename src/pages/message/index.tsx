import { useState, useEffect, useCallback, useRef } from "react"
import { View, Text } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import {
  Bell, Clock, CircleAlert,
  CircleCheck, Gift, Handshake, TrendingUp, UserPlus, FileCheck,
} from "lucide-react-taro"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, HeroHeader, PageShell, SoftCard, brandColors, icon, ui } from "@/components/brand-ui"
import { AUTH_LOGGED_IN_EVENT, ensureLogin, isLoggedIn } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { usePageShare } from '@/lib/mini-program-share'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/notifications"

const RESULT_LABEL: Record<string, string> = {
  pending: '待处理',
  approved: '已通过/已同意',
  rejected: '未通过/已拒绝',
  shared: '已分享',
  updated: '状态已更新',
  admin_updated: '后台已更新',
}

const BIZ_LABEL: Record<string, string> = {
  project_audit: '项目审核',
  business_audit: '商机审核',
  business_comment: '商机评论',
  talent_audit: '人才审核',
  deal_application: '项目对接',
  project_share: '项目分享',
  member_audit: '会员审核',
  event_register: '活动报名',
  roadshow_register: '路演报名',
}

const notifIconMap: Record<string, typeof Bell> = {
  system: CircleAlert,
  activity: Clock,
  approval: CircleCheck,
  commission: Gift,
  credit: TrendingUp,
  referral: UserPlus,
  deal: Handshake,
  share: TrendingUp,
}

const bizIconMap: Record<string, typeof Bell> = {
  project_audit: FileCheck,
  business_audit: FileCheck,
  business_comment: FileCheck,
  talent_audit: UserPlus,
  member_audit: UserPlus,
  deal_application: Handshake,
  event_register: Clock,
  roadshow_register: Clock,
}

const MessagePage = () => {
  usePageShare()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [needLogin, setNeedLogin] = useState(false)
  const loadSeq = useRef(0)

  const loadMessageData = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      setLoading(true)
      if (!isLoggedIn()) {
        if (seq !== loadSeq.current) return
        setNeedLogin(true)
        setNotifications([])
        setUnreadCount(0)
        return
      }
      setNeedLogin(false)
      const [notificationList, count] = await Promise.all([
        fetchNotifications(),
        fetchUnreadNotificationCount(),
      ])
      if (seq !== loadSeq.current) return
      setNotifications(notificationList)
      setUnreadCount(count)
    } catch (err) {
      if (seq !== loadSeq.current) return
      console.error('[消息页] 加载失败:', err)
      setNotifications([])
      setUnreadCount(0)
      Taro.showToast({ title: '通知加载失败', icon: 'none' })
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMessageData()
    const onLogin = () => { void loadMessageData() }
    Taro.eventCenter.on(AUTH_LOGGED_IN_EVENT, onLogin)
    return () => {
      Taro.eventCenter.off(AUTH_LOGGED_IN_EVENT, onLogin)
    }
  }, [loadMessageData])

  useDidShow(() => {
    void loadMessageData()
  })

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return `${(d.getMonth() + 1)}/${d.getDate()}`
  }

  const openNotification = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await markNotificationsRead([String(item.id)])
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id ? { ...notification, is_read: true } : notification,
          ),
        )
        setUnreadCount((current) => Math.max(0, current - 1))
      } catch (error) {
        console.warn('[消息页] 标记通知已读失败:', error)
      }
    }
    const link = String(item.link || '').trim()
    if (!link) return
    const appendFrom = (url: string) => {
      if (url.includes('from=')) return url
      return url.includes('?') ? `${url}&from=message` : `${url}?from=message`
    }
    if (link.startsWith('/pages/')) {
      const tabPages = [
        '/pages/index/index',
        '/pages/business/index',
        '/pages/discover/index',
        '/pages/mall/index',
        '/pages/profile/index',
      ]
      const normalized = link.split('?')[0]
      if (tabPages.includes(normalized)) {
        Taro.switchTab({
          url: normalized,
          fail: () => Taro.showToast({ title: '无法打开页面', icon: 'none' }),
        })
        return
      }
      Taro.navigateTo({
        url: appendFrom(link),
        fail: () => Taro.showToast({ title: '无法打开详情', icon: 'none' }),
      })
      return
    }
    if (link.startsWith('pages/')) {
      Taro.navigateTo({
        url: appendFrom(`/${link}`),
        fail: () => Taro.showToast({ title: '无法打开详情', icon: 'none' }),
      })
    }
  }

  const markAllRead = async () => {
    if (!unreadCount) return
    try {
      await markNotificationsRead()
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
      setUnreadCount(0)
      Taro.showToast({ title: '已全部已读', icon: 'success' })
    } catch (error) {
      console.warn('[消息页] 全部已读失败:', error)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleLogin = async () => {
    const ok = await ensureLogin('')
    if (ok) void loadMessageData()
  }

  const headerAction = unreadCount > 0 ? (
    <Text className="block text-xs text-white text-opacity-80" onClick={() => void markAllRead()}>
      全部已读
    </Text>
  ) : undefined

  return (
    <PageShell>
      <HeroHeader
        eyebrow="星河俱乐部"
        title={unreadCount > 0 ? `消息通知 · ${unreadCount > 99 ? '99+' : unreadCount}` : '消息通知'}
        subtitle="审核、报名与对接进度将在此通知"
        action={headerAction}
        showBack
        backFallbackUrl="/pages/profile/index"
      />

      <View className={`${ui.pagePad} ${ui.sectionGap} flex flex-col ${ui.listGap} ${ui.scrollBottomPad} pt-4`}>
        {loading ? (
          <Text className={cn(ui.caption, "py-16 text-center")}>加载中...</Text>
        ) : needLogin ? (
          <EmptyState
            title="登录后查看通知"
            description="审核结果、报名与对接消息将集中展示"
            icon={Bell}
          />
        ) : notifications.length === 0 ? (
          <EmptyState title="暂无通知" description="有新的动态时会在这里提醒你" icon={Bell} />
        ) : (
          notifications.map((item) => {
            const IconComp = bizIconMap[item.biz_type || ''] || notifIconMap[item.type] || Bell
            return (
              <SoftCard
                key={item.id}
                className={!item.is_read ? 'border-primary border-opacity-20 bg-blue-tint' : ''}
                onClick={() => void openNotification(item)}
              >
                <View className={ui.cardPad}>
                  <View className="flex flex-row items-start gap-3">
                    <View
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                        !item.is_read ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <IconComp
                        size={ui.iconInline + 2}
                        color={item.is_read ? brandColors.muted : icon.color.inverse}
                        strokeWidth={ui.iconStroke}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <View className="mb-1 flex flex-row items-center justify-between gap-2">
                        <Text className={cn(ui.cardTitle, "flex-1 line-clamp-1")}>{item.title}</Text>
                        {!item.is_read ? (
                          <View className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </View>
                      <View className="mb-1 flex flex-row flex-wrap gap-2">
                        {item.biz_type ? (
                          <Badge className="bg-blue-surface px-2 py-0 text-xs text-primary">
                            {BIZ_LABEL[item.biz_type] || item.biz_type}
                          </Badge>
                        ) : null}
                        {item.result ? (
                          <Badge className="bg-accent px-2 py-0 text-xs text-accent-foreground">
                            {RESULT_LABEL[item.result] || item.result}
                          </Badge>
                        ) : null}
                      </View>
                      <Text className={cn(ui.caption, "mb-1 text-muted-foreground line-clamp-2")}>{item.content}</Text>
                      <Text className={ui.caption}>
                        {formatTime(item.processed_at || item.created_at)}
                      </Text>
                      {item.link ? (
                        <Text className="mt-1 block text-xs text-primary">点击查看详情</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </SoftCard>
            )
          })
        )}

        {needLogin ? (
          <Button variant="brand" size="lg" className="w-full" onClick={() => void handleLogin()}>
            <Text className="block text-sm font-semibold text-primary-foreground">去登录</Text>
          </Button>
        ) : null}
      </View>
    </PageShell>
  )
}

export default MessagePage
