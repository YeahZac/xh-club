import { Module } from '@nestjs/common'
import { MessagesController, NotificationsController } from './messages.controller'
import { MessagesService } from './messages.service'

@Module({
  controllers: [MessagesController, NotificationsController],
  providers: [MessagesService],
})
export class MessagesModule {}
