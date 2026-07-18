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

/** 统一写入系统通知（审核结果 / 对接确认 / 站内分享等） */
export async function createNotification(payload: NotifyPayload) {
  try {
    await queryExecute(
      `INSERT INTO notifications
         (member_id, type, title, content, is_read, link, biz_type, biz_id, result, processed_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        payload.memberId,
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
  } catch (error) {
    // 兼容尚未补齐 biz_* 列的旧表
    try {
      await queryExecute(
        `INSERT INTO notifications (member_id, type, title, content, is_read, link)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [
          payload.memberId,
          payload.type || 'system',
          payload.title,
          payload.content,
          payload.link || null,
        ],
      )
    } catch (fallbackError) {
      console.warn(
        '[notify] 写入通知失败:',
        (fallbackError as Error)?.message || fallbackError || (error as Error)?.message,
      )
    }
  }
}
