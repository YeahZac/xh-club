import { Module } from '@nestjs/common'
import { MessagesController, NotificationsController } from './messages.controller'
import { MessagesService } from './messages.service'
import { MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'

@Module({
  imports: [UploadModule],
  controllers: [MessagesController, NotificationsController],
  providers: [MessagesService, MemberAuthGuard],
})
export class MessagesModule {}
