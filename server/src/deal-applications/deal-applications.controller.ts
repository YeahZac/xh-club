import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { DealApplicationsService } from './deal-applications.service'

@Controller('deal-applications')
@UseGuards(MemberAuthGuard)
export class DealApplicationsController {
  constructor(private readonly service: DealApplicationsService) {}

  @Get('projects')
  async projects() {
    return { code: 200, msg: 'success', data: await this.service.projectOptions() }
  }

  @Get('mine')
  async mine(@Req() request: any) {
    return { code: 200, msg: 'success', data: await this.service.listMine(request.user.sub) }
  }

  @Get('mine/:id')
  async detail(@Param('id') id: string, @Req() request: any) {
    return { code: 200, msg: 'success', data: await this.service.getMineById(id, request.user.sub) }
  }

  @Post()
  async create(@Req() request: any, @Body() body: any) {
    return { code: 200, msg: '已提交审核', data: await this.service.create(request.user.sub, body) }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Req() request: any, @Body() body: any) {
    return {
      code: 200,
      msg: '已重新提交审核',
      data: await this.service.updateMine(id, request.user.sub, body),
    }
  }
}

@Controller('admin/deal-applications')
@UseGuards(AdminAuthGuard)
export class DealApplicationsAdminController {
  constructor(private readonly service: DealApplicationsService) {}

  @Get()
  async list(@Query() query: any) {
    return { code: 200, msg: 'success', data: await this.service.adminList(query) }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return { code: 200, msg: 'success', data: await this.service.adminGetById(id) }
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string, @Req() request: any, @Body() body: any) {
    return {
      code: 200,
      msg: '审核完成',
      data: await this.service.audit(id, request.user.sub, body),
    }
  }

  @Put(':id/payment')
  async payment(@Param('id') id: string, @Body() body: any) {
    return {
      code: 200,
      msg: '打款状态已更新',
      data: await this.service.updatePayment(id, body),
    }
  }
}
