import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { RowDataPacket } from 'mysql2'
import { queryExecute, queryOne, queryRows } from '@/storage/database/mysql-client'
import { UploadService } from '@/upload/upload.service'
import { insertPointsRecord } from '@/points/points-record.util'
import {
  formatInviteRuleRow,
  hasAnyInviteReward,
  normalizeInviteRewards,
  parseInviteConditions,
} from './invitation-rule.util'

@Injectable()
export class InvitationEngineService implements OnModuleInit {
  private readonly logger = new Logger(InvitationEngineService.name)

  constructor(private readonly uploadService: UploadService) {}

  async onModuleInit() {
    // 部署后自动补关联历史线索（幂等，仅补无推荐人记录）
    setTimeout(() => {
      void this.backfillReferralsFromLeads()
        .then((result) => {
          this.logger.log(
            `[startup backfill] scanned=${result.scanned} linked=${result.linked} synced_logs=${result.synced_logs} skipped=${result.skipped}`,
          )
        })
        .catch((error) => {
          this.logger.warn(`[startup backfill] skipped: ${(error as Error)?.message || error}`)
        })
    }, 12000)
  }

  /** 小程序端读取启用中的邀请规则（含图文说明、条件、多奖励） */
  async getActiveRulesForClient() {
    try {
      const rows = await queryRows(
        `SELECT *
         FROM invitation_reward_rules
         WHERE is_active = 1
         ORDER BY id ASC`,
      )
      const list = (rows || []).map((row) => formatInviteRuleRow(row))
      return Promise.all(
        list.map(async (row: any) => ({
          ...row,
          content: row.content
            ? await this.uploadService.signHtmlMedia(row.content)
            : '',
        })),
      )
    } catch (error) {
      this.logger.error('getActiveRulesForClient failed', error)
      return []
    }
  }

  /** 登录/注册时绑定推荐人并发放「新会员输入推荐码并登录」类奖励 */
  async bindReferrerOnLogin(
    inviteeId: string | number,
    inviteCodeRaw: string,
    options?: { grantRewards?: boolean },
  ): Promise<{ bound: boolean; inviterId?: string; reason?: string }> {
    const inviteCode = String(inviteCodeRaw || '').trim().toUpperCase()
    if (!inviteCode) return { bound: false, reason: 'empty_code' }
    const grantRewards = options?.grantRewards !== false

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

    if (recordId && grantRewards) {
      await this.grantRegisterLoginRewards(String(inviter.id), String(inviteeId), recordId, inviteCode)
    }

    // 同步到后台「会员邀请」列表（扫码/填码绑定以前只写 referrer，后台看不到）
    await this.syncAdminInviteLog({
      inviterId: inviter.id,
      inviteeId,
      inviteCode,
      source: 'qr_login',
      boundAt: new Date(),
    }).catch((error) => {
      this.logger.warn(`syncAdminInviteLog failed: ${(error as Error)?.message || error}`)
    })

    return { bound: true, inviterId: String(inviter.id) }
  }

  /** 将扫码/填码绑定关系写入 member_invitations，供管理台「会员邀请」展示 */
  async syncAdminInviteLog(input: {
    inviterId: string | number
    inviteeId: string | number
    inviteCode: string
    source?: string
    boundAt?: Date
  }) {
    const invitee = await queryOne<RowDataPacket>(
      `SELECT id, name, phone, company_name, company_position
       FROM members WHERE id = ? LIMIT 1`,
      [input.inviteeId],
    )
    if (!invitee) return { synced: false, reason: 'invitee_not_found' }

    const phone = String(invitee.phone || '').replace(/\D/g, '')
    const name = String(invitee.name || '').trim() || '微信用户'
    const inviteCode = String(input.inviteCode || '').trim().toUpperCase()
    const source = String(input.source || 'qr_login')

    const existing = await queryOne<RowDataPacket>(
      `SELECT id, source FROM member_invitations
       WHERE inviter_id = ?
         AND (
           registered_member_id = ?
           OR (
             ? <> ''
             AND REPLACE(REPLACE(REPLACE(IFNULL(invitee_phone,''),' ',''),'-',''),'+','') = ?
           )
         )
       ORDER BY id DESC
       LIMIT 1`,
      [input.inviterId, input.inviteeId, phone, phone],
    )

    if (existing?.id) {
      await queryExecute(
        `UPDATE member_invitations
         SET invitee_name = COALESCE(NULLIF(invitee_name, ''), ?),
             invitee_phone = CASE
               WHEN invitee_phone IS NULL OR invitee_phone = '' OR invitee_phone = '未填写' THEN ?
               ELSE invitee_phone
             END,
             company_name = COALESCE(company_name, ?),
             position = COALESCE(position, ?),
             is_registered = 1,
             registered_member_id = ?,
             invite_code = COALESCE(NULLIF(invite_code, ''), ?),
             source = CASE WHEN source IS NULL OR source = '' THEN ? ELSE source END
         WHERE id = ?`,
        [
          name,
          phone || '未填写',
          invitee.company_name || null,
          invitee.company_position || null,
          input.inviteeId,
          inviteCode,
          source,
          existing.id,
        ],
      )
      return { synced: true, id: existing.id, updated: true }
    }

    const insert = await queryExecute(
      `INSERT INTO member_invitations
        (inviter_id, invite_code, invitee_name, invitee_phone, company_name, position,
         is_registered, registered_member_id, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        input.inviterId,
        inviteCode,
        name,
        phone || '未填写',
        invitee.company_name || null,
        invitee.company_position || null,
        input.inviteeId,
        source,
        input.boundAt || new Date(),
      ],
    )
    return { synced: true, id: (insert as any)?.insertId, updated: false }
  }

  /**
   * 历史补关联：
   * 1) 线索表 → 绑定 referrer_id
   * 2) invitation_records / members.referrer_id → 同步到会员邀请后台列表
   * 不补发奖励。
   */
  async backfillReferralsFromLeads(): Promise<{
    scanned: number
    linked: number
    synced_logs: number
    skipped: number
    details: Array<{ invitee_id: string; inviter_id: string; invite_code: string }>
  }> {
    const rows = await queryRows(
      `SELECT mi.id AS lead_id, mi.inviter_id, mi.invite_code, mi.invitee_phone,
              mi.registered_member_id,
              m.id AS matched_member_id, m.referrer_id AS matched_referrer_id
       FROM member_invitations mi
       LEFT JOIN members m ON (
         m.id = mi.registered_member_id
         OR REPLACE(REPLACE(REPLACE(IFNULL(m.phone,''),' ',''),'-',''),'+','')
            = REPLACE(REPLACE(REPLACE(IFNULL(mi.invitee_phone,''),' ',''),'-',''),'+','')
       )
       WHERE mi.inviter_id IS NOT NULL
         AND mi.invitee_phone IS NOT NULL
         AND TRIM(mi.invitee_phone) <> ''
       ORDER BY mi.id ASC
       LIMIT 2000`,
    )

    let scanned = 0
    let linked = 0
    let syncedLogs = 0
    let skipped = 0
    const details: Array<{ invitee_id: string; inviter_id: string; invite_code: string }> = []

    for (const row of rows || []) {
      scanned += 1
      const inviteeId = row.matched_member_id || row.registered_member_id
      const inviterId = row.inviter_id
      const inviteCode = String(row.invite_code || '').trim().toUpperCase()
      if (!inviteeId || !inviterId || !inviteCode) {
        skipped += 1
        continue
      }
      if (String(inviteeId) === String(inviterId)) {
        skipped += 1
        continue
      }
      if (row.matched_referrer_id) {
        if (!row.registered_member_id || Number(row.registered_member_id) !== Number(inviteeId)) {
          await queryExecute(
            `UPDATE member_invitations
             SET is_registered = 1, registered_member_id = ?
             WHERE id = ?`,
            [inviteeId, row.lead_id],
          ).catch(() => undefined)
        }
        skipped += 1
        continue
      }

      const result = await this.bindReferrerOnLogin(inviteeId, inviteCode, { grantRewards: false })
      if (result.bound) {
        linked += 1
        details.push({
          invitee_id: String(inviteeId),
          inviter_id: String(result.inviterId || inviterId),
          invite_code: inviteCode,
        })
        await queryExecute(
          `UPDATE member_invitations
           SET is_registered = 1, registered_member_id = ?, source = COALESCE(NULLIF(source,''), 'form')
           WHERE id = ?`,
          [inviteeId, row.lead_id],
        ).catch(() => undefined)
      } else {
        skipped += 1
      }
    }

    // 把已绑定推荐关系但未出现在会员邀请表的记录补进后台
    const boundRows = await queryRows(
      `SELECT m.id AS invitee_id, m.referrer_id AS inviter_id, m.created_at AS bound_at,
              COALESCE(NULLIF(ir.invitation_code, ''), inv.invite_code, '') AS invite_code
       FROM members m
       LEFT JOIN members inv ON inv.id = m.referrer_id
       LEFT JOIN invitation_records ir ON ir.invitee_id = m.id
       WHERE m.referrer_id IS NOT NULL
       ORDER BY m.id DESC
       LIMIT 3000`,
    )
    for (const row of boundRows || []) {
      const inviteCode = String(row.invite_code || '').trim().toUpperCase()
      if (!row.invitee_id || !row.inviter_id || !inviteCode) continue
      const synced = await this.syncAdminInviteLog({
        inviterId: row.inviter_id,
        inviteeId: row.invitee_id,
        inviteCode,
        source: 'qr_login',
        boundAt: row.bound_at ? new Date(row.bound_at) : new Date(),
      }).catch(() => null)
      if (synced?.synced && !synced.updated) syncedLogs += 1
      else if (synced?.synced) syncedLogs += 1
    }

    await this.refreshLeadRegistrationStatus()

    this.logger.log(
      `[backfillReferralsFromLeads] scanned=${scanned} linked=${linked} synced_logs=${syncedLogs} skipped=${skipped}`,
    )
    return { scanned, linked, synced_logs: syncedLogs, skipped, details }
  }

  /** 刷新线索「是否已注册」（手机号已能匹配会员却仍显示未注册） */
  async refreshLeadRegistrationStatus() {
    await queryExecute(
      `UPDATE member_invitations mi
       INNER JOIN members m
         ON m.id = mi.registered_member_id
         OR REPLACE(REPLACE(REPLACE(IFNULL(m.phone,''),' ',''),'-',''),'+','')
            = REPLACE(REPLACE(REPLACE(IFNULL(mi.invitee_phone,''),' ',''),'-',''),'+','')
       SET mi.is_registered = 1,
           mi.registered_member_id = COALESCE(mi.registered_member_id, m.id)
       WHERE mi.is_registered = 0`,
    ).catch((error) => {
      this.logger.warn(`refresh lead registration failed: ${(error as Error)?.message || error}`)
    })
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
        const recorded = await insertPointsRecord({
          memberId: inviterId,
          type: 'earn',
          points: totalPoints,
          balanceAfter: after,
          source: meta.source || conditionCode,
          sourceId: inviteeId,
          description: `${descBase}${meta.inviteCode ? ` 推荐码 ${meta.inviteCode}` : ''}`,
        })
        if (!recorded) {
          this.logger.warn(`points_records insert failed inviter=${inviterId} invitee=${inviteeId}`)
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
