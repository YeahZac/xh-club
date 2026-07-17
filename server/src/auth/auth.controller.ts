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
    })
    return { code: 200, msg: '登录成功', data: result }
  }
}
