import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AdminService {
  private client() { return getSupabaseClient() }

  /** 管理员登录 */
  async login(username: string, password: string) {
    console.log('[AdminService] login - username:', username)
    const { data, error } = await this.client()
      .from('admins')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !data) throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED)

    // 简单密码校验（实际应使用bcrypt）
    if (data.password_hash !== password) {
      throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED)
    }

    return { id: data.id, username: data.username, name: data.name, role: data.role }
  }

  /** ====== Banner 管理 ====== */
  async getBanners() {
    const { data, error } = await this.client()
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data || []
  }

  async createBanner(dto: any) {
    console.log('[AdminService] createBanner - title:', dto.title)
    const { data, error } = await this.client()
      .from('banners')
      .insert({
        title: dto.title,
        image_url: dto.image_url,
        link_type: dto.link_type || null,
        link_id: dto.link_id || null,
        sort_order: dto.sort_order || 0,
        is_active: dto.is_active !== false,
        start_time: dto.start_time || null,
        end_time: dto.end_time || null,
      })
      .select()
      .single()

    if (error) throw new HttpException(`创建失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  async updateBanner(id: string, dto: any) {
    const { data, error } = await this.client()
      .from('banners')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new HttpException(`更新失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  async deleteBanner(id: string) {
    const { error } = await this.client()
      .from('banners')
      .delete()
      .eq('id', id)

    if (error) throw new HttpException(`删除失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return { success: true }
  }

  /** ====== 会员审批 ====== */
  async getPendingMembers(params: { page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await this.client()
      .from('members')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return { list: data || [], total: count || 0, page, pageSize }
  }

  async approveMember(id: string, approvedBy: string) {
    console.log('[AdminService] approveMember - id:', id)
    const { data, error } = await this.client()
      .from('members')
      .update({
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new HttpException(`审批失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  async rejectMember(id: string, reason: string) {
    const { data, error } = await this.client()
      .from('members')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new HttpException(`操作失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** ====== 活动管理 ====== */
  async createEvent(dto: any) {
    console.log('[AdminService] createEvent - title:', dto.title)
    const { data, error } = await this.client()
      .from('events')
      .insert({
        title: dto.title,
        description: dto.description || null,
        cover_image: dto.cover_image || null,
        event_type: dto.event_type,
        start_time: dto.start_time,
        end_time: dto.end_time,
        location: dto.location || null,
        max_participants: dto.max_participants || 100,
        current_participants: 0,
        fee: dto.fee || 0,
        organizer_id: dto.organizer_id || null,
        org_id: dto.org_id || null,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw new HttpException(`创建失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** ====== 组织架构 ====== */
  async getOrganizations() {
    const { data, error } = await this.client()
      .from('organizations')
      .select('*')
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true })

    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data || []
  }

  async createOrganization(dto: any) {
    console.log('[AdminService] createOrganization - name:', dto.name)
    const { data, error } = await this.client()
      .from('organizations')
      .insert({
        parent_id: dto.parent_id || null,
        org_type: dto.org_type,
        name: dto.name,
        level: dto.level || 0,
        description: dto.description || null,
        leader_id: dto.leader_id || null,
        sort_order: dto.sort_order || 0,
      })
      .select()
      .single()

    if (error) throw new HttpException(`创建失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** ====== 系统配置 ====== */
  async getConfigs() {
    const { data, error } = await this.client()
      .from('system_config')
      .select('*')
      .order('id', { ascending: true })

    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data || []
  }

  async updateConfig(key: string, value: string) {
    const { data, error } = await this.client()
      .from('system_config')
      .update({ config_value: value })
      .eq('config_key', key)
      .select()
      .single()

    if (error) throw new HttpException(`更新失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** ====== 商城商品管理 ====== */
  async getMallProducts(params: { category?: string }) {
    let query = this.client()
      .from('mall_products')
      .select('*')
      .order('sort_order', { ascending: true })

    if (params.category) query = query.eq('category', params.category)
    const { data, error } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data || []
  }

  async createMallProduct(dto: any) {
    console.log('[AdminService] createMallProduct - name:', dto.name)
    const { data, error } = await this.client()
      .from('mall_products')
      .insert({
        name: dto.name,
        description: dto.description || null,
        image_url: dto.image_url || null,
        points_price: dto.points_price,
        cash_price: dto.cash_price || null,
        stock: dto.stock || 0,
        category: dto.category,
        status: 'active',
        sort_order: dto.sort_order || 0,
      })
      .select()
      .single()

    if (error) throw new HttpException(`创建失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  async updateMallProduct(id: string, dto: any) {
    const { data, error } = await this.client()
      .from('mall_products')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new HttpException(`更新失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** ====== 数据统计 ====== */
  async getDashboardStats() {
    const { count: memberCount } = await this.client()
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { count: pendingCount } = await this.client()
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { count: eventCount } = await this.client()
      .from('events')
      .select('*', { count: 'exact', head: true })

    const { count: projectCount } = await this.client()
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { data: txnData } = await this.client()
      .from('transactions')
      .select('amount')
      .eq('status', 'completed')

    const totalAmount = (txnData || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

    const { count: postCount } = await this.client()
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    return {
      memberCount: memberCount || 0,
      pendingCount: pendingCount || 0,
      eventCount: eventCount || 0,
      projectCount: projectCount || 0,
      totalAmount,
      postCount: postCount || 0,
    }
  }

  /** ====== 会员列表（管理端） ====== */
  async getAllMembers(params: { status?: string; keyword?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('members')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.status) query = query.eq('status', params.status)
    if (params.keyword) query = query.or(`name.ilike.%${params.keyword}%,company_name.ilike.%${params.keyword}%,phone.ilike.%${params.keyword}%`)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }
}
