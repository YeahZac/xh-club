import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

@Injectable()
export class TransactionsService {
  private client() { return getSupabaseClient() }

  /** 创建成交记录 */
  async create(dto: any) {
    console.log('[TransactionsService] create - project:', dto.project_name)
    const { data, error } = await this.client()
      .from('transactions')
      .insert({
        project_name: dto.project_name,
        amount: dto.amount,
        category: dto.category || null,
        description: dto.description || null,
        party_a_id: dto.party_a_id,
        party_b_id: dto.party_b_id,
        matcher_id: dto.matcher_id || null,
        status: 'pending',
        confirmed_by_a: false,
        confirmed_by_b: false,
        points_awarded: false,
        milestone_json: dto.milestones || null,
      })
      .select()
      .single()

    if (error) throw new HttpException(`创建失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** 确认成交 */
  async confirm(id: string, memberId: string) {
    console.log('[TransactionsService] confirm - id:', id, 'memberId:', memberId)
    const { data: txn } = await this.client()
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (!txn) throw new HttpException('成交记录不存在', HttpStatus.NOT_FOUND)

    const updateData: any = {}
    if (txn.party_a_id === memberId) updateData.confirmed_by_a = true
    if (txn.party_b_id === memberId) updateData.confirmed_by_b = true

    // 双方都确认则完成
    const bothConfirmed = (updateData.confirmed_by_a || txn.confirmed_by_a) && (updateData.confirmed_by_b || txn.confirmed_by_b)
    if (bothConfirmed) {
      updateData.status = 'completed'
      updateData.completed_at = new Date().toISOString()
      updateData.points_awarded = true
    }

    const { data, error } = await this.client()
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new HttpException(`确认失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 如果成交完成，发放积分
    if (bothConfirmed) {
      await this.awardTransactionPoints(txn)
    }

    return data
  }

  /** 成交积分发放 */
  private async awardTransactionPoints(txn: any) {
    const amount = Number(txn.amount) || 0
    const basePoints = Math.floor(amount * 0.001) // 1‰ 转积分

    if (basePoints <= 0) return

    // 甲方获得积分
    await this.addPoints(txn.party_a_id, basePoints, 'transaction', txn.id, `成交项目"${txn.project_name}"获得积分`)
    // 乙方获得积分
    await this.addPoints(txn.party_b_id, basePoints, 'transaction', txn.id, `成交项目"${txn.project_name}"获得积分`)
    // 撮合人获得20%
    if (txn.matcher_id) {
      await this.addPoints(txn.matcher_id, Math.floor(basePoints * 0.2), 'transaction', txn.id, `撮合"${txn.project_name}"获得积分`)
    }
  }

  /** 获取成交列表 */
  async findAll(params: { member_id?: string; status?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.member_id) {
      query = query.or(`party_a_id.eq.${params.member_id},party_b_id.eq.${params.member_id},matcher_id.eq.${params.member_id}`)
    }
    if (params.status) query = query.eq('status', params.status)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 增加积分 */
  private async addPoints(memberId: string, amount: number, source: string, sourceId: string, description: string) {
    // 获取当前积分
    const { data: member } = await this.client()
      .from('members')
      .select('total_points, available_points')
      .eq('id', memberId)
      .single()

    if (!member) return

    const newTotal = (member.total_points || 0) + amount
    const newAvailable = (member.available_points || 0) + amount

    // 更新会员积分
    await this.client()
      .from('members')
      .update({ total_points: newTotal, available_points: newAvailable })
      .eq('id', memberId)

    // 记录积分流水
    await this.client()
      .from('points_records')
      .insert({
        member_id: memberId,
        type: 'earn',
        amount,
        balance_after: newAvailable,
        source,
        source_id: sourceId,
        description,
        expires_at: new Date(Date.now() + 24 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 24个月后过期
      })
  }
}

@Injectable()
export class PointsService {
  private client() { return getSupabaseClient() }

  /** 获取积分记录 */
  async getRecords(memberId: string, params: { type?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('points_records')
      .select('*', { count: 'exact' })
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.type) query = query.eq('type', params.type)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 获取商城商品列表 */
  async getMallProducts(params: { category?: string }) {
    let query = this.client()
      .from('mall_products')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })

    if (params.category) query = query.eq('category', params.category)

    const { data, error } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return data || []
  }

  /** 积分兑换 */
  async exchange(memberId: string, productId: string) {
    console.log('[PointsService] exchange - memberId:', memberId, 'productId:', productId)

    // 获取商品
    const { data: product } = await this.client()
      .from('mall_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (!product) throw new HttpException('商品不存在', HttpStatus.NOT_FOUND)
    if (product.stock <= 0) throw new HttpException('商品库存不足', HttpStatus.BAD_REQUEST)

    // 获取会员积分
    const { data: member } = await this.client()
      .from('members')
      .select('available_points')
      .eq('id', memberId)
      .single()

    if (!member || member.available_points < product.points_price) {
      throw new HttpException('积分不足', HttpStatus.BAD_REQUEST)
    }

    // 扣除积分
    const newAvailable = member.available_points - product.points_price
    await this.client()
      .from('members')
      .update({ available_points: newAvailable })
      .eq('id', memberId)

    // 记录积分流水
    await this.client()
      .from('points_records')
      .insert({
        member_id: memberId,
        type: 'spend',
        amount: product.points_price,
        balance_after: newAvailable,
        source: 'mall',
        source_id: productId,
        description: `兑换商品"${product.name}"`,
      })

    // 创建兑换记录
    const { data: exchange, error } = await this.client()
      .from('points_exchanges')
      .insert({
        member_id: memberId,
        product_id: productId,
        points_cost: product.points_price,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw new HttpException(`兑换失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 减库存
    await this.client()
      .from('mall_products')
      .update({ stock: product.stock - 1 })
      .eq('id', productId)

    return exchange
  }
}
