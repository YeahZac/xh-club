import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image, Picker, Textarea } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { getResponseList } from '@/lib/api-response'

const CATEGORIES = [
  { value: 'financing', label: '融资招募' },
  { value: 'resource', label: '资源对接' },
]

interface TalentOption {
  id: string | number
  real_name?: string
  name?: string
}

const PublishPostPage = () => {
  const [editId, setEditId] = useState('')
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [talents, setTalents] = useState<TalentOption[]>([])
  const [talentIndex, setTalentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useLoad((query) => {
    Taro.setNavigationBarTitle({ title: query?.id ? '编辑动态' : '发布动态' })
    if (query?.id) {
      setEditId(String(query.id))
      loadDetail(String(query.id))
    }
  })

  useEffect(() => {
    loadTalents()
  }, [])

  const loadTalents = async () => {
    try {
      const res = await Network.request({ url: '/api/talents?pageSize=200' })
      const payload = res?.data?.data
      const list = Array.isArray(payload?.list)
        ? payload.list
        : getResponseList<TalentOption>(payload)
      setTalents([{ id: '', real_name: '不选择' }, ...list])
    } catch (error) {
      console.error('[发布动态] 人才列表失败', error)
      setTalents([{ id: '', real_name: '不选择' }])
    }
  }

  const loadDetail = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/business/${id}` })
      const data = res?.data?.data
      if (!data) return
      setTitle(data.title || '')
      setSummary(data.summary || '')
      setContent(data.content || '')
      setCoverImage(data.cover_image || '')
      setContactPhone(data.contact_phone || '')
      const catIdx = CATEGORIES.findIndex((c) => c.value === data.category)
      setCategoryIndex(catIdx >= 0 ? catIdx : 0)
      // talent index set after talents load
      setTimeout(() => {
        setTalents((prev) => {
          const idx = prev.findIndex((t) => String(t.id) === String(data.demand_talent_id || ''))
          setTalentIndex(idx >= 0 ? idx : 0)
          return prev
        })
      }, 300)
    } catch (error) {
      console.error('[发布动态] 加载详情失败', error)
    }
  }

  const uploadCover = async () => {
    try {
      const choose = await Taro.chooseImage({ count: 1, size: ['compressed'] })
      const filePath = choose.tempFilePaths?.[0]
      if (!filePath) return
      Taro.showLoading({ title: '上传中...' })
      const uploadRes = await Network.uploadFile({
        url: '/api/upload/member/image',
        filePath,
        name: 'file',
      })
      const parsed = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      if (parsed?.code === 200 && parsed?.data?.url) {
        setCoverImage(parsed.data.url)
        Taro.showToast({ title: '上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: parsed?.msg || '上传失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[发布动态] 上传失败', error)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const submit = async () => {
    if (!title.trim()) return Taro.showToast({ title: '请填写标题', icon: 'none' })
    if (!coverImage) return Taro.showToast({ title: '请上传封面', icon: 'none' })
    const memberId = Taro.getStorageSync('member_id')
    const token = Taro.getStorageSync('member_token')
    if (!memberId || !token) return Taro.showToast({ title: '请先登录', icon: 'none' })

    const category = CATEGORIES[categoryIndex]?.value || 'financing'
    const demandTalent = talents[talentIndex]
    const body = {
      title: title.trim(),
      category,
      cover_image: coverImage,
      summary: summary.trim(),
      content: content.trim(),
      contact_phone: contactPhone.trim() || null,
      demand_talent_id: demandTalent?.id || null,
    }

    setSubmitting(true)
    try {
      const res = await Network.request({
        url: editId ? `/api/business/my/${editId}` : '/api/business/submit',
        method: editId ? 'PUT' : 'POST',
        data: body,
      })
      console.log('[发布动态] 提交结果', res?.data)
      if (res?.data?.code === 200) {
        Taro.showToast({ title: editId ? '已提交重新审核' : '提交成功，等待审核', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/my-posts/index' })
        }, 800)
      } else {
        Taro.showToast({ title: res?.data?.msg || '提交失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[发布动态] 提交失败', error)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView scrollY className="h-screen bg-[#F5F6FA]">
      <View className="px-3.5 py-3 pb-28">
        <Card className="mb-3">
          <CardContent className="p-4 space-y-3">
            <Text className="block text-sm font-semibold text-gray-900">基本信息</Text>
            <View>
              <Text className="block text-xs text-gray-500 mb-1">分类 *</Text>
              <Picker
                mode="selector"
                range={CATEGORIES.map((c) => c.label)}
                value={categoryIndex}
                onChange={(e) => setCategoryIndex(Number(e.detail.value))}
              >
                <View className="bg-gray-50 rounded-xl px-3 py-3">
                  <Text className="text-sm text-gray-800">{CATEGORIES[categoryIndex]?.label}</Text>
                </View>
              </Picker>
            </View>
            <View>
              <Text className="block text-xs text-gray-500 mb-1">标题 *</Text>
              <View className="bg-gray-50 rounded-xl px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  placeholder="请输入标题"
                  value={title}
                  onInput={(e) => setTitle(e.detail.value)}
                />
              </View>
            </View>
            <View>
              <Text className="block text-xs text-gray-500 mb-1">封面 *</Text>
              {coverImage ? (
                <Image src={coverImage} className="w-full aspect-video rounded-xl mb-2" mode="aspectFill" />
              ) : null}
              <Button variant="outline" onClick={uploadCover}>
                {coverImage ? '更换封面' : '上传封面'}
              </Button>
            </View>
            <View>
              <Text className="block text-xs text-gray-500 mb-1">电话号码（选填）</Text>
              <View className="bg-gray-50 rounded-xl px-3 py-2">
                <Input
                  className="w-full bg-transparent"
                  type="number"
                  placeholder="联系电话"
                  value={contactPhone}
                  onInput={(e) => setContactPhone(e.detail.value)}
                />
              </View>
            </View>
            <View>
              <Text className="block text-xs text-gray-500 mb-1">需求方（选填）</Text>
              <Picker
                mode="selector"
                range={talents.map((t) => t.real_name || t.name || `人才#${t.id}`)}
                value={talentIndex}
                onChange={(e) => setTalentIndex(Number(e.detail.value))}
              >
                <View className="bg-gray-50 rounded-xl px-3 py-3">
                  <Text className="text-sm text-gray-800">
                    {talents[talentIndex]?.real_name || talents[talentIndex]?.name || '不选择'}
                  </Text>
                </View>
              </Picker>
            </View>
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardContent className="p-4 space-y-3">
            <Text className="block text-sm font-semibold text-gray-900">内容</Text>
            <View>
              <Text className="block text-xs text-gray-500 mb-1">摘要</Text>
              <View className="bg-gray-50 rounded-xl p-3">
                <Textarea
                  className="w-full bg-transparent text-sm"
                  style={{ minHeight: '60px', width: '100%' }}
                  placeholder="一句话简介"
                  value={summary}
                  onInput={(e) => setSummary(e.detail.value)}
                  maxlength={200}
                />
              </View>
            </View>
            <View>
              <Text className="block text-xs text-gray-500 mb-1">详细内容</Text>
              <View className="bg-gray-50 rounded-xl p-3">
                <Textarea
                  className="w-full bg-transparent text-sm"
                  style={{ minHeight: '140px', width: '100%' }}
                  placeholder="请输入详细内容"
                  value={content}
                  onInput={(e) => setContent(e.detail.value)}
                  maxlength={5000}
                />
              </View>
            </View>
            <Text className="block text-xs text-amber-600">提交后需管理员审核通过才会在商机列表展示</Text>
          </CardContent>
        </Card>
      </View>

      <View
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e5e5',
          zIndex: 100,
        }}
      >
        <Button className="w-full bg-[#1B2A4A]" disabled={submitting} onClick={submit}>
          {submitting ? '提交中...' : editId ? '保存并重新审核' : '提交审核'}
        </Button>
      </View>
    </ScrollView>
  )
}

export default PublishPostPage
