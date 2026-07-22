export function parseJsonUrlList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean)
      }
    } catch {
      return [raw]
    }
  }
  return []
}

export function serializeJsonUrlList(value: unknown): string | null {
  const list = parseJsonUrlList(value)
  return list.length ? JSON.stringify(list) : null
}
