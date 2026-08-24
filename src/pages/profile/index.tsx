import { useState, useEffect, useRef } from "react"
import { View, Text, Image } from "@tarojs/components"
import Taro, { useDidShow } from "@tarojs/taro"
import {
  User, TrendingUp,
  Users, Wallet, CalendarDays, Coins,
  DollarSign, BadgeCheck, SquarePen, MessageSquare, LogOut, Bell,
} from "lucide-react-taro"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  brandColors,
  HeroHeader,
  icon,
  MenuListItem,
  layout,
  PageShell,
  SectionTitle,
  SoftCard,
} from "@/components/brand-ui"
import { Network } from "@/network"
import {
  AUTH_LOGGED_IN_EVENT,
  AUTH_LOGGED_OUT_EVENT,
  clearMemberSession,
  ensureLogin,
  isLoggedIn,
  logoutMember,
} from "@/lib/auth"
import { useTabShareAppMessage } from "@/lib/mini-program-share"
import { userCategoryLabel } from "@/lib/user-category"
import { ensurePromoterOrMemberUnit } from "@/lib/member-access"
import { fetchUnreadNotificationCount } from "@/lib/notifications"

interface MemberProfile {
  id: string
  name: string
  avatar: string
  phone: string
  company_name: string
  company_position: string
  industry_primary: string
  membership_level: string
  member_type: string
  user_category?: string
  user_category_label?: string
  credit_score: number
  active_score: number
  contribution_score: number
  total_points: number
  available_points: number
  total_transactions: number
  total_transaction_amount: number
  deal_amount?: number
  deal_amount_wan?: number
  deal_success_count?: number
  deal_count?: number
  referrer_count: number
  match_count: number
  member_days?: number
  created_at?: string
}

interface DistributionStats {
  total_earnings: number
  pending_earnings: number
  settled_earnings: number
  subordinate_count: number
  direct_count: number
  indirect_count: number
}

const levelMap: Record<string, { label: string; badgeVariant: "soft" | "gold" | "navy" }> = {
  normal: { label: "普通会员", badgeVariant: "soft" },
  silver: { label: "银卡会员", badgeVariant: "soft" },
  gold: { label: "金卡会员", badgeVariant: "gold" },
  diamond: { label: "钻石会员", badgeVariant: "navy" },
}

const ProfilePage = () => {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [distStats, setDistStats] = useState<DistributionStats | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const refreshSeq = useRef(0)
  const lastRefreshAt = useRef(0)

  useTabShareAppMessage("profile")

  const refreshAll = async (options?: { force?: boolean }) => {
    const now = Date.now()
    if (!options?.force && now - lastRefreshAt.current < 60_000 && profile) {
      void loadUnreadNotifications(refreshSeq.current)
      return
    }
    lastRefreshAt.current = now
    const seq = ++refreshSeq.current
    await loadProfile(seq)
    if (seq !== refreshSeq.current) return
    await Promise.all([loadDistributionStats(seq), loadUnreadNotifications(seq)])
  }

  useEffect(() => {
    void refreshAll({ force: true })
    const onLogin = () => { void refreshAll({ force: true }) }
    const onLogout = () => {
      setProfile(null)
      setDistStats(null)
      lastRefreshAt.current = 0
    }
    Taro.eventCenter.on(AUTH_LOGGED_IN_EVENT, onLogin)
    Taro.eventCenter.on(AUTH_LOGGED_OUT_EVENT, onLogout)
    return () => {
      Taro.eventCenter.off(AUTH_LOGGED_IN_EVENT, onLogin)
      Taro.eventCenter.off(AUTH_LOGGED_OUT_EVENT, onLogout)
    }
  }, [])

  useDidShow(() => {
    void refreshAll()
  })

  const loadProfile = async (seq = refreshSeq.current) => {
    try {
      if (!isLoggedIn()) {
        setProfile(null)
        return
      }
      const memberId = Taro.getStorageSync("member_id")
      const res = await Network.request({ url: `/api/members/profile/${memberId}` })
      if (seq !== refreshSeq.current || !isLoggedIn()) return
      if (res?.data?.data) {
        setProfile(res.data.data)
        return
      }
      const code = res?.data?.code
      if (code === 401 || code === 403 || code === 404 || res?.statusCode === 401) {
        clearMemberSession()
        setProfile(null)
      }
    } catch (err) {
      console.error("[我的页] 加载失败:", err)
    }
  }

  const loadDistributionStats = async (seq = refreshSeq.current) => {
    try {
      if (!isLoggedIn()) return
      const memberId = Taro.getStorageSync("member_id")
      const res = await Network.request({ url: `/api/mall/distribution/stats/${memberId}` })
      if (seq !== refreshSeq.current || !isLoggedIn()) return
      if (res?.data?.data) setDistStats(res.data.data)
    } catch (err) {
      console.error("[我的页] 加载分销统计失败:", err)
    }
  }

  const loadUnreadNotifications = async (seq = refreshSeq.current) => {
    if (!isLoggedIn()) {
      setUnreadNotifications(0)
      return
    }
    const count = await fetchUnreadNotificationCount()
    if (seq !== refreshSeq.current) return
    setUnreadNotifications(count)
  }

  const openProfileEdit = async () => {
    if (!isLoggedIn() || !profile) {
      if (isLoggedIn() && !profile) {
        clearMemberSession()
      }
      const ok = await ensureLogin("", true)
      if (ok) await refreshAll()
      return
    }
    Taro.navigateTo({ url: "/pages/profile-edit/index" })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: "退出登录",
      content: "确定退出当前微信账号吗？",
      success: (res) => {
        if (!res.confirm) return
        logoutMember()
        Taro.showToast({ title: "已退出", icon: "success" })
      },
    })
  }

  const currentLevel = levelMap[profile?.membership_level || "normal"] || levelMap.normal

  const getRegisterDays = (createdAt?: string) => {
    if (!createdAt) return 0
    const created = new Date(createdAt).getTime()
    if (Number.isNaN(created)) return 0
    return Math.max(1, Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000)) + 1)
  }

  const handleMenuAction = async (action: string) => {
    if (action === "coming-soon") {
      Taro.showToast({ title: "该功能暂未开通", icon: "none" })
      return
    }
    if (action === "logout") {
      if (!isLoggedIn()) {
        await ensureLogin("")
        return
      }
      handleLogout()
      return
    }
    if (!(await ensureLogin())) return

    // 推荐管理：所有会员类型均可；成交对接 / 发布商机仍限推广员、会员单位
    const guardedActions: Record<string, string> = {
      "deal-applications": "项目成交对接",
      "publish-post": "发布商机",
    }
    const guardLabel = guardedActions[action]
    if (guardLabel && !(await ensurePromoterOrMemberUnit(guardLabel))) return

    const routes: Record<string, string> = {
      invite: "/pages/invite/index",
      "deal-applications": "/pages/deal-applications/index",
      "my-registrations": "/pages/my-registrations/index",
      "my-posts": "/pages/my-posts/index",
      "publish-post": "/pages/publish-post/index",
      "points-records": "/pages/points-records/index",
      feedback: "/pages/feedback/index",
      talent: "/pages/talent-settle/index",
      messages: "/pages/message/index",
    }
    const url = routes[action]
    if (url) Taro.navigateTo({ url })
  }

  const menuSections = [
    {
      title: "业务管理",
      items: [
        { icon: TrendingUp, label: "推荐管理", badge: profile?.referrer_count ? `${profile.referrer_count}人` : "", action: "invite", iconColor: brandColors.blue },
        { icon: Users, label: "项目成交对接", badge: profile?.match_count ? `${profile.match_count}次` : "", action: "deal-applications", iconColor: brandColors.navySecondary },
      ],
    },
    {
      title: "其他",
      items: [
        { icon: CalendarDays, label: "我的报名", action: "my-registrations", iconColor: brandColors.blue },
        { icon: Bell, label: "消息通知", badge: unreadNotifications > 0 ? (unreadNotifications > 99 ? "99+" : `${unreadNotifications}`) : "", action: "messages", iconColor: brandColors.blue },
        { icon: MessageSquare, label: "用户反馈", action: "feedback", iconColor: brandColors.mint },
        { icon: SquarePen, label: "发布商机", action: "publish-post", iconColor: brandColors.warning },
        { icon: SquarePen, label: "我的商机", action: "my-posts", iconColor: brandColors.warning },
        { icon: BadgeCheck, label: "人才入驻", action: "talent", iconColor: brandColors.gold },
        { icon: LogOut, label: "退出登录", action: "logout", danger: true },
      ],
    },
    {
      title: "资产与权益",
      items: [
        {
          icon: Coins,
          label: "积分明细",
          badge: profile?.available_points != null ? `${profile.available_points}` : "",
          action: "points-records",
          iconColor: brandColors.gold,
        },
        { icon: DollarSign, label: "分销收益", badge: distStats?.total_earnings ? `¥${distStats.total_earnings.toFixed(0)}` : "", action: "coming-soon", iconColor: brandColors.success },
        { icon: Wallet, label: "收益管理", action: "coming-soon", iconColor: brandColors.gold },
      ],
    },
  ]

  return (
    <PageShell>
      <HeroHeader title="我的" dense />

      <View className="px-4">
        {profile ? (
          <SoftCard className="overflow-hidden p-4">
            <View className="flex flex-row items-center gap-3" onClick={() => void openProfileEdit()}>
              <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
                {profile.avatar ? (
                  <Image src={profile.avatar} className="h-full w-full rounded-full" mode="aspectFill" />
                ) : (
                  <AvatarFallback
                    className="text-xl text-white"
                    style={{ background: `linear-gradient(135deg, ${brandColors.navyDeep}, ${brandColors.navySecondary})` }}
                  >
                    {(profile.name || "星")[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <View className="min-w-0 flex-1">
                <Text className="block text-lg font-semibold text-foreground">{profile.name}</Text>
                <Text className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {[profile.company_position, profile.company_name].filter(Boolean).join(" · ") || "点击编辑个人资料"}
                </Text>
                <View className="mt-2 flex flex-row flex-wrap items-center gap-2">
                  <Badge variant={currentLevel.badgeVariant}>{currentLevel.label}</Badge>
                  <Badge variant="soft">
                    {profile.user_category_label || userCategoryLabel(profile.user_category)}
                  </Badge>
                </View>
              </View>
            </View>
            <View className="mt-4 flex flex-row rounded-xl bg-blue-surface px-3 py-3">
              <View className="flex-1" onClick={() => void handleMenuAction("points-records")}>
                <Text className="block text-center text-base font-semibold text-primary">{profile.available_points || 0}</Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">积分明细</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-primary">
                  {profile.member_days || getRegisterDays(profile.created_at)}
                </Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">注册天数</Text>
              </View>
              <View className="flex-1">
                <Text className="block text-center text-base font-semibold text-primary">{profile.referrer_count || 0}</Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">推荐</Text>
              </View>
            </View>
            <View className="mt-2 flex flex-row rounded-xl bg-blue-surface px-3 py-3">
              <View className="flex-1" onClick={() => void handleMenuAction("deal-applications")}>
                <Text className="block text-center text-base font-semibold text-primary">
                  {Number(profile.deal_amount_wan || 0)}
                </Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">成交金额(万)</Text>
              </View>
              <View className="flex-1" onClick={() => void handleMenuAction("deal-applications")}>
                <Text className="block text-center text-base font-semibold text-primary">
                  {profile.deal_success_count ?? profile.match_count ?? 0}
                </Text>
                <Text className="mt-1 block text-center text-xs text-muted-foreground">成功对接</Text>
              </View>
            </View>
          </SoftCard>
        ) : (
          <SoftCard className="overflow-hidden px-5 py-5">
            <View className="flex flex-col items-center">
              <View className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-surface">
                <User size={icon.xl} color={brandColors.blue} strokeWidth={icon.stroke} />
              </View>
              <Text className="block text-lg font-semibold text-foreground">欢迎来到星河俱乐部</Text>
              <Text className="mt-1 block text-center text-xs text-muted-foreground">
                登录后同步会员资料、积分与权益
              </Text>
              <Button variant="gold" size="lg" className="mt-4 w-full max-w-xs" onClick={() => void openProfileEdit()}>
                <Text className="block text-sm font-medium text-white">立即登录</Text>
              </Button>
            </View>
          </SoftCard>
        )}
      </View>

      {menuSections.map((section, sIdx) => (
        <View key={sIdx} className="mt-4 px-4">
          <SectionTitle title={section.title} />
          <SoftCard className="overflow-hidden">
            {section.items.map((item, iIdx) => (
              <View key={item.label}>
                <MenuListItem
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                  iconColor={item.iconColor}
                  danger={"danger" in item && item.danger}
                  onClick={() => void handleMenuAction(item.action)}
                />
                {iIdx < section.items.length - 1 ? (
                  <View className="ml-14 mr-4 h-px bg-border bg-opacity-70" />
                ) : null}
              </View>
            ))}
          </SoftCard>
        </View>
      ))}

      <View className={layout.bottomBarPad} />
    </PageShell>
  )
}

export default ProfilePage
