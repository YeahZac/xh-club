import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { AdminAuthGuard } from '@/auth/auth.guard';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService, AdminAuthGuard],
  exports: [ArticlesService],
})
export class ArticlesModule {}
