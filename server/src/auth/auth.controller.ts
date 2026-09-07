import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpException,
  Req,
  Headers,
  UseGuards,
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { MemberAuthGuard } from './auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private readOpenidHeader(req: any, headers: Record<string, string>) {
    return (
      headers['x-wx-openid']
      || headers['X-WX-OPENID']
      || headers['x-wx-from-openid']
      || headers['X-WX-FROM-OPENID']
      || req?.headers?.['x-wx-openid']
      || ''
    )
  }

  private httpExceptionMessage(error: HttpException): string {
    const payload = error.getResponse()
    if (typeof payload === 'string') return payload
    const msg = (payload as any)?.message
    if (Array.isArray(msg)) return String(msg[0] || '请求失败')
    if (msg) return String(msg)
    return error.message || '请求失败'
  }

  /**
   * 微信登录（云托管 callContainer 优先读 x-wx-openid，无需 jscode2session）
   * 业务错误统一 HTTP 200 + code，避免 callContainer 把 4xx 打成网络异常。
   */
  @Post('wx-login')
  @HttpCode(200)
  async wxLogin(
    @Body()
    dto: {
      code?: string
      avatar?: string
      nickname?: string
      phoneCode?: string
      phoneCloudId?: string
      inviteCode?: string
      mode?: 'quick' | 'register'
    },
    @Req() req: any,
    @Headers() headers: Record<string, string>,
  ) {
    const openidHeader = this.readOpenidHeader(req, headers)

    console.log(
      '[AuthController] wx-login openidHeader:',
      openidHeader ? 'yes' : 'no',
      'code:',
      !!dto.code,
      'mode:',
      dto.mode || 'register',
    )

    try {
      const result = await this.authService.wxLogin({
        code: dto.code,
        openidFromHeader: openidHeader ? String(openidHeader) : '',
        avatar: dto.avatar || '',
        nickname: dto.nickname || '',
        phoneCode: dto.phoneCode || '',
        phoneCloudId: dto.phoneCloudId || '',
        inviteCode: dto.inviteCode || '',
        mode: dto.mode,
      })
      return { code: 200, msg: '登录成功', data: result }
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus()
        const msg = this.httpExceptionMessage(error)
        console.warn('[AuthController] wx-login business error:', status, msg)
        return { code: status, msg, data: null }
      }
      const msg = String((error as Error)?.message || '登录失败，请稍后重试')
      console.error('[AuthController] wx-login unexpected error:', error)
      // 统一 HTTP 200，避免 callContainer 把 5xx 打成「加载失败」
      return { code: 500, msg: msg.slice(0, 80), data: null }
    }
  }

  /** 登录页预检：是否已注册（决定能否填写推荐码） */
  @Post('wx-precheck')
  @HttpCode(200)
  async wxPrecheck(
    @Body() dto: { code?: string },
    @Req() req: any,
    @Headers() headers: Record<string, string>,
  ) {
    const openidHeader =
      headers['x-wx-openid']
      || headers['X-WX-OPENID']
      || headers['x-wx-from-openid']
      || headers['X-WX-FROM-OPENID']
      || req?.headers?.['x-wx-openid']

    try {
      const data = await this.authService.wxPrecheck({
        code: dto.code,
        openidFromHeader: openidHeader ? String(openidHeader) : '',
      })
      return { code: 200, msg: 'success', data }
    } catch (error) {
      console.warn('[AuthController] wx-precheck failed:', (error as Error)?.message || error)
      return {
        code: 200,
        msg: 'success',
        data: {
          registered: false,
          can_fill_invite: true,
          can_quick_login: false,
          openid: '',
          name: '',
          avatar: '',
          phone_masked: '',
        },
      }
    }
  }

  /** 已登录用户绑定邀请码（扫码进入且本地已登录） */
  @Post('bind-invite')
  @HttpCode(200)
  @UseGuards(MemberAuthGuard)
  async bindInvite(
    @Body() dto: { inviteCode?: string },
    @Req() request: any,
  ) {
    try {
      const data = await this.authService.bindInviteCodeForMember(
        request.user.sub,
        dto?.inviteCode || '',
      )
      return {
        code: 200,
        msg: data.bound ? '推荐关系已绑定' : (data.reason === 'already_has_referrer' ? '已绑定过推荐人' : '未完成绑定'),
        data,
      }
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus()
        const msg = this.httpExceptionMessage(error)
        return { code: status, msg, data: null }
      }
      const msg = String((error as Error)?.message || '绑定失败')
      return { code: 500, msg: msg.slice(0, 80), data: null }
    }
  }
}
