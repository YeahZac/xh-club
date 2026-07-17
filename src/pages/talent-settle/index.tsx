import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Camera, BadgeCheck, Clock3, CircleX, PencilLine } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { isDisplayableImageUrl } from '@/lib/media-url'
import { Network } from '@/network'
import { ensureLogin } from '@/lib/auth'

interface IndustryItem {
  id: string | number
  code: string
  name: string
}

interface TalentApplication {
  id: string | number
  real_name: string
  contact: string
  photo_url: string
  industry_tags: string[]
  experience?: string
  card_image_url?: string
  avatar_url?: string
  member_avatar?: string
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
}

const STATUS_META = {
  pending: { label: '审核中', color: 'bg-amber-50 text-amber-700', tip: '资料已提交，审核期间可修改后重新提交' },
  approved: { label: '已通过', color: 'bg-emerald-50 text-emerald-700', tip: '你已成功入驻人才库，可继续完善资料' },
  rejected: { label: '未通过', color: 'bg-red-50 text-red-700', tip: '请根据原因修改后重新提交' },
}

const TalentSettlePage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [industries, setIndustries] = useState<IndustryItem[]>([])
  const [application, setApplication] = useState<TalentApplication | null>(null)

  const [realName, setRealName] = useState('')
  const [contact, setContact] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [cardImageUrl, setCardImageUrl] = useState('')
  const [experience, setExperience] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    bootstrap()
  }, [])

  const bootstrap = async () => {
    setLoading(true)
    try {
      if (!(await ensureLogin(''))) {
        setTimeout(() => Taro.navigateBack(), 400)
        return
      }
      const [industryRes, mineRes] = await Promise.all([
        Network.request({ url: '/api/industries' }),
        Network.request({ url: '/api/talents/mine' }),
      ])
      const industryList = Array.isArray(industryRes?.data?.data) ? industryRes.data.data : []
      setIndustries(industryList)

      const mine = mineRes?.data?.data || null
      if (mine?.id) {
        setApplication(mine)
        fillForm(mine)
        setEditing(mine.status !== 'approved')
      } else {
        setApplication(null)
        setEditing(true)
      }
    } catch (error) {
      console.error('[人才入驻] 初始化失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const fillForm = (mine: TalentApplication) => {
    setRealName(mine.real_name || '')
    setContact(mine.contact || '')
    setPhotoUrl(mine.photo_url || '')
    setCardImageUrl(mine.card_image_url || '')
    setExperience(mine.experience || '')
    setSelectedTags(Array.isArray(mine.industry_tags) ? mine.industry_tags : [])
  }

  const toggleTag = (code: string) => {
    setSelectedTags((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    )
  }

  const uploadImage = async (target: 'photo' | 'card') => {
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
      console.log('[人才入驻] 上传结果:', parsed)
      if (parsed?.code === 200 && parsed?.data?.url) {
        if (target === 'photo') setPhotoUrl(parsed.data.url)
        else setCardImageUrl(parsed.data.url)
        Taro.showToast({ title: '上传成功', icon: 'success' })
      } else {
        Taro.showToast({ title: parsed?.msg || '上传失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[人才入驻] 上传失败:', error)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const submit = async () => {
    if (!realName.trim()) return Taro.showToast({ title: '请填写真实姓名', icon: 'none' })
    if (!contact.trim()) return Taro.showToast({ title: '请填写联系方式', icon: 'none' })
    if (!photoUrl) return Taro.showToast({ title: '请上传职业照片', icon: 'none' })
    if (!selectedTags.length) return Taro.showToast({ title: '请选择行业标签', icon: 'none' })

    try {
      setSaving(true)
      const body = {
        real_name: realName.trim(),
        contact: contact.trim(),
        photo_url: photoUrl,
        avatar_url: photoUrl,
        card_image_url: cardImageUrl || null,
        experience: experience.trim(),
        industry_tags: selectedTags,
      }
      const url = application?.id ? '/api/talents/mine' : '/api/talents/apply'
      const method = application?.id ? 'PUT' : 'POST'
      const res = await Network.request({ url, method, data: body })
      console.log('[人才入驻] 提交结果:', res?.data)
      if (res?.data?.code === 200) {
        Taro.showToast({ title: application?.id ? '已重新提交' : '提交成功', icon: 'success' })
        const mine = res.data.data
        setApplication(mine)
        fillForm(mine)
        setEditing(mine.status !== 'approved')
      } else {
        Taro.showToast({ title: res?.data?.msg || '提交失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[人才入驻] 提交失败:', error)
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const industryName = (code: string) =>
    industries.find((item) => item.code === code)?.name || code

  if (loading) {
    return (
      <View className="flex items-center justify-center h-full bg-[#F5F6FA]">
        <Text className="block text-sm text-gray-400">加载中...</Text>
      </View>
    )
  }

  const status = application?.status
  const meta = status ? STATUS_META[status] : null
  const showDetail = application && status === 'approved' && !editing
  const displayAvatar = application?.avatar_url || application?.member_avatar || application?.photo_url

  return (
    <View className="flex flex-col h-full bg-[#F5F6FA]">
      <ScrollView scrollY className="flex-1">
        {meta && (
          <View className="px-4 pt-4">
            <Card className="shadow-sm border-0">
              <CardContent className="p-4">
                <View className="flex flex-row items-center justify-between mb-2">
                  <View className="flex flex-row items-center gap-2">
                    {status === 'approved' ? (
                      <BadgeCheck size={18} color="#059669" />
                    ) : status === 'rejected' ? (
                      <CircleX size={18} color="#DC2626" />
                    ) : (
                      <Clock3 size={18} color="#D97706" />
                    )}
                    <Text className="block text-base font-semibold text-[#1A1D2E]">入驻状态</Text>
                  </View>
                  <Badge className={`${meta.color} text-xs px-2 py-0`}>{meta.label}</Badge>
                </View>
                <Text className="block text-xs text-gray-500">{meta.tip}</Text>
                {status === 'rejected' && application?.reject_reason && (
                  <View className="mt-3 rounded-xl bg-red-50 px-3 py-2">
                    <Text className="block text-xs text-red-600">原因：{application.reject_reason}</Text>
                  </View>
                )}
                {status === 'approved' && (
                  <View className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => setEditing(true)}
                    >
                      <View className="flex flex-row items-center gap-1">
                        <PencilLine size={14} color="#1B2A4A" />
                        <Text>修改信息</Text>
                      </View>
                    </Button>
                  </View>
                )}
              </CardContent>
            </Card>
          </View>
        )}

        {showDetail ? (
          <View className="px-4 py-4 pb-10">
            <Card className="shadow-sm border-0 overflow-hidden">
              {isDisplayableImageUrl(application.photo_url) && (
                <Image src={application.photo_url} mode="aspectFill" className="w-full aspect-[4/3]" />
              )}
              <CardContent className="p-5">
                <View className="flex flex-row items-center gap-3 mb-4">
                  {isDisplayableImageUrl(displayAvatar) ? (
                    <Image src={displayAvatar!} mode="aspectFill" className="w-14 h-14 rounded-full" />
                  ) : (
                    <View className="w-14 h-14 rounded-full bg-[#1B2A4A] flex items-center justify-center">
                      <Text className="block text-white text-lg font-bold">{(application.real_name || '?')[0]}</Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="block text-xl font-bold text-[#1A1D2E]">{application.real_name}</Text>
                    <Text className="block text-sm text-gray-500 mt-1">{application.contact}</Text>
                  </View>
                </View>
                <View className="flex flex-row flex-wrap gap-2 mb-4">
                  {(application.industry_tags || []).map((code) => (
                    <Badge key={code} className="bg-[#FAF6F1] text-[#C9A96E] text-xs px-2 py-0">
                      {industryName(code)}
                    </Badge>
                  ))}
                </View>
                {application.experience && (
                  <View className="mb-4">
                    <Text className="block text-sm font-semibold text-[#1A1D2E] mb-2">过往经历</Text>
                    <Text className="block text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {application.experience}
                    </Text>
                  </View>
                )}
                {isDisplayableImageUrl(application.card_image_url) && (
                  <View>
                    <Text className="block text-sm font-semibold text-[#1A1D2E] mb-2">个人名片</Text>
                    <Image src={application.card_image_url!} mode="widthFix" className="w-full rounded-xl" />
                  </View>
                )}
              </CardContent>
            </Card>
          </View>
        ) : (
          <View className="px-4 py-4 pb-28">
            <Card className="shadow-sm border-0">
              <CardContent className="p-4 flex flex-col gap-4">
                <View>
                  <Label className="text-sm text-gray-700 mb-2">真实姓名 *</Label>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="请输入真实姓名"
                      value={realName}
                      onInput={(e) => setRealName(e.detail.value)}
                    />
                  </View>
                </View>

                <View>
                  <Label className="text-sm text-gray-700 mb-2">联系方式 *</Label>
                  <View className="bg-gray-50 rounded-xl px-4 py-3">
                    <Input
                      className="w-full bg-transparent"
                      placeholder="手机号 / 微信"
                      value={contact}
                      onInput={(e) => setContact(e.detail.value)}
                    />
                  </View>
                </View>

                <View>
                  <Label className="text-sm text-gray-700 mb-2">职业照片 *</Label>
                  <View
                    className="rounded-xl border border-dashed border-gray-300 bg-gray-50 overflow-hidden"
                    onClick={() => uploadImage('photo')}
                  >
                    {isDisplayableImageUrl(photoUrl) ? (
                      <Image src={photoUrl} mode="aspectFill" className="w-full aspect-[4/3]" />
                    ) : (
                      <View className="flex flex-col items-center justify-center py-10">
                        <Camera size={28} color="#9CA3AF" />
                        <Text className="block text-xs text-gray-400 mt-2">点击上传职业照片</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View>
                  <Label className="text-sm text-gray-700 mb-2">行业标签 *</Label>
                  <View className="flex flex-row flex-wrap gap-2">
                    {industries.map((item) => {
                      const active = selectedTags.includes(item.code)
                      return (
                        <View
                          key={item.code}
                          onClick={() => toggleTag(item.code)}
                          className={`px-3 py-1.5 rounded-full ${active ? 'bg-[#1B2A4A]' : 'bg-gray-100'}`}
                        >
                          <Text className={`block text-xs ${active ? 'text-white' : 'text-gray-600'}`}>
                            {item.name}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                  {!industries.length && (
                    <Text className="block text-xs text-gray-400 mt-2">暂无行业配置，请联系管理员</Text>
                  )}
                </View>

                <View>
                  <Label className="text-sm text-gray-700 mb-2">过往经历</Label>
                  <View className="bg-gray-50 rounded-2xl p-4">
                    <Textarea
                      className="w-full bg-transparent"
                      style={{ width: '100%', minHeight: '100px', backgroundColor: 'transparent' }}
                      placeholder="介绍你的职业经历、擅长领域..."
                      maxlength={1000}
                      value={experience}
                      onInput={(e) => setExperience(e.detail.value)}
                    />
                  </View>
                </View>

                <View>
                  <Label className="text-sm text-gray-700 mb-2">个人名片（选填）</Label>
                  <View
                    className="rounded-xl border border-dashed border-gray-300 bg-gray-50 overflow-hidden"
                    onClick={() => uploadImage('card')}
                  >
                    {isDisplayableImageUrl(cardImageUrl) ? (
                      <Image src={cardImageUrl} mode="widthFix" className="w-full" />
                    ) : (
                      <View className="flex flex-col items-center justify-center py-8">
                        <Camera size={24} color="#9CA3AF" />
                        <Text className="block text-xs text-gray-400 mt-2">上传名片图片</Text>
                      </View>
                    )}
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}
      </ScrollView>

      {editing && (
        <View
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#fff',
            borderTop: '1px solid #e5e5e5',
            zIndex: 100,
          }}
        >
          {application?.status === 'approved' && (
            <View style={{ flex: 1 }}>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => {
                  fillForm(application)
                  setEditing(false)
                }}
              >
                <Text>取消</Text>
              </Button>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button
              className="w-full bg-[#1B2A4A] text-white rounded-xl"
              disabled={saving}
              onClick={submit}
            >
              <Text>{saving ? '提交中...' : application?.id ? '重新提交审核' : '提交申请'}</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

export default TalentSettlePage
