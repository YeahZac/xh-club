import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common'
import { EventsService } from './events.service'

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getEvents(@Query() query: any) {
    console.log('[EventsController] GET /api/events')
    const result = await this.eventsService.getEvents(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get(':id')
  async getEvent(@Param('id') id: string) {
    console.log('[EventsController] GET /api/events/:id - id:', id)
    const result = await this.eventsService.getEventById(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Post(':id/register')
  async register(@Param('id') id: string, @Body() body: { member_id: string }) {
    console.log('[EventsController] POST /api/events/:id/register')
    const result = await this.eventsService.registerEvent(id, body.member_id)
    return { code: 200, msg: '报名成功', data: result }
  }

  @Delete(':id/register')
  async cancelRegister(@Param('id') id: string, @Body() body: { member_id: string }) {
    console.log('[EventsController] DELETE /api/events/:id/register')
    const result = await this.eventsService.cancelRegistration(id, body.member_id)
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

  @Get(':id')
  async getProject(@Param('id') id: string) {
    console.log('[ProjectsController] GET /api/projects/:id - id:', id)
    const result = await this.eventsService.getProjectById(id)
    return { code: 200, msg: 'success', data: result }
  }

  @Post()
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
  async createResource(@Body() dto: any) {
    console.log('[ResourcesController] POST /api/resources')
    const result = await this.eventsService.createResource(dto)
    return { code: 200, msg: '发布成功', data: result }
  }
}
