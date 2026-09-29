/** 手机号脱敏：保留前三后四，中间用 **** */
export function maskPhone(value?: string | null): string {
  if (!value) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (/^1\d{10}$/.test(digits)) {
    return `${digits.slice(0, 3)}****${digits.slice(7)}`
  }
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}****${digits.slice(-2)}`
  }
  if (raw.length >= 7) {
    return `${raw.slice(0, 3)}****${raw.slice(-2)}`
  }
  return raw
}
