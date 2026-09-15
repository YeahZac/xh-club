import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { usePageShare } from '@/lib/mini-program-share'
import { Copy, Download, Share2, Users } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WxShareButton } from '@/components/wx-share-button'
import { RichHtml } from '@/components/rich-html'
import {
  EmptyState,
  HeroHeader,
  PageShell,
  SectionTitle,
  SoftCard,
  brandColors,
  icon,
  ui,
} from '@/components/brand-ui'
import { Network } from '@/network'
import { ensureLogin, isLoggedIn, validateMemberSession } from '@/lib/auth'
import { makeInviteQrTempFile } from '@/lib/invite-qr'
import { cn } from '@/lib/utils'

interface InviteeItem {
  id: string | number
  name: string
  phone?: string
  created_at?: string
}

interface InviteDashboard {
  invite_code: string
  invite_count: number
  invitees: InviteeItem[]
  total_reward_points?: number
}

interface InviteCondition {
  code: string
  label: string
}

interface InviteRulesSummary {
  points_value: number
  growth_value: number
  experience_value?: number
  earnings_value: number
  contribution_value: number
  conditions: InviteCondition[]
  content: string
  rules?: Array<{ id?: string | number }>
}

const formatTime = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const InvitePage = () => {
  const [loading, setLoading] = useState(true)
  const [needLogin, setNeedLogin] = useState(false)
  const [dashboard, setDashboard] = useState<InviteDashboard | null>(null)
  const [rules, setRules] = useState<InviteRulesSummary | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState('')

  useDidShow(() => {
    // 普通会员 / 推广员 / 会员单位均可推荐他人注册
    void loadData()
  })

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '会员推荐' })
  }, [])

  usePageShare({
    title: '邀请你加入星河俱乐部',
    path: () => {
      const code = dashboard?.invite_code || ''
      return code
        ? `/pages/login/index?from=invite&code=${encodeURIComponent(code)}`
        : '/pages/login/index?from=invite'
    },
    query: () => {
      const code = dashboard?.invite_code || ''
      return code ? `from=invite&code=${encodeURIComponent(code)}` : 'from=invite'
    },
  })

  const loadData = async () => {
    let loggedIn = isLoggedIn()
    if (loggedIn) {
      const valid = await validateMemberSession()
      if (!valid) {
        loggedIn = false
      }
    }
    setNeedLogin(!loggedIn)
    const memberId = Taro.getStorageSync('member_id')

    try {
      setLoading(true)
      const rulesPromise = Network.request({ url: '/api/invitation/rules' }).catch(() => null)
      const invitePromise = loggedIn
        ? Network.request({ url: `/api/members/${memberId}/invite` }).catch(() => null)
        : Promise.resolve(null)

      const [inviteRes, rulesRes] = await Promise.all([invitePromise, rulesPromise])

      if (inviteRes?.data?.code === 200 && inviteRes.data.data) {
        const next = inviteRes.data.data as InviteDashboard
        setDashboard(next)
        void loadInviteQr(String(memberId || ''), next.invite_code)
      } else if (loggedIn) {
        Taro.showToast({
          title: inviteRes?.data?.msg || '推荐信息加载失败',
          icon: 'none',
        })
      }

      if (rulesRes?.data?.code === 200 && rulesRes.data.data) {
        setRules(rulesRes.data.data)
      }
    } catch (error) {
      console.error('[会员推荐] 加载失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const loadInviteQr = async (memberId: string, inviteCode?: string) => {
    setQrLoading(true)
    setQrError('')
    try {
      const res = await Network.request({
        url: `/api/members/${memberId}/invite-qrcode`,
        header: { 'X-Silent-Error': '1' },
      })
      const url = res?.data?.data?.data_url
      if (url) {
        setQrDataUrl(String(url))
        return
      }
      setQrError('二维码生成失败')
    } catch (error) {
      console.warn('[会员推荐] 服务端小程序码失败，尝试本地生成:', error)
      if (inviteCode) {
        try {
          const localPath = await makeInviteQrTempFile(inviteCode)
          setQrDataUrl(localPath)
          setQrError('当前为备用码，请更新后端后重新生成')
          return
        } catch (localError) {
          console.warn('[会员推荐] 本地二维码生成失败:', localError)
        }
      }
      setQrError('二维码加载失败')
    } finally {
      setQrLoading(false)
    }
  }

  const copyInviteCode = async () => {
    const code = dashboard?.invite_code
    if (!code) {
      if (needLogin) {
        if (await ensureLogin()) await loadData()
        return
      }
      Taro.showToast({ title: '暂无推荐码', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: String(code),
      success: () => Taro.showToast({ title: '推荐码已复制', icon: 'success' }),
    })
  }

  const goLogin = async () => {
    if (await ensureLogin()) await loadData()
  }

  const shareInvite = async () => {
    const code = dashboard?.invite_code
    if (!code) {
      if (needLogin) {
        await goLogin()
        return
      }
      Taro.showToast({ title: '暂无推荐码', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: String(code),
      success: () => Taro.showToast({ title: '推荐码已复制，请选择好友分享', icon: 'success' }),
    })
  }

  const saveInviteQr = async () => {
    if (!qrDataUrl) {
      Taro.showToast({ title: '二维码加载中', icon: 'none' })
      return
    }
    try {
      const filePath = qrDataUrl.startsWith('data:')
        ? (await Taro.getImageInfo({ src: qrDataUrl })).path
        : qrDataUrl
      await Taro.saveImageToPhotosAlbum({ filePath })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      const msg = String((error as any)?.errMsg || (error as Error)?.message || '')
      if (msg.includes('auth deny') || msg.includes('authorize')) {
        Taro.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存到相册后重试',
          showCancel: false,
        })
        return
      }
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <PageShell scroll={false}>
        <View className="flex min-h-screen items-center justify-center">
          <Text className={ui.caption}>加载中...</Text>
        </View>
      </PageShell>
    )
  }

  const invitees = dashboard?.invitees || []
  const inviteCount = Number(dashboard?.invite_count || invitees.length || 0)
  const totalRewardPoints = Number(dashboard?.total_reward_points || 0)
  const conditions = Array.isArray(rules?.conditions) ? rules!.conditions : []

  return (
    <PageShell>
      <HeroHeader
        eyebrow="会员推荐"
        title="我的推荐码"
        subtitle="分享邀请链接，好友注册后可获得奖励"
        withStatusBar={false}
      >
        {/* 不用 SoftCard：其默认白底会把白字标签「吃掉」，只剩数字 */}
        <View
          className="rounded-2xl px-4 py-4"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
        >
          <View className="flex flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="mb-1 block text-xs text-white text-opacity-70">唯一 ID（可复制）</Text>
              <Text className="block text-xl font-bold tracking-wide text-gold-light">
                {dashboard?.invite_code || (needLogin ? '登录后查看' : '-')}
              </Text>
            </View>
            <Button
              size="sm"
              variant="gold"
              className="h-9 flex-shrink-0 rounded-xl px-4"
              onClick={needLogin ? goLogin : copyInviteCode}
            >
              <View className="flex flex-row items-center gap-1">
                <Copy size={ui.iconMeta + 1} color={icon.color.inverse} strokeWidth={ui.iconStroke} />
                <Text className="block text-xs text-white">{needLogin ? '去登录' : '复制'}</Text>
              </View>
            </Button>
          </View>

          <View className="mt-4 flex flex-row gap-3">
            <View
              className="min-w-0 flex-1 rounded-xl px-3 py-3"
              style={{ backgroundColor: 'rgba(15, 28, 56, 0.35)' }}
            >
              <Text className="block text-xs text-white text-opacity-75">已邀请人员</Text>
              <View className="mt-1 flex flex-row items-end gap-1">
                <Text className="block text-2xl font-bold leading-none text-gold-light">
                  {inviteCount}
                </Text>
                <Text className="mb-0.5 block text-xs text-white text-opacity-70">人</Text>
              </View>
              <Text className="mt-2 block text-xs leading-relaxed text-white text-opacity-55">
                已成功注册的好友数
              </Text>
            </View>
            <View
              className="min-w-0 flex-1 rounded-xl px-3 py-3"
              style={{ backgroundColor: 'rgba(15, 28, 56, 0.35)' }}
            >
              <Text className="block text-xs text-white text-opacity-75">累计获得积分</Text>
              <View className="mt-1 flex flex-row items-end gap-1">
                <Text className="block text-2xl font-bold leading-none text-gold-light">
                  {totalRewardPoints}
                </Text>
                <Text className="mb-0.5 block text-xs text-white text-opacity-70">分</Text>
              </View>
              <Text className="mt-2 block text-xs leading-relaxed text-white text-opacity-55">
                邀请奖励累计积分
              </Text>
            </View>
          </View>

          <View className="mt-3 flex flex-row items-center gap-2">
            <Users size={ui.iconMeta + 2} color={brandColors.goldLight} strokeWidth={ui.iconStroke} />
            <Text className="block text-xs text-white text-opacity-80">
              下方列表仅展示已注册推荐人员
            </Text>
          </View>
        </View>

        <View className="mt-4">
          {needLogin ? (
            <Button variant="gold" size="lg" className="w-full" onClick={goLogin}>
              <Text className="block text-sm font-semibold text-white">登录后邀请新会员</Text>
            </Button>
          ) : (
            <WxShareButton
              className="m-0 flex h-11 w-full flex-row items-center justify-center rounded-2xl border-0 bg-accent-foreground px-0 after:border-0"
              onClick={() => void shareInvite()}
            >
              <View className="flex flex-row items-center gap-2">
                <Share2 size={ui.iconInline} color={icon.color.inverse} strokeWidth={ui.iconStroke} />
                <Text className="block text-sm font-semibold text-white">邀请新会员</Text>
              </View>
            </WxShareButton>
          )}
        </View>
      </HeroHeader>

      {!needLogin && dashboard?.invite_code ? (
        <View className={`${ui.pagePad} pb-2 pt-2`}>
          <SoftCard>
            <View className={`${ui.cardPad} flex flex-col items-center`}>
              <Text className={cn(ui.label, 'mb-3 self-start')}>邀请二维码（可长按或保存）</Text>
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  mode="aspectFit"
                  className="h-44 w-44 rounded-xl bg-white"
                  showMenuByLongpress
                />
              ) : (
                <View className="flex h-44 w-44 items-center justify-center rounded-xl bg-muted">
                  <Text className={ui.caption}>
                    {qrLoading ? '二维码生成中…' : qrError || '暂无二维码'}
                  </Text>
                </View>
              )}
              <Text className={cn(ui.caption, 'mt-2 text-center')}>
                好友使用微信扫一扫，将自动打开小程序并填入邀请码
              </Text>
              <View className="mt-3 flex flex-row gap-2">
                {qrError && !qrDataUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl px-4"
                    onClick={() =>
                      void loadInviteQr(String(Taro.getStorageSync('member_id') || ''), dashboard.invite_code)
                    }
                  >
                    <Text className="block text-xs text-foreground">重新生成</Text>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl px-4"
                  disabled={!qrDataUrl}
                  onClick={() => void saveInviteQr()}
                >
                  <View className="flex flex-row items-center gap-1">
                    <Download size={ui.iconMeta + 1} color={icon.color.brand} strokeWidth={ui.iconStroke} />
                    <Text className="block text-xs text-foreground">保存二维码</Text>
                  </View>
                </Button>
              </View>
            </View>
          </SoftCard>
        </View>
      ) : null}

      <View className={`${ui.pagePad} flex flex-col ${ui.listGap} pb-8 pt-2`}>
        {needLogin ? (
          <EmptyState
            title="登录后查看推荐数据"
            description="推荐码、已注册推荐人员与奖励规则登录后可见"
            icon={Users}
          />
        ) : null}

        <SectionTitle
          title="已注册推荐人员"
          extra={<Badge className="bg-accent px-2 py-0 text-xs text-accent-foreground">{inviteCount} 人</Badge>}
        />
        <SoftCard>
          <View className={ui.cardPad}>
            {invitees.length === 0 ? (
              <Text className={cn(ui.caption, 'py-6 text-center')}>暂无已注册推荐人员</Text>
            ) : (
              <View className="flex flex-col gap-3">
                {invitees.map((item) => (
                  <View
                    key={String(item.id)}
                    className="flex flex-row items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0"
                  >
                    <Text className={ui.cardTitle}>{item.name || '未命名'}</Text>
                    <Text className={ui.caption}>{formatTime(item.created_at)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </SoftCard>

        <SectionTitle title="奖励说明" />
        <SoftCard>
          <View className={ui.cardPad}>
            {rules?.content ? (
              <RichHtml
                html={rules.content}
                className="text-sm"
                emptyText="暂无规则说明"
                fullPage={
                  Array.isArray(rules.rules) && rules.rules.length === 1 && rules.rules[0]?.id != null
                    ? { type: 'invitation', id: rules.rules[0].id }
                    : undefined
                }
              />
            ) : (
              <Text className={ui.caption}>暂无规则说明，请在后台「邀请奖励」中配置</Text>
            )}
            {conditions.length > 0 ? (
              <View className="mt-3 border-t border-border pt-3">
                <Text className={cn(ui.label, 'mb-2')}>触发条件</Text>
                {conditions.map((item) => (
                  <Text key={`${item.code}-${item.label}`} className={cn(ui.caption, 'mb-1')}>
                    · {item.label}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </SoftCard>
      </View>
    </PageShell>
  )
}

export default InvitePage
