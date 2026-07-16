import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AdminAuthGuard } from '@/auth/auth.guard';

@Module({
  controllers: [UploadController],
  providers: [UploadService, AdminAuthGuard],
  exports: [UploadService],
})
export class UploadModule {}
