import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { FileText } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  HeroHeader,
  icon,
  ListThumb,
  PageShell,
  SoftCard,
  ui,
} from '@/components/brand-ui'
import { getResponseList } from '@/lib/api-response'
import { ensureLogin } from '@/lib/auth'
import { ensurePromoterOrMemberUnit } from '@/lib/member-access'
import { isDisplayableImageUrl } from '@/lib/media-url'
import { Network } from '@/network'
import { cn } from '@/lib/utils'
import { usePageShare } from '@/lib/mini-program-share'

interface MyPost {
  id: string | number
  title: string
  category: string
  cover_image?: string
  audit_status: string
  audit_status_label?: string
  source_label?: string
  reject_reason?: string
  created_at?: string
}

const CATEGORY_MAP: Record<string, string> = {
  financing: '商业需求',
  resource: '资源需求',
  life: '生活需求',
  roadshow: '项目路演',
}

const AUDIT_CLASS: Record<string, string> = {
  pending: 'bg-accent text-warning',
  approved: 'bg-mint-tint text-success',
  rejected: 'bg-destructive bg-opacity-10 text-destructive',
}

const MyPostsPage = () => {
  usePageShare()

  const [list, setList] = useState<MyPost[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '我的商机' })
    loadList()
  })

  const loadList = async () => {
    if (!(await ensureLogin(''))) {
      setList([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/business/my' })
      console.log('[我的商机]', res?.data)
      setList(getResponseList<MyPost>(res?.data?.data))
    } catch (error) {
      console.error('[我的商机] 加载失败', error)
      setList([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string | number) => {
    if (!(await ensureLogin(''))) return
    const { confirm } = await Taro.showModal({
      title: '删除动态',
      content: '确定删除这条动态吗？',
    })
    if (!confirm) return
    try {
      const res = await Network.request({
        url: `/api/business/my/${id}`,
        method: 'DELETE',
      })
      if (res?.data?.code === 200) {
        Taro.showToast({ title: '已删除', icon: 'success' })
        loadList()
      } else {
        Taro.showToast({ title: res?.data?.msg || '删除失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[我的商机] 删除失败', error)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const goPublishPost = async (editId?: string | number) => {
    if (!(await ensurePromoterOrMemberUnit('发布商机'))) return
    const url = editId
      ? `/pages/publish-post/index?id=${editId}`
      : '/pages/publish-post/index'
    Taro.navigateTo({ url })
  }

  const publishAction = (
    <Button
      size="sm"
      variant="gold"
      className="h-8 rounded-xl px-3"
      onClick={() => void goPublishPost()}
    >
      <Text className="block text-xs font-medium text-white">发布商机</Text>
    </Button>
  )

  return (
    <PageShell>
      <HeroHeader
        title="我的商机"
        subtitle="查看审核状态与管理发布的商机"
        action={publishAction}
        compact
      />

      <View className={`${ui.pagePad} flex flex-col ${ui.listGap} pb-10 pt-2`}>
        {loading ? (
          <Text className={cn(ui.caption, 'py-16 text-center')}>加载中...</Text>
        ) : !list.length ? (
          <EmptyState title="暂无商机" description="点击右上角发布你的第一条商机" icon={FileText} />
        ) : (
          list.map((item) => (
            <SoftCard key={item.id} className={ui.cardPad}>
              <View className="flex flex-row gap-3">
                <ListThumb>
                  {isDisplayableImageUrl(item.cover_image || '') ? (
                    <Image
                      src={item.cover_image!}
                      className="h-full w-full"
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="flex h-full w-full items-center justify-center bg-muted">
                      <FileText size={ui.iconEmpty} color={icon.color.default} strokeWidth={ui.iconStroke} />
                    </View>
                  )}
                </ListThumb>
                <View className="min-w-0 flex-1">
                  <View className="flex flex-row items-start justify-between gap-2">
                    <Text className={cn(ui.cardTitle, 'line-clamp-2 flex-1')}>{item.title}</Text>
                    <Badge
                      className={cn(
                        'shrink-0 px-2 py-0 text-xs',
                        AUDIT_CLASS[item.audit_status] || 'bg-muted text-muted-foreground',
                      )}
                    >
                      {item.audit_status_label || item.audit_status}
                    </Badge>
                  </View>
                  <Text className={cn(ui.caption, 'mt-1')}>
                    {CATEGORY_MAP[item.category] || item.category}
                  </Text>
                  {item.audit_status === 'rejected' && item.reject_reason ? (
                    <Text className="mt-1 block text-xs text-destructive">
                      原因：{item.reject_reason}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View className="mt-3 flex flex-row justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void goPublishPost(item.id)
                  }
                >
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  删除
                </Button>
              </View>
            </SoftCard>
          ))
        )}
      </View>
    </PageShell>
  )
}

export default MyPostsPage
