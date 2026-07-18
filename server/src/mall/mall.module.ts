import { Module } from '@nestjs/common'
import { MallController, AdminMallController } from './mall.controller'
import { MallService } from './mall.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import { PointsModule } from '@/points/points.module'

@Module({
  imports: [UploadModule, PointsModule],
  controllers: [MallController, AdminMallController],
  providers: [MallService, AdminAuthGuard, MemberAuthGuard],
  exports: [MallService],
})
export class MallModule {}
