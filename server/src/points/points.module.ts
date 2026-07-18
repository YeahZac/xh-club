import { Module } from '@nestjs/common'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { AdminPointsController, PointsController } from './points.controller'
import { PointsEngineService } from './points-engine.service'

@Module({
  controllers: [PointsController, AdminPointsController],
  providers: [PointsEngineService, MemberAuthGuard, AdminAuthGuard],
  exports: [PointsEngineService],
})
export class PointsModule {}
