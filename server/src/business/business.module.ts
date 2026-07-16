import { Module } from '@nestjs/common'
import { BusinessController, BusinessAdminController } from './business.controller'
import { BusinessService } from './business.service'
import { RoadshowService } from './roadshow.service'
import { UploadModule } from '@/upload/upload.module'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'

@Module({
  imports: [UploadModule],
  controllers: [BusinessController, BusinessAdminController],
  providers: [BusinessService, RoadshowService, AdminAuthGuard, MemberAuthGuard],
  exports: [BusinessService, RoadshowService],
})
export class BusinessModule {}
