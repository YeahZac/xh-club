import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import { MallModule } from '@/mall/mall.module'

@Module({
  imports: [UploadModule, MallModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}
