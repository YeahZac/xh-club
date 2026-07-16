import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'

@Module({
  imports: [UploadModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
})
export class AdminModule {}
