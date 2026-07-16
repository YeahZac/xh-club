import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { queryOne, queryExecute } from '@/storage/database/mysql-client'
import { signAuthToken } from './jwt'
import { PointsEngineService } from '@/points/points-engine.service'

interface WeChatSessionResponse {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

@Injectable()
export class AuthService {
  constructor(private readonly pointsEngine: PointsEngineService) {}

  async wxLogin(code: string, avatar: string, nickname: string) {
    try {
      const openid = await this.exchangeCodeForOpenid(code)

      // Try to find existing member by openid
      const existing = await queryOne('SELECT id FROM members WHERE wx_openid = ?', [openid])
      if (existing) {
        const updates: string[] = ['updated_at = NOW()']
        const params: any[] = [(existing as any).id]
        if (avatar) { updates.push('avatar = ?'); params.splice(0, 0, avatar) }
        if (nickname) { updates.push('name = ?'); params.splice(0, 0, nickname) }
        await queryExecute(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, params)
        return this.buildLoginResult((existing as any).id, openid)
      }

      // Create new member
      const phone = `wx_${openid.substring(0, 20)}`
      await queryExecute(
        `INSERT INTO members (name, avatar, wx_openid, phone, password_hash, membership_level, member_type, status, credit_score, active_score, contribution_score, total_points, available_points)
         VALUES (?, ?, ?, ?, ?, 'normal', 'individual', 'active', 100, 0, 0, 0, 0)`,
        [nickname || '微信用户', avatar || '', openid, phone, 'wx_oauth_no_password']
      )

      const newMember = await queryOne('SELECT id, wx_openid FROM members WHERE wx_openid = ?', [openid])
      return this.buildLoginResult((newMember as any)?.id, (newMember as any)?.wx_openid)
    } catch (error) {
      console.error('[AuthService] wxLogin error:', JSON.stringify(error))
      console.error('[AuthService] wxLogin error details:', error?.message, error?.details, error?.hint)
      throw error
    }
  }

  private async buildLoginResult(memberId: string, openid: string) {
    if (memberId) {
      void this.pointsEngine
        .onMemberActive(memberId)
        .catch((err) => console.warn('[AuthService] points onMemberActive failed', err))
    }
    return {
      member_id: memberId,
      openid,
      token: signAuthToken({ sub: String(memberId), type: 'member' }),
    }
  }

  private async exchangeCodeForOpenid(code: string): Promise<string> {
    const appId = process.env.WX_APP_ID
    const appSecret = process.env.WX_APP_SECRET
    if (!appId || !appSecret) {
      throw new HttpException('微信登录配置不完整', HttpStatus.SERVICE_UNAVAILABLE)
    }

    const params = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    })
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`)
    if (!response.ok) {
      throw new HttpException('微信登录服务暂不可用', HttpStatus.BAD_GATEWAY)
    }

    const session = await response.json() as WeChatSessionResponse
    if (!session.openid) {
      throw new HttpException(
        `微信登录失败${session.errcode ? `（${session.errcode}）` : ''}`,
        HttpStatus.UNAUTHORIZED,
      )
    }
    return session.openid
  }
}
