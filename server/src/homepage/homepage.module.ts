import { Module } from '@nestjs/common'
import { AdminAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import { HomepageAdminController, HomepageController } from './homepage.controller'
import { HomepageService } from './homepage.service'

@Module({
  imports: [UploadModule],
  controllers: [HomepageController, HomepageAdminController],
  providers: [HomepageService, AdminAuthGuard],
})
export class HomepageModule {}
