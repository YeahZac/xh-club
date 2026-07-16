import { Module } from '@nestjs/common'
import { PointsEngineService } from './points-engine.service'

@Module({
  providers: [PointsEngineService],
  exports: [PointsEngineService],
})
export class PointsModule {}
