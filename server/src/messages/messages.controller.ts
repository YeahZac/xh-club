import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common'
import { MessagesService } from './messages.service'
import { MemberAuthGuard } from '@/auth/auth.guard'

@Controller('messages')
@UseGuards(MemberAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getMessages(@Query() query: any, @Req() request: any) {
    console.log('[MessagesController] GET /api/messages')
    const result = await this.messagesService.getMessages(request.user.sub, query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post()
  async sendMessage(@Body() body: { receiver_id: string; content: string; type?: string }, @Req() request: any) {
    console.log('[MessagesController] POST /api/messages')
    const result = await this.messagesService.sendMessage({ ...body, sender_id: request.user.sub })
    return { code: 200, msg: '发送成功', data: result }
  }
}

@Controller('notifications')
@UseGuards(MemberAuthGuard)
export class NotificationsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getNotifications(@Query() query: any, @Req() request: any) {
    console.log('[NotificationsController] GET /api/notifications')
    const result = await this.messagesService.getNotifications(request.user.sub, query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('unread-count')
  async getUnreadCount(@Req() request: any) {
    console.log('[NotificationsController] GET /api/notifications/unread-count')
    const result = await this.messagesService.getUnreadCount(request.user.sub)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('mark-read')
  async markAsRead(@Body() body: { type: 'messages' | 'notifications'; ids?: string[] }, @Req() request: any) {
    console.log('[NotificationsController] POST /api/notifications/mark-read')
    const result = await this.messagesService.markAsRead(request.user.sub, body.type, body.ids)
    return { code: 200, msg: '操作成功', data: result }
  }
}
