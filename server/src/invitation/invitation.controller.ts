import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { Public } from '@/auth/public.decorator'
import { InvitationEngineService } from './invitation-engine.service'
import { MemberInvitationService } from './member-invitation.service'

/** 小程序端公开读取邀请奖励规则（图文 + 条件 + 多奖励） */
@Controller('invitation')
export class InvitationController {
  constructor(
    private readonly invitationEngine: InvitationEngineService,
    private readonly memberInvitationService: MemberInvitationService,
  ) {}

  @Public()
  @Get('rules')
  async getRules() {
    const list = await this.invitationEngine.getActiveRulesForClient()
    const summary = {
      points_value: 0,
      growth_value: 0,
      experience_value: 0,
      earnings_value: 0,
      contribution_value: 0,
      conditions: [] as Array<{ code: string; label: string }>,
      content: '',
      rules: list,
    }

    const conditionMap = new Map<string, { code: string; label: string }>()
    for (const rule of list) {
      summary.points_value += Number(rule.points_value || 0) || 0
      summary.growth_value += Number(rule.growth_value || rule.experience_value || 0) || 0
      summary.earnings_value += Number(rule.earnings_value || 0) || 0
      summary.contribution_value += Number(rule.contribution_value || 0) || 0
      const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
      for (const item of conditions) {
        const key = `${item.code}:${item.label}`
        if (!conditionMap.has(key)) conditionMap.set(key, item)
      }
    }
    summary.experience_value = summary.growth_value
    summary.earnings_value = Number(summary.earnings_value.toFixed(2))
    summary.conditions = Array.from(conditionMap.values())

    if (list.length === 1) {
      summary.content = list[0].content || ''
    } else if (list.length > 1) {
      summary.content = list
        .map((rule) => {
          const rewardBits = [
            Number(rule.points_value) > 0 ? `积分 ${rule.points_value}` : '',
            Number(rule.growth_value) > 0 ? `成长值 ${rule.growth_value}` : '',
            Number(rule.earnings_value) > 0 ? `收益 ¥${rule.earnings_value}` : '',
            Number(rule.contribution_value) > 0 ? `贡献值 ${rule.contribution_value}` : '',
          ].filter(Boolean).join(' / ')
          const condText = (Array.isArray(rule.conditions) ? rule.conditions : [])
            .map((c: any) => c.label)
            .join('、')
          const head = `<p><strong>${rule.rule_name || '邀请奖励'}</strong>${rewardBits ? `（${rewardBits}）` : ''}</p>`
          const condHtml = condText ? `<p>触发条件：${condText}</p>` : ''
          return `${head}${condHtml}${rule.content || ''}`
        })
        .join('<hr/>')
    }

    return { code: 200, msg: 'success', data: summary }
  }

  private httpExceptionMessage(error: HttpException): string {
    const payload = error.getResponse()
    if (typeof payload === 'string') return payload
    const msg = (payload as any)?.message
    if (Array.isArray(msg)) return String(msg[0] || '请求失败')
    if (msg) return String(msg)
    return error.message || '请求失败'
  }

  /**
   * 推荐落地页预览（公开）。
   * 业务错误统一 HTTP 200 + code，避免云托管 callContainer 把 4xx 打成「网络异常」，
   * 进而导致前端 preview 为空、主按钮被禁用且点击无反应。
   */
  @Public()
  @Get('member-leads/preview')
  async previewLead(@Query('code') code: string) {
    try {
      const data = await this.memberInvitationService.previewByInviteCode(code)
      return { code: 200, msg: 'success', data }
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus()
        const msg = this.httpExceptionMessage(error)
        return { code: status, msg, data: null }
      }
      throw error
    }
  }

  @Public()
  @Post('member-leads')
  async submitLead(@Body() body: any) {
    try {
      const data = await this.memberInvitationService.submitLead(body)
      return { code: 200, msg: '提交成功', data }
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus()
        const msg = this.httpExceptionMessage(error)
        return { code: status, msg, data: null }
      }
      throw error
    }
  }

  @Get('member-leads/mine')
  @UseGuards(MemberAuthGuard)
  async myLeads(@Req() request: any) {
    const data = await this.memberInvitationService.listMine(request.user.sub)
    return { code: 200, msg: 'success', data }
  }
}

@Controller('admin/member-invitations')
@UseGuards(AdminAuthGuard)
export class AdminMemberInvitationController {
  constructor(private readonly memberInvitationService: MemberInvitationService) {}

  @Get()
  async list(@Query() query: any) {
    const data = await this.memberInvitationService.adminList(query)
    return { code: 200, msg: 'success', data }
  }
}
