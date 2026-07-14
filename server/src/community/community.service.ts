import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-compat'

@Injectable()
export class CommunityService {
  private client() { return getSupabaseClient() }

  /** 获取动态列表 */
  async getPosts(params: { type?: string; member_id?: string; page?: number; pageSize?: number }) {
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = this.client()
      .from('posts')
      .select('*, members(id, name, avatar, company_name, membership_level)', { count: 'exact' })
      .eq('status', 'published')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params.type) query = query.eq('type', params.type)
    if (params.member_id) query = query.eq('member_id', params.member_id)

    const { data, error, count } = await query
    if (error) throw new HttpException(`查询失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    return { list: data || [], total: count || 0, page, pageSize }
  }

  /** 发布动态 */
  async createPost(dto: any) {
    console.log('[CommunityService] createPost - title:', dto.title)
    const { data, error } = await this.client()
      .from('posts')
      .insert({
        member_id: dto.member_id,
        type: dto.type || 'thought',
        title: dto.title || null,
        content: dto.content,
        images_json: dto.images || null,
        status: 'published',
        is_featured: false,
        view_count: 0,
        like_count: 0,
        comment_count: 0,
      })
      .select()
      .single()

    if (error) throw new HttpException(`发布失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** 获取动态详情 */
  async getPostById(id: string) {
    const { data, error } = await this.client()
      .from('posts')
      .select('*, members(id, name, avatar, company_name, membership_level)')
      .eq('id', id)
      .single()

    if (error || !data) throw new HttpException('动态不存在', HttpStatus.NOT_FOUND)

    // 获取评论
    const { data: comments } = await this.client()
      .from('comments')
      .select('*, members(id, name, avatar)')
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    // 更新浏览量
    await this.client()
      .from('posts')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', id)

    return { ...data, comments: comments || [] }
  }

  /** 点赞 */
  async likePost(id: string) {
    const { data: post } = await this.client()
      .from('posts')
      .select('like_count')
      .eq('id', id)
      .single()

    if (!post) throw new HttpException('动态不存在', HttpStatus.NOT_FOUND)

    const { data, error } = await this.client()
      .from('posts')
      .update({ like_count: (post.like_count || 0) + 1 })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new HttpException(`操作失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    return data
  }

  /** 评论 */
  async commentPost(dto: any) {
    console.log('[CommunityService] commentPost - postId:', dto.post_id)
    const { data, error } = await this.client()
      .from('comments')
      .insert({
        post_id: dto.post_id,
        member_id: dto.member_id,
        content: dto.content,
        parent_id: dto.parent_id || null,
      })
      .select()
      .single()

    if (error) throw new HttpException(`评论失败: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)

    // 更新评论数
    const { data: post } = await this.client()
      .from('posts')
      .select('comment_count')
      .eq('id', dto.post_id)
      .single()

    if (post) {
      await this.client()
        .from('posts')
        .update({ comment_count: (post.comment_count || 0) + 1 })
        .eq('id', dto.post_id)
    }

    return data
  }
}
