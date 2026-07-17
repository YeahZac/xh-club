import { Module } from '@nestjs/common'
import { UploadModule } from '@/upload/upload.module'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'

@Module({
  imports: [UploadModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
