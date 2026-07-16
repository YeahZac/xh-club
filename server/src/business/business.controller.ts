import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { BusinessService } from './business.service'
import { RoadshowService } from './roadshow.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { verifyAuthToken } from '@/auth/jwt'

function readMemberId(request: any): string | undefined {
  const authorization = request.headers?.authorization
  if (typeof authorization !== 'string') return undefined
  const [scheme, token] = authorization.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined
  try {
    const principal = verifyAuthToken(token)
    return principal.type === 'member' ? String(principal.sub) : undefined
  } catch {
    return undefined
  }
}

@Controller('business')
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly roadshowService: RoadshowService,
  ) {}

  @Get()
  async list(@Query() query: any) {
    const result = await this.businessService.list(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post(':id/register')
  @UseGuards(MemberAuthGuard)
  async registerRoadshow(@Param('id') id: string, @Req() request: any, @Body() body: any) {
    const result = await this.roadshowService.register(id, request.user.sub, body?.form_answers || body)
    return { code: 200, msg: '报名成功', data: result }
  }

  @Post(':id/scores')
  @UseGuards(MemberAuthGuard)
  async submitRoadshowScores(@Param('id') id: string, @Req() request: any, @Body() body: any) {
    const result = await this.roadshowService.submitScores(id, request.user.sub, body?.scores || [])
    return { code: 200, msg: '评分成功', data: result }
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Req() request: any) {
    const memberId = readMemberId(request)
    const result = await this.businessService.getById(id, memberId)
    return { code: 200, msg: 'success', data: result }
  }
}

@Controller('admin/business')
@UseGuards(AdminAuthGuard)
export class BusinessAdminController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly roadshowService: RoadshowService,
  ) {}

  @Get()
  async list(@Query() query: any) {
    const result = await this.businessService.adminList(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id/roadshow/registrations')
  async roadshowRegistrations(@Param('id') id: string) {
    const result = await this.roadshowService.getRegistrations(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id/roadshow/summary')
  async roadshowSummary(@Param('id') id: string) {
    const result = await this.roadshowService.getScoreSummary(id)
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
