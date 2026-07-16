import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common'
import { MembersService } from './members.service'
import { MemberAuthGuard } from '@/auth/auth.guard'

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('register')
  async register(@Body() dto: any) {
    console.log('[MembersController] POST /api/members/register')
    const result = await this.membersService.register(dto)
    return { code: 200, msg: '注册成功', data: result }
  }

  @Post('login')
  async login(@Body() body: { phone: string; password: string }) {
    console.log('[MembersController] POST /api/members/login')
    const result = await this.membersService.login(body.phone, body.password)
    return { code: 200, msg: '登录成功', data: result }
  }

  @Get('profile/:id')
  @UseGuards(MemberAuthGuard)
  async getProfile(@Param('id') id: string, @Req() request: any) {
    this.assertOwnMember(id, request.user.sub)
    console.log('[MembersController] GET /api/members/profile/:id - id:', id)
    const result = await this.membersService.getProfile(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Put('profile/:id')
  @UseGuards(MemberAuthGuard)
  async updateProfile(@Param('id') id: string, @Body() dto: any, @Req() request: any) {
    this.assertOwnMember(id, request.user.sub)
    console.log('[MembersController] PUT /api/members/profile/:id')
    const result = await this.membersService.updateProfile(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Get()
  async getMembers(@Query() query: any) {
    console.log('[MembersController] GET /api/members')
    const result = await this.membersService.getMembers(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id/referrals')
  @UseGuards(MemberAuthGuard)
  async getReferrals(@Param('id') id: string, @Req() request: any) {
    this.assertOwnMember(id, request.user.sub)
    console.log('[MembersController] GET /api/members/:id/referrals')
    const result = await this.membersService.getReferralTree(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id/growth')
  @UseGuards(MemberAuthGuard)
  async getGrowth(@Param('id') id: string, @Req() request: any) {
    this.assertOwnMember(id, request.user.sub)
    console.log('[MembersController] GET /api/members/:id/growth')
    const result = await this.membersService.getGrowthData(id)
    return { code: 200, msg: 'success', data: result }
  }

  private assertOwnMember(memberId: string, authenticatedMemberId: string) {
    if (String(memberId) !== String(authenticatedMemberId)) {
      throw new ForbiddenException('无权访问其他会员数据')
    }
  }
}
