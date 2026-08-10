import { queryExecute, queryOne } from '@/storage/database/mysql-client'
import type { RowDataPacket } from 'mysql2'

export type PointsRecordType = 'earn' | 'spend'

export interface InsertPointsRecordInput {
  memberId: string | number
  type: PointsRecordType
  points: number
  balanceAfter: number
  source?: string
  sourceId?: string | number | null
  description?: string
}

/**
 * 写入积分流水，兼容旧表（points NOT NULL）与新列（amount/balance/balance_after/source）。
 * 多套 SQL 依次尝试，避免因表结构差异导致「余额变了但明细空白」。
 */
export async function insertPointsRecord(input: InsertPointsRecordInput): Promise<boolean> {
  const memberId = Number(input.memberId)
  const points = Math.abs(Number(input.points) || 0)
  if (!Number.isFinite(memberId) || memberId <= 0 || points <= 0) return false

  const type = input.type === 'spend' ? 'spend' : 'earn'
  const balanceAfter = Number(input.balanceAfter) || 0
  const source = String(input.source || '').trim() || (type === 'spend' ? 'spend' : 'earn')
  const sourceId =
    input.sourceId == null || input.sourceId === ''
      ? null
      : String(input.sourceId)
  const description =
    String(input.description || '').trim()
    || (type === 'spend' ? '积分支出' : '积分收入')

  const attempts: Array<{ sql: string; params: any[] }> = [
    {
      sql: `INSERT INTO points_records
              (member_id, type, points, amount, balance, balance_after, source, source_id, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [memberId, type, points, points, balanceAfter, balanceAfter, source, sourceId, description],
    },
    {
      sql: `INSERT INTO points_records
              (member_id, type, amount, balance, source, source_id, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [memberId, type, points, balanceAfter, source, sourceId, description],
    },
    {
      sql: `INSERT INTO points_records (member_id, type, points, description)
            VALUES (?, ?, ?, ?)`,
      params: [memberId, type, points, description],
    },
  ]

  for (const attempt of attempts) {
    try {
      await queryExecute(attempt.sql, attempt.params)
      return true
    } catch {
      // try next shape
    }
  }
  return false
}

/** 若会员有积分余额但流水为空，补一条「历史积分入账」，让明细与账户打通 */
export async function ensurePointsRecordsReconciled(memberId: string | number): Promise<void> {
  const id = Number(memberId)
  if (!Number.isFinite(id) || id <= 0) return

  const member = await queryOne<RowDataPacket>(
    'SELECT id, total_points, available_points FROM members WHERE id = ? LIMIT 1',
    [id],
  )
  if (!member) return

  const totalPoints = Number(member.total_points || 0)
  const available = Number(member.available_points || 0)
  if (totalPoints <= 0 && available <= 0) return

  const countRow = await queryOne<RowDataPacket>(
    'SELECT COUNT(*) AS total FROM points_records WHERE member_id = ?',
    [id],
  )
  if (Number((countRow as any)?.total || 0) > 0) return

  const earnAmount = Math.max(totalPoints, available)
  if (earnAmount <= 0) return

  await insertPointsRecord({
    memberId: id,
    type: 'earn',
    points: earnAmount,
    balanceAfter: available,
    source: 'system_reconcile',
    sourceId: id,
    description: '历史积分入账（补记明细）',
  })

  const used = Math.max(0, earnAmount - available)
  if (used > 0) {
    await insertPointsRecord({
      memberId: id,
      type: 'spend',
      points: used,
      balanceAfter: available,
      source: 'system_reconcile',
      sourceId: id,
      description: '历史积分支出（补记明细）',
    })
  }
}
