import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common'
import { TransactionsService, PointsService } from './transactions.service'

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(@Query() query: any) {
    console.log('[TransactionsController] GET /api/transactions')
    const result = await this.transactionsService.findAll(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post()
  async create(@Body() dto: any) {
    console.log('[TransactionsController] POST /api/transactions')
    const result = await this.transactionsService.create(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @Body() body: { member_id: string }) {
    console.log('[TransactionsController] POST /api/transactions/:id/confirm')
    const result = await this.transactionsService.confirm(id, body.member_id)
    return { code: 200, msg: '确认成功', data: result }
  }
}

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('records')
  async getRecords(@Query() query: any) {
    console.log('[PointsController] GET /api/points/records')
    const memberId = query.member_id
    if (!memberId) return { code: 400, msg: '缺少member_id', data: null }
    const result = await this.pointsService.getRecords(memberId, query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('mall')
  async getMallProducts(@Query() query: any) {
    console.log('[PointsController] GET /api/points/mall')
    const result = await this.pointsService.getMallProducts(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('exchange')
  async exchange(@Body() body: { member_id: string; product_id: string }) {
    console.log('[PointsController] POST /api/points/exchange')
    if (!body.member_id || !body.product_id) return { code: 400, msg: '参数缺失', data: null }
    const result = await this.pointsService.exchange(body.member_id, body.product_id)
    return { code: 200, msg: '兑换成功', data: result }
  }
}
