import { Module } from '@nestjs/common'
import { MallController } from './mall.controller'
import { MallService } from './mall.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import { PointsModule } from '@/points/points.module'
import { InvitationModule } from '@/invitation/invitation.module'

@Module({
  imports: [UploadModule, PointsModule, InvitationModule],
  controllers: [MallController],
  providers: [MallService, AdminAuthGuard, MemberAuthGuard],
  exports: [MallService],
})
export class MallModule {}
