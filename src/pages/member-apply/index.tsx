import { useEffect, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Camera, Clock3 } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  FieldWell,
  FixedBottomBar,
  HeroHeader,
  PageShell,
  SoftCard,
  ui,
} from '@/components/brand-ui'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { chooseAndCompressImages } from '@/lib/compress-image'
import { ensureLogin } from '@/lib/auth'
import { fetchMemberUserCategory, isPromoterOrMemberUnit } from '@/lib/member-access'
import { isDisplayableImageUrl } from '@/lib/media-url'
import { parseMemberUploadResult } from '@/lib/upload-result'
import { buildTalentFormPrefill } from '@/lib/talent-form-prefill'
import { Network } from '@/network'
import { cn } from '@/lib/utils'
import { usePageShare } from '@/lib/mini-program-share'

interface IndustryItem {
  code: string
  name: string
}

const PAGE_TITLE = '申请成为推广员/会员单位'

const APPLY_TYPES = [
  { value: 'promoter', label: '推广员', price: '198元' },
  { value: 'member_unit', label: '会员单位', price: '4980元' },
] as const

const PAYMENT_STATUS_OPTIONS = [
  { value: 'paid', label: '已缴费' },
  { value: 'unpaid', label: '未缴费' },
] as const

const PAYMENT_METHOD_OPTIONS = [
  { value: 'offline', label: '线下缴费' },
  { value: 'wechat', label: '微信支付' },
  { value: 'bank', label: '银行转账' },
] as const

const MemberApplyPage = () => {
  usePageShare()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [industries, setIndustries] = useState<IndustryItem[]>([])

  const [applyType, setApplyType] = useState<'promoter' | 'member_unit'>('promoter')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid')
  const [paymentMethod, setPaymentMethod] = useState('offline')
  const [realName, setRealName] = useState('')
  const [contact, setContact] = useState('')
  const [phoneLocked, setPhoneLocked] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [experience, setExperience] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [prefilledFromTalent, setPrefilledFromTalent] = useState(false)
  const [pendingReview, setPendingReview] = useState(false)
  const [pendingApplyLabel, setPendingApplyLabel] = useState('')

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: PAGE_TITLE })
    void bootstrap()
  }, [])

  const bootstrap = async () => {
    setLoading(true)
    try {
      if (!(await ensureLogin(''))) {
        setTimeout(() => Taro.navigateBack(), 400)
        return
      }
      const category = await fetchMemberUserCategory()
      if (isPromoterOrMemberUnit(category)) {
        setAlreadyMember(true)
        return
      }
      const memberId = Taro.getStorageSync('member_id')
      const [industryRes, profileRes, mineRes] = await Promise.all([
        Network.request({ url: '/api/industries' }),
        memberId ? Network.request({ url: `/api/members/profile/${memberId}` }) : Promise.resolve(null),
        Network.request({ url: '/api/talents/mine' }),
      ])
      setIndustries(Array.isArray(industryRes?.data?.data) ? industryRes.data.data : [])

      const wxPhone = String(profileRes?.data?.data?.phone || '').trim()
      const lockedByWx = Boolean(wxPhone)
      if (lockedByWx) {
        setContact(wxPhone)
        setPhoneLocked(true)
      }

      const mine = mineRes?.data?.data || null
      const prefill = buildTalentFormPrefill(mine, { forcedPhone: lockedByWx ? wxPhone : '' })
      const isMemberApplyPending =
        mine?.status === 'pending' &&
        (mine?.apply_type === 'promoter' || mine?.apply_type === 'member_unit')
      if (isMemberApplyPending) {
        setPendingReview(true)
        setPendingApplyLabel(
          mine?.apply_type === 'member_unit' ? '会员单位' : '推广员',
        )
      }
      if (prefill) {
        if (prefill.realName) setRealName(prefill.realName)
        if (prefill.contact) setContact(prefill.contact)
        if (prefill.companyName) setCompanyName(prefill.companyName)
        if (prefill.jobTitle) setJobTitle(prefill.jobTitle)
        if (prefill.photoUrl) {
          setPhotoUrl(prefill.photoUrl)
          setPhotoPreview(prefill.photoUrl)
        }
        if (prefill.experience) setExperience(prefill.experience)
        if (prefill.industryTags.length) setSelectedTags(prefill.industryTags)
        if (prefill.applyType) setApplyType(prefill.applyType)
        if (prefill.paymentStatus) setPaymentStatus(prefill.paymentStatus)
        if (prefill.paymentMethod) setPaymentMethod(prefill.paymentMethod)
        setPrefilledFromTalent(true)
      } else {
        const profileName = String(profileRes?.data?.data?.name || '').trim()
        if (profileName) setRealName(profileName)
      }
    } catch (error) {
      console.error('[加入会员] 初始化失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const toggleTag = (code: string) => {
    setSelectedTags((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    )
  }

  const uploadPhoto = async () => {
    try {
      const paths = await chooseAndCompressImages({ count: 1 })
      const filePath = paths[0]
      if (!filePath) {
        Taro.showToast({ title: '未选择图片', icon: 'none' })
        return
      }
      Taro.showLoading({ title: '上传中...' })
      const result = await Network.uploadFile({
        url: '/api/upload/member/image',
        filePath,
        name: 'file',
      })
      const { canonicalUrl, previewUrl } = parseMemberUploadResult(result.data)
      if (!canonicalUrl) {
        Taro.showToast({ title: '上传失败', icon: 'none' })
        return
      }
      setPhotoUrl(canonicalUrl)
      setPhotoPreview(previewUrl || filePath)
      Taro.showToast({ title: '上传成功', icon: 'success' })
    } catch (error) {
      console.error('[加入会员] 上传失败:', error)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const submit = async () => {
    if (!realName.trim()) return Taro.showToast({ title: '请填写真实姓名', icon: 'none' })
    if (!contact.trim()) return Taro.showToast({ title: '请填写联系方式', icon: 'none' })
    if (!companyName.trim()) return Taro.showToast({ title: '请填写公司名称', icon: 'none' })
    if (!photoUrl) return Taro.showToast({ title: '请上传职业照片', icon: 'none' })
    if (!selectedTags.length) return Taro.showToast({ title: '请选择行业标签', icon: 'none' })
    if (!paymentMethod) return Taro.showToast({ title: '请选择缴费方式', icon: 'none' })

    try {
      setSaving(true)
      const res = await Network.request({
        url: '/api/talents/member-apply',
        method: 'POST',
        data: {
          apply_type: applyType,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          real_name: realName.trim(),
          contact: contact.trim(),
          company_name: companyName.trim(),
          job_title: jobTitle.trim() || null,
          photo_url: photoUrl,
          avatar_url: photoUrl,
          experience: experience.trim() || null,
          industry_tags: selectedTags,
        },
      })
      if (res?.data?.code !== 200) {
        Taro.showToast({ title: String(res?.data?.msg || '提交失败').slice(0, 40), icon: 'none' })
        return
      }
      Taro.showToast({ title: '申请已提交，请等待审核', icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/profile/index' }), 600)
    } catch (error) {
      console.error('[加入会员] 提交失败:', error)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <View className="flex min-h-screen items-center justify-center">
          <Text className="block text-sm text-muted-foreground">加载中...</Text>
        </View>
      </PageShell>
    )
  }

  if (alreadyMember) {
    return (
      <PageShell>
        <HeroHeader title={PAGE_TITLE} subtitle="您已是推广员或会员单位" compact />
        <View className="px-4 py-8">
          <SoftCard className="p-5">
            <Text className={ui.caption}>当前账号已具备推广员/会员单位权限，可直接使用相关功能。</Text>
            <Button className="mt-4 w-full" variant="brand" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
              <Text className="block text-primary-foreground">返回首页</Text>
            </Button>
          </SoftCard>
        </View>
      </PageShell>
    )
  }

  if (pendingReview) {
    return (
      <PageShell>
        <HeroHeader title={PAGE_TITLE} subtitle="申请审核中" compact />
        <View className="px-4 py-8">
          <SoftCard className="p-5">
            <View className="mb-3 flex flex-row items-center gap-2">
              <Clock3 size={18} color="#D97706" />
              <Text className="block text-base font-semibold text-foreground">审核中</Text>
              <Badge className="bg-amber-100 text-amber-800 text-xs px-2 py-0">待审核</Badge>
            </View>
            <Text className={ui.caption}>
              您的{pendingApplyLabel || '会员升级'}申请已提交，请耐心等待后台审核。审核结果将通过消息通知告知。
            </Text>
            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
            >
              <Text className="block">返回个人中心</Text>
            </Button>
          </SoftCard>
        </View>
      </PageShell>
    )
  }

  const selectedApply = APPLY_TYPES.find((item) => item.value === applyType)

  return (
    <PageShell scroll={false}>
      <ScrollView scrollY className="h-screen" style={{ height: '100vh' }}>
        <View className="pb-28">
          <HeroHeader
            eyebrow="会员升级"
            title={PAGE_TITLE}
            subtitle="请选择申请类型，并提交入驻资料与缴费信息"
            compact
          />
          <View className="flex flex-col gap-4 px-4">
            {prefilledFromTalent ? (
              <SoftCard className="border border-accent-foreground/20 bg-accent/10 px-4 py-3">
                <Text className="block text-sm text-foreground">
                  已自动带入您的人才入驻资料，请核对申请类型与缴费信息后提交。
                </Text>
              </SoftCard>
            ) : null}

            <SoftCard className="p-4">
              <Label className={ui.label}>申请类型 *</Label>
              <RadioGroup
                className="mt-3 flex flex-col gap-2"
                value={applyType}
                onValueChange={(value) => setApplyType(value as 'promoter' | 'member_unit')}
              >
                {APPLY_TYPES.map((item) => {
                  const selected = applyType === item.value
                  return (
                    <View
                      key={item.value}
                      className={cn(
                        'flex flex-row items-center gap-3 rounded-xl border px-4 py-3',
                        selected ? 'border-accent-foreground bg-accent/10' : 'border-border bg-background',
                      )}
                      onClick={() => setApplyType(item.value)}
                    >
                      <RadioGroupItem value={item.value} />
                      <View className="min-w-0 flex-1">
                        <Text className="block text-sm font-semibold text-foreground">{item.label}</Text>
                        <Text className="mt-0.5 block text-xs text-muted-foreground">{item.price}</Text>
                      </View>
                    </View>
                  )
                })}
              </RadioGroup>
              {selectedApply ? (
                <Text className={cn(ui.caption, 'mt-2')}>
                  当前选择：{selectedApply.label}（{selectedApply.price}）
                </Text>
              ) : null}
            </SoftCard>

            <SoftCard className="flex flex-col gap-4 p-4">
              <View>
                <Label className={ui.label}>真实姓名 *</Label>
                <FieldWell className="mt-2">
                  <Input variant="ghost" value={realName} onInput={(e) => setRealName(e.detail.value)} placeholder="请输入真实姓名" />
                </FieldWell>
              </View>
              <View>
                <Label className={ui.label}>联系方式 *</Label>
                <FieldWell className="mt-2">
                  <Input
                    variant="ghost"
                    value={contact}
                    disabled={phoneLocked}
                    onInput={(e) => setContact(e.detail.value)}
                    placeholder="请输入手机号"
                  />
                </FieldWell>
              </View>
              <View>
                <Label className={ui.label}>公司名称 *</Label>
                <FieldWell className="mt-2">
                  <Textarea
                    className="min-h-20 w-full bg-transparent text-sm"
                    value={companyName}
                    onInput={(e) => setCompanyName(e.detail.value)}
                    placeholder="请输入公司名称"
                  />
                </FieldWell>
              </View>
              <View>
                <Label className={ui.label}>职位名称</Label>
                <FieldWell className="mt-2">
                  <Input variant="ghost" value={jobTitle} onInput={(e) => setJobTitle(e.detail.value)} placeholder="选填" />
                </FieldWell>
              </View>
              <View>
                <Label className={ui.label}>职业照片 *</Label>
                <View className="mt-2 flex flex-row items-center gap-3">
                  {isDisplayableImageUrl(photoPreview || photoUrl) ? (
                    <Image src={photoPreview || photoUrl} mode="aspectFill" className="h-20 w-16 rounded-lg" />
                  ) : (
                    <View className="flex h-20 w-16 items-center justify-center rounded-lg bg-muted">
                      <Camera size={20} color="#64748B" />
                    </View>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void uploadPhoto()}>
                    <Text className="block text-xs">上传照片</Text>
                  </Button>
                </View>
              </View>
              <View>
                <Label className={ui.label}>行业标签 *</Label>
                <View className="mt-2 flex flex-row flex-wrap gap-2">
                  {industries.map((item) => (
                    <Badge
                      key={item.code}
                      variant={selectedTags.includes(item.code) ? 'gold' : 'soft'}
                      className="px-2 py-1 text-xs"
                      onClick={() => toggleTag(item.code)}
                    >
                      {item.name}
                    </Badge>
                  ))}
                </View>
              </View>
              <View>
                <Label className={ui.label}>过往经历</Label>
                <FieldWell className="mt-2">
                  <Textarea
                    className="min-h-24 w-full bg-transparent text-sm"
                    value={experience}
                    onInput={(e) => setExperience(e.detail.value)}
                    placeholder="选填"
                    maxlength={500}
                  />
                </FieldWell>
              </View>
            </SoftCard>

            <SoftCard className="flex flex-col gap-4 p-4">
              <Text className="block text-sm font-semibold text-foreground">缴费信息</Text>
              <View>
                <Label className={ui.label}>是否缴费 *</Label>
                <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as 'paid' | 'unpaid')}>
                  <SelectTrigger className="mt-2 h-11 w-full bg-field">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </View>
              <View>
                <Label className={ui.label}>缴费方式 *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-2 h-11 w-full bg-field">
                    <SelectValue placeholder="请选择缴费方式" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </View>
            </SoftCard>
          </View>
        </View>
      </ScrollView>

      <FixedBottomBar>
        <Button variant="brand" size="lg" className="w-full" disabled={saving} onClick={() => void submit()}>
          <Text className="block text-primary-foreground">{saving ? '提交中...' : '提交申请'}</Text>
        </Button>
      </FixedBottomBar>
    </PageShell>
  )
}

export default MemberApplyPage
