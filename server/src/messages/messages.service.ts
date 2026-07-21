import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { createNotification } from '@/common/notify'
import { UploadService } from '@/upload/upload.service'

@Injectable()
export class MessagesService {
  constructor(private readonly uploadService: UploadService) {}

  /** 获取私信列表（MySQL；前端当前不展示聊天，保留接口兼容） */
  async getMessages(memberId: string, params: { page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20))
    const offset = (page - 1) * pageSize

    try {
      const totalRow = await queryOne(
        `SELECT COUNT(*) AS total FROM messages
         WHERE sender_id = ? OR receiver_id = ?`,
        [memberId, memberId],
      )
      const rows = await queryRows(
        `SELECT m.*,
                s.id AS sender_member_id, s.name AS sender_name, s.avatar AS sender_avatar,
                r.id AS receiver_member_id, r.name AS receiver_name, r.avatar AS receiver_avatar
         FROM messages m
         LEFT JOIN members s ON s.id = m.sender_id
         LEFT JOIN members r ON r.id = m.receiver_id
         WHERE m.sender_id = ? OR m.receiver_id = ?
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [memberId, memberId, pageSize, offset],
      )

      const list = await Promise.all(
        (rows || []).map(async (row: any) => {
          const senderAvatar = row.sender_avatar
            ? await this.uploadService.signMediaUrl(row.sender_avatar)
            : row.sender_avatar
          const receiverAvatar = row.receiver_avatar
            ? await this.uploadService.signMediaUrl(row.receiver_avatar)
            : row.receiver_avatar
          return {
            id: row.id,
            sender_id: row.sender_id,
            receiver_id: row.receiver_id,
            content: row.content,
            type: row.type,
            is_read: Boolean(row.is_read),
            created_at: row.created_at,
            sender: row.sender_member_id
              ? { id: row.sender_member_id, name: row.sender_name, avatar: senderAvatar }
              : null,
            receiver: row.receiver_member_id
              ? { id: row.receiver_member_id, name: row.receiver_name, avatar: receiverAvatar }
              : null,
          }
        }),
      )

      return { list, total: Number(totalRow?.total || 0), page, pageSize }
    } catch (error: any) {
      console.error('[MessagesService] getMessages failed:', error?.message || error)
      throw new HttpException(
        `查询失败: ${error?.message || '未知错误'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /** 发送私信 */
  async sendMessage(dto: { sender_id: string; receiver_id: string; content: string; type?: string }) {
    console.log('[MessagesService] sendMessage - from:', dto.sender_id, 'to:', dto.receiver_id)
    try {
      const result = await queryExecute(
        `INSERT INTO messages (sender_id, receiver_id, content, type, is_read)
         VALUES (?, ?, ?, ?, 0)`,
        [dto.sender_id, dto.receiver_id, dto.content, dto.type || 'text'],
      )
      await createNotification({
        memberId: dto.receiver_id,
        type: 'message',
        title: '新私信',
        content: '您收到了一条新消息',
        link: '/pages/message/index',
        bizType: 'private_message',
        bizId: result.insertId,
        result: 'pending',
      })
      return await queryOne('SELECT * FROM messages WHERE id = ?', [result.insertId])
    } catch (error: any) {
      throw new HttpException(`发送失败: ${error?.message || '未知错误'}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /** 获取通知列表 */
  async getNotifications(memberId: string, params: { type?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 50))
    const offset = (page - 1) * pageSize

    try {
      const values: any[] = [memberId]
      let where = 'member_id = ?'
      if (params.type) {
        where += ' AND type = ?'
        values.push(params.type)
      }

      const totalRow = await queryOne(
        `SELECT COUNT(*) AS total FROM notifications WHERE ${where}`,
        values,
      )
      const list = await queryRows(
        `SELECT id, member_id, type, title, content, is_read, link,
                biz_type, biz_id, result, processed_at, created_at
         FROM notifications
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
      )

      return {
        list: (list || []).map((row: any) => ({
          ...row,
          is_read: Boolean(Number(row.is_read)),
        })),
        total: Number(totalRow?.total || 0),
        page,
        pageSize,
      }
    } catch (error: any) {
      // 兼容旧表无 biz_* 列
      console.warn('[MessagesService] getNotifications with extended columns failed, fallback:', error?.message)
      try {
        const list = await queryRows(
          `SELECT id, member_id, type, title, content, is_read, link, created_at
           FROM notifications
           WHERE member_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [memberId, pageSize, offset],
        )
        const totalRow = await queryOne(
          `SELECT COUNT(*) AS total FROM notifications WHERE member_id = ?`,
          [memberId],
        )
        return {
          list: (list || []).map((row: any) => ({
            ...row,
            is_read: Boolean(Number(row.is_read)),
          })),
          total: Number(totalRow?.total || 0),
          page,
          pageSize,
        }
      } catch (fallbackError: any) {
        throw new HttpException(
          `查询失败: ${fallbackError?.message || error?.message || '未知错误'}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        )
      }
    }
  }

  /** 获取未读数（仅统计通知） */
  async getUnreadCount(memberId: string) {
    try {
      const notif = await queryOne(
        `SELECT COUNT(*) AS total FROM notifications WHERE member_id = ? AND is_read = 0`,
        [memberId],
      )
      const notifications = Number(notif?.total || 0)
      return { messages: 0, notifications, total: notifications }
    } catch (error: any) {
      console.warn('[MessagesService] getUnreadCount failed:', error?.message || error)
      return { messages: 0, notifications: 0, total: 0 }
    }
  }

  /** 标记已读 */
  async markAsRead(memberId: string, type: 'messages' | 'notifications', ids?: string[]) {
    const table = type === 'messages' ? 'messages' : 'notifications'
    const field = type === 'messages' ? 'receiver_id' : 'member_id'

    try {
      if (ids && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(', ')
        await queryExecute(
          `UPDATE ${table} SET is_read = 1 WHERE ${field} = ? AND id IN (${placeholders})`,
          [memberId, ...ids],
        )
      } else {
        await queryExecute(
          `UPDATE ${table} SET is_read = 1 WHERE ${field} = ? AND is_read = 0`,
          [memberId],
        )
      }
      return { success: true }
    } catch (error: any) {
      throw new HttpException(`操作失败: ${error?.message || '未知错误'}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
