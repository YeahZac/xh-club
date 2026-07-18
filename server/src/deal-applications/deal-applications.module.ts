import { Module } from '@nestjs/common'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import { PointsModule } from '@/points/points.module'
import { InvitationModule } from '@/invitation/invitation.module'
import {
  DealApplicationsAdminController,
  DealApplicationsController,
} from './deal-applications.controller'
import { DealApplicationsService } from './deal-applications.service'

@Module({
  imports: [UploadModule, PointsModule, InvitationModule],
  controllers: [DealApplicationsController, DealApplicationsAdminController],
  providers: [DealApplicationsService, MemberAuthGuard, AdminAuthGuard],
})
export class DealApplicationsModule {}
