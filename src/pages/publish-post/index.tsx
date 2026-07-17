import { useState } from 'react'
import { View, Text, ScrollView, Image, Textarea } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ImagePlus, X, CircleAlert } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { stripHtml } from '@/lib/rich-html'
import { ensureLogin } from '@/lib/auth'

const CATEGORIES = [
  { value: 'financing', label: '融资招募', tip: '寻找资金与投资机会' },
  { value: 'resource', label: '资源对接', tip: '寻求合作与资源互补' },
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

const FieldLabel = ({ children, required }: { children: string; required?: boolean }) => (
  <View className="flex flex-row items-center gap-1 mb-2">
    <Text className="block text-sm font-medium text-[#1A1D2E]">{children}</Text>
    {required ? <Text className="block text-xs text-[#C9A96E]">*</Text> : null}
  </View>
)

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
    Taro.setNavigationBarTitle({ title: query?.id ? '编辑商机' : '发布商机' })
    const isEdit = Boolean(query?.id)
    if (isEdit) {
      setEditId(String(query.id))
      void loadDetail(String(query.id))
    }
    void loadDemandParty(!isEdit)
  })

  const loadDemandParty = async (fillPhone = false) => {
    const ok = await ensureLogin('')
    if (!ok) {
      setDemandName('请先登录')
      return
    }
    const memberId = Taro.getStorageSync('member_id')

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
      console.error('[发布商机] 加载需求方失败', error)
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
      console.error('[发布商机] 加载详情失败', error)
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
      console.error('[发布商机] 上传失败', error)
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
    if (!(await ensureLogin())) return

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
      console.log('[发布商机] 提交结果', res?.data)
      if (res?.data?.code === 200) {
        Taro.showToast({ title: editId ? '已提交重新审核' : '提交成功，等待审核', icon: 'success' })
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/my-posts/index' })
        }, 800)
      } else {
        Taro.showToast({ title: res?.data?.msg || '提交失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[发布商机] 提交失败', error)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="h-screen bg-[#F7F5F1]">
      <ScrollView scrollY className="h-screen">
        <View className="px-4 pt-4 pb-32">
          <View className="mb-5">
            <Text className="block text-2xl font-bold text-[#1B2A4A] tracking-wide">发布商机</Text>
            <Text className="block text-sm text-gray-500 mt-1.5 leading-relaxed">
              填写清晰信息，审核通过后将在商机大厅展示
            </Text>
          </View>

          <View className="mb-6">
            <FieldLabel required>商机类型</FieldLabel>
            <View className="flex flex-row gap-2.5">
              {CATEGORIES.map((item, index) => {
                const active = categoryIndex === index
                return (
                  <View
                    key={item.value}
                    className={`flex-1 rounded-2xl px-3 py-3.5 ${active ? 'bg-[#1B2A4A]' : 'bg-white'}`}
                    onClick={() => setCategoryIndex(index)}
                  >
                    <Text className={`block text-sm font-semibold ${active ? 'text-white' : 'text-[#1A1D2E]'}`}>
                      {item.label}
                    </Text>
                    <Text className={`block text-xs mt-1 leading-snug ${active ? 'text-white/70' : 'text-gray-400'}`}>
                      {item.tip}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View className="bg-white rounded-3xl px-4 py-5 mb-3">
            <FieldLabel required>封面图</FieldLabel>
            <View
              className="relative w-full overflow-hidden rounded-2xl bg-[#EEF0F4]"
              onClick={uploadCover}
            >
              {coverImage ? (
                <>
                  <Image src={coverImage} className="w-full aspect-[4/3]" mode="aspectFill" />
                  <View className="absolute bottom-3 right-3 bg-black/50 rounded-full px-3 py-1.5">
                    <Text className="block text-xs text-white">更换封面</Text>
                  </View>
                </>
              ) : (
                <View className="aspect-[4/3] flex flex-col items-center justify-center gap-2">
                  <ImagePlus size={28} color="#9CA3AF" />
                  <Text className="block text-sm text-gray-500">点击上传封面</Text>
                  <Text className="block text-xs text-gray-400">建议 4:3 横图，清晰展示主题</Text>
                </View>
              )}
            </View>

            <View className="mt-5">
              <FieldLabel required>标题</FieldLabel>
              <View className="bg-[#F7F5F1] rounded-2xl px-3 py-1">
                <Input
                  className="w-full bg-transparent border-0"
                  placeholder="一句话概括你的商机"
                  value={title}
                  maxlength={60}
                  onInput={(e) => setTitle(e.detail.value)}
                />
              </View>
            </View>

            <View className="mt-5">
              <FieldLabel>联系电话</FieldLabel>
              <View className="bg-[#F7F5F1] rounded-2xl px-3 py-1">
                <Input
                  className="w-full bg-transparent border-0"
                  type="number"
                  placeholder="方便对方联系你（选填）"
                  value={contactPhone}
                  onInput={(e) => setContactPhone(e.detail.value)}
                />
              </View>
            </View>

            <View className="mt-5">
              <FieldLabel>需求方</FieldLabel>
              <View className="bg-[#F0EDE7] rounded-2xl px-4 py-3.5 flex flex-row items-center justify-between">
                <Text className="block text-sm text-[#1A1D2E] font-medium">{demandName}</Text>
                <Text className="block text-xs text-gray-400">当前账号</Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-3xl px-4 py-5 mb-3">
            <FieldLabel>摘要</FieldLabel>
            <View className="bg-[#F7F5F1] rounded-2xl p-3 mb-5">
              <Textarea
                className="w-full bg-transparent text-sm"
                style={{ minHeight: '64px', width: '100%' }}
                placeholder="用一两句话介绍核心诉求"
                value={summary}
                onInput={(e) => setSummary(e.detail.value)}
                maxlength={200}
              />
            </View>

            <FieldLabel>详细内容</FieldLabel>
            <View className="bg-[#F7F5F1] rounded-2xl p-3 mb-5">
              <Textarea
                className="w-full bg-transparent text-sm"
                style={{ minHeight: '150px', width: '100%' }}
                placeholder="补充背景、合作条件、预期成果等"
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                maxlength={5000}
              />
            </View>

            <FieldLabel>内容配图</FieldLabel>
            <View className="flex flex-row flex-wrap gap-2.5">
              {contentImages.map((url, index) => (
                <View key={`${url}-${index}`} className="relative w-20 h-20 rounded-xl overflow-hidden">
                  <Image src={url} className="w-20 h-20" mode="aspectFill" />
                  <View
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/55 flex items-center justify-center"
                    onClick={() => removeContentImage(index)}
                  >
                    <X size={12} color="#FFFFFF" />
                  </View>
                </View>
              ))}
              {contentImages.length < MAX_CONTENT_IMAGES ? (
                <View
                  className="w-20 h-20 rounded-xl bg-[#F7F5F1] flex flex-col items-center justify-center gap-1"
                  onClick={uploadContentImage}
                >
                  <ImagePlus size={18} color="#9CA3AF" />
                  <Text className="block text-xs text-gray-400">{contentImages.length}/{MAX_CONTENT_IMAGES}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="flex flex-row items-start gap-2 px-1">
            <CircleAlert size={14} color="#C9A96E" className="mt-0.5" />
            <Text className="block flex-1 text-xs text-[#8A7A55] leading-relaxed">
              提交后进入审核，通过后才会在商机列表公开展示
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          backgroundColor: 'rgba(247,245,241,0.96)',
          zIndex: 100,
        }}
      >
        <Button
          className="w-full h-12 rounded-2xl bg-[#1B2A4A]"
          disabled={submitting}
          onClick={submit}
        >
          <Text className="text-white text-base font-semibold">
            {submitting ? '提交中...' : editId ? '保存并重新审核' : '提交审核'}
          </Text>
        </Button>
      </View>
    </View>
  )
}

export default PublishPostPage
