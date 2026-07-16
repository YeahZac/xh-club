import { Module } from '@nestjs/common';
import { MallController } from './mall.controller';
import { MallService } from './mall.service';
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard';

@Module({
  controllers: [MallController],
  providers: [MallService, AdminAuthGuard, MemberAuthGuard],
  exports: [MallService],
})
export class MallModule {}
