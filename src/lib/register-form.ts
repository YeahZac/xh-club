import Taro from '@tarojs/taro'
import { ensureLogin } from '@/lib/auth'
import { Network } from '@/network'

export type RegisterKind = 'event' | 'roadshow'

const unwrapRegisterDetail = (payload: unknown): Record<string, any> | null => {
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

/** 已报名：仅提示，不跳转 */
export const goMyRegistrationsIfRegistered = (registered: boolean, toast = '您已经报名该活动') => {
  if (!registered) return false
  Taro.showToast({ title: toast, icon: 'none' })
  return true
}

export interface RegisterFormField {
  label: string
  type: string
  required?: boolean
  reuse_last?: boolean
  options?: string[]
}

export const isRegisterNameField = (label: string) =>
  /姓名|真实姓名|名字|联系人/.test(String(label || ''))

export const isRegisterPhoneField = (label: string) =>
  /手机|电话|联系方式|联系电话/.test(String(label || ''))

export const isRegisterCompanyField = (label: string) =>
  /公司|单位|企业/.test(String(label || ''))

/** 与后端 RoadshowService.normalizeFormFields / 活动 form_fields 对齐 */
export const parseRegisterFormFields = (value: unknown): RegisterFormField[] => {
  if (!value) return []
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const label = String(row.label || row.name || '').trim()
      if (!label) return null
      const type = String(row.type || 'text').trim() || 'text'
      const field: RegisterFormField = {
        label,
        type,
        required: Boolean(row.required),
        reuse_last: Boolean(row.reuse_last),
      }
      if (type === 'select') {
        if (Array.isArray(row.options)) {
          field.options = row.options.map((opt) => String(opt).trim()).filter(Boolean)
        } else if (typeof row.options === 'string') {
          field.options = row.options.split(',').map((opt) => opt.trim()).filter(Boolean)
        }
      }
      return field
    })
    .filter(Boolean) as RegisterFormField[]
}

export const openRegisterPage = async (options: {
  kind: RegisterKind
  id: string | number
  title?: string
  tip?: string
}) => {
  const id = String(options.id || '').trim()
  if (!id) {
    Taro.showToast({ title: '报名目标无效', icon: 'none' })
    return false
  }
  if (!(await ensureLogin(options.tip || '请先登录后报名'))) return false

  try {
    const detailUrl =
      options.kind === 'roadshow' ? `/api/business/${id}` : `/api/events/${id}`
    const res = await Network.request({ url: detailUrl })
    const detail =
      unwrapRegisterDetail(res?.data?.data)
      || unwrapRegisterDetail(res?.data)
    if (goMyRegistrationsIfRegistered(Boolean(detail?.member_state?.is_registered))) {
      return false
    }
    if (options.kind === 'event') {
      const status = String(detail?.status || '')
      if (status === 'ended') {
        Taro.showToast({ title: '已结束', icon: 'none' })
        return false
      }
      if (status === 'full') {
        Taro.showToast({ title: '已满员', icon: 'none' })
        return false
      }
      if (detail?.member_state?.can_register === false) {
        const reason = detail?.member_state?.register_blocked_reason || '当前不可报名'
        Taro.showToast({ title: String(reason), icon: 'none' })
        return false
      }
    }
  } catch (error) {
    console.warn('[报名] 预检查报名状态失败，继续进入报名页', error)
  }

  const query = [
    `kind=${encodeURIComponent(options.kind)}`,
    `id=${encodeURIComponent(id)}`,
  ]
  if (options.title) {
    query.push(`title=${encodeURIComponent(options.title)}`)
  }
  await Taro.navigateTo({
    url: `/pages/register/index?${query.join('&')}`,
  })
  return true
}
