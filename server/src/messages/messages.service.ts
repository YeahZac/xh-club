import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

@Injectable()
export class MessagesService {
  private client() { return getSupabaseClient() }

  /** 获取私信列表 */
  async getMessages(memberId: string, params: { page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await this.client()
      .from('messages')
      .select('*, sender:members!messages_sender_id_fkey(id, name, avatar), receiver:members!messages_receiver_id_fkey(id, name, avatar)', { count: 'exact' })
      .or(`sender_id.eq.${memberId},receiver_id.eq.${memberId}`)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 发送私信 */
  async sendMessage(dto: { sender_id: string; receiver_id: string; content: string; type?: string }) {
    console.log('[MessagesService] sendMessage - from:', dto.sender_id, 'to:', dto.receiver_id)
    const { data, error } = await this.client()
      .from('messages')
      .insert({
        sender_id: dto.sender_id,
        receiver_id: dto.receiver_id,
        content: dto.content,
        type: dto.type || 'text',
        is_read: false,
      })
      .select()
      .single()

    if (error) throw new HttpException(`发送失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 创建通知
    await this.client()
      .from('notifications')
      .insert({
        member_id: dto.receiver_id,
        type: 'message',
        title: '新私信',
        content: `您收到了一条新消息`,
      })

    return data
  }

  /** 获取通知列表 */
  async getNotifications(memberId: string, params: { type?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.type) query = query.eq('type', params.type)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 获取未读数 */
  async getUnreadCount(memberId: string) {
    const { count: msgCount } = await this.client()
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', memberId)
      .eq('is_read', false)

    const { count: notifCount } = await this.client()
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('is_read', false)

    return { messages: msgCount || 0, notifications: notifCount || 0, total: (msgCount || 0) + (notifCount || 0) }
  }

  /** 标记已读 */
  async markAsRead(memberId: string, type: 'messages' | 'notifications', ids?: string[]) {
    const table = type === 'messages' ? 'messages' : 'notifications'
    const field = type === 'messages' ? 'receiver_id' : 'member_id'

    if (ids && ids.length > 0) {
      await this.client()
        .from(table)
        .update({ is_read: true })
        .eq(field, memberId)
        .in('id', ids)
    } else {
      await this.client()
        .from(table)
        .update({ is_read: true })
        .eq(field, memberId)
        .eq('is_read', false)
    }

    return { success: true }
  }
}
