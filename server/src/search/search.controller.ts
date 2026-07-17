import { Controller, Get, Query } from '@nestjs/common'
import { SearchService } from './search.service'

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query('keyword') keyword?: string) {
    const data = await this.searchService.search(keyword || '')
    return { code: 200, msg: 'success', data }
  }
}
