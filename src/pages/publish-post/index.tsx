import { useState } from 'react'
import { View, Text, ScrollView, Image, Picker, Textarea } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { X } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { stripHtml } from '@/lib/rich-html'

const CATEGORIES = [
  { value: 'financing', label: '融资招募' },
  { value: 'resource', label: '资源对接' },
]

const MAX_CONTENT_IMAGES = 9

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const parseStoredContent = (raw?: string | null) => {
  const html = String(raw || '')
  const images: string[] = []
  const withoutImgs = html.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (_match, src: string) => {
    if (src) images.push(src)
    return ''
  })
  return {
    text: stripHtml(withoutImgs),
    images,
  }
}

const buildContentHtml = (text: string, images: string[]) => {
  const paragraphs = text
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
  const imageHtml = images
    .filter(Boolean)
    .map((url) => `<p><img src="${escapeHtml(url)}" /></p>`)
    .join('')
  return `${paragraphs}${imageHtml}`
}

const PublishPostPage = () => {
  const [editId, setEditId] = useState('')
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [contentImages, setContentImages] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [demandName, setDemandName] = useState('加载中...')
  const [submitting, setSubmitting] = useState(false)

  useLoad((query) => {
    Taro.setNavigationBarTitle({ title: query?.id ? '编辑动态' : '发布动态' })
    const isEdit = Boolean(query?.id)
    if (isEdit) {
      setEditId(String(query.id))
      void loadDetail(String(query.id))
    }
    void loadDemandParty(!isEdit)
  })

  const loadDemandParty = async (fillPhone = false) => {
    const memberId = Taro.getStorageSync('member_id')
    const token = Taro.getStorageSync('member_token')
    if (!memberId || !token) {
      setDemandName('请先登录')
      return
    }

    try {
      const [profileRes, talentRes] = await Promise.all([
        Network.request({ url: `/api/members/profile/${memberId}` }),
        Network.request({ url: '/api/talents/mine' }).catch(() => null),
      ])
      const profile = profileRes?.data?.data
      const talent = talentRes?.data?.data
      const name =
        talent?.real_name ||
        profile?.name ||
        profile?.phone ||
        `会员#${memberId}`
      setDemandName(name)
      if (fillPhone) {
        const phone = String(talent?.contact || profile?.phone || '').trim()
        if (phone) setContactPhone(phone)
      }
    } catch (error) {
      console.error('[发布动态] 加载需求方失败', error)
      setDemandName(`会员#${memberId}`)
    }
  }

  const loadDetail = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/business/${id}` })
      const data = res?.data?.data
      if (!data) return
      setTitle(data.title || '')
      setSummary(data.summary || '')
      const parsed = parseStoredContent(data.content)
      setContent(parsed.text)
      setContentImages(parsed.images)
      setCoverImage(data.cover_image || '')
      setContactPhone(data.contact_phone || '')
      if (data.demand_talent_name) setDemandName(data.demand_talent_name)
      const catIdx = CATEGORIES.findIndex((c) => c.value === data.category)
      setCategoryIndex(catIdx >= 0 ? catIdx : 0)
    } catch (error) {
      console.error('[发布动态] 加载详情失败', error)
    }
  }

  const uploadImage = async (onSuccess: (url: string) => void) => {
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
        onSuccess(parsed.data.url)
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

  const uploadCover = () => {
    void uploadImage((url) => setCoverImage(url))
  }

  const uploadContentImage = () => {
    if (contentImages.length >= MAX_CONTENT_IMAGES) {
      Taro.showToast({ title: `最多上传 ${MAX_CONTENT_IMAGES} 张图片`, icon: 'none' })
      return
    }
    void uploadImage((url) => setContentImages((prev) => [...prev, url].slice(0, MAX_CONTENT_IMAGES)))
  }

  const removeContentImage = (index: number) => {
    setContentImages((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async () => {
    if (!title.trim()) return Taro.showToast({ title: '请填写标题', icon: 'none' })
    if (!coverImage) return Taro.showToast({ title: '请上传封面', icon: 'none' })
    const memberId = Taro.getStorageSync('member_id')
    const token = Taro.getStorageSync('member_token')
    if (!memberId || !token) return Taro.showToast({ title: '请先登录', icon: 'none' })

    const category = CATEGORIES[categoryIndex]?.value || 'financing'
    const body = {
      title: title.trim(),
      category,
      cover_image: coverImage,
      summary: summary.trim(),
      content: buildContentHtml(content, contentImages),
      contact_phone: contactPhone.trim() || null,
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
                <Text>{coverImage ? '更换封面' : '上传封面'}</Text>
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
              <Text className="block text-xs text-gray-500 mb-1">需求方</Text>
              <View className="bg-gray-100 rounded-xl px-3 py-3">
                <Text className="text-sm text-gray-700">{demandName}</Text>
              </View>
              <Text className="block text-xs text-gray-400 mt-1">默认当前登录账号，不可修改</Text>
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
            <View>
              <Text className="block text-xs text-gray-500 mb-1">内容图片（选填）</Text>
              {contentImages.length > 0 ? (
                <View className="flex flex-row flex-wrap gap-2 mb-2">
                  {contentImages.map((url, index) => (
                    <View key={`${url}-${index}`} className="relative w-20 h-20">
                      <Image src={url} className="w-20 h-20 rounded-lg" mode="aspectFill" />
                      <View
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                        onClick={() => removeContentImage(index)}
                      >
                        <X size={12} color="#FFFFFF" />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              <Button
                variant="outline"
                disabled={contentImages.length >= MAX_CONTENT_IMAGES}
                onClick={uploadContentImage}
              >
                <Text>
                  {contentImages.length >= MAX_CONTENT_IMAGES
                    ? '已达上限'
                    : `上传图片（${contentImages.length}/${MAX_CONTENT_IMAGES}）`}
                </Text>
              </Button>
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
          <Text className="text-white">
            {submitting ? '提交中...' : editId ? '保存并重新审核' : '提交审核'}
          </Text>
        </Button>
      </View>
    </ScrollView>
  )
}

export default PublishPostPage
