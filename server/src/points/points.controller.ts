import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common'
import { MemberAuthGuard, AdminAuthGuard } from '@/auth/auth.guard'
import { PointsEngineService } from './points-engine.service'

@Controller('points')
export class PointsController {
  constructor(private readonly pointsEngine: PointsEngineService) {}

  @Get('checkin/status')
  @UseGuards(MemberAuthGuard)
  async checkInStatus(@Req() request: any) {
    const data = await this.pointsEngine.getCheckInStatus(request.user.sub)
    return { code: 200, msg: 'success', data }
  }

  @Post('checkin')
  @UseGuards(MemberAuthGuard)
  async checkIn(@Req() request: any) {
    return this.pointsEngine.checkIn(request.user.sub)
  }
}

@Controller('admin/points')
@UseGuards(AdminAuthGuard)
export class AdminPointsController {
  constructor(private readonly pointsEngine: PointsEngineService) {}

  /** 后台手动触发某会员的自定义/指定规则类型 */
  @Post('trigger')
  async trigger(
    @Body() body: { member_id: string | number; action_type: string; description?: string },
  ) {
    if (!body?.member_id || !body?.action_type) {
      return { code: 400, msg: '缺少 member_id 或 action_type', data: null }
    }
    const data = await this.pointsEngine.evaluate(body.member_id, body.action_type, {
      referenceType: 'admin_trigger',
      referenceId: String(body.member_id),
      description: body.description || `后台触发 ${body.action_type}`,
    })
    return { code: 200, msg: '已触发', data }
  }
}
