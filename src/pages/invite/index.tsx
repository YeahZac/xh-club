import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Copy, Users } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RichHtml } from '@/components/rich-html'
import { Network } from '@/network'

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

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '会员推荐' })
  }, [])

  const loadData = async () => {
    const memberId = Taro.getStorageSync('member_id')
    const token = Taro.getStorageSync('member_token')
    const loggedIn = !!(memberId && token)
    setNeedLogin(!loggedIn)

    try {
      setLoading(true)
      const rulesPromise = Network.request({ url: '/api/invitation/rules' }).catch((error) => {
        console.error('[会员推荐] 规则加载失败:', error)
        return null
      })

      const invitePromise = loggedIn
        ? Network.request({ url: `/api/members/${memberId}/invite` }).catch((error) => {
            console.error('[会员推荐] 推荐数据加载失败:', error)
            return null
          })
        : Promise.resolve(null)

      const [inviteRes, rulesRes] = await Promise.all([invitePromise, rulesPromise])
      console.log('[会员推荐] invite:', inviteRes?.data)
      console.log('[会员推荐] rules:', rulesRes?.data)

      if (inviteRes?.data?.code === 200 && inviteRes.data.data) {
        setDashboard(inviteRes.data.data)
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

  const copyInviteCode = () => {
    const code = dashboard?.invite_code
    if (!code) {
      Taro.showToast({ title: needLogin ? '请先登录' : '暂无推荐码', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: String(code),
      success: () => Taro.showToast({ title: '唯一ID已复制', icon: 'success' }),
    })
  }

  const goLogin = () => {
    Taro.switchTab({ url: '/pages/profile/index' })
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-full bg-[#F5F6FA]">
        <Text className="block text-xs text-gray-400">加载中...</Text>
      </View>
    )
  }

  const invitees = dashboard?.invitees || []
  const growth = Number(rules?.growth_value || rules?.experience_value || 0)
  const hasRewards = !!(
    Number(rules?.points_value || 0)
    || growth
    || Number(rules?.earnings_value || 0)
    || Number(rules?.contribution_value || 0)
  )
  const conditions = Array.isArray(rules?.conditions) ? rules!.conditions : []

  return (
    <ScrollView scrollY className="h-full bg-[#F5F6FA]">
      <View className="bg-gradient-to-br from-[#1B2A4A] to-[#2D4A7A] px-3.5 pt-4 pb-5">
        <Text className="block text-white text-sm font-semibold mb-3">我的推荐码</Text>
        <View className="flex flex-row items-center justify-between bg-white/10 rounded-xl px-3 py-2.5">
          <View className="flex-1 min-w-0">
            <Text className="block text-xs text-white/70 mb-0.5">唯一 ID（可复制）</Text>
            <Text className="block text-xl font-bold text-[#E8D5A8] tracking-wide">
              {dashboard?.invite_code || (needLogin ? '登录后查看' : '-')}
            </Text>
          </View>
          <Button
            size="sm"
            className="bg-[#C9A96E] text-white text-xs h-7 px-3 rounded-md flex-shrink-0"
            onClick={needLogin ? goLogin : copyInviteCode}
          >
            <View className="flex flex-row items-center gap-1">
              <Copy size={12} color="#ffffff" />
              <Text className="block text-xs text-white">{needLogin ? '去登录' : '复制'}</Text>
            </View>
          </Button>
        </View>
        <View className="flex flex-row items-center gap-1.5 mt-3">
          <Users size={14} color="#E8D5A8" />
          <Text className="block text-xs text-white/90">
            已推荐 {dashboard?.invite_count || 0} 人
          </Text>
        </View>
        {hasRewards ? (
          <View className="mt-2 flex flex-row flex-wrap gap-1.5">
            {Number(rules?.points_value || 0) > 0 ? (
              <Badge className="bg-white/15 text-[#E8D5A8] text-xs px-1.5 py-0">
                积分 {rules?.points_value}
              </Badge>
            ) : null}
            {growth > 0 ? (
              <Badge className="bg-white/15 text-[#E8D5A8] text-xs px-1.5 py-0">
                成长值 {growth}
              </Badge>
            ) : null}
            {Number(rules?.earnings_value || 0) > 0 ? (
              <Badge className="bg-white/15 text-[#E8D5A8] text-xs px-1.5 py-0">
                收益 ¥{rules?.earnings_value}
              </Badge>
            ) : null}
            {Number(rules?.contribution_value || 0) > 0 ? (
              <Badge className="bg-white/15 text-[#E8D5A8] text-xs px-1.5 py-0">
                贡献值 {rules?.contribution_value}
              </Badge>
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="px-3.5 -mt-2 pb-6">
        {needLogin ? (
          <Card className="shadow-sm border-0 mb-3">
            <CardContent className="p-4">
              <Text className="block text-xs text-gray-500 mb-3">登录后可查看你的唯一推荐码与推荐人员明细</Text>
              <Button className="w-full bg-[#1B2A4A] text-white text-xs h-9" onClick={goLogin}>
                <Text className="block text-xs text-white">去登录</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="shadow-sm border-0 mb-3">
          <CardContent className="p-3">
            <View className="flex flex-row items-center justify-between mb-2">
              <Text className="block text-sm font-semibold text-[#1A1D2E]">推荐人员</Text>
              <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">
                {dashboard?.invite_count || 0}人
              </Badge>
            </View>

            <View className="flex flex-row bg-gray-50 rounded-t-lg px-2 py-2">
              <Text className="block text-xs text-gray-500 flex-1">姓名</Text>
              <Text className="block text-xs text-gray-500 w-28 text-right">推荐时间</Text>
            </View>

            {invitees.length === 0 ? (
              <View className="py-8 flex items-center justify-center border border-t-0 border-gray-100 rounded-b-lg">
                <Text className="block text-xs text-gray-400">暂无推荐人员，分享推荐码邀请好友加入</Text>
              </View>
            ) : (
              <View className="border border-t-0 border-gray-100 rounded-b-lg overflow-hidden">
                {invitees.map((item) => (
                  <View
                    key={String(item.id)}
                    className="flex flex-row items-center px-2 py-2.5 border-t border-gray-50"
                  >
                    <Text className="block text-xs text-[#1A1D2E] flex-1 truncate">{item.name || '未命名'}</Text>
                    <Text className="block text-xs text-gray-500 w-28 text-right">{formatTime(item.created_at)}</Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 mb-3">
          <CardContent className="p-3">
            <Text className="block text-sm font-semibold text-[#1A1D2E] mb-2">奖励说明</Text>
            {hasRewards ? (
              <View className="flex flex-row flex-wrap gap-1.5 mb-2">
                {Number(rules?.points_value || 0) > 0 ? (
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">积分 {rules?.points_value}</Badge>
                ) : null}
                {growth > 0 ? (
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">成长值 {growth}</Badge>
                ) : null}
                {Number(rules?.earnings_value || 0) > 0 ? (
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">收益 ¥{rules?.earnings_value}</Badge>
                ) : null}
                {Number(rules?.contribution_value || 0) > 0 ? (
                  <Badge className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-1.5 py-0">贡献值 {rules?.contribution_value}</Badge>
                ) : null}
              </View>
            ) : (
              <Text className="block text-xs text-gray-400 mb-2">暂未配置奖励数值</Text>
            )}

            {conditions.length > 0 ? (
              <View className="mb-2">
                <Text className="block text-xs text-gray-500 mb-1">触发条件</Text>
                <View className="flex flex-col gap-1">
                  {conditions.map((item) => (
                    <Text key={`${item.code}-${item.label}`} className="block text-xs text-[#1A1D2E]">
                      · {item.label}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {rules?.content ? (
              <RichHtml html={rules.content} className="text-xs" emptyText="暂无规则说明" />
            ) : (
              <Text className="block text-xs text-gray-400">
                暂无规则说明，请在后台「系统管理 - 邀请奖励」配置
              </Text>
            )}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  )
}

export default InvitePage
