import { Module } from '@nestjs/common'
import { AdminFeedbackController, FeedbackController } from './feedback.controller'
import { FeedbackService } from './feedback.service'
import { UploadModule } from '@/upload/upload.module'
import { WechatModule } from '@/wechat/wechat.module'

@Module({
  imports: [UploadModule, WechatModule],
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
