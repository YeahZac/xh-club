import { Body, Controller, Get, Post, Delete, Param, Query, Req, UseGuards } from '@nestjs/common'
import { EventsService } from './events.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { verifyAuthToken } from '@/auth/jwt'

function tryReadMemberId(request: any): string | number | undefined {
  try {
    const authorization = request?.headers?.authorization
    if (typeof authorization !== 'string') return undefined
    const [scheme, token] = authorization.trim().split(/\s+/, 2)
    if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined
    const principal = verifyAuthToken(token)
    if (principal.type !== 'member') return undefined
    return principal.sub
  } catch {
    return undefined
  }
}

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getEvents(@Query() query: any) {
    console.log('[EventsController] GET /api/events')
    const result = await this.eventsService.getEvents(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('mine/registrations')
  @UseGuards(MemberAuthGuard)
  async myRegistrations(@Req() request: any) {
    console.log('[EventsController] GET /api/events/mine/registrations')
    const result = await this.eventsService.getMyRegistrations(request.user.sub)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id')
  async getEvent(@Param('id') id: string) {
    console.log('[EventsController] GET /api/events/:id - id:', id)
    const result = await this.eventsService.getEventById(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Post(':id/register')
  @UseGuards(MemberAuthGuard)
  async register(@Param('id') id: string, @Req() request: any, @Body() body: any) {
    console.log('[EventsController] POST /api/events/:id/register')
    const formAnswers = body?.form_answers || body?.answers || null
    const result = await this.eventsService.registerEvent(id, request.user.sub, formAnswers)
    return { code: 200, msg: '报名成功', data: result }
  }

  @Delete(':id/register')
  @UseGuards(MemberAuthGuard)
  async cancelRegister(@Param('id') id: string, @Req() request: any) {
    console.log('[EventsController] DELETE /api/events/:id/register')
    const result = await this.eventsService.cancelRegistration(id, request.user.sub)
    return { code: 200, msg: '取消成功', data: result }
  }
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getProjects(@Query() query: any) {
    console.log('[ProjectsController] GET /api/projects')
    const result = await this.eventsService.getProjects(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('submit')
  @UseGuards(MemberAuthGuard)
  async submitProject(@Req() request: any, @Body() body: any) {
    const result = await this.eventsService.submitMemberProject(request.user.sub, body)
    return { code: 200, msg: '已提交审核', data: result }
  }

  @Get(':id')
  async getProject(@Param('id') id: string, @Req() request: any) {
    const memberId = tryReadMemberId(request)
    const result = await this.eventsService.getProjectById(id, memberId)
    return { code: 200, msg: 'success', data: result }
  }

  @Post(':id/scores')
  @UseGuards(MemberAuthGuard)
  async submitScores(
    @Param('id') id: string,
    @Req() request: any,
    @Body() body: { scores?: Array<{ dimension_id: number | string; stars: number }> },
  ) {
    const result = await this.eventsService.submitProjectScores(
      id,
      request.user.sub,
      body?.scores || [],
    )
    return { code: 200, msg: '评分成功', data: result }
  }

  @Post(':id/share')
  @UseGuards(MemberAuthGuard)
  async share(
    @Param('id') id: string,
    @Req() request: any,
    @Body() body: { receiver_id: string | number },
  ) {
    const result = await this.eventsService.shareProjectToMember(
      id,
      request.user.sub,
      body.receiver_id,
    )
    return { code: 200, msg: '已分享给好友', data: result }
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  async createProject(@Body() dto: any) {
    console.log('[ProjectsController] POST /api/projects')
    const result = await this.eventsService.createProject(dto)
    return { code: 200, msg: '创建成功', data: result }
  }
}

@Controller('resources')
export class ResourcesController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getResources(@Query() query: any) {
    console.log('[ResourcesController] GET /api/resources')
    const result = await this.eventsService.getResources(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  async createResource(@Body() dto: any) {
    console.log('[ResourcesController] POST /api/resources')
    const result = await this.eventsService.createResource(dto)
    return { code: 200, msg: '发布成功', data: result }
  }
}
