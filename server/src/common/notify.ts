import { queryExecute } from '@/storage/database/mysql-client'

export type NotifyPayload = {
  memberId: string | number
  type?: string
  title: string
  content: string
  link?: string | null
  bizType?: string | null
  bizId?: string | number | null
  result?: string | null
  processedAt?: Date | string | null
}

/** 统一写入系统通知（审核结果 / 对接确认 / 报名成功等） */
export async function createNotification(payload: NotifyPayload): Promise<boolean> {
  const memberId = payload.memberId
  if (memberId == null || memberId === '') {
    console.warn('[notify] 跳过：缺少 memberId', payload.title)
    return false
  }

  try {
    const result = await queryExecute(
      `INSERT INTO notifications
         (member_id, type, title, content, is_read, link, biz_type, biz_id, result, processed_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        memberId,
        payload.type || 'system',
        payload.title,
        payload.content,
        payload.link || null,
        payload.bizType || null,
        payload.bizId != null ? String(payload.bizId) : null,
        payload.result || null,
        payload.processedAt || new Date(),
      ],
    )
    console.log('[notify] 写入成功', {
      id: result?.insertId,
      memberId,
      type: payload.type || 'system',
      title: payload.title,
      bizType: payload.bizType,
    })
    return true
  } catch (error) {
    // 兼容尚未补齐 biz_* 列的旧表
    try {
      const result = await queryExecute(
        `INSERT INTO notifications (member_id, type, title, content, is_read, link)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [
          memberId,
          payload.type || 'system',
          payload.title,
          payload.content,
          payload.link || null,
        ],
      )
      console.log('[notify] 写入成功(兼容列)', {
        id: result?.insertId,
        memberId,
        title: payload.title,
      })
      return true
    } catch (fallbackError) {
      console.error(
        '[notify] 写入通知失败:',
        {
          memberId,
          title: payload.title,
          primary: (error as Error)?.message || error,
          fallback: (fallbackError as Error)?.message || fallbackError,
        },
      )
      return false
    }
  }
}
