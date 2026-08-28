import { isFullHtmlDocument } from '@/lib/rich-html'

export interface TalentApplicationPrefill {
  id?: string | number
  real_name?: string
  contact?: string
  company_name?: string
  job_title?: string
  photo_url?: string
  avatar_url?: string
  card_image_url?: string
  industry_tags?: string[]
  experience?: string
  status?: 'pending' | 'approved' | 'rejected' | string
  apply_type?: 'promoter' | 'member_unit' | string | null
  payment_status?: 'paid' | 'unpaid' | string | null
  payment_method?: string | null
}

export const normalizeTalentExperience = (raw?: string | null): string => {
  const exp = String(raw || '')
  if (!exp) return ''
  if (isFullHtmlDocument(exp) || /<[a-z][\s\S]*>/i.test(exp)) return ''
  return exp
}

export const buildTalentFormPrefill = (
  mine: TalentApplicationPrefill | null | undefined,
  opts?: { forcedPhone?: string },
) => {
  if (!mine?.id) return null

  const applyType = mine.apply_type === 'member_unit'
    ? 'member_unit' as const
    : mine.apply_type === 'promoter'
      ? 'promoter' as const
      : undefined

  const paymentStatus = mine.payment_status === 'paid'
    ? 'paid' as const
    : mine.payment_status === 'unpaid'
      ? 'unpaid' as const
      : undefined

  const paymentMethod = ['offline', 'wechat', 'bank'].includes(String(mine.payment_method || ''))
    ? String(mine.payment_method)
    : undefined

  return {
    realName: String(mine.real_name || '').trim(),
    contact: String(opts?.forcedPhone || mine.contact || '').trim(),
    companyName: String(mine.company_name || '').trim(),
    jobTitle: String(mine.job_title || '').trim(),
    photoUrl: String(mine.photo_url || mine.avatar_url || mine.card_image_url || '').trim(),
    experience: normalizeTalentExperience(mine.experience),
    industryTags: Array.isArray(mine.industry_tags) ? mine.industry_tags : [],
    applyType,
    paymentStatus,
    paymentMethod,
    status: mine.status,
  }
}
