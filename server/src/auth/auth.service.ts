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
      const safeName = String(nickname || '').trim() || '微信用户'
      const safeAvatar = String(avatar || '').trim()

      const existing = await queryOne(
        'SELECT id, name, avatar FROM members WHERE wx_openid = ?',
        [openid],
      )

      if (existing) {
        const memberId = (existing as any).id
        const updates: string[] = ['updated_at = NOW()']
        const params: any[] = []

        // 仅在资料为空时用微信授权信息补齐，避免覆盖已同步资料
        if (safeName && !(existing as any).name) {
          updates.push('name = ?')
          params.push(safeName)
        }
        if (safeAvatar && !(existing as any).avatar) {
          updates.push('avatar = ?')
          params.push(safeAvatar)
        }

        params.push(memberId)
        await queryExecute(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, params)
        return this.buildLoginResult(memberId, openid)
      }

      const phone = `wx_${openid.substring(0, 20)}`
      await queryExecute(
        `INSERT INTO members (
           name, avatar, wx_openid, phone, password_hash,
           membership_level, member_type, status,
           credit_score, active_score, contribution_score, total_points, available_points,
           join_source
         ) VALUES (?, ?, ?, ?, ?, 'normal', 'individual', 'active', 100, 0, 0, 0, 0, 'wechat')`,
        [safeName, safeAvatar || null, openid, phone, 'wx_oauth_no_password'],
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

    const profile = await queryOne(
      `SELECT id, name, avatar, phone, wx_openid, membership_level, member_type, status,
              available_points, total_points, credit_score, company_name, company_position
       FROM members WHERE id = ?`,
      [memberId],
    )

    return {
      member_id: memberId,
      openid,
      token: signAuthToken({ sub: String(memberId), type: 'member' }),
      profile: profile || null,
    }
  }

  private async exchangeCodeForOpenid(code: string): Promise<string> {
    const appId = process.env.WX_APP_ID
    const appSecret = process.env.WX_APP_SECRET
    if (!appId || !appSecret) {
      throw new HttpException('微信登录配置不完整，请配置 WX_APP_ID / WX_APP_SECRET', HttpStatus.SERVICE_UNAVAILABLE)
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
