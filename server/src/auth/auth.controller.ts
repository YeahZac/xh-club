import { BadRequestException, Controller, Post, Body, HttpCode } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wx-login')
  @HttpCode(200)
  async wxLogin(@Body() dto: { code: string; avatar?: string; nickname?: string }) {
    if (!dto.code?.trim()) throw new BadRequestException('缺少微信登录 code')
    const result = await this.authService.wxLogin(dto.code, dto.avatar || '', dto.nickname || '')
    return { code: 200, msg: '登录成功', data: result }
  }
}
