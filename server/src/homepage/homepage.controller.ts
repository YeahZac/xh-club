import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AdminAuthGuard } from '@/auth/auth.guard'
import { HomepageService } from './homepage.service'

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get()
  async getConfig() {
    const data = await this.homepageService.getConfig()
    return { code: 200, msg: 'success', data }
  }

  @Get('feed')
  async getFeed() {
    const data = await this.homepageService.getFeed()
    return { code: 200, msg: 'success', data }
  }
}

@Controller('admin/homepage')
@UseGuards(AdminAuthGuard)
export class HomepageAdminController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get()
  async getConfig() {
    const data = await this.homepageService.getConfig(true)
    return { code: 200, msg: 'success', data }
  }

  @Get('candidates/:section')
  async getCandidates(
    @Param('section') section: string,
    @Query('keyword') keyword?: string,
  ) {
    const data = await this.homepageService.getCandidates(section, keyword)
    return { code: 200, msg: 'success', data }
  }

  @Put('settings')
  async updateSettings(@Body() body: { sort_mode: string }) {
    const data = await this.homepageService.updateSettings(body)
    return { code: 200, msg: '排序设置已保存', data }
  }

  @Put('sections/:section')
  async updateSection(
    @Param('section') section: string,
    @Body() body: { is_enabled?: boolean; item_limit?: number; sort_mode?: string },
  ) {
    const data = await this.homepageService.updateSection(section, body)
    return { code: 200, msg: '保存成功', data }
  }

  @Post('items')
  @HttpCode(200)
  async addItem(
    @Body() body: { section: string; item_id: string; sort_order?: number },
  ) {
    const data = await this.homepageService.addItem(body)
    return { code: 200, msg: '添加成功', data }
  }

  @Put('items/:id')
  async updateItem(
    @Param('id') id: string,
    @Body() body: { sort_order?: number; is_active?: boolean },
  ) {
    const data = await this.homepageService.updateItem(id, body)
    return { code: 200, msg: '保存成功', data }
  }

  @Delete('items/:id')
  async removeItem(@Param('id') id: string) {
    const data = await this.homepageService.removeItem(id)
    return { code: 200, msg: '移除成功', data }
  }
}
