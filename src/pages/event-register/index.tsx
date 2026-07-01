import { useState, useCallback } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Calendar, MapPin, Clock, CloudRain, TrainFront, Sparkles, Handshake, Star } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'

/* ── 性别选项 ── */
const GENDER_OPTIONS = ['男', '女']

/* ── 行业选项 ── */
const INDUSTRY_OPTIONS = [
  '科技/互联网', '金融/投资', '房地产/建筑', '制造业',
  '教育培训', '医疗健康', '文化传媒', '商贸流通',
  '餐饮酒店', '法律/咨询', '物流运输', '环保/新能源',
  '农业/食品', '政府/协会', '其他'
]

/* ── 年龄计算 ── */
function calcAge(birthday: string): number {
  if (!birthday) return 0
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return Math.max(0, age)
}

/* ── 日期格式化 ── */
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function EventRegister() {
  const [form, setForm] = useState({
    name: '',
    gender: '',
    birthday: '',
    industry: '',
    phone: '',
    contactMethod: '',
    referrer: '',
  })
  const [age, setAge] = useState<number | null>(null)
  const [genderIdx, setGenderIdx] = useState(0)
  const [industryIdx, setIndustryIdx] = useState(0)
  const [datePick, setDatePick] = useState('1990-01-01')
  const [submitting, setSubmitting] = useState(false)

  const updateField = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const onBirthdayChange = useCallback((e) => {
    const val = e.detail.value
    setDatePick(val)
    const formatted = formatDate(val)
    updateField('birthday', formatted)
    setAge(calcAge(val))
  }, [updateField])

  const onGenderChange = useCallback((e) => {
    const idx = Number(e.detail.value) || 0
    setGenderIdx(idx)
    updateField('gender', GENDER_OPTIONS[idx])
  }, [updateField])

  const onIndustryChange = useCallback((e) => {
    const idx = Number(e.detail.value) || 0
    setIndustryIdx(idx)
    updateField('industry', INDUSTRY_OPTIONS[idx])
  }, [updateField])

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!form.gender) {
      Taro.showToast({ title: '请选择性别', icon: 'none' })
      return
    }
    if (!form.birthday) {
      Taro.showToast({ title: '请选择生日', icon: 'none' })
      return
    }
    if (!form.industry) {
      Taro.showToast({ title: '请选择行业', icon: 'none' })
      return
    }
    if (!form.phone.trim()) {
      Taro.showToast({ title: '请输入电话', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await Network.request({
        url: '/api/event-registration',
        method: 'POST',
        data: {
          name: form.name.trim(),
          gender: form.gender,
          birthday: form.birthday,
          age: age ?? calcAge(form.birthday),
          industry: form.industry,
          phone: form.phone.trim(),
          contact_method: form.contactMethod.trim(),
          referrer: form.referrer.trim(),
        }
      })
      console.log('报名提交响应:', res.data)

      if (res.statusCode === 200 && res.data?.code === 200) {
        Taro.showToast({ title: '报名成功！', icon: 'success' })
        setForm({ name: '', gender: '', birthday: '', industry: '', phone: '', contactMethod: '', referrer: '' })
        setAge(null)
        setGenderIdx(0)
        setIndustryIdx(0)
      } else {
        Taro.showToast({ title: res.data?.msg || '报名失败，请重试', icon: 'none' })
      }
    } catch (err) {
      console.error('报名提交异常:', err)
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [form, age])

  return (
    <View className="min-h-screen bg-[#F5F6FA]">
      {/* ── Hero 区 ── */}
      <View className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #2D4A7A 50%, #1B2A4A 100%)' }}>
        {/* 星芒装饰 */}
        <View className="absolute top-4 right-8 opacity-20" style={{ opacity: 0.2 }}>
          <Sparkles size={60} color="#C9A96E" />
        </View>
        <View className="absolute bottom-8 left-4" style={{ opacity: 0.15 }}>
          <Star size={40} color="#E8D5A8" />
        </View>
        <View className="px-5 pt-10 pb-8">
          <View className="flex flex-row items-center gap-2 mb-3">
            <View style={{ width: '4px', height: '22px', borderRadius: '2px', background: 'linear-gradient(180deg, #C9A96E, #E8D5A8)' }} />
            <Text className="block text-white text-xl font-bold">星河平台俱乐部</Text>
          </View>
          <Text className="block text-[#E8D5A8] text-base font-semibold mb-3">高端资源整合 · 商业链接平台</Text>
          <Text className="block text-white text-sm leading-relaxed" style={{ opacity: 0.8 }}>
            星河平台俱乐部汇聚各行业精英，致力于搭建高端资源整合与商业链接的桥梁。我们通过精准的圈层对接、深度行业交流、优质项目孵化，为会员创造无限商业可能。星河之上，共启未来。
          </Text>
        </View>
        {/* 底部金色渐变线 */}
        <View style={{ height: '3px', background: 'linear-gradient(90deg, #C9A96E, #E8D5A8, #C9A96E)' }} />
      </View>

      <View className="px-4 pt-4 pb-8">
        {/* ── 会议信息卡片 ── */}
        <Card className="mb-3 border-none shadow-md">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-4">
              <Handshake size={20} color="#C9A96E" />
              <Text className="block text-base font-semibold text-[#1A1D2E]">活动邀约</Text>
            </View>

            {/* 时间 */}
            <View className="flex flex-row items-start gap-3 mb-3">
              <View className="mt-1"><Clock size={18} color="#1B2A4A" /></View>
              <View className="flex-1">
                <Text className="block text-sm font-semibold text-[#1A1D2E]">会议时间</Text>
                <Text className="block text-sm text-gray-500">周六 7月4日 14:00 — 17:30</Text>
              </View>
            </View>

            {/* 地点 */}
            <View className="flex flex-row items-start gap-3 mb-3">
              <View className="mt-1"><MapPin size={18} color="#1B2A4A" /></View>
              <View className="flex-1">
                <Text className="block text-sm font-semibold text-[#1A1D2E]">会议地点</Text>
                <Text className="block text-sm text-gray-500 leading-relaxed">洗刷刷环保科技有限公司</Text>
                <Text className="block text-xs text-gray-400 leading-relaxed">深圳市宝安区福海街道新和社区富桥三区二期厂房A1三层</Text>
              </View>
            </View>

            {/* 地铁指引 */}
            <View className="flex flex-row items-start gap-3">
              <View className="mt-1"><TrainFront size={18} color="#1B2A4A" /></View>
              <View className="flex-1">
                <Text className="block text-sm font-semibold text-[#1A1D2E]">地铁指引</Text>
                <Text className="block text-sm text-gray-500">地铁11号线 碧海湾站 B出口</Text>
                <Text className="block text-xs text-gray-400">出站后步行约10分钟或打车5分钟即达</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* ── 天气提醒 ── */}
        <View className="flex flex-row items-center gap-2 rounded-xl px-4 py-3 mb-3" style={{ backgroundColor: '#FFFBEB' }}>
          <CloudRain size={18} color="#F59E0B" />
          <Text className="block text-sm text-amber-700">近期天气多变，请记得带好雨伞</Text>
        </View>

        {/* ── 报名表单 ── */}
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <View className="flex flex-row items-center gap-2 mb-4">
              <Calendar size={20} color="#C9A96E" />
              <Text className="block text-base font-semibold text-[#1A1D2E]">填写报名信息</Text>
            </View>

            {/* 姓名 */}
            <View className="mb-3">
              <Text className="block text-sm font-medium text-[#1A1D2E] mb-1">姓名 <Text className="text-red-500">*</Text></Text>
              <View className="bg-gray-50 rounded-xl px-4 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入您的姓名"
                  value={form.name}
                  onInput={(e) => updateField('name', e.detail.value)}
                />
              </View>
            </View>

            {/* 性别 */}
            <View className="mb-3">
              <Text className="block text-sm font-medium text-[#1A1D2E] mb-1">性别 <Text className="text-red-500">*</Text></Text>
              <Picker mode="selector" range={GENDER_OPTIONS} value={genderIdx} onChange={onGenderChange}>
                <View className="bg-gray-50 rounded-xl px-4 py-2 flex flex-row items-center justify-between">
                  <Text className={`text-sm ${form.gender ? 'text-[#1A1D2E]' : 'text-gray-400'}`}>
                    {form.gender || '请选择性别'}
                  </Text>
                </View>
              </Picker>
            </View>

            {/* 生日 */}
            <View className="mb-3">
              <Text className="block text-sm font-medium text-[#1A1D2E] mb-1">生日 <Text className="text-red-500">*</Text></Text>
              <Picker mode="date" value={datePick} start="1940-01-01" end="2010-12-31" onChange={onBirthdayChange}>
                <View className="bg-gray-50 rounded-xl px-4 py-2 flex flex-row items-center justify-between">
                  <Text className={`text-sm ${form.birthday ? 'text-[#1A1D2E]' : 'text-gray-400'}`}>
                    {form.birthday || '请选择生日'}
                  </Text>
                  {age !== null && age > 0 && (
                    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: '#FFF8EB' }}>
                      <Text className="text-xs text-[#C9A96E]">{age}岁</Text>
                    </View>
                  )}
                </View>
              </Picker>
            </View>

            {/* 行业 */}
            <View className="mb-3">
              <Text className="block text-sm font-medium text-[#1A1D2E] mb-1">行业 <Text className="text-red-500">*</Text></Text>
              <Picker mode="selector" range={INDUSTRY_OPTIONS} value={industryIdx} onChange={onIndustryChange}>
                <View className="bg-gray-50 rounded-xl px-4 py-2 flex flex-row items-center justify-between">
                  <Text className={`text-sm ${form.industry ? 'text-[#1A1D2E]' : 'text-gray-400'}`}>
                    {form.industry || '请选择行业'}
                  </Text>
                </View>
              </Picker>
            </View>

            {/* 电话 */}
            <View className="mb-3">
              <Text className="block text-sm font-medium text-[#1A1D2E] mb-1">电话 <Text className="text-red-500">*</Text></Text>
              <View className="bg-gray-50 rounded-xl px-4 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  type="number"
                  placeholder="请输入您的电话号码"
                  value={form.phone}
                  onInput={(e) => updateField('phone', e.detail.value)}
                />
              </View>
            </View>

            {/* 联系方式 */}
            <View className="mb-3">
              <Text className="block text-sm font-medium text-[#1A1D2E] mb-1">联系方式</Text>
              <View className="bg-gray-50 rounded-xl px-4 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="微信号或其他联系方式"
                  value={form.contactMethod}
                  onInput={(e) => updateField('contactMethod', e.detail.value)}
                />
              </View>
            </View>

            {/* 引荐人 */}
            <View className="mb-5">
              <Text className="block text-sm font-medium text-[#1A1D2E] mb-1">引荐人</Text>
              <View className="bg-gray-50 rounded-xl px-4 py-2">
                <Input
                  className="w-full bg-transparent text-sm"
                  placeholder="请输入引荐人姓名（选填）"
                  value={form.referrer}
                  onInput={(e) => updateField('referrer', e.detail.value)}
                />
              </View>
            </View>

            {/* 提交按钮 */}
            <Button
              className="w-full h-11 rounded-xl text-base font-semibold"
              style={{ background: 'linear-gradient(90deg, #C9A96E, #E8D5A8)', color: '#fff' }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '提交中...' : '立即报名'}
            </Button>
          </CardContent>
        </Card>

        {/* ── 底部信息 ── */}
        <View className="mt-4 flex flex-col items-center">
          <Text className="block text-xs text-gray-400 text-center">星河平台俱乐部 · 期待您的莅临</Text>
          <Text className="block text-xs text-gray-300 mt-1 text-center">报名信息仅管理员可见，请放心填写</Text>
        </View>
      </View>
    </View>
  )
}
