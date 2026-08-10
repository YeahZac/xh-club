import { queryOne, queryRows } from '@/storage/database/mysql-client'

export type MemberStatsMetric =
  | 'invites'
  | 'events'
  | 'projects'
  | 'demands'
  | 'shares'
  | 'deals'
  | 'points'

const safeCount = async (sql: string, params: any[] = []): Promise<number> => {
  try {
    const row = await queryOne(sql, params)
    return Number((row as any)?.total ?? (row as any)?.cnt ?? 0)
  } catch {
    return 0
  }
}

const safeSum = async (sql: string, params: any[] = []): Promise<number> => {
  try {
    const row = await queryOne(sql, params)
    return Number((row as any)?.total ?? 0)
  } catch {
    return 0
  }
}

const memberDaysFrom = (createdAt?: unknown) => {
  if (!createdAt) return 0
  const ts = new Date(String(createdAt)).getTime()
  if (Number.isNaN(ts)) return 0
  return Math.max(1, Math.floor((Date.now() - ts) / 86400000) + 1)
}

const toWan = (amountYuan: number) => {
  const wan = Number(amountYuan || 0) / 10000
  if (!Number.isFinite(wan) || wan <= 0) return 0
  return Math.round(wan * 100) / 100
}

/** 会员经营数据看板聚合（小程序个人中心 + 管理台共用） */
export async function getMemberDashboardStats(memberId: string | number) {
  const id = String(memberId)
  const member = await queryOne(
    `SELECT id, name, phone, company_name, company_position, avatar,
            membership_level, user_category, status, referrer_id,
            active_score, contribution_score, credit_score,
            total_points, available_points, created_at, approved_at
     FROM members WHERE id = ?`,
    [id],
  )
  if (!member) return null

  let referrer: { id: number; name: string; phone?: string } | null = null
  if (member.referrer_id) {
    const row = await queryOne('SELECT id, name, phone FROM members WHERE id = ?', [member.referrer_id])
    if (row) {
      referrer = {
        id: Number(row.id),
        name: String(row.name || '未命名'),
        phone: row.phone ? String(row.phone) : undefined,
      }
    }
  }

  const [
    inviteCount,
    eventRegisterCount,
    roadshowRegisterCount,
    projectCount,
    demandCount,
    shareCount,
    dealSuccessCount,
    dealApprovedCount,
    dealAmountYuan,
    pointsEarnTotal,
  ] = await Promise.all([
    safeCount(
      `SELECT COUNT(DISTINCT m.id) AS total
       FROM members m
       LEFT JOIN invitation_records ir
         ON ir.invitee_id = m.id AND ir.inviter_id = ? AND ir.status = 'accepted'
       WHERE m.referrer_id = ? OR ir.id IS NOT NULL`,
      [id, id],
    ),
    safeCount('SELECT COUNT(*) AS total FROM event_registrations WHERE member_id = ?', [id]),
    safeCount('SELECT COUNT(*) AS total FROM roadshow_registrations WHERE member_id = ?', [id]),
    safeCount('SELECT COUNT(*) AS total FROM projects WHERE submitter_id = ?', [id]),
    safeCount(
      `SELECT COUNT(*) AS total FROM business_opportunities
       WHERE user_id = ? AND source = 'user'`,
      [id],
    ),
    // 分享次数：以通知文案中的发送人姓名近似统计（历史数据无 from_member_id）
    safeCount(
      `SELECT COUNT(*) AS total FROM notifications n
       INNER JOIN members m ON m.id = ?
       WHERE n.biz_type = 'project_share'
         AND n.content LIKE CONCAT(IFNULL(m.name, ''), '%')`,
      [id],
    ),
    safeCount(
      `SELECT COUNT(*) AS total FROM project_deal_applications
       WHERE is_deal = 1 AND (member_id = ? OR owner_member_id = ?)`,
      [id, id],
    ),
    safeCount(
      `SELECT COUNT(*) AS total FROM project_deal_applications
       WHERE audit_status = 'approved' AND (member_id = ? OR owner_member_id = ?)`,
      [id, id],
    ),
    safeSum(
      `SELECT COALESCE(SUM(contract_amount), 0) AS total FROM project_deal_applications
       WHERE is_deal = 1 AND (member_id = ? OR owner_member_id = ?)`,
      [id, id],
    ),
    safeSum(
      `SELECT COALESCE(SUM(COALESCE(amount, points, 0)), 0) AS total
       FROM points_records
       WHERE member_id = ? AND type = 'earn'`,
      [id],
    ),
  ])

  const eventCount = eventRegisterCount + roadshowRegisterCount
  const dealAmountWan = toWan(dealAmountYuan)
  const memberDays = memberDaysFrom(member.approved_at || member.created_at)

  return {
    member: {
      id: member.id,
      name: member.name || '',
      phone: member.phone || '',
      company_name: member.company_name || '',
      company_position: member.company_position || '',
      avatar: member.avatar || '',
      membership_level: member.membership_level || 'normal',
      user_category: member.user_category || 'normal',
      status: member.status || '',
      created_at: member.created_at,
      approved_at: member.approved_at,
    },
    referrer,
    summary: {
      member_days: memberDays,
      invite_count: inviteCount,
      total_points: Number(member.total_points || 0),
      available_points: Number(member.available_points || 0),
      points_earn_total: pointsEarnTotal || Number(member.total_points || 0),
      growth_value: Number(member.active_score || 0),
      contribution_value: Number(member.contribution_score || 0),
      credit_score: Number(member.credit_score || 0),
      event_count: eventCount,
      project_count: projectCount,
      demand_count: demandCount,
      share_count: shareCount,
      /** 成功对接/成交项目数（is_deal=1） */
      deal_success_count: dealSuccessCount,
      /** 已同意对接数（含未最终成交） */
      deal_approved_count: dealApprovedCount,
      deal_amount: dealAmountYuan,
      deal_amount_wan: dealAmountWan,
      // 兼容旧字段
      match_count: dealSuccessCount,
      total_transaction_amount: dealAmountYuan,
      deal_count: dealSuccessCount,
    },
  }
}

/** 看板下钻明细 */
export async function getMemberDashboardDetails(
  memberId: string | number,
  metric: MemberStatsMetric,
  limit = 50,
) {
  const id = String(memberId)
  const take = Math.min(100, Math.max(1, Number(limit) || 50))

  switch (metric) {
    case 'invites':
      return queryRows(
        `SELECT DISTINCT m.id, m.name, m.phone, m.company_name, m.created_at, m.status
         FROM members m
         LEFT JOIN invitation_records ir
           ON ir.invitee_id = m.id AND ir.inviter_id = ? AND ir.status = 'accepted'
         WHERE m.referrer_id = ? OR ir.id IS NOT NULL
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [id, id, take],
      )
    case 'events': {
      const events = await queryRows(
        `SELECT er.id, e.title, 'activity' AS kind, er.created_at
         FROM event_registrations er
         LEFT JOIN events e ON e.id = er.event_id
         WHERE er.member_id = ?
         ORDER BY er.created_at DESC
         LIMIT ?`,
        [id, take],
      ).catch(() => [])
      const roadshows = await queryRows(
        `SELECT rr.id, b.title, 'roadshow' AS kind, rr.created_at
         FROM roadshow_registrations rr
         LEFT JOIN business_opportunities b ON b.id = rr.business_id
         WHERE rr.member_id = ?
         ORDER BY rr.created_at DESC
         LIMIT ?`,
        [id, take],
      ).catch(() => [])
      return [...(events || []), ...(roadshows || [])]
        .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, take)
    }
    case 'projects':
      return queryRows(
        `SELECT id, title, audit_status, status, created_at
         FROM projects WHERE submitter_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [id, take],
      )
    case 'demands':
      return queryRows(
        `SELECT id, title, category, audit_status, status, created_at
         FROM business_opportunities
         WHERE user_id = ? AND source = 'user'
         ORDER BY created_at DESC LIMIT ?`,
        [id, take],
      )
    case 'shares':
      return queryRows(
        `SELECT n.id, n.title, n.content, n.biz_id AS project_id, n.created_at
         FROM notifications n
         INNER JOIN members m ON m.id = ?
         WHERE n.biz_type = 'project_share'
           AND n.content LIKE CONCAT(IFNULL(m.name, ''), '%')
         ORDER BY n.created_at DESC
         LIMIT ?`,
        [id, take],
      )
    case 'deals':
      return queryRows(
        `SELECT d.id, d.project_name, d.contract_amount, d.deal_time, d.is_deal,
                d.audit_status, d.payment_status, d.member_id, d.owner_member_id,
                m.name AS member_name, o.name AS owner_name, d.updated_at
         FROM project_deal_applications d
         LEFT JOIN members m ON m.id = d.member_id
         LEFT JOIN members o ON o.id = d.owner_member_id
         WHERE d.member_id = ? OR d.owner_member_id = ?
         ORDER BY d.updated_at DESC
         LIMIT ?`,
        [id, id, take],
      )
    case 'points':
      return queryRows(
        `SELECT id, type, COALESCE(amount, points, 0) AS amount, description, source, created_at
         FROM points_records
         WHERE member_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [id, take],
      )
    default:
      return []
  }
}
