import { Injectable, Logger } from '@nestjs/common'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { RowDataPacket } from 'mysql2'
import { formatPointsRuleRow } from './points-rule.util'

@Injectable()
export class PointsEngineService {
  private readonly logger = new Logger(PointsEngineService.name)

  /**
   * 按规则类型评估并发放积分。
   * 邀请类积分不在此处理，由「邀请奖励」模块负责。
   */
  async evaluate(memberId: string | number, actionType: string, context?: {
    referenceType?: string
    referenceId?: string | number
    description?: string
  }) {
    if (!memberId || !actionType) return { granted: [], skipped: 'invalid_params' }
    if (actionType === 'invite' || actionType === 'invite_friend' || actionType === 'invite_register') {
      return { granted: [], skipped: 'invite_handled_elsewhere' }
    }

    try {
      const rules = await queryRows<RowDataPacket>(
        `SELECT * FROM points_rules
         WHERE is_active = 1 AND action_type = ?
           AND (start_date IS NULL OR start_date <= NOW())
           AND (end_date IS NULL OR end_date >= NOW())
         ORDER BY priority DESC, id ASC`,
        [actionType],
      )
      if (!rules.length) return { granted: [], skipped: 'no_rules' }

      const metric = await this.getMetric(memberId, actionType)
      const granted: any[] = []

      for (const raw of rules) {
        const rule = formatPointsRuleRow(raw)
        const ok = await this.tryGrantRule(memberId, rule, metric, context)
        if (ok) granted.push(ok)
      }
      return { granted, metric }
    } catch (error) {
      this.logger.error(`evaluate points failed member=${memberId} action=${actionType}`, error)
      return { granted: [], error: String((error as Error)?.message || error) }
    }
  }

  /** 登录时顺带检查「会员天数」类规则 */
  async onMemberActive(memberId: string | number) {
    const results: any[] = []
    results.push(await this.evaluate(memberId, 'daily_login'))
    results.push(await this.evaluate(memberId, 'member_days'))
    return results
  }

  private async getMetric(memberId: string | number, actionType: string): Promise<number> {
    switch (actionType) {
      case 'attend_event': {
        const row = await queryOne<RowDataPacket>(
          `SELECT COUNT(*) AS cnt FROM event_registrations
           WHERE member_id = ? AND status IN ('registered','confirmed','attended')`,
          [memberId],
        )
        return Number(row?.cnt || 0)
      }
      case 'deal_complete': {
        const row = await queryOne<RowDataPacket>(
          `SELECT COUNT(*) AS cnt FROM transactions
           WHERE status = 'completed'
             AND (party_a_id = ? OR party_b_id = ? OR matcher_id = ?)`,
          [memberId, memberId, memberId],
        )
        return Number(row?.cnt || 0)
      }
      case 'member_days': {
        const member = await queryOne<RowDataPacket>(
          'SELECT created_at FROM members WHERE id = ?',
          [memberId],
        )
        if (!member?.created_at) return 0
        const created = new Date(member.created_at).getTime()
        if (Number.isNaN(created)) return 0
        return Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000))
      }
      case 'daily_login':
      case 'daily_checkin':
      case 'talent_settle':
        return 1
      default:
        return 1
    }
  }

  private async tryGrantRule(
    memberId: string | number,
    rule: any,
    metric: number,
    context?: {
      referenceType?: string
      referenceId?: string | number
      description?: string
    },
  ) {
    const threshold = Math.max(1, Number(rule.threshold_value) || 1)
    if (metric < threshold) return null

    const grantCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS cnt FROM points_grants WHERE member_id = ? AND rule_id = ?',
      [memberId, rule.id],
    )
    const totalGranted = Number(grantCount?.cnt || 0)

    if (!rule.repeatable && totalGranted >= 1) return null
    if (Number(rule.total_limit) > 0 && totalGranted >= Number(rule.total_limit)) return null

    if (Number(rule.daily_limit) > 0) {
      const daily = await queryOne<RowDataPacket>(
        `SELECT COUNT(*) AS cnt FROM points_grants
         WHERE member_id = ? AND rule_id = ? AND DATE(created_at) = CURDATE()`,
        [memberId, rule.id],
      )
      if (Number(daily?.cnt || 0) >= Number(rule.daily_limit)) return null
    }

    // 可重复：按「每达到 threshold 倍数」发放，已发次数不能超过 floor(metric/threshold)
    if (rule.repeatable) {
      const allowedTimes = Math.floor(metric / threshold)
      if (totalGranted >= allowedTimes) return null
    }

    return this.grantPoints(memberId, rule, context)
  }

  private async grantPoints(
    memberId: string | number,
    rule: any,
    context?: {
      referenceType?: string
      referenceId?: string | number
      description?: string
    },
  ) {
    const points = Math.max(0, Number(rule.points_value) || 0)
    if (points <= 0) return null

    const member = await queryOne<RowDataPacket>(
      'SELECT id, available_points, total_points FROM members WHERE id = ?',
      [memberId],
    )
    if (!member) return null

    const before = Number(member.available_points || 0)
    const after = before + points
    const total = Number(member.total_points || 0) + points

    await queryExecute(
      'UPDATE members SET available_points = ?, total_points = ?, updated_at = NOW() WHERE id = ?',
      [after, total, memberId],
    )

    const desc =
      context?.description ||
      rule.description ||
      `${rule.rule_name || rule.action_type}奖励积分`

    try {
      await queryExecute(
        `INSERT INTO points_grants
           (member_id, rule_id, points, balance_before, balance_after, action_type, description, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          memberId,
          rule.id,
          points,
          before,
          after,
          rule.action_type,
          desc,
          context?.referenceType || null,
          context?.referenceId || null,
        ],
      )
    } catch (error) {
      this.logger.warn(`points_grants insert failed: ${(error as Error)?.message}`)
    }

    try {
      await queryExecute(
        `INSERT INTO points_records (member_id, type, amount, balance, source, source_id, description)
         VALUES (?, 'earn', ?, ?, ?, ?, ?)`,
        [
          memberId,
          points,
          after,
          rule.action_type,
          context?.referenceId ? String(context.referenceId) : String(rule.id),
          desc,
        ],
      )
    } catch (error) {
      this.logger.warn(`points_records insert failed: ${(error as Error)?.message}`)
    }

    this.logger.log(`Granted ${points} points to member ${memberId} via rule ${rule.id}`)
    return { rule_id: rule.id, points, balance_after: after }
  }
}
