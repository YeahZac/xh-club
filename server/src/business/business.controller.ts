import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { BusinessService } from './business.service'
import { AdminAuthGuard } from '@/auth/auth.guard'

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  async list(@Query() query: any) {
    const result = await this.businessService.list(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const result = await this.businessService.getById(id)
    return { code: 200, msg: 'success', data: result }
  }
}

@Controller('admin/business')
@UseGuards(AdminAuthGuard)
export class BusinessAdminController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  async list(@Query() query: any) {
    const result = await this.businessService.adminList(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const result = await this.businessService.adminGetById(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Post()
  async create(@Body() dto: any) {
    const result = await this.businessService.create(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    const result = await this.businessService.update(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.businessService.remove(id)
    return { code: 200, msg: '删除成功', data: result }
  }
}
