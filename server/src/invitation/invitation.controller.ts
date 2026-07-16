import { Controller, Get } from '@nestjs/common'
import { AdminService } from '@/admin/admin.service'
import { Public } from '@/auth/public.decorator'

/** 小程序端公开读取邀请奖励规则（图文 + 积分/经验值） */
@Controller('invitation')
export class InvitationController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get('rules')
  async getRules() {
    const list = await this.adminService.getActiveInvitationRulesForClient()
    const summary = {
      points_value: 0,
      experience_value: 0,
      content: '',
      rules: list,
    }
    for (const rule of list) {
      summary.points_value += Number(rule.points_value || rule.reward_value || 0) || 0
      summary.experience_value += Number(rule.experience_value || 0) || 0
      if (!summary.content && rule.content) {
        summary.content = rule.content
      }
    }
    // 多条规则时拼接图文
    if (list.length > 1) {
      summary.content = list
        .map((rule) => {
          const head = `<p><strong>${rule.rule_name || '邀请奖励'}</strong>（积分 ${Number(rule.points_value || 0)} / 经验 ${Number(rule.experience_value || 0)}）</p>`
          return `${head}${rule.content || ''}`
        })
        .join('')
    }
    return { code: 200, msg: 'success', data: summary }
  }
}
