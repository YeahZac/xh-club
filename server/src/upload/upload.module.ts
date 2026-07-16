import { Module } from '@nestjs/common';
import { UploadController, MemberUploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard';

@Module({
  controllers: [UploadController, MemberUploadController],
  providers: [UploadService, AdminAuthGuard, MemberAuthGuard],
  exports: [UploadService],
})
export class UploadModule {}
