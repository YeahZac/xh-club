import { Module } from '@nestjs/common';
import { MallController } from './mall.controller';
import { MallService } from './mall.service';

@Module({
  controllers: [MallController],
  providers: [MallService],
  exports: [MallService],
})
export class MallModule {}
