import { Controller, Post, Body, HttpCode } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wx-login')
  @HttpCode(200)
  async wxLogin(@Body() dto: { code: string; avatar: string; nickname: string; member_id?: string }) {
    console.log('[AuthController] POST /api/auth/wx-login')
    console.log('[AuthController] body:', { ...dto, code: dto.code ? dto.code.substring(0, 10) + '...' : '' })

    try {
      const result = await this.authService.wxLogin(dto.code, dto.avatar, dto.nickname, dto.member_id)
      return { code: 200, msg: '登录成功', data: result }
    } catch (error) {
      console.error('[AuthController] wx-login error:', error)
      return { code: 500, msg: '登录失败: ' + (error.message || '未知错误'), data: null }
    }
  }
}
