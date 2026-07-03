import { Module } from '@nestjs/common'
import { TransactionsController, PointsController } from './transactions.controller'
import { TransactionsService, PointsService } from './transactions.service'

@Module({
  controllers: [TransactionsController, PointsController],
  providers: [TransactionsService, PointsService],
})
export class TransactionsModule {}
