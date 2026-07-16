import { Module } from '@nestjs/common'
import { TransactionsController, PointsController } from './transactions.controller'
import { TransactionsService, PointsService } from './transactions.service'
import { MemberAuthGuard } from '@/auth/auth.guard'
import { PointsModule } from '@/points/points.module'

@Module({
  imports: [PointsModule],
  controllers: [TransactionsController, PointsController],
  providers: [TransactionsService, PointsService, MemberAuthGuard],
})
export class TransactionsModule {}
