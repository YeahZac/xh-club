import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** 数据库连接状态检查 */
  @Get('db-status')
  async checkDatabaseStatus() {
    console.log('[AdminController] GET /api/admin/db-status')
    const result = await this.adminService.checkDatabaseConnection()
    return { code: 200, msg: 'success', data: result }
  }

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
  @Get('events')
  async getEvents(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/events')
    const result = await this.adminService.getAllEvents(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('events')
  async createEvent(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/events')
    const result = await this.adminService.createEvent(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/events/:id')
    const result = await this.adminService.deleteEvent(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 项目管理 ====== */
  @Get('projects')
  async getProjects(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/projects')
    const result = await this.adminService.getAllProjects(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('projects')
  async createProject(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/projects')
    const result = await this.adminService.createProject(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Delete('projects/:id')
  async deleteProject(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/projects/:id')
    const result = await this.adminService.deleteProject(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 商城管理 ====== */
  @Get('mall-products')
  async getMallProducts() {
    console.log('[AdminController] GET /api/admin/mall-products')
    const result = await this.adminService.getMallProducts()
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

  @Delete('mall-products/:id')
  async deleteMallProduct(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/mall-products/:id')
    const result = await this.adminService.deleteMallProduct(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 成交管理 ====== */
  @Get('transactions')
  async getTransactions(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/transactions')
    const result = await this.adminService.getAllTransactions(query)
    return { code: 200, msg: 'success', data: result }
  }

  /** ====== 通知推送 ====== */
  @Post('notifications/broadcast')
  async broadcastNotification(@Body() dto: { title: string; content: string }) {
    console.log('[AdminController] POST /api/admin/notifications/broadcast')
    const result = await this.adminService.broadcastNotification(dto)
    return { code: 200, msg: '推送成功', data: result }
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

  /** ====== 文章管理 ====== */
  @Get('articles')
  async getArticles(@Query() query: any) {
    console.log('[AdminController] GET /api/admin/articles')
    const result = await this.adminService.getAllArticles(query)
    return { code: 200, msg: 'success', data: result }
  }

  @Post('articles')
  async createArticle(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/articles')
    const result = await this.adminService.createArticle(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('articles/:id')
  async updateArticle(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/articles/:id')
    const result = await this.adminService.updateArticle(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('articles/:id')
  async deleteArticle(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/articles/:id')
    const result = await this.adminService.deleteArticle(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  @Post('articles/:id/publish')
  async publishArticle(@Param('id') id: string) {
    console.log('[AdminController] POST /api/admin/articles/:id/publish')
    const result = await this.adminService.publishArticle(id)
    return { code: 200, msg: '发布成功', data: result }
  }

}
