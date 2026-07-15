import { Injectable } from '@nestjs/common'
import { queryOne, queryExecute, queryRows } from '@/storage/database/mysql-client'

@Injectable()
export class AuthService {
  async wxLogin(code: string, avatar: string, nickname: string, memberId?: string) {
    try {
      // In production, exchange code for openid via WeChat API
      // For now, generate a mock openid based on code
      const openid = `wx_${code.substring(0, 20)}`
      console.log('[AuthService] wx login - openid:', openid, 'nickname:', nickname)

      // If member_id provided, update existing member
      if (memberId) {
        const updates: string[] = ['wx_openid = ?', 'updated_at = NOW()']
        const params: any[] = [openid, memberId]
        if (avatar) { updates.push('avatar = ?'); params.splice(1, 0, avatar) }
        if (nickname) { updates.push('name = ?'); params.splice(1, 0, nickname) }

        await queryExecute(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, params)
        const member = await queryOne('SELECT id, wx_openid FROM members WHERE id = ?', [memberId])
        return { member_id: (member as any)?.id, openid: (member as any)?.wx_openid }
      }

      // Try to find existing member by openid
      const existing = await queryOne('SELECT id FROM members WHERE wx_openid = ?', [openid])
      if (existing) {
        const updates: string[] = ['updated_at = NOW()']
        const params: any[] = [(existing as any).id]
        if (avatar) { updates.push('avatar = ?'); params.splice(0, 0, avatar) }
        if (nickname) { updates.push('name = ?'); params.splice(0, 0, nickname) }
        await queryExecute(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, params)
        return { member_id: (existing as any).id, openid }
      }

      // Create new member
      const phone = `wx_${openid.substring(0, 20)}`
      await queryExecute(
        `INSERT INTO members (name, avatar, wx_openid, phone, password_hash, membership_level, member_type, status, credit_score, active_score, contribution_score, total_points, available_points)
         VALUES (?, ?, ?, ?, ?, 'normal', 'individual', 'active', 100, 0, 0, 0, 0)`,
        [nickname || '微信用户', avatar || '', openid, phone, 'wx_oauth_no_password']
      )

      const newMember = await queryOne('SELECT id, wx_openid FROM members WHERE wx_openid = ?', [openid])
      return { member_id: (newMember as any)?.id, openid: (newMember as any)?.wx_openid }
    } catch (error) {
      console.error('[AuthService] wxLogin error:', JSON.stringify(error))
      console.error('[AuthService] wxLogin error details:', error?.message, error?.details, error?.hint)
      throw error
    }
  }
}
