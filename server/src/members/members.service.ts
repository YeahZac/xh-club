import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-compat'
import * as bcrypt from 'bcryptjs'
import { signAuthToken } from '@/auth/jwt'

@Injectable()
export class MembersService {
  private client() { return getSupabaseClient() }

  /** 会员注册 */
  async register(dto: any) {
    console.log('[MembersService] register - phone:', dto.phone)
    if (typeof dto.password !== 'string' || dto.password.length < 8) {
      throw new HttpException('密码至少需要 8 位', HttpStatus.BAD_REQUEST)
    }
    // 检查手机号是否已注册
    const { data: existing } = await this.client()
      .from('members')
      .select('id')
      .eq('phone', dto.phone)
      .single()

    if (existing) throw new HttpException('手机号已注册', HttpStatus.CONFLICT)

    const insertData: any = {
      phone: dto.phone,
      password_hash: await bcrypt.hash(dto.password, 10),
      name: dto.name,
      avatar: dto.avatar || null,
      company_name: dto.company_name,
      company_position: dto.company_position,
      industry_primary: dto.industry_primary || null,
      industry_secondary: dto.industry_secondary || null,
      company_scale: dto.company_scale || null,
      company_address: dto.company_address || null,
      company_website: dto.company_website || null,
      business_description: dto.business_description || null,
      core_advantage: dto.core_advantage || null,
      resources_supply: dto.resources_supply || null,
      resources_demand: dto.resources_demand || null,
      city: dto.city || null,
      wechat_id: dto.wechat_id || null,
      bio: dto.bio || null,
      member_type: dto.member_type || 'unpaid',
      membership_level: 'normal',
      credit_score: 60,
      active_score: 0,
      contribution_score: 0,
      total_points: 0,
      available_points: 0,
      referrer_id: dto.referrer_id || null,
      join_source: dto.join_source || null,
      status: 'pending',
    }

    const { data, error } = await this.client()
      .from('members')
      .insert(insertData)
      .select()
      .single()

    if (error) throw new HttpException(`注册失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 如果有标签，插入标签
    if (dto.tags && Array.isArray(dto.tags) && dto.tags.length > 0) {
      const tagInserts = dto.tags.map((tag: any) => ({
        member_id: data.id,
        tag_type: tag.type,
        tag_value: tag.value,
      }))
      await this.client().from('member_tags').insert(tagInserts)
    }

    return data
  }

  /** 会员登录（手机号+密码） */
  async login(phone: string, password: string) {
    console.log('[MembersService] login - phone:', phone)
    const { data, error } = await this.client()
      .from('members')
      .select('*')
      .eq('phone', phone)
      .single()

    if (error || !data) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND)
    const passwordValid = await bcrypt.compare(password, data.password_hash)
    if (!passwordValid) throw new HttpException('手机号或密码错误', HttpStatus.UNAUTHORIZED)

    const token = signAuthToken({ sub: String(data.id), type: 'member' })

    return { token, member: data }
  }

  /** 获取会员档案 */
  async getProfile(id: string) {
    const { data, error } = await this.client()
      .from('members')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw new HttpException('会员不存在', HttpStatus.NOT_FOUND)

    // 获取标签
    const { data: tags } = await this.client()
      .from('member_tags')
      .select('*')
      .eq('member_id', id)

    // 获取组织关系
    const { data: orgs } = await this.client()
      .from('member_organizations')
      .select('*, organizations(*)')
      .eq('member_id', id)

    return { ...data, tags: tags || [], organizations: orgs || [] }
  }

  /** 更新会员档案 */
  async updateProfile(id: string, dto: any) {
    console.log('[MembersService] updateProfile - id:', id)
    const allowedFields = [
      'name',
      'avatar',
      'gender',
      'birthday',
      'company_name',
      'company_position',
      'industry_primary',
      'industry_secondary',
      'company_scale',
      'company_founded',
      'company_address',
      'company_website',
      'business_description',
      'core_advantage',
      'resources_supply',
      'resources_demand',
      'city',
      'wechat_id',
      'bio',
    ]
    const updates = Object.fromEntries(
      allowedFields
        .filter(field => dto[field] !== undefined)
        .map(field => [field, dto[field]]),
    )
    if (Object.keys(updates).length === 0) {
      throw new HttpException('没有可更新的会员字段', HttpStatus.BAD_REQUEST)
    }
    const { data, error } = await this.client()
      .from('members')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new HttpException(`更新失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** 获取会员列表（支持筛选） */
  async getMembers(params: { keyword?: string; industry?: string; city?: string; member_type?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('members')
      .select('id, name, avatar, company_name, company_position, industry_primary, industry_secondary, city, member_type, membership_level, credit_score, status, created_at', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.keyword) {
      query = query.or(`name.ilike.%${params.keyword}%,company_name.ilike.%${params.keyword}%`)
    }
    if (params.industry) {
      query = query.eq('industry_primary', params.industry)
    }
    if (params.city) {
      query = query.eq('city', params.city)
    }
    if (params.member_type) {
      query = query.eq('member_type', params.member_type)
    }

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 获取推荐链 */
  async getReferralTree(memberId: string) {
    // 获取我推荐的人
    const { data: referred } = await this.client()
      .from('members')
      .select('id, name, avatar, company_name, membership_level, created_at')
      .eq('referrer_id', memberId)

    // 获取推荐我的人
    const { data: myProfile } = await this.client()
      .from('members')
      .select('referrer_id')
      .eq('id', memberId)
      .single()

    let referrer = null
    if (myProfile?.referrer_id) {
      const { data } = await this.client()
        .from('members')
        .select('id, name, avatar, company_name, membership_level')
        .eq('id', myProfile.referrer_id)
        .single()
      referrer = data as any
    }

    return { referrer, referred: referred || [] }
  }

  /** 获取成长数据 */
  async getGrowthData(id: string) {
    const { data } = await this.client()
      .from('members')
      .select('active_score, contribution_score, credit_score, membership_level, total_points, available_points')
      .eq('id', id)
      .single()

    // 获取成交统计
    const { count: dealCount } = await this.client()
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .or(`party_a_id.eq.${id},party_b_id.eq.${id}`)
      .eq('status', 'completed')

    // 获取推荐人数
    const { count: referralCount } = await this.client()
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', id)
      .eq('status', 'active')

    return {
      ...data,
      deal_count: dealCount || 0,
      referral_count: referralCount || 0,
    }
  }
}
