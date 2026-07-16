import { Module } from '@nestjs/common'
import { BusinessController, BusinessAdminController } from './business.controller'
import { BusinessService } from './business.service'
import { UploadModule } from '@/upload/upload.module'
import { AdminAuthGuard } from '@/auth/auth.guard'

@Module({
  imports: [UploadModule],
  controllers: [BusinessController, BusinessAdminController],
  providers: [BusinessService, AdminAuthGuard],
  exports: [BusinessService],
})
export class BusinessModule {}
