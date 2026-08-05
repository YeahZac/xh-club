/** 活动运行态：草稿手动；其余由时间与人数自动判定（北京时间） */

export type EventRuntimeStatus = 'draft' | 'open' | 'full' | 'ended'

const EVENT_STATUS_LABEL: Record<EventRuntimeStatus, string> = {
  draft: '草稿',
  open: '报名中',
  full: '已满员',
  ended: '已结束',
}

/** 将库内无时区 DATETIME 按北京时间（UTC+8）解析为 epoch ms */
export function parseBeijingDateTime(value: unknown): number | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  )
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const hour = Number(match[4])
    const minute = Number(match[5])
    const second = Number(match[6] || 0)
    // 北京时间墙钟 → UTC epoch
    return Date.UTC(year, month - 1, day, hour - 8, minute, second)
  }
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : parsed
}

export function nowBeijingMs(): number {
  return Date.now()
}

export function eventStatusLabel(status: string | null | undefined): string {
  if (!status) return '-'
  return EVENT_STATUS_LABEL[status as EventRuntimeStatus] || status
}

/**
 * 自动判定规则（非草稿）：
 * 1. 当前北京时间 ≥ 结束时间 → 已结束
 * 2. 否则人数已达上限（上限 > 0）→ 已满员
 * 3. 否则 → 报名中
 * 开始时间参与表单联动展示；报名截止以结束时间为准。
 */
export function resolveEventStatus(input: {
  status?: string | null
  start_time?: unknown
  end_time?: unknown
  max_participants?: number | string | null
  current_participants?: number | string | null
  now?: number
}): EventRuntimeStatus {
  if (String(input.status || '') === 'draft') return 'draft'

  const now = input.now ?? nowBeijingMs()
  const endMs = parseBeijingDateTime(input.end_time)
  if (endMs != null && now >= endMs) return 'ended'

  const max = Number(input.max_participants)
  const current = Math.max(0, Number(input.current_participants) || 0)
  if (Number.isFinite(max) && max > 0 && current >= max) return 'full'

  return 'open'
}

export function isEventRegisterOpen(status: string | null | undefined): boolean {
  return String(status || '') === 'open'
}
