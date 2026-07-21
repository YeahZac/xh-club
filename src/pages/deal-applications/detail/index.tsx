import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { Banknote, CalendarDays, Camera, CircleUserRound, Percent, Trash2 } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { HeroHeader, PageShell, SoftCard } from '@/components/brand-ui'
import { chooseAndCompressImages } from '@/lib/compress-image'
import { ensureLogin } from '@/lib/auth'
import { isDisplayableImageUrl } from '@/lib/media-url'
import { Network } from '@/network'

interface DealDetail {
  id: string
  member_id: string | number
  owner_member_id: string | number
  project_name: string
  owner_name?: string
  member_name?: string
  deal_time: string
  contract_amount: number
  commission_rate: number
  contact_name: string
  deal_status_label: string
  cooperation_description?: string
  image_urls: string[]
  payment_proof_urls?: string[]
  audit_status: 'pending' | 'approved' | 'rejected'
  audit_status_label: string
  confirm_status_label?: string
  reject_reason?: string
  is_deal: boolean
  is_deal_label: string
  payment_status: 'paid' | 'unpaid'
  payment_status_label: string
  updated_at: string
}

const DealApplicationDetailPage = () => {
  const [detail, setDetail] = useState<DealDetail | null>(null)
  const [memberId, setMemberId] = useState('')
  const [acting, setActing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid')
  const [paymentProofUrls, setPaymentProofUrls] = useState<string[]>([])

  useLoad((params) => {
    const id = String(params?.id || '')
    void (async () => {
      if (!(await ensureLogin(''))) return
      setMemberId(String(Taro.getStorageSync('member_id') || ''))
      if (id) await loadDetail(id)
    })()
  })

  useEffect(() => {
    if (!detail) return
    setPaymentStatus(detail.payment_status === 'paid' ? 'paid' : 'unpaid')
    setPaymentProofUrls(Array.isArray(detail.payment_proof_urls) ? detail.payment_proof_urls : [])
  }, [detail?.id, detail?.payment_status, detail?.payment_proof_urls])

  const loadDetail = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/deal-applications/mine/${id}` })
      setDetail(res?.data?.data || null)
    } catch (error) {
      console.error('[成交申请详情] 加载失败:', error)
      Taro.showToast({ title: '详情加载失败', icon: 'none' })
    }
  }

  const isOwner = detail && String(detail.owner_member_id) === String(memberId)
  const isApplicant = detail && String(detail.member_id) === String(memberId)
  const canEditForm = isApplicant && detail?.payment_status !== 'paid'
  const canConfirm = isOwner && detail?.audit_status === 'pending'
  const canToggleDeal = detail?.audit_status === 'approved' && (isOwner || isApplicant)
  const canOwnerManagePayment = isOwner && detail?.audit_status === 'approved'

  const confirm = async (status: 'approved' | 'rejected') => {
    if (!detail) return
    if (!(await ensureLogin(''))) return
    let rejectReason = ''
    if (status === 'rejected') {
      const promptRes = await Taro.showModal({
        title: '拒绝原因',
        editable: true,
        placeholderText: '请填写拒绝原因',
      } as any)
      if (!promptRes.confirm) return
      rejectReason = String((promptRes as any).content || '').trim()
      if (!rejectReason) {
        Taro.showToast({ title: '请填写拒绝原因', icon: 'none' })
        return
      }
    } else {
      const ok = await Taro.showModal({ title: '确认同意该对接申请？' })
      if (!ok.confirm) return
    }
    try {
      setActing(true)
      const res = await Network.request({
        url: `/api/deal-applications/${detail.id}/confirm`,
        method: 'POST',
        data: { confirm_status: status, reject_reason: rejectReason },
      })
      if (res?.data?.code !== 200) {
        Taro.showToast({ title: res?.data?.msg || '操作失败', icon: 'none' })
        return
      }
      Taro.showToast({ title: status === 'approved' ? '已同意' : '已拒绝', icon: 'success' })
      await loadDetail(detail.id)
    } catch (error) {
      Taro.showToast({ title: (error as any)?.message || '操作失败', icon: 'none' })
    } finally {
      setActing(false)
    }
  }

  const updateDealStatus = async (patch: { is_deal?: boolean }) => {
    if (!detail) return
    try {
      setActing(true)
      const res = await Network.request({
        url: `/api/deal-applications/${detail.id}/status`,
        method: 'PUT',
        data: patch,
      })
      if (res?.data?.code !== 200) {
        Taro.showToast({ title: res?.data?.msg || '更新失败', icon: 'none' })
        return
      }
      setDetail(res.data.data)
      Taro.showToast({ title: '状态已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as any)?.message || '更新失败', icon: 'none' })
    } finally {
      setActing(false)
    }
  }

  const uploadPaymentProof = async () => {
    if (paymentProofUrls.length >= 5) {
      Taro.showToast({ title: '最多上传 5 张打款凭证', icon: 'none' })
      return
    }
    try {
      const paths = await chooseAndCompressImages({ count: 5 - paymentProofUrls.length })
      Taro.showLoading({ title: '上传中...' })
      const uploaded: string[] = []
      for (const filePath of paths) {
        const result = await Network.uploadFile({
          url: '/api/upload/member/image',
          filePath,
          name: 'file',
        })
        const parsed = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
        const url = parsed?.data?.canonicalUrl || parsed?.data?.url
        if (url) uploaded.push(url)
      }
      setPaymentProofUrls((current) => [...current, ...uploaded])
    } catch (error) {
      console.error('[成交申请详情] 打款凭证上传失败:', error)
      Taro.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const savePaymentInfo = async () => {
    if (!detail) return
    try {
      setActing(true)
      const res = await Network.request({
        url: `/api/deal-applications/${detail.id}/status`,
        method: 'PUT',
        data: {
          payment_status: paymentStatus,
          payment_proof_urls: paymentProofUrls,
        },
      })
      if (res?.data?.code !== 200) {
        Taro.showToast({ title: res?.data?.msg || '保存失败', icon: 'none' })
        return
      }
      setDetail(res.data.data)
      Taro.showToast({ title: '打款信息已保存', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as any)?.message || '保存失败', icon: 'none' })
    } finally {
      setActing(false)
    }
  }

  const previewImages = (urls: string[], current: string) => {
    const valid = urls.filter((url) => isDisplayableImageUrl(url))
    if (!valid.length) return
    Taro.previewImage({ current, urls: valid })
  }

  if (!detail) {
    return (
      <PageShell>
        <View className="flex items-center justify-center py-24">
          <Text className="block text-sm text-[#94A3B8]">加载中...</Text>
        </View>
      </PageShell>
    )
  }

  const displayProofUrls = canOwnerManagePayment
    ? paymentProofUrls
    : (detail.payment_proof_urls || [])

  return (
    <PageShell>
      <HeroHeader title="项目对接详情" subtitle={detail.project_name} compact />
      <View className="px-4 pb-28">
        <SoftCard className="mb-3 p-4">
          <View className="flex flex-row items-center justify-between">
            <Text className="block text-sm font-semibold text-[#10264A]">确认状态</Text>
            <Badge className={`px-2 py-0 text-xs ${detail.audit_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : detail.audit_status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
              {detail.confirm_status_label || detail.audit_status_label}
            </Badge>
          </View>
          <View className="mt-3 flex flex-row items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-3">
            <Text className="block text-xs text-[#64748B]">项目负责人</Text>
            <Text className="block text-sm font-semibold text-[#10264A]">{detail.owner_name || '-'}</Text>
          </View>
          <View className="mt-2 flex flex-row items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-3">
            <Text className="block text-xs text-[#64748B]">申请人</Text>
            <Text className="block text-sm font-semibold text-[#10264A]">{detail.member_name || '-'}</Text>
          </View>
          {detail.audit_status === 'rejected' && detail.reject_reason ? (
            <View className="mt-3 rounded-lg bg-red-50 px-3 py-3">
              <Text className="block text-xs leading-relaxed text-red-600">
                拒绝原因：{detail.reject_reason}
              </Text>
            </View>
          ) : null}
        </SoftCard>

        {canToggleDeal ? (
          <SoftCard className="mb-3 p-4">
            <Text className="mb-3 block text-sm font-semibold text-[#10264A]">成交状态</Text>
            <View className="flex flex-row items-center justify-between py-2">
              <Text className="block text-sm text-[#334155]">是否成交</Text>
              <Switch
                checked={!!detail.is_deal}
                disabled={acting}
                onCheckedChange={(checked) => void updateDealStatus({ is_deal: checked })}
              />
            </View>
          </SoftCard>
        ) : (
          <SoftCard className="mb-3 p-4">
            <View className="flex flex-row items-center justify-between">
              <Text className="block text-xs text-[#64748B]">是否成交</Text>
              <Text className="block text-sm font-semibold text-[#10264A]">{detail.is_deal_label}</Text>
            </View>
          </SoftCard>
        )}

        <SoftCard className="mb-3 p-4">
          <Text className="mb-3 block text-sm font-semibold text-[#10264A]">打款信息</Text>
          {canOwnerManagePayment ? (
            <View className="flex flex-col gap-3">
              <View>
                <Label className="mb-2 block text-xs text-[#64748B]">打款状态</Label>
                <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as 'paid' | 'unpaid')}>
                  <SelectTrigger className="h-11 w-full bg-[#F8FAFC]">
                    <SelectValue placeholder="请选择打款状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">未打款</SelectItem>
                    <SelectItem value="paid">已打款</SelectItem>
                  </SelectContent>
                </Select>
              </View>
              <View>
                <Text className="mb-2 block text-xs text-[#64748B]">打款凭证（申请人可见）</Text>
                <View className="grid grid-cols-3 gap-2">
                  {paymentProofUrls.map((url, index) => (
                    <View key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-[#EEF2F7]">
                      {isDisplayableImageUrl(url) ? (
                        <Image
                          src={url}
                          mode="aspectFill"
                          className="h-full w-full"
                          onClick={() => previewImages(paymentProofUrls, url)}
                        />
                      ) : null}
                      <View
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black bg-opacity-50"
                        onClick={() => setPaymentProofUrls((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={12} color="#ffffff" />
                      </View>
                    </View>
                  ))}
                  {paymentProofUrls.length < 5 ? (
                    <View
                      className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC]"
                      onClick={() => void uploadPaymentProof()}
                    >
                      <Camera size={22} color="#64748B" />
                    </View>
                  ) : null}
                </View>
              </View>
              <Button
                className="w-full rounded-xl bg-[#2457A7] text-white"
                disabled={acting}
                onClick={() => void savePaymentInfo()}
              >
                <Text className="block">保存打款信息</Text>
              </Button>
            </View>
          ) : (
            <View>
              <View className="flex flex-row items-center justify-between">
                <Text className="block text-xs text-[#64748B]">打款状态</Text>
                <Text className={`block text-sm font-semibold ${detail.payment_status === 'paid' ? 'text-[#2457A7]' : 'text-[#64748B]'}`}>
                  {detail.payment_status_label}
                </Text>
              </View>
              {displayProofUrls.length > 0 ? (
                <View className="mt-3 grid grid-cols-3 gap-2">
                  {displayProofUrls.map((url, index) => (
                    <View key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-lg bg-[#EEF2F7]">
                      {isDisplayableImageUrl(url) ? (
                        <Image
                          src={url}
                          mode="aspectFill"
                          className="h-full w-full"
                          onClick={() => previewImages(displayProofUrls, url)}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="mt-2 block text-xs text-[#94A3B8]">暂无打款凭证</Text>
              )}
            </View>
          )}
        </SoftCard>

        <SoftCard className="mb-3 p-4">
          <Text className="block text-base font-semibold text-[#10264A]">{detail.project_name}</Text>
          <View className="mt-4 flex flex-col gap-3">
            <View className="flex flex-row items-center">
              <CalendarDays size={16} color="#64748B" />
              <Text className="ml-2 block flex-1 text-sm text-[#64748B]">成交时间</Text>
              <Text className="block text-sm font-medium text-[#10264A]">{detail.deal_time}</Text>
            </View>
            <View className="flex flex-row items-center">
              <Banknote size={16} color="#64748B" />
              <Text className="ml-2 block flex-1 text-sm text-[#64748B]">合同金额</Text>
              <Text className="block text-sm font-medium text-[#10264A]">
                ¥{Number(detail.contract_amount || 0).toLocaleString()}
              </Text>
            </View>
            <View className="flex flex-row items-center">
              <Percent size={16} color="#64748B" />
              <Text className="ml-2 block flex-1 text-sm text-[#64748B]">分成比例</Text>
              <Text className="block text-sm font-medium text-[#10264A]">{detail.commission_rate}%</Text>
            </View>
            <View className="flex flex-row items-center">
              <CircleUserRound size={16} color="#64748B" />
              <Text className="ml-2 block flex-1 text-sm text-[#64748B]">对接人</Text>
              <Text className="block text-sm font-medium text-[#10264A]">{detail.contact_name}</Text>
            </View>
            <View className="flex flex-row items-center">
              <Text className="block flex-1 text-sm text-[#64748B]">对接状态</Text>
              <Badge className="bg-[#EAF0FA] px-2 py-0 text-xs text-[#2457A7]">
                {detail.deal_status_label}
              </Badge>
            </View>
          </View>
        </SoftCard>

        {detail.cooperation_description ? (
          <SoftCard className="mb-3 p-4">
            <Text className="mb-2 block text-sm font-semibold text-[#10264A]">合作描述</Text>
            <Text className="block whitespace-pre-wrap text-sm leading-relaxed text-[#64748B]">
              {detail.cooperation_description}
            </Text>
          </SoftCard>
        ) : null}

        {Array.isArray(detail.image_urls) && detail.image_urls.length ? (
          <SoftCard className="mb-3 p-4">
            <Text className="mb-3 block text-sm font-semibold text-[#10264A]">申请图片</Text>
            <View className="grid grid-cols-3 gap-2">
              {detail.image_urls.map((url, index) => (
                <View key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-lg bg-[#EEF2F7]">
                  {isDisplayableImageUrl(url) ? (
                    <Image
                      src={url}
                      mode="aspectFill"
                      className="h-full w-full"
                      onClick={() => previewImages(detail.image_urls, url)}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </SoftCard>
        ) : null}
      </View>

      {(canConfirm || canEditForm) && (
        <View
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #E5E7EB',
            zIndex: 100,
          }}
        >
          {canConfirm ? (
            <>
              <View style={{ flex: 1 }}>
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  disabled={acting}
                  onClick={() => void confirm('rejected')}
                >
                  <Text className="block">拒绝</Text>
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  className="w-full rounded-xl bg-[#2457A7] text-white"
                  disabled={acting}
                  onClick={() => void confirm('approved')}
                >
                  <Text className="block">同意</Text>
                </Button>
              </View>
            </>
          ) : null}
          {canEditForm && !canConfirm ? (
            <View style={{ flex: 1 }}>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() =>
                  Taro.navigateTo({ url: `/pages/deal-applications/form/index?id=${detail.id}` })
                }
              >
                <Text className="block">修改申请信息</Text>
              </Button>
            </View>
          ) : null}
        </View>
      )}
    </PageShell>
  )
}

export default DealApplicationDetailPage
