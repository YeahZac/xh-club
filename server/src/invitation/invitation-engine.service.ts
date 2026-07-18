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

  private ruleMatchesCondition(rule: RowDataPacket, conditionCode: string): boolean {
    const conditions = parseInviteConditions(rule.conditions)
    if (!conditions.length) {
      return conditionCode === 'invitee_register_login'
    }
    return conditions.some((item) => item.code === conditionCode)
  }

  /**
   * 被邀请人完成某类行为后，给邀请人发放对应「邀请奖励」条件的奖励。
   * conditionCode: invitee_register_login / invitee_event / invitee_deal /
   * invitee_talent / invitee_mall_order / invitee_paid_member
   */
  async grantConditionRewards(
    inviteeId: string | number,
    conditionCode: string,
    options?: { description?: string; referenceId?: string | number },
  ) {
    try {
      const invitee = await queryOne<RowDataPacket>(
        'SELECT id, referrer_id FROM members WHERE id = ?',
        [inviteeId],
      )
      if (!invitee?.referrer_id) return { granted: false, reason: 'no_referrer' }

      const inviterId = String(invitee.referrer_id)
      let record = await queryOne<RowDataPacket>(
        'SELECT id, invitation_code FROM invitation_records WHERE invitee_id = ? LIMIT 1',
        [inviteeId],
      )
      if (!record) {
        const insert = await queryExecute(
          `INSERT INTO invitation_records
             (inviter_id, invitee_id, invitation_code, status, accepted_at, created_at)
           VALUES (?, ?, '', 'accepted', NOW(), NOW())`,
          [inviterId, inviteeId],
        )
        record = { id: (insert as any)?.insertId, invitation_code: '' } as RowDataPacket
      }

      const recordId = Number((record as RowDataPacket).id)
      const inviteCode = String((record as RowDataPacket).invitation_code || '')
      return await this.applyInviteRules(inviterId, String(inviteeId), recordId, conditionCode, {
        inviteCode,
        description: options?.description,
        source: conditionCode,
      })
    } catch (error) {
      this.logger.error(
        `grantConditionRewards failed invitee=${inviteeId} condition=${conditionCode}`,
        error,
      )
      return { granted: false, reason: 'error' }
    }
  }

  private async grantRegisterLoginRewards(
    inviterId: string,
    inviteeId: string,
    recordId: string | number,
    inviteCode: string,
  ) {
    await this.applyInviteRules(inviterId, inviteeId, recordId, 'invitee_register_login', {
      inviteCode,
      description: '推荐新会员登录奖励',
      source: 'invite_register',
    })
  }

  private async applyInviteRules(
    inviterId: string,
    inviteeId: string,
    recordId: string | number,
    conditionCode: string,
    meta: { inviteCode?: string; description?: string; source?: string },
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
      const descBase = meta.description || conditionCode

      for (const raw of rules) {
        if (!this.ruleMatchesCondition(raw, conditionCode)) continue

        const rewards = normalizeInviteRewards(raw)
        if (!hasAnyInviteReward(rewards)) continue

        // 同一规则 + 同一被邀请人 + 同一条件只发一次
        const dup = await queryOne<RowDataPacket>(
          `SELECT id FROM invitation_rewards
           WHERE rule_id = ? AND member_id = ? AND description LIKE ?
           LIMIT 1`,
          [raw.id, inviterId, `%${conditionCode}%${inviteeId}%`],
        )
        if (dup) continue

        if (Number(raw.max_rewards) > 0) {
          const granted = await queryOne<RowDataPacket>(
            'SELECT COUNT(*) AS cnt FROM invitation_rewards WHERE rule_id = ? AND member_id = ?',
            [raw.id, inviterId],
          )
          if (Number(granted?.cnt || 0) >= Number(raw.max_rewards)) continue
        }

        const detailDesc = `${descBase}(${conditionCode}/invitee:${inviteeId})`
        if (rewards.points_value > 0) {
          totalPoints += rewards.points_value
          await this.insertInvitationReward(
            recordId,
            inviterId,
            raw.id,
            'points',
            rewards.points_value,
            detailDesc,
          )
        }
        if (rewards.contribution_value > 0) {
          totalContribution += rewards.contribution_value
          await this.insertInvitationReward(
            recordId,
            inviterId,
            raw.id,
            'contribution',
            rewards.contribution_value,
            detailDesc,
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
             VALUES (?, 'earn', ?, ?, ?, ?, ?)`,
            [
              inviterId,
              totalPoints,
              after,
              meta.source || conditionCode,
              inviteeId,
              `${descBase}${meta.inviteCode ? ` 推荐码 ${meta.inviteCode}` : ''}`,
            ],
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
               reward_points = IFNULL(reward_points, 0) + ?,
               reward_contribution = IFNULL(reward_contribution, 0) + ?,
               rewarded_at = NOW()
           WHERE id = ?`,
          [totalPoints, totalContribution, recordId],
        )
      }

      return {
        granted: totalPoints > 0 || totalContribution > 0 || totalGrowth > 0,
        points: totalPoints,
        contribution: totalContribution,
        growth: totalGrowth,
      }
    } catch (error) {
      this.logger.error(
        `applyInviteRules failed inviter=${inviterId} invitee=${inviteeId} condition=${conditionCode}`,
        error,
      )
      return { granted: false, reason: 'error' }
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
