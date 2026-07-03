import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { MessagesService } from './messages.service'

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getMessages(@Query() query: any) {
    console.log('[MessagesController] GET /api/messages')
    const memberId = query.member_id
    if (!memberId) return { code: 400, msg: '缺少member_id', data: null }
    const result = await this.messagesService.getMessages(memberId, query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post()
  async sendMessage(@Body() body: { sender_id: string; receiver_id: string; content: string; type?: string }) {
    console.log('[MessagesController] POST /api/messages')
    const result = await this.messagesService.sendMessage(body)
    return { code: 200, msg: '发送成功', data: result }
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getNotifications(@Query() query: any) {
    console.log('[NotificationsController] GET /api/notifications')
    const memberId = query.member_id
    if (!memberId) return { code: 400, msg: '缺少member_id', data: null }
    const result = await this.messagesService.getNotifications(memberId, query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('unread-count')
  async getUnreadCount(@Query('member_id') memberId: string) {
    console.log('[NotificationsController] GET /api/notifications/unread-count')
    if (!memberId) return { code: 400, msg: '缺少member_id', data: null }
    const result = await this.messagesService.getUnreadCount(memberId)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('mark-read')
  async markAsRead(@Body() body: { member_id: string; type: 'messages' | 'notifications'; ids?: string[] }) {
    console.log('[NotificationsController] POST /api/notifications/mark-read')
    const result = await this.messagesService.markAsRead(body.member_id, body.type, body.ids)
    return { code: 200, msg: '操作成功', data: result }
  }
}
