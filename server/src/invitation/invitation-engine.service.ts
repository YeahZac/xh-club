import { Injectable, Logger } from '@nestjs/common'
import { RowDataPacket } from 'mysql2'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import {
  hasAnyInviteReward,
  normalizeInviteRewards,
  parseInviteConditions,
} from './invitation-rule.util'

@Injectable()
export class InvitationEngineService {
  private readonly logger = new Logger(InvitationEngineService.name)

  /** 登录/注册时绑定推荐人并发放「新会员输入推荐码并登录」类奖励 */
  async bindReferrerOnLogin(
    inviteeId: string | number,
    inviteCodeRaw: string,
  ): Promise<{ bound: boolean; inviterId?: string; reason?: string }> {
    const inviteCode = String(inviteCodeRaw || '').trim().toUpperCase()
    if (!inviteCode) return { bound: false, reason: 'empty_code' }

    const invitee = await queryOne<RowDataPacket>(
      'SELECT id, referrer_id FROM members WHERE id = ?',
      [inviteeId],
    )
    if (!invitee) return { bound: false, reason: 'invitee_not_found' }
    if (invitee.referrer_id) return { bound: false, reason: 'already_has_referrer' }

    const inviter = await queryOne<RowDataPacket>(
      'SELECT id, invite_code, status FROM members WHERE UPPER(invite_code) = ? LIMIT 1',
      [inviteCode],
    )
    if (!inviter) return { bound: false, reason: 'invalid_code' }
    if (String(inviter.id) === String(inviteeId)) {
      return { bound: false, reason: 'self_referral' }
    }

    const updated = await queryExecute(
      `UPDATE members
       SET referrer_id = ?,
           join_source = CASE WHEN join_source IS NULL OR join_source = '' OR join_source = 'wechat'
             THEN 'referral' ELSE join_source END,
           updated_at = NOW()
       WHERE id = ? AND referrer_id IS NULL`,
      [inviter.id, inviteeId],
    )
    if (!updated || (updated as any).affectedRows === 0) {
      return { bound: false, reason: 'bind_failed' }
    }

    let recordId: string | number | null = null
    const existingRecord = await queryOne<RowDataPacket>(
      'SELECT id FROM invitation_records WHERE invitee_id = ? LIMIT 1',
      [inviteeId],
    )
    if (existingRecord?.id) {
      recordId = existingRecord.id
      await queryExecute(
        `UPDATE invitation_records
         SET inviter_id = ?, invitation_code = ?, status = 'accepted', accepted_at = NOW()
         WHERE id = ?`,
        [inviter.id, inviteCode, recordId],
      )
    } else {
      const insert = await queryExecute(
        `INSERT INTO invitation_records
           (inviter_id, invitee_id, invitation_code, status, accepted_at, created_at)
         VALUES (?, ?, ?, 'accepted', NOW(), NOW())`,
        [inviter.id, inviteeId, inviteCode],
      )
      recordId = (insert as any)?.insertId || null
    }

    if (recordId) {
      await this.grantRegisterLoginRewards(String(inviter.id), String(inviteeId), recordId, inviteCode)
    }

    return { bound: true, inviterId: String(inviter.id) }
  }

  private ruleMatchesRegisterLogin(rule: RowDataPacket): boolean {
    const conditions = parseInviteConditions(rule.conditions)
    if (!conditions.length) return true
    return conditions.some((item) => item.code === 'invitee_register_login')
  }

  private async grantRegisterLoginRewards(
    inviterId: string,
    inviteeId: string,
    recordId: string | number,
    inviteCode: string,
  ) {
    try {
      const rules = await queryRows<RowDataPacket>(
        `SELECT * FROM invitation_reward_rules
         WHERE is_active = 1
           AND (start_date IS NULL OR start_date <= NOW())
           AND (end_date IS NULL OR end_date >= NOW())
         ORDER BY id ASC`,
      )

      let totalPoints = 0
      let totalContribution = 0
      let totalGrowth = 0

      for (const raw of rules) {
        if (!this.ruleMatchesRegisterLogin(raw)) continue

        const rewards = normalizeInviteRewards(raw)
        if (!hasAnyInviteReward(rewards)) continue

        if (Number(raw.max_rewards) > 0) {
          const granted = await queryOne<RowDataPacket>(
            'SELECT COUNT(*) AS cnt FROM invitation_rewards WHERE rule_id = ? AND member_id = ?',
            [raw.id, inviterId],
          )
          if (Number(granted?.cnt || 0) >= Number(raw.max_rewards)) continue
        }

        if (rewards.points_value > 0) {
          totalPoints += rewards.points_value
          await this.insertInvitationReward(recordId, inviterId, raw.id, 'points', rewards.points_value, '推荐新会员登录奖励积分')
        }
        if (rewards.contribution_value > 0) {
          totalContribution += rewards.contribution_value
          await this.insertInvitationReward(
            recordId,
            inviterId,
            raw.id,
            'contribution',
            rewards.contribution_value,
            '推荐新会员登录奖励贡献值',
          )
        }
        totalGrowth += rewards.growth_value
      }

      if (totalPoints > 0) {
        const member = await queryOne<RowDataPacket>(
          'SELECT available_points, total_points FROM members WHERE id = ?',
          [inviterId],
        )
        const before = Number(member?.available_points || 0)
        const after = before + totalPoints
        const total = Number(member?.total_points || 0) + totalPoints
        await queryExecute(
          'UPDATE members SET available_points = ?, total_points = ?, updated_at = NOW() WHERE id = ?',
          [after, total, inviterId],
        )
        try {
          await queryExecute(
            `INSERT INTO points_records (member_id, type, amount, balance, source, source_id, description)
             VALUES (?, 'earn', ?, ?, 'invite_register', ?, ?)`,
            [inviterId, totalPoints, after, inviteeId, `推荐码 ${inviteCode} 新会员登录奖励`],
          )
        } catch (error) {
          this.logger.warn(`points_records insert failed: ${(error as Error)?.message}`)
        }
      }

      if (totalContribution > 0 || totalGrowth > 0) {
        await queryExecute(
          `UPDATE members
           SET contribution_score = contribution_score + ?,
               active_score = active_score + ?,
               updated_at = NOW()
           WHERE id = ?`,
          [totalContribution, totalGrowth, inviterId],
        )
      }

      if (totalPoints > 0 || totalContribution > 0) {
        await queryExecute(
          `UPDATE invitation_records
           SET status = 'rewarded',
               reward_points = reward_points + ?,
               reward_contribution = reward_contribution + ?,
               rewarded_at = NOW()
           WHERE id = ?`,
          [totalPoints, totalContribution, recordId],
        )
      }
    } catch (error) {
      this.logger.error(`grantRegisterLoginRewards failed inviter=${inviterId} invitee=${inviteeId}`, error)
    }
  }

  private async insertInvitationReward(
    recordId: string | number,
    memberId: string,
    ruleId: string | number,
    rewardType: 'points' | 'contribution',
    rewardValue: number,
    description: string,
  ) {
    await queryExecute(
      `INSERT INTO invitation_rewards (record_id, member_id, reward_type, reward_value, rule_id, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [recordId, memberId, rewardType, rewardValue, ruleId, description],
    )
  }
}
