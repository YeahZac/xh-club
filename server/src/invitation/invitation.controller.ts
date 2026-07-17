import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { AdminService } from '@/admin/admin.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { Public } from '@/auth/public.decorator'
import { MemberInvitationService } from './member-invitation.service'

/** 小程序端公开读取邀请奖励规则（图文 + 条件 + 多奖励） */
@Controller('invitation')
export class InvitationController {
  constructor(
    private readonly adminService: AdminService,
    private readonly memberInvitationService: MemberInvitationService,
  ) {}

  @Public()
  @Get('rules')
  async getRules() {
    const list = await this.adminService.getActiveInvitationRulesForClient()
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

  @Public()
  @Get('member-leads/preview')
  async previewLead(@Query('code') code: string) {
    const data = await this.memberInvitationService.previewByInviteCode(code)
    return { code: 200, msg: 'success', data }
  }

  @Public()
  @Post('member-leads')
  async submitLead(@Body() body: any) {
    const data = await this.memberInvitationService.submitLead(body)
    return { code: 200, msg: '提交成功', data }
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
