import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common'
import { TransactionsService, PointsService } from './transactions.service'
import { MemberAuthGuard } from '@/auth/auth.guard'

@Controller('transactions')
@UseGuards(MemberAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(@Query() query: any, @Req() request: any) {
    console.log('[TransactionsController] GET /api/transactions')
    const result = await this.transactionsService.findAll({ ...query, member_id: request.user.sub })
    return { code: 200, msg: 'success', data: result }
  }

  @Post()
  async create(@Body() dto: any, @Req() request: any) {
    console.log('[TransactionsController] POST /api/transactions')
    const result = await this.transactionsService.create({ ...dto, member_id: request.user.sub })
    return { code: 200, msg: '创建成功', data: result }
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @Req() request: any) {
    console.log('[TransactionsController] POST /api/transactions/:id/confirm')
    const result = await this.transactionsService.confirm(id, request.user.sub)
    return { code: 200, msg: '确认成功', data: result }
  }
}

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('records')
  @UseGuards(MemberAuthGuard)
  async getRecords(@Query() query: any, @Req() request: any) {
    console.log('[PointsController] GET /api/points/records')
    const result = await this.pointsService.getRecords(request.user.sub, query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('mall')
  async getMallProducts(@Query() query: any) {
    console.log('[PointsController] GET /api/points/mall')
    const result = await this.pointsService.getMallProducts(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('exchange')
  @UseGuards(MemberAuthGuard)
  async exchange(@Body() body: { product_id: string }, @Req() request: any) {
    console.log('[PointsController] POST /api/points/exchange')
    if (!body.product_id) return { code: 400, msg: '参数缺失', data: null }
    const result = await this.pointsService.exchange(request.user.sub, body.product_id)
    return { code: 200, msg: '兑换成功', data: result }
  }
}
