import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { FeedbackService } from './feedback.service'

@Controller('feedbacks')
@UseGuards(MemberAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Req() request: any, @Body() body: any) {
    const data = await this.feedbackService.create(request.user.sub, body)
    return { code: 200, msg: '提交成功', data }
  }

  @Get('mine')
  async listMine(@Req() request: any) {
    const data = await this.feedbackService.listMine(request.user.sub)
    return { code: 200, msg: 'success', data }
  }

  @Get('mine/:id')
  async getMine(@Req() request: any, @Param('id') id: string) {
    const data = await this.feedbackService.getMineById(id, request.user.sub)
    return { code: 200, msg: 'success', data }
  }
}

@Controller('admin/feedbacks')
@UseGuards(AdminAuthGuard)
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  async adminList(@Query('type') type?: string, @Query('status') status?: string) {
    const data = await this.feedbackService.adminList({ type, status })
    return { code: 200, msg: 'success', data }
  }

  @Get(':id')
  async adminGet(@Param('id') id: string) {
    const data = await this.feedbackService.adminGetById(id)
    return { code: 200, msg: 'success', data }
  }

  @Put(':id')
  async adminUpdate(@Req() request: any, @Param('id') id: string, @Body() body: any) {
    const data = await this.feedbackService.adminUpdate(
      id,
      body,
      request.user?.username || request.user?.sub || 'admin',
    )
    return { code: 200, msg: '更新成功', data }
  }

  @Delete(':id')
  async adminRemove(@Param('id') id: string) {
    const data = await this.feedbackService.adminRemove(id)
    return { code: 200, msg: '删除成功', data }
  }
}
