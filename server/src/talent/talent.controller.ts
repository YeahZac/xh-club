import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { TalentService } from './talent.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'

@Controller('industries')
export class IndustryPublicController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  async list() {
    const data = await this.talentService.listIndustries(true)
    return { code: 200, msg: 'success', data }
  }
}

@Controller('talents')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  async listApproved(@Query() query: any) {
    const data = await this.talentService.listApproved(query)
    return { code: 200, msg: 'success', data }
  }

  @Get('mine')
  @UseGuards(MemberAuthGuard)
  async mine(@Req() request: any) {
    const data = await this.talentService.getMine(String(request.user.sub))
    return { code: 200, msg: 'success', data }
  }

  @Post('apply')
  @UseGuards(MemberAuthGuard)
  async apply(@Req() request: any, @Body() dto: any) {
    const data = await this.talentService.apply(String(request.user.sub), dto)
    return { code: 200, msg: '提交成功', data }
  }

  @Put('mine')
  @UseGuards(MemberAuthGuard)
  async updateMine(@Req() request: any, @Body() dto: any) {
    const data = await this.talentService.updateMine(String(request.user.sub), dto)
    return { code: 200, msg: '已重新提交审核', data }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const data = await this.talentService.getApprovedById(id)
    return { code: 200, msg: 'success', data }
  }
}

@Controller('admin/industries')
@UseGuards(AdminAuthGuard)
export class IndustryAdminController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  async list() {
    const data = await this.talentService.listIndustries(false)
    return { code: 200, msg: 'success', data }
  }

  @Post()
  async create(@Body() dto: any) {
    const data = await this.talentService.createIndustry(dto)
    return { code: 200, msg: '创建成功', data }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    const data = await this.talentService.updateIndustry(id, dto)
    return { code: 200, msg: '更新成功', data }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.talentService.removeIndustry(id)
    return { code: 200, msg: '删除成功', data }
  }
}

@Controller('admin/talents')
@UseGuards(AdminAuthGuard)
export class TalentAdminController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  async list(@Query() query: any) {
    const data = await this.talentService.adminList(query)
    return { code: 200, msg: 'success', data }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const data = await this.talentService.adminGetById(id)
    return { code: 200, msg: 'success', data }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    const data = await this.talentService.adminUpdate(id, dto)
    return { code: 200, msg: '更新成功', data }
  }

  @Post(':id/review')
  async review(@Param('id') id: string, @Body() dto: any, @Req() request: any) {
    const data = await this.talentService.adminReview(id, {
      status: dto.status,
      reject_reason: dto.reject_reason,
      reviewed_by: request.user?.sub || dto.reviewed_by,
    })
    return { code: 200, msg: '审核完成', data }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.talentService.adminRemove(id)
    return { code: 200, msg: '删除成功', data }
  }
}
