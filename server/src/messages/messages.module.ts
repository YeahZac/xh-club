import { Module } from '@nestjs/common'
import { MessagesController, NotificationsController } from './messages.controller'
import { MessagesService } from './messages.service'
import { MemberAuthGuard } from '@/auth/auth.guard'

@Module({
  controllers: [MessagesController, NotificationsController],
  providers: [MessagesService, MemberAuthGuard],
})
export class MessagesModule {}
