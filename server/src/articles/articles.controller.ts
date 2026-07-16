import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { AdminAuthGuard } from '@/auth/auth.guard';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  async findAll() {
    const data = await this.articlesService.findAll();
    return { code: 200, msg: 'success', data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.articlesService.findOne(id);
    return { code: 200, msg: 'success', data };
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  async create(@Body() body: any) {
    const data = await this.articlesService.create(body);
    return { code: 200, msg: 'success', data };
  }

  @Put(':id')
  @UseGuards(AdminAuthGuard)
  async update(@Param('id') id: string, @Body() body: any) {
    const data = await this.articlesService.update(id, body);
    return { code: 200, msg: 'success', data };
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  async delete(@Param('id') id: string) {
    const data = await this.articlesService.delete(id);
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/publish')
  @UseGuards(AdminAuthGuard)
  async publish(@Param('id') id: string) {
    const data = await this.articlesService.publish(id);
    return { code: 200, msg: 'success', data };
  }

  @Post(':id/unpublish')
  @UseGuards(AdminAuthGuard)
  async unpublish(@Param('id') id: string) {
    const data = await this.articlesService.unpublish(id);
    return { code: 200, msg: 'success', data };
  }
}
