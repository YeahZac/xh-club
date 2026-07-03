import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** 登录 */
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    console.log('[AdminController] POST /api/admin/login - username:', body.username)
    const result = await this.adminService.login(body.username, body.password)
    return { code: 200, msg: '登录成功', data: result }
  }

  /** ====== 数据看板 ====== */
  @Get('dashboard')
  async getDashboard() {
    console.log('[AdminController] GET /api/admin/dashboard')
    const result = await this.adminService.getDashboardStats()
    return { code: 200, msg: 'success', data: result }
  }

  /** ====== Banner 管理 ====== */
  @Get('banners')
  async getBanners() {
    console.log('[AdminController] GET /api/admin/banners')
    const result = await this.adminService.getBanners()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('banners')
  async createBanner(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/banners')
    const result = await this.adminService.createBanner(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('banners/:id')
  async updateBanner(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/banners/:id')
    const result = await this.adminService.updateBanner(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('banners/:id')
  async deleteBanner(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/banners/:id')
    const result = await this.adminService.deleteBanner(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 会员管理 ====== */
  @Get('members')
  async getMembers(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/members')
    const result = await this.adminService.getAllMembers(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Get('members/pending')
  async getPendingMembers(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/members/pending')
    const result = await this.adminService.getPendingMembers(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('members/:id/approve')
  async approveMember(@Param('id') id: string, @Body() body: { approved_by: string }) {
    console.log('[AdminController] POST /api/admin/members/:id/approve')
    const result = await this.adminService.approveMember(id, body.approved_by)
    return { code: 200, msg: '审批成功', data: result }
  }

  @Post('members/:id/reject')
  async rejectMember(@Param('id') id: string, @Body() body: { reason: string }) {
    console.log('[AdminController] POST /api/admin/members/:id/reject')
    const result = await this.adminService.rejectMember(id, body.reason)
    return { code: 200, msg: '已拒绝', data: result }
  }

  /** ====== 活动管理 ====== */
  @Post('events')
  async createEvent(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/events')
    const result = await this.adminService.createEvent(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  /** ====== 组织架构 ====== */
  @Get('organizations')
  async getOrganizations() {
    console.log('[AdminController] GET /api/admin/organizations')
    const result = await this.adminService.getOrganizations()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('organizations')
  async createOrganization(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/organizations')
    const result = await this.adminService.createOrganization(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  /** ====== 系统配置 ====== */
  @Get('configs')
  async getConfigs() {
    console.log('[AdminController] GET /api/admin/configs')
    const result = await this.adminService.getConfigs()
    return { code: 200, msg: 'success', data: result }
  }

  @Put('configs')
  async updateConfig(@Body() body: { key: string; value: string }) {
    console.log('[AdminController] PUT /api/admin/configs')
    const result = await this.adminService.updateConfig(body.key, body.value)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 商城商品管理 ====== */
  @Get('mall-products')
  async getMallProducts(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/mall-products')
    const result = await this.adminService.getMallProducts(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('mall-products')
  async createMallProduct(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/mall-products')
    const result = await this.adminService.createMallProduct(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('mall-products/:id')
  async updateMallProduct(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/mall-products/:id')
    const result = await this.adminService.updateMallProduct(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }
}
