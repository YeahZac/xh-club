import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HeroHeader, PageShell, SoftCard, FieldWell, FixedBottomBar, ui } from '@/components/brand-ui'
import { Network } from '@/network'
import { ensureLogin, isLoggedIn } from '@/lib/auth'
import {
  parseRegisterFormFields,
  type RegisterFormField,
  type RegisterKind,
} from '@/lib/register-form'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<RegisterKind, string> = {
  event: '活动报名',
  roadshow: '路演报名',
}

const unwrapDetail = (payload: unknown): Record<string, any> | null => {
  let current: unknown = payload
  for (let i = 0; i < 3; i += 1) {
    if (!current || typeof current !== 'object') return null
    const obj = current as Record<string, any>
    if (obj.title || obj.name || obj.form_fields || obj.member_state) return obj
    if ('data' in obj) {
      current = obj.data
      continue
    }
    return obj
  }
  return null
}

const RegisterPage = () => {
  const [kind, setKind] = useState<RegisterKind>('event')
  const [targetId, setTargetId] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fields, setFields] = useState<RegisterFormField[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [lockedLabels, setLockedLabels] = useState<string[]>([])
  const [meta, setMeta] = useState<Record<string, any> | null>(null)

  const pageTitle = useMemo(
    () => title || KIND_LABEL[kind] || '报名',
    [title, kind],
  )

  const loadTarget = async (nextKind: RegisterKind, id: string, fallbackTitle?: string) => {
    setLoading(true)
    try {
      if (!isLoggedIn() && !(await ensureLogin('请先登录后报名'))) {
        Taro.navigateBack({ fail: () => undefined })
        return
      }

      const url =
        nextKind === 'roadshow'
          ? `/api/business/${id}`
          : `/api/events/${id}`
      const res = await Network.request({ url })
      const detail = unwrapDetail(res?.data) || unwrapDetail(res?.data?.data)
      if (!detail) {
        Taro.showToast({ title: '报名信息不存在', icon: 'none' })
        return
      }

      const nextFields = parseRegisterFormFields(detail.form_fields)
      const defaultsRaw = detail.form_defaults
      const talentDefaultsRaw = detail.talent_defaults
      const defaults: Record<string, string> = {}
      const talentDefaults: Record<string, string> = {}
      if (defaultsRaw && typeof defaultsRaw === 'object' && !Array.isArray(defaultsRaw)) {
        Object.entries(defaultsRaw as Record<string, unknown>).forEach(([key, value]) => {
          if (value == null) return
          const text = String(value).trim()
          if (text) defaults[key] = text
        })
      }
      if (talentDefaultsRaw && typeof talentDefaultsRaw === 'object' && !Array.isArray(talentDefaultsRaw)) {
        Object.entries(talentDefaultsRaw as Record<string, unknown>).forEach(([key, value]) => {
          if (value == null) return
          const text = String(value).trim()
          if (text) talentDefaults[key] = text
        })
      }
      const initialAnswers: Record<string, string> = {}
      const locked: string[] = []
      nextFields.forEach((field) => {
        const fromTalent = talentDefaults[field.label]
        if (fromTalent) {
          initialAnswers[field.label] = fromTalent
          locked.push(field.label)
          return
        }
        const preset = defaults[field.label]
        if (preset && field.reuse_last) {
          initialAnswers[field.label] = preset
        }
      })

      setMeta(detail)
      setFields(nextFields)
      setAnswers(initialAnswers)
      setLockedLabels(locked)
      setTitle(
        String(
          fallbackTitle
          || detail.title
          || detail.name
          || KIND_LABEL[nextKind],
        ),
      )
      Taro.setNavigationBarTitle({
        title: nextKind === 'roadshow' ? '路演报名' : '活动报名',
      })

      if (nextKind === 'roadshow' && detail.member_state && detail.member_state.can_register === false) {
        Taro.showToast({ title: '当前不可报名', icon: 'none' })
      }
      if (nextKind === 'event') {
        const status = String(detail.status || '')
        if (status === 'ended') Taro.showToast({ title: '已结束', icon: 'none' })
        else if (status === 'full') Taro.showToast({ title: '已满员', icon: 'none' })
        else if (detail.member_state && detail.member_state.can_register === false) {
          Taro.showToast({
            title: String(detail.member_state.register_blocked_reason || '当前不可报名'),
            icon: 'none',
          })
        }
      }
    } catch (error) {
      console.error('[报名页] 加载失败:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useLoad((query) => {
    const nextKind = (String(query?.kind || 'event') === 'roadshow' ? 'roadshow' : 'event') as RegisterKind
    const id = String(query?.id || '').trim()
    const fallbackTitle = query?.title ? decodeURIComponent(String(query.title)) : ''
    setKind(nextKind)
    setTargetId(id)
    if (!id) {
      setLoading(false)
      Taro.showToast({ title: '报名参数无效', icon: 'none' })
      return
    }
    void loadTarget(nextKind, id, fallbackTitle)
  })

  const setAnswer = (label: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [label]: value }))
  }

  const validate = () => {
    for (const field of fields) {
      if (field.required && !String(answers[field.label] || '').trim()) {
        Taro.showToast({ title: `请填写${field.label}`, icon: 'none' })
        return false
      }
    }
    return true
  }

  const alreadyRegistered = Boolean(meta?.member_state?.is_registered)
  const eventStatus = kind === 'event' ? String(meta?.status || '') : ''
  const registerBlocked =
    alreadyRegistered
    || (kind === 'roadshow' && meta?.member_state?.can_register === false)
    || eventStatus === 'ended'
    || eventStatus === 'full'
    || (kind === 'event' && meta?.member_state?.can_register === false)
  const submitLabel = alreadyRegistered
    ? '已报名'
    : eventStatus === 'ended'
      ? '已结束'
      : eventStatus === 'full'
        ? '已满员'
        : submitting
          ? '提交中...'
          : '提交报名'

  const handleSubmit = async () => {
    if (!targetId || alreadyRegistered) return
    if (!validate()) return
    if (!(await ensureLogin('请先登录后报名'))) return
    if (kind === 'roadshow' && meta?.member_state && meta.member_state.can_register === false) {
      Taro.showToast({ title: '当前不可报名', icon: 'none' })
      return
    }
    if (kind === 'event') {
      const status = String(meta?.status || '')
      if (status === 'ended') {
        Taro.showToast({ title: '已结束', icon: 'none' })
        return
      }
      if (status === 'full') {
        Taro.showToast({ title: '已满员', icon: 'none' })
        return
      }
      if (meta?.member_state && meta.member_state.can_register === false) {
        Taro.showToast({
          title: String(meta.member_state.register_blocked_reason || '当前不可报名'),
          icon: 'none',
        })
        return
      }
    }

    setSubmitting(true)
    try {
      const payloadAnswers =
        fields.length > 0
          ? Object.fromEntries(
            fields.map((field) => [field.label, String(answers[field.label] || '').trim()]),
          )
          : {}

      const res = await Network.request({
        url: kind === 'roadshow'
          ? `/api/business/${targetId}/register`
          : `/api/events/${targetId}/register`,
        method: 'POST',
        data: {
          form_answers: Object.keys(payloadAnswers).length ? payloadAnswers : undefined,
        },
      })
      const ok = res?.data?.code === 200
      const failMsg = String(res?.data?.msg || '报名失败')
      if (!ok && /已报名|已经报名/.test(failMsg)) {
        setMeta((prev) => (
          prev
            ? { ...prev, member_state: { ...(prev.member_state || {}), is_registered: true } }
            : prev
        ))
        Taro.showToast({ title: '您已经报名', icon: 'none' })
        return
      }
      Taro.showToast({
        title: ok ? '报名成功' : failMsg.slice(0, 40),
        icon: ok ? 'success' : 'none',
      })
      if (ok) {
        setTimeout(() => {
          Taro.navigateBack({ fail: () => undefined })
        }, 600)
      }
    } catch (error) {
      console.error('[报名页] 提交失败:', error)
      const msg =
        (error as any)?.message && /[\u4e00-\u9fff]/.test(String((error as any).message))
          ? String((error as any).message)
          : '报名失败，请稍后重试'
      if (/已报名|已经报名/.test(msg)) {
        setMeta((prev) => (
          prev
            ? { ...prev, member_state: { ...(prev.member_state || {}), is_registered: true } }
            : prev
        ))
        Taro.showToast({ title: '您已经报名', icon: 'none' })
      } else {
        Taro.showToast({ title: msg.slice(0, 40), icon: 'none' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <View className="flex min-h-screen items-center justify-center">
          <Text className="block text-sm text-muted-foreground">加载报名信息...</Text>
        </View>
      </PageShell>
    )
  }

  return (
    <PageShell scroll={false}>
      <ScrollView scrollY className="h-screen" style={{ height: '100vh' }}>
        <View className="pb-28">
          <HeroHeader
            eyebrow={KIND_LABEL[kind]}
            title={pageTitle}
            subtitle={fields.length > 0
              ? '请按后台配置的报名字段填写信息，带 * 为必填项。'
              : '当前无需额外信息，确认后即可完成报名。'}
            compact
          />
          <View className="px-4">
          <SoftCard className="mb-4 px-5 py-5">
            <Text className={cn(ui.cardTitle)}>报名说明</Text>
            <Text className={cn('mt-1', ui.caption)}>
              {fields.length > 0
                ? '请按后台配置的报名字段填写信息，带 * 为必填项'
                : '当前无需额外信息，确认后即可完成报名'}
            </Text>
            {meta?.member_state?.is_registered ? (
              <Text className="mt-2 block text-xs text-accent-foreground">
                {kind === 'roadshow' ? '您已报名本场路演' : '您已报名该活动'}
              </Text>
            ) : null}
          </SoftCard>

          {fields.length > 0 ? (
            <SoftCard className="flex flex-col gap-4 px-5 py-5">
              {fields.map((field) => {
                const value = answers[field.label] || ''
                const options = field.options || []
                const locked = lockedLabels.includes(field.label)
                return (
                  <View key={field.label} className="flex flex-col gap-2">
                    <Label>
                      <Text className={ui.label}>
                        {field.label}
                        {field.required ? ' *' : ''}
                        {locked ? '（已入驻）' : ''}
                      </Text>
                    </Label>

                    {locked ? (
                      <FieldWell className="mt-2 bg-muted">
                        <Text className="block text-sm text-foreground">{value}</Text>
                        <Text className="mt-1 block text-xs text-muted-foreground">来自人才入驻，不可修改</Text>
                      </FieldWell>
                    ) : field.type === 'textarea' ? (
                      <FieldWell className="mt-2">
                        <Textarea
                          className="w-full bg-transparent text-sm text-foreground"
                          style={{ width: '100%', minHeight: '96px', backgroundColor: 'transparent' }}
                          placeholder={`请输入${field.label}`}
                          value={value}
                          maxlength={500}
                          onInput={(e) => setAnswer(field.label, e.detail.value || '')}
                        />
                      </FieldWell>
                    ) : field.type === 'select' ? (
                      <Picker
                        mode="selector"
                        range={options.length ? options : ['暂无选项']}
                        disabled={!options.length}
                        onChange={(e) => {
                          const idx = Number(e.detail.value)
                          if (!options.length || Number.isNaN(idx)) return
                          setAnswer(field.label, options[idx] || '')
                        }}
                      >
                        <FieldWell className="mt-2">
                          <Text className={`block text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {value || (options.length ? `请选择${field.label}` : '暂无选项')}
                          </Text>
                        </FieldWell>
                      </Picker>
                    ) : (
                      <FieldWell className="mt-2">
                        <Input
                          variant="ghost"
                          type={field.type === 'number' ? 'digit' : 'text'}
                          placeholder={`请输入${field.label}`}
                          value={value}
                          onInput={(e) => setAnswer(field.label, e.detail.value || '')}
                        />
                      </FieldWell>
                    )}
                  </View>
                )
              })}
            </SoftCard>
          ) : (
            <SoftCard className="px-5 py-8">
              <Text className="block text-center text-sm text-muted-foreground">确认报名后将使用您的会员信息登记</Text>
            </SoftCard>
          )}
          </View>
        </View>
      </ScrollView>

      <FixedBottomBar>
        <View className="flex-1">
          <Button
            variant="outline"
            className="h-11 w-full rounded-2xl"
            onClick={() => Taro.navigateBack({ fail: () => undefined })}
          >
            <Text>取消</Text>
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant={registerBlocked ? 'secondary' : 'brand'}
            size="lg"
            className="h-11 w-full rounded-2xl"
            disabled={submitting || alreadyRegistered || eventStatus === 'full' || (kind === 'roadshow' && meta?.member_state?.can_register === false)}
            onClick={() => {
              if (eventStatus === 'ended') {
                Taro.showToast({ title: '已结束', icon: 'none' })
                return
              }
              void handleSubmit()
            }}
          >
            <Text className={registerBlocked ? 'text-muted-foreground' : 'text-primary-foreground'}>
              {submitLabel}
            </Text>
          </Button>
        </View>
      </FixedBottomBar>
    </PageShell>
  )
}

export default RegisterPage
