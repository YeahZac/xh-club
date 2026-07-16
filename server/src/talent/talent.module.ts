import { Module } from '@nestjs/common'
import {
  TalentController,
  TalentAdminController,
  IndustryAdminController,
  IndustryPublicController,
} from './talent.controller'
import { TalentService } from './talent.service'
import { UploadModule } from '@/upload/upload.module'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'

@Module({
  imports: [UploadModule],
  controllers: [
    IndustryPublicController,
    TalentController,
    TalentAdminController,
    IndustryAdminController,
  ],
  providers: [TalentService, AdminAuthGuard, MemberAuthGuard],
  exports: [TalentService],
})
export class TalentModule {}
