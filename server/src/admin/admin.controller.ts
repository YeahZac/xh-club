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

  /** ====== 管理员账号管理 ====== */
  @Get('admins')
  async getAdmins() {
    console.log('[AdminController] GET /api/admin/admins')
    const result = await this.adminService.getAdmins()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('admins')
  async createAdmin(@Body() dto: { phone: string; password: string; name: string; role_id: number; created_by?: number }) {
    console.log('[AdminController] POST /api/admin/admins')
    const result = await this.adminService.createAdmin(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('admins/:id')
  async updateAdmin(@Param('id') id: string, @Body() dto: { name?: string; role_id?: number; status?: string }) {
    console.log('[AdminController] PUT /api/admin/admins/:id')
    const result = await this.adminService.updateAdmin(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('admins/:id')
  async deleteAdmin(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/admins/:id')
    const result = await this.adminService.deleteAdmin(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  @Post('admins/:id/change-password')
  async changeAdminPassword(@Param('id') id: string, @Body() body: { new_password: string }) {
    console.log('[AdminController] POST /api/admin/admins/:id/change-password')
    const result = await this.adminService.changeAdminPassword(id, body.new_password)
    return { code: 200, msg: '密码修改成功', data: result }
  }

  /** ====== 角色管理 ====== */
  @Get('roles')
  async getRoles() {
    console.log('[AdminController] GET /api/admin/roles')
    const result = await this.adminService.getRoles()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('roles')
  async createRole(@Body() dto: { name: string; display_name: string; description?: string; permissions?: string[] }) {
    console.log('[AdminController] POST /api/admin/roles')
    const result = await this.adminService.createRole(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('roles/:id')
  async updateRole(@Param('id') id: string, @Body() dto: { display_name?: string; description?: string; permissions?: string[] }) {
    console.log('[AdminController] PUT /api/admin/roles/:id')
    const result = await this.adminService.updateRole(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 会员等级管理 ====== */
  @Get('member-levels')
  async getMemberLevels() {
    console.log('[AdminController] GET /api/admin/member-levels')
    const result = await this.adminService.getMemberLevels()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('member-levels')
  async createMemberLevel(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/member-levels')
    const result = await this.adminService.createMemberLevel(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('member-levels/:id')
  async updateMemberLevel(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/member-levels/:id')
    const result = await this.adminService.updateMemberLevel(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('member-levels/:id')
  async deleteMemberLevel(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/member-levels/:id')
    const result = await this.adminService.deleteMemberLevel(id)
    return { code: 200, msg: '删除成功', data: result }
  }

  /** ====== 邀请奖励规则管理 ====== */
  @Get('invitation-rules')
  async getInvitationRewardRules() {
    console.log('[AdminController] GET /api/admin/invitation-rules')
    const result = await this.adminService.getInvitationRewardRules()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('invitation-rules')
  async createInvitationRewardRule(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/invitation-rules')
    const result = await this.adminService.createInvitationRewardRule(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('invitation-rules/:id')
  async updateInvitationRewardRule(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/invitation-rules/:id')
    const result = await this.adminService.updateInvitationRewardRule(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 积分规则管理 ====== */
  @Get('points-rules')
  async getPointsRules() {
    console.log('[AdminController] GET /api/admin/points-rules')
    const result = await this.adminService.getPointsRules()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('points-rules')
  async createPointsRule(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/points-rules')
    const result = await this.adminService.createPointsRule(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('points-rules/:id')
  async updatePointsRule(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/points-rules/:id')
    const result = await this.adminService.updatePointsRule(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 贡献值规则管理 ====== */
  @Get('contribution-rules')
  async getContributionRules() {
    console.log('[AdminController] GET /api/admin/contribution-rules')
    const result = await this.adminService.getContributionRules()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('contribution-rules')
  async createContributionRule(@Body() dto: any) {
    console.log('[AdminController] POST /api/admin/contribution-rules')
    const result = await this.adminService.createContributionRule(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('contribution-rules/:id')
  async updateContributionRule(@Param('id') id: string, @Body() dto: any) {
    console.log('[AdminController] PUT /api/admin/contribution-rules/:id')
    const result = await this.adminService.updateContributionRule(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  /** ====== 部门管理 ====== */
  @Get('departments')
  async getDepartments() {
    console.log('[AdminController] GET /api/admin/departments')
    const result = await this.adminService.getDepartments()
    return { code: 200, msg: 'success', data: result }
  }

  @Post('departments')
  async createDepartment(@Body() dto: { name: string; parent_id?: number; manager_id?: number; sort_order?: number; description?: string }) {
    console.log('[AdminController] POST /api/admin/departments')
    const result = await this.adminService.createDepartment(dto)
    return { code: 200, msg: '创建成功', data: result }
  }

  @Put('departments/:id')
  async updateDepartment(@Param('id') id: string, @Body() dto: { name?: string; manager_id?: number; sort_order?: number; status?: string; description?: string }) {
    console.log('[AdminController] PUT /api/admin/departments/:id')
    const result = await this.adminService.updateDepartment(id, dto)
    return { code: 200, msg: '更新成功', data: result }
  }

  @Delete('departments/:id')
  async deleteDepartment(@Param('id') id: string) {
    console.log('[AdminController] DELETE /api/admin/departments/:id')
    const result = await this.adminService.deleteDepartment(id)
    return { code: 200, msg: '删除成功', data: result }
  }

}
