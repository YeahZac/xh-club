import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

@Injectable()
export class EventsService {
  private client() { return getSupabaseClient() }

  /** 获取活动列表 */
  async getEvents(params: { event_type?: string; status?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('events')
      .select('*', { count: 'exact' })
      .order('start_time', { ascending: false })
      .range(from, to)

    if (params.event_type) query = query.eq('event_type', params.event_type)
    if (params.status) query = query.eq('status', params.status)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 获取活动详情 */
  async getEventById(id: string) {
    const { data, error } = await this.client()
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw new HttpException('活动不存在', HttpStatus.NOT_FOUND)

    // 获取已报名会员
    const { data: registrations } = await this.client()
      .from('event_registrations')
      .select('member_id, status, created_at, members(id, name, avatar, company_name)')
      .eq('event_id', id)

    return { ...data, registrations: registrations || [] }
  }

  /** 报名活动 */
  async registerEvent(eventId: string, memberId: string) {
    console.log('[EventsService] registerEvent - eventId:', eventId, 'memberId:', memberId)

    // 检查是否已报名
    const { data: existing } = await this.client()
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('member_id', memberId)
      .single()

    if (existing) throw new HttpException('已报名该活动', HttpStatus.CONFLICT)

    // 检查活动名额
    const { data: event } = await this.client()
      .from('events')
      .select('max_participants, current_participants, status')
      .eq('id', eventId)
      .single()

    if (!event || event.status !== 'open') throw new HttpException('活动不可报名', HttpStatus.BAD_REQUEST)
    if (event.current_participants >= event.max_participants) throw new HttpException('活动名额已满', HttpStatus.BAD_REQUEST)

    // 插入报名记录
    const { data, error } = await this.client()
      .from('event_registrations')
      .insert({ event_id: eventId, member_id: memberId, status: 'registered' })
      .select()
      .single()

    if (error) throw new HttpException(`报名失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 更新参与人数
    await this.client()
      .from('events')
      .update({ current_participants: event.current_participants + 1 })
      .eq('id', eventId)

    return data
  }

  /** 取消报名 */
  async cancelRegistration(eventId: string, memberId: string) {
    const { error } = await this.client()
      .from('event_registrations')
      .delete()
      .eq('event_id', eventId)
      .eq('member_id', memberId)

    if (error) throw new HttpException(`取消失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 更新参与人数
    const { data: event } = await this.client()
      .from('events')
      .select('current_participants')
      .eq('id', eventId)
      .single()

    if (event) {
      await this.client()
        .from('events')
        .update({ current_participants: Math.max(0, event.current_participants - 1) })
        .eq('id', eventId)
    }

    return { success: true }
  }

  /** 获取项目列表 */
  async getProjects(params: { industry?: string; stage?: string; status?: string; keyword?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('projects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.industry) query = query.eq('industry', params.industry)
    if (params.stage) query = query.eq('stage', params.stage)
    if (params.status) query = query.eq('status', params.status)
    if (params.keyword) query = query.or(`title.ilike.%${params.keyword}%,description.ilike.%${params.keyword}%`)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 获取项目详情 */
  async getProjectById(id: string) {
    const { data, error } = await this.client()
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw new HttpException('项目不存在', HttpStatus.NOT_FOUND)

    // 获取融资信息
    const { data: financingData } = await this.client()
      .from('financing')
      .select('*')
      .eq('project_id', id)

    // 获取路演信息
    const { data: roadshowData } = await this.client()
      .from('roadshows')
      .select('*')
      .eq('project_id', id)

    return { ...data, financing: financingData || [], roadshows: roadshowData || [] }
  }

  /** 创建项目 */
  async createProject(dto: any) {
    console.log('[EventsService] createProject - title:', dto.title)
    const { data, error } = await this.client()
      .from('projects')
      .insert({
        title: dto.title,
        description: dto.description,
        cover_image: dto.cover_image || null,
        industry: dto.industry,
        stage: dto.stage || 'seed',
        amount_min: dto.amount_min || null,
        amount_max: dto.amount_max || null,
        amount_raised: 0,
        status: 'active',
        owner_id: dto.owner_id,
        is_featured: false,
        view_count: 0,
      })
      .select()
      .single()

    if (error) throw new HttpException(`创建失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** 获取资源供需列表 */
  async getResources(params: { type?: string; category?: string; industry?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('resources')
      .select('*, members(id, name, avatar, company_name, company_position)', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.type) query = query.eq('type', params.type)
    if (params.category) query = query.eq('category', params.category)
    if (params.industry) query = query.eq('industry', params.industry)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 发布资源 */
  async createResource(dto: any) {
    console.log('[EventsService] createResource - type:', dto.type)
    const { data, error } = await this.client()
      .from('resources')
      .insert({
        member_id: dto.member_id,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        category: dto.category || null,
        industry: dto.industry || null,
        region: dto.region || null,
        contact_info: dto.contact_info || null,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw new HttpException(`发布失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }
}
