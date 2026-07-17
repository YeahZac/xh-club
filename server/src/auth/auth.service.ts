import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import * as https from 'https'
import { queryOne, queryExecute } from '@/storage/database/mysql-client'
import { signAuthToken } from './jwt'
import { PointsEngineService } from '@/points/points-engine.service'
import { InvitationEngineService } from '@/invitation/invitation-engine.service'

interface WeChatSessionResponse {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

interface PhoneNumberResponse {
  errcode?: number
  errmsg?: string
  phone_info?: {
    phoneNumber?: string
    purePhoneNumber?: string
    countryCode?: string
  }
}

export interface WxLoginInput {
  code?: string
  openidFromHeader?: string
  avatar?: string
  nickname?: string
  phoneCode?: string
  phoneCloudId?: string
  inviteCode?: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly pointsEngine: PointsEngineService,
    private readonly invitationEngine: InvitationEngineService,
  ) {}

  async wxLogin(input: WxLoginInput) {
    try {
      const openid =
        (input.openidFromHeader || '').trim()
        || (input.code ? await this.exchangeCodeForOpenid(input.code) : '')

      if (!openid) {
        throw new HttpException(
          '无法识别微信用户，请在小程序内重新打开后登录',
          HttpStatus.UNAUTHORIZED,
        )
      }

      const safeName = String(input.nickname || '').trim() || '微信用户'
      const safeAvatar = String(input.avatar || '').trim()

      let phone = ''
      if (input.phoneCode?.trim()) {
        phone = await this.exchangePhoneCode(input.phoneCode.trim(), openid)
      } else if (input.phoneCloudId?.trim()) {
        phone = await this.exchangePhoneCloudId(input.phoneCloudId.trim(), openid)
      }

      if (!phone) {
        throw new HttpException('请授权微信手机号后再登录', HttpStatus.BAD_REQUEST)
      }

      const existing = await queryOne(
        'SELECT id, name, avatar, phone FROM members WHERE wx_openid = ?',
        [openid],
      )

      if (existing) {
        const memberId = (existing as any).id
        const updates: string[] = ['updated_at = NOW()', 'phone = ?']
        const params: any[] = [phone]

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
        await this.tryBindInviteCode(memberId, input.inviteCode)
        return this.buildLoginResult(memberId, openid)
      }

      // 若手机号已被旧账号占用，优先绑定到当前 openid
      const byPhone = await queryOne('SELECT id, wx_openid FROM members WHERE phone = ?', [phone])
      if (byPhone) {
        const memberId = (byPhone as any).id
        await queryExecute(
          `UPDATE members SET wx_openid = ?, name = COALESCE(NULLIF(name, ''), ?),
           avatar = COALESCE(avatar, ?), updated_at = NOW() WHERE id = ?`,
          [openid, safeName, safeAvatar || null, memberId],
        )
        await this.tryBindInviteCode(memberId, input.inviteCode)
        return this.buildLoginResult(memberId, openid)
      }

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
      const memberId = (newMember as any)?.id
      if (memberId) {
        await this.tryBindInviteCode(memberId, input.inviteCode)
      }
      return this.buildLoginResult(memberId, (newMember as any)?.wx_openid)
    } catch (error) {
      console.error('[AuthService] wxLogin error:', JSON.stringify(error))
      console.error('[AuthService] wxLogin error details:', error?.message, error?.cause)
      throw error
    }
  }

  private async tryBindInviteCode(memberId: string | number, inviteCodeRaw?: string) {
    const inviteCode = String(inviteCodeRaw || '').trim()
    if (!inviteCode || !memberId) return null
    try {
      return await this.invitationEngine.bindReferrerOnLogin(memberId, inviteCode)
    } catch (error) {
      console.warn('[AuthService] bind invite code failed:', error)
      return null
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

  /**
   * 云托管推荐：用 HTTP 调 api.weixin.qq.com（开放接口服务），避免 HTTPS 自签证书错误。
   * 需要 access_token 的接口：云托管可传空 access_token= 由平台注入；否则用 AppSecret 换取。
   */
  private accessTokenCache: { token: string; expireAt: number } | null = null

  private async weixinFetch(url: string, init?: RequestInit): Promise<any> {
    const httpUrl = url.replace(/^https:\/\//i, 'http://')
    try {
      const response = await fetch(httpUrl, init)
      const text = await response.text()
      let json: any = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }

      if (!response.ok) {
        console.error('[AuthService] weixinFetch HTTP error', {
          url: httpUrl,
          status: response.status,
          body: text.slice(0, 500),
        })
        const tip =
          json?.errmsg
          || json?.message
          || `微信接口 HTTP ${response.status}`
        throw new HttpException(
          String(tip).includes('access_token')
            ? '微信 access_token 无效，请检查开放接口服务权限或 AppSecret'
            : '微信服务暂不可用',
          HttpStatus.BAD_GATEWAY,
        )
      }

      if (json && typeof json.errcode === 'number' && json.errcode !== 0) {
        console.error('[AuthService] weixinFetch biz error', { url: httpUrl, json })
      }
      return json
    } catch (error: any) {
      if (error instanceof HttpException) throw error
      const errCode = String(error?.cause?.code || error?.code || '')
      const errMsg = String(error?.message || '')
      if (errCode.includes('CERT') || errMsg.includes('fetch failed') || errMsg.includes('certificate')) {
        console.warn('[AuthService] HTTP 微信接口失败，尝试 HTTPS 兜底', errCode || errMsg)
        return await this.weixinFetchHttpsInsecure(url.replace(/^http:\/\//i, 'https://'), init)
      }
      throw error
    }
  }

  /** HTTPS 兜底：忽略自签证书（仅云托管/代理异常时使用） */
  private weixinFetchHttpsInsecure(url: string, init?: RequestInit): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(url)
        const body = typeof init?.body === 'string' ? init.body : init?.body ? JSON.stringify(init.body) : undefined
        const headers: Record<string, string> = {
          ...(init?.headers as Record<string, string> | undefined),
        }
        if (body && !headers['content-type'] && !headers['Content-Type']) {
          headers['content-type'] = 'application/json'
        }
        const req = https.request(
          {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: `${parsed.pathname}${parsed.search}`,
            method: (init?.method || 'GET').toUpperCase(),
            headers,
            rejectUnauthorized: false,
          },
          (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            res.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8')
              if ((res.statusCode || 500) >= 400) {
                console.error('[AuthService] weixin HTTPS error', {
                  url,
                  status: res.statusCode,
                  body: text.slice(0, 500),
                })
                reject(new HttpException('微信服务暂不可用', HttpStatus.BAD_GATEWAY))
                return
              }
              try {
                resolve(JSON.parse(text))
              } catch (e) {
                reject(e)
              }
            })
          },
        )
        req.on('error', reject)
        if (body) req.write(body)
        req.end()
      } catch (e) {
        reject(e)
      }
    })
  }

  /** 获取接口调用凭据；云托管开放接口服务下也可先试空 token 由平台注入 */
  private async getAccessToken(forceRefresh = false): Promise<string> {
    if (
      !forceRefresh
      && this.accessTokenCache
      && this.accessTokenCache.expireAt > Date.now() + 60_000
    ) {
      return this.accessTokenCache.token
    }

    const appId = process.env.WX_APP_ID
    const appSecret = process.env.WX_APP_SECRET
    if (!appId || !appSecret) {
      throw new HttpException(
        '微信登录配置不完整，请在云托管配置 WX_APP_ID / WX_APP_SECRET',
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    const data = await this.weixinFetch(
      `http://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`,
    )

    if (!data?.access_token) {
      console.error('[AuthService] getAccessToken failed:', data)
      const tip = data?.errcode
        ? `获取微信凭据失败（${data.errcode}${data.errmsg ? `: ${data.errmsg}` : ''}）`
        : '获取微信凭据失败，请检查 AppSecret 与开放接口服务'
      throw new HttpException(tip, HttpStatus.BAD_GATEWAY)
    }

    this.accessTokenCache = {
      token: String(data.access_token),
      expireAt: Date.now() + (Number(data.expires_in || 7200) - 120) * 1000,
    }
    return this.accessTokenCache.token
  }

  private buildWeixinApiUrl(pathAndQuery: string, accessToken: string): string {
    const base = pathAndQuery.startsWith('http')
      ? pathAndQuery
      : `http://api.weixin.qq.com${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`
    const cleaned = base
      .replace(/([?&])access_token=[^&]*/gi, '$1')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '')
    const join = cleaned.includes('?') ? '&' : '?'
    return `${cleaned}${join}access_token=${encodeURIComponent(accessToken)}`
  }

  private async exchangeCodeForOpenid(code: string): Promise<string> {
    const appId = process.env.WX_APP_ID
    const appSecret = process.env.WX_APP_SECRET
    if (!appId || !appSecret) {
      throw new HttpException(
        '微信登录配置不完整，请在云托管配置 WX_APP_ID / WX_APP_SECRET',
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    const params = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    })
    const session = await this.weixinFetch(
      `http://api.weixin.qq.com/sns/jscode2session?${params}`,
    ) as WeChatSessionResponse

    if (!session.openid) {
      const codeHint: Record<number, string> = {
        40029: '登录码无效，请重试',
        40163: '登录码已使用，请重试',
        40125: '小程序密钥配置错误，请检查 WX_APP_SECRET',
        40013: '小程序 AppID 无效',
        45011: '操作过于频繁，请稍后再试',
      }
      const tip = session.errcode
        ? (codeHint[session.errcode] || `微信登录失败（${session.errcode}）`)
        : '微信登录失败'
      console.error('[AuthService] jscode2session failed:', session)
      throw new HttpException(tip, HttpStatus.UNAUTHORIZED)
    }
    return session.openid
  }

  /** 新版手机号组件：detail.code → getuserphonenumber（必须带 access_token） */
  private async exchangePhoneCode(phoneCode: string, _openid: string): Promise<string> {
    const callApi = async (token: string) =>
      (await this.weixinFetch(
        this.buildWeixinApiUrl('/wxa/business/getuserphonenumber', token),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: phoneCode }),
        },
      )) as PhoneNumberResponse

    let data: PhoneNumberResponse
    try {
      // 优先用 AppSecret 换取真实 token（云托管开放接口 HTTP 通道）
      const token = await this.getAccessToken()
      data = await callApi(token)
    } catch (error) {
      // 兜底：部分环境下由云托管注入空 access_token
      console.warn('[AuthService] credential phone lookup failed, try empty access_token', error)
      data = await callApi('')
    }

    // token 失效时刷新重试一次
    if (
      data?.errcode === 40001
      || data?.errcode === 40014
      || data?.errcode === 42001
    ) {
      const token = await this.getAccessToken(true)
      data = await callApi(token)
    }

    const phone = data?.phone_info?.purePhoneNumber || data?.phone_info?.phoneNumber || ''
    if (!phone) {
      console.error('[AuthService] getuserphonenumber failed:', data)
      const tip = data?.errcode
        ? `手机号授权失败（${data.errcode}${data.errmsg ? `: ${data.errmsg}` : ''}）`
        : '手机号授权失败，请重试'
      throw new HttpException(tip, HttpStatus.BAD_REQUEST)
    }
    return phone
  }

  /** 旧版/云调用：cloudID → getopendata */
  private async exchangePhoneCloudId(cloudId: string, openid: string): Promise<string> {
    const token = await this.getAccessToken()
    const data = await this.weixinFetch(
      this.buildWeixinApiUrl(`/wxa/getopendata?openid=${encodeURIComponent(openid)}`, token),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cloudid_list: [cloudId] }),
      },
    )

    const list = data?.data_list || data?.data || []
    const raw = Array.isArray(list) ? list[0] : null
    let parsed: any = raw
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }
    }
    const phone =
      parsed?.data?.phoneNumber
      || parsed?.phoneNumber
      || parsed?.purePhoneNumber
      || ''
    if (!phone) {
      console.error('[AuthService] getopendata phone failed:', data)
      throw new HttpException('手机号授权失败，请重试', HttpStatus.BAD_REQUEST)
    }
    return String(phone)
  }
}
