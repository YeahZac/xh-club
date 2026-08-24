import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { ImagePlus, X, CircleAlert } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FieldWell,
  FixedBottomBar,
  HeroHeader,
  PageShell,
  SoftCard,
  brandColors,
  icon,
  ui,
} from '@/components/brand-ui'
import { Network } from '@/network'
import { stripHtml } from '@/lib/rich-html'
import { chooseAndCompressImages } from '@/lib/compress-image'
import { ensureLogin } from '@/lib/auth'
import { guardPromoterOrMemberUnitPage } from '@/lib/member-access'
import { usePageShare } from '@/lib/mini-program-share'

const CATEGORIES = [
  { value: 'financing', label: '商业需求', tip: '发布商务合作与采购机会' },
  { value: 'resource', label: '资源需求', tip: '寻求资源互补与合作对接' },
  { value: 'life', label: '生活需求', tip: '发布生活服务与日常需求' },
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
  <View className="mb-2 flex flex-row items-center gap-1">
    <Text className={ui.label}>{children}</Text>
    {required ? <Text className="block text-xs text-accent-foreground">*</Text> : null}
  </View>
)

const PublishPostPage = () => {
  usePageShare()

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

  useLoad(async (query) => {
    Taro.setNavigationBarTitle({ title: query?.id ? '编辑商机' : '发布商机' })
    if (!(await guardPromoterOrMemberUnitPage('发布商机'))) return
    const isEdit = Boolean(query?.id)
    if (isEdit) {
      const ok = await ensureLogin('')
      if (!ok) return
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
      const paths = await chooseAndCompressImages({ count: 1 })
      const filePath = paths[0]
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
    <PageShell scroll={false}>
      <ScrollView scrollY className="h-screen" style={{ height: '100vh' }}>
        <HeroHeader
          title={editId ? '编辑商机' : '发布商机'}
          subtitle="填写清晰信息，审核通过后将在商机大厅展示"
          compact
          withStatusBar={false}
        />

        <View className="px-4 pb-32">
          <View className="mb-6">
            <FieldLabel required>商机类型</FieldLabel>
            <View className="flex flex-row gap-3">
              {CATEGORIES.map((item, index) => {
                const active = categoryIndex === index
                return (
                  <View
                    key={item.value}
                    className={`flex-1 rounded-2xl px-3 py-4 ${active ? 'bg-primary' : 'bg-card border border-border'}`}
                    onClick={() => setCategoryIndex(index)}
                  >
                    <Text className={`block text-sm font-semibold ${active ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {item.label}
                    </Text>
                    <Text className={`mt-1 block text-xs leading-snug ${active ? 'text-primary-foreground text-opacity-70' : 'text-muted-foreground'}`}>
                      {item.tip}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          <SoftCard className="mb-3 p-4">
            <FieldLabel required>封面图</FieldLabel>
            <View
              className="relative w-full overflow-hidden rounded-2xl bg-muted"
              onClick={uploadCover}
            >
              {coverImage ? (
                <>
                  <Image src={coverImage} className="aspect-[4/3] w-full" mode="aspectFill" />
                  <View className="absolute bottom-3 right-3 rounded-full bg-primary px-3 py-2">
                    <Text className="block text-xs text-primary-foreground">更换封面</Text>
                  </View>
                </>
              ) : (
                <View className="flex aspect-[4/3] flex-col items-center justify-center gap-2">
                  <ImagePlus size={icon.xl} color={brandColors.muted} />
                  <Text className="block text-sm text-muted-foreground">点击上传封面</Text>
                  <Text className={ui.caption}>建议 4:3 横图，清晰展示主题</Text>
                </View>
              )}
            </View>

            <View className="mt-5">
              <FieldLabel required>标题</FieldLabel>
              <FieldWell>
                <Input
                  variant="ghost"
                  placeholder="一句话概括你的商机"
                  value={title}
                  maxlength={60}
                  onInput={(e) => setTitle(e.detail.value)}
                />
              </FieldWell>
            </View>

            <View className="mt-5">
              <FieldLabel>联系电话</FieldLabel>
              <FieldWell>
                <Input
                  variant="ghost"
                  type="number"
                  placeholder="方便对方联系你（选填）"
                  value={contactPhone}
                  onInput={(e) => setContactPhone(e.detail.value)}
                />
              </FieldWell>
            </View>

            <View className="mt-5">
              <FieldLabel>需求方</FieldLabel>
              <View className="flex flex-row items-center justify-between rounded-2xl bg-gold-surface px-4 py-4">
                <Text className="block text-sm font-medium text-foreground">{demandName}</Text>
                <Text className={ui.caption}>当前账号</Text>
              </View>
            </View>
          </SoftCard>

          <SoftCard className="mb-3 p-4">
            <FieldLabel>摘要</FieldLabel>
            <FieldWell className="mb-5">
              <Textarea
                className="w-full bg-transparent text-sm text-foreground"
                style={{ minHeight: '64px', width: '100%' }}
                placeholder="用一两句话介绍核心诉求"
                value={summary}
                onInput={(e) => setSummary(e.detail.value)}
                maxlength={200}
              />
            </FieldWell>

            <FieldLabel>详细内容</FieldLabel>
            <FieldWell className="mb-5">
              <Textarea
                className="w-full bg-transparent text-sm text-foreground"
                style={{ minHeight: '150px', width: '100%' }}
                placeholder="补充背景、合作条件、预期成果等"
                value={content}
                onInput={(e) => setContent(e.detail.value)}
                maxlength={5000}
              />
            </FieldWell>

            <FieldLabel>内容配图</FieldLabel>
            <View className="flex flex-row flex-wrap gap-3">
              {contentImages.map((url, index) => (
                <View key={`${url}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-xl">
                  <Image src={url} className="h-20 w-20" mode="aspectFill" />
                  <View
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive"
                    onClick={() => removeContentImage(index)}
                  >
                    <X size={12} color="#FFFFFF" />
                  </View>
                </View>
              ))}
              {contentImages.length < MAX_CONTENT_IMAGES ? (
                <View
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl bg-field"
                  onClick={uploadContentImage}
                >
                  <ImagePlus size={icon.md} color={brandColors.muted} />
                  <Text className={ui.caption}>{contentImages.length}/{MAX_CONTENT_IMAGES}</Text>
                </View>
              ) : null}
            </View>
          </SoftCard>

          <View className="flex flex-row items-start gap-2 px-1">
            <CircleAlert size={icon.sm} color={brandColors.gold} className="mt-1" />
            <Text className="block flex-1 text-xs leading-relaxed text-accent-foreground">
              提交后进入审核，通过后才会在商机列表公开展示
            </Text>
          </View>
        </View>
      </ScrollView>

      <FixedBottomBar>
        <Button
          variant="brand"
          size="lg"
          className={ui.btnPrimary}
          disabled={submitting}
          onClick={submit}
        >
          <Text className="text-base font-semibold text-primary-foreground">
            {submitting ? '提交中...' : editId ? '保存并重新审核' : '提交审核'}
          </Text>
        </Button>
      </FixedBottomBar>
    </PageShell>
  )
}

export default PublishPostPage
