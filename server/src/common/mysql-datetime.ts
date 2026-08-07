/** MySQL DATETIME 不接受 ISO（含 T/Z），统一转为 `YYYY-MM-DD HH:mm:ss`（北京时间墙钟） */
export function toMysqlDateTime(value: unknown): string | null {
  if (value == null || value === '') return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    const hh = String(value.getUTCHours()).padStart(2, '0')
    const mm = String(value.getUTCMinutes()).padStart(2, '0')
    const ss = String(value.getUTCSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
  }

  const raw = String(value).trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.length === 16 ? `${raw}:00` : raw
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    const seconds = match[6] || '00'
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${seconds}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return toMysqlDateTime(parsed)
}

/** 将库内北京时间墙钟转为 datetime-local 值 */
export function toDatetimeLocalValue(value: unknown): string {
  if (value == null || value === '') return ''

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    const hh = String(value.getUTCHours()).padStart(2, '0')
    const mm = String(value.getUTCMinutes()).padStart(2, '0')
    return `${y}-${m}-${d}T${hh}:${mm}`
  }

  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`
  }

  return ''
}
