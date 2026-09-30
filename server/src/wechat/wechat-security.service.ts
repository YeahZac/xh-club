import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import * as https from 'https'
import { queryOne } from '@/storage/database/mysql-client'

/** 微信 msgSecCheck scene：1 资料 / 2 评论 / 3 论坛 / 4 社交日志 */
export type MsgSecCheckScene = 1 | 2 | 3 | 4

const SAFE_TIP = '所发布内容含违规信息'
const CHUNK_SIZE = 2400

@Injectable()
export class WechatSecurityService {
  private accessTokenCache: { token: string; expireAt: number } | null = null

  /**
   * 对会员发布的文本做内容安全校验（msgSecCheck v2）。
   * 检测不通过时统一提示「所发布内容含违规信息」。
   */
  async assertMemberTextSafe(
    memberId: string | number,
    content: string,
    scene: MsgSecCheckScene = 2,
  ): Promise<void> {
    const text = String(content || '').trim()
    if (!text) return

    const member = await queryOne(
      'SELECT wx_openid FROM members WHERE id = ? LIMIT 1',
      [memberId],
    )
    const openid = String(member?.wx_openid || '').trim()
    if (!openid) {
      throw new HttpException('请重新登录后再发布', HttpStatus.UNAUTHORIZED)
    }

    const chunks = this.chunkText(text)
    for (const chunk of chunks) {
      await this.msgSecCheck({ openid, content: chunk, scene })
    }
  }

  private chunkText(text: string): string[] {
    if (text.length <= CHUNK_SIZE) return [text]
    const parts: string[] = []
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      parts.push(text.slice(i, i + CHUNK_SIZE))
    }
    return parts
  }

  private async msgSecCheck(input: {
    openid: string
    content: string
    scene: MsgSecCheckScene
  }): Promise<void> {
    const body = {
      version: 2,
      openid: input.openid,
      scene: input.scene,
      content: input.content,
    }

    let data: any
    try {
      const token = await this.getAccessToken()
      data = await this.weixinFetch(
        this.buildWeixinApiUrl('/wxa/msg_sec_check', token),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
    } catch (error) {
      // 云托管开放接口服务：空 access_token 由平台注入
      try {
        data = await this.weixinFetch(
          'http://api.weixin.qq.com/wxa/msg_sec_check?access_token=',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
        )
      } catch (fallbackError) {
        console.error('[WechatSecurity] msgSecCheck failed', error, fallbackError)
        throw new HttpException('内容安全检测暂不可用，请稍后重试', HttpStatus.BAD_GATEWAY)
      }
    }

    if (!data || typeof data !== 'object') {
      throw new HttpException('内容安全检测暂不可用，请稍后重试', HttpStatus.BAD_GATEWAY)
    }

    const errcode = Number(data.errcode || 0)
    // 87014：内容含违法违规信息（旧版/部分场景）
    if (errcode === 87014) {
      throw new HttpException(SAFE_TIP, HttpStatus.BAD_REQUEST)
    }
    if (errcode !== 0) {
      console.error('[WechatSecurity] msgSecCheck errcode', data)
      // 40001/42001 token 过期：刷新再试一次
      if (errcode === 40001 || errcode === 42001) {
        const token = await this.getAccessToken(true)
        data = await this.weixinFetch(
          this.buildWeixinApiUrl('/wxa/msg_sec_check', token),
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
        )
        if (Number(data?.errcode || 0) === 87014) {
          throw new HttpException(SAFE_TIP, HttpStatus.BAD_REQUEST)
        }
        if (Number(data?.errcode || 0) !== 0) {
          console.error('[WechatSecurity] msgSecCheck retry failed', data)
          throw new HttpException('内容安全检测暂不可用，请稍后重试', HttpStatus.BAD_GATEWAY)
        }
      } else {
        throw new HttpException('内容安全检测暂不可用，请稍后重试', HttpStatus.BAD_GATEWAY)
      }
    }

    const suggest = String(data?.result?.suggest || '').toLowerCase()
    if (suggest === 'risky' || suggest === 'review') {
      throw new HttpException(SAFE_TIP, HttpStatus.BAD_REQUEST)
    }
  }

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
      console.error('[WechatSecurity] getAccessToken failed:', data)
      throw new HttpException('获取微信凭据失败', HttpStatus.BAD_GATEWAY)
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
        console.error('[WechatSecurity] weixinFetch HTTP error', {
          url: httpUrl,
          status: response.status,
          body: text.slice(0, 300),
        })
        throw new HttpException('微信服务暂不可用', HttpStatus.BAD_GATEWAY)
      }
      return json
    } catch (error: any) {
      if (error instanceof HttpException) throw error
      const errCode = String(error?.cause?.code || error?.code || '')
      const errMsg = String(error?.message || '')
      if (errCode.includes('CERT') || errMsg.includes('fetch failed') || errMsg.includes('certificate')) {
        return await this.weixinFetchHttpsInsecure(url.replace(/^http:\/\//i, 'https://'), init)
      }
      throw error
    }
  }

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
}
