import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { FileText } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'

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
  financing: '融资招募',
  resource: '资源对接',
  roadshow: '项目路演',
}

const AUDIT_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const MyPostsPage = () => {
  const [list, setList] = useState<MyPost[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '我的动态' })
    loadList()
  })

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/business/my' })
      console.log('[我的动态]', res?.data)
      const data = res?.data?.data
      setList(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('[我的动态] 加载失败', error)
      setList([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string | number) => {
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
      console.error('[我的动态] 删除失败', error)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  return (
    <View className="min-h-screen bg-[#F5F6FA]">
      <View className="px-3.5 pt-3 flex justify-end">
        <Button
          size="sm"
          className="bg-[#1B2A4A]"
          onClick={() => Taro.navigateTo({ url: '/pages/publish-post/index' })}
        >
          发布动态
        </Button>
      </View>
      <ScrollView scrollY className="h-screen">
        <View className="px-3.5 py-3 pb-10">
          {loading ? (
            <Text className="block text-center text-gray-400 text-sm py-12">加载中...</Text>
          ) : !list.length ? (
            <View className="flex flex-col items-center py-16">
              <FileText size={40} color="#d1d5db" />
              <Text className="block text-gray-400 text-sm mt-3">暂无发布内容</Text>
            </View>
          ) : (
            list.map((item) => (
              <Card key={item.id} className="mb-2">
                <CardContent className="p-3">
                  <View className="flex gap-3">
                    {item.cover_image ? (
                      <Image
                        src={item.cover_image}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                        mode="aspectFill"
                      />
                    ) : (
                      <View className="w-16 h-16 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <View className="flex-1 min-w-0">
                      <View className="flex items-start justify-between gap-2">
                        <Text className="block text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                          {item.title}
                        </Text>
                        <Badge className={`text-xs shrink-0 ${AUDIT_CLASS[item.audit_status] || 'bg-gray-100 text-gray-600'}`}>
                          {item.audit_status_label || item.audit_status}
                        </Badge>
                      </View>
                      <Text className="block text-xs text-gray-500 mt-1">
                        {CATEGORY_MAP[item.category] || item.category}
                      </Text>
                      {item.audit_status === 'rejected' && item.reject_reason && (
                        <Text className="block text-xs text-red-500 mt-1">原因：{item.reject_reason}</Text>
                      )}
                    </View>
                  </View>
                  <View className="flex justify-end gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        Taro.navigateTo({ url: `/pages/publish-post/index?id=${item.id}` })
                      }
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => handleDelete(item.id)}
                    >
                      删除
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default MyPostsPage
