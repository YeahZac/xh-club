import { Module } from '@nestjs/common'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import {
  DealApplicationsAdminController,
  DealApplicationsController,
} from './deal-applications.controller'
import { DealApplicationsService } from './deal-applications.service'

@Module({
  imports: [UploadModule],
  controllers: [DealApplicationsController, DealApplicationsAdminController],
  providers: [DealApplicationsService, MemberAuthGuard, AdminAuthGuard],
})
export class DealApplicationsModule {}
