import { Module } from '@nestjs/common'
import { AdminAuthGuard } from '@/auth/auth.guard'
import { HomepageAdminController, HomepageController } from './homepage.controller'
import { HomepageService } from './homepage.service'

@Module({
  controllers: [HomepageController, HomepageAdminController],
  providers: [HomepageService, AdminAuthGuard],
})
export class HomepageModule {}
