import { queryOne, queryRows } from '@/storage/database/mysql-client'

export interface FormFieldLike {
  label: string
  type?: string
  required?: boolean
  reuse_last?: boolean
  options?: string[]
}

export function parseFormAnswers(value: unknown): Record<string, unknown> {
  if (value == null || value === '') return {}
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return {}
    }
  }
  if (Array.isArray(parsed)) {
    const mapped: Record<string, unknown> = {}
    parsed.forEach((item) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const label = String(row.label || row.name || '').trim()
      if (!label) return
      mapped[label] = row.value ?? ''
    })
    return mapped
  }
  if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  return {}
}

export function normalizeRegisterFormFields(value: unknown): FormFieldLike[] {
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
      const field: FormFieldLike = {
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
    .filter(Boolean) as FormFieldLike[]
}

/** 按字段 label 从该会员历史报名中取最近一次非空值，仅处理 reuse_last=true 的字段 */
export async function resolveReuseFormDefaults(
  memberId: string | number,
  fields: FormFieldLike[] | null | undefined,
  source: 'event' | 'roadshow',
): Promise<Record<string, string>> {
  if (!memberId || !fields?.length) return {}
  const labels = fields.filter((f) => f.reuse_last).map((f) => f.label).filter(Boolean)
  if (!labels.length) return {}

  const sql =
    source === 'event'
      ? `SELECT form_answers FROM event_registrations
         WHERE member_id = ? AND form_answers IS NOT NULL AND form_answers != ''
         ORDER BY created_at DESC LIMIT 40`
      : `SELECT form_answers FROM roadshow_registrations
         WHERE member_id = ? AND form_answers IS NOT NULL AND form_answers != ''
         ORDER BY created_at DESC LIMIT 40`

  let rows: Array<{ form_answers?: unknown }> = []
  try {
    rows = (await queryRows(sql, [memberId])) as Array<{ form_answers?: unknown }>
  } catch (error) {
    console.warn('[form-defaults] load history failed', source, error)
    return {}
  }

  const defaults: Record<string, string> = {}
  const pending = new Set(labels)
  for (const row of rows) {
    if (!pending.size) break
    const answers = parseFormAnswers(row.form_answers)
    for (const label of [...pending]) {
      const raw = answers[label]
      if (raw == null) continue
      const text = String(raw).trim()
      if (!text) continue
      defaults[label] = text
      pending.delete(label)
    }
  }
  return defaults
}

const isNameFieldLabel = (label: string) => /姓名|真实姓名|名字|联系人/.test(label)
const isPhoneFieldLabel = (label: string) => /手机|电话|联系方式|联系电话/.test(label)
const isCompanyFieldLabel = (label: string) => /公司|单位|企业/.test(label)

/** 人才入驻资料：按字段名自动带入姓名 / 电话 / 公司 */
export async function resolveTalentFormDefaults(
  memberId: string | number,
  fields: FormFieldLike[] | null | undefined,
): Promise<Record<string, string>> {
  if (!memberId || !fields?.length) return {}
  let row: { real_name?: string; contact?: string; company_name?: string } | null = null
  try {
    // 优先已通过，否则取最近一次填写记录
    row = await queryOne(
      `SELECT real_name, contact, company_name FROM talent_applications
       WHERE member_id = ?
       ORDER BY CASE WHEN status = 'approved' THEN 0 ELSE 1 END, id DESC
       LIMIT 1`,
      [memberId],
    )
  } catch (error) {
    console.warn('[form-defaults] load talent failed', error)
    return {}
  }
  if (!row) return {}

  const realName = String(row.real_name || '').trim()
  const contact = String(row.contact || '').trim()
  const companyName = String(row.company_name || '').trim()
  if (!realName && !contact && !companyName) return {}

  const defaults: Record<string, string> = {}
  for (const field of fields) {
    const label = String(field.label || '').trim()
    if (!label) continue
    if (realName && isNameFieldLabel(label)) defaults[label] = realName
    if (contact && isPhoneFieldLabel(label)) defaults[label] = contact
    if (companyName && isCompanyFieldLabel(label)) defaults[label] = companyName
  }
  return defaults
}

/** 历史沿用 + 人才入驻预填（人才字段优先） */
export async function resolveRegisterFormDefaults(
  memberId: string | number,
  fields: FormFieldLike[] | null | undefined,
  source: 'event' | 'roadshow',
): Promise<{ defaults: Record<string, string>; talentDefaults: Record<string, string> }> {
  const [reuse, talent] = await Promise.all([
    resolveReuseFormDefaults(memberId, fields, source),
    resolveTalentFormDefaults(memberId, fields),
  ])
  return {
    defaults: { ...reuse, ...talent },
    talentDefaults: talent,
  }
}

export function assertRequiredFormAnswers(
  fields: FormFieldLike[] | null | undefined,
  answers: Record<string, unknown> | null | undefined,
): void {
  if (!fields?.length) return
  const payload = answers || {}
  for (const field of fields) {
    if (!field.required) continue
    const value = payload[field.label]
    if (value == null || String(value).trim() === '') {
      throw new Error(`请填写${field.label}`)
    }
  }
}
