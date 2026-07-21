import {
  Controller,
  Post,
  Body,
  HttpCode,
  Req,
  Headers,
} from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 微信登录（云托管 callContainer 优先读 x-wx-openid，无需 jscode2session）
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
    },
    @Req() req: any,
    @Headers() headers: Record<string, string>,
  ) {
    const openidHeader =
      headers['x-wx-openid']
      || headers['X-WX-OPENID']
      || headers['x-wx-from-openid']
      || headers['X-WX-FROM-OPENID']
      || req?.headers?.['x-wx-openid']

    console.log('[AuthController] wx-login openidHeader:', openidHeader ? 'yes' : 'no', 'code:', !!dto.code)

    const result = await this.authService.wxLogin({
      code: dto.code,
      openidFromHeader: openidHeader ? String(openidHeader) : '',
      avatar: dto.avatar || '',
      nickname: dto.nickname || '',
      phoneCode: dto.phoneCode || '',
      phoneCloudId: dto.phoneCloudId || '',
      inviteCode: dto.inviteCode || '',
    })
    return { code: 200, msg: '登录成功', data: result }
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

    const data = await this.authService.wxPrecheck({
      code: dto.code,
      openidFromHeader: openidHeader ? String(openidHeader) : '',
    })
    return { code: 200, msg: 'success', data }
  }
}
