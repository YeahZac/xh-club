import { Module } from '@nestjs/common';
import {
  UploadController,
  MemberUploadController,
  InviteUploadController,
} from './upload.controller';
import { UploadService } from './upload.service';
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard';

@Module({
  controllers: [UploadController, MemberUploadController, InviteUploadController],
  providers: [UploadService, AdminAuthGuard, MemberAuthGuard],
  exports: [UploadService],
})
export class UploadModule {}
